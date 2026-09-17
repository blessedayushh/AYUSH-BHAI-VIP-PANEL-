export type GameColour = 'RED' | 'GREEN' | 'VIOLET';
export type GameSize = 'BIG' | 'SMALL';

/**
 * Determines whether a predicted colour is a winning match against the actual outcome.
 * In WinGo / Colour Trading rules:
 * - Number 0 is RED + VIOLET (Violet comes with Red). Predictions of RED or VIOLET WIN!
 * - Number 5 is GREEN + VIOLET (Violet comes with Green). Predictions of GREEN or VIOLET WIN!
 * - When actual colour is VIOLET:
 *   If actual number is 5, GREEN and VIOLET win.
 *   If actual number is 0 (or unspecified), Violet comes with RED, so RED and VIOLET win!
 */
export function isColourWin(
  predictedColour?: GameColour | string | number,
  actualColour?: GameColour | string,
  actualNumber?: number | string
): boolean {
  if (!predictedColour) return false;
  const p = String(predictedColour).toUpperCase().trim();
  const a = String(actualColour || '').toUpperCase().trim();
  const n =
    actualNumber !== undefined && actualNumber !== null && !isNaN(Number(actualNumber))
      ? Number(actualNumber)
      : NaN;

  // Direct identical match always wins
  if (p === a) return true;

  // Number 0 is Red + Violet (Violet comes with Red)
  if (n === 0) {
    if (p === 'RED' || p === 'VIOLET') return true;
  }

  // Number 5 is Green + Violet (Violet comes with Green)
  if (n === 5) {
    if (p === 'GREEN' || p === 'VIOLET') return true;
  }

  // If actual colour is VIOLET (or includes violet)
  if (a === 'VIOLET' || a.includes('VIOLET')) {
    if (n === 5) {
      if (p === 'GREEN' || p === 'VIOLET') return true;
    } else {
      // For number 0 or general violet: Violet comes with Red!
      if (p === 'RED' || p === 'VIOLET') return true;
    }
  }

  // If prediction was RED and actual was RED, 0, or VIOLET
  if (p === 'RED') {
    if (a === 'RED' || n === 0 || a === 'VIOLET' || a.includes('RED')) return true;
  }

  // If prediction was GREEN and actual was GREEN, 5, or VIOLET with 5
  if (p === 'GREEN') {
    if (a === 'GREEN' || n === 5 || a.includes('GREEN')) return true;
  }

  // If prediction was VIOLET and actual was 0, 5, or VIOLET
  if (p === 'VIOLET') {
    if (a === 'VIOLET' || n === 0 || n === 5 || a.includes('VIOLET')) return true;
  }

  return false;
}
export type PredictionType = 'COLOUR' | 'SIZE' | 'NUMBER';
export type ConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type PredictionStatus = 'PENDING' | 'CORRECT' | 'INCORRECT' | 'NOT_ACTIVE';
export type NumberPredictionStatus = 'DISABLED' | 'EVALUATING' | 'ACTIVE' | 'DEGRADED';
export type LicenseStatus = 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'REVOKED';

export interface GameResult {
  roundId: string;
  number: number;
  colour: GameColour;
  size: GameSize;
  timestamp: string;
  source: 'MANUAL' | 'CSV' | 'DEV_SYNTHETIC' | 'AUTO_DRAW' | 'WINGO_API';
  createdAt: string;
}

export interface WingoFeedStatus {
  endpoint: string;
  status: 'ONLINE' | 'ERROR' | 'INITIALIZING';
  lastSyncTime: string;
  latestIssueNumber?: string;
  activeRoundId?: string;
  syncedCount?: number;
  lastError?: string;
  autoSyncEnabled?: boolean;
}

export interface Prediction {
  id: string;
  roundId: string;
  predictionType: PredictionType;
  predictedValue: string | number;
  probability: number;
  confidence: ConfidenceLevel;
  modelId: string;
  modelVersion: string;
  ensembleVersion: string;
  timestamp: string;
  inputDataCutoff: string;
  status: PredictionStatus;
  allProbabilities?: Record<string, number>;
  evaluationTimestamp?: string;
  actualValue?: string | number;
  backupValue?: number;
  backupProbability?: number;
  primaryCategory?: GameSize;
  backupCategory?: GameSize;
  backupStatus?: PredictionStatus;
}

export interface User {
  id: string;
  username: string;
  role: 'USER' | 'ADMIN';
  licenseKey: string;
  status: 'ACTIVE' | 'DISABLED';
}

export interface License {
  id: string;
  key: string;
  username: string;
  status: LicenseStatus;
  expiresAt: string;
  createdAt: string;
  lastUsedAt?: string;
  notes?: string;
}

export interface UserDashboardData {
  activeRoundId: string;
  nextDrawTime: string;
  countdownSeconds: number;
  roundIntervalSeconds?: number;
  latestResult: GameResult | null;
  predictions: {
    colour: Prediction | null;
    size: Prediction | null;
    number: Prediction | null;
    numberStatus: NumberPredictionStatus;
    numberDisabledReason: string | null;
  };
  recentResults: GameResult[];
  recentPredictions: Prediction[];
  statistics: {
    colourAccuracy: number;
    sizeAccuracy: number;
    numberAccuracy: number;
    evaluatedCount: number;
    rollingLast50: { colour: number; size: number; number: number };
  };
  isDevMode: boolean;
  levelInfo?: {
    currentLevel: number;
    maxLevels: number;
    previousOutcome?: 'WIN' | 'LOSS';
    previousRoundId?: string;
  };
}

export interface AnalyticsSummary {
  colourAccuracy: number;
  sizeAccuracy: number;
  numberAccuracy: number;
  totalEvaluatedColour: number;
  totalEvaluatedSize: number;
  totalEvaluatedNumber: number;
  rolling: {
    last25: { colour: number; size: number; number: number };
    last50: { colour: number; size: number; number: number };
    last100: { colour: number; size: number; number: number };
    last200: { colour: number; size: number; number: number };
    last500: { colour: number; size: number; number: number };
  };
  byConfidence: {
    HIGH: { accuracy: number; count: number };
    MEDIUM: { accuracy: number; count: number };
    LOW: { accuracy: number; count: number };
  };
  byColour: Record<GameColour, { predictedCount: number; correctCount: number; actualCount: number; accuracy: number }>;
  bySize: Record<GameSize, { predictedCount: number; correctCount: number; actualCount: number; accuracy: number }>;
  byNumber: Record<number, { predictedCount: number; correctCount: number; actualCount: number; accuracy: number }>;
  numberAnalytics: {
    status: NumberPredictionStatus;
    validationSamples: number;
    overallAccuracy: number;
    rolling100Accuracy: number;
    rolling200Accuracy: number;
    exactHitCount: number;
    missCount: number;
    confusionMatrix: number[][];
    calibration: { bin: string; predictedProb: number; actualRate: number; count: number }[];
    numberWeights: { name: string; weight: number; accuracy: number; brier: number }[];
  };
  adminStats: {
    totalPredictions: number;
    colourAccuracy: number;
    sizeAccuracy: number;
    numberAccuracy: number;
  };
}

export interface AdminDashboardData {
  overview: {
    totalUsers: number;
    activeUsers: number;
    activeLicenses: number;
    expiredLicenses: number;
    suspendedLicenses: number;
    totalResults: number;
    totalPredictions: number;
    colourAccuracy: number;
    sizeAccuracy: number;
    numberAccuracy: number;
    numberPredictionStatus: NumberPredictionStatus;
    systemStatus: {
      predictionEngine: 'ONLINE' | 'OFFLINE';
      database: 'CONNECTED' | 'DISCONNECTED';
      worker: 'RUNNING' | 'STOPPED';
      lastResult?: string;
      lastPrediction?: string;
      colourModel: string;
      bigSmallModel: string;
      numberModel: string;
      isDevMode: boolean;
    };
  };
  analytics: AnalyticsSummary;
  adminPredictions: {
    id: string;
    roundId: string;
    colour?: GameColour;
    size?: GameSize;
    number?: number;
    colourStatus?: string;
    sizeStatus?: string;
    numberStatus?: string;
    createdAt: string;
  }[];
  auditLogs: {
    id: string;
    action: string;
    actor: string;
    details: string;
    timestamp: string;
  }[];
  config: {
    numberToColourMap: Record<number, GameColour>;
    numberToSizeMap: Record<number, GameSize>;
    minNumberValidationSamples: number;
    numberActivationAccuracy: number;
    countdownSeconds: number;
    roundIntervalSeconds: number;
    autoDrawEnabled?: boolean;
  };
  wingoFeedStatus?: WingoFeedStatus;
}

export type NotificationType = 'NEW_RESULT' | 'NEW_PREDICTION' | 'NUMBER_STATUS_CHANGED' | 'SYSTEM_INFO';

export interface NumberStatusChangedPayload {
  title?: string;
  message?: string;
  previousStatus: NumberPredictionStatus;
  currentStatus: NumberPredictionStatus;
  triggerSource?: string;
  accuracy: number;
  rolling100Accuracy: number;
  totalEvaluated: number;
  minRequiredSamples: number;
  requiredAccuracy: number;
  timestamp: string;
}

export interface RealtimeNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read?: boolean;
  data?: {
    roundId?: string;
    result?: GameResult;
    prediction?: {
      colour?: string | number;
      size?: string | number;
      number?: string | number;
      confidence?: ConfidenceLevel;
      probability?: number;
      numberStatus?: NumberPredictionStatus;
    };
    numberStatusChange?: NumberStatusChangedPayload;
  };
}

// ============================================================
// TRADE ANALYSIS & QUANTITATIVE SIGNALS
// ============================================================

export type StakingStrategy = 'LEVELS_4' | 'FLAT' | 'MARTINGALE' | 'KELLY' | 'FIBONACCI';

export interface LiveTradeDirective {
  roundId: string;
  nextDrawTime: string;
  primaryAction: {
    market: 'SIZE' | 'COLOUR';
    target: string;
    probability: number;
    odds: number;
    expectedValue: number;
    signalQuality: 'A+' | 'A' | 'B' | 'NEUTRAL';
    confidence: ConfidenceLevel;
    recommendedStakeUnits: number;
    recommendedStakePct: number;
  };
  hedgeAction: {
    market: 'NUMBER';
    primaryNumber: number;
    backupNumber: number;
    combinedProbability: number;
    payoutOdds: number;
    expectedValue: number;
    recommendedStakeUnits: number;
    strategyNote: string;
  };
  regime: {
    patternType: 'STREAK_DRAGON' | 'ALTERNATING_ZIGZAG' | 'MEAN_REVERSION' | 'STABLE_TREND' | 'CHOPPY';
    consecutiveCount: number;
    streakValue?: string;
    volatilityLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    advice: string;
  };
  martingaleState: {
    currentStage: number;
    maxSafeStages: number;
    stageMultiplier: number;
    recommendedUnits: number;
    lastResultHit: boolean;
  };
}

export interface TradeJournalEntry {
  roundId: string;
  timestamp: string;
  market: 'SIZE' | 'COLOUR' | 'NUMBER_HEDGE';
  selection: string;
  actualOutcome: string;
  stakedUnits: number;
  stakedAmount: number;
  payoutOdds: number;
  isWin: boolean;
  netProfit: number;
  runningEquity: number;
  martingaleStage: number;
  confidence: ConfidenceLevel;
  probability: number;
}

export interface TradePerformanceSummary {
  bankroll: number;
  initialBankroll: number;
  currentEquity: number;
  totalNetProfit: number;
  returnOnInvestmentPct: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRatePct: number;
  profitFactor: number;
  expectedValuePerTrade: number;
  currentStreak: { type: 'WIN' | 'LOSS'; count: number };
  maxWinStreak: number;
  maxLossStreak: number;
  maxDrawdownAmount: number;
  maxDrawdownPct: number;
  breakdown: {
    sizeTrades: { total: number; wins: number; winRate: number; netProfit: number };
    colourTrades: { total: number; wins: number; winRate: number; netProfit: number };
    numberHedgeTrades: { total: number; wins: number; winRate: number; netProfit: number };
  };
  equityCurve: {
    roundIndex: number;
    roundId: string;
    equity: number;
    profit: number;
    drawdown: number;
    isWin: boolean;
  }[];
}

export interface TradeAnalysisData {
  liveDirective: LiveTradeDirective;
  performance: TradePerformanceSummary;
  recentTrades: TradeJournalEntry[];
  availableStrategies: { id: StakingStrategy; name: string; description: string; riskLevel: string }[];
}

/**
 * Calculates the exact canonical WinGo 1M active round ID for a given UTC timestamp.
 * In official WinGo 1M:
 * Each UTC day has 1440 minutes, indexed from 1 (00:00 UTC = 0001) to 1440 (23:59 UTC = 1440).
 * Format: YYYYMMDD + 10001 + 4-digit period index.
 */
export function getWingoActiveRoundId(timeMs: number = Date.now()): string {
  const date = new Date(timeMs);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const periodIndex = date.getUTCHours() * 60 + date.getUTCMinutes() + 1;
  const periodStr = String(periodIndex).padStart(4, '0');
  return `${year}${month}${day}10001${periodStr}`;
}

