import React, { useState } from 'react';
import { Shield, Key, User, AlertCircle, Crown, Lock } from 'lucide-react';
import { api, authStorage } from '../api';
import { User as UserType } from '../types';

interface LoginModalProps {
  onLoginSuccess: (user: UserType) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !licenseKey.trim()) {
      setError('Please enter both your Username and VIP License Key.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await api.login(username.trim(), licenseKey.trim());
      authStorage.setToken(res.token);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify your license key.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-md bg-[#0c121e] border border-slate-800/90 rounded-2xl shadow-2xl p-6 sm:p-8 text-slate-100 overflow-hidden">
        {/* Glow background accent */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-rose-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Title */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-yellow-400 via-amber-500 to-yellow-600 shadow-xl shadow-yellow-500/25 mb-3 ring-1 ring-yellow-400/40">
            <Crown className="w-7 h-7 text-slate-950 fill-slate-950" />
          </div>
          <h2 className="text-2xl font-bold font-['Chakra_Petch',sans-serif] text-yellow-400 drop-shadow-[0_0_12px_rgba(250,204,21,0.4)] flex items-center justify-center gap-2">
            <span>AYUSH BHAI VIP PANEL</span>
            <span className="text-2xl">👑</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            VIP Colour Game Prediction & Quantitative Analytics Engine
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">Access Denied</span>
              {error}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                id="input-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              License Key
            </label>
            <div className="relative">
              <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                id="input-license"
                type="password"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="Enter your VIP license key"
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl py-2.5 pl-10 pr-4 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 transition-all"
                required
              />
            </div>
          </div>

          <button
            id="btn-login-submit"
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-rose-500 via-purple-600 to-indigo-600 hover:from-rose-400 hover:via-purple-500 hover:to-indigo-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-purple-600/25 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <>
                <Shield className="w-4 h-4" />
                <span>Verify License & Authenticate</span>
              </>
            )}
          </button>
        </form>

        {/* Quick Admin & VIP Logins */}
        <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-center">
            One-Click Login Credentials
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              id="btn-quick-admin"
              onClick={() => {
                setUsername('admin');
                setLicenseKey('admin');
              }}
              className="px-2.5 py-1.5 rounded-lg bg-purple-950/40 hover:bg-purple-900/50 border border-purple-500/30 text-xs text-purple-300 font-medium transition-colors text-center"
            >
              👑 Fill Admin (admin)
            </button>
            <button
              type="button"
              id="btn-quick-master"
              onClick={() => {
                setUsername('blessed.ayushh');
                setLicenseKey('ashut999');
              }}
              className="px-2.5 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/30 text-xs text-rose-300 font-medium transition-colors text-center"
            >
              💎 Master (ashut999)
            </button>
          </div>
        </div>

        {/* Security & Access Notice */}
        <div className="mt-4 pt-4 border-t border-slate-800">
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800/80 flex items-center justify-center gap-2.5 text-xs text-slate-400">
            <Lock className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="leading-tight">
              Admin Access: <strong>admin</strong> / <strong>admin</strong> (or key <strong>ashut999</strong>).
            </span>
          </div>
        </div>

        <p className="text-[11px] text-center text-slate-500 mt-4">
          All predictions are continuously verified using chronological walk-forward validation.
        </p>
      </div>
    </div>
  );
};
