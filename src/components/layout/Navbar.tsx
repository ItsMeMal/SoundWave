import React, { useState, useEffect, useRef } from 'react';
import { Search, Bell, X, User as UserIcon, Menu } from 'lucide-react';
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
  const searchBoxRef = useRef<HTMLDivElement>(null);

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

  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
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
        <span className="font-bold text-lg text-white">SoundWave</span>
      </div>

      {/* Center / Left Search Bar (Exact Reference Design) */}
      <div className="relative flex-1 max-w-xl hidden sm:block" ref={searchBoxRef}>
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
        <button
          onClick={() => alert('All notifications are up to date.')}
          className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-[#151922] transition-colors relative"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-400 rounded-full" />
        </button>

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
