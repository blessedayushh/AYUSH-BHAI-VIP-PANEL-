import { storage } from './storage.js';
import { wsManager } from './wsServer.js';
import { GameColour, GameSize, Prediction, getWingoActiveRoundId } from './types.js';

export const WINGO_1M_API_URL = 'https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json';

export interface RawWingoItem {
  issueNumber: string;
  number: string;
  color: string;
  premium?: string;
  sum?: number;
}

export interface RawWingoResponse {
  data?: {
    list?: RawWingoItem[];
    pageNo?: number;
    totalPage?: number;
    totalCount?: number;
  };
  code?: number;
  msg?: string;
  serviceTime?: number;
}

export interface ParsedWingoItem {
  roundId: string;
  number: number;
  colour: GameColour;
  size: GameSize;
  timestamp: string;
  rawColor: string;
}

export interface WingoFeedStatus {
  endpoint: string;
  status: 'ONLINE' | 'ERROR' | 'INITIALIZING';
  lastSyncTime: string;
  latestIssueNumber?: string;
  activeRoundId?: string;
  syncedCount: number;
  lastError?: string;
  autoSyncEnabled: boolean;
  lastDrawNumber?: number;
  lastDrawColour?: GameColour;
  lastDrawSize?: GameSize;
}

class WingoService {
  private pollTimer: NodeJS.Timeout | null = null;
  private isSyncing: boolean = false;
  private status: WingoFeedStatus = {
    endpoint: WINGO_1M_API_URL,
    status: 'INITIALIZING',
    lastSyncTime: new Date().toISOString(),
    syncedCount: 0,
    autoSyncEnabled: true,
  };

  public getStatus(): WingoFeedStatus {
    return {
      ...this.status,
      activeRoundId: storage.getActiveRoundId(),
    };
  }

  public setAutoSync(enabled: boolean) {
    this.status.autoSyncEnabled = enabled;
    if (enabled) {
      this.startPolling();
    } else {
      this.stopPolling();
    }
  }

  public startPolling(intervalMs = 4000) {
    if (this.pollTimer) return;
    this.status.autoSyncEnabled = true;

    // Run initial sync immediately
    this.sync('startup').catch((err) => {
      console.warn('[WingoService] Initial sync error:', err.message);
    });

    this.pollTimer = setInterval(() => {
      if (!this.status.autoSyncEnabled) return;
      this.sync('interval_poll').catch((err) => {
        console.warn('[WingoService] Polling sync error:', err.message);
      });
    }, intervalMs);

    console.log(`[WingoService] Started background polling every ${intervalMs}ms from ${WINGO_1M_API_URL}`);
  }

  public stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.status.autoSyncEnabled = false;
    console.log('[WingoService] Polling stopped');
  }

  public async fetchRawHistory(): Promise<{ items: RawWingoItem[]; serviceTime?: number }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(WINGO_1M_API_URL, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ColorPredict-Pro/2.0 (WinGo 1M Realtime Sync)',
          'Cache-Control': 'no-cache',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`WinGo API HTTP error ${response.status}: ${response.statusText}`);
      }

      const data: RawWingoResponse = await response.json();
      if (!data || !data.data || !Array.isArray(data.data.list)) {
        throw new Error(`Malformed WinGo response format: ${JSON.stringify(data).slice(0, 100)}`);
      }

      return {
        items: data.data.list,
        serviceTime: data.serviceTime,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  public parseItem(raw: RawWingoItem): ParsedWingoItem | null {
    if (!raw.issueNumber) return null;
    const roundId = String(raw.issueNumber).trim();
    const number = parseInt(String(raw.number).trim(), 10);
    if (isNaN(number) || number < 0 || number > 9) return null;

    const config = storage.getConfig();
    const rawColor = String(raw.color || '').toLowerCase().trim();

    // Size determination: 0-4 = SMALL, 5-9 = BIG
    const size: GameSize = number >= 5 ? 'BIG' : 'SMALL';

    // Colour determination
    let colour: GameColour;
    if (config.numberToColourMap && config.numberToColourMap[number]) {
      colour = config.numberToColourMap[number];
    } else if (rawColor.includes('violet')) {
      colour = 'VIOLET';
    } else if (rawColor.includes('green')) {
      colour = 'GREEN';
    } else if (rawColor.includes('red')) {
      colour = 'RED';
    } else {
      colour = number % 2 === 0 ? 'RED' : 'GREEN';
    }

    return {
      roundId,
      number,
      colour,
      size,
      rawColor,
      timestamp: new Date().toISOString(),
    };
  }

  public async sync(trigger = 'manual'): Promise<{
    success: boolean;
    newItemsCount: number;
    activeRoundId: string;
    latestResult?: any;
    error?: string;
  }> {
    if (this.isSyncing) {
      return {
        success: true,
        newItemsCount: 0,
        activeRoundId: storage.getActiveRoundId(),
      };
    }

    this.isSyncing = true;
    try {
      const { items: rawList } = await this.fetchRawHistory();
      if (rawList.length === 0) {
        throw new Error('Empty result list returned by WinGo API');
      }

      const parsedList: ParsedWingoItem[] = [];
      for (const raw of rawList) {
        const parsed = this.parseItem(raw);
        if (parsed) parsedList.push(parsed);
      }

      if (parsedList.length === 0) {
        throw new Error('No valid items could be parsed from WinGo API payload');
      }

      // Sort chronological: oldest to newest
      parsedList.sort((a, b) => {
        try {
          const diff = BigInt(a.roundId) - BigInt(b.roundId);
          return diff < 0n ? -1 : diff > 0n ? 1 : 0;
        } catch {
          return a.roundId.localeCompare(b.roundId);
        }
      });

      // Filter to items not yet in local storage or existing ones that were AUTO_DRAW/MANUAL
      const unrecordedItems = parsedList.filter((item) => {
        const existing = storage.getAllResults().find((r) => r.roundId === item.roundId);
        return !existing || existing.source !== 'WINGO_API';
      });
      let processedOutcome: any = null;

      for (const item of unrecordedItems) {
        try {
          processedOutcome = storage.processNewResult(
            {
              roundId: item.roundId,
              number: item.number,
              colour: item.colour,
              size: item.size,
              timestamp: item.timestamp,
              source: 'WINGO_API',
            },
            `wingo_api_sync_${trigger}`
          );

          // Broadcast real-time notifications to all active clients
          wsManager.broadcast('NEW_RESULT', processedOutcome.result);
          wsManager.broadcast('PREDICTION_EVALUATED', {
            roundId: item.roundId,
            evaluated: processedOutcome.evaluated,
          });
          wsManager.broadcast('NEW_PREDICTION', {
            roundId: processedOutcome.nextPredictions[0]?.roundId || storage.getActiveRoundId(),
            predictions: processedOutcome.nextPredictions,
            numberStatus: processedOutcome.status,
          });

          this.status.syncedCount++;
          console.log(`[WingoService] Synced official draw #${item.roundId}: ${item.number} (${item.colour}/${item.size})`);
        } catch (itemErr: any) {
          console.warn(`[WingoService] Skipping item #${item.roundId}:`, itemErr.message);
        }
      }

      // Identify the absolute latest completed issue and the canonical active round
      const latestFeedItem = parsedList[parsedList.length - 1];
      const canonicalActive = getWingoActiveRoundId();
      let expectedActiveRound = canonicalActive;
      try {
        const nextAfterFeed = (BigInt(latestFeedItem.roundId) + 1n).toString();
        if (BigInt(nextAfterFeed) > BigInt(canonicalActive)) {
          expectedActiveRound = nextAfterFeed;
        }
      } catch {}

      // If active round in storage lagged behind or wasn't set, advance it
      if (storage.getActiveRoundId() !== expectedActiveRound) {
        storage.setActiveRoundId(expectedActiveRound);
      }

      // Ensure predictions exist for this round
      const existingPreds = storage.getPredictionsForRound(expectedActiveRound);
      if (existingPreds.length === 0) {
        const analytics = storage.getAnalytics();
        const evalAcc = {
          overall: analytics.numberAccuracy,
          rolling100: analytics.rolling.last100.number,
          sampleCount: analytics.totalEvaluatedNumber,
        };
        const bundle = storage.getEngine().generate(expectedActiveRound, storage.getResults(), evalAcc);
        storage.addPredictionBundle(bundle);
        wsManager.broadcast('NEW_PREDICTION', {
          roundId: expectedActiveRound,
          predictions: [bundle.colourPrediction, bundle.sizePrediction, bundle.numberPrediction],
          numberStatus: bundle.numberStatus,
        });
      }

      // Always align nextDrawTime cleanly to the upcoming minute mark (:00.000)
      const now = Date.now();
      const nextMinuteEpoch = Math.floor(now / 60000) * 60000 + 60000;
      const nextDrawTime = new Date(nextMinuteEpoch).toISOString();
      storage.setNextDrawTime(nextDrawTime);
      const remainingSeconds = Math.max(0, Math.ceil((nextMinuteEpoch - now) / 1000));

      // Broadcast fresh countdown tick whenever a new item was ingested or active round synchronized
      if (unrecordedItems.length > 0 || trigger === 'startup') {
        wsManager.broadcast('COUNTDOWN_TICK', {
          activeRoundId: expectedActiveRound,
          remainingSeconds,
          nextDrawTime,
          roundIntervalSeconds: 60,
        });
      }

      // Update service status
      this.status.status = 'ONLINE';
      this.status.lastSyncTime = new Date().toISOString();
      this.status.latestIssueNumber = latestFeedItem.roundId;
      this.status.lastDrawNumber = latestFeedItem.number;
      this.status.lastDrawColour = latestFeedItem.colour;
      this.status.lastDrawSize = latestFeedItem.size;
      this.status.lastError = undefined;

      return {
        success: true,
        newItemsCount: unrecordedItems.length,
        activeRoundId: expectedActiveRound,
        latestResult: latestFeedItem,
      };
    } catch (err: any) {
      this.status.status = 'ERROR';
      this.status.lastError = err.message || 'Unknown network error';
      console.error('[WingoService] Sync failed:', err.message);
      return {
        success: false,
        newItemsCount: 0,
        activeRoundId: storage.getActiveRoundId(),
        error: err.message,
      };
    } finally {
      this.isSyncing = false;
    }
  }
}

export const wingoService = new WingoService();
