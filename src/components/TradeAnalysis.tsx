import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ConfidenceLevel,
  LiveTradeDirective,
  StakingStrategy,
  TradeAnalysisData,
  TradeJournalEntry,
} from '../types';
import { api } from '../api';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  ShieldAlert,
  Sliders,
  DollarSign,
  Percent,
  Activity,
  Award,
  Zap,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Flame,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Info,
  ChevronRight,
  Target,
  BarChart3,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';

interface TradeAnalysisProps {
  countdownSeconds: number;
  activeRoundId: string;
  onNavigateToPredictions?: () => void;
}

export const TradeAnalysis: React.FC<TradeAnalysisProps> = ({
  countdownSeconds,
  activeRoundId,
  onNavigateToPredictions,
}) => {
  const [data, setData] = useState<TradeAnalysisData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // User configurable parameters
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');
  const [bankroll, setBankroll] = useState<number>(180);
  const [baseUnit, setBaseUnit] = useState<number>(10);
  const [selectedStrategy, setSelectedStrategy] = useState<StakingStrategy>('LEVELS_4');
  const [journalFilter, setJournalFilter] = useState<'ALL' | 'WINS' | 'LOSSES' | 'SIZE' | 'COLOUR'>('ALL');
  const [showConfigDrawer, setShowConfigDrawer] = useState<boolean>(false);

  const currencySymbol = currency === 'INR' ? '₹' : '$';

  const formatCurrency = (amount: number) => {
    if (currency === 'INR') {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2,
        minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      }).format(amount);
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const handleCurrencyChange = (newCurr: 'INR' | 'USD') => {
    if (newCurr === currency) return;
    setCurrency(newCurr);
    if (newCurr === 'INR') {
      setBankroll(180);
      setBaseUnit(10);
    } else {
      setBankroll(100);
      setBaseUnit(5);
    }
  };

  const fetchAnalysis = useCallback(
    async (silent = false) => {
      if (!silent) setIsRefreshing(true);
      try {
        const res = await api.getTradeAnalysis({
          bankroll,
          strategy: selectedStrategy,
          baseUnit,
          limit: 60,
        });
        setData(res);
        setError(null);
      } catch (err: any) {
        console.error('Failed to load trade analysis', err);
        setError(err.message || 'Failed to fetch trade analysis data');
      } finally {
        setLoading(false);
        if (!silent) setIsRefreshing(false);
      }
    },
    [bankroll, selectedStrategy, baseUnit]
  );

  useEffect(() => {
    fetchAnalysis(false);
  }, [fetchAnalysis]);

  // Auto-refresh slightly after round changes and draw finishes
  const prevRoundRef = useRef(activeRoundId);
  useEffect(() => {
    if (prevRoundRef.current && prevRoundRef.current !== activeRoundId) {
      const timer = setTimeout(() => {
        fetchAnalysis(true);
      }, 1200);
      return () => clearTimeout(timer);
    }
    prevRoundRef.current = activeRoundId;
  }, [activeRoundId, fetchAnalysis]);

  const formatCountdown = (sec: number) => {
    const safeSec = Math.max(0, Math.floor(sec));
    const m = Math.floor(safeSec / 60);
    const s = safeSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[65vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-3 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin"></div>
          <p className="text-xs text-slate-400 font-mono">Simulating quantitative trade positions & P&L matrix...</p>
        </div>
      </div>
    );
  }

  const live = data?.liveDirective;
  const perf = data?.performance;
  const trades = data?.recentTrades || [];

  const filteredTrades = trades.filter((t) => {
    if (journalFilter === 'WINS') return t.isWin;
    if (journalFilter === 'LOSSES') return !t.isWin;
    if (journalFilter === 'SIZE') return t.market === 'SIZE';
    if (journalFilter === 'COLOUR') return t.market === 'COLOUR';
    return true;
  });

  const getSignalBadgeColor = (quality: string) => {
    switch (quality) {
      case 'A+':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-emerald-500/20';
      case 'A':
        return 'bg-teal-500/20 text-teal-300 border-teal-500/40 shadow-teal-500/10';
      case 'B':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-amber-500/10';
      default:
        return 'bg-slate-700/40 text-slate-300 border-slate-600';
    }
  };

  const getTargetPill = (market: string, target: string) => {
    if (target === 'BIG') {
      return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    }
    if (target === 'SMALL') {
      return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
    }
    if (target === 'GREEN') {
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    }
    if (target === 'RED') {
      return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    }
    return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Banner & Strategy Controller */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-4 sm:p-5 rounded-2xl shadow-xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white font-['Chakra_Petch',sans-serif] tracking-tight">
                Quantitative Trade Analysis
              </h2>
              <p className="text-xs text-slate-400">
                Live Trade Directives, Simulated P&L Growth, Regime Detection & Risk Models
              </p>
            </div>
          </div>
        </div>

        {/* Quick Settings Bar */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Currency Toggle */}
          <div className="flex items-center bg-slate-950/90 border border-slate-800 p-0.5 rounded-xl shadow-inner">
            <button
              id="btn-curr-inr"
              type="button"
              onClick={() => handleCurrencyChange('INR')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 ${
                currency === 'INR'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-700/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
              title="Indian Rupee (INR)"
            >
              <span className="font-bold">₹</span>
              <span>INR</span>
            </button>
            <button
              id="btn-curr-usd"
              type="button"
              onClick={() => handleCurrencyChange('USD')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 ${
                currency === 'USD'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-700/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
              title="US Dollar (USD)"
            >
              <span>$</span>
              <span>USD</span>
            </button>
          </div>

          {/* Strategy Selector Pill */}
          <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-800 p-1 rounded-xl">
            {(['LEVELS_4', 'FLAT', 'MARTINGALE', 'KELLY', 'FIBONACCI'] as StakingStrategy[]).map((st) => (
              <button
                key={st}
                onClick={() => {
                  setSelectedStrategy(st);
                  if (st === 'LEVELS_4' && currency === 'INR') {
                    setBankroll(180);
                    setBaseUnit(10);
                  }
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                  selectedStrategy === st
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-700/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {st === 'LEVELS_4' && '4-Level ₹180'}
                {st === 'FLAT' && 'Flat 1X'}
                {st === 'MARTINGALE' && '3-Stage Martingale'}
                {st === 'KELLY' && 'Kelly Criterion'}
                {st === 'FIBONACCI' && 'Fibonacci'}
              </button>
            ))}
          </div>

          <button
            id="btn-open-bankroll-config"
            onClick={() => setShowConfigDrawer(!showConfigDrawer)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition-colors"
          >
            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
            <span>Bankroll: {formatCurrency(bankroll)}</span>
          </button>

          <button
            onClick={() => fetchAnalysis(false)}
            disabled={isRefreshing}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-xl border border-slate-700 transition-colors"
            title="Recalculate Analysis"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Config Drawer if open */}
      {showConfigDrawer && (
        <div className="bg-slate-900/95 border border-slate-800 p-4 sm:p-5 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-200 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              Simulator Bankroll & Staking Parameters ({currency})
            </span>
            <button
              onClick={() => setShowConfigDrawer(false)}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-slate-400">Starting Bankroll ({currencySymbol} {currency})</label>
                <div className="flex items-center gap-1 text-[10px] font-mono">
                  <button
                    type="button"
                    onClick={() => handleCurrencyChange('INR')}
                    className={`px-1.5 py-0.5 rounded ${currency === 'INR' ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    ₹ INR
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCurrencyChange('USD')}
                    className={`px-1.5 py-0.5 rounded ${currency === 'USD' ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    $ USD
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="10"
                  max="1000000"
                  step={currency === 'INR' ? '100' : '10'}
                  value={bankroll}
                  onChange={(e) => setBankroll(Number(e.target.value) || (currency === 'INR' ? 180 : 100))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(currency === 'INR' ? [180, 360, 900, 1800, 5000, 10000] : [100, 200, 500, 1000, 2500]).map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setBankroll(amt);
                      if (currency === 'INR') {
                        if (amt === 180) setBaseUnit(10);
                        else if (amt === 360) setBaseUnit(20);
                        else if (amt === 900) setBaseUnit(50);
                        else if (amt === 1800) setBaseUnit(100);
                        else setBaseUnit(Math.max(10, Math.round(amt * 0.01)));
                      } else {
                        setBaseUnit(Math.max(2, Math.round(amt * 0.01)));
                      }
                    }}
                    className={`px-2 py-0.5 text-[11px] rounded font-mono ${
                      bankroll === amt ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {currency === 'INR' && amt === 180 ? '₹180 (1 Cycle)' : currency === 'INR' && amt === 360 ? '₹360 (2x)' : currency === 'INR' && amt === 900 ? '₹900 (5x)' : currency === 'INR' && amt === 1800 ? '₹1.8k' : `${currencySymbol}${amt >= 1000 ? `${amt / 1000}k` : amt}`}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Base Unit Stake ({currencySymbol})</label>
              <input
                type="number"
                min="1"
                max="10000"
                step="1"
                value={baseUnit}
                onChange={(e) => setBaseUnit(Number(e.target.value) || (currency === 'INR' ? 10 : 5))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(currency === 'INR' ? [10, 20, 50, 100, 200] : [2, 5, 10, 25, 50]).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setBaseUnit(u)}
                    className={`px-2 py-0.5 text-[11px] rounded font-mono ${
                      baseUnit === u ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {currencySymbol}{u}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                {selectedStrategy === 'LEVELS_4'
                  ? `4-Level scaling: L1=${formatCurrency(baseUnit)} | L2=${formatCurrency(baseUnit * 2)} | L3=${formatCurrency(baseUnit * 5)} | L4=${formatCurrency(baseUnit * 10)} (Total ${formatCurrency(baseUnit * 18)})`
                  : `Standard stake unit (1% of bankroll = ${currencySymbol}${(bankroll * 0.01).toFixed(0)})`}
              </span>
            </div>

            <div className="flex flex-col justify-end">
              <button
                onClick={() => {
                  fetchAnalysis(false);
                  setShowConfigDrawer(false);
                }}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-600/20"
              >
                <CheckCircle2 className="w-4 h-4" />
                Apply & Re-simulate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hero Live Signal Directive Card */}
      {live && (
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900/90 to-[#0c1424] border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl">
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

          {/* Card Header: Round ID & Live Countdown */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Live Trade Signal
              </span>
              <span className="text-xs font-mono font-bold text-rose-300 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/30">
                #{activeRoundId || live.roundId}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-slate-950/80 px-3 py-1 rounded-xl border border-slate-800 text-xs font-mono">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-slate-400">Draw In:</span>
                <span className={`font-bold ${countdownSeconds <= 5 ? 'text-rose-400 animate-pulse' : 'text-slate-100'}`}>
                  {formatCountdown(countdownSeconds)}
                </span>
              </div>

              {onNavigateToPredictions && (
                <button
                  onClick={onNavigateToPredictions}
                  className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
                >
                  <span>Predictions View</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Trade Execution Directives Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-5">
            {/* Primary Order Action Box */}
            <div className="lg:col-span-5 bg-slate-950/70 border border-slate-800/90 rounded-2xl p-5 flex flex-col justify-between space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Primary Trade Recommendation
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-2xl sm:text-3xl font-black text-white tracking-tight font-['Chakra_Petch',sans-serif]">
                      BUY {live.primaryAction.target}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-xs font-bold border shadow-sm ${getSignalBadgeColor(live.primaryAction.signalQuality)}`}>
                      {live.primaryAction.signalQuality} SIGNAL
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 mt-1 block">
                    Market: {live.primaryAction.market === 'SIZE' ? 'Big / Small 1.96x' : 'Colour 1.96x'}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase block font-mono">Win Odds</span>
                  <span className="text-sm font-mono font-bold text-emerald-400">1.96x Net</span>
                </div>
              </div>

              {/* Statistical Confidence & EV metrics */}
              <div className="grid grid-cols-3 gap-2 bg-slate-900/80 p-3 rounded-xl border border-slate-800/70 text-center">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Win Edge</span>
                  <span className="text-sm font-bold text-emerald-400 font-mono">
                    {(live.primaryAction.probability * 100).toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Expected Value</span>
                  <span className={`text-sm font-bold font-mono ${live.primaryAction.expectedValue >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {live.primaryAction.expectedValue >= 0 ? '+' : ''}
                    {(live.primaryAction.expectedValue * 100).toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Confidence</span>
                  <span className="text-xs font-bold text-slate-200 mt-0.5 block">
                    {live.primaryAction.confidence}
                  </span>
                </div>
              </div>

              {/* Recommended Execution Stake */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                <span className="text-slate-400">Recommended Allocation:</span>
                <span className="font-mono font-bold text-white bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                  {live.primaryAction.recommendedStakeUnits.toFixed(1)} Units ({formatCurrency(live.primaryAction.recommendedStakeUnits * baseUnit)})
                  <span className="text-emerald-400 ml-1">({live.primaryAction.recommendedStakePct}% Bankroll)</span>
                </span>
              </div>
            </div>

            {/* Hedge & Protection Allocation (Dual Numbers) */}
            <div className="lg:col-span-4 bg-slate-950/70 border border-slate-800/90 rounded-2xl p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Dual-Number 9x Hedging
                  </span>
                  <span className="text-[10px] font-mono bg-purple-500/10 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded">
                    Windfall Hedge
                  </span>
                </div>

                <div className="mt-2 flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white font-extrabold text-lg shadow-md">
                      {live.hedgeAction.primaryNumber}
                    </div>
                    <div className="text-xs">
                      <span className="text-slate-300 font-bold block">Primary #{live.hedgeAction.primaryNumber}</span>
                      <span className="text-slate-400 text-[10px]">Aligned with signal</span>
                    </div>
                  </div>

                  <span className="text-slate-400 text-xs font-bold">+</span>

                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 border border-purple-500/40 flex items-center justify-center text-purple-300 font-extrabold text-lg shadow-md">
                      {live.hedgeAction.backupNumber}
                    </div>
                    <div className="text-xs">
                      <span className="text-slate-300 font-bold block">Backup #{live.hedgeAction.backupNumber}</span>
                      <span className="text-slate-400 text-[10px]">Reverse-side hedge</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-purple-950/20 border border-purple-900/40 p-3 rounded-xl text-xs space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Payout Multiplier:</span>
                  <span className="font-mono font-bold text-purple-300">9.0x Payout</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Combined Hit Chance:</span>
                  <span className="font-mono font-bold text-slate-100">
                    {(live.hedgeAction.combinedProbability * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Hedge Allocation:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    0.5 Unit ({formatCurrency(baseUnit * 0.5)} split)
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                {live.hedgeAction.strategyNote}
              </p>
            </div>

            {/* Regime Detection & Progressive Stage Status */}
            <div className="lg:col-span-3 bg-slate-950/70 border border-slate-800/90 rounded-2xl p-5 flex flex-col justify-between space-y-3">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Regime & Volatility
                </span>
                <div className="flex items-center gap-2 mt-1.5">
                  {live.regime.patternType === 'STREAK_DRAGON' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                      <Flame className="w-3.5 h-3.5 text-rose-400" />
                      Dragon Streak ({live.regime.consecutiveCount}x)
                    </span>
                  ) : live.regime.patternType === 'ALTERNATING_ZIGZAG' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      <Activity className="w-3.5 h-3.5 text-amber-400" />
                      Zigzag Pattern
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      Balanced Flow
                    </span>
                  )}
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                    live.regime.volatilityLevel === 'HIGH' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}>
                    {live.regime.volatilityLevel} VOL
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                  {live.regime.advice}
                </p>
              </div>

              {/* Progressive Recovery / Bankroll Level Indicator */}
              <div className="pt-3 border-t border-slate-800/80">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-400">
                    {selectedStrategy === 'LEVELS_4' ? 'Active Bankroll Level:' : 'Recovery Stage:'}
                  </span>
                  <span className="font-mono font-bold text-white">
                    {selectedStrategy === 'LEVELS_4'
                      ? `Level ${live.martingaleState.currentStage} of 4 (${formatCurrency(live.martingaleState.stageMultiplier * baseUnit)})`
                      : `Stage ${live.martingaleState.currentStage} / ${live.martingaleState.maxSafeStages}`}
                  </span>
                </div>

                {selectedStrategy === 'LEVELS_4' ? (
                  <>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[1, 2, 3, 4].map((stageNum) => (
                        <div
                          key={stageNum}
                          className={`h-2.5 rounded-full transition-all ${
                            live.martingaleState.currentStage === stageNum
                              ? 'bg-emerald-500 shadow-md shadow-emerald-500/60 ring-2 ring-emerald-400/50'
                              : live.martingaleState.currentStage > stageNum
                              ? 'bg-slate-700'
                              : 'bg-slate-800/60'
                          }`}
                          title={`Level ${stageNum}: ${formatCurrency(
                            (stageNum === 1 ? 1 : stageNum === 2 ? 2 : stageNum === 3 ? 5 : 10) * baseUnit
                          )}`}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                      <span className={live.martingaleState.currentStage === 1 ? 'text-emerald-300 font-bold' : ''}>
                        {formatCurrency(1 * baseUnit)} (L1)
                      </span>
                      <span className={live.martingaleState.currentStage === 2 ? 'text-emerald-300 font-bold' : ''}>
                        {formatCurrency(2 * baseUnit)} (L2)
                      </span>
                      <span className={live.martingaleState.currentStage === 3 ? 'text-emerald-300 font-bold' : ''}>
                        {formatCurrency(5 * baseUnit)} (L3)
                      </span>
                      <span className={live.martingaleState.currentStage === 4 ? 'text-rose-400 font-bold' : ''}>
                        {formatCurrency(10 * baseUnit)} (L4)
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5 leading-tight">
                      {live.martingaleState.currentStage === 4
                        ? '🎯 Final Level 4: Win completes the 4-level cycle! If loss occurs, resets back to Level 1.'
                        : 'On Win: Advances to next level. If Loss occurs: Bankroll starts back from Level 1.'}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[1, 2, 3].map((stageNum) => (
                        <div
                          key={stageNum}
                          className={`h-2 rounded-full transition-all ${
                            live.martingaleState.currentStage === stageNum
                              ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                              : live.martingaleState.currentStage > stageNum
                              ? 'bg-slate-700'
                              : 'bg-slate-850 bg-slate-800/50'
                          }`}
                          title={`Stage ${stageNum} (${stageNum === 1 ? '1x' : stageNum === 2 ? '2.5x' : '6.5x'})`}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                      <span>1.0x Base</span>
                      <span>2.5x</span>
                      <span>6.5x Max</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4-Level Bankroll Matrix & Staking Plan Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                4-Level Bankroll Matrix ({formatCurrency(18 * baseUnit)} Total Cycle)
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Winning Progression: Advances to next level after winning (L1 → L2 → L3 → L4). If a loss happens at any stage, the bankroll starts over from Level 1.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedStrategy('LEVELS_4');
                setBankroll(180);
                setBaseUnit(10);
                fetchAnalysis(false);
              }}
              className="px-3 py-1.5 text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl transition-colors"
            >
              Reset to 1 Cycle ({formatCurrency(180)})
            </button>
          </div>
        </div>

        {/* 4 Levels Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              level: 1,
              name: 'Level 1',
              amount: 1 * baseUnit,
              cumAmount: 1 * baseUnit,
              winNet: Math.round(1 * baseUnit * 0.96 * 100) / 100,
              onWin: 'Advance to Level 2 (₹20)',
              onLoss: 'Stay at Level 1',
              badgeColor: 'emerald',
            },
            {
              level: 2,
              name: 'Level 2',
              amount: 2 * baseUnit,
              cumAmount: (1 + 2) * baseUnit,
              winNet: Math.round(2 * baseUnit * 0.96 * 100) / 100,
              onWin: 'Advance to Level 3 (₹50)',
              onLoss: 'Loss -> Start from Level 1',
              badgeColor: 'cyan',
            },
            {
              level: 3,
              name: 'Level 3',
              amount: 5 * baseUnit,
              cumAmount: (1 + 2 + 5) * baseUnit,
              winNet: Math.round(5 * baseUnit * 0.96 * 100) / 100,
              onWin: 'Advance to Level 4 (₹100)',
              onLoss: 'Loss -> Start from Level 1',
              badgeColor: 'amber',
            },
            {
              level: 4,
              name: 'Level 4',
              amount: 10 * baseUnit,
              cumAmount: (1 + 2 + 5 + 10) * baseUnit,
              winNet: Math.round(10 * baseUnit * 0.96 * 100) / 100,
              onWin: 'Goal Achieved! Reset to Level 1',
              onLoss: 'Loss -> Start from Level 1',
              badgeColor: 'rose',
            },
          ].map((lvl) => {
            const isCurrentActive =
              live && selectedStrategy === 'LEVELS_4' && live.martingaleState.currentStage === lvl.level;
            return (
              <div
                key={lvl.level}
                className={`relative rounded-2xl p-4 border transition-all ${
                  isCurrentActive
                    ? 'bg-emerald-950/40 border-emerald-500/80 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/50'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {isCurrentActive && (
                  <div className="absolute -top-2.5 right-3 bg-emerald-500 text-slate-950 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full shadow-md animate-pulse">
                    ACTIVE STAKE
                  </div>
                )}

                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    {lvl.name}
                  </span>
                  <span className="text-[11px] font-mono font-bold text-slate-400">
                    Target: {formatCurrency(lvl.amount)}
                  </span>
                </div>

                <div className="flex items-baseline gap-1.5 my-1">
                  <span className="text-2xl font-black font-mono text-white">
                    {formatCurrency(lvl.amount)}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    ({(lvl.amount / baseUnit)}x base)
                  </span>
                </div>

                <div className="space-y-1.5 pt-2 mt-2 border-t border-slate-800/80 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span className="text-[11px] text-slate-400">Profit on Win:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      +{formatCurrency(lvl.winNet)}
                    </span>
                  </div>

                  <div className="text-[11px] pt-1 space-y-1">
                    <div>
                      <span className="text-emerald-400 block text-[10px] uppercase font-semibold">
                        After Winning:
                      </span>
                      <span className="font-medium text-slate-200">
                        {lvl.onWin}
                      </span>
                    </div>

                    <div>
                      <span className="text-rose-400 block text-[10px] uppercase font-semibold">
                        After Loss:
                      </span>
                      <span className="font-medium text-slate-300">
                        {lvl.onLoss}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bankroll Rule Callout */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-slate-300">
              <strong className="text-white">Total for all 4 levels: {formatCurrency(18 * baseUnit)}</strong>
              {currency === 'INR' && baseUnit === 10 && ' (₹10 + ₹20 + ₹50 + ₹100 = ₹180)'}
              {' — '}
              Advances to next level after winning. If loss happens, bankroll automatically starts over from Level 1.
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
            <span>Current Bankroll: <strong className="text-white">{formatCurrency(bankroll)}</strong></span>
            <span>({(bankroll / (18 * baseUnit)).toFixed(1)} Cycles Available)</span>
          </div>
        </div>
      </div>

      {/* Primary KPI Metrics Summary Cards */}
      {perf && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Net Simulated Profit */}
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Net Simulated Profit</span>
              <div className={`p-1.5 rounded-lg ${perf.totalNetProfit >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                {perf.totalNetProfit >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              </div>
            </div>
            <div className="mt-2">
              <div className={`text-xl sm:text-2xl font-bold font-mono ${perf.totalNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {perf.totalNetProfit >= 0 ? '+' : ''}
                {formatCurrency(perf.totalNetProfit)}
              </div>
              <span className="text-xs font-mono text-slate-400 mt-0.5 block">
                {perf.returnOnInvestmentPct >= 0 ? '+' : ''}
                {perf.returnOnInvestmentPct.toFixed(1)}% Return on Capital
              </span>
            </div>
          </div>

          {/* Win Rate */}
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Execution Win Rate</span>
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                <Award className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-bold font-mono text-white">
                {perf.winRatePct.toFixed(1)}%
              </div>
              <span className="text-xs text-slate-400 mt-0.5 block font-mono">
                {perf.winningTrades} Wins / {perf.totalTrades} Executed Rounds
              </span>
            </div>
          </div>

          {/* Profit Factor */}
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Profit Factor</span>
              <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400">
                <BarChart3 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-bold font-mono text-teal-300">
                {perf.profitFactor.toFixed(2)}
              </div>
              <span className="text-xs text-slate-400 mt-0.5 block font-mono">
                Gross Profit / Gross Loss Ratio
              </span>
            </div>
          </div>

          {/* Max Drawdown & Streaks */}
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Max Drawdown</span>
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                <ShieldAlert className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-bold font-mono text-amber-300">
                {perf.maxDrawdownPct.toFixed(1)}%
              </div>
              <span className="text-xs text-slate-400 mt-0.5 block font-mono">
                Max Win Streak: {perf.maxWinStreak} • Loss: {perf.maxLossStreak}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Equity Curve & Balance Trajectory Chart */}
      {perf && perf.equityCurve && perf.equityCurve.length > 1 && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Simulated Equity Growth & Capital Trajectory
              </h3>
              <p className="text-xs text-slate-400">
                Chronological equity curve based on {selectedStrategy} staking rules starting from {formatCurrency(perf.initialBankroll)}
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                Current: {formatCurrency(perf.currentEquity)}
              </span>
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-600"></span>
                Baseline: {formatCurrency(perf.initialBankroll)}
              </span>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={perf.equityCurve} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="roundId"
                  tickFormatter={(val) => (val === 'START' ? 'Start' : `#${val.slice(-4)}`)}
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis
                  domain={['dataMin - 50', 'dataMax + 50']}
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(v) => `${currencySymbol}${Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-slate-950 border border-slate-700 p-3 rounded-xl shadow-xl text-xs font-mono space-y-1">
                          <p className="text-slate-300 font-bold">
                            Round: {d.roundId === 'START' ? 'Initial Capital' : `#${d.roundId}`}
                          </p>
                          <p className="text-emerald-400">Equity: {formatCurrency(d.equity)}</p>
                          <p className={d.profit >= 0 ? 'text-emerald-300' : 'text-rose-400'}>
                            Net Profit: {d.profit >= 0 ? '+' : ''}
                            {formatCurrency(d.profit)}
                          </p>
                          <p className="text-amber-400">Peak Drawdown: {d.drawdown}%</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine
                  y={perf.initialBankroll}
                  stroke="#475569"
                  strokeDasharray="4 4"
                  label={{ value: 'Start', fill: '#94a3b8', fontSize: 10, position: 'insideTopLeft' }}
                />
                <Area
                  type="monotone"
                  dataKey="equity"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#equityGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Market Category Breakdown Matrix */}
      {perf && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Size Trades Card */}
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-300 flex items-center justify-center font-bold text-xs">
                  B/S
                </div>
                <span className="text-xs font-bold text-white">Size Trades (Big/Small)</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">1.96x Net</span>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-3 text-center">
              <div>
                <span className="text-[10px] text-slate-400 uppercase block">Trades</span>
                <span className="text-sm font-bold text-white font-mono">{perf.breakdown.sizeTrades.total}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase block">Win Rate</span>
                <span className="text-sm font-bold text-emerald-400 font-mono">
                  {perf.breakdown.sizeTrades.winRate.toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase block">Net P&L</span>
                <span className={`text-sm font-bold font-mono ${perf.breakdown.sizeTrades.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {perf.breakdown.sizeTrades.netProfit >= 0 ? '+' : ''}
                  {formatCurrency(perf.breakdown.sizeTrades.netProfit)}
                </span>
              </div>
            </div>
          </div>

          {/* Colour Trades Card */}
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-300 flex items-center justify-center font-bold text-xs">
                  C
                </div>
                <span className="text-xs font-bold text-white">Colour Trades (Red/Green)</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">1.96x Net</span>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-3 text-center">
              <div>
                <span className="text-[10px] text-slate-400 uppercase block">Trades</span>
                <span className="text-sm font-bold text-white font-mono">{perf.breakdown.colourTrades.total}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase block">Win Rate</span>
                <span className="text-sm font-bold text-emerald-400 font-mono">
                  {perf.breakdown.colourTrades.winRate.toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase block">Net P&L</span>
                <span className={`text-sm font-bold font-mono ${perf.breakdown.colourTrades.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {perf.breakdown.colourTrades.netProfit >= 0 ? '+' : ''}
                  {formatCurrency(perf.breakdown.colourTrades.netProfit)}
                </span>
              </div>
            </div>
          </div>

          {/* Number Hedge Card */}
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-300 flex items-center justify-center font-bold text-xs">
                  #H
                </div>
                <span className="text-xs font-bold text-white">Dual Number Hedge</span>
              </div>
              <span className="text-[10px] font-mono text-purple-300">9.0x Payout</span>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-3 text-center">
              <div>
                <span className="text-[10px] text-slate-400 uppercase block">Rounds</span>
                <span className="text-sm font-bold text-white font-mono">{perf.breakdown.numberHedgeTrades.total}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase block">Hit Rate</span>
                <span className="text-sm font-bold text-purple-300 font-mono">
                  {perf.breakdown.numberHedgeTrades.winRate.toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase block">Net P&L</span>
                <span className={`text-sm font-bold font-mono ${perf.breakdown.numberHedgeTrades.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {perf.breakdown.numberHedgeTrades.netProfit >= 0 ? '+' : ''}
                  {formatCurrency(perf.breakdown.numberHedgeTrades.netProfit)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trade Journal & Chronological Ledger */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              Chronological Trade Journal & Execution Ledger
            </h3>
            <p className="text-xs text-slate-400">
              Complete round-by-round ledger with stake allocation, actual outcomes, and running capital
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            {(['ALL', 'WINS', 'LOSSES', 'SIZE', 'COLOUR'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setJournalFilter(filter)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                  journalFilter === filter
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Round</th>
                <th className="py-3 px-3">Market</th>
                <th className="py-3 px-3">Signal</th>
                <th className="py-3 px-3">Actual Draw</th>
                <th className="py-3 px-3">Stake</th>
                <th className="py-3 px-3">Outcome</th>
                <th className="py-3 px-4 text-right">Net P&L</th>
                <th className="py-3 px-4 text-right">Running Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850 divide-slate-800/40">
              {filteredTrades.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No trades match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredTrades.map((t) => (
                  <tr key={t.roundId} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-300">
                      #{t.roundId}
                    </td>

                    <td className="py-3 px-3">
                      <span className="text-slate-400 uppercase font-mono text-[10px]">
                        {t.market}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${getTargetPill(t.market, t.selection)}`}>
                        BUY {t.selection}
                      </span>
                    </td>

                    <td className="py-3 px-3 font-mono font-bold text-slate-200">
                      {t.actualOutcome}
                    </td>

                    <td className="py-3 px-3 font-mono text-slate-300">
                      {formatCurrency(t.stakedAmount)}
                      <span className="text-[10px] text-slate-400 ml-1">
                        (S{t.martingaleStage})
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      {t.isWin ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded text-[11px]">
                          <CheckCircle2 className="w-3 h-3" />
                          WIN
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-400 font-bold bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded text-[11px]">
                          <XCircle className="w-3 h-3" />
                          LOSS
                        </span>
                      )}
                    </td>

                    <td className={`py-3 px-4 text-right font-mono font-bold ${t.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {t.netProfit >= 0 ? '+' : ''}
                      {formatCurrency(t.netProfit)}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-100">
                      {formatCurrency(t.runningEquity)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quantitative Risk Management & Capital Preservation Rules */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          Quantitative Risk Management & Staking Discipline
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-950/60 border border-slate-800/60 p-3 rounded-xl space-y-1">
            <span className="text-emerald-400 font-bold block">1. Strict 3-Stage Cap</span>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              Never exceed 3 consecutive martingale levels (1x -&gt; 2.5x -&gt; 6.5x). Automatic stop-loss resets to Stage 1 on miss.
            </p>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/60 p-3 rounded-xl space-y-1">
            <span className="text-emerald-400 font-bold block">2. Dragon Streak Protocol</span>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              When 4+ consecutive identical outcomes appear, ride with the trend. Never attempt counter-trend martingales against dragons.
            </p>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/60 p-3 rounded-xl space-y-1">
            <span className="text-emerald-400 font-bold block">3. Dual-Number Hedge Ratio</span>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              Allocate maximum 0.5 units total between primary and backup numbers to secure 9x windfall without eroding edge.
            </p>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/60 p-3 rounded-xl space-y-1">
            <span className="text-emerald-400 font-bold block">4. Daily Stop-Loss / Take-Profit</span>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              Lock in profits at +20% ROI. Terminate session if drawdown hits 15% to maintain long-term positive mathematical expectation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
