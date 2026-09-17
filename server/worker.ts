import { storage } from './storage.js';
import { wsManager } from './wsServer.js';
import { GameColour, GameSize } from './types.js';
import { wingoService } from './wingoService.js';

class BackgroundWorker {
  private timer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private isExecutingDraw: boolean = false;

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;

    // Start live WinGo 1M API polling feed
    wingoService.startPolling(4000);

    // Check on startup if current round draw time is expired
    this.checkAndInitDrawTime();

    this.timer = setInterval(() => {
      this.tick();
    }, 1000);
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    wingoService.stopPolling();
    this.isRunning = false;
  }

  private checkAndInitDrawTime() {
    const nextDrawTime = storage.getNextDrawTime();
    const target = new Date(nextDrawTime).getTime();
    const now = Date.now();

    // If nextDrawTime is invalid or in the past, execute draw or sync
    if (!nextDrawTime || isNaN(target) || target <= now) {
      this.executeDraw();
    }
  }

  public async executeDraw() {
    if (this.isExecutingDraw) return;
    this.isExecutingDraw = true;

    try {
      // 1. Primary: Attempt live sync with official WinGo 1M API
      const wingoStatus = wingoService.getStatus();
      if (wingoStatus.autoSyncEnabled !== false) {
        await wingoService.sync('worker_timer');
        // In live mode, draws are authoritative and come from the official WinGo 1M API.
        // We never generate synthetic AUTO_DRAW results while connected to the official feed.
        return;
      }

      // 2. Secondary fallback (ONLY when admin has explicitly disabled autoSync for offline simulation)
      const config = storage.getConfig();
      if (config.autoDrawEnabled === false) {
        return;
      }
      const activeRoundId = storage.getActiveRoundId();

      // Check if admin entered a pre-prediction for this round
      const adminPred = storage.getAdminPredictions().find((p) => p.roundId === activeRoundId);

      let number: number;
      if (adminPred && adminPred.number !== undefined) {
        number = adminPred.number;
      } else {
        number = Math.floor(Math.random() * 10);
      }

      const colour: GameColour =
        adminPred?.colour || config.numberToColourMap[number] || (number % 2 === 0 ? 'RED' : 'GREEN');
      const size: GameSize =
        adminPred?.size || config.numberToSizeMap[number] || (number >= 5 ? 'BIG' : 'SMALL');

      const outcome = storage.processNewResult(
        {
          roundId: activeRoundId,
          number,
          colour,
          size,
          timestamp: new Date().toISOString(),
          source: 'AUTO_DRAW',
        },
        'system_timer'
      );

      // Broadcast live event updates to all connected users
      wsManager.broadcast('NEW_RESULT', outcome.result);
      wsManager.broadcast('PREDICTION_EVALUATED', { roundId: activeRoundId, evaluated: outcome.evaluated });
      wsManager.broadcast('NEW_PREDICTION', {
        roundId: outcome.nextPredictions[0]?.roundId || storage.getActiveRoundId(),
        predictions: outcome.nextPredictions,
        numberStatus: outcome.status,
      });

      const newRoundId = storage.getActiveRoundId();
      const newNextDrawTime = storage.getNextDrawTime();
      const interval = config.roundIntervalSeconds || 60;

      // Broadcast the fresh countdown tick for the newly opened round
      wsManager.broadcast('COUNTDOWN_TICK', {
        activeRoundId: newRoundId,
        remainingSeconds: interval,
        nextDrawTime: newNextDrawTime,
        roundIntervalSeconds: interval,
      });
    } catch (err) {
      console.error('[BackgroundWorker] Error during round execution:', err);
      // Advance nextDrawTime to prevent error loops
      storage.resetNextDrawTime(60);
    } finally {
      this.isExecutingDraw = false;
    }
  }

  private tick() {
    const nextDrawTime = storage.getNextDrawTime();
    const activeRoundId = storage.getActiveRoundId();
    const config = storage.getConfig();
    const autoDrawEnabled = config.autoDrawEnabled !== false;
    const roundInterval = config.roundIntervalSeconds || 60;

    const now = Date.now();
    let target = new Date(nextDrawTime).getTime();

    // If target is invalid, align cleanly to next minute
    if (isNaN(target)) {
      target = Math.floor(now / (roundInterval * 1000)) * (roundInterval * 1000) + (roundInterval * 1000);
      storage.setNextDrawTime(new Date(target).toISOString());
    }

    const diffMs = target - now;
    const remainingSeconds = Math.max(0, Math.ceil(diffMs / 1000));

    if (this.isExecutingDraw || remainingSeconds <= 0) {
      wsManager.broadcast('COUNTDOWN_TICK', {
        activeRoundId,
        remainingSeconds: 0,
        nextDrawTime,
        roundIntervalSeconds: roundInterval,
      });

      if (autoDrawEnabled && !this.isExecutingDraw) {
        this.executeDraw();
      }
    } else {
      wsManager.broadcast('COUNTDOWN_TICK', {
        activeRoundId,
        remainingSeconds,
        nextDrawTime,
        roundIntervalSeconds: roundInterval,
      });
    }
  }
}

export const backgroundWorker = new BackgroundWorker();
