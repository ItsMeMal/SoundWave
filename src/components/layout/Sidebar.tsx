import React, { useState } from 'react';
import { 
  Home, 
  Search, 
  Library, 
  Heart, 
  Plus, 
  Music2, 
  ChevronDown, 
  LogOut, 
  Settings, 
  FolderPlus
} from 'lucide-react';
import { ViewType, Playlist } from '../../types/music.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { usePlayer } from '../../context/PlayerContext.tsx';

interface SidebarProps {
  currentView: ViewType;
  onNavigate: (view: ViewType, payload?: any) => void;
  userPlaylists: Playlist[];
  onOpenCreatePlaylist: () => void;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  userPlaylists,
  onOpenCreatePlaylist,
  className = ''
}) => {
  const { user, logout, openAuthModal } = useAuth();
  const { likedTrackIds } = usePlayer();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  return (
    <aside 
      className={`w-64 bg-[#0e1116] border-r border-[#1a1f29] flex flex-col justify-between shrink-0 select-none ${className}`}
      aria-label="SoundWave Primary Sidebar"
    >
      <div className="flex flex-col flex-1 overflow-y-auto custom-scrollbar">
        {/* Logo Lockup */}
        <div className="px-6 pt-6 pb-5 flex items-center gap-3">
          <div className="flex items-end gap-1 h-6">
            <span className="w-1.5 h-3.5 bg-emerald-400 rounded-full animate-pulse" />
            <span className="w-1.5 h-6 bg-emerald-400 rounded-full" />
            <span className="w-1.5 h-4 bg-emerald-400 rounded-full animate-pulse" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white font-['Plus_Jakarta_Sans']">
            SoundWave
          </span>
        </div>

        {/* Primary Navigation Links */}
        <nav className="px-3 space-y-1 mt-1">
          <button
            onClick={() => onNavigate('home')}
            className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              currentView === 'home'
                ? 'bg-[#1a202c] text-white shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-[#151922]'
            }`}
          >
            <Home className={`w-5 h-5 ${currentView === 'home' ? 'text-emerald-400' : 'text-zinc-400'}`} />
            <span>Home</span>
          </button>

          <button
            onClick={() => onNavigate('search')}
            className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              currentView === 'search'
                ? 'bg-[#1a202c] text-white shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-[#151922]'
            }`}
          >
            <Search className={`w-5 h-5 ${currentView === 'search' ? 'text-emerald-400' : 'text-zinc-400'}`} />
            <span>Search</span>
          </button>

          <button
            onClick={() => onNavigate('library')}
            className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              currentView === 'library'
                ? 'bg-[#1a202c] text-white shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-[#151922]'
            }`}
          >
            <Library className={`w-5 h-5 ${currentView === 'library' ? 'text-emerald-400' : 'text-zinc-400'}`} />
            <span>Your Library</span>
          </button>
        </nav>

        {/* Playlists Section Heading */}
        <div className="px-6 pt-7 pb-2 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            Playlists
          </span>
        </div>

        {/* Playlists Items */}
        <div className="px-3 space-y-1">
          {/* Liked Songs Entry */}
          <button
            onClick={() => onNavigate('liked')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all group ${
              currentView === 'liked'
                ? 'bg-[#1a202c] text-white font-medium'
                : 'text-zinc-300 hover:text-white hover:bg-[#151922]'
            }`}
          >
            <div className="w-6 h-6 rounded bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shrink-0 shadow-sm">
              <Heart className="w-3.5 h-3.5 text-white fill-white" />
            </div>
            <span className="truncate flex-1 text-left">Liked Songs</span>
            {likedTrackIds.size > 0 && (
              <span className="text-xs text-zinc-500 group-hover:text-zinc-400">
                {likedTrackIds.size}
              </span>
            )}
          </button>

          {/* Real User Playlists from Firestore (ZERO dummy items) */}
          {userPlaylists.map(pl => (
            <button
              key={pl.id}
              onClick={() => onNavigate('playlist', { playlistId: pl.id, initialPlaylist: pl, name: pl.name })}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-[#151922] transition-colors truncate text-left"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="truncate">{pl.name}</span>
            </button>
          ))}

          {/* Create Playlist Action */}
          <button
            onClick={onOpenCreatePlaylist}
            className="w-full flex items-center gap-3 px-3 py-2.5 mt-2 rounded-lg text-sm text-zinc-400 hover:text-emerald-400 hover:bg-[#151922] transition-all group font-medium"
          >
            <div className="w-5 h-5 rounded bg-[#1e232d] flex items-center justify-center group-hover:bg-emerald-500/20 text-zinc-300 group-hover:text-emerald-400">
              <Plus className="w-3.5 h-3.5" />
            </div>
            <span>Create Playlist</span>
          </button>
        </div>
      </div>

      {/* User Profile Footer Widget */}
      <div className="p-3 border-t border-[#1a1f29] relative">
        {user ? (
          <div>
            <button
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-[#151922] transition-all text-left group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={user.photoURL || `https://api.dicebear.com/7.x/identicon/svg?seed=${user.email || 'user'}`}
                  alt={user.displayName || 'User'}
                  className="w-9 h-9 rounded-full bg-zinc-800 object-cover border border-zinc-700/60"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate leading-snug">
                    {user.displayName || user.email?.split('@')[0] || 'User'}
                  </p>
                  <p className="text-[11px] text-zinc-400 truncate">
                    {user.email}
                  </p>
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${profileMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Profile Dropdown */}
            {profileMenuOpen && (
              <div className="absolute bottom-16 left-3 right-3 bg-[#161a22] border border-zinc-700/50 rounded-xl shadow-2xl p-1.5 z-50 space-y-0.5">
                <button
                  onClick={() => {
                    setProfileMenuOpen(false);
                    onNavigate('settings');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  <Settings className="w-4 h-4 text-zinc-400" />
                  <span>Settings</span>
                </button>
                <button
                  onClick={() => {
                    setProfileMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-rose-400 hover:bg-rose-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log out</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2 p-1">
            <button
              onClick={() => openAuthModal('login')}
              className="w-full py-2.5 px-3 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-black font-semibold text-sm transition-all shadow-md active:scale-95"
            >
              Sign In
            </button>
            <button
              onClick={() => openAuthModal('register')}
              className="w-full py-1.5 px-3 rounded-lg text-zinc-400 hover:text-white text-xs text-center transition-colors block"
            >
              Create Account
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
