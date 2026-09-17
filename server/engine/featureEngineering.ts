import { GameColour, GameResult, GameSize } from '../types.js';

export interface ExtractedFeatures {
  sampleCount: number;
  recentResults: GameResult[];
  
  // Frequencies (All time)
  allTimeNumberFreq: number[]; // 0..9 normalized
  allTimeColourFreq: Record<GameColour, number>;
  allTimeSizeFreq: Record<GameSize, number>;

  // Rolling frequencies (e.g. last 30)
  rollingNumberFreq30: number[];
  rollingColourFreq30: Record<GameColour, number>;
  rollingSizeFreq30: Record<GameSize, number>;

  // Recency-weighted (half-life decay)
  recencyNumberFreq: number[];
  recencyColourFreq: Record<GameColour, number>;
  recencySizeFreq: Record<GameSize, number>;

  // Transitions (from last state)
  lastNumber: number | null;
  lastCursorColour: GameColour | null;
  lastSize: GameSize | null;

  markovNextNumberProb: number[]; // transition vector from lastNumber
  markovNextColourProb: Record<GameColour, number>;
  markovNextSizeProb: Record<GameSize, number>;

  // Sequence / N-gram pattern matching (matches of last 2 or 3 states)
  ngramNextNumberProb: number[];
  ngramNextColourProb: Record<GameColour, number>;
  ngramNextSizeProb: Record<GameSize, number>;

  // Current streaks
  colourStreak: { colour: GameColour | null; count: number };
  sizeStreak: { size: GameSize | null; count: number };
  numberStreak: { number: number | null; count: number };

  // Advanced Pattern Regimes
  sizeRegime: 'DRAGON' | 'ALTERNATING' | 'DOUBLETS' | 'BALANCED';
  colourRegime: 'DRAGON' | 'ALTERNATING' | 'BALANCED';
  isSizeAlternating: boolean;
  isColourAlternating: boolean;
  consecutiveAlternations: { size: number; colour: number };
  parityRatio: { even: number; odd: number };
  ngram3NextSizeProb: Record<GameSize, number>;
  ngram3NextColourProb: Record<GameColour, number>;
  hotDigits: number[];
  coldDigits: number[];
}

export function extractFeatures(history: GameResult[]): ExtractedFeatures {
  const n = history.length;
  const colours: GameColour[] = ['RED', 'GREEN', 'VIOLET'];
  const sizes: GameSize[] = ['BIG', 'SMALL'];

  // Defaults if empty
  const defaultNumberFreq = Array(10).fill(0.1);
  const defaultColourFreq: Record<GameColour, number> = { RED: 0.4, GREEN: 0.4, VIOLET: 0.2 };
  const defaultSizeFreq: Record<GameSize, number> = { BIG: 0.5, SMALL: 0.5 };

  if (n === 0) {
    return {
      sampleCount: 0,
      recentResults: [],
      allTimeNumberFreq: defaultNumberFreq,
      allTimeColourFreq: defaultColourFreq,
      allTimeSizeFreq: defaultSizeFreq,
      rollingNumberFreq30: defaultNumberFreq,
      rollingColourFreq30: defaultColourFreq,
      rollingSizeFreq30: defaultSizeFreq,
      recencyNumberFreq: defaultNumberFreq,
      recencyColourFreq: defaultColourFreq,
      recencySizeFreq: defaultSizeFreq,
      lastNumber: null,
      lastCursorColour: null,
      lastSize: null,
      markovNextNumberProb: defaultNumberFreq,
      markovNextColourProb: defaultColourFreq,
      markovNextSizeProb: defaultSizeFreq,
      ngramNextNumberProb: defaultNumberFreq,
      ngramNextColourProb: defaultColourFreq,
      ngramNextSizeProb: defaultSizeFreq,
      colourStreak: { colour: null, count: 0 },
      sizeStreak: { size: null, count: 0 },
      numberStreak: { number: null, count: 0 },
      sizeRegime: 'BALANCED',
      colourRegime: 'BALANCED',
      isSizeAlternating: false,
      isColourAlternating: false,
      consecutiveAlternations: { size: 0, colour: 0 },
      parityRatio: { even: 0.5, odd: 0.5 },
      ngram3NextSizeProb: defaultSizeFreq,
      ngram3NextColourProb: defaultColourFreq,
      hotDigits: [0, 5, 8],
      coldDigits: [1, 4, 9],
    };
  }

  // 1. All-time frequency with Laplace smoothing (+1)
  const numCounts = Array(10).fill(1);
  const colCounts: Record<GameColour, number> = { RED: 1, GREEN: 1, VIOLET: 1 };
  const sizeCounts: Record<GameSize, number> = { BIG: 1, SMALL: 1 };

  for (let i = 0; i < n; i++) {
    const r = history[i];
    numCounts[r.number]++;
    colCounts[r.colour]++;
    sizeCounts[r.size]++;
  }

  const numSum = numCounts.reduce((a, b) => a + b, 0);
  const colSum = colCounts.RED + colCounts.GREEN + colCounts.VIOLET;
  const sizeSum = sizeCounts.BIG + sizeCounts.SMALL;

  const allTimeNumberFreq = numCounts.map((c) => c / numSum);
  const allTimeColourFreq = {
    RED: colCounts.RED / colSum,
    GREEN: colCounts.GREEN / colSum,
    VIOLET: colCounts.VIOLET / colSum,
  };
  const allTimeSizeFreq = {
    BIG: sizeCounts.BIG / sizeSum,
    SMALL: sizeCounts.SMALL / sizeSum,
  };

  // 2. Rolling 30 frequency
  const window30 = history.slice(Math.max(0, n - 30));
  const rNumCounts = Array(10).fill(1);
  const rColCounts: Record<GameColour, number> = { RED: 1, GREEN: 1, VIOLET: 1 };
  const rSizeCounts: Record<GameSize, number> = { BIG: 1, SMALL: 1 };

  for (const r of window30) {
    rNumCounts[r.number]++;
    rColCounts[r.colour]++;
    rSizeCounts[r.size]++;
  }
  const rNumSum = rNumCounts.reduce((a, b) => a + b, 0);
  const rColSum = rColCounts.RED + rColCounts.GREEN + rColCounts.VIOLET;
  const rSizeSum = rSizeCounts.BIG + rSizeCounts.SMALL;

  const rollingNumberFreq30 = rNumCounts.map((c) => c / rNumSum);
  const rollingColourFreq30 = {
    RED: rColCounts.RED / rColSum,
    GREEN: rColCounts.GREEN / rColSum,
    VIOLET: rColCounts.VIOLET / rColSum,
  };
  const rollingSizeFreq30 = {
    BIG: rSizeCounts.BIG / rSizeSum,
    SMALL: rSizeCounts.SMALL / rSizeSum,
  };

  // 3. Recency-weighted frequency (decay factor alpha = 0.96 per step)
  const decayNum = Array(10).fill(0.1);
  const decayCol: Record<GameColour, number> = { RED: 0.1, GREEN: 0.1, VIOLET: 0.1 };
  const decaySize: Record<GameSize, number> = { BIG: 0.1, SMALL: 0.1 };
  let weightSum = 0;

  for (let i = n - 1, step = 0; i >= 0 && step < 100; i--, step++) {
    const w = Math.pow(0.96, step);
    const r = history[i];
    decayNum[r.number] += w;
    decayCol[r.colour] += w;
    decaySize[r.size] += w;
    weightSum += w;
  }

  const dNumSum = decayNum.reduce((a, b) => a + b, 0);
  const dColSum = decayCol.RED + decayCol.GREEN + decayCol.VIOLET;
  const dSizeSum = decaySize.BIG + decaySize.SMALL;

  const recencyNumberFreq = decayNum.map((c) => c / dNumSum);
  const recencyColourFreq = {
    RED: decayCol.RED / dColSum,
    GREEN: decayCol.GREEN / dColSum,
    VIOLET: decayCol.VIOLET / dColSum,
  };
  const recencySizeFreq = {
    BIG: decaySize.BIG / dSizeSum,
    SMALL: decaySize.SMALL / dSizeSum,
  };

  // 4. Markov transitions from the most recent result
  const lastResult = history[n - 1];
  const lastNumber = lastResult.number;
  const lastCursorColour = lastResult.colour;
  const lastSize = lastResult.size;

  const mNumCounts = Array(10).fill(1); // Laplace smoothed
  const mColCounts: Record<GameColour, number> = { RED: 1, GREEN: 1, VIOLET: 1 };
  const mSizeCounts: Record<GameSize, number> = { BIG: 1, SMALL: 1 };

  for (let i = 0; i < n - 1; i++) {
    const cur = history[i];
    const next = history[i + 1];
    if (cur.number === lastNumber) {
      mNumCounts[next.number] += 2;
    }
    if (cur.colour === lastCursorColour) {
      mColCounts[next.colour] += 2;
    }
    if (cur.size === lastSize) {
      mSizeCounts[next.size] += 2;
    }
  }

  const mNumSum = mNumCounts.reduce((a, b) => a + b, 0);
  const mColSum = mColCounts.RED + mColCounts.GREEN + mColCounts.VIOLET;
  const mSizeSum = mSizeCounts.BIG + mSizeCounts.SMALL;

  const markovNextNumberProb = mNumCounts.map((c) => c / mNumSum);
  const markovNextColourProb = {
    RED: mColCounts.RED / mColSum,
    GREEN: mColCounts.GREEN / mColSum,
    VIOLET: mColCounts.VIOLET / mColSum,
  };
  const markovNextSizeProb = {
    BIG: mSizeCounts.BIG / mSizeSum,
    SMALL: mSizeCounts.SMALL / mSizeSum,
  };

  // 5. Sequence / N-gram pattern matching (search for 2-step history match: [r_{n-2}, r_{n-1}])
  const ngNumCounts = Array(10).fill(1);
  const ngColCounts: Record<GameColour, number> = { RED: 1, GREEN: 1, VIOLET: 1 };
  const ngSizeCounts: Record<GameSize, number> = { BIG: 1, SMALL: 1 };

  if (n >= 3) {
    const pen = history[n - 2];
    for (let i = 0; i < n - 2; i++) {
      const a = history[i];
      const b = history[i + 1];
      const next = history[i + 2];
      if (a.number === pen.number && b.number === lastResult.number) {
        ngNumCounts[next.number] += 4;
      }
      if (a.colour === pen.colour && b.colour === lastResult.colour) {
        ngColCounts[next.colour] += 3;
      }
      if (a.size === pen.size && b.size === lastResult.size) {
        ngSizeCounts[next.size] += 3;
      }
    }
  }

  const ngNumSum = ngNumCounts.reduce((a, b) => a + b, 0);
  const ngColSum = ngColCounts.RED + ngColCounts.GREEN + ngColCounts.VIOLET;
  const ngSizeSum = ngSizeCounts.BIG + ngSizeCounts.SMALL;

  const ngramNextNumberProb = ngNumCounts.map((c) => c / ngNumSum);
  const ngramNextColourProb = {
    RED: ngColCounts.RED / ngColSum,
    GREEN: ngColCounts.GREEN / ngColSum,
    VIOLET: ngColCounts.VIOLET / ngColSum,
  };
  const ngramNextSizeProb = {
    BIG: ngSizeCounts.BIG / ngSizeSum,
    SMALL: ngSizeCounts.SMALL / ngSizeSum,
  };

  // 6. Streaks
  let cStreak = 1;
  for (let i = n - 2; i >= 0; i--) {
    if (history[i].colour === lastCursorColour) cStreak++;
    else break;
  }
  let sStreak = 1;
  for (let i = n - 2; i >= 0; i--) {
    if (history[i].size === lastSize) sStreak++;
    else break;
  }
  let nStreak = 1;
  for (let i = n - 2; i >= 0; i--) {
    if (history[i].number === lastNumber) nStreak++;
    else break;
  }

  // 7. Alternating / Ping-Pong Cycle Detection
  let sAltCount = 0;
  for (let i = n - 1; i >= 1; i--) {
    if (history[i].size !== history[i - 1].size) {
      sAltCount++;
    } else {
      break;
    }
  }

  let cAltCount = 0;
  for (let i = n - 1; i >= 1; i--) {
    if (history[i].colour !== history[i - 1].colour) {
      cAltCount++;
    } else {
      break;
    }
  }

  const isSizeAlternating = sAltCount >= 2;
  const isColourAlternating = cAltCount >= 2;

  // 8. Doublet (2x2) Pattern Detection (e.g. B, B, S, S, B, B)
  let isSizeDoublets = false;
  if (n >= 4) {
    const s0 = history[n - 1].size;
    const s1 = history[n - 2].size;
    const s2 = history[n - 3].size;
    const s3 = history[n - 4].size;
    if (s0 === s1 && s2 === s3 && s0 !== s2) {
      isSizeDoublets = true;
    }
  }

  // 9. Regime Classification
  let sizeRegime: 'DRAGON' | 'ALTERNATING' | 'DOUBLETS' | 'BALANCED' = 'BALANCED';
  if (sStreak >= 3) {
    sizeRegime = 'DRAGON';
  } else if (isSizeAlternating) {
    sizeRegime = 'ALTERNATING';
  } else if (isSizeDoublets) {
    sizeRegime = 'DOUBLETS';
  }

  let colourRegime: 'DRAGON' | 'ALTERNATING' | 'BALANCED' = 'BALANCED';
  if (cStreak >= 3) {
    colourRegime = 'DRAGON';
  } else if (isColourAlternating) {
    colourRegime = 'ALTERNATING';
  }

  // 10. 3rd-Order Sequence Matching (history length >= 4)
  const ng3ColCounts: Record<GameColour, number> = { RED: 1, GREEN: 1, VIOLET: 1 };
  const ng3SizeCounts: Record<GameSize, number> = { BIG: 1, SMALL: 1 };

  if (n >= 4) {
    const tri1 = history[n - 3];
    const tri2 = history[n - 2];
    const tri3 = history[n - 1];
    for (let i = 0; i < n - 3; i++) {
      const a = history[i];
      const b = history[i + 1];
      const c = history[i + 2];
      const next = history[i + 3];
      if (a.size === tri1.size && b.size === tri2.size && c.size === tri3.size) {
        ng3SizeCounts[next.size] += 5;
      }
      if (a.colour === tri1.colour && b.colour === tri2.colour && c.colour === tri3.colour) {
        ng3ColCounts[next.colour] += 5;
      }
    }
  }

  const ng3ColSum = ng3ColCounts.RED + ng3ColCounts.GREEN + ng3ColCounts.VIOLET;
  const ng3SizeSum = ng3SizeCounts.BIG + ng3SizeCounts.SMALL;

  const ngram3NextColourProb = {
    RED: ng3ColCounts.RED / ng3ColSum,
    GREEN: ng3ColCounts.GREEN / ng3ColSum,
    VIOLET: ng3ColCounts.VIOLET / ng3ColSum,
  };
  const ngram3NextSizeProb = {
    BIG: ng3SizeCounts.BIG / ng3SizeSum,
    SMALL: ng3SizeCounts.SMALL / ng3SizeSum,
  };

  // 11. Parity Ratio (rolling window)
  let evenCount = 0;
  let oddCount = 0;
  for (const r of window30) {
    if (r.number % 2 === 0) evenCount++;
    else oddCount++;
  }
  const totalParity = (evenCount + oddCount) || 1;
  const parityRatio = {
    even: evenCount / totalParity,
    odd: oddCount / totalParity,
  };

  // 12. Hot and Cold Digits
  const indexedFreq = rNumCounts.map((count, num) => ({ num, count }));
  indexedFreq.sort((a, b) => b.count - a.count);
  const hotDigits = indexedFreq.slice(0, 3).map((x) => x.num);
  const coldDigits = indexedFreq.slice(-3).map((x) => x.num);

  return {
    sampleCount: n,
    recentResults: history.slice(Math.max(0, n - 20)).reverse(),
    allTimeNumberFreq,
    allTimeColourFreq,
    allTimeSizeFreq,
    rollingNumberFreq30,
    rollingColourFreq30,
    rollingSizeFreq30,
    recencyNumberFreq,
    recencyColourFreq,
    recencySizeFreq,
    lastNumber,
    lastCursorColour,
    lastSize,
    markovNextNumberProb,
    markovNextColourProb,
    markovNextSizeProb,
    ngramNextNumberProb,
    ngramNextColourProb,
    ngramNextSizeProb,
    colourStreak: { colour: lastCursorColour, count: cStreak },
    sizeStreak: { size: lastSize, count: sStreak },
    numberStreak: { number: lastNumber, count: nStreak },
    sizeRegime,
    colourRegime,
    isSizeAlternating,
    isColourAlternating,
    consecutiveAlternations: { size: sAltCount, colour: cAltCount },
    parityRatio,
    ngram3NextSizeProb,
    ngram3NextColourProb,
    hotDigits,
    coldDigits,
  };
}
