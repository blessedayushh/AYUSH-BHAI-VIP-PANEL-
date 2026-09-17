import {
  ConfidenceLevel,
  GameColour,
  GameResult,
  GameSize,
  LiveTradeDirective,
  Prediction,
  StakingStrategy,
  TradeAnalysisData,
  TradeJournalEntry,
  TradePerformanceSummary,
  isColourWin,
} from '../types.js';

export interface TradeAnalysisOptions {
  bankroll?: number;
  strategy?: StakingStrategy;
  baseUnit?: number;
  limit?: number;
  liveLevel?: number;
}

export class TradeAnalysisEngine {
  /**
   * Generates full trade analysis including live trade directive,
   * historical simulated performance, equity curve, and chronological journal.
   */
  public generate(
    results: GameResult[], // chronologically sorted oldest to newest or reverse
    predictions: Prediction[],
    latestBundle: {
      roundId: string;
      colour?: Prediction;
      size?: Prediction;
      number?: Prediction;
      nextDrawTime: string;
    },
    options: TradeAnalysisOptions = {}
  ): TradeAnalysisData {
    const initialBankroll = options.bankroll && options.bankroll > 0 ? options.bankroll : 180;
    const strategy: StakingStrategy = options.strategy || 'LEVELS_4';
    const baseUnit = options.baseUnit && options.baseUnit > 0 ? options.baseUnit : 10;
    const limit = options.limit || 50;

    // Ensure results are sorted chronologically: oldest to newest
    const chronologicalResults = [...results].sort(
      (a, b) => new Date(a.timestamp || a.createdAt).getTime() - new Date(b.timestamp || b.createdAt).getTime()
    );

    // Group predictions by roundId
    const predsByRound = new Map<string, { colour?: Prediction; size?: Prediction; number?: Prediction }>();
    for (const p of predictions) {
      if (!predsByRound.has(p.roundId)) {
        predsByRound.set(p.roundId, {});
      }
      const roundObj = predsByRound.get(p.roundId)!;
      if (p.predictionType === 'COLOUR') roundObj.colour = p;
      if (p.predictionType === 'SIZE') roundObj.size = p;
      if (p.predictionType === 'NUMBER') roundObj.number = p;
    }

    // 1. BACKTEST & SIMULATION CHRONOLOGICALLY
    const journal: TradeJournalEntry[] = [];
    let currentEquity = initialBankroll;
    let peakEquity = initialBankroll;
    let maxDrawdownAmount = 0;
    let maxDrawdownPct = 0;

    let currentMartingaleStage = 1;
    let currentLevel4Stage = 1; // 4-Level Plan: Level 1 (₹10) -> Level 2 (₹20) -> Level 3 (₹50) -> Level 4 (₹100)
    let fibIndex = 0;
    const fibSequence = [1, 1, 2, 3, 5, 8, 13];

    let winningTrades = 0;
    let losingTrades = 0;
    let grossProfit = 0;
    let grossLoss = 0;

    let currentStreakType: 'WIN' | 'LOSS' = 'WIN';
    let currentStreakCount = 0;
    let maxWinStreak = 0;
    let maxLossStreak = 0;

    let sizeWins = 0, sizeTotal = 0, sizeNet = 0;
    let colourWins = 0, colourTotal = 0, colourNet = 0;
    let numWins = 0, numTotal = 0, numNet = 0;

    const equityCurve: TradePerformanceSummary['equityCurve'] = [
      {
        roundIndex: 0,
        roundId: 'START',
        equity: initialBankroll,
        profit: 0,
        drawdown: 0,
        isWin: true,
      },
    ];

    let tradeIndex = 0;
    let lastTradeHit = true;

    for (const res of chronologicalResults) {
      const preds = predsByRound.get(res.roundId);
      if (!preds) continue;

      // Primary market selection: prefer size prediction if available (or highest confidence)
      const sPred = preds.size;
      const cPred = preds.colour;
      const nPred = preds.number;

      if (!sPred && !cPred) continue;

      // Determine trade selection & probability
      let market: 'SIZE' | 'COLOUR' = 'SIZE';
      let selection = sPred?.predictedValue as string;
      let prob = sPred?.probability || 0.5;
      let conf: ConfidenceLevel = sPred?.confidence || 'MEDIUM';
      let isWin = false;
      let actualOutcome = res.size as string;

      if (sPred && cPred) {
        if ((cPred.probability || 0) > (sPred.probability || 0) + 0.08) {
          market = 'COLOUR';
          selection = cPred.predictedValue as string;
          prob = cPred.probability || 0.5;
          conf = cPred.confidence || 'MEDIUM';
          actualOutcome = res.colour as string;
          isWin = isColourWin(cPred.predictedValue, res.colour, res.number);
        } else {
          market = 'SIZE';
          selection = sPred.predictedValue as string;
          prob = sPred.probability || 0.5;
          conf = sPred.confidence || 'MEDIUM';
          actualOutcome = res.size as string;
          isWin = sPred.predictedValue === res.size;
        }
      } else if (sPred) {
        market = 'SIZE';
        selection = sPred.predictedValue as string;
        prob = sPred.probability || 0.5;
        conf = sPred.confidence || 'MEDIUM';
        actualOutcome = res.size as string;
        isWin = sPred.predictedValue === res.size;
      } else if (cPred) {
        market = 'COLOUR';
        selection = cPred.predictedValue as string;
        prob = cPred.probability || 0.5;
        conf = cPred.confidence || 'MEDIUM';
        actualOutcome = res.colour as string;
        isWin = isColourWin(cPred.predictedValue, res.colour, res.number);
      }

      // Staking Calculation
      let stakedUnits = 1;
      let stagedLevel = 1;

      if (strategy === 'LEVELS_4') {
        stagedLevel = currentLevel4Stage;
        if (currentLevel4Stage === 1) stakedUnits = 1;       // Level 1: ₹10 (at baseUnit 10)
        else if (currentLevel4Stage === 2) stakedUnits = 2;  // Level 2: ₹20
        else if (currentLevel4Stage === 3) stakedUnits = 5;  // Level 3: ₹50
        else stakedUnits = 10;                              // Level 4: ₹100
      } else if (strategy === 'FLAT') {
        stakedUnits = 1;
        stagedLevel = 1;
      } else if (strategy === 'MARTINGALE') {
        stagedLevel = currentMartingaleStage;
        if (currentMartingaleStage === 1) stakedUnits = 1;
        else if (currentMartingaleStage === 2) stakedUnits = 2.5;
        else stakedUnits = 6.5; // 3-Stage capped martingale
      } else if (strategy === 'KELLY') {
        // Quarter Kelly: (b*p - q)/b * 0.25, b = 0.96
        const b = 0.96;
        const q = 1 - prob;
        const kellyFull = Math.max(0, (b * prob - q) / b);
        const quarterKelly = Math.min(0.08, Math.max(0.01, kellyFull * 0.25));
        stakedUnits = Math.max(0.5, Math.round((currentEquity * quarterKelly) / baseUnit * 10) / 10);
        stagedLevel = 1;
      } else if (strategy === 'FIBONACCI') {
        stakedUnits = fibSequence[Math.min(fibIndex, fibSequence.length - 1)];
        stagedLevel = fibIndex + 1;
      }

      const stakedAmount = Math.round(stakedUnits * baseUnit * 100) / 100;
      const payoutOdds = 1.96; // 2% fee deducted
      let netProfit = 0;

      if (isWin) {
        netProfit = Math.round(stakedAmount * 0.96 * 100) / 100;
        winningTrades++;
        grossProfit += netProfit;

        if (currentStreakType === 'WIN') {
          currentStreakCount++;
        } else {
          currentStreakType = 'WIN';
          currentStreakCount = 1;
        }
        if (currentStreakCount > maxWinStreak) maxWinStreak = currentStreakCount;

        // Reset or advance progressive systems on win
        currentMartingaleStage = 1;
        // 4-Level Positive Progression: advance to next level after winning
        if (currentLevel4Stage < 4) {
          currentLevel4Stage++;
        } else {
          currentLevel4Stage = 1; // Completed 4-level winning sequence, reset to Level 1
        }
        fibIndex = Math.max(0, fibIndex - 2);
        lastTradeHit = true;
      } else {
        netProfit = -stakedAmount;
        losingTrades++;
        grossLoss += Math.abs(netProfit);

        if (currentStreakType === 'LOSS') {
          currentStreakCount++;
        } else {
          currentStreakType = 'LOSS';
          currentStreakCount = 1;
        }
        if (currentStreakCount > maxLossStreak) maxLossStreak = currentStreakCount;

        // Advance progressive systems on loss (with safety stop-loss cap)
        if (currentMartingaleStage < 3) {
          currentMartingaleStage++;
        } else {
          // Stop-loss trigger: reset to prevent bust
          currentMartingaleStage = 1;
        }

        // 4-Level Plan: if loss happens then the bankroll will start from level 1
        currentLevel4Stage = 1;

        fibIndex = Math.min(fibSequence.length - 1, fibIndex + 1);
        lastTradeHit = false;
      }

      // Breakdown by market
      if (market === 'SIZE') {
        sizeTotal++;
        if (isWin) sizeWins++;
        sizeNet += netProfit;
      } else {
        colourTotal++;
        if (isWin) colourWins++;
        colourNet += netProfit;
      }

      // Also evaluate dual number hedge stats if available
      if (nPred) {
        numTotal++;
        const targetNum = Number(res.number);
        const hitPrimary = Number(nPred.predictedValue) === targetNum;
        const hitBackup = nPred.backupValue !== undefined && Number(nPred.backupValue) === targetNum;
        if (hitPrimary || hitBackup) {
          numWins++;
          // 0.5 unit each hedge -> win returns 0.5 * 9.0 = 4.5 units -> +3.5 net units
          numNet += baseUnit * 3.5;
        } else {
          numNet -= baseUnit * 1.0;
        }
      }

      currentEquity = Math.round((currentEquity + netProfit) * 100) / 100;
      if (currentEquity > peakEquity) peakEquity = currentEquity;

      const currentDd = Math.max(0, peakEquity - currentEquity);
      const currentDdPct = peakEquity > 0 ? (currentDd / peakEquity) * 100 : 0;
      if (currentDd > maxDrawdownAmount) maxDrawdownAmount = currentDd;
      if (currentDdPct > maxDrawdownPct) maxDrawdownPct = currentDdPct;

      tradeIndex++;

      journal.push({
        roundId: res.roundId,
        timestamp: res.timestamp || res.createdAt,
        market,
        selection,
        actualOutcome,
        stakedUnits,
        stakedAmount,
        payoutOdds,
        isWin,
        netProfit,
        runningEquity: currentEquity,
        martingaleStage: stagedLevel,
        confidence: conf,
        probability: Math.round(prob * 1000) / 1000,
      });

      equityCurve.push({
        roundIndex: tradeIndex,
        roundId: res.roundId,
        equity: currentEquity,
        profit: Math.round((currentEquity - initialBankroll) * 100) / 100,
        drawdown: Math.round(currentDdPct * 10) / 10,
        isWin,
      });
    }

    const totalTrades = winningTrades + losingTrades;
    const winRatePct = totalTrades > 0 ? Math.round((winningTrades / totalTrades) * 1000) / 10 : 0;
    const profitFactor = grossLoss > 0 ? Math.round((grossProfit / grossLoss) * 100) / 100 : grossProfit > 0 ? 99.9 : 0;
    const totalNetProfit = Math.round((currentEquity - initialBankroll) * 100) / 100;
    const returnOnInvestmentPct = Math.round((totalNetProfit / initialBankroll) * 1000) / 10;
    const expectedValuePerTrade = totalTrades > 0 ? Math.round((totalNetProfit / totalTrades) * 100) / 100 : 0;

    // 2. REGIME & PATTERN DETECTION (analyzing last 12 results)
    const recentResults = results.slice(0, 12);
    let patternType: LiveTradeDirective['regime']['patternType'] = 'STABLE_TREND';
    let consecutiveCount = 1;
    let streakVal = recentResults[0]?.size as string;
    let advice = 'Standard statistical edge. Allocate default base unit.';
    let volatilityLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';

    if (recentResults.length >= 3) {
      // Check for streak dragon
      let streak = 1;
      for (let i = 1; i < recentResults.length; i++) {
        if (recentResults[i].size === recentResults[0].size) {
          streak++;
        } else {
          break;
        }
      }

      if (streak >= 4) {
        patternType = 'STREAK_DRAGON';
        consecutiveCount = streak;
        streakVal = recentResults[0].size;
        volatilityLevel = 'HIGH';
        advice = `Dragon trend: ${streak} consecutive ${streakVal} detected. Ride trend with caution; avoid counter-trend fading.`;
      } else {
        // Check alternating zigzag (e.g., BIG, SMALL, BIG, SMALL)
        let isAlternating = true;
        for (let i = 0; i < Math.min(6, recentResults.length - 1); i++) {
          if (recentResults[i].size === recentResults[i + 1].size) {
            isAlternating = false;
            break;
          }
        }
        if (isAlternating && recentResults.length >= 4) {
          patternType = 'ALTERNATING_ZIGZAG';
          consecutiveCount = 4;
          volatilityLevel = 'MEDIUM';
          advice = 'Alternating zigzag pattern detected. Model favors continuation of swing cycle.';
        } else {
          // Check chop
          patternType = 'STABLE_TREND';
          volatilityLevel = 'LOW';
          advice = 'Market regime is balanced. Follow model ensemble signal.';
        }
      }
    }

    // 3. LIVE DIRECTIVE FOR UPCOMING ROUND
    const nextRoundId = latestBundle.roundId;
    const nextDrawTime = latestBundle.nextDrawTime;

    const activeSizePred = latestBundle.size;
    const activeColPred = latestBundle.colour;
    const activeNumPred = latestBundle.number;

    let primaryMarket: 'SIZE' | 'COLOUR' = 'SIZE';
    let primaryTarget = (activeSizePred?.predictedValue as string) || 'BIG';
    let primaryProb = activeSizePred?.probability || 0.65;
    let primaryConf: ConfidenceLevel = activeSizePred?.confidence || 'MEDIUM';

    if (activeColPred && (activeColPred.probability || 0) > primaryProb + 0.08) {
      primaryMarket = 'COLOUR';
      primaryTarget = activeColPred.predictedValue as string;
      primaryProb = activeColPred.probability || 0.65;
      primaryConf = activeColPred.confidence || 'MEDIUM';
    }

    // Expected Value calculation: EV = (prob * 0.96) - ((1 - prob) * 1.0)
    const primaryEV = Math.round((primaryProb * 0.96 - (1 - primaryProb) * 1.0) * 1000) / 1000;

    let signalQuality: 'A+' | 'A' | 'B' | 'NEUTRAL' = 'B';
    if (primaryProb >= 0.70 && primaryConf === 'HIGH') {
      signalQuality = 'A+';
    } else if (primaryProb >= 0.62) {
      signalQuality = 'A';
    } else if (primaryProb >= 0.54) {
      signalQuality = 'B';
    } else {
      signalQuality = 'NEUTRAL';
    }

    // Recommended stake for live round
    let liveStakeUnits = 1;
    let liveStakePct = 1.0;
    const liveStage = options.liveLevel && options.liveLevel >= 1 && options.liveLevel <= 4 ? options.liveLevel : currentLevel4Stage;

    if (strategy === 'LEVELS_4') {
      if (liveStage === 1) liveStakeUnits = 1;
      else if (liveStage === 2) liveStakeUnits = 2;
      else if (liveStage === 3) liveStakeUnits = 5;
      else liveStakeUnits = 10;
      liveStakePct = Math.round(((liveStakeUnits * baseUnit) / currentEquity) * 1000) / 10;
    } else if (strategy === 'MARTINGALE') {
      if (currentMartingaleStage === 1) liveStakeUnits = 1;
      else if (currentMartingaleStage === 2) liveStakeUnits = 2.5;
      else liveStakeUnits = 6.5;
      liveStakePct = Math.round(((liveStakeUnits * baseUnit) / currentEquity) * 1000) / 10;
    } else if (strategy === 'KELLY') {
      const b = 0.96;
      const q = 1 - primaryProb;
      const kellyFull = Math.max(0, (b * primaryProb - q) / b);
      liveStakePct = Math.round(Math.min(0.08, Math.max(0.015, kellyFull * 0.25)) * 1000) / 10;
      liveStakeUnits = Math.round((liveStakePct / 100) * (currentEquity / baseUnit) * 10) / 10;
    } else if (strategy === 'FIBONACCI') {
      liveStakeUnits = fibSequence[Math.min(fibIndex, fibSequence.length - 1)];
      liveStakePct = Math.round(((liveStakeUnits * baseUnit) / currentEquity) * 1000) / 10;
    } else {
      liveStakeUnits = 1;
      liveStakePct = Math.round((baseUnit / currentEquity) * 1000) / 10;
    }

    // Number Hedge recommendation
    const numPrimary = activeNumPred?.predictedValue !== undefined ? Number(activeNumPred.predictedValue) : 7;
    const numBackup = activeNumPred?.backupValue !== undefined ? Number(activeNumPred.backupValue) : 2;
    const numP1 = activeNumPred?.probability || 0.22;
    const numP2 = activeNumPred?.backupProbability || 0.16;
    const combinedNumProb = Math.round((numP1 + numP2) * 1000) / 1000;
    // Expected value on dual 0.5 unit stake hedge: P(hit)*(4.5 - 1.0) - P(miss)*(1.0)
    const hedgeEV = Math.round((combinedNumProb * 3.5 - (1 - combinedNumProb) * 1.0) * 1000) / 1000;

    const liveDirective: LiveTradeDirective = {
      roundId: nextRoundId,
      nextDrawTime,
      primaryAction: {
        market: primaryMarket,
        target: primaryTarget,
        probability: primaryProb,
        odds: 1.96,
        expectedValue: primaryEV,
        signalQuality,
        confidence: primaryConf,
        recommendedStakeUnits: liveStakeUnits,
        recommendedStakePct: liveStakePct,
      },
      hedgeAction: {
        market: 'NUMBER',
        primaryNumber: numPrimary,
        backupNumber: numBackup,
        combinedProbability: combinedNumProb,
        payoutOdds: 9.0,
        expectedValue: hedgeEV,
        recommendedStakeUnits: 0.5,
        strategyNote: `Dual-hedge: Number ${numPrimary} (${activeNumPred?.primaryCategory || 'PRIMARY'}) + Number ${numBackup} (${activeNumPred?.backupCategory || 'BACKUP'}) covers 9x upside.`,
      },
      regime: {
        patternType,
        consecutiveCount,
        streakValue: streakVal,
        volatilityLevel,
        advice,
      },
      martingaleState: {
        currentStage: strategy === 'LEVELS_4' ? liveStage : currentMartingaleStage,
        maxSafeStages: strategy === 'LEVELS_4' ? 4 : 3,
        stageMultiplier: strategy === 'LEVELS_4'
          ? (liveStage === 1 ? 1 : liveStage === 2 ? 2 : liveStage === 3 ? 5 : 10)
          : (currentMartingaleStage === 1 ? 1 : currentMartingaleStage === 2 ? 2.5 : 6.5),
        recommendedUnits: liveStakeUnits,
        lastResultHit: lastTradeHit,
      },
    };

    const performance: TradePerformanceSummary = {
      bankroll: currentEquity,
      initialBankroll,
      currentEquity,
      totalNetProfit,
      returnOnInvestmentPct,
      totalTrades,
      winningTrades,
      losingTrades,
      winRatePct,
      profitFactor,
      expectedValuePerTrade,
      currentStreak: { type: currentStreakType, count: currentStreakCount },
      maxWinStreak,
      maxLossStreak,
      maxDrawdownAmount: Math.round(maxDrawdownAmount * 100) / 100,
      maxDrawdownPct: Math.round(maxDrawdownPct * 10) / 10,
      breakdown: {
        sizeTrades: {
          total: sizeTotal,
          wins: sizeWins,
          winRate: sizeTotal > 0 ? Math.round((sizeWins / sizeTotal) * 1000) / 10 : 0,
          netProfit: Math.round(sizeNet * 100) / 100,
        },
        colourTrades: {
          total: colourTotal,
          wins: colourWins,
          winRate: colourTotal > 0 ? Math.round((colourWins / colourTotal) * 1000) / 10 : 0,
          netProfit: Math.round(colourNet * 100) / 100,
        },
        numberHedgeTrades: {
          total: numTotal,
          wins: numWins,
          winRate: numTotal > 0 ? Math.round((numWins / numTotal) * 1000) / 10 : 0,
          netProfit: Math.round(numNet * 100) / 100,
        },
      },
      equityCurve: equityCurve.slice(-limit),
    };

    return {
      liveDirective,
      performance,
      recentTrades: journal.slice(-limit).reverse(), // Newest first for display
      availableStrategies: [
        {
          id: 'LEVELS_4',
          name: '4-Level ₹180 Plan',
          description: 'Level 1 (₹10) -> Level 2 (₹20) -> Level 3 (₹50) -> Level 4 (₹100). Total: ₹180. Advances to next level after winning (L1 -> L2 -> L3 -> L4). If a loss happens at any level, the bankroll starts back from Level 1.',
          riskLevel: 'CONTROLLED',
        },
        {
          id: 'FLAT',
          name: 'Flat Staking (1 Unit)',
          description: 'Fixed 1 unit allocation on every round. Minimal volatility and zero drawdown risk.',
          riskLevel: 'LOW',
        },
        {
          id: 'MARTINGALE',
          name: '3-Stage Controlled Martingale',
          description: '1x -> 2.5x -> 6.5x staking with automatic stop-loss reset at Stage 3 to protect bankroll.',
          riskLevel: 'MEDIUM',
        },
        {
          id: 'KELLY',
          name: 'Quarter Kelly Criterion',
          description: 'Dynamically sizes trades based on quantitative statistical edge and win probability.',
          riskLevel: 'BALANCED',
        },
        {
          id: 'FIBONACCI',
          name: 'Fibonacci Recovery Sequence',
          description: 'Advances 1-1-2-3-5 on consecutive losses, retracts 2 steps on wins for smooth recovery.',
          riskLevel: 'CONTROLLED',
        },
      ],
    };
  }
}

export const tradeAnalysisEngine = new TradeAnalysisEngine();
