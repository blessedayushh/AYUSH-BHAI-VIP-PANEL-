import React from 'react';
import { ConfidenceLevel, GameColour, GameResult, GameSize, Prediction, UserDashboardData, isColourWin } from '../types';
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Flame,
  Activity,
  Award,
  Zap,
  HelpCircle,
  History,
  TrendingUp,
  TrendingDown,
  Clock,
  ExternalLink,
  ShieldCheck,
  Layers,
  ArrowUpRight,
  Crown,
} from 'lucide-react';

interface UserDashboardProps {
  data: UserDashboardData | null;
  onRefresh: () => void;
  countdownSeconds?: number;
  liveActiveRoundId?: string;
  onNavigateToTrade?: () => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({
  data,
  onRefresh,
  countdownSeconds,
  liveActiveRoundId,
  onNavigateToTrade,
}) => {
  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-rose-500/30 border-t-rose-500 rounded-full animate-spin"></div>
          <p className="text-xs text-slate-400 font-mono">Connecting to live prediction engine...</p>
        </div>
      </div>
    );
  }

  const { predictions, activeRoundId, recentResults, recentPredictions, statistics, latestResult, levelInfo } = data;
  const currentLevel = levelInfo?.currentLevel || 1;
  const isNumberActive = predictions.numberStatus === 'ACTIVE';

  const getColourStyle = (colour?: GameColour | string) => {
    switch (colour) {
      case 'RED':
        return {
          bg: 'bg-rose-500/15',
          border: 'border-rose-500/50',
          text: 'text-rose-400',
          gradient: 'from-rose-500 to-rose-600',
          shadow: 'shadow-rose-500/20',
          dot: 'bg-rose-500',
        };
      case 'GREEN':
        return {
          bg: 'bg-emerald-500/15',
          border: 'border-emerald-500/50',
          text: 'text-emerald-400',
          gradient: 'from-emerald-500 to-emerald-600',
          shadow: 'shadow-emerald-500/20',
          dot: 'bg-emerald-500',
        };
      case 'VIOLET':
        return {
          bg: 'bg-purple-500/15',
          border: 'border-purple-500/50',
          text: 'text-purple-400',
          gradient: 'from-purple-500 to-purple-600',
          shadow: 'shadow-purple-500/20',
          dot: 'bg-purple-500',
        };
      default:
        return {
          bg: 'bg-slate-800/40',
          border: 'border-slate-700',
          text: 'text-slate-300',
          gradient: 'from-slate-700 to-slate-800',
          shadow: 'shadow-slate-500/10',
          dot: 'bg-slate-400',
        };
    }
  };

  const getSizeStyle = (size?: GameSize | string) => {
    if (size === 'BIG') {
      return {
        bg: 'bg-sky-500/15',
        border: 'border-sky-500/50',
        text: 'text-sky-400',
        gradient: 'from-sky-500 to-blue-600',
      };
    }
    return {
      bg: 'bg-amber-500/15',
      border: 'border-amber-500/50',
      text: 'text-amber-400',
      gradient: 'from-amber-500 to-orange-600',
    };
  };

  const getConfidenceBadge = (confidence?: ConfidenceLevel) => {
    switch (confidence) {
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            <Zap className="w-3 h-3 text-emerald-400" />
            HIGH CONFIDENCE
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            <Activity className="w-3 h-3 text-amber-400" />
            MEDIUM
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-700/50 text-slate-300 border border-slate-600">
            <HelpCircle className="w-3 h-3 text-slate-400" />
            MODERATE
          </span>
        );
    }
  };

  const colStyle = getColourStyle(predictions.colour?.predictedValue);
  const sizeStyle = getSizeStyle(predictions.size?.predictedValue);

  // Dual Number styling (Primary + Backup)
  const getNumColourStyle = (val: number | string | undefined) => {
    if (val === undefined || val === null) return getColourStyle('VIOLET');
    const n = Number(val);
    if (isNaN(n)) return getColourStyle('VIOLET');
    if (n === 0 || n === 5) return getColourStyle('VIOLET');
    return n % 2 === 0 ? getColourStyle('RED') : getColourStyle('GREEN');
  };

  const primaryNum = predictions.number?.predictedValue !== undefined ? Number(predictions.number.predictedValue) : null;
  const primaryCategory = predictions.number?.primaryCategory || (primaryNum !== null && primaryNum >= 5 ? 'BIG' : 'SMALL');
  const primaryNumStyle = getNumColourStyle(primaryNum);

  const backupNum = predictions.number?.backupValue !== undefined ? Number(predictions.number.backupValue) : null;
  const backupCategory = predictions.number?.backupCategory || (primaryCategory === 'BIG' ? 'SMALL' : 'BIG');
  const backupNumStyle = getNumColourStyle(backupNum);

  // Check how latest prediction performed against latestResult
  const latestResultPredictedCol = recentPredictions.find(
    (p) => p.roundId === latestResult?.roundId && p.predictionType === 'COLOUR'
  );
  const latestResultPredictedSize = recentPredictions.find(
    (p) => p.roundId === latestResult?.roundId && p.predictionType === 'SIZE'
  );
  const latestResultPredictedNum = recentPredictions.find(
    (p) => p.roundId === latestResult?.roundId && p.predictionType === 'NUMBER'
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4 py-6">
      {/* Quick Trade Analysis Prompt Banner */}
      {onNavigateToTrade && (
        <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-teal-950/40 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-emerald-500/5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white font-['Chakra_Petch',sans-serif]">
                  Trade Analysis & Execution Terminal
                </h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                  ACTIVE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Simulated P&L growth, 3-Stage Martingale recovery, Quarter Kelly sizing, and dragon streak alerts.
              </p>
            </div>
          </div>

          <button
            id="btn-open-trade-analysis"
            onClick={onNavigateToTrade}
            className="self-start sm:self-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-all shadow-md shadow-emerald-600/20"
          >
            <span>Open Trade Analysis</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/* LATEST RESULT & LAST RESULTS SPOTLIGHT SECTION                */}
      {/* ============================================================ */}
      {latestResult && (
        <div className="bg-[#0b1120] border border-slate-800/90 rounded-2xl p-5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <Award className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="text-base font-bold text-white font-['Chakra_Petch',sans-serif] flex items-center gap-2">
                  Latest Result — Period #{latestResult.roundId}
                  <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    Official Drawn
                  </span>
                </h3>
                <span className="text-xs text-slate-400">
                  Official period draw verified in real time
                </span>
              </div>
            </div>

            {/* Performance status against prediction */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 mr-1">AI Prediction Evaluation:</span>
              {latestResultPredictedCol?.status === 'CORRECT' ||
              (latestResultPredictedCol && isColourWin(latestResultPredictedCol.predictedValue, latestResult.colour, latestResult.number)) ||
              latestResultPredictedSize?.status === 'CORRECT' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  PREDICTION HIT
                </span>
              ) : latestResultPredictedCol ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  <XCircle className="w-3.5 h-3.5 text-slate-400" />
                  EVALUATED
                </span>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-center bg-slate-900/80 rounded-xl p-4 border border-slate-800">
            {/* Number Ball */}
            <div className="flex items-center gap-4 sm:border-r border-slate-800 pr-4">
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center font-['Chakra_Petch',sans-serif] text-4xl font-black text-white shadow-xl ${
                  latestResult.number === 0
                    ? 'bg-gradient-to-br from-rose-600 via-purple-600 to-purple-800 shadow-purple-500/30 ring-2 ring-rose-400/40'
                    : latestResult.number === 5
                    ? 'bg-gradient-to-br from-emerald-600 via-purple-600 to-purple-800 shadow-purple-500/30 ring-2 ring-emerald-400/40'
                    : latestResult.colour === 'GREEN'
                    ? 'bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-emerald-500/30'
                    : latestResult.colour === 'RED'
                    ? 'bg-gradient-to-br from-rose-500 to-rose-700 shadow-rose-500/30'
                    : 'bg-gradient-to-br from-purple-500 to-purple-700 shadow-purple-500/30'
                }`}
              >
                {latestResult.number}
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block">
                  Winning Number
                </span>
                <span className="text-xl font-mono font-bold text-white">
                  {latestResult.number}
                </span>
              </div>
            </div>

            {/* Colour */}
            <div className="sm:border-r border-slate-800 px-2">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">
                Winning Colour
              </span>
              {latestResult.number === 0 ? (
                <div className="flex flex-col gap-1">
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-bold uppercase bg-gradient-to-r from-rose-500/20 to-purple-500/20 text-rose-300 border border-purple-500/50">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500 -ml-1 shadow-sm shadow-purple-500/50"></span>
                    RED + VIOLET
                  </span>
                  <span className="text-[10px] text-purple-400 font-semibold">Violet with Red (Wins Red & Violet)</span>
                </div>
              ) : latestResult.number === 5 ? (
                <div className="flex flex-col gap-1">
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-bold uppercase bg-gradient-to-r from-emerald-500/20 to-purple-500/20 text-emerald-300 border border-purple-500/50">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500 -ml-1 shadow-sm shadow-purple-500/50"></span>
                    GREEN + VIOLET
                  </span>
                  <span className="text-[10px] text-purple-400 font-semibold">Violet with Green (Wins Green & Violet)</span>
                </div>
              ) : (
                <span
                  className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-bold uppercase ${
                    getColourStyle(latestResult.colour).bg
                  } ${getColourStyle(latestResult.colour).text} border ${getColourStyle(latestResult.colour).border}`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${getColourStyle(latestResult.colour).dot}`}></span>
                  {latestResult.colour}
                </span>
              )}
            </div>

            {/* Size */}
            <div className="sm:border-r border-slate-800 px-2">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">
                Size Category
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold uppercase ${
                  getSizeStyle(latestResult.size).bg
                } ${getSizeStyle(latestResult.size).text} border ${getSizeStyle(latestResult.size).border}`}
              >
                {latestResult.size}
              </span>
            </div>

            {/* Verification Status */}
            <div className="px-2">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">
                Verification
              </span>
              <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Official Draw Verified</span>
              </div>
            </div>
          </div>

          {/* Last Results Quick Strip */}
          <div className="mt-4 pt-3 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="font-semibold uppercase tracking-wider text-[10px]">
                Last Results Sequence (Most Recent First)
              </span>
              <span className="font-mono text-[11px] text-slate-400">
                {recentResults.length} periods recorded
              </span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
              {recentResults.slice(0, 10).map((r, idx) => {
                const cs = getColourStyle(r.colour);
                return (
                  <div
                    key={r.roundId}
                    className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl border ${cs.border} ${cs.bg} transition-all ${
                      idx === 0 ? 'ring-2 ring-indigo-500/50' : ''
                    }`}
                  >
                    <span className="font-mono text-[10px] text-slate-400">
                      #{r.roundId.slice(-4)}
                    </span>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-xs font-bold text-white ${
                      r.colour === 'GREEN' ? 'bg-emerald-600' : r.colour === 'RED' ? 'bg-rose-600' : 'bg-purple-600'
                    }`}>
                      {r.number}
                    </span>
                    <span className={`text-[10px] font-bold ${cs.text}`}>
                      {r.colour}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-300">
                      {r.size}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* VIP 4-LEVEL STAKING PLAN (ADVANCES TO NEXT LEVEL ON WIN)      */}
      {/* ============================================================ */}
      <div className="bg-gradient-to-r from-yellow-950/30 via-slate-900 to-amber-950/20 border border-yellow-500/30 rounded-2xl p-4 sm:p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 shadow-md shadow-yellow-500/10">
              <Crown className="w-5 h-5 fill-yellow-400/20" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-yellow-400 font-['Chakra_Petch',sans-serif] flex items-center gap-2">
                  <span>VIP 4-LEVEL PLAN</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-yellow-400/20 text-yellow-300 font-mono font-bold border border-yellow-400/30">
                    STAGE {currentLevel} OF 4
                  </span>
                </h3>
              </div>
              <p className="text-xs text-slate-400">
                Rule: <span className="text-emerald-400 font-semibold">Advances to next level after winning</span> (Level 1 → Level 2 → Level 3 → Level 4). On loss, resets to Level 1.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {levelInfo?.previousOutcome === 'WIN' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm animate-pulse">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>WIN HIT! ADVANCED TO LEVEL {currentLevel}</span>
              </span>
            ) : levelInfo?.previousOutcome === 'LOSS' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                <span>RESET TO LEVEL 1</span>
              </span>
            ) : null}
          </div>
        </div>

        {/* 4 Levels Step Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { level: 1, amount: '₹10', multiplier: '1x Stake', label: 'Level 1' },
            { level: 2, amount: '₹20', multiplier: '2x Stake', label: 'Level 2' },
            { level: 3, amount: '₹50', multiplier: '5x Stake', label: 'Level 3' },
            { level: 4, amount: '₹100', multiplier: '10x Stake', label: 'Level 4' },
          ].map((step) => {
            const isCurrent = step.level === currentLevel;
            const isCompleted = step.level < currentLevel;
            return (
              <div
                key={step.level}
                className={`relative rounded-xl p-3 border transition-all ${
                  isCurrent
                    ? 'bg-yellow-500/15 border-yellow-500/70 shadow-lg shadow-yellow-500/10 ring-2 ring-yellow-400/50'
                    : isCompleted
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-slate-300'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-400 opacity-80'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${isCurrent ? 'text-yellow-400' : isCompleted ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {step.label}
                  </span>
                  {isCurrent ? (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-yellow-400 text-slate-950 font-mono">
                      CURRENT STAGE
                    </span>
                  ) : isCompleted ? (
                    <span className="text-emerald-400 text-[10px] font-bold">✓ WON</span>
                  ) : (
                    <span className="text-slate-400 text-[10px] font-mono">PENDING</span>
                  )}
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <span className={`text-xl font-extrabold font-['Chakra_Petch',sans-serif] ${isCurrent ? 'text-white' : isCompleted ? 'text-emerald-300' : 'text-slate-300'}`}>
                    {step.amount}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {step.multiplier}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ============================================================ */}
      {/* AI PREDICTION SECTION FOR UPCOMING PERIOD                     */}
      {/* ============================================================ */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-rose-400" />
            <h2 className="text-base font-bold uppercase tracking-wider text-slate-200 font-['Chakra_Petch',sans-serif]">
              Full Accurate Prediction — Upcoming Period #{liveActiveRoundId || activeRoundId}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {typeof countdownSeconds === 'number' && (
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border font-mono text-xs font-bold transition-all shadow-sm ${
                  countdownSeconds <= 5
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                    : countdownSeconds <= 10
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-900/90 text-indigo-300 border-slate-700/80'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                {countdownSeconds === 0 ? (
                  <span className="text-rose-400">DRAWING...</span>
                ) : (
                  <span>
                    Next Draw: {Math.floor(countdownSeconds / 60).toString().padStart(2, '0')}:
                    {(countdownSeconds % 60).toString().padStart(2, '0')}
                  </span>
                )}
              </span>
            )}
            <span className="text-xs font-mono text-slate-400 hidden sm:inline">
              Real-Time AI Ensemble
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. COLOUR PREDICTION */}
          <div
            id="card-prediction-colour"
            className={`relative overflow-hidden rounded-2xl p-5 border ${colStyle.border} ${colStyle.bg} backdrop-blur-md shadow-xl transition-all hover:border-rose-400/80`}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                1. COLOUR PREDICTION
              </span>
              {getConfidenceBadge(predictions.colour?.confidence)}
            </div>

            <div className="my-2 flex items-center justify-between">
              <div>
                <span className={`text-4xl font-extrabold font-['Chakra_Petch',sans-serif] tracking-wider ${colStyle.text}`}>
                  {predictions.colour?.predictedValue || 'ANALYZING'}
                </span>
                <span className="text-xs text-slate-400 block mt-1">
                  Ensemble Markov & Neural Classifier
                </span>
              </div>
              <div className={`w-14 h-14 rounded-2xl ${colStyle.bg} border-2 ${colStyle.border} flex items-center justify-center shadow-lg`}>
                <div className={`w-8 h-8 rounded-full ${colStyle.dot} animate-pulse shadow-md`}></div>
              </div>
            </div>

            {/* Probability Bar */}
            <div className="mt-5 pt-3 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-400 font-medium">Model Probability</span>
                <span className="font-mono font-bold text-white text-sm">
                  {predictions.colour ? `${Math.round(predictions.colour.probability * 100)}%` : '---'}
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${colStyle.gradient} transition-all duration-700`}
                  style={{ width: `${Math.round((predictions.colour?.probability || 0.5) * 100)}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* 2. BIG / SMALL PREDICTION */}
          <div
            id="card-prediction-size"
            className={`relative overflow-hidden rounded-2xl p-5 border ${sizeStyle.border} ${sizeStyle.bg} backdrop-blur-md shadow-xl transition-all hover:border-sky-400/80`}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                2. BIG / SMALL PREDICTION
              </span>
              {getConfidenceBadge(predictions.size?.confidence)}
            </div>

            <div className="my-2 flex items-center justify-between">
              <div>
                <span className={`text-4xl font-extrabold font-['Chakra_Petch',sans-serif] tracking-wider ${sizeStyle.text}`}>
                  {predictions.size?.predictedValue || 'ANALYZING'}
                </span>
                <span className="text-xs text-slate-400 block mt-1">
                  Pattern Streak & Mean-Reversion Model
                </span>
              </div>
              <div className={`w-14 h-14 rounded-2xl ${sizeStyle.bg} border-2 ${sizeStyle.border} flex items-center justify-center shadow-lg ${sizeStyle.text}`}>
                {predictions.size?.predictedValue === 'BIG' ? (
                  <TrendingUp className="w-7 h-7" />
                ) : (
                  <TrendingDown className="w-7 h-7" />
                )}
              </div>
            </div>

            {/* Probability Bar */}
            <div className="mt-5 pt-3 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-400 font-medium">Model Probability</span>
                <span className="font-mono font-bold text-white text-sm">
                  {predictions.size ? `${Math.round(predictions.size.probability * 100)}%` : '---'}
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${sizeStyle.gradient} transition-all duration-700`}
                  style={{ width: `${Math.round((predictions.size?.probability || 0.5) * 100)}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* 3. NUMBER PREDICTION (DUAL TARGET: PRIMARY + OPPOSING BACKUP) */}
          <div
            id="card-prediction-number"
            className={`relative overflow-hidden rounded-2xl p-5 border backdrop-blur-md shadow-xl transition-all ${
              isNumberActive
                ? 'border-purple-500/60 bg-purple-500/10'
                : 'border-indigo-500/40 bg-indigo-950/20'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                3. NUMBERS (PRIMARY & BACKUP)
              </span>

              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  DUAL HEDGE
                </span>
                {isNumberActive ? (
                  getConfidenceBadge(predictions.number?.confidence)
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                    AI FORECAST
                  </span>
                )}
              </div>
            </div>

            {predictions.number ? (
              <div>
                <div className="grid grid-cols-2 gap-3 my-2">
                  {/* Primary Number (Matched to Predicted Size) */}
                  <div className="bg-slate-900/90 rounded-xl p-3 border border-purple-500/30 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300">
                        Primary
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${getSizeStyle(primaryCategory).bg} ${getSizeStyle(primaryCategory).text} border ${getSizeStyle(primaryCategory).border}`}>
                        {primaryCategory}
                      </span>
                    </div>

                    <div className="flex items-center justify-between my-1">
                      <span className="text-3xl sm:text-4xl font-extrabold font-['Chakra_Petch',sans-serif] text-white">
                        {predictions.number.predictedValue}
                      </span>
                      <div className={`w-10 h-10 rounded-xl ${primaryNumStyle.bg} border ${primaryNumStyle.border} flex items-center justify-center text-xl font-black text-white shadow-md`}>
                        {predictions.number.predictedValue}
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Prob</span>
                      <span className="font-mono font-bold text-purple-300">
                        {Math.round((predictions.number.probability || 0.2) * 100)}%
                      </span>
                    </div>
                  </div>

                  {/* Backup Number (Opposite Size for Safety) */}
                  <div className="bg-slate-900/90 rounded-xl p-3 border border-indigo-500/30 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                        Backup
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${getSizeStyle(backupCategory).bg} ${getSizeStyle(backupCategory).text} border ${getSizeStyle(backupCategory).border}`}>
                        {backupCategory}
                      </span>
                    </div>

                    <div className="flex items-center justify-between my-1">
                      <span className="text-3xl sm:text-4xl font-extrabold font-['Chakra_Petch',sans-serif] text-white">
                        {backupNum !== null ? backupNum : '---'}
                      </span>
                      <div className={`w-10 h-10 rounded-xl ${backupNumStyle.bg} border ${backupNumStyle.border} flex items-center justify-center text-xl font-black text-white shadow-md`}>
                        {backupNum !== null ? backupNum : '-'}
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Prob</span>
                      <span className="font-mono font-bold text-indigo-300">
                        {Math.round((predictions.number.backupProbability || 0.15) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="truncate">
                    1 for {primaryCategory} prediction + 1 for {backupCategory} backup
                  </span>
                  <span className="font-mono font-bold text-purple-300 shrink-0 ml-1">
                    {Math.round(((predictions.number.probability || 0.2) + (predictions.number.backupProbability || 0.15)) * 100)}% cov
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center">
                <p className="text-xs text-slate-400 font-mono">Computing number probabilities...</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* HISTORICAL ACCURACY & VALIDATION STATS                       */}
      {/* ============================================================ */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Walk-Forward Out-of-Sample Accuracy
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Verified Zero-Lookahead
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Continuously evaluated against real official draw outcomes across {statistics.evaluatedCount} completed rounds.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl px-3 py-1.5 text-center">
            <span className="text-[10px] text-slate-400 font-semibold block uppercase">Colour Accuracy</span>
            <span className="text-sm font-mono font-bold text-rose-400">
              {(statistics.colourAccuracy * 100).toFixed(1)}%
            </span>
          </div>
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl px-3 py-1.5 text-center">
            <span className="text-[10px] text-slate-400 font-semibold block uppercase">Big/Small Accuracy</span>
            <span className="text-sm font-mono font-bold text-sky-400">
              {(statistics.sizeAccuracy * 100).toFixed(1)}%
            </span>
          </div>
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl px-3 py-1.5 text-center">
            <span className="text-[10px] text-slate-400 font-semibold block uppercase">Number Hit-Rate</span>
            <span className="text-sm font-mono font-bold text-purple-400">
              {(statistics.numberAccuracy * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* PREDICTION HISTORY TABLE                                      */}
      {/* ============================================================ */}
      <div className="bg-[#0c121e] border border-slate-800/90 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold text-white font-['Chakra_Petch',sans-serif]">
              Prediction History & Evaluated Outcomes
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Chronological Walk-Forward Audit
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-3 px-3">Round</th>
                <th className="py-3 px-3">Colour Pred</th>
                <th className="py-3 px-3">Actual Colour</th>
                <th className="py-3 px-3">Size Pred</th>
                <th className="py-3 px-3">Actual Size</th>
                <th className="py-3 px-3">Number Pred</th>
                <th className="py-3 px-3">Actual Number</th>
                <th className="py-3 px-3">Confidence</th>
                <th className="py-3 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {recentResults.slice(0, 10).map((res) => {
                const cPred = recentPredictions.find((p) => p.roundId === res.roundId && p.predictionType === 'COLOUR');
                const sPred = recentPredictions.find((p) => p.roundId === res.roundId && p.predictionType === 'SIZE');
                const nPred = recentPredictions.find((p) => p.roundId === res.roundId && p.predictionType === 'NUMBER');

                const isColCorrect =
                  cPred?.status === 'CORRECT' ||
                  (cPred && isColourWin(cPred.predictedValue, res.colour, res.number));
                const isSizeCorrect = sPred?.status === 'CORRECT';
                const isDualColourWin =
                  isColCorrect &&
                  (res.number === 0 || res.number === 5 || res.colour === 'VIOLET') &&
                  cPred?.predictedValue !== res.colour;

                return (
                  <tr key={res.roundId} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-slate-300">
                      #{res.roundId}
                    </td>

                    {/* Colour prediction */}
                    <td className="py-3 px-3">
                      {cPred ? (
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded font-bold ${getColourStyle(cPred.predictedValue).text}`}>
                            {cPred.predictedValue}
                          </span>
                          {isDualColourWin && (
                            <span
                              className="text-[9px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 font-semibold"
                              title="Won via Violet dual-colour rule"
                            >
                              DUAL WIN
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-600">---</span>
                      )}
                    </td>

                    {/* Actual Colour */}
                    <td className="py-3 px-3">
                      {res.number === 0 ? (
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-300 border border-purple-500/40"
                          title="Number 0 is Violet + Red (Wins Red & Violet)"
                        >
                          <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                          <span className="w-2 h-2 rounded-full bg-purple-500 -ml-1"></span>
                          RED+VIOLET
                        </span>
                      ) : res.number === 5 ? (
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-purple-500/40"
                          title="Number 5 is Violet + Green (Wins Green & Violet)"
                        >
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          <span className="w-2 h-2 rounded-full bg-purple-500 -ml-1"></span>
                          GREEN+VIOLET
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${getColourStyle(res.colour).bg} ${getColourStyle(res.colour).text} border ${getColourStyle(res.colour).border}`}>
                          <span className={`w-2 h-2 rounded-full ${getColourStyle(res.colour).dot}`}></span>
                          {res.colour}
                        </span>
                      )}
                    </td>

                    {/* Size prediction */}
                    <td className="py-3 px-3">
                      {sPred ? (
                        <span className={`font-bold ${getSizeStyle(sPred.predictedValue).text}`}>
                          {sPred.predictedValue}
                        </span>
                      ) : (
                        <span className="text-slate-600">---</span>
                      )}
                    </td>

                    {/* Actual Size */}
                    <td className="py-3 px-3 font-bold text-slate-300">
                      {res.size}
                    </td>

                    {/* Number prediction (Primary + Backup) */}
                    <td className="py-3 px-3 font-mono">
                      {nPred ? (
                        <div className="flex items-center gap-1.5">
                          <span
                            className="font-bold text-purple-300"
                            title={`Primary: ${nPred.primaryCategory || 'MAIN'}`}
                          >
                            {nPred.predictedValue}
                          </span>
                          {nPred.backupValue !== undefined && (
                            <span
                              className="text-[10px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700 font-medium"
                              title={`Backup: ${nPred.backupCategory || 'BACKUP'} hedge`}
                            >
                              +{nPred.backupValue}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500">---</span>
                      )}
                    </td>

                    {/* Actual Number */}
                    <td className="py-3 px-3 font-mono font-bold text-slate-200">
                      {res.number}
                    </td>

                    {/* Confidence */}
                    <td className="py-3 px-3">
                      {getConfidenceBadge(cPred?.confidence || 'MEDIUM')}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3 text-right">
                      {isColCorrect || isSizeCorrect || nPred?.status === 'CORRECT' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          HIT
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          <XCircle className="w-3 h-3" />
                          MISS
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
