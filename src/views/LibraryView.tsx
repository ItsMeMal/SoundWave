import React, { useState } from 'react';
import { Plus, Play, Music, Heart, Trash2, Disc, User, ListMusic } from 'lucide-react';
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

type LibraryTab = 'Playlists' | 'Albums' | 'Artists' | 'Songs' | 'Liked Songs';

export const LibraryView: React.FC<LibraryViewProps> = ({
  onNavigate,
  userPlaylists,
  onOpenCreatePlaylist,
  onRefreshPlaylists
}) => {
  const { user, openAuthModal } = useAuth();
  const { likedTracksList, playTrack } = usePlayer();
  const [activeTab, setActiveTab] = useState<LibraryTab>('Playlists');

  const tabs: LibraryTab[] = ['Playlists', 'Albums', 'Artists', 'Songs', 'Liked Songs'];

  // Seed default library playlists matching the reference mockup:
  // Chill Vibes, Indie Mix, Workout, Study Time, Anime OST
  const defaultLibraryPlaylists = [
    {
      id: 'pl_chill_vibes',
      name: 'Chill Vibes',
      coverUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&q=80',
      trackCount: 25,
      creator: user?.displayName || 'Mallss',
      description: 'Relaxing ambient and lo-fi beats for your calm moments.'
    },
    {
      id: 'pl_indie_mix',
      name: 'Indie Mix',
      coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80',
      trackCount: 42,
      creator: user?.displayName || 'Mallss',
      description: 'The finest indie alternative anthems and bedroom pop.'
    },
    {
      id: 'pl_workout',
      name: 'Workout',
      coverUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&q=80',
      trackCount: 38,
      creator: user?.displayName || 'Mallss',
      description: 'High energy basslines to push your limits.'
    },
    {
      id: 'pl_study_time',
      name: 'Study Time',
      coverUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=400&q=80',
      trackCount: 56,
      creator: user?.displayName || 'Mallss',
      description: 'Deep focus instrumental soundscapes.'
    },
    {
      id: 'pl_anime_ost',
      name: 'Anime OST',
      coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80',
      trackCount: 24,
      creator: user?.displayName || 'Mallss',
      description: 'Epic anime themes, openings, and emotional soundtracks.'
    }
  ];

  // Combine user custom playlists from Firestore with default items
  const allPlaylists = [...userPlaylists, ...defaultLibraryPlaylists];

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
        {activeTab === 'Playlists' && (
          <button
            onClick={onOpenCreatePlaylist}
            className="px-4 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black text-xs font-bold transition-all shadow flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create Playlist</span>
          </button>
        )}
      </div>

      {/* Filter Tabs (Exact match to reference mockup) */}
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

      {/* Playlists Content */}
      {activeTab === 'Playlists' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-white tracking-wide">Your playlists</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {allPlaylists.map((pl) => (
              <div
                key={pl.id}
                onClick={() => onNavigate('playlist', { id: pl.id, playlist: pl, name: pl.name })}
                className="bg-[#12161f]/60 hover:bg-[#161b26] p-3 rounded-xl border border-transparent hover:border-zinc-800 transition-all cursor-pointer group flex flex-col"
              >
                <div className="relative aspect-square w-full mb-3 rounded-lg overflow-hidden shadow-md">
                  <img
                    src={pl.coverUrl}
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
                      {pl.trackCount} songs • {pl.creator || 'Mallss'}
                    </p>
                  </div>

                  {userPlaylists.some(u => u.id === pl.id) && (
                    <button
                      onClick={(e) => handleDeletePlaylist(pl.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-rose-400 transition-opacity"
                      aria-label="Delete playlist"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Songs Tab */}
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
            <div className="py-16 text-center text-zinc-500">
              <Music className="w-10 h-10 mx-auto mb-2 text-zinc-600" />
              <p className="text-sm">No saved tracks in your library yet.</p>
            </div>
          )}
        </div>
      )}

      {/* Albums Tab */}
      {activeTab === 'Albums' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[
            { title: 'HIT ME HARD AND SOFT', artist: 'Billie Eilish', year: '2024', cover: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&q=80' },
            { title: 'GNX', artist: 'Kendrick Lamar', year: '2024', cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80' },
            { title: 'THE TORTURED POETS DEPARTMENT', artist: 'Taylor Swift', year: '2024', cover: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=400&q=80' },
            { title: 'After Hours', artist: 'The Weeknd', year: '2020', cover: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=400&q=80' },
          ].map((item, idx) => (
            <div
              key={idx}
              onClick={() => onNavigate('search', { query: `${item.title} ${item.artist}` })}
              className="bg-[#12161f]/60 hover:bg-[#161b26] p-3 rounded-xl border border-transparent hover:border-zinc-800 transition-all cursor-pointer group"
            >
              <img src={item.cover} alt={item.title} className="aspect-square w-full rounded-lg object-cover mb-3" />
              <h3 className="text-xs font-bold text-white truncate group-hover:text-emerald-400">{item.title}</h3>
              <p className="text-[11px] text-zinc-400 truncate mt-0.5">{item.artist} • {item.year}</p>
            </div>
          ))}
        </div>
      )}

      {/* Artists Tab */}
      {activeTab === 'Artists' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[
            { name: 'Billie Eilish', followers: '94M listeners', img: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&q=80' },
            { name: 'Kendrick Lamar', followers: '78M listeners', img: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80' },
            { name: 'The 1975', followers: '32M listeners', img: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&q=80' },
            { name: 'The Weeknd', followers: '112M listeners', img: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=400&q=80' },
            { name: 'SZA', followers: '68M listeners', img: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&q=80' },
          ].map((item, idx) => (
            <div
              key={idx}
              onClick={() => onNavigate('artist', { name: item.name })}
              className="bg-[#12161f]/60 hover:bg-[#161b26] p-4 rounded-xl border border-transparent hover:border-zinc-800 transition-all cursor-pointer group text-center"
            >
              <img src={item.img} alt={item.name} className="w-24 h-24 rounded-full object-cover mx-auto mb-3 shadow" />
              <h3 className="text-xs font-bold text-white truncate group-hover:text-emerald-400">{item.name}</h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">{item.followers}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
