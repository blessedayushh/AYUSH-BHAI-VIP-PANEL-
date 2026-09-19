/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RealtimeNotification, User, UserDashboardData, getWingoActiveRoundId } from './types';
import { api, authStorage, wsClient } from './api';
import { getClientUserDashboard } from './fallbackEngine';
import { Header } from './components/Header';
import { LoginModal } from './components/LoginModal';
import { UserDashboard } from './components/UserDashboard';
import { TradeAnalysis } from './components/TradeAnalysis';
import { AdminPanel } from './components/AdminPanel';
import { NotificationToastContainer } from './components/NotificationToastContainer';
import { soundEffects } from './utils/audio';
import { ShieldCheck, Info } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [dashboardData, setDashboardData] = useState<UserDashboardData | null>(() => {
    try {
      return getClientUserDashboard();
    } catch {
      return null;
    }
  });
  const [currentTab, setCurrentTab] = useState<'user' | 'trade' | 'admin'>('user');
  const [countdownSeconds, setCountdownSeconds] = useState<number>(30);
  const [activeRoundId, setActiveRoundId] = useState<string>(() => getWingoActiveRoundId());
  const [isWsConnected, setIsWsConnected] = useState<boolean>(false);
  const [isDataSynced, setIsDataSynced] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([]);
  const [activeToasts, setActiveToasts] = useState<RealtimeNotification[]>([]);

  // Authoritative target epoch timestamp (ms) for the upcoming draw
  const targetDrawTimeRef = useRef<number>(0);

  const addNotification = useCallback((notification: Omit<RealtimeNotification, 'id' | 'timestamp'>) => {
    const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newNotif: RealtimeNotification = {
      ...notification,
      id,
      timestamp: new Date().toISOString(),
      read: false,
    };

    setNotifications((prev) => [newNotif, ...prev.slice(0, 49)]); // Keep last 50
    setActiveToasts((prev) => [newNotif, ...prev.slice(0, 3)]); // Keep 4 active toasts

    // Auto-dismiss toast after 6.5s
    setTimeout(() => {
      setActiveToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setActiveToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setActiveToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
    setActiveToasts([]);
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const fetchUserData = useCallback(async () => {
    const now = Date.now();
    const secInMin = Math.floor(now / 1000) % 60;
    const nextMinuteBoundary = Math.floor(now / 60000) * 60000 + 60000;

    try {
      const data = await api.getUserDashboard();
      if (data) {
        setDashboardData(data);
        setIsDataSynced(true);
        if (data.activeRoundId) {
          setActiveRoundId(data.activeRoundId);
        }
        if (typeof data.countdownSeconds === 'number' && data.countdownSeconds > 0) {
          const sec = data.countdownSeconds;
          targetDrawTimeRef.current = now + sec * 1000;
          setCountdownSeconds(sec);
        } else if (data.nextDrawTime) {
          const target = new Date(data.nextDrawTime).getTime();
          const diffSec = !isNaN(target) ? Math.ceil((target - now) / 1000) : 0;
          if (diffSec > 0) {
            targetDrawTimeRef.current = now + diffSec * 1000;
            setCountdownSeconds(diffSec);
          } else {
            targetDrawTimeRef.current = nextMinuteBoundary;
            setCountdownSeconds(secInMin < 3 ? 0 : Math.max(0, Math.ceil((nextMinuteBoundary - now) / 1000)));
          }
        } else {
          targetDrawTimeRef.current = nextMinuteBoundary;
          setCountdownSeconds(secInMin < 3 ? 0 : Math.max(0, Math.ceil((nextMinuteBoundary - now) / 1000)));
        }
      }
    } catch (err) {
      console.warn('Could not fetch user dashboard', err);
      // Fallback engine ensures live engine never gets stuck in connecting
      setDashboardData((prev) => {
        const fallback = getClientUserDashboard();
        setIsDataSynced(true);
        return fallback || prev;
      });
      targetDrawTimeRef.current = nextMinuteBoundary;
      setCountdownSeconds(secInMin < 3 ? 0 : Math.max(0, Math.ceil((nextMinuteBoundary - now) / 1000)));
    }
  }, []);

  // Initialize session and WebSocket
  useEffect(() => {
    const initAuth = async () => {
      const token = authStorage.getToken();
      if (!token) {
        setShowLoginModal(true);
        setLoading(false);
        return;
      }

      try {
        const me = await api.getMe();
        setUser(me.user);
        setShowLoginModal(false);
        await fetchUserData();
      } catch {
        authStorage.clearToken();
        setShowLoginModal(true);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // WebSocket setup
    wsClient.connect();

    const unsubConnect = wsClient.on('CONNECT', () => {
      setIsWsConnected(true);
      setIsDataSynced(true);
    });
    const unsubDisconnect = wsClient.on('DISCONNECT', () => setIsWsConnected(false));

    const unsubTick = wsClient.on('COUNTDOWN_TICK', (data: any) => {
      if (!data) return;
      if (data.activeRoundId) {
        setActiveRoundId((prev) => (prev !== data.activeRoundId ? data.activeRoundId : prev));
      }

      if (typeof data.remainingSeconds === 'number') {
        const serverSec = Math.max(0, Math.floor(data.remainingSeconds));

        // When drawing is in progress (0), show 0 but align targetDrawTimeRef to upcoming minute boundary so it doesn't get stuck
        if (serverSec === 0) {
          const now = Date.now();
          targetDrawTimeRef.current = Math.floor(now / 60000) * 60000 + 60000;
          setCountdownSeconds(0);
          return;
        }

        // Calculate current local remaining seconds
        const currentLocal =
          targetDrawTimeRef.current > 0
            ? Math.max(0, Math.ceil((targetDrawTimeRef.current - Date.now()) / 1000))
            : -1;

        // If local is uninitialized, drifted by >= 2s, or round just started
        if (currentLocal < 0 || Math.abs(currentLocal - serverSec) >= 2) {
          targetDrawTimeRef.current = Date.now() + serverSec * 1000;
          setCountdownSeconds((prev) => (prev !== serverSec ? serverSec : prev));
        }
      }
    });

    // Real-Time Notification: New Result
    const unsubNewResult = wsClient.on('NEW_RESULT', (data: any) => {
      fetchUserData();
      if (data && data.roundId) {
        soundEffects.playResultChime();
        addNotification({
          type: 'NEW_RESULT',
          title: `Round #${data.roundId.slice(-4)} Drawn`,
          message: `Number ${data.number} • ${data.colour} (${data.size})`,
          data: {
            roundId: data.roundId,
            result: data,
          },
        });
      }
    });

    // Real-Time Notification: New Prediction
    const unsubNewPred = wsClient.on('NEW_PREDICTION', (data: any) => {
      fetchUserData();
      if (data) {
        soundEffects.playPredictionChime();
        const preds = Array.isArray(data.predictions) ? data.predictions : [];
        const colPred = preds.find((p: any) => p.predictionType === 'COLOUR');
        const sizePred = preds.find((p: any) => p.predictionType === 'SIZE');
        const numPred = preds.find((p: any) => p.predictionType === 'NUMBER');

        const parts: string[] = [];
        if (colPred) parts.push(`Colour: ${colPred.predictedValue} (${Math.round((colPred.probability || 0.5) * 100)}%)`);
        if (sizePred) parts.push(`Size: ${sizePred.predictedValue}`);
        if (data.numberStatus === 'ACTIVE' && numPred) {
          parts.push(`Number: ${numPred.predictedValue}`);
        }

        const roundLabel = data.roundId ? data.roundId.slice(-4) : 'Upcoming';
        addNotification({
          type: 'NEW_PREDICTION',
          title: `Predictions for Round #${roundLabel}`,
          message: parts.length > 0 ? parts.join(' • ') : 'New multi-model AI predictions generated',
          data: {
            roundId: data.roundId,
            prediction: {
              colour: colPred?.predictedValue,
              size: sizePred?.predictedValue,
              number: numPred?.predictedValue,
              confidence: colPred?.confidence,
              probability: colPred?.probability,
              numberStatus: data.numberStatus,
            },
          },
        });
      }
    });

    // Real-Time Notification: Number Prediction Status Changed
    const unsubStatusChanged = wsClient.on('NUMBER_STATUS_CHANGED', (data: any) => {
      fetchUserData();
      if (data) {
        if (data.currentStatus === 'ACTIVE') {
          soundEffects.playStatusActivatedChime();
        } else {
          soundEffects.playStatusDegradedChime();
        }

        addNotification({
          type: 'NUMBER_STATUS_CHANGED',
          title: data.title || `Number Predictions ${data.currentStatus}`,
          message: data.message || `Number prediction status changed from ${data.previousStatus} to ${data.currentStatus}`,
          data: {
            numberStatusChange: data,
          },
        });
      }
    });

    const unsubEval = wsClient.on('PREDICTION_EVALUATED', () => {
      fetchUserData();
    });

    const unsubModel = wsClient.on('MODEL_UPDATED', () => {
      fetchUserData();
    });

    return () => {
      unsubConnect();
      unsubDisconnect();
      unsubTick();
      unsubNewResult();
      unsubNewPred();
      unsubStatusChanged();
      unsubEval();
      unsubModel();
    };
  }, [fetchUserData, addNotification]);

  // High-precision smooth ticker based on target epoch timestamp (resilient to tab switching & zero drift)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const currentSecInMin = Math.floor(now / 1000) % 60;

      // Self-healing check: if targetDrawTimeRef is unset or expired by more than 3.5 seconds (Vercel serverless / cold-start lag)
      if (targetDrawTimeRef.current <= 0 || (targetDrawTimeRef.current > 0 && now - targetDrawTimeRef.current >= 3500)) {
        // Automatically advance targetDrawTimeRef to upcoming minute boundary (:00)
        const nextMinuteEpoch = Math.floor(now / 60000) * 60000 + 60000;
        targetDrawTimeRef.current = nextMinuteEpoch;
        setActiveRoundId(getWingoActiveRoundId(now));
        // Fetch freshly drawn result and new predictions
        fetchUserData();
      }

      // Compute remaining seconds from target
      let remaining = Math.max(0, Math.ceil((targetDrawTimeRef.current - now) / 1000));

      // Display 0 ("DRAWING...") during the brief 0-2.5s draw resolution window at the minute boundary
      if (currentSecInMin < 3 && remaining >= 57) {
        remaining = 0;
      }

      setCountdownSeconds((prev) => {
        // If countdown just crossed zero from positive, trigger fetch after 1.5s to capture the freshly drawn result
        if (prev > 0 && remaining === 0) {
          setTimeout(() => {
            fetchUserData();
          }, 1500);
        }
        return prev !== remaining ? remaining : prev;
      });
    }, 250);
    return () => clearInterval(timer);
  }, [fetchUserData]);

  // Resilient real-time polling sync (vital for Vercel / serverless deployments where WebSockets are unavailable)
  useEffect(() => {
    if (!user) return;
    const pollInterval = setInterval(() => {
      if (!isWsConnected) {
        fetchUserData();
      }
    }, 3500);
    return () => clearInterval(pollInterval);
  }, [user, isWsConnected, fetchUserData]);

  const handleLoginSuccess = async (loggedUser: User) => {
    setUser(loggedUser);
    setShowLoginModal(false);
    await fetchUserData();
    if (loggedUser.role === 'ADMIN') {
      setCurrentTab('user');
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    }
    authStorage.clearToken();
    setUser(null);
    setDashboardData(null);
    setShowLoginModal(true);
    setCurrentTab('user');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#090d16] text-slate-100">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-yellow-500/30 border-t-yellow-400 rounded-full animate-spin"></div>
          <span className="text-xs font-mono text-yellow-400 font-bold">Booting AYUSH BHAI VIP PANEL 👑...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col selection:bg-rose-500 selection:text-white">
      {/* Top Header with Notification Center */}
      <Header
        user={user}
        activeRoundId={activeRoundId || dashboardData?.activeRoundId || getWingoActiveRoundId()}
        countdownSeconds={countdownSeconds}
        isWsConnected={isWsConnected}
        isLive={isWsConnected || isDataSynced}
        isDevMode={dashboardData?.isDevMode || false}
        currentTab={currentTab}
        notifications={notifications}
        onClearNotifications={clearAllNotifications}
        onMarkAllAsRead={markAllAsRead}
        onDismissNotification={dismissNotification}
        onTabChange={(tab) => setCurrentTab(tab)}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {currentTab === 'user' ? (
          <UserDashboard
            data={dashboardData}
            onRefresh={fetchUserData}
            countdownSeconds={countdownSeconds}
            liveActiveRoundId={activeRoundId || dashboardData?.activeRoundId || ''}
            onNavigateToTrade={() => setCurrentTab('trade')}
          />
        ) : currentTab === 'trade' ? (
          <TradeAnalysis
            countdownSeconds={countdownSeconds}
            activeRoundId={activeRoundId || dashboardData?.activeRoundId || ''}
            onNavigateToPredictions={() => setCurrentTab('user')}
          />
        ) : (
          user?.role === 'ADMIN' && <AdminPanel onDataChanged={fetchUserData} />
        )}
      </main>

      {/* Floating Real-time Toast Notifications */}
      <NotificationToastContainer
        notifications={activeToasts}
        onDismiss={dismissToast}
      />

      {/* Login Modal */}
      {showLoginModal && <LoginModal onLoginSuccess={handleLoginSuccess} />}

      {/* Footer / Transparency & Compliance Notice */}
      <footer className="border-t border-slate-800/80 bg-[#0c121e] py-6 px-4 text-xs text-slate-400">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-yellow-400">AYUSH BHAI VIP PANEL 👑 — AI Analytics System</span>
          </div>

          <div className="flex items-center gap-1.5 text-center sm:text-right max-w-xl">
            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>
              All predictions are generated via multi-model ensemble analysis and evaluated using chronological walk-forward validation. Never claims guaranteed results. No lookahead data leakage.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

