import React, { useState, useEffect } from 'react';
import {
  AdminDashboardData,
  AnalyticsSummary,
  GameColour,
  GameSize,
  License,
  User,
  getWingoActiveRoundId,
} from '../types';
import { api } from '../api';
import {
  Shield,
  Key,
  Users,
  Database,
  BarChart3,
  Hash,
  Sliders,
  Upload,
  PlusCircle,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Radio,
  Play,
  FileSpreadsheet,
  Layers,
  Sparkles,
  Award,
  Copy,
  Check,
  Shuffle,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  Legend,
} from 'recharts';

interface AdminPanelProps {
  onDataChanged: () => void;
}

type AdminSubTab =
  | 'overview'
  | 'results'
  | 'predictions'
  | 'licenses'
  | 'users'
  | 'analytics'
  | 'number_analytics'
  | 'settings';

export const AdminPanel: React.FC<AdminPanelProps> = ({ onDataChanged }) => {
  const [activeTab, setActiveTab] = useState<AdminSubTab>('overview');
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Manual Result Form
  const [roundId, setRoundId] = useState('');
  const [numVal, setNumVal] = useState<number | ''>('');
  const [colourVal, setColourVal] = useState<GameColour | ''>('');
  const [sizeVal, setSizeVal] = useState<GameSize | ''>('');

  // Admin Prediction Form
  const [adminPredRoundId, setAdminPredRoundId] = useState('');
  const [adminPredColour, setAdminPredColour] = useState<GameColour | ''>('');
  const [adminPredSize, setAdminPredSize] = useState<GameSize | ''>('');
  const [adminPredNumber, setAdminPredNumber] = useState<number | ''>('');

  // License Generator Form
  const [licUsername, setLicUsername] = useState('');
  const [licDays, setLicDays] = useState(30);
  const [licNotes, setLicNotes] = useState('');
  const [licenseSearch, setLicenseSearch] = useState('');
  const [licenses, setLicenses] = useState<License[]>([]);
  const [lastCreatedLicense, setLastCreatedLicense] = useState<{ username: string; key: string; expiresAt: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Users
  const [userList, setUserList] = useState<User[]>([]);

  // CSV Import
  const [csvContent, setCsvContent] = useState('');
  const [csvStats, setCsvStats] = useState<{ imported: number; rejected: number; duplicates: number; errors: string[] } | null>(null);

  // Config settings
  const [minValidationSamples, setMinValidationSamples] = useState(200);
  const [activationAccuracy, setActivationAccuracy] = useState(80);
  const [roundInterval, setRoundInterval] = useState(30);
  const [autoDrawEnabled, setAutoDrawEnabled] = useState(true);
  const [isDevMode, setIsDevMode] = useState(false);
  const [isDrawingNow, setIsDrawingNow] = useState(false);
  const [wingoFeed, setWingoFeed] = useState<any>(null);
  const [isSyncingWingo, setIsSyncingWingo] = useState(false);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminDashboard();
      setData(res);
      setIsDevMode(res.overview.systemStatus.isDevMode);
      setMinValidationSamples(res.config.minNumberValidationSamples);
      setActivationAccuracy(Math.round(res.config.numberActivationAccuracy * 100));
      setRoundInterval(res.config.roundIntervalSeconds || 30);
      setAutoDrawEnabled(res.config.autoDrawEnabled !== false);

      try {
        const wingo = await api.getWingoStatus();
        setWingoFeed(wingo);
      } catch {
        // ignore
      }

      const licRes = await api.getAdminLicenses();
      setLicenses(licRes.licenses);

      const usrRes = await api.getAdminUsers();
      setUserList(usrRes.users);

      // Pre-fill next round ID for convenience
      if (res.overview.totalResults > 0) {
        const lastRoundId = res.overview.systemStatus.lastResult?.split(' ')[0] || getWingoActiveRoundId();
        try {
          const next = (BigInt(lastRoundId) + 1n).toString();
          setRoundId(next);
          setAdminPredRoundId(next);
        } catch {
          // ignore
        }
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to load admin dashboard' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const showNotify = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // When number is entered in manual result, auto-suggest colour & size based on game config
  const handleNumberChange = (val: number) => {
    setNumVal(val);
    if (data?.config) {
      const suggestedCol = data.config.numberToColourMap[val];
      const suggestedSize = data.config.numberToSizeMap[val];
      if (suggestedCol) setColourVal(suggestedCol);
      if (suggestedSize) setSizeVal(suggestedSize);
    }
  };

  // Manual Result Submission
  const handleResultSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roundId.trim() || numVal === '') {
      showNotify('error', 'Round ID and Number are required.');
      return;
    }

    try {
      const res = await api.submitResult({
        roundId: roundId.trim(),
        number: Number(numVal),
        colour: colourVal || undefined,
        size: sizeVal || undefined,
      });
      showNotify('success', `Round #${res.result.roundId} result processed! Next predictions generated.`);
      setNumVal('');
      try {
        const next = (BigInt(roundId) + 1n).toString();
        setRoundId(next);
        setAdminPredRoundId(next);
      } catch {
        // ignore
      }
      fetchDashboard();
      onDataChanged();
    } catch (err: any) {
      showNotify('error', err.message);
    }
  };

  const handleSyncWingo = async () => {
    setIsSyncingWingo(true);
    try {
      const res = await api.syncWingoFeed();
      showNotify('success', `WinGo 1M feed synced! Ingested ${res.newItemsCount} new draw periods.`);
      setWingoFeed(res.feedStatus);
      fetchDashboard();
      onDataChanged();
    } catch (err: any) {
      showNotify('error', `WinGo sync error: ${err.message}`);
    } finally {
      setIsSyncingWingo(false);
    }
  };

  const handleToggleWingoAutoSync = async (enabled: boolean) => {
    try {
      const res = await api.toggleWingoAutoSync(enabled);
      showNotify('success', `WinGo auto-sync ${enabled ? 'enabled' : 'paused'}.`);
      setWingoFeed(res.feedStatus);
    } catch (err: any) {
      showNotify('error', err.message);
    }
  };

  // Admin Prediction Submission
  const handleAdminPredictionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPredRoundId.trim()) {
      showNotify('error', 'Round ID is required.');
      return;
    }

    try {
      await api.submitAdminPrediction({
        roundId: adminPredRoundId.trim(),
        colour: adminPredColour || undefined,
        size: adminPredSize || undefined,
        number: adminPredNumber !== '' ? Number(adminPredNumber) : undefined,
      });
      showNotify('success', `Admin manual prediction saved for Round #${adminPredRoundId}`);
      fetchDashboard();
    } catch (err: any) {
      showNotify('error', err.message);
    }
  };

  // License generation
  const handleGenerateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licUsername.trim()) {
      showNotify('error', 'Username is required.');
      return;
    }

    try {
      const res = await api.createLicense(licUsername.trim(), licDays, licNotes);
      showNotify('success', `Generated new key: ${res.license.key}`);
      setLastCreatedLicense({
        username: res.license.username,
        key: res.license.key,
        expiresAt: res.license.expiresAt,
      });
      setLicUsername('');
      setLicNotes('');
      fetchDashboard();
    } catch (err: any) {
      showNotify('error', err.message);
    }
  };

  const handleUpdateLicenseStatus = async (id: string, status: string) => {
    try {
      await api.updateLicense(id, { status });
      showNotify('success', `License status updated to ${status}`);
      fetchDashboard();
    } catch (err: any) {
      showNotify('error', err.message);
    }
  };

  const handleExtendLicense = async (id: string, currentExpires: string) => {
    try {
      const current = new Date(currentExpires).getTime();
      const base = current > Date.now() ? current : Date.now();
      const newExp = new Date(base + 30 * 86400000).toISOString();
      await api.updateLicense(id, { expiresAt: newExp, status: 'ACTIVE' });
      showNotify('success', 'License extended by 30 days and activated.');
      fetchDashboard();
    } catch (err: any) {
      showNotify('error', err.message);
    }
  };

  const handleDeleteLicense = async (id: string) => {
    if (!confirm('Are you sure you want to delete this license?')) return;
    try {
      await api.deleteLicense(id);
      showNotify('success', 'License removed successfully.');
      fetchDashboard();
    } catch (err: any) {
      showNotify('error', err.message);
    }
  };

  const handleToggleUser = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    try {
      await api.updateUserStatus(id, nextStatus);
      showNotify('success', `User status updated to ${nextStatus}`);
      fetchDashboard();
    } catch (err: any) {
      showNotify('error', err.message);
    }
  };

  // Retrain & Backtest
  const handleRetrain = async () => {
    setLoading(true);
    try {
      const res = await api.retrainModels();
      showNotify('success', res.message);
      fetchDashboard();
      onDataChanged();
    } catch (err: any) {
      showNotify('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // CSV Import
  const handleCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvContent.trim()) {
      showNotify('error', 'Please provide CSV content.');
      return;
    }

    try {
      const res = await api.importCsv(csvContent);
      setCsvStats(res);
      showNotify('success', `Import complete: ${res.imported} results added.`);
      setCsvContent('');
      fetchDashboard();
      onDataChanged();
    } catch (err: any) {
      showNotify('error', err.message);
    }
  };

  // Config Update
  const handleConfigSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateAdminConfig({
        minNumberValidationSamples: minValidationSamples,
        numberActivationAccuracy: activationAccuracy / 100,
        roundIntervalSeconds: roundInterval,
        autoDrawEnabled,
      });
      showNotify('success', 'Game configuration and timer settings saved successfully.');
      fetchDashboard();
      onDataChanged();
    } catch (err: any) {
      showNotify('error', err.message);
    }
  };

  const handleDrawNow = async () => {
    setIsDrawingNow(true);
    try {
      const res = await api.drawNow();
      showNotify('success', `Instant draw executed! Active round #${res.activeRoundId}`);
      fetchDashboard();
      onDataChanged();
    } catch (err: any) {
      showNotify('error', err.message);
    } finally {
      setIsDrawingNow(false);
    }
  };

  // Dev sample generator
  const handleGenerateDevSample = async (count: number, forceHigh = false) => {
    try {
      const res = await api.generateSample(count, forceHigh);
      showNotify('success', `Generated ${res.generatedCount} test rounds.`);
      fetchDashboard();
      onDataChanged();
    } catch (err: any) {
      showNotify('error', err.message);
    }
  };

  const handleToggleDevMode = async () => {
    try {
      const res = await api.toggleDevMode(!isDevMode);
      setIsDevMode(res.isDevMode);
      showNotify('success', `Development Mode ${res.isDevMode ? 'Enabled' : 'Disabled'}`);
      fetchDashboard();
      onDataChanged();
    } catch (err: any) {
      showNotify('error', err.message);
    }
  };

  const overview = data?.overview;
  const analytics = data?.analytics;

  const filteredLicenses = licenses.filter(
    (l) =>
      l.key.toLowerCase().includes(licenseSearch.toLowerCase()) ||
      l.username.toLowerCase().includes(licenseSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-6 text-slate-100">
      {/* Top Banner with Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold font-['Chakra_Petch',sans-serif] text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-400" />
            Admin Command Center
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            System health, model calibration, live manual result entry, and license governance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchDashboard}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {notification && (
        <div
          className={`p-3.5 rounded-xl text-xs font-medium flex items-center justify-between border ${
            notification.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-white">
            &times;
          </button>
        </div>
      )}

      {/* Admin Navigation Pills */}
      <div className="flex flex-wrap gap-1.5 p-1 bg-slate-900/90 rounded-xl border border-slate-800">
        {[
          { id: 'overview', label: 'Dashboard Overview', icon: BarChart3 },
          { id: 'results', label: 'Manual Result Entry & CSV', icon: Database },
          { id: 'predictions', label: 'Admin Predictions', icon: Award },
          { id: 'licenses', label: 'Licenses', icon: Key },
          { id: 'users', label: 'Users', icon: Users },
          { id: 'analytics', label: 'Model Analytics', icon: Layers },
          { id: 'number_analytics', label: 'Number Analytics', icon: Hash },
          { id: 'settings', label: 'Engine Settings & Dev', icon: Sliders },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`tab-admin-${tab.id}`}
              onClick={() => setActiveTab(tab.id as AdminSubTab)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ============================================================ */}
      {/* TAB 1: OVERVIEW / DASHBOARD                                   */}
      {/* ============================================================ */}
      {activeTab === 'overview' && overview && (
        <div className="space-y-6">
          {/* Main Key Statistics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5">
              <span className="text-[10px] text-slate-400 font-semibold uppercase block">Total Users</span>
              <span className="text-xl font-mono font-bold text-white mt-1 block">{overview.totalUsers}</span>
              <span className="text-[10px] text-emerald-400 font-medium mt-1 block">{overview.activeUsers} Active</span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5">
              <span className="text-[10px] text-slate-400 font-semibold uppercase block">Active Licenses</span>
              <span className="text-xl font-mono font-bold text-emerald-400 mt-1 block">{overview.activeLicenses}</span>
              <span className="text-[10px] text-slate-500 font-medium mt-1 block">
                {overview.expiredLicenses} Exp / {overview.suspendedLicenses} Susp
              </span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5">
              <span className="text-[10px] text-slate-400 font-semibold uppercase block">Total Results</span>
              <span className="text-xl font-mono font-bold text-white mt-1 block">{overview.totalResults}</span>
              <span className="text-[10px] text-slate-500 font-medium mt-1 block">{overview.totalPredictions} Preds</span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5">
              <span className="text-[10px] text-slate-400 font-semibold uppercase block">Colour Accuracy</span>
              <span className="text-xl font-mono font-bold text-rose-400 mt-1 block">
                {(overview.colourAccuracy * 100).toFixed(1)}%
              </span>
              <span className="text-[10px] text-slate-500 font-medium mt-1 block">Walk-Forward Validated</span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5">
              <span className="text-[10px] text-slate-400 font-semibold uppercase block">Big/Small Accuracy</span>
              <span className="text-xl font-mono font-bold text-sky-400 mt-1 block">
                {(overview.sizeAccuracy * 100).toFixed(1)}%
              </span>
              <span className="text-[10px] text-slate-500 font-medium mt-1 block">Walk-Forward Validated</span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5">
              <span className="text-[10px] text-slate-400 font-semibold uppercase block">Number Accuracy</span>
              <span className="text-xl font-mono font-bold text-purple-400 mt-1 block">
                {(overview.numberAccuracy * 100).toFixed(1)}%
              </span>
              <span
                className={`text-[10px] font-bold mt-1 block ${
                  overview.numberPredictionStatus === 'ACTIVE' ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                Status: {overview.numberPredictionStatus}
              </span>
            </div>
          </div>

          {/* System Status Indicators */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400" />
              Engine & Worker Operational Status
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <span className="text-slate-400 block text-[10px] uppercase">Prediction Engine</span>
                <span className="font-bold text-emerald-400 mt-1 block flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  {overview.systemStatus.predictionEngine}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <span className="text-slate-400 block text-[10px] uppercase">Database</span>
                <span className="font-bold text-emerald-400 mt-1 block flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  {overview.systemStatus.database}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <span className="text-slate-400 block text-[10px] uppercase">Background Worker</span>
                <span className="font-bold text-emerald-400 mt-1 block flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  {overview.systemStatus.worker}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <span className="text-slate-400 block text-[10px] uppercase">Number Model Status</span>
                <span
                  className={`font-bold mt-1 block ${
                    overview.numberPredictionStatus === 'ACTIVE' ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {overview.numberPredictionStatus}
                </span>
              </div>
            </div>
          </div>

          {/* WinGo 1M Live Feed Integration & Polling Status */}
          <div className="bg-slate-900/90 border border-indigo-900/50 rounded-2xl p-5 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <Radio className="w-5 h-5 text-indigo-400 animate-pulse" />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      WinGo 1M Official API Live Ingestion
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      ADMIN ONLY
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      {wingoFeed?.status === 'ONLINE' ? 'ONLINE' : 'CONNECTING'}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">
                    Background automated poller ingests every new period draw from the official provider. Restricted to admin controls.
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="btn-admin-sync-wingo"
                  onClick={handleSyncWingo}
                  disabled={isSyncingWingo}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-50 shadow-md cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingWingo ? 'animate-spin' : ''}`} />
                  {isSyncingWingo ? 'Syncing...' : 'Poll WinGo Now'}
                </button>

                {wingoFeed && (
                  <button
                    id="btn-admin-toggle-wingo"
                    onClick={() => handleToggleWingoAutoSync(!wingoFeed.autoSyncEnabled)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      wingoFeed.autoSyncEnabled
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                    }`}
                  >
                    Auto-Sync: {wingoFeed.autoSyncEnabled ? 'ENABLED' : 'PAUSED'}
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs bg-slate-950/60 rounded-xl p-3 border border-slate-800">
              <div className="sm:col-span-2">
                <span className="text-slate-400 block text-[10px] uppercase">Official Feed API Endpoint</span>
                <span className="font-mono text-indigo-300 text-[11px] break-all block mt-0.5 select-all" title="https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json">
                  https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Latest Feed Issue</span>
                <span className="font-mono font-bold text-emerald-400 block mt-0.5">
                  #{wingoFeed?.latestIssueNumber || 'Syncing...'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Active Predict Round</span>
                <span className="font-mono font-bold text-purple-400 block mt-0.5">
                  #{wingoFeed?.activeRoundId || data?.activeRoundId || '---'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Total Periods Ingested</span>
                <span className="font-mono font-bold text-white block mt-0.5">
                  {wingoFeed?.syncedCount || 0} draws
                </span>
              </div>
            </div>
          </div>

          {/* Audit Logs */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <h3 className="text-sm font-bold text-white mb-3">Recent Security & Activity Audit Log</h3>
            <div className="max-h-52 overflow-y-auto divide-y divide-slate-800 text-xs font-mono">
              {data?.auditLogs.slice(0, 8).map((log) => (
                <div key={log.id} className="py-2 flex items-center justify-between gap-3 text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-purple-400 font-bold">[{log.action}]</span>
                    <span>{log.details}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: MANUAL RESULT ENTRY & CSV IMPORT                       */}
      {/* ============================================================ */}
      {activeTab === 'results' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Manual Entry Form */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-base font-bold text-white font-['Chakra_Petch',sans-serif] mb-1 flex items-center gap-2">
              <Database className="w-4 h-4 text-rose-400" />
              Manual Result Submission
            </h3>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              Submitting evaluates pending predictions, recalculates walk-forward accuracy, updates ensemble weights, and broadcasts the next round prediction.
            </p>

            <form onSubmit={handleResultSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Round ID
                </label>
                <input
                  id="input-admin-round-id"
                  type="text"
                  value={roundId}
                  onChange={(e) => setRoundId(e.target.value)}
                  placeholder="e.g. 20260908222"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Result Number (0 - 9)
                </label>
                <div className="grid grid-cols-5 gap-1.5 mb-2">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => handleNumberChange(n)}
                      className={`py-2 rounded-lg font-mono font-bold text-sm border transition-all ${
                        numVal === n
                          ? 'bg-rose-600 border-rose-500 text-white shadow-lg'
                          : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Colour (Config Auto-Mapped)
                  </label>
                  <select
                    id="select-admin-colour"
                    value={colourVal}
                    onChange={(e) => setColourVal(e.target.value as GameColour)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="">Auto-Detect from Mapping</option>
                    <option value="RED">RED</option>
                    <option value="GREEN">GREEN</option>
                    <option value="VIOLET">VIOLET</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Size (Config Auto-Mapped)
                  </label>
                  <select
                    id="select-admin-size"
                    value={sizeVal}
                    onChange={(e) => setSizeVal(e.target.value as GameSize)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="">Auto-Detect from Mapping</option>
                    <option value="BIG">BIG (5-9)</option>
                    <option value="SMALL">SMALL (0-4)</option>
                  </select>
                </div>
              </div>

              <button
                id="btn-submit-result"
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-400 hover:to-indigo-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-rose-500/20 transition-all flex items-center justify-center gap-2"
              >
                <PlusCircle className="w-4 h-4" />
                Commit Result & Broadcast Prediction
              </button>
            </form>
          </div>

          {/* CSV Import */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-white font-['Chakra_Petch',sans-serif] mb-1 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                Historical CSV Import
              </h3>
              <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                Import bulk historical rounds. Expected format:
                <code className="text-emerald-400 ml-1 font-mono">roundId,number,colour,size,timestamp</code>
              </p>

              <textarea
                id="textarea-csv-import"
                rows={6}
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                placeholder="20260908301,7,GREEN,BIG,2026-09-08T12:00:00Z&#10;20260908302,2,RED,SMALL,2026-09-08T12:01:00Z"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />

              {csvStats && (
                <div className="mt-3 p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs">
                  <div className="flex gap-4 font-bold">
                    <span className="text-emerald-400">Imported: {csvStats.imported}</span>
                    <span className="text-rose-400">Rejected: {csvStats.rejected}</span>
                    <span className="text-amber-400">Duplicates: {csvStats.duplicates}</span>
                  </div>
                  {csvStats.errors.length > 0 && (
                    <div className="mt-2 text-rose-300 text-[11px] max-h-20 overflow-y-auto">
                      {csvStats.errors.slice(0, 3).map((e, idx) => (
                        <div key={idx}>{e}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              id="btn-import-csv"
              type="button"
              onClick={handleCsvImport}
              className="w-full mt-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Process CSV & Run Walk-Forward Validation
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: ADMIN PREDICTIONS (SEPARATE FROM AI)                   */}
      {/* ============================================================ */}
      {activeTab === 'predictions' && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-base font-bold text-white font-['Chakra_Petch',sans-serif] mb-1 flex items-center gap-2">
              <Award className="w-4 h-4 text-purple-400" />
              Manual Admin Prediction Desk
            </h3>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              Admin predictions are tracked completely separately from AI predictions. The system records your personal accuracy independently.
            </p>

            <form onSubmit={handleAdminPredictionSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Round ID
                </label>
                <input
                  type="text"
                  value={adminPredRoundId}
                  onChange={(e) => setAdminPredRoundId(e.target.value)}
                  placeholder="e.g. 20260908222"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-white focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Predict Colour
                </label>
                <select
                  value={adminPredColour}
                  onChange={(e) => setAdminPredColour(e.target.value as GameColour)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">None</option>
                  <option value="RED">RED</option>
                  <option value="GREEN">GREEN</option>
                  <option value="VIOLET">VIOLET</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Predict Size
                </label>
                <select
                  value={adminPredSize}
                  onChange={(e) => setAdminPredSize(e.target.value as GameSize)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">None</option>
                  <option value="BIG">BIG</option>
                  <option value="SMALL">SMALL</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Predict Number (0-9)
                </label>
                <input
                  type="number"
                  min={0}
                  max={9}
                  value={adminPredNumber}
                  onChange={(e) => setAdminPredNumber(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  placeholder="0 - 9"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="sm:col-span-4">
                <button
                  type="submit"
                  className="py-2.5 px-5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-sm transition-all shadow-md"
                >
                  Save Manual Admin Prediction
                </button>
              </div>
            </form>
          </div>

          {/* Admin Accuracy Stats & Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <h4 className="text-sm font-bold text-white mb-3">Admin Prediction Performance</h4>
            <div className="grid grid-cols-3 gap-3 mb-4 text-center">
              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700">
                <span className="text-[10px] text-slate-400 block uppercase">Admin Colour Accuracy</span>
                <span className="text-lg font-mono font-bold text-rose-400">
                  {((analytics?.adminStats.colourAccuracy || 0) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700">
                <span className="text-[10px] text-slate-400 block uppercase">Admin Size Accuracy</span>
                <span className="text-lg font-mono font-bold text-sky-400">
                  {((analytics?.adminStats.sizeAccuracy || 0) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700">
                <span className="text-[10px] text-slate-400 block uppercase">Admin Number Accuracy</span>
                <span className="text-lg font-mono font-bold text-purple-400">
                  {((analytics?.adminStats.numberAccuracy || 0) * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase">
                    <th className="py-2 px-2">Round</th>
                    <th className="py-2 px-2">Admin Colour</th>
                    <th className="py-2 px-2">Admin Size</th>
                    <th className="py-2 px-2">Admin Number</th>
                    <th className="py-2 px-2">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {data?.adminPredictions.map((a) => (
                    <tr key={a.id}>
                      <td className="py-2 px-2 text-purple-300">#{a.roundId}</td>
                      <td className="py-2 px-2">
                        {a.colour ? `${a.colour} (${a.colourStatus})` : '---'}
                      </td>
                      <td className="py-2 px-2">
                        {a.size ? `${a.size} (${a.sizeStatus})` : '---'}
                      </td>
                      <td className="py-2 px-2">
                        {a.number !== undefined ? `${a.number} (${a.numberStatus})` : '---'}
                      </td>
                      <td className="py-2 px-2 text-slate-500">
                        {new Date(a.createdAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 4: LICENSE MANAGEMENT                                     */}
      {/* ============================================================ */}
      {activeTab === 'licenses' && (
        <div className="space-y-6">
          {/* Generator */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="text-base font-bold text-white font-['Chakra_Petch',sans-serif] flex items-center gap-2">
                <Key className="w-4 h-4 text-purple-400" />
                Generate New VIP Client License & Credentials
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                ADMIN ONLY GENERATOR
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              All credentials and keys are issued solely here. Keys created below can immediately be provided to clients to log into the VIP lobby.
            </p>

            <form onSubmit={handleGenerateLicense} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-300 uppercase">
                    Target Username
                  </label>
                  <button
                    type="button"
                    onClick={() => setLicUsername(`vip_trader_${Math.floor(1000 + Math.random() * 9000)}`)}
                    className="text-[10px] text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <Shuffle className="w-2.5 h-2.5" />
                    Auto-generate
                  </button>
                </div>
                <input
                  type="text"
                  value={licUsername}
                  onChange={(e) => setLicUsername(e.target.value)}
                  placeholder="e.g. trader_vip or click auto-generate"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Duration (Days)
                </label>
                <input
                  type="number"
                  min={1}
                  value={licDays}
                  onChange={(e) => setLicDays(parseInt(e.target.value, 10) || 30)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Notes / Client Label
                </label>
                <input
                  type="text"
                  value={licNotes}
                  onChange={(e) => setLicNotes(e.target.value)}
                  placeholder="Optional client note"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs transition-all shadow cursor-pointer active:scale-98"
                >
                  Generate VIP License Key
                </button>
              </div>
            </form>

            {/* Newly Generated License Banner with 1-Click Copy */}
            {lastCreatedLicense && (
              <div className="mt-4 p-4 rounded-xl bg-purple-950/60 border border-purple-500/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg animate-in fade-in duration-300">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300 block">
                    ✨ Newly Generated VIP Credentials
                  </span>
                  <div className="flex flex-wrap items-center gap-3 mt-1.5 font-mono text-xs">
                    <span className="text-slate-300">Username: <strong className="text-white font-bold">{lastCreatedLicense.username}</strong></span>
                    <span className="text-slate-500">|</span>
                    <span className="text-slate-300">Key: <strong className="text-purple-300 font-bold select-all bg-purple-900/60 px-1.5 py-0.5 rounded">{lastCreatedLicense.key}</strong></span>
                    <span className="text-slate-500">|</span>
                    <span className="text-slate-400">Expires: {new Date(lastCreatedLicense.expiresAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`Username: ${lastCreatedLicense.username}\nLicense Key: ${lastCreatedLicense.key}`);
                    setCopiedKey(true);
                    setTimeout(() => setCopiedKey(false), 2000);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer shrink-0"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey ? 'Copied Credentials!' : 'Copy Credentials'}
                </button>
              </div>
            )}
          </div>

          {/* License List */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h4 className="text-sm font-bold text-white">Active License Registry</h4>
              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={licenseSearch}
                  onChange={(e) => setLicenseSearch(e.target.value)}
                  placeholder="Search license or user..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold">
                    <th className="py-2.5 px-3">License Key</th>
                    <th className="py-2.5 px-3">Username</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Expires</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {filteredLicenses.map((lic) => {
                    const isExpired = new Date(lic.expiresAt).getTime() < Date.now();
                    return (
                      <tr key={lic.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-3 font-bold text-purple-300 select-all">
                          {lic.key}
                        </td>
                        <td className="py-3 px-3 text-slate-200 font-sans">
                          {lic.username}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              lic.status === 'ACTIVE'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : lic.status === 'SUSPENDED'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-rose-500/20 text-rose-400'
                            }`}
                          >
                            {isExpired ? 'EXPIRED' : lic.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-400 text-[11px]">
                          {new Date(lic.expiresAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-3 text-right space-x-1 font-sans">
                          {lic.status === 'ACTIVE' ? (
                            <button
                              onClick={() => handleUpdateLicenseStatus(lic.id, 'SUSPENDED')}
                              className="px-2 py-1 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-[10px]"
                            >
                              Suspend
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUpdateLicenseStatus(lic.id, 'ACTIVE')}
                              className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-[10px]"
                            >
                              Activate
                            </button>
                          )}

                          <button
                            onClick={() => handleExtendLicense(lic.id, lic.expiresAt)}
                            className="px-2 py-1 rounded bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 text-[10px]"
                          >
                            +30d
                          </button>

                          <button
                            onClick={() => handleUpdateLicenseStatus(lic.id, 'REVOKED')}
                            className="px-2 py-1 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-[10px]"
                          >
                            Revoke
                          </button>

                          <button
                            onClick={() => handleDeleteLicense(lic.id)}
                            className="px-2 py-1 rounded bg-slate-800 text-slate-400 hover:text-rose-400 text-[10px]"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 5: USER MANAGEMENT                                        */}
      {/* ============================================================ */}
      {activeTab === 'users' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <h3 className="text-base font-bold text-white font-['Chakra_Petch',sans-serif] mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
            Registered User Directory
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold">
                  <th className="py-2.5 px-3">Username</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">License Key</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Last Login</th>
                  <th className="py-2.5 px-3 text-right">Account Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-medium">
                {userList.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-3 font-bold text-white">{u.username}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-400 text-[11px]">{u.licenseKey}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.status === 'ACTIVE'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-400 text-[11px]">
                      {new Date(u.lastLoginAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => handleToggleUser(u.id, u.status)}
                        className={`px-2.5 py-1 rounded text-xs font-semibold ${
                          u.status === 'ACTIVE'
                            ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                        }`}
                      >
                        {u.status === 'ACTIVE' ? 'Disable Access' : 'Enable Access'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 6: MODEL ANALYTICS & MONITORING                           */}
      {/* ============================================================ */}
      {activeTab === 'analytics' && analytics && (
        <div className="space-y-6">
          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                Chronological Walk-Forward Model Retraining
              </h3>
              <p className="text-xs text-slate-400">
                Re-evaluates every prediction strictly against subsequent actual outcomes without lookahead bias.
              </p>
            </div>

            <button
              onClick={handleRetrain}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Re-Train & Backtest All Models
            </button>
          </div>

          {/* Rolling Accuracy Chart */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <h4 className="text-sm font-bold text-white mb-4">
              Rolling Out-of-Sample Accuracy Windows
            </h4>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: 'Last 25', Colour: analytics.rolling.last25.colour * 100, 'Big/Small': analytics.rolling.last25.size * 100, Number: analytics.rolling.last25.number * 100 },
                    { name: 'Last 50', Colour: analytics.rolling.last50.colour * 100, 'Big/Small': analytics.rolling.last50.size * 100, Number: analytics.rolling.last50.number * 100 },
                    { name: 'Last 100', Colour: analytics.rolling.last100.colour * 100, 'Big/Small': analytics.rolling.last100.size * 100, Number: analytics.rolling.last100.number * 100 },
                    { name: 'Last 200', Colour: analytics.rolling.last200.colour * 100, 'Big/Small': analytics.rolling.last200.size * 100, Number: analytics.rolling.last200.number * 100 },
                    { name: 'Last 500', Colour: analytics.rolling.last500.colour * 100, 'Big/Small': analytics.rolling.last500.size * 100, Number: analytics.rolling.last500.number * 100 },
                  ]}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#64748b" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                    formatter={(val: any) => [`${Number(val).toFixed(1)}%`]}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="Colour" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Big/Small" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Number" fill="#a855f7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Accuracy by Confidence Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(['HIGH', 'MEDIUM', 'LOW'] as const).map((conf) => (
              <div key={conf} className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
                <span className="text-xs font-bold uppercase text-slate-400 block mb-1">
                  Confidence: {conf}
                </span>
                <span className="text-2xl font-mono font-extrabold text-white block">
                  {(analytics.byConfidence[conf].accuracy * 100).toFixed(1)}%
                </span>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  {analytics.byConfidence[conf].count} Evaluated Samples
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 7: DEDICATED NUMBER PREDICTION ANALYTICS                 */}
      {/* ============================================================ */}
      {activeTab === 'number_analytics' && analytics && (
        <div className="space-y-6">
          {/* Status Header Box */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                  Number Model Activation Monitor
                </span>
                <h3 className="text-2xl font-bold font-['Chakra_Petch',sans-serif] text-white mt-0.5 flex items-center gap-3">
                  Status:
                  <span
                    className={`px-3 py-1 rounded-xl text-sm font-bold border ${
                      analytics.numberAnalytics.status === 'ACTIVE'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}
                  >
                    {analytics.numberAnalytics.status}
                  </span>
                </h3>
              </div>

              {/* Requirement Checklist */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1.5 font-mono">
                <div className="flex items-center gap-2">
                  {analytics.numberAnalytics.validationSamples >= (data?.config.minNumberValidationSamples || 200) ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span>
                    Validation Samples: {analytics.numberAnalytics.validationSamples} / {data?.config.minNumberValidationSamples || 200}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {analytics.numberAnalytics.overallAccuracy > (data?.config.numberActivationAccuracy || 0.80) ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span>
                    Overall Accuracy: {(analytics.numberAnalytics.overallAccuracy * 100).toFixed(1)}% (Req &gt;{Math.round((data?.config.numberActivationAccuracy || 0.8) * 100)}%)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {analytics.numberAnalytics.rolling100Accuracy > (data?.config.numberActivationAccuracy || 0.80) ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span>
                    Rolling 100 Accuracy: {(analytics.numberAnalytics.rolling100Accuracy * 100).toFixed(1)}% (Req &gt;{Math.round((data?.config.numberActivationAccuracy || 0.8) * 100)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Number 10x10 Confusion Matrix */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <h4 className="text-sm font-bold text-white mb-1">
              Number Confusion Matrix (10x10 Heatmap: Actual vs Predicted)
            </h4>
            <p className="text-xs text-slate-400 mb-4">
              Row: Actual Result Digit (0-9) | Column: Predicted Digit (0-9). Diagonal elements represent Exact Match Hits.
            </p>

            <div className="overflow-x-auto">
              <div className="inline-block min-w-full">
                <div className="grid grid-cols-11 gap-1 text-center font-mono text-xs">
                  <div className="p-2 font-bold text-slate-500">Act\Pred</div>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((col) => (
                    <div key={col} className="p-2 font-bold text-purple-300 bg-slate-800/60 rounded">
                      P-{col}
                    </div>
                  ))}

                  {analytics.numberAnalytics.confusionMatrix.map((row, actIdx) => (
                    <React.Fragment key={actIdx}>
                      <div className="p-2 font-bold text-slate-400 bg-slate-800/40 rounded flex items-center justify-center">
                        A-{actIdx}
                      </div>
                      {row.map((val, predIdx) => {
                        const isDiagonal = actIdx === predIdx;
                        const intensity = val > 5 ? 'bg-purple-600/70 text-white font-bold' : val > 0 ? (isDiagonal ? 'bg-emerald-600/50 text-white' : 'bg-slate-800/40 text-slate-300') : 'bg-slate-950 text-slate-600';
                        return (
                          <div
                            key={predIdx}
                            className={`p-2 rounded flex items-center justify-center transition-all ${intensity}`}
                            title={`Actual: ${actIdx}, Predicted: ${predIdx}, Count: ${val}`}
                          >
                            {val}
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Actual Frequency of Each Number */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <h4 className="text-sm font-bold text-white mb-4">
              Distribution & Hit-Rate By Digit (0-9)
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
                const stat = analytics.byNumber[n] || { actualCount: 0, predictedCount: 0, correctCount: 0, accuracy: 0 };
                return (
                  <div key={n} className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/60">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-mono font-bold text-purple-400">Digit {n}</span>
                      <span className="text-xs font-mono text-slate-400">{stat.actualCount} times</span>
                    </div>
                    <div className="mt-2 text-xs space-y-1 font-mono text-slate-300">
                      <div>Predicted: {stat.predictedCount}</div>
                      <div>Hits: {stat.correctCount}</div>
                      <div className="text-emerald-400 font-bold">Acc: {(stat.accuracy * 100).toFixed(1)}%</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 8: SETTINGS & DEV TOOLS                                   */}
      {/* ============================================================ */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          {/* Activation Threshold Settings */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-base font-bold text-white font-['Chakra_Petch',sans-serif] mb-2 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-purple-400" />
              Game Timing & Prediction Activation Rules
            </h3>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              Configure round duration, automated countdown resolution, and mathematical thresholds required before number predictions become visible to regular users.
            </p>

            <form onSubmit={handleConfigSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Round Interval (Sec)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={600}
                    value={roundInterval}
                    onChange={(e) => setRoundInterval(parseInt(e.target.value, 10) || 30)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Countdown duration (e.g. 30s)</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Auto-Draw on Timer
                  </label>
                  <div className="flex items-center h-10 px-3 bg-slate-950 border border-slate-700 rounded-xl">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-200">
                      <input
                        type="checkbox"
                        checked={autoDrawEnabled}
                        onChange={(e) => setAutoDrawEnabled(e.target.checked)}
                        className="rounded border-slate-700 text-rose-500 focus:ring-rose-500 w-4 h-4 bg-slate-900"
                      />
                      <span>Auto-resolve when 0s</span>
                    </label>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">Trigger draws automatically</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Min Validation Samples
                  </label>
                  <input
                    type="number"
                    min={10}
                    value={minValidationSamples}
                    onChange={(e) => setMinValidationSamples(parseInt(e.target.value, 10) || 200)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Default: 200 samples</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Activation Accuracy (%)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={100}
                    value={activationAccuracy}
                    onChange={(e) => setActivationAccuracy(parseInt(e.target.value, 10) || 80)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Threshold for Number AI</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleDrawNow}
                  disabled={isDrawingNow}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-rose-400 font-bold rounded-xl text-xs shadow flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" />
                  {isDrawingNow ? 'Resolving Round...' : 'Draw Round Now (Instant Resolution)'}
                </button>

                <button
                  type="submit"
                  className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs shadow transition-all"
                >
                  Save Configuration & Timer Settings
                </button>
              </div>
            </form>
          </div>

          {/* Development Mode & Synthetic Generator */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white font-['Chakra_Petch',sans-serif] flex items-center gap-2">
                  <Play className="w-4 h-4 text-amber-400" />
                  Development Mode & Synthetic Generator
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Generate synthetic results to test walk-forward validation and observe auto-activation/auto-deactivation rules live.
                </p>
              </div>

              <button
                type="button"
                onClick={handleToggleDevMode}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  isDevMode
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {isDevMode ? 'DEV MODE: ACTIVE' : 'DEV MODE: OFF'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => handleGenerateDevSample(1)}
                className="p-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-left transition-all"
              >
                <span className="text-xs font-bold text-white block">+1 Synthetic Round</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">Simulate next live draw</span>
              </button>

              <button
                type="button"
                onClick={() => handleGenerateDevSample(10)}
                className="p-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-left transition-all"
              >
                <span className="text-xs font-bold text-white block">+10 Synthetic Rounds</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">Batch walk-forward step</span>
              </button>

              <button
                type="button"
                onClick={() => handleGenerateDevSample(50)}
                className="p-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-left transition-all"
              >
                <span className="text-xs font-bold text-white block">+50 Synthetic Rounds</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">Expand sample validation</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
