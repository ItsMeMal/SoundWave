import React, { useState } from 'react';
import { Plus, Play, Music, Heart, Trash2, Disc, User, FolderPlus } from 'lucide-react';
import { ViewType, Playlist } from '../types/music.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { usePlayer } from '../context/PlayerContext.tsx';
import { deleteUserPlaylist } from '../services/firebase.ts';

interface LibraryViewProps {
  onNavigate: (view: ViewType, payload?: any) => void;
  userPlaylists: Playlist[];
  onOpenCreatePlaylist: () => void;
  onRefreshPlaylists: () => void;
}

type LibraryTab = 'Playlists' | 'Songs' | 'Liked Songs';

export const LibraryView: React.FC<LibraryViewProps> = ({
  onNavigate,
  userPlaylists,
  onOpenCreatePlaylist,
  onRefreshPlaylists
}) => {
  const { user, openAuthModal } = useAuth();
  const { likedTracksList, playTrack } = usePlayer();
  const [activeTab, setActiveTab] = useState<LibraryTab>('Playlists');

  const tabs: LibraryTab[] = ['Playlists', 'Songs', 'Liked Songs'];

  const handleDeletePlaylist = async (playlistId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    if (confirm('Are you sure you want to delete this playlist?')) {
      await deleteUserPlaylist(user.uid, playlistId);
      onRefreshPlaylists();
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl mx-auto select-none">
      {/* Title */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-white tracking-tight font-['Plus_Jakarta_Sans']">
          Your Library
        </h1>
        {activeTab === 'Playlists' && userPlaylists.length > 0 && (
          <button
            onClick={onOpenCreatePlaylist}
            className="px-4 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black text-xs font-bold transition-all shadow flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create Playlist</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              if (tab === 'Liked Songs') onNavigate('liked');
            }}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === tab
                ? 'bg-emerald-400 text-black shadow-md'
                : 'bg-[#181d26] text-zinc-300 hover:text-white hover:bg-[#202735]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Playlists Content (Real Firestore Playlists Only) */}
      {activeTab === 'Playlists' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-white tracking-wide">
              Your playlists ({userPlaylists.length})
            </span>
          </div>

          {userPlaylists.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {userPlaylists.map((pl) => (
                <div
                  key={pl.id}
                  onClick={() => onNavigate('playlist', { id: pl.id, playlist: pl, name: pl.name })}
                  className="bg-[#12161f]/60 hover:bg-[#161b26] p-3 rounded-xl border border-transparent hover:border-zinc-800 transition-all cursor-pointer group flex flex-col"
                >
                  <div className="relative aspect-square w-full mb-3 rounded-lg overflow-hidden shadow-md">
                    <img
                      src={pl.coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80'}
                      alt={pl.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <button
                      className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-emerald-400 text-black flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-2 shadow-xl transition-all"
                      aria-label={`Play ${pl.name}`}
                    >
                      <Play className="w-4 h-4 fill-black ml-0.5" />
                    </button>
                  </div>

                  <div className="flex items-start justify-between min-w-0">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xs font-bold text-white truncate group-hover:text-emerald-400">
                        {pl.name}
                      </h3>
                      <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                        {pl.trackCount} {pl.trackCount === 1 ? 'song' : 'songs'} • {user?.displayName || 'You'}
                      </p>
                    </div>

                    <button
                      onClick={(e) => handleDeletePlaylist(pl.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-rose-400 transition-opacity"
                      aria-label="Delete playlist"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center text-zinc-500 space-y-3">
              <FolderPlus className="w-12 h-12 mx-auto text-zinc-700" />
              <h3 className="text-base font-bold text-white">Create your first playlist</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                Organize your favorite songs by creating personalized playlists.
              </p>
              <button
                onClick={onOpenCreatePlaylist}
                className="px-5 py-2.5 rounded-full bg-emerald-400 hover:bg-emerald-300 text-black text-xs font-bold transition-all shadow mt-2"
              >
                + Create Playlist
              </button>
            </div>
          )}
        </div>
      )}

      {/* Songs Tab (Real Liked Songs from Firestore) */}
      {activeTab === 'Songs' && (
        <div className="space-y-2">
          {likedTracksList.length > 0 ? (
            likedTracksList.map((track, idx) => (
              <div
                key={track.id}
                onClick={() => playTrack(track, likedTracksList)}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-[#151922] transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="text-xs text-zinc-500 w-5 font-mono">{idx + 1}</span>
                  <img src={track.thumbnailUrl} alt={track.title} className="w-10 h-10 rounded-lg object-cover" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate group-hover:text-emerald-400">
                      {track.title}
                    </p>
                    <p className="text-xs text-zinc-400 truncate">{track.artist}</p>
                  </div>
                </div>
                <Play className="w-4 h-4 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))
          ) : (
            <div className="py-20 text-center text-zinc-500 space-y-2">
              <Music className="w-10 h-10 mx-auto text-zinc-600" />
              <p className="text-sm font-medium text-white">No saved tracks in your library yet.</p>
              <p className="text-xs text-zinc-400">Like songs by clicking the heart icon to see them here.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
