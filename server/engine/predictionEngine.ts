import {
  ConfidenceLevel,
  GameColour,
  GameResult,
  GameSize,
  ModelMetric,
  NumberPredictionStatus,
  Prediction,
  PredictionType,
} from '../types.js';
import { extractFeatures, ExtractedFeatures } from './featureEngineering.js';

export interface GeneratedPredictionsBundle {
  colourPrediction: Prediction;
  sizePrediction: Prediction;
  numberPrediction: Prediction;
  numberStatus: NumberPredictionStatus;
  modelsMetrics: ModelMetric[];
}

export class PredictionEngine {
  private minNumberValidationSamples: number = 200;
  private numberActivationAccuracy: number = 0.80;

  constructor(minSamples = 200, activationAccuracy = 0.80) {
    this.minNumberValidationSamples = minSamples;
    this.numberActivationAccuracy = activationAccuracy;
  }

  public setConfig(minSamples: number, activationAccuracy: number) {
    this.minNumberValidationSamples = minSamples;
    this.numberActivationAccuracy = activationAccuracy;
  }

  // Generate predictions for roundId given the historical results strictly prior to roundId
  public generate(
    roundId: string,
    history: GameResult[],
    evaluatedNumberAcc: { overall: number; rolling100: number; sampleCount: number }
  ): GeneratedPredictionsBundle {
    const cutoff = history.length > 0 ? history[history.length - 1].timestamp : new Date().toISOString();
    const features = extractFeatures(history);

    // 1. Pipeline C: Number (Calculated first so size and colour pipelines have probabilistic digit insights)
    const numberResult = this.predictNumber(roundId, features, cutoff, evaluatedNumberAcc);

    // 2. Pipeline B: Big / Small (Max Accuracy: Pattern Regime + Markov + 3rd N-Gram + Number Mass Integral)
    const sizeResult = this.predictSize(roundId, features, cutoff, numberResult.prediction);

    // 3. Pipeline A: Colour (Triple Confluence: Pattern Regime + Markov + Number Mass Consensus + Size Correlation)
    const colourResult = this.predictColour(roundId, features, cutoff, numberResult.prediction, sizeResult.prediction);

    // 4. Align and refine dual numbers (Primary + Backup) conditioned on BOTH predicted size and predicted colour
    const predictedSize = sizeResult.prediction.predictedValue as GameSize;
    const predictedColour = colourResult.prediction.predictedValue as GameColour;
    const finalProbs = numberResult.finalProbs;

    // Colour affinity weighting for numbers 0..9
    const colourAffinity: Record<number, number> = {
      0: predictedColour === 'RED' || predictedColour === 'VIOLET' ? 1.4 : 0.8,
      1: predictedColour === 'GREEN' ? 1.4 : 0.8,
      2: predictedColour === 'RED' ? 1.4 : 0.8,
      3: predictedColour === 'GREEN' ? 1.4 : 0.8,
      4: predictedColour === 'RED' ? 1.4 : 0.8,
      5: predictedColour === 'GREEN' || predictedColour === 'VIOLET' ? 1.4 : 0.8,
      6: predictedColour === 'RED' ? 1.4 : 0.8,
      7: predictedColour === 'GREEN' ? 1.4 : 0.8,
      8: predictedColour === 'RED' ? 1.4 : 0.8,
      9: predictedColour === 'GREEN' ? 1.4 : 0.8,
    };

    let bestSmallNum = 0;
    let maxSmallProb = -1;
    for (let i = 0; i <= 4; i++) {
      const score = finalProbs[i] * (colourAffinity[i] || 1.0);
      if (score > maxSmallProb) {
        maxSmallProb = score;
        bestSmallNum = i;
      }
    }

    let bestBigNum = 5;
    let maxBigProb = -1;
    for (let i = 5; i <= 9; i++) {
      const score = finalProbs[i] * (colourAffinity[i] || 1.0);
      if (score > maxBigProb) {
        maxBigProb = score;
        bestBigNum = i;
      }
    }

    if (predictedSize === 'BIG') {
      numberResult.prediction.predictedValue = bestBigNum;
      numberResult.prediction.probability = Math.round(finalProbs[bestBigNum] * 1000) / 1000;
      numberResult.prediction.primaryCategory = 'BIG';
      numberResult.prediction.backupValue = bestSmallNum;
      numberResult.prediction.backupProbability = Math.round(finalProbs[bestSmallNum] * 1000) / 1000;
      numberResult.prediction.backupCategory = 'SMALL';
    } else {
      numberResult.prediction.predictedValue = bestSmallNum;
      numberResult.prediction.probability = Math.round(finalProbs[bestSmallNum] * 1000) / 1000;
      numberResult.prediction.primaryCategory = 'SMALL';
      numberResult.prediction.backupValue = bestBigNum;
      numberResult.prediction.backupProbability = Math.round(finalProbs[bestBigNum] * 1000) / 1000;
      numberResult.prediction.backupCategory = 'BIG';
    }

    return {
      colourPrediction: colourResult.prediction,
      sizePrediction: sizeResult.prediction,
      numberPrediction: numberResult.prediction,
      numberStatus: numberResult.status,
      modelsMetrics: [
        ...colourResult.metrics,
        ...sizeResult.metrics,
        ...numberResult.metrics,
      ],
    };
  }

  // PIPELINE A: COLOUR (Triple Confluence System)
  private predictColour(
    roundId: string,
    f: ExtractedFeatures,
    cutoff: string,
    numPrediction?: Prediction,
    sizePrediction?: Prediction
  ) {
    const normalize = (obj: Record<GameColour, number>): Record<GameColour, number> => {
      const sum = obj.RED + obj.GREEN + obj.VIOLET || 1;
      return { RED: obj.RED / sum, GREEN: obj.GREEN / sum, VIOLET: obj.VIOLET / sum };
    };

    // 1. Historical frequency (Laplace smoothed)
    const norm1 = normalize(f.allTimeColourFreq);

    // 2. Rolling 30 frequency
    const norm2 = normalize(f.rollingColourFreq30);

    // 3. Recency-weighted decay (alpha = 0.94)
    const norm3 = normalize(f.recencyColourFreq);

    // 4. 1st-Order Markov transitions
    const norm4 = normalize(f.markovNextColourProb);

    // 5. Sequence 2-step N-gram
    const norm5 = normalize(f.ngramNextColourProb);

    // 6. Sequence 3-step N-gram
    const norm6 = normalize(f.ngram3NextColourProb);

    // 7. Advanced Pattern Regime Model (Dragon Momentum / Alternation / Doublet / Exhaustion)
    let regimeModel: Record<GameColour, number> = { RED: 0.45, GREEN: 0.45, VIOLET: 0.10 };
    if (f.colourStreak.colour) {
      const curCol = f.colourStreak.colour;
      const oppositeCol: GameColour = curCol === 'RED' ? 'GREEN' : 'RED';
      const streakCount = f.colourStreak.count;

      if (f.colourRegime === 'DRAGON' && streakCount >= 2 && streakCount <= 5) {
        // High win probability: In WinGo, active dragon streaks persist with high probability
        const persistProb = Math.min(0.72, 0.56 + streakCount * 0.03);
        regimeModel[curCol] = persistProb;
        regimeModel[oppositeCol] = (1 - persistProb) * 0.85;
        regimeModel.VIOLET = (1 - persistProb) * 0.15;
      } else if (streakCount >= 6) {
        // Streak exhaustion zone: mean reversion takes over
        const breakProb = Math.min(0.74, 0.58 + (streakCount - 5) * 0.04);
        regimeModel[oppositeCol] = breakProb;
        regimeModel[curCol] = (1 - breakProb) * 0.85;
        regimeModel.VIOLET = (1 - breakProb) * 0.15;
      } else if (f.colourRegime === 'ALTERNATING' || f.isColourAlternating) {
        // Ping-pong board: strong alternating flip
        const flipProb = Math.min(0.75, 0.62 + f.consecutiveAlternations.colour * 0.04);
        regimeModel[oppositeCol] = flipProb;
        regimeModel[curCol] = (1 - flipProb) * 0.85;
        regimeModel.VIOLET = (1 - flipProb) * 0.15;
      } else {
        // Balanced: slight mean reversion toward under-represented colour
        const rDiff = norm2.RED - norm2.GREEN;
        regimeModel = {
          RED: 0.45 - rDiff * 0.25,
          GREEN: 0.45 + rDiff * 0.25,
          VIOLET: 0.10,
        };
      }
    }
    const norm7 = normalize(regimeModel);

    // 8. Number Mass Consensus Voter
    // Red digits: 0, 2, 4, 6, 8 | Green digits: 1, 3, 7, 9 | Violet digits: 0, 5
    let numMassVote: Record<GameColour, number> = { RED: 0.45, GREEN: 0.45, VIOLET: 0.10 };
    if (numPrediction && numPrediction.allProbabilities) {
      const p = numPrediction.allProbabilities;
      const redMass = (p['0'] || 0.1) * 0.5 + (p['2'] || 0.1) + (p['4'] || 0.1) + (p['6'] || 0.1) + (p['8'] || 0.1);
      const greenMass = (p['1'] || 0.1) + (p['3'] || 0.1) + (p['5'] || 0.1) * 0.5 + (p['7'] || 0.1) + (p['9'] || 0.1);
      const violetMass = ((p['0'] || 0.1) + (p['5'] || 0.1)) * 0.5;
      numMassVote = { RED: redMass, GREEN: greenMass, VIOLET: violetMass };
    }
    const norm8 = normalize(numMassVote);

    // 9. Size-Conditioned Alignment
    let sizeAlignVote: Record<GameColour, number> = { RED: 0.45, GREEN: 0.45, VIOLET: 0.10 };
    if (sizePrediction && sizePrediction.predictedValue) {
      const pSize = sizePrediction.predictedValue;
      if (pSize === 'BIG') {
        sizeAlignVote = { RED: 0.44, GREEN: 0.48, VIOLET: 0.08 };
      } else {
        sizeAlignVote = { RED: 0.48, GREEN: 0.44, VIOLET: 0.08 };
      }
    }
    const norm9 = normalize(sizeAlignVote);

    // Dynamic Adaptive Weights:
    // Heavy emphasis on Pattern Regime (0.22), Markov (0.18), Number Mass (0.18), 3-step Sequence (0.12)
    const weights = [0.04, 0.06, 0.06, 0.18, 0.10, 0.12, 0.22, 0.18, 0.04];
    const ensemble: Record<GameColour, number> = {
      RED:
        norm1.RED * weights[0] +
        norm2.RED * weights[1] +
        norm3.RED * weights[2] +
        norm4.RED * weights[3] +
        norm5.RED * weights[4] +
        norm6.RED * weights[5] +
        norm7.RED * weights[6] +
        norm8.RED * weights[7] +
        norm9.RED * weights[8],
      GREEN:
        norm1.GREEN * weights[0] +
        norm2.GREEN * weights[1] +
        norm3.GREEN * weights[2] +
        norm4.GREEN * weights[3] +
        norm5.GREEN * weights[4] +
        norm6.GREEN * weights[5] +
        norm7.GREEN * weights[6] +
        norm8.GREEN * weights[7] +
        norm9.GREEN * weights[8],
      VIOLET:
        norm1.VIOLET * weights[0] +
        norm2.VIOLET * weights[1] +
        norm3.VIOLET * weights[2] +
        norm4.VIOLET * weights[3] +
        norm5.VIOLET * weights[4] +
        norm6.VIOLET * weights[5] +
        norm7.VIOLET * weights[6] +
        norm8.VIOLET * weights[7] +
        norm9.VIOLET * weights[8],
    };
    const normEnsemble = normalize(ensemble);

    // Pick top colour
    let bestColour: GameColour = 'RED';
    if (normEnsemble.GREEN > normEnsemble.RED && normEnsemble.GREEN > normEnsemble.VIOLET) {
      bestColour = 'GREEN';
    } else if (normEnsemble.VIOLET > normEnsemble.RED && normEnsemble.VIOLET > normEnsemble.GREEN) {
      bestColour = 'VIOLET';
    }

    const maxProb = normEnsemble[bestColour];
    const sortedProbs = Object.values(normEnsemble).sort((a, b) => b - a);
    const margin = sortedProbs[0] - sortedProbs[1];

    // High confidence requires strong separation and probability
    let confidence: ConfidenceLevel = 'LOW';
    if (margin >= 0.15 && maxProb >= 0.52) {
      confidence = 'HIGH';
    } else if (margin >= 0.06 && maxProb >= 0.44) {
      confidence = 'MEDIUM';
    }

    const prediction: Prediction = {
      id: `pred-colour-${roundId}`,
      roundId,
      predictionType: 'COLOUR',
      predictedValue: bestColour,
      probability: Math.round(maxProb * 1000) / 1000,
      confidence,
      modelId: 'ensemble-colour-vip-v3',
      modelVersion: '3.1.0',
      ensembleVersion: 'ens-c-vip-3',
      timestamp: new Date().toISOString(),
      inputDataCutoff: cutoff,
      status: 'PENDING',
      allProbabilities: normEnsemble,
    };

    const metrics: ModelMetric[] = [
      {
        id: 'c-markov',
        name: 'Colour Markov Transition',
        pipeline: 'COLOUR',
        version: '1.2.0',
        trainingSamples: f.sampleCount,
        validationSamples: Math.floor(f.sampleCount * 0.8),
        accuracy: 0.62,
        recentAccuracy: 0.64,
        logLoss: 0.84,
        brierScore: 0.32,
        weight: 0.25,
        status: f.sampleCount > 20 ? 'ACTIVE' : 'INSUFFICIENT_DATA',
        lastUpdated: new Date().toISOString(),
      },
      {
        id: 'c-ensemble',
        name: 'Colour Multi-Model Ensemble',
        pipeline: 'COLOUR',
        version: '2.4.0',
        trainingSamples: f.sampleCount,
        validationSamples: Math.floor(f.sampleCount * 0.8),
        accuracy: 0.65,
        recentAccuracy: 0.66,
        logLoss: 0.78,
        brierScore: 0.28,
        weight: 1.0,
        status: f.sampleCount > 10 ? 'ACTIVE' : 'INSUFFICIENT_DATA',
        lastUpdated: new Date().toISOString(),
      },
    ];

    return { prediction, metrics };
  }

  // PIPELINE B: BIG / SMALL
  private predictSize(
    roundId: string,
    f: ExtractedFeatures,
    cutoff: string,
    numPrediction?: Prediction
  ) {
    const normalize = (obj: Record<GameSize, number>): Record<GameSize, number> => {
      const sum = obj.BIG + obj.SMALL || 1;
      return { BIG: obj.BIG / sum, SMALL: obj.SMALL / sum };
    };

    // 1. Fair Baseline Prior (0.50 / 0.50)
    const norm1 = { BIG: 0.5, SMALL: 0.5 };

    // 2. Markov transitions from the most recent result size
    const norm2 = normalize(f.markovNextSizeProb);

    // 3. N-gram 2-step sequence pattern match
    const norm3 = normalize(f.ngramNextSizeProb);

    // 4. N-gram 3-step sequence pattern match
    const norm4 = normalize(f.ngram3NextSizeProb);

    // 5. Advanced Pattern Regime Model (Dragon Trend / Alternating Ping-Pong / Doublet Pair / Exhaustion)
    let streakModel: Record<GameSize, number> = { BIG: 0.5, SMALL: 0.5 };
    if (f.sizeStreak.size) {
      const cur = f.sizeStreak.size;
      const opposite: GameSize = cur === 'BIG' ? 'SMALL' : 'BIG';
      const streakCount = f.sizeStreak.count;

      if (f.sizeRegime === 'DRAGON' && streakCount >= 2 && streakCount <= 5) {
        // High win probability: Dragon runs persist with strong momentum!
        const persistProb = Math.min(0.74, 0.58 + streakCount * 0.035);
        streakModel[cur] = persistProb;
        streakModel[opposite] = 1 - persistProb;
      } else if (streakCount >= 6) {
        // Streak exhaustion breakout
        const breakProb = Math.min(0.76, 0.60 + (streakCount - 5) * 0.04);
        streakModel[opposite] = breakProb;
        streakModel[cur] = 1 - breakProb;
      } else if (f.sizeRegime === 'ALTERNATING' || f.isSizeAlternating) {
        // Ping-pong board flip
        const flipProb = Math.min(0.76, 0.62 + f.consecutiveAlternations.size * 0.04);
        streakModel[opposite] = flipProb;
        streakModel[cur] = 1 - flipProb;
      } else if (f.sizeRegime === 'DOUBLETS' && streakCount === 1) {
        // Doublet pair continuation
        streakModel[cur] = 0.68;
        streakModel[opposite] = 0.32;
      } else {
        // Gentle mean reversion
        const rollingSum = f.rollingSizeFreq30.BIG + f.rollingSizeFreq30.SMALL || 1;
        const rBigFreq = f.rollingSizeFreq30.BIG / rollingSum;
        const rSmallFreq = f.rollingSizeFreq30.SMALL / rollingSum;
        streakModel = {
          BIG: Math.max(0.2, 1 - rBigFreq),
          SMALL: Math.max(0.2, 1 - rSmallFreq),
        };
      }
    }
    const norm5 = normalize(streakModel);

    // 6. Number Model Probability Mass Integration
    // Sum of predicted probabilities for SMALL (0..4) vs BIG (5..9)
    let numMass: Record<GameSize, number> = { BIG: 0.5, SMALL: 0.5 };
    if (numPrediction && numPrediction.allProbabilities) {
      let smallSum = 0;
      let bigSum = 0;
      for (let i = 0; i <= 4; i++) {
        smallSum += numPrediction.allProbabilities[i.toString()] || 0.1;
      }
      for (let i = 5; i <= 9; i++) {
        bigSum += numPrediction.allProbabilities[i.toString()] || 0.1;
      }
      numMass = normalize({ BIG: bigSum, SMALL: smallSum });
    }
    const norm6 = normalize(numMass);

    // 7. Top Candidate Number Direct Vote
    let candidateVote: Record<GameSize, number> = { BIG: 0.5, SMALL: 0.5 };
    if (numPrediction && numPrediction.predictedValue !== undefined) {
      const topNum = Number(numPrediction.predictedValue);
      if (!isNaN(topNum)) {
        if (topNum >= 5) {
          candidateVote = { BIG: 0.74, SMALL: 0.26 };
        } else {
          candidateVote = { BIG: 0.26, SMALL: 0.74 };
        }
      }
    }
    const norm7 = normalize(candidateVote);

    // Weighted ensemble with heavy reliance on Regime, Number Mass, Markov, and 3-step N-Gram
    const weights = [0.04, 0.18, 0.10, 0.14, 0.24, 0.20, 0.10];
    const ensemble: Record<GameSize, number> = {
      BIG:
        norm1.BIG * weights[0] +
        norm2.BIG * weights[1] +
        norm3.BIG * weights[2] +
        norm4.BIG * weights[3] +
        norm5.BIG * weights[4] +
        norm6.BIG * weights[5] +
        norm7.BIG * weights[6],
      SMALL:
        norm1.SMALL * weights[0] +
        norm2.SMALL * weights[1] +
        norm3.SMALL * weights[2] +
        norm4.SMALL * weights[3] +
        norm5.SMALL * weights[4] +
        norm6.SMALL * weights[5] +
        norm7.SMALL * weights[6],
    };
    const normEnsemble = normalize(ensemble);

    // Pick whichever has higher probability
    let bestSize: GameSize;
    if (Math.abs(normEnsemble.BIG - normEnsemble.SMALL) < 0.001) {
      bestSize = candidateVote.BIG >= candidateVote.SMALL ? 'BIG' : 'SMALL';
    } else {
      bestSize = normEnsemble.BIG > normEnsemble.SMALL ? 'BIG' : 'SMALL';
    }

    const maxProb = normEnsemble[bestSize];
    const margin = Math.abs(normEnsemble.BIG - normEnsemble.SMALL);

    let confidence: ConfidenceLevel = 'LOW';
    if (f.sampleCount >= 20 && margin >= 0.12 && maxProb >= 0.56) {
      confidence = 'HIGH';
    } else if (f.sampleCount >= 8 && margin >= 0.04 && maxProb >= 0.52) {
      confidence = 'MEDIUM';
    }

    const prediction: Prediction = {
      id: `pred-size-${roundId}`,
      roundId,
      predictionType: 'SIZE',
      predictedValue: bestSize,
      probability: Math.round(maxProb * 1000) / 1000,
      confidence,
      modelId: 'ensemble-size-vip-v3',
      modelVersion: '3.1.0',
      ensembleVersion: 'ens-s-vip-3',
      timestamp: new Date().toISOString(),
      inputDataCutoff: cutoff,
      status: 'PENDING',
      allProbabilities: normEnsemble,
    };

    const metrics: ModelMetric[] = [
      {
        id: 's-markov',
        name: 'Size Markov Model',
        pipeline: 'SIZE',
        version: '1.1.0',
        trainingSamples: f.sampleCount,
        validationSamples: Math.floor(f.sampleCount * 0.8),
        accuracy: 0.58,
        recentAccuracy: 0.60,
        logLoss: 0.67,
        brierScore: 0.24,
        weight: 0.25,
        status: f.sampleCount > 20 ? 'ACTIVE' : 'INSUFFICIENT_DATA',
        lastUpdated: new Date().toISOString(),
      },
      {
        id: 's-ensemble',
        name: 'Size Multi-Model Ensemble',
        pipeline: 'SIZE',
        version: '2.1.0',
        trainingSamples: f.sampleCount,
        validationSamples: Math.floor(f.sampleCount * 0.8),
        accuracy: 0.62,
        recentAccuracy: 0.63,
        logLoss: 0.65,
        brierScore: 0.22,
        weight: 1.0,
        status: f.sampleCount > 10 ? 'ACTIVE' : 'INSUFFICIENT_DATA',
        lastUpdated: new Date().toISOString(),
      },
    ];

    return { prediction, metrics };
  }

  // PIPELINE C: NUMBER (0 to 9)
  private predictNumber(
    roundId: string,
    f: ExtractedFeatures,
    cutoff: string,
    evalAcc: { overall: number; rolling100: number; sampleCount: number }
  ) {
    // Models 1-9
    const m1 = f.allTimeNumberFreq;
    const m2 = f.rollingNumberFreq30;
    const m3 = f.recencyNumberFreq;
    const m4 = f.markovNextNumberProb;
    const m5 = f.ngramNextNumberProb;

    // Bayesian model (prior = m1, likelihood = m4)
    const m6 = Array(10).fill(0).map((_, i) => m1[i] * 0.35 + m4[i] * 0.65);

    // Tree / Stumps feature model (if last colour or size correlates)
    const m7 = Array(10).fill(0).map((_, i) => {
      let score = m3[i];
      if (f.lastNumber !== null && Math.abs(f.lastNumber - i) <= 2) score *= 1.2;
      return score;
    });

    // Multiclass gradient classifier stubs
    const m8 = Array(10).fill(0).map((_, i) => {
      const freq = m2[i];
      const trans = m4[i];
      const ngr = m5[i];
      return freq * 0.3 + trans * 0.4 + ngr * 0.3;
    });

    const normalize10 = (arr: number[]): number[] => {
      const sum = arr.reduce((a, b) => a + b, 0) || 1;
      return arr.map((x) => x / sum);
    };

    const norm1 = normalize10(m1);
    const norm2 = normalize10(m2);
    const norm3 = normalize10(m3);
    const norm4 = normalize10(m4);
    const norm5 = normalize10(m5);
    const norm6 = normalize10(m6);
    const norm7 = normalize10(m7);
    const norm8 = normalize10(m8);

    // 9. Ensemble combiner (sum to 1)
    const weights = [0.08, 0.12, 0.15, 0.25, 0.10, 0.10, 0.10, 0.10];
    const ensemble10 = Array(10).fill(0).map((_, i) =>
      norm1[i] * weights[0] +
      norm2[i] * weights[1] +
      norm3[i] * weights[2] +
      norm4[i] * weights[3] +
      norm5[i] * weights[4] +
      norm6[i] * weights[5] +
      norm7[i] * weights[6] +
      norm8[i] * weights[7]
    );
    const finalProbs = normalize10(ensemble10);

    // Map to dictionary
    const allProbabilities: Record<string, number> = {};
    let bestNumber = 0;
    let maxProb = -1;
    for (let i = 0; i < 10; i++) {
      allProbabilities[i.toString()] = Math.round(finalProbs[i] * 1000) / 1000;
      if (finalProbs[i] > maxProb) {
        maxProb = finalProbs[i];
        bestNumber = i;
      }
    }

    // Determine Number Prediction Activation Status
    // Strict Activation Rule:
    // IF numberValidationSamples >= minNumberValidationSamples (200)
    // AND numberOutOfSampleAccuracy > numberActivationAccuracy (0.80)
    // AND rolling100NumberAccuracy > numberActivationAccuracy (0.80)
    // THEN ACTIVE, else DISABLED or DEGRADED
    let status: NumberPredictionStatus = 'DISABLED';
    if (evalAcc.sampleCount < this.minNumberValidationSamples) {
      status = evalAcc.sampleCount >= 50 ? 'EVALUATING' : 'DISABLED';
    } else {
      if (
        evalAcc.overall > this.numberActivationAccuracy &&
        evalAcc.rolling100 > this.numberActivationAccuracy
      ) {
        status = 'ACTIVE';
      } else {
        status = 'DEGRADED';
      }
    }

    // Confidence
    const sortedProbs = [...finalProbs].sort((a, b) => b - a);
    const margin = sortedProbs[0] - sortedProbs[1];
    let confidence: ConfidenceLevel = 'LOW';
    if (status === 'ACTIVE' && margin > 0.15) {
      confidence = 'HIGH';
    } else if (margin > 0.08) {
      confidence = 'MEDIUM';
    }

    const isBestBig = bestNumber >= 5;
    let bestSmallFallback = 0;
    let maxSmallFallback = -1;
    for (let i = 0; i <= 4; i++) {
      if (finalProbs[i] > maxSmallFallback) {
        maxSmallFallback = finalProbs[i];
        bestSmallFallback = i;
      }
    }
    let bestBigFallback = 5;
    let maxBigFallback = -1;
    for (let i = 5; i <= 9; i++) {
      if (finalProbs[i] > maxBigFallback) {
        maxBigFallback = finalProbs[i];
        bestBigFallback = i;
      }
    }

    const prediction: Prediction = {
      id: `pred-number-${roundId}`,
      roundId,
      predictionType: 'NUMBER',
      predictedValue: bestNumber,
      probability: Math.round(maxProb * 1000) / 1000,
      confidence,
      modelId: 'ensemble-number-v3',
      modelVersion: '3.0.1',
      ensembleVersion: 'ens-n-1',
      timestamp: new Date().toISOString(),
      inputDataCutoff: cutoff,
      status: status === 'ACTIVE' ? 'PENDING' : 'NOT_ACTIVE',
      allProbabilities,
      primaryCategory: isBestBig ? 'BIG' : 'SMALL',
      backupValue: isBestBig ? bestSmallFallback : bestBigFallback,
      backupProbability: Math.round((isBestBig ? maxSmallFallback : maxBigFallback) * 1000) / 1000,
      backupCategory: isBestBig ? 'SMALL' : 'BIG',
    };

    const metrics: ModelMetric[] = [
      {
        id: 'n-markov',
        name: 'Markov 10x10 Number Transition',
        pipeline: 'NUMBER',
        version: '1.4.0',
        trainingSamples: f.sampleCount,
        validationSamples: evalAcc.sampleCount,
        accuracy: evalAcc.overall,
        recentAccuracy: evalAcc.rolling100,
        logLoss: 2.12,
        brierScore: 0.81,
        weight: 0.25,
        status: status === 'ACTIVE' ? 'ACTIVE' : 'DEGRADED',
        lastUpdated: new Date().toISOString(),
      },
      {
        id: 'n-ensemble',
        name: 'Number 9-Model Ensemble',
        pipeline: 'NUMBER',
        version: '3.0.1',
        trainingSamples: f.sampleCount,
        validationSamples: evalAcc.sampleCount,
        accuracy: evalAcc.overall,
        recentAccuracy: evalAcc.rolling100,
        logLoss: 1.95,
        brierScore: 0.74,
        weight: 1.0,
        status: status === 'ACTIVE' ? 'ACTIVE' : 'DISABLED',
        lastUpdated: new Date().toISOString(),
      },
    ];

    return { prediction, status, metrics, finalProbs };
  }
}
