import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  User, 
  Lock, 
  Share2, 
  Sliders, 
  Download, 
  PlaySquare, 
  Palette, 
  Globe, 
  ChevronRight, 
  Check, 
  Loader2,
  LogOut
} from 'lucide-react';
import { ViewType, UserSettings } from '../types/music.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { usePlayer } from '../context/PlayerContext.tsx';
import { getUserSettings, saveUserSettings } from '../services/firebase.ts';

interface SettingsViewProps {
  onNavigate: (view: ViewType) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onNavigate }) => {
  const { user, userProfile, logout, openAuthModal } = useAuth();
  const { autoplay, toggleAutoplay, playbackQuality, setPlaybackQuality } = usePlayer();

  const [downloadQuality, setDownloadQuality] = useState<'Low' | 'Normal' | 'High'>('High');
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark');
  const [language, setLanguage] = useState('English');
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  // Load preferences from Firestore if user is signed in
  useEffect(() => {
    if (user) {
      getUserSettings(user.uid).then(settings => {
        if (settings) {
          if (settings.playbackQuality) setPlaybackQuality(settings.playbackQuality);
          if (settings.downloadQuality) setDownloadQuality(settings.downloadQuality);
          if (settings.theme) setTheme(settings.theme);
          if (settings.language) setLanguage(settings.language);
        }
      }).catch(() => {});
    }
  }, [user]);

  const handleSavePreferences = async (newQuality?: 'Low' | 'Normal' | 'High' | 'Lossless', newLang?: string) => {
    if (!user) return;
    setSaving(true);
    const updated: UserSettings = {
      playbackQuality: newQuality || playbackQuality,
      downloadQuality,
      autoplay,
      theme,
      language: newLang || language
    };
    try {
      await saveUserSettings(user.uid, updated);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2000);
    } catch (e) {
      console.warn('Failed to save settings:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto space-y-8 select-none">
      {/* Header with back button */}
      <div className="flex items-center gap-4 pb-2 border-b border-zinc-800">
        <button
          onClick={() => onNavigate('home')}
          className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-white font-['Plus_Jakarta_Sans']">
          Settings
        </h1>
        {savedNotice && (
          <span className="ml-auto text-xs text-emerald-400 flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> Saved
          </span>
        )}
      </div>

      {/* Account Section (Matching reference UI) */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          Account
        </h2>
        <div className="bg-[#12161f] border border-[#1e2330] rounded-2xl overflow-hidden divide-y divide-[#181d28]">
          <div className="p-4 flex items-center justify-between hover:bg-[#151924] transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-zinc-400" />
              <div>
                <p className="text-sm font-medium text-white">Profile information</p>
                <p className="text-xs text-zinc-400">
                  {user ? (user.email || user.displayName) : 'Not signed in'}
                </p>
              </div>
            </div>
            {user ? (
              <span className="text-xs text-zinc-400 font-medium px-2.5 py-0.5 rounded bg-zinc-800">
                Active
              </span>
            ) : (
              <button
                onClick={() => openAuthModal('login')}
                className="text-xs text-emerald-400 hover:underline"
              >
                Sign in
              </button>
            )}
          </div>

          <div 
            onClick={() => user ? alert('Password change request sent to your email.') : openAuthModal('login')}
            className="p-4 flex items-center justify-between hover:bg-[#151924] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <Lock className="w-4 h-4 text-zinc-400" />
              <span className="text-sm font-medium text-white">Change password</span>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          </div>

          <div 
            onClick={() => alert('Connected services: Google, YouTube Music')}
            className="p-4 flex items-center justify-between hover:bg-[#151924] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <Share2 className="w-4 h-4 text-zinc-400" />
              <span className="text-sm font-medium text-white">Connected apps</span>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          </div>
        </div>
      </section>

      {/* Playback Section (Matching reference UI) */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          Playback
        </h2>
        <div className="bg-[#12161f] border border-[#1e2330] rounded-2xl overflow-hidden divide-y divide-[#181d28]">
          {/* Playback Quality */}
          <div className="p-4 flex items-center justify-between hover:bg-[#151924] transition-colors">
            <div className="flex items-center gap-3">
              <Sliders className="w-4 h-4 text-zinc-400" />
              <span className="text-sm font-medium text-white">Playback quality</span>
            </div>
            <select
              value={playbackQuality}
              onChange={(e) => {
                const q = e.target.value as any;
                setPlaybackQuality(q);
                handleSavePreferences(q);
              }}
              className="bg-[#181d26] border border-zinc-700/60 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
            >
              <option value="Low">Low (96kbps)</option>
              <option value="Normal">Normal (160kbps)</option>
              <option value="High">High (320kbps)</option>
              <option value="Lossless">Lossless Hi-Res</option>
            </select>
          </div>

          {/* Download Quality */}
          <div className="p-4 flex items-center justify-between hover:bg-[#151924] transition-colors">
            <div className="flex items-center gap-3">
              <Download className="w-4 h-4 text-zinc-400" />
              <span className="text-sm font-medium text-white">Download quality</span>
            </div>
            <select
              value={downloadQuality}
              onChange={(e) => {
                const q = e.target.value as any;
                setDownloadQuality(q);
              }}
              className="bg-[#181d26] border border-zinc-700/60 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
            >
              <option value="Low">Low</option>
              <option value="Normal">Normal</option>
              <option value="High">High</option>
            </select>
          </div>

          {/* Autoplay Toggle */}
          <div className="p-4 flex items-center justify-between hover:bg-[#151924] transition-colors">
            <div className="flex items-center gap-3">
              <PlaySquare className="w-4 h-4 text-zinc-400" />
              <span className="text-sm font-medium text-white">Autoplay</span>
            </div>
            <button
              onClick={() => {
                toggleAutoplay();
                handleSavePreferences();
              }}
              className={`w-10 h-5.5 rounded-full transition-colors relative p-0.5 flex items-center ${
                autoplay ? 'bg-emerald-500' : 'bg-zinc-700'
              }`}
              aria-label="Toggle Autoplay"
            >
              <div
                className={`w-4.5 h-4.5 rounded-full bg-white transition-transform ${
                  autoplay ? 'translate-x-4.5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* Appearance Section (Matching reference UI) */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          Appearance
        </h2>
        <div className="bg-[#12161f] border border-[#1e2330] rounded-2xl overflow-hidden divide-y divide-[#181d28]">
          <div className="p-4 flex items-center justify-between hover:bg-[#151924] transition-colors">
            <div className="flex items-center gap-3">
              <Palette className="w-4 h-4 text-zinc-400" />
              <span className="text-sm font-medium text-white">Theme</span>
            </div>
            <span className="text-xs text-zinc-400 font-medium">Dark</span>
          </div>

          <div className="p-4 flex items-center justify-between hover:bg-[#151924] transition-colors">
            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-zinc-400" />
              <span className="text-sm font-medium text-white">Language</span>
            </div>
            <select
              value={language}
              onChange={(e) => {
                setLanguage(e.target.value);
                handleSavePreferences(undefined, e.target.value);
              }}
              className="bg-[#181d26] border border-zinc-700/60 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
            >
              <option value="English">English</option>
              <option value="Indonesian">Bahasa Indonesia</option>
            </select>
          </div>
        </div>
      </section>

      {/* Logout Action if signed in */}
      {user && (
        <div className="pt-2">
          <button
            onClick={() => {
              logout();
              onNavigate('home');
            }}
            className="w-full py-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-sm font-semibold flex items-center justify-center gap-2 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Log out</span>
          </button>
        </div>
      )}
    </div>
  );
};
