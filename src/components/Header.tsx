import React from 'react';
import { RealtimeNotification, User, getWingoActiveRoundId } from '../types';
import { Shield, Radio, Sparkles, LogOut, Clock, Layers, Gauge, FlaskConical, TrendingUp, Crown } from 'lucide-react';
import { NotificationCenter } from './NotificationCenter';

interface HeaderProps {
  user: User | null;
  activeRoundId: string;
  countdownSeconds: number;
  isWsConnected: boolean;
  isDevMode: boolean;
  currentTab: 'user' | 'trade' | 'admin';
  notifications: RealtimeNotification[];
  onClearNotifications: () => void;
  onMarkAllAsRead: () => void;
  onDismissNotification: (id: string) => void;
  onTabChange: (tab: 'user' | 'trade' | 'admin') => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  activeRoundId,
  countdownSeconds,
  isWsConnected,
  isDevMode,
  currentTab,
  notifications,
  onClearNotifications,
  onMarkAllAsRead,
  onDismissNotification,
  onTabChange,
  onLogout,
}) => {
  const formatCountdown = (sec: number) => {
    const safeSec = Math.max(0, Math.floor(sec));
    const m = Math.floor(safeSec / 60);
    const s = safeSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0c121e]/90 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-6 py-3">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Logo & Status */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 via-amber-500 to-yellow-600 shadow-lg shadow-yellow-500/25 ring-1 ring-yellow-400/40">
            <Crown className="w-5 h-5 text-slate-950 fill-slate-950" />
            <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isWsConnected ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${isWsConnected ? 'bg-emerald-500' : 'bg-amber-500'} border-2 border-[#090d16]`}></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-yellow-400 font-['Chakra_Petch',sans-serif] drop-shadow-[0_0_12px_rgba(250,204,21,0.4)] flex items-center gap-1.5">
                <span>AYUSH BHAI VIP PANEL</span>
                <span className="text-xl inline-block drop-shadow-none">👑</span>
              </h1>
              {isDevMode && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                  <FlaskConical className="w-3 h-3" />
                  DEV MODE
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <span>AI Colour & Number Engine</span>
              <span className="w-1 h-1 rounded-full bg-slate-600"></span>
              <span className={`inline-flex items-center gap-1 ${isWsConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
                <Radio className="w-3 h-3" />
                {isWsConnected ? 'Live' : 'Connecting'}
              </span>
            </p>
          </div>
        </div>

        {/* Round & Countdown Centerpiece */}
        <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-1.5 shadow-inner">
          <div className="text-left">
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">Round</span>
            <span className="text-xs font-mono font-bold text-rose-300">
              #{activeRoundId || getWingoActiveRoundId()}
            </span>
          </div>

          <div className="h-6 w-px bg-slate-800"></div>

          <div className="flex items-center gap-2">
            <Clock className={`w-4 h-4 ${countdownSeconds <= 5 ? 'text-rose-400 animate-pulse' : countdownSeconds <= 10 ? 'text-amber-400' : 'text-indigo-400'}`} />
            <div>
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">Next Draw</span>
              <span className={`text-sm font-mono font-bold ${
                countdownSeconds === 0
                  ? 'text-rose-400 font-extrabold animate-pulse'
                  : countdownSeconds <= 5
                  ? 'text-rose-400 font-extrabold'
                  : countdownSeconds <= 10
                  ? 'text-amber-400 font-bold'
                  : 'text-slate-100'
              }`}>
                {countdownSeconds === 0 ? 'DRAWING...' : formatCountdown(countdownSeconds)}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation & User controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {user && (
            <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
              <button
                id="btn-nav-user"
                onClick={() => onTabChange('user')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  currentTab === 'user'
                    ? 'bg-gradient-to-r from-rose-500 to-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Gauge className="w-3.5 h-3.5" />
                <span>Predictions</span>
              </button>

              <button
                id="btn-nav-trade"
                onClick={() => onTabChange('trade')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  currentTab === 'trade'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>Trade Analysis</span>
              </button>

              {user.role === 'ADMIN' && (
                <button
                  id="btn-nav-admin"
                  onClick={() => onTabChange('admin')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    currentTab === 'admin'
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5 text-purple-300" />
                  <span>Admin Panel</span>
                </button>
              )}
            </div>
          )}

          {/* Real-time Notification Center */}
          <NotificationCenter
            notifications={notifications}
            onClearAll={onClearNotifications}
            onMarkAllAsRead={onMarkAllAsRead}
            onDismiss={onDismissNotification}
          />

          {user ? (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-semibold text-slate-200">{user.username}</span>
                <span className="text-[10px] font-mono text-slate-400">{user.role}</span>
              </div>

              <button
                id="btn-logout"
                onClick={onLogout}
                title="Logout"
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition-colors border border-transparent hover:border-slate-700"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="text-xs text-slate-400 font-mono">Authentication Required</div>
          )}
        </div>
      </div>
    </header>
  );
};
