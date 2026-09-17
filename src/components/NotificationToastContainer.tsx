import React from 'react';
import { RealtimeNotification } from '../types';
import {
  Sparkles,
  Trophy,
  AlertTriangle,
  Lock,
  Unlock,
  X,
  Radio,
  Clock,
  ArrowRight,
} from 'lucide-react';

interface NotificationToastContainerProps {
  notifications: RealtimeNotification[];
  onDismiss: (id: string) => void;
}

export const NotificationToastContainer: React.FC<NotificationToastContainerProps> = ({
  notifications,
  onDismiss,
}) => {
  // Only display the 3 most recent toasts to avoid clutter
  const visibleToasts = notifications.slice(0, 3);

  if (visibleToasts.length === 0) return null;

  return (
    <aside
      aria-label="Live notifications"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-[calc(100vw-2rem)] pointer-events-none"
    >
      {visibleToasts.map((toast) => {
        const isResult = toast.type === 'NEW_RESULT';
        const isPrediction = toast.type === 'NEW_PREDICTION';
        const isStatusChange = toast.type === 'NUMBER_STATUS_CHANGED';
        const numStatus = toast.data?.numberStatusChange?.currentStatus;

        let borderClass = 'border-slate-800 bg-slate-900/95';
        let accentColor = 'text-slate-200';
        let badgeBg = 'bg-slate-800 text-slate-300';
        let IconComponent = Radio;

        if (isResult) {
          borderClass = 'border-rose-500/40 bg-[#0e1322]/95 shadow-lg shadow-rose-950/40';
          accentColor = 'text-rose-400';
          badgeBg = 'bg-rose-500/20 text-rose-300 border border-rose-500/30';
          IconComponent = Trophy;
        } else if (isPrediction) {
          borderClass = 'border-indigo-500/40 bg-[#0e1322]/95 shadow-lg shadow-indigo-950/40';
          accentColor = 'text-indigo-400';
          badgeBg = 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30';
          IconComponent = Sparkles;
        } else if (isStatusChange) {
          if (numStatus === 'ACTIVE') {
            borderClass = 'border-emerald-500/60 bg-[#091717]/95 shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-500/30';
            accentColor = 'text-emerald-400';
            badgeBg = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
            IconComponent = Unlock;
          } else if (numStatus === 'DEGRADED') {
            borderClass = 'border-amber-500/60 bg-[#191409]/95 shadow-lg shadow-amber-950/40 ring-1 ring-amber-500/30';
            accentColor = 'text-amber-400';
            badgeBg = 'bg-amber-500/20 text-amber-300 border border-amber-500/40';
            IconComponent = AlertTriangle;
          } else {
            borderClass = 'border-slate-700 bg-[#10141e]/95 shadow-lg shadow-black/40';
            accentColor = 'text-slate-400';
            badgeBg = 'bg-slate-800 text-slate-300 border border-slate-700';
            IconComponent = Lock;
          }
        }

        const resData = toast.data?.result;
        const predData = toast.data?.prediction;
        const statusChange = toast.data?.numberStatusChange;

        return (
          <div
            key={toast.id}
            id={`toast-${toast.id}`}
            className={`pointer-events-auto relative overflow-hidden rounded-xl p-3.5 border backdrop-blur-md transition-all duration-300 hover:translate-y-[-2px] ${borderClass}`}
          >
            {/* Top Bar */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${badgeBg} shrink-0`}>
                  <IconComponent className={`w-4 h-4 ${accentColor}`} />
                </div>
                <div>
                  <span className="text-xs font-bold font-mono tracking-tight text-white block">
                    {toast.title}
                  </span>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                    <Clock className="w-2.5 h-2.5" />
                    {new Date(toast.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              </div>

              <button
                id={`btn-dismiss-${toast.id}`}
                onClick={() => onDismiss(toast.id)}
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800/80 transition-colors"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Custom Content for NEW_RESULT */}
            {isResult && resData && (
              <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-400">Round #{resData.roundId.slice(-4)}:</span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        resData.colour === 'RED'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : resData.colour === 'GREEN'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                      }`}
                    >
                      {resData.colour}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-slate-800 text-slate-200 border border-slate-700">
                      {resData.size}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-400">Number</span>
                  <span className="w-6 h-6 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-mono font-bold text-white text-xs">
                    {resData.number}
                  </span>
                </div>
              </div>
            )}

            {/* Custom Content for NEW_PREDICTION */}
            {isPrediction && predData && (
              <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-xs">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-mono">
                      Round #{toast.data?.roundId ? toast.data.roundId.slice(-4) : 'Next'}
                    </span>
                    {predData.colour && (
                      <span className="font-bold text-rose-300">
                        {predData.colour}
                      </span>
                    )}
                    {predData.size && (
                      <span className="font-semibold text-sky-300 font-mono">
                        {predData.size}
                      </span>
                    )}
                  </div>
                  {predData.probability && (
                    <span className="font-mono text-emerald-400 text-[10px]">
                      {Math.round(predData.probability * 100)}% Conf
                    </span>
                  )}
                </div>
                {predData.numberStatus && (
                  <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                    <span className="text-slate-400">Number Status:</span>
                    <span
                      className={`font-semibold ${
                        predData.numberStatus === 'ACTIVE'
                          ? 'text-emerald-400'
                          : predData.numberStatus === 'DEGRADED'
                          ? 'text-amber-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {predData.numberStatus}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Custom Content for NUMBER_STATUS_CHANGED */}
            {isStatusChange && statusChange && (
              <div className="mt-2 pt-2 border-t border-slate-800/80 text-xs">
                <div className="flex items-center gap-2 text-[11px] mb-1 font-mono">
                  <span className="text-slate-400">{statusChange.previousStatus}</span>
                  <ArrowRight className="w-3 h-3 text-slate-500" />
                  <span
                    className={`font-bold ${
                      statusChange.currentStatus === 'ACTIVE'
                        ? 'text-emerald-400'
                        : statusChange.currentStatus === 'DEGRADED'
                        ? 'text-amber-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {statusChange.currentStatus}
                  </span>
                  {statusChange.rolling100Accuracy !== undefined && (
                    <span className="text-slate-400 ml-auto">
                      {(statusChange.rolling100Accuracy * 100).toFixed(1)}% acc
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-300 leading-snug">
                  {toast.message}
                </p>
              </div>
            )}

            {/* General message if no specific custom block */}
            {!isResult && !isPrediction && !isStatusChange && (
              <p className="mt-1.5 text-xs text-slate-300 leading-snug">
                {toast.message}
              </p>
            )}
          </div>
        );
      })}
    </aside>
  );
};
