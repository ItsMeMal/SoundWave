import React, { useState, useEffect, useRef } from 'react';
import { Search, Bell, X, Menu } from 'lucide-react';
import { ViewType } from '../../types/music.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { getSuggestions } from '../../services/musicApi.ts';

interface NavbarProps {
  currentView: ViewType;
  onNavigate: (view: ViewType, payload?: any) => void;
  onSearchSubmit: (query: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onToggleMobileMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  onSearchSubmit,
  searchQuery,
  setSearchQuery,
  onToggleMobileMenu
}) => {
  const { user, openAuthModal } = useAuth();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  // Debounced autocomplete suggestions
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const list = await getSuggestions(searchQuery);
        setSuggestions(list);
      } catch {
        setSuggestions([]);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (searchBoxRef.current && !searchBoxRef.current.contains(target)) {
        setShowSuggestions(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      setShowSuggestions(false);
      onSearchSubmit(searchQuery);
    }
  };

  const handleSelectSuggestion = (text: string) => {
    setSearchQuery(text);
    setShowSuggestions(false);
    onSearchSubmit(text);
  };

  return (
    <header className="h-16 px-6 flex items-center justify-between border-b border-[#1a1f29] bg-[#0b0d11]/80 backdrop-blur-md sticky top-0 z-30">
      {/* Mobile menu button */}
      <div className="flex items-center gap-3 md:hidden">
        <button
          onClick={onToggleMobileMenu}
          className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          aria-label="Toggle Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex items-end gap-1 h-5">
            <span className="w-1 h-3 bg-emerald-400 rounded-full" />
            <span className="w-1 h-5 bg-emerald-400 rounded-full" />
            <span className="w-1 h-3.5 bg-emerald-400 rounded-full" />
          </div>
          <span className="font-bold text-base text-white">SoundWave</span>
        </div>
      </div>

      {/* Center Search Bar */}
      <div className="relative flex-1 max-w-xl mx-2 sm:mx-4" ref={searchBoxRef}>
        <div className="flex items-center bg-[#151922] border border-[#232936] rounded-full px-4 py-2 focus-within:border-emerald-500/60 focus-within:ring-1 focus-within:ring-emerald-500/30 transition-all">
          <Search className="w-4 h-4 text-zinc-400 shrink-0 mr-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search songs, artists, albums, playlists..."
            className="w-full bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSuggestions([]);
              }}
              className="text-zinc-500 hover:text-white p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Suggestions Autocomplete Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-12 left-0 right-0 bg-[#161a22] border border-zinc-700/60 rounded-xl shadow-2xl py-2 z-50 overflow-hidden animate-in fade-in duration-150">
            {suggestions.map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectSuggestion(item)}
                className="w-full px-4 py-2 text-left text-sm text-zinc-300 hover:text-white hover:bg-zinc-800/80 flex items-center gap-3 transition-colors"
              >
                <Search className="w-3.5 h-3.5 text-zinc-500" />
                <span className="truncate">{item}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right Action Icons: Notification Bell & Avatar */}
      <div className="flex items-center gap-3">
        <div className="relative shrink-0" ref={notificationRef}>
          <button
            type="button"
            onClick={() => setShowNotifications(open => !open)}
            className={`p-2 rounded-full transition-colors relative ${showNotifications ? 'bg-[#151922] text-white' : 'text-zinc-400 hover:text-white hover:bg-[#151922]'}`}
            aria-label="Notifications"
            aria-expanded={showNotifications}
            aria-haspopup="dialog"
          >
            <Bell className="w-5 h-5" />
          </button>

          {showNotifications && (
            <div
              role="dialog"
              aria-label="Notification center"
              className="absolute right-0 top-12 z-[80] w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/10 bg-[#121720]/[0.98] shadow-2xl shadow-black/50 backdrop-blur-xl"
            >
              <div className="flex items-center gap-3 border-b border-white/5 px-4 py-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                  <Bell className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-bold text-white">Notifications</h2>
                  <p className="mt-0.5 text-[11px] text-zinc-500">SoundWave activity</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNotifications(false)}
                  className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
                  aria-label="Close notifications"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="px-5 py-8 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-white/5 bg-white/[0.03] text-zinc-500">
                  <Bell className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-semibold text-white">You’re all caught up</h3>
                <p className="mx-auto mt-1.5 max-w-[15rem] text-xs leading-relaxed text-zinc-400">
                  Account and playlist updates will appear here when notifications are available.
                </p>
              </div>
              <div className="border-t border-white/5 bg-black/10 px-4 py-2.5">
                <p className="text-center text-[10px] font-medium text-zinc-600">No new activity</p>
              </div>
            </div>
          )}
        </div>

        {user ? (
          <button
            onClick={() => onNavigate('settings')}
            className="relative flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-emerald-400/40 transition-all"
            aria-label="Account Settings"
          >
            <img
              src={user.photoURL || `https://api.dicebear.com/7.x/identicon/svg?seed=${user.email || 'user'}`}
              alt="Avatar"
              className="w-8 h-8 rounded-full object-cover border border-zinc-700"
            />
          </button>
        ) : (
          <button
            onClick={() => openAuthModal('login')}
            className="px-4 py-1.5 rounded-full bg-emerald-400 hover:bg-emerald-300 text-black text-xs font-semibold transition-all shadow"
          >
            Sign in
          </button>
        )}
      </div>
    </header>
  );
};
