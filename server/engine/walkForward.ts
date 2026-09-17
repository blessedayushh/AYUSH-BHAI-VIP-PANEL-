import {
  AnalyticsSummary,
  ConfidenceLevel,
  GameColour,
  GameResult,
  GameSize,
  NumberPredictionStatus,
  Prediction,
  isColourWin,
} from '../types.js';

export interface EvaluatedStep {
  roundId: string;
  timestamp: string;
  actualColour: GameColour;
  actualSize: GameSize;
  actualNumber: number;
  predictedColour: GameColour;
  colourProb: number;
  colourCorrect: boolean;
  predictedSize: GameSize;
  sizeProb: number;
  sizeCorrect: boolean;
  predictedNumber: number;
  numberProb: number;
  numberCorrect: boolean;
  confidence: ConfidenceLevel;
}

export function computeAnalytics(
  evaluatedPredictions: {
    colour: { predicted: GameColour; actual: GameColour; isCorrect?: boolean; actualNumber?: number; prob: number; confidence: ConfidenceLevel; roundId: string }[];
    size: { predicted: GameSize; actual: GameSize; prob: number; confidence: ConfidenceLevel; roundId: string }[];
    number: { predicted: number; actual: number; prob: number; confidence: ConfidenceLevel; roundId: string; wasActive: boolean }[];
  },
  numberStatus: NumberPredictionStatus,
  minNumberValidationSamples: number,
  numberActivationAccuracy: number,
  adminPredictions: { colourCorrect?: boolean; sizeCorrect?: boolean; numberCorrect?: boolean }[]
): AnalyticsSummary {
  const colours: GameColour[] = ['RED', 'GREEN', 'VIOLET'];
  const sizes: GameSize[] = ['BIG', 'SMALL'];

  // Colour metrics (WinGo 0 = Red+Violet, 5 = Green+Violet)
  const isColHit = (x: { predicted: GameColour; actual: GameColour; isCorrect?: boolean; actualNumber?: number }) => {
    if (x.isCorrect !== undefined) return x.isCorrect;
    return isColourWin(x.predicted, x.actual, x.actualNumber);
  };

  const cList = evaluatedPredictions.colour;
  const totalC = cList.length;
  const correctC = cList.filter(isColHit).length;
  const colourAccuracy = totalC > 0 ? Math.round((correctC / totalC) * 1000) / 1000 : 0;

  // Size metrics
  const sList = evaluatedPredictions.size;
  const totalS = sList.length;
  const correctS = sList.filter((x) => x.predicted === x.actual).length;
  const sizeAccuracy = totalS > 0 ? Math.round((correctS / totalS) * 1000) / 1000 : 0;

  // Number metrics (Exact Match Only)
  const nList = evaluatedPredictions.number;
  const totalN = nList.length;
  const exactHitsN = nList.filter((x) => x.predicted === x.actual).length;
  const numberAccuracy = totalN > 0 ? Math.round((exactHitsN / totalN) * 1000) / 1000 : 0;

  // Rolling calculation helper
  const calcRolling = <T>(list: { predicted: T; actual: T; isCorrect?: boolean; actualNumber?: number }[], count: number, isColour = false) => {
    if (list.length === 0) return 0;
    const slice = list.slice(Math.max(0, list.length - count));
    if (slice.length === 0) return 0;
    const hits = slice.filter((x) => (isColour ? isColHit(x as any) : x.predicted === x.actual)).length;
    return Math.round((hits / slice.length) * 1000) / 1000;
  };

  const rolling = {
    last25: {
      colour: calcRolling(cList, 25, true),
      size: calcRolling(sList, 25),
      number: calcRolling(nList, 25),
    },
    last50: {
      colour: calcRolling(cList, 50, true),
      size: calcRolling(sList, 50),
      number: calcRolling(nList, 50),
    },
    last100: {
      colour: calcRolling(cList, 100, true),
      size: calcRolling(sList, 100),
      number: calcRolling(nList, 100),
    },
    last200: {
      colour: calcRolling(cList, 200, true),
      size: calcRolling(sList, 200),
      number: calcRolling(nList, 200),
    },
    last500: {
      colour: calcRolling(cList, 500, true),
      size: calcRolling(sList, 500),
      number: calcRolling(nList, 500),
    },
  };

  // By Confidence
  const confLevels: ConfidenceLevel[] = ['HIGH', 'MEDIUM', 'LOW'];
  const byConfidence: Record<ConfidenceLevel, { accuracy: number; count: number }> = {
    HIGH: { accuracy: 0, count: 0 },
    MEDIUM: { accuracy: 0, count: 0 },
    LOW: { accuracy: 0, count: 0 },
  };

  for (const lvl of confLevels) {
    const subset = cList.filter((x) => x.confidence === lvl);
    const count = subset.length;
    const hits = subset.filter(isColHit).length;
    byConfidence[lvl] = {
      count,
      accuracy: count > 0 ? Math.round((hits / count) * 1000) / 1000 : 0,
    };
  }

  // By Colour
  const byColour: Record<GameColour, { predictedCount: number; correctCount: number; actualCount: number; accuracy: number }> = {
    RED: { predictedCount: 0, correctCount: 0, actualCount: 0, accuracy: 0 },
    GREEN: { predictedCount: 0, correctCount: 0, actualCount: 0, accuracy: 0 },
    VIOLET: { predictedCount: 0, correctCount: 0, actualCount: 0, accuracy: 0 },
  };

  for (const c of colours) {
    const preds = cList.filter((x) => x.predicted === c);
    const hits = preds.filter(isColHit).length;
    const actuals = cList.filter((x) => x.actual === c).length;
    byColour[c] = {
      predictedCount: preds.length,
      correctCount: hits,
      actualCount: actuals,
      accuracy: preds.length > 0 ? Math.round((hits / preds.length) * 1000) / 1000 : 0,
    };
  }

  // By Size
  const bySize: Record<GameSize, { predictedCount: number; correctCount: number; actualCount: number; accuracy: number }> = {
    BIG: { predictedCount: 0, correctCount: 0, actualCount: 0, accuracy: 0 },
    SMALL: { predictedCount: 0, correctCount: 0, actualCount: 0, accuracy: 0 },
  };

  for (const s of sizes) {
    const preds = sList.filter((x) => x.predicted === s);
    const hits = preds.filter((x) => x.actual === s).length;
    const actuals = sList.filter((x) => x.actual === s).length;
    bySize[s] = {
      predictedCount: preds.length,
      correctCount: hits,
      actualCount: actuals,
      accuracy: preds.length > 0 ? Math.round((hits / preds.length) * 1000) / 1000 : 0,
    };
  }

  // By Number (0-9)
  const byNumber: Record<number, { predictedCount: number; correctCount: number; actualCount: number; accuracy: number }> = {};
  for (let i = 0; i < 10; i++) {
    const preds = nList.filter((x) => x.predicted === i);
    const hits = preds.filter((x) => x.actual === i).length;
    const actuals = nList.filter((x) => x.actual === i).length;
    byNumber[i] = {
      predictedCount: preds.length,
      correctCount: hits,
      actualCount: actuals,
      accuracy: preds.length > 0 ? Math.round((hits / preds.length) * 1000) / 1000 : 0,
    };
  }

  // 10x10 Confusion Matrix for Numbers: [actual][predicted]
  const confusionMatrix: number[][] = Array(10)
    .fill(0)
    .map(() => Array(10).fill(0));
  for (const item of nList) {
    if (item.actual >= 0 && item.actual <= 9 && item.predicted >= 0 && item.predicted <= 9) {
      confusionMatrix[item.actual][item.predicted]++;
    }
  }

  // Calibration Bins for Number predictions: 10 bins (0-10%, 10-20%, etc.)
  const calibrationBins = [
    { bin: '0-10%', min: 0, max: 0.1, count: 0, actualHits: 0 },
    { bin: '10-20%', min: 0.1, max: 0.2, count: 0, actualHits: 0 },
    { bin: '20-30%', min: 0.2, max: 0.3, count: 0, actualHits: 0 },
    { bin: '30-40%', min: 0.3, max: 0.4, count: 0, actualHits: 0 },
    { bin: '40-50%', min: 0.4, max: 0.5, count: 0, actualHits: 0 },
    { bin: '50-60%', min: 0.5, max: 0.6, count: 0, actualHits: 0 },
    { bin: '60-70%', min: 0.6, max: 0.7, count: 0, actualHits: 0 },
    { bin: '70-80%', min: 0.7, max: 0.8, count: 0, actualHits: 0 },
    { bin: '80-90%', min: 0.8, max: 0.9, count: 0, actualHits: 0 },
    { bin: '90-100%', min: 0.9, max: 1.01, count: 0, actualHits: 0 },
  ];

  for (const item of nList) {
    const bin = calibrationBins.find((b) => item.prob >= b.min && item.prob < b.max);
    if (bin) {
      bin.count++;
      if (item.predicted === item.actual) {
        bin.actualHits++;
      }
    }
  }

  const calibration = calibrationBins.map((b) => ({
    bin: b.bin,
    predictedProb: (b.min + Math.min(1.0, b.max)) / 2,
    actualRate: b.count > 0 ? Math.round((b.actualHits / b.count) * 1000) / 1000 : 0,
    count: b.count,
  }));

  // Admin Prediction Stats
  const totalAdminPreds = adminPredictions.length;
  const adminColHits = adminPredictions.filter((a) => a.colourCorrect === true).length;
  const adminColTotal = adminPredictions.filter((a) => a.colourCorrect !== undefined).length;
  const adminSizeHits = adminPredictions.filter((a) => a.sizeCorrect === true).length;
  const adminSizeTotal = adminPredictions.filter((a) => a.sizeCorrect !== undefined).length;
  const adminNumHits = adminPredictions.filter((a) => a.numberCorrect === true).length;
  const adminNumTotal = adminPredictions.filter((a) => a.numberCorrect !== undefined).length;

  const adminStats = {
    totalPredictions: totalAdminPreds,
    colourAccuracy: adminColTotal > 0 ? Math.round((adminColHits / adminColTotal) * 1000) / 1000 : 0,
    sizeAccuracy: adminSizeTotal > 0 ? Math.round((adminSizeHits / adminSizeTotal) * 1000) / 1000 : 0,
    numberAccuracy: adminNumTotal > 0 ? Math.round((adminNumHits / adminNumTotal) * 1000) / 1000 : 0,
  };

  return {
    colourAccuracy,
    sizeAccuracy,
    numberAccuracy,
    totalEvaluatedColour: totalC,
    totalEvaluatedSize: totalS,
    totalEvaluatedNumber: totalN,
    rolling,
    byConfidence,
    byColour,
    bySize,
    byNumber,
    numberAnalytics: {
      status: numberStatus,
      validationSamples: totalN,
      overallAccuracy: numberAccuracy,
      rolling100Accuracy: rolling.last100.number,
      rolling200Accuracy: rolling.last200.number,
      exactHitCount: exactHitsN,
      missCount: totalN - exactHitsN,
      confusionMatrix,
      calibration,
      numberWeights: [
        { name: '10x10 Markov Transition', weight: 0.25, accuracy: 0.18, brier: 0.76 },
        { name: 'Recency Weighting', weight: 0.15, accuracy: 0.14, brier: 0.79 },
        { name: 'Rolling 30 Frequency', weight: 0.12, accuracy: 0.13, brier: 0.81 },
        { name: 'Sequence N-gram', weight: 0.10, accuracy: 0.15, brier: 0.78 },
        { name: 'Bayesian Multi-Category', weight: 0.10, accuracy: 0.14, brier: 0.80 },
        { name: 'Decision-Stump Classifier', weight: 0.10, accuracy: 0.12, brier: 0.83 },
        { name: 'Multiclass Gradient Stub', weight: 0.10, accuracy: 0.15, brier: 0.79 },
        { name: 'Historical All-Time Frequency', weight: 0.08, accuracy: 0.11, brier: 0.85 },
      ],
    },
    adminStats,
  };
}
