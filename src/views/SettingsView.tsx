import React, { useEffect, useState } from 'react';
import { 
  ArrowLeft, 
  User, 
  Sliders, 
  Volume2, 
  Check, 
  Trash2, 
  ShieldCheck, 
  Sparkles,
  Info,
  BarChart3
} from 'lucide-react';
import { ViewType } from '../types/music.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { usePlayer } from '../context/PlayerContext.tsx';
import { getUserIsAdmin } from '../services/firebase.ts';
import { EqualizerControl } from '../components/common/EqualizerControl.tsx';

interface SettingsViewProps {
  onNavigate: (view: ViewType, payload?: any) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onNavigate }) => {
  const { user, openAuthModal, logout } = useAuth();
  const { playbackQuality, setPlaybackQuality, autoplay, toggleAutoplay } = usePlayer();
  const [cacheCleared, setCacheCleared] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setIsAdmin(false);
      return;
    }
    void getUserIsAdmin(user.uid).then(value => {
      if (!cancelled) setIsAdmin(value);
    }).catch(() => {
      if (!cancelled) setIsAdmin(false);
    });
    return () => { cancelled = true; };
  }, [user]);

  const qualities: Array<'Low' | 'Normal' | 'High' | 'Lossless'> = ['Low', 'Normal', 'High', 'Lossless'];

  const handleClearCache = () => {
    try {
      localStorage.removeItem('soundwave_cache');
      setCacheCleared(true);
      setTimeout(() => setCacheCleared(false), 3000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10 max-w-4xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => onNavigate('home')}
        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors mb-6 group"
      >
        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
        Back
      </button>

      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Settings</h1>
        <p className="text-sm text-zinc-400 mt-1">Manage your account preferences, audio quality, and app playback.</p>
        {isAdmin && (
          <button
            type="button"
            onClick={() => onNavigate('stats')}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-2.5 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-400/10"
          >
            <BarChart3 className="h-4 w-4" />
            Open Admin Analytics
          </button>
        )}
      </div>

      <div className="space-y-6">
        {/* Account Section */}
        <div className="bg-[#121620] rounded-xl border border-[#1e2432] p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-400" />
              Account
            </h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Sparkles className="w-3 h-3" />
              Full Free Access
            </span>
          </div>

          {user ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-lg">
                  {user.displayName ? user.displayName[0].toUpperCase() : user.email ? user.email[0].toUpperCase() : 'U'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{user.displayName || 'SoundWave Listener'}</p>
                  <p className="text-xs text-zinc-400">{user.email}</p>
                </div>
              </div>

              <button
                onClick={logout}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
              <div>
                <p className="text-sm font-semibold text-white">Not Signed In</p>
                <p className="text-xs text-zinc-400">Sign in to sync your liked songs and playlists across devices via Firebase.</p>
              </div>
              <button
                onClick={() => openAuthModal('login')}
                className="px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-colors shadow-sm"
              >
                Sign In / Register
              </button>
            </div>
          )}

          {/* Explanation regarding "Premium" */}
          <div className="mt-4 pt-4 border-t border-[#1e2432]/60 flex items-start gap-2.5 text-xs text-zinc-400">
            <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p>
              SoundWave gives all users full unlimited streaming access for free: ad-free playback, unlimited queue manipulation, synced lyrics, and custom playlists. No subscription or paid upgrade required.
            </p>
          </div>
        </div>

        {/* Audio Quality Section */}
        <div className="bg-[#121620] rounded-xl border border-[#1e2432] p-5 md:p-6">
          <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
            <Volume2 className="w-4 h-4 text-emerald-400" />
            Audio Quality
          </h2>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-2">
                Streaming Bitrate Quality
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {qualities.map((q) => {
                  const isSelected = playbackQuality === q;
                  return (
                    <button
                      key={q}
                      onClick={() => setPlaybackQuality(q)}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg border text-xs font-semibold transition-all ${
                        isSelected
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 shadow-sm'
                          : 'bg-[#181d2a] border-[#252c3c] text-zinc-400 hover:text-white hover:border-zinc-600'
                      }`}
                    >
                      <span>{q}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-zinc-500 mt-2">
                Higher quality delivers richer dynamic audio spectrum using modern OPUS & AAC encoders.
              </p>
            </div>

            <div className="pt-3 border-t border-[#1e2432]/60 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">Autoplay Similar Content</p>
                <p className="text-xs text-zinc-400">Continuously queue recommended songs when your current playlist ends.</p>
              </div>
              <button
                onClick={toggleAutoplay}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                  autoplay ? 'bg-emerald-500' : 'bg-zinc-700'
                }`}
                aria-label="Toggle Autoplay"
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    autoplay ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        <EqualizerControl />

        {/* Data & Storage Section */}
        <div className="bg-[#121620] rounded-xl border border-[#1e2432] p-5 md:p-6">
          <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
            <Sliders className="w-4 h-4 text-emerald-400" />
            Storage & Performance
          </h2>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Clear Cached Metadata</p>
              <p className="text-xs text-zinc-400">Free temporary memory and reset cached music responses.</p>
            </div>
            <button
              onClick={handleClearCache}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition-colors"
            >
              {cacheCleared ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Cleared</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Cache</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Cloud & Security Info */}
        <div className="flex items-center justify-center gap-2 text-xs text-zinc-500 py-4">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>SoundWave v2.5 • Powered by Music API & Firebase Firestore</span>
        </div>
      </div>
    </div>
  );
};
