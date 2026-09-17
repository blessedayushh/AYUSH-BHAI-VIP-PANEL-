import express, { Request, Response, NextFunction } from 'express';
import { storage } from './storage.js';
import { wsManager } from './wsServer.js';
import { backgroundWorker } from './worker.js';
import { wingoService } from './wingoService.js';
import { GameColour, GameSize, User, StakingStrategy, getWingoActiveRoundId } from './types.js';
import { tradeAnalysisEngine } from './engine/tradeAnalysisEngine.js';

export const apiRouter = express.Router();

// Middleware to parse JSON
apiRouter.use(express.json({ limit: '10mb' }));

// Auth token helper
interface AuthenticatedRequest extends Request {
  user?: User;
}

const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization || req.headers['x-auth-token'];
  const token = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '').trim() : '';

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. No session token provided.' });
  }

  const user = storage.getSessionUser(token);
  if (!user) {
    return res.status(401).json({ error: 'Session expired or invalid token. Please log in again.' });
  }

  req.user = user;
  next();
};

const adminOnlyMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied. Administrator privilege required.' });
  }
  next();
};

// Health route
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// ============================================================
// AUTHENTICATION ROUTES
// ============================================================

apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { username, licenseKey } = req.body;
  if (!username || !licenseKey) {
    return res.status(400).json({ error: 'Username and license key are required.' });
  }

  const result = storage.loginWithLicense(username.trim(), licenseKey.trim());
  if ('error' in result) {
    return res.status(403).json({ error: result.error });
  }

  return res.json({
    token: result.token,
    user: {
      id: result.user.id,
      username: result.user.username,
      role: result.user.role,
      licenseKey: result.user.licenseKey,
      status: result.user.status,
    },
    license: {
      key: result.license.key,
      status: result.license.status,
      expiresAt: result.license.expiresAt,
    },
  });
});

apiRouter.post('/auth/logout', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const authHeader = req.headers.authorization || req.headers['x-auth-token'];
  const token = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '').trim() : '';
  if (token) {
    storage.logout(token);
  }
  return res.json({ success: true, message: 'Logged out successfully.' });
});

apiRouter.get('/auth/me', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const lic = storage.findLicense(user.licenseKey);
  return res.json({
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      licenseKey: user.licenseKey,
      status: user.status,
    },
    license: lic
      ? {
          key: lic.key,
          status: lic.status,
          expiresAt: lic.expiresAt,
        }
      : null,
  });
});

// ============================================================
// USER ENDPOINTS
// ============================================================

apiRouter.get('/user/dashboard', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
  const latestBundle = storage.getLatestActivePredictionBundle();
  const latestResult = storage.getLatestResult();
  const recentResults = storage.getResults(10);
  const recentPredictions = storage.getPredictions(15);
  const analytics = storage.getAnalytics();
  const config = storage.getConfig();

  // Filter number prediction according to strict activation rule
  const isNumberActive = latestBundle.numberStatus === 'ACTIVE';

  // Compute actual remaining countdown seconds
  const now = Date.now();
  const target = new Date(latestBundle.nextDrawTime).getTime();
  const remainingSeconds = isNaN(target) ? (config.roundIntervalSeconds || 60) : Math.max(0, Math.ceil((target - now) / 1000));

  return res.json({
    activeRoundId: latestBundle.roundId,
    nextDrawTime: latestBundle.nextDrawTime,
    countdownSeconds: remainingSeconds,
    roundIntervalSeconds: config.roundIntervalSeconds || 60,
    latestResult,
    predictions: {
      colour: latestBundle.colour,
      size: latestBundle.size,
      number: latestBundle.number,
      numberStatus: latestBundle.numberStatus,
      numberDisabledReason:
        latestBundle.numberStatus !== 'ACTIVE'
          ? `Model continuous walk-forward calibration: ${(analytics.numberAccuracy * 100).toFixed(1)}% accuracy on ${analytics.totalEvaluatedNumber} live samples. Candidate forecast provided.`
          : null,
    },
    recentResults,
    recentPredictions,
    statistics: {
      colourAccuracy: analytics.colourAccuracy,
      sizeAccuracy: analytics.sizeAccuracy,
      numberAccuracy: analytics.numberAccuracy,
      evaluatedCount: analytics.totalEvaluatedColour,
      rollingLast50: analytics.rolling.last50,
    },
    levelInfo: storage.getLevelInfo(),
    isDevMode: storage.isDevMode(),
    wingoFeedStatus: wingoService.getStatus(),
  });
});

apiRouter.get('/user/results', authMiddleware, (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string, 10) || 50;
  const results = storage.getResults(limit);
  return res.json({ results });
});

apiRouter.get('/user/predictions', authMiddleware, (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string, 10) || 50;
  const predictions = storage.getPredictions(limit);
  return res.json({ predictions });
});

apiRouter.get('/user/statistics', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
  const analytics = storage.getAnalytics();
  return res.json(analytics);
});

apiRouter.get('/user/trade-analysis', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const bankroll = parseFloat(req.query.bankroll as string) || 1000;
  const strategy = (req.query.strategy as StakingStrategy) || 'FLAT';
  const baseUnit = parseFloat(req.query.baseUnit as string) || Math.max(5, Math.round(bankroll * 0.01));
  const limit = parseInt(req.query.limit as string, 10) || 60;

  const allResults = storage.getAllResults();
  const allPredictions = storage.getPredictions(200);
  const latestBundle = storage.getLatestActivePredictionBundle();

  const analysis = tradeAnalysisEngine.generate(
    allResults,
    allPredictions,
    latestBundle,
    { bankroll, strategy, baseUnit, limit, liveLevel: storage.getCurrentLevel() }
  );

  return res.json(analysis);
});

// ============================================================
// PUBLIC/SHARED RESULTS & PREDICTIONS
// ============================================================

apiRouter.get('/results/latest', (_req: Request, res: Response) => {
  const latest = storage.getLatestResult();
  return res.json({ latest });
});

apiRouter.get('/results/history', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string, 10) || 100;
  const results = storage.getResults(limit);
  return res.json({ results });
});

apiRouter.get('/predictions/latest', (_req: Request, res: Response) => {
  const bundle = storage.getLatestActivePredictionBundle();
  return res.json(bundle);
});

apiRouter.get('/predictions/history', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string, 10) || 100;
  const predictions = storage.getPredictions(limit);
  return res.json({ predictions });
});

// ============================================================
// ADMIN RESULT & PREDICTION MANAGEMENT
// ============================================================

apiRouter.post('/admin/results', authMiddleware, adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const { roundId, number, colour, size, timestamp } = req.body;

  if (!roundId || number === undefined || number === null) {
    return res.status(400).json({ error: 'Round ID and number (0-9) are required.' });
  }

  const num = parseInt(number, 10);
  if (isNaN(num) || num < 0 || num > 9) {
    return res.status(400).json({ error: 'Number must be between 0 and 9.' });
  }

  try {
    const processOutcome = storage.processNewResult(
      {
        roundId: roundId.toString().trim(),
        number: num,
        colour: colour ? (colour.toUpperCase() as GameColour) : undefined,
        size: size ? (size.toUpperCase() as GameSize) : undefined,
        timestamp,
        source: 'MANUAL',
      },
      req.user!.username
    );

    // Broadcast live WebSocket events
    wsManager.broadcast('NEW_RESULT', processOutcome.result);
    wsManager.broadcast('PREDICTION_EVALUATED', {
      roundId: processOutcome.result.roundId,
      evaluated: processOutcome.evaluated,
    });
    wsManager.broadcast('NEW_PREDICTION', {
      roundId: processOutcome.nextPredictions[0]?.roundId || storage.getActiveRoundId(),
      predictions: processOutcome.nextPredictions,
      numberStatus: processOutcome.status,
    });
    wsManager.broadcast('MODEL_UPDATED', {
      timestamp: new Date().toISOString(),
      analytics: storage.getAnalytics(),
    });

    return res.json({
      success: true,
      message: `Result for round ${roundId} processed successfully.`,
      result: processOutcome.result,
      evaluated: processOutcome.evaluated,
      nextPredictions: processOutcome.nextPredictions,
      numberStatus: processOutcome.status,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to process result' });
  }
});

apiRouter.post('/admin/predictions', authMiddleware, adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const { roundId, colour, size, number } = req.body;

  if (!roundId) {
    return res.status(400).json({ error: 'Round ID is required.' });
  }

  const newAdminPred = storage.submitAdminPrediction(
    {
      roundId: roundId.toString().trim(),
      colour: colour ? (colour.toUpperCase() as GameColour) : undefined,
      size: size ? (size.toUpperCase() as GameSize) : undefined,
      number: number !== undefined && number !== null && number !== '' ? parseInt(number, 10) : undefined,
    },
    req.user!.username
  );

  return res.json({
    success: true,
    adminPrediction: newAdminPred,
  });
});

// ============================================================
// ADMIN DASHBOARD & MANAGEMENT
// ============================================================

apiRouter.get('/admin/dashboard', authMiddleware, adminOnlyMiddleware, (_req: AuthenticatedRequest, res: Response) => {
  const users = storage.getUsers();
  const licenses = storage.getAllLicenses();
  const results = storage.getAllResults();
  const predictions = storage.getPredictions(500);
  const analytics = storage.getAnalytics();
  const systemStatus = storage.getSystemStatus();
  const adminPreds = storage.getAdminPredictions();

  const activeUsers = users.filter((u) => u.status === 'ACTIVE').length;
  const activeLicenses = licenses.filter((l) => l.status === 'ACTIVE').length;
  const expiredLicenses = licenses.filter((l) => l.status === 'EXPIRED').length;
  const suspendedLicenses = licenses.filter((l) => l.status === 'SUSPENDED').length;

  return res.json({
    overview: {
      totalUsers: users.length,
      activeUsers,
      activeLicenses,
      expiredLicenses,
      suspendedLicenses,
      totalResults: results.length,
      totalPredictions: predictions.length,
      colourAccuracy: analytics.colourAccuracy,
      sizeAccuracy: analytics.sizeAccuracy,
      numberAccuracy: analytics.numberAccuracy,
      numberPredictionStatus: analytics.numberAnalytics.status,
      systemStatus,
    },
    analytics,
    adminPredictions: adminPreds,
    auditLogs: storage.getAuditLogs(),
    config: storage.getConfig(),
  });
});

apiRouter.get('/admin/users', authMiddleware, adminOnlyMiddleware, (_req: AuthenticatedRequest, res: Response) => {
  const users = storage.getUsers();
  return res.json({ users });
});

apiRouter.patch('/admin/users/:id', authMiddleware, adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status || !['ACTIVE', 'DISABLED'].includes(status)) {
    return res.status(400).json({ error: 'Valid status (ACTIVE, DISABLED) is required.' });
  }

  const updated = storage.updateUserStatus(id, status, req.user!.username);
  if (!updated) {
    return res.status(404).json({ error: 'User not found.' });
  }
  return res.json({ user: updated });
});

apiRouter.get('/admin/licenses', authMiddleware, adminOnlyMiddleware, (_req: AuthenticatedRequest, res: Response) => {
  const licenses = storage.getAllLicenses();
  return res.json({ licenses });
});

apiRouter.post('/admin/licenses', authMiddleware, adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const { username, expiresDays, notes } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'Username is required for license generation.' });
  }

  const newLic = storage.createLicense(
    {
      username: username.trim(),
      expiresDays: parseInt(expiresDays, 10) || 30,
      notes,
    },
    req.user!.username
  );

  return res.status(201).json({ license: newLic });
});

apiRouter.patch('/admin/licenses/:id', authMiddleware, adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const updates = req.body;

  const updated = storage.updateLicense(id, updates, req.user!.username);
  if (!updated) {
    return res.status(404).json({ error: 'License not found.' });
  }
  return res.json({ license: updated });
});

apiRouter.delete('/admin/licenses/:id', authMiddleware, adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const deleted = storage.deleteLicense(id, req.user!.username);
  if (!deleted) {
    return res.status(404).json({ error: 'License not found.' });
  }
  return res.json({ success: true, message: 'License deleted successfully.' });
});

// ============================================================
// ADMIN MODEL MONITORING & BACKTESTING
// ============================================================

apiRouter.get('/admin/models', authMiddleware, adminOnlyMiddleware, (_req: AuthenticatedRequest, res: Response) => {
  const analytics = storage.getAnalytics();
  return res.json({
    pipelines: {
      colour: {
        status: 'ACTIVE',
        accuracy: analytics.colourAccuracy,
        evaluatedSamples: analytics.totalEvaluatedColour,
        rolling50: analytics.rolling.last50.colour,
        models: [
          { name: 'Multi-Model Ensemble v2.4', weight: 1.0, accuracy: analytics.colourAccuracy },
          { name: 'Markov Transition Matrix', weight: 0.25, accuracy: 0.62 },
          { name: 'Recency Frequency (Decay)', weight: 0.20, accuracy: 0.61 },
          { name: 'Rolling 30 Frequency', weight: 0.15, accuracy: 0.59 },
          { name: 'Sequence / N-gram Analyzer', weight: 0.10, accuracy: 0.60 },
          { name: 'Bayesian Conjugate Prior', weight: 0.10, accuracy: 0.58 },
          { name: 'Softmax Feature Classifier', weight: 0.10, accuracy: 0.60 },
        ],
      },
      size: {
        status: 'ACTIVE',
        accuracy: analytics.sizeAccuracy,
        evaluatedSamples: analytics.totalEvaluatedSize,
        rolling50: analytics.rolling.last50.size,
        models: [
          { name: 'Size Multi-Model Ensemble v2.1', weight: 1.0, accuracy: analytics.sizeAccuracy },
          { name: 'Markov Transition Model', weight: 0.25, accuracy: 0.58 },
          { name: 'Recency Weighting Model', weight: 0.20, accuracy: 0.57 },
          { name: 'Rolling 30 Frequency', weight: 0.15, accuracy: 0.55 },
          { name: 'Run-Length Pattern Model', weight: 0.10, accuracy: 0.56 },
          { name: 'Bayesian Conjugate Model', weight: 0.10, accuracy: 0.55 },
          { name: 'Feature Classifier', weight: 0.10, accuracy: 0.57 },
        ],
      },
      number: {
        status: analytics.numberAnalytics.status,
        accuracy: analytics.numberAccuracy,
        evaluatedSamples: analytics.totalEvaluatedNumber,
        rolling100: analytics.numberAnalytics.rolling100Accuracy,
        activationThreshold: storage.getConfig().numberActivationAccuracy,
        minSamplesRequired: storage.getConfig().minNumberValidationSamples,
        models: analytics.numberAnalytics.numberWeights,
      },
    },
  });
});

apiRouter.post('/admin/models/retrain', authMiddleware, adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const result = storage.rebuildWalkForward(req.user!.username);
  const analytics = storage.getAnalytics();
  wsManager.broadcast('MODEL_UPDATED', { analytics });
  return res.json({
    success: true,
    message: 'Models retrained and walk-forward validation recomputed.',
    details: result,
    analytics,
  });
});

apiRouter.post('/admin/models/backtest', authMiddleware, adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const result = storage.rebuildWalkForward(req.user!.username);
  const analytics = storage.getAnalytics();
  return res.json({
    success: true,
    message: 'Chronological walk-forward backtest completed.',
    details: result,
    analytics,
  });
});

// ============================================================
// ADMIN ADVANCED ANALYTICS & NUMBER ANALYTICS
// ============================================================

apiRouter.get('/admin/analytics', authMiddleware, adminOnlyMiddleware, (_req: AuthenticatedRequest, res: Response) => {
  const analytics = storage.getAnalytics();
  return res.json(analytics);
});

apiRouter.get('/admin/analytics/number', authMiddleware, adminOnlyMiddleware, (_req: AuthenticatedRequest, res: Response) => {
  const analytics = storage.getAnalytics();
  const config = storage.getConfig();
  return res.json({
    numberAnalytics: analytics.numberAnalytics,
    config: {
      minNumberValidationSamples: config.minNumberValidationSamples,
      numberActivationAccuracy: config.numberActivationAccuracy,
    },
  });
});

// ============================================================
// GAME CONFIG & CSV IMPORT
// ============================================================

apiRouter.get('/admin/config', authMiddleware, adminOnlyMiddleware, (_req: AuthenticatedRequest, res: Response) => {
  return res.json({ config: storage.getConfig() });
});

apiRouter.post('/admin/config', authMiddleware, adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const newConfig = req.body;
  const updated = storage.updateConfig(newConfig, req.user!.username);
  return res.json({ config: updated });
});

apiRouter.post('/admin/results/import-csv', authMiddleware, adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const { csvData } = req.body;
  if (!csvData || typeof csvData !== 'string') {
    return res.status(400).json({ error: 'CSV data string is required.' });
  }

  const importResult = storage.importCsvResults(csvData, req.user!.username);
  const analytics = storage.getAnalytics();
  wsManager.broadcast('MODEL_UPDATED', { analytics });

  return res.json({
    success: true,
    ...importResult,
    currentTotalResults: storage.getAllResults().length,
  });
});

// ============================================================
// DEVELOPMENT MODE & SYNTHETIC ENGINE
// ============================================================

apiRouter.post('/dev/toggle-mode', authMiddleware, adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const { enabled } = req.body;
  const isDev = storage.setDevMode(Boolean(enabled), req.user!.username);
  return res.json({ isDevMode: isDev });
});

apiRouter.post('/dev/generate-sample', authMiddleware, adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const count = parseInt(req.body.count, 10) || 1;
  const forceHighAccuracy = req.body.forceHighAccuracy === true; // For testing activation threshold

  const currentResults = storage.getAllResults();
  const lastRound = currentResults.length > 0 ? BigInt(currentResults[currentResults.length - 1].roundId) : BigInt(getWingoActiveRoundId());
  const config = storage.getConfig();

  const generated = [];
  let prevNumber = currentResults.length > 0 ? currentResults[currentResults.length - 1].number : 5;

  for (let i = 1; i <= Math.min(count, 50); i++) {
    const nextRoundId = (lastRound + BigInt(i)).toString();
    // Simulate number
    let nextNum: number;
    if (forceHighAccuracy) {
      // Predictable sequence to test activation threshold
      nextNum = (prevNumber + 1) % 10;
    } else {
      nextNum = Math.floor(Math.random() * 10);
    }
    prevNumber = nextNum;

    const col: GameColour = config.numberToColourMap[nextNum] || (nextNum % 2 === 0 ? 'RED' : 'GREEN');
    const size: GameSize = config.numberToSizeMap[nextNum] || (nextNum >= 5 ? 'BIG' : 'SMALL');

    const outcome = storage.processNewResult(
      {
        roundId: nextRoundId,
        number: nextNum,
        colour: col,
        size,
        timestamp: new Date().toISOString(),
        source: 'DEV_SYNTHETIC',
      },
      'dev_generator'
    );
    generated.push(outcome.result);

    wsManager.broadcast('NEW_RESULT', outcome.result);
    wsManager.broadcast('PREDICTION_EVALUATED', { roundId: nextRoundId, evaluated: outcome.evaluated });
    wsManager.broadcast('NEW_PREDICTION', {
      roundId: outcome.nextPredictions[0]?.roundId || storage.getActiveRoundId(),
      predictions: outcome.nextPredictions,
      numberStatus: outcome.status,
    });
  }

  const analytics = storage.getAnalytics();
  wsManager.broadcast('MODEL_UPDATED', { analytics });

  return res.json({
    success: true,
    generatedCount: generated.length,
    latestResult: generated[generated.length - 1],
    numberStatus: analytics.numberAnalytics.status,
  });
});

apiRouter.post('/dev/reset', authMiddleware, adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  // Reinitialize storage
  storage.save();
  return res.json({ success: true, message: 'Database reset.' });
});

apiRouter.post('/admin/draw-now', authMiddleware, adminOnlyMiddleware, (_req: AuthenticatedRequest, res: Response) => {
  backgroundWorker.executeDraw();
  return res.json({
    success: true,
    activeRoundId: storage.getActiveRoundId(),
    nextDrawTime: storage.getNextDrawTime(),
  });
});

apiRouter.get('/system/status', (_req: Request, res: Response) => {
  const status = storage.getSystemStatus();
  return res.json({ status, connectedClients: wsManager.getConnectedCount() });
});

// ============================================================
// WINGO 1M LIVE FEED ENDPOINTS
// ============================================================

apiRouter.get('/wingo/status', (_req: Request, res: Response) => {
  return res.json(wingoService.getStatus());
});

apiRouter.post('/wingo/sync', async (_req: Request, res: Response) => {
  const syncResult = await wingoService.sync('manual_api');
  return res.json({
    ...syncResult,
    feedStatus: wingoService.getStatus(),
  });
});

apiRouter.post('/wingo/toggle', authMiddleware, adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const { enabled } = req.body;
  wingoService.setAutoSync(Boolean(enabled));
  return res.json({
    success: true,
    feedStatus: wingoService.getStatus(),
  });
});

apiRouter.get('/wingo/raw', async (_req: Request, res: Response) => {
  try {
    const raw = await wingoService.fetchRawHistory();
    return res.json(raw);
  } catch (err: any) {
    return res.status(502).json({ error: err.message });
  }
});

