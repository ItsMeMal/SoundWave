import React, { useState, useEffect } from 'react';
import { ArrowLeft, Play, Pause, Heart, Clock, Trash2, Plus, Music, Loader2 } from 'lucide-react';
import { ViewType, Playlist, Track } from '../types/music.ts';
import { usePlayer } from '../context/PlayerContext.tsx';
import { formatTime } from '../utils/formatters.ts';
import { searchMusic } from '../services/musicApi.ts';
import { removeTrackFromUserPlaylist } from '../services/firebase.ts';
import { useAuth } from '../context/AuthContext.tsx';

interface PlaylistViewProps {
  playlistId: string;
  initialPlaylist?: Playlist;
  name?: string;
  onNavigate: (view: ViewType, payload?: any) => void;
  onRefreshPlaylists: () => void;
}

export const PlaylistView: React.FC<PlaylistViewProps> = ({
  playlistId,
  initialPlaylist,
  name,
  onNavigate,
  onRefreshPlaylists
}) => {
  const { user } = useAuth();
  const { playTrack, currentTrack, isPlaying, togglePlay, toggleLike, isLiked } = usePlayer();
  const [playlist, setPlaylist] = useState<Playlist | null>(initialPlaylist || null);
  const [loading, setLoading] = useState(!initialPlaylist);

  useEffect(() => {
    let isMounted = true;
    async function loadTracks() {
      if (initialPlaylist && initialPlaylist.tracks && initialPlaylist.tracks.length > 0) {
        setPlaylist(initialPlaylist);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const queryTerm = name || initialPlaylist?.name || 'Top hits';
        const res = await searchMusic(queryTerm, 18);
        if (isMounted) {
          setPlaylist({
            id: playlistId,
            name: name || initialPlaylist?.name || 'Playlist',
            description: initialPlaylist?.description || `A curated collection of ${queryTerm} vibes on SoundWave.`,
            coverUrl: initialPlaylist?.coverUrl || res.tracks[0]?.thumbnailUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80',
            trackCount: res.tracks.length,
            tracks: res.tracks,
            creator: initialPlaylist?.creator || user?.displayName || 'SoundWave'
          });
        }
      } catch (err) {
        console.warn('Playlist load notice:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadTracks();
    return () => { isMounted = false; };
  }, [playlistId, name, initialPlaylist]);

  const tracks = playlist?.tracks || [];

  const handlePlayAll = () => {
    if (tracks.length > 0) {
      playTrack(tracks[0], tracks);
    }
  };

  const handleRemoveTrack = async (trackId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || !playlist) return;
    await removeTrackFromUserPlaylist(user.uid, playlist.id, trackId);
    setPlaylist(prev => prev ? {
      ...prev,
      tracks: prev.tracks.filter(t => t.id !== trackId),
      trackCount: Math.max(0, prev.trackCount - 1)
    } : null);
    onRefreshPlaylists();
  };

  return (
    <div className="select-none pb-12">
      {/* Header Banner */}
      <div className="p-6 md:p-8 bg-gradient-to-b from-zinc-800/60 via-[#121620] to-[#0c0f14] border-b border-zinc-800/60">
        <button
          onClick={() => onNavigate('home')}
          className="self-start p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-black/40 transition-colors flex items-center gap-2 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-xs font-semibold">Back</span>
        </button>

        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center md:items-end gap-6">
          <img
            src={playlist?.coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80'}
            alt={playlist?.name || 'Playlist'}
            className="w-44 h-44 rounded-2xl object-cover shadow-2xl shrink-0 border border-zinc-700/50"
          />

          <div className="text-center md:text-left flex-1 min-w-0">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
              Playlist
            </span>
            <h1 className="text-2xl md:text-4xl font-extrabold text-white mt-1 tracking-tight font-['Plus_Jakarta_Sans']">
              {playlist?.name || name || 'Playlist'}
            </h1>
            <p className="text-xs text-zinc-400 mt-2 line-clamp-2">
              {playlist?.description}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              By <span className="text-zinc-300 font-medium">{playlist?.creator || 'Mallss'}</span> • {tracks.length} songs
            </p>

            {tracks.length > 0 && (
              <div className="mt-5 flex items-center justify-center md:justify-start gap-3">
                <button
                  onClick={handlePlayAll}
                  className="px-6 py-2.5 rounded-full bg-emerald-400 hover:bg-emerald-300 text-black font-bold text-sm flex items-center gap-2 shadow-lg transition-transform active:scale-95"
                >
                  <Play className="w-4 h-4 fill-black" />
                  <span>Play</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tracks List */}
      <div className="p-6 md:p-8 max-w-6xl mx-auto">
        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          </div>
        ) : tracks.length > 0 ? (
          <div className="space-y-1">
            <div className="grid grid-cols-12 px-4 py-2 text-xs font-semibold text-zinc-500 border-b border-zinc-800 mb-2">
              <span className="col-span-1">#</span>
              <span className="col-span-7 md:col-span-6">Title</span>
              <span className="hidden md:block md:col-span-4">Album</span>
              <span className="col-span-4 md:col-span-1 text-right flex justify-end">
                <Clock className="w-4 h-4" />
              </span>
            </div>

            {tracks.map((track, idx) => {
              const isCurrent = currentTrack?.id === track.id;
              const liked = isLiked(track.id);
              return (
                <div
                  key={`${track.id}-${idx}`}
                  onClick={() => playTrack(track, tracks)}
                  className={`grid grid-cols-12 items-center px-4 py-2.5 rounded-xl hover:bg-[#151922] transition-colors cursor-pointer group ${
                    isCurrent ? 'bg-emerald-500/10' : ''
                  }`}
                >
                  <span className="col-span-1 text-xs text-zinc-500 font-mono">
                    {isCurrent ? <span className="text-emerald-400 font-bold">▶</span> : idx + 1}
                  </span>

                  <div className="col-span-7 md:col-span-6 flex items-center gap-3 min-w-0 pr-3">
                    <img
                      src={track.thumbnailUrl}
                      alt={track.title}
                      className="w-10 h-10 rounded-lg object-cover bg-zinc-800 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold truncate ${isCurrent ? 'text-emerald-400' : 'text-white'}`}>
                        {track.title}
                      </p>
                      <p className="text-xs text-zinc-400 truncate">
                        {track.artist}
                      </p>
                    </div>
                  </div>

                  <span className="hidden md:block md:col-span-4 text-xs text-zinc-400 truncate pr-3">
                    {track.album || 'SoundWave'}
                  </span>

                  <div className="col-span-4 md:col-span-1 flex items-center justify-end gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLike(track);
                      }}
                      className="text-zinc-500 hover:text-white"
                    >
                      <Heart className={`w-4 h-4 ${liked ? 'text-emerald-400 fill-emerald-400' : ''}`} />
                    </button>
                    {playlist?.userId === user?.uid && (
                      <button
                        onClick={(e) => handleRemoveTrack(track.id, e)}
                        className="text-zinc-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Remove from playlist"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <span className="text-xs text-zinc-400 font-mono">
                      {formatTime(track.duration)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-20 text-center text-zinc-500 space-y-2">
            <Music className="w-10 h-10 mx-auto text-zinc-600" />
            <p className="text-sm">This playlist is currently empty.</p>
          </div>
        )}
      </div>
    </div>
  );
};
