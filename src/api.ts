import { AdminDashboardData, AnalyticsSummary, GameResult, Prediction, User, UserDashboardData, WingoFeedStatus, TradeAnalysisData, StakingStrategy } from './types';

const TOKEN_KEY = 'colorpredict_token';

export const authStorage = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clearToken: () => localStorage.removeItem(TOKEN_KEY),
};

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = authStorage.getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errMessage = 'Request failed';
    try {
      const errJson = await res.json();
      errMessage = errJson.error || errMessage;
    } catch {
      // ignore json parse error
    }
    throw new Error(errMessage);
  }

  return res.json();
}

export const api = {
  // Auth
  login: (username: string, licenseKey: string) =>
    apiFetch<{ token: string; user: User; license: any }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, licenseKey }),
    }),

  logout: () =>
    apiFetch<{ success: boolean }>('/api/auth/logout', {
      method: 'POST',
    }),

  getMe: () =>
    apiFetch<{ user: User; license: any }>('/api/auth/me'),

  // User
  getUserDashboard: () =>
    apiFetch<UserDashboardData>('/api/user/dashboard'),

  getUserResults: (limit = 50) =>
    apiFetch<{ results: GameResult[] }>(`/api/user/results?limit=${limit}`),

  getUserPredictions: (limit = 50) =>
    apiFetch<{ predictions: Prediction[] }>(`/api/user/predictions?limit=${limit}`),

  getUserStatistics: () =>
    apiFetch<AnalyticsSummary>('/api/user/statistics'),

  getTradeAnalysis: (params: { bankroll?: number; strategy?: StakingStrategy; baseUnit?: number; limit?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.bankroll) query.set('bankroll', params.bankroll.toString());
    if (params.strategy) query.set('strategy', params.strategy);
    if (params.baseUnit) query.set('baseUnit', params.baseUnit.toString());
    if (params.limit) query.set('limit', params.limit.toString());
    const qs = query.toString();
    return apiFetch<TradeAnalysisData>(`/api/user/trade-analysis${qs ? `?${qs}` : ''}`);
  },

  // Admin
  getAdminDashboard: () =>
    apiFetch<AdminDashboardData>('/api/admin/dashboard'),

  getAdminUsers: () =>
    apiFetch<{ users: User[] }>('/api/admin/users'),

  updateUserStatus: (id: string, status: 'ACTIVE' | 'DISABLED') =>
    apiFetch<{ user: User }>(`/api/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  getAdminLicenses: () =>
    apiFetch<{ licenses: any[] }>('/api/admin/licenses'),

  createLicense: (username: string, expiresDays: number, notes?: string) =>
    apiFetch<{ license: any }>('/api/admin/licenses', {
      method: 'POST',
      body: JSON.stringify({ username, expiresDays, notes }),
    }),

  updateLicense: (id: string, updates: any) =>
    apiFetch<{ license: any }>(`/api/admin/licenses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  deleteLicense: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/admin/licenses/${id}`, {
      method: 'DELETE',
    }),

  submitResult: (data: { roundId: string; number: number; colour?: string; size?: string; timestamp?: string }) =>
    apiFetch<{ success: boolean; result: GameResult; nextPredictions: Prediction[] }>('/api/admin/results', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  submitAdminPrediction: (data: { roundId: string; colour?: string; size?: string; number?: number }) =>
    apiFetch<{ success: boolean; adminPrediction: any }>('/api/admin/predictions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getAdminModels: () =>
    apiFetch<any>('/api/admin/models'),

  retrainModels: () =>
    apiFetch<any>('/api/admin/models/retrain', { method: 'POST' }),

  backtestModels: () =>
    apiFetch<any>('/api/admin/models/backtest', { method: 'POST' }),

  getAdminAnalytics: () =>
    apiFetch<AnalyticsSummary>('/api/admin/analytics'),

  getNumberAnalytics: () =>
    apiFetch<any>('/api/admin/analytics/number'),

  getAdminConfig: () =>
    apiFetch<{ config: any }>('/api/admin/config'),

  updateAdminConfig: (config: any) =>
    apiFetch<{ config: any }>('/api/admin/config', {
      method: 'POST',
      body: JSON.stringify(config),
    }),

  importCsv: (csvData: string) =>
    apiFetch<{ success: boolean; imported: number; rejected: number; duplicates: number; errors: string[] }>(
      '/api/admin/results/import-csv',
      {
        method: 'POST',
        body: JSON.stringify({ csvData }),
      }
    ),

  // Dev mode
  toggleDevMode: (enabled: boolean) =>
    apiFetch<{ isDevMode: boolean }>('/api/dev/toggle-mode', {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    }),

  generateSample: (count: number, forceHighAccuracy = false) =>
    apiFetch<any>('/api/dev/generate-sample', {
      method: 'POST',
      body: JSON.stringify({ count, forceHighAccuracy }),
    }),

  resetDatabase: () =>
    apiFetch<any>('/api/dev/reset', { method: 'POST' }),

  drawNow: () =>
    apiFetch<{ success: boolean; activeRoundId: string; nextDrawTime: string }>('/api/admin/draw-now', {
      method: 'POST',
    }),

  // WinGo 1M Official Live Feed
  getWingoStatus: () =>
    apiFetch<WingoFeedStatus>('/api/wingo/status'),

  syncWingoFeed: () =>
    apiFetch<{ success: boolean; newItemsCount: number; activeRoundId: string; latestResult?: any; feedStatus: WingoFeedStatus }>('/api/wingo/sync', {
      method: 'POST',
    }),

  toggleWingoAutoSync: (enabled: boolean) =>
    apiFetch<{ success: boolean; feedStatus: WingoFeedStatus }>('/api/wingo/toggle', {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    }),
};

// WebSocket Client for Real-Time Synchronization
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private reconnectTimer: any = null;
  public isConnected = false;

  public connect() {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.notify('CONNECT', { connected: true });
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type) {
            this.notify(payload.type, payload.data);
          }
        } catch {
          // ignore
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.notify('DISCONNECT', { connected: false });
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.isConnected = false;
      };
    } catch (err) {
      console.warn('WebSocket connection error', err);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }

  public on(eventType: string, callback: (data: any) => void) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);
    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }

  private notify(eventType: string, data: any) {
    const set = this.listeners.get(eventType);
    if (set) {
      for (const cb of set) {
        try {
          cb(data);
        } catch (e) {
          console.error(e);
        }
      }
    }
  }
}

export const wsClient = new WebSocketClient();
