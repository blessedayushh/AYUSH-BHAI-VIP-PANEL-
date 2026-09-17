import React, { useState, useRef, useEffect } from 'react';
import { RealtimeNotification } from '../types';
import {
  Bell,
  CheckCheck,
  Trash2,
  Volume2,
  VolumeX,
  X,
  Trophy,
  Sparkles,
  AlertTriangle,
  Lock,
  Unlock,
  Radio,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { soundEffects } from '../utils/audio';

interface NotificationCenterProps {
  notifications: RealtimeNotification[];
  onClearAll: () => void;
  onMarkAllAsRead: () => void;
  onDismiss: (id: string) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  onClearAll,
  onMarkAllAsRead,
  onDismiss,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'RESULT' | 'PREDICTION' | 'STATUS'>('ALL');
  const [isMuted, setIsMuted] = useState(soundEffects.isMuted);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const toggleSound = () => {
    const nextState = !isMuted;
    setIsMuted(nextState);
    soundEffects.setMuted(nextState);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen && unreadCount > 0) {
      onMarkAllAsRead();
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'ALL') return true;
    if (filter === 'RESULT') return n.type === 'NEW_RESULT';
    if (filter === 'PREDICTION') return n.type === 'NEW_PREDICTION';
    if (filter === 'STATUS') return n.type === 'NUMBER_STATUS_CHANGED';
    return true;
  });

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        id="btn-notification-bell"
        onClick={handleOpen}
        aria-label="Open notifications"
        className={`relative p-2 rounded-xl transition-all border ${
          isOpen
            ? 'bg-slate-800 text-white border-slate-700'
            : unreadCount > 0
            ? 'text-rose-400 bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/20'
            : 'text-slate-400 hover:text-slate-200 bg-slate-900 border-slate-800 hover:border-slate-700'
        }`}
        title="Live WebSocket Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold font-mono text-white shadow-md shadow-rose-500/40">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div
          id="popover-notification-center"
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-[#0d1322] border border-slate-800/90 shadow-2xl shadow-black/80 backdrop-blur-xl z-50 overflow-hidden flex flex-col max-h-[80vh]"
        >
          {/* Header */}
          <div className="p-3.5 border-b border-slate-800/80 bg-[#0a0f1c] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                Live Broadcasts
              </h2>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-800 text-slate-300">
                {notifications.length}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                id="btn-toggle-sound"
                onClick={toggleSound}
                className={`p-1.5 rounded-lg border text-xs transition-colors ${
                  isMuted
                    ? 'text-slate-500 border-slate-800 hover:text-slate-300'
                    : 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                }`}
                title={isMuted ? 'Sound Muted (Click to enable)' : 'Sound Enabled (Click to mute)'}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>

              {unreadCount > 0 && (
                <button
                  id="btn-mark-all-read"
                  onClick={onMarkAllAsRead}
                  className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                </button>
              )}

              {notifications.length > 0 && (
                <button
                  id="btn-clear-notifications"
                  onClick={onClearAll}
                  className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                  title="Clear all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                id="btn-close-notification-center"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors ml-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Filter Chips */}
          <div className="px-3 py-2 bg-slate-900/60 border-b border-slate-800/60 flex items-center gap-1.5 overflow-x-auto text-[11px]">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                filter === 'ALL'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-800/60'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('RESULT')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                filter === 'RESULT'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-800/60'
              }`}
            >
              Results
            </button>
            <button
              onClick={() => setFilter('PREDICTION')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                filter === 'PREDICTION'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-800/60'
              }`}
            >
              Predictions
            </button>
            <button
              onClick={() => setFilter('STATUS')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                filter === 'STATUS'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-800/60'
              }`}
            >
              Status
            </button>
          </div>

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 max-h-[380px]">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                <p className="text-xs text-slate-400 font-mono">No notifications received yet</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Live draw results, new AI predictions, and number model status changes will appear here instantly.
                </p>
              </div>
            ) : (
              filteredNotifications.map((n) => {
                const isResult = n.type === 'NEW_RESULT';
                const isPrediction = n.type === 'NEW_PREDICTION';
                const isStatusChange = n.type === 'NUMBER_STATUS_CHANGED';
                const numStatus = n.data?.numberStatusChange?.currentStatus;

                let icon = Radio;
                let iconColor = 'text-slate-400';
                let iconBg = 'bg-slate-800';

                if (isResult) {
                  icon = Trophy;
                  iconColor = 'text-rose-400';
                  iconBg = 'bg-rose-500/15 border border-rose-500/30';
                } else if (isPrediction) {
                  icon = Sparkles;
                  iconColor = 'text-indigo-400';
                  iconBg = 'bg-indigo-500/15 border border-indigo-500/30';
                } else if (isStatusChange) {
                  if (numStatus === 'ACTIVE') {
                    icon = Unlock;
                    iconColor = 'text-emerald-400';
                    iconBg = 'bg-emerald-500/15 border border-emerald-500/30';
                  } else if (numStatus === 'DEGRADED') {
                    icon = AlertTriangle;
                    iconColor = 'text-amber-400';
                    iconBg = 'bg-amber-500/15 border border-amber-500/30';
                  } else {
                    icon = Lock;
                    iconColor = 'text-slate-400';
                    iconBg = 'bg-slate-800 border border-slate-700';
                  }
                }

                const IconComp = icon;

                return (
                  <div
                    key={n.id}
                    className={`p-3 transition-colors hover:bg-slate-800/40 relative group ${
                      !n.read ? 'bg-rose-500/5' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={`p-1.5 rounded-lg ${iconBg} shrink-0 mt-0.5`}>
                        <IconComp className={`w-3.5 h-3.5 ${iconColor}`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className="text-xs font-bold text-slate-200 truncate font-mono">
                            {n.title}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono shrink-0 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>

                        <p className="text-xs text-slate-400 leading-relaxed break-words">
                          {n.message}
                        </p>

                        {/* Result Badge Snippet */}
                        {isResult && n.data?.result && (
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-[10px] font-mono text-slate-400">
                              Round #{n.data.result.roundId.slice(-4)}:
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                n.data.result.colour === 'RED'
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : n.data.result.colour === 'GREEN'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-purple-500/20 text-purple-300'
                              }`}
                            >
                              {n.data.result.colour}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                              {n.data.result.size}
                            </span>
                            <span className="w-5 h-5 rounded bg-slate-800 text-white font-mono text-[11px] font-bold flex items-center justify-center">
                              {n.data.result.number}
                            </span>
                          </div>
                        )}

                        {/* Status Change Snippet */}
                        {isStatusChange && n.data?.numberStatusChange && (
                          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-mono">
                            <span className="text-slate-500">
                              {n.data.numberStatusChange.previousStatus}
                            </span>
                            <ArrowRight className="w-2.5 h-2.5 text-slate-600" />
                            <span
                              className={`font-bold ${
                                numStatus === 'ACTIVE'
                                  ? 'text-emerald-400'
                                  : numStatus === 'DEGRADED'
                                  ? 'text-amber-400'
                                  : 'text-slate-400'
                              }`}
                            >
                              {numStatus}
                            </span>
                            <span className="text-slate-500 ml-auto">
                              {(n.data.numberStatusChange.rolling100Accuracy * 100).toFixed(1)}% acc
                            </span>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => onDismiss(n.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-slate-300 p-1 rounded transition-opacity"
                        title="Dismiss"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
