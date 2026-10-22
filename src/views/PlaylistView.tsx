import React, { useState, useEffect } from 'react';
import { ArrowLeft, Play, Pause, Heart, Clock, Trash2, Plus, Music, Loader2, AlertCircle, RotateCcw, Share2 } from 'lucide-react';
import { ViewType, Playlist, Track } from '../types/music.ts';
import { usePlayer } from '../context/PlayerContext.tsx';
import { formatTime } from '../utils/formatters.ts';
import { getBrowsePlaylist, searchMusic } from '../services/musicApi.ts';
import { removeTrackFromUserPlaylist } from '../services/firebase.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { SharePlaylistModal } from '../components/modals/SharePlaylistModal.tsx';

interface PlaylistViewProps {
  playlistId: string;
  initialPlaylist?: Playlist;
  name?: string;
  onNavigate: (view: ViewType, payload?: any) => void;
  onRefreshPlaylists: () => void;
  isShared?: boolean;
  shareLoading?: boolean;
}

export const PlaylistView: React.FC<PlaylistViewProps> = ({
  playlistId,
  initialPlaylist,
  name,
  onNavigate,
  onRefreshPlaylists,
  isShared = false,
  shareLoading = false,
}) => {
  const { user } = useAuth();
  const { playTrack, currentTrack, isPlaying, togglePlay, toggleLike, isLiked } = usePlayer();
  const [playlist, setPlaylist] = useState<Playlist | null>(initialPlaylist || null);
  const [loading, setLoading] = useState(!initialPlaylist);
  const [error, setError] = useState<string | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const isOwnedPlaylist = !isShared && Boolean(user && playlist?.userId === user.uid);

  const loadPlaylist = async () => {
    if (isShared && shareLoading) {
      setLoading(true);
      return;
    }

    if (initialPlaylist && initialPlaylist.tracks) {
      setPlaylist(initialPlaylist);
      setLoading(false);
      setError(null);
      return;
    }

    if (isShared) {
      setPlaylist(null);
      setError('This shared playlist is unavailable or its owner disabled the link.');
      setLoading(false);
      return;
    }

    if (!playlistId) {
      setPlaylist(null);
      setError('Playlist could not be opened because its ID is missing. Return to Your Library and open it again.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // 1. Try browse playlist endpoint from API
      const apiPl = await getBrowsePlaylist(playlistId);
      if (apiPl && apiPl.tracks.length > 0) {
        setPlaylist(apiPl);
        setLoading(false);
        return;
      }

      // 2. Fallback search by query term if browsing curated topic
      if (name) {
        const res = await searchMusic(name, 18);
        setPlaylist({
          id: playlistId,
          name: name,
          description: `Collection of ${name} tracks on SoundWave.`,
          coverUrl: res.tracks[0]?.thumbnailUrl || '',
          trackCount: res.tracks.length,
          tracks: res.tracks,
          creator: 'SoundWave'
        });
      }
    } catch (err: any) {
      setError('Unable to load playlist.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlaylist();
  }, [playlistId, name, initialPlaylist, isShared, shareLoading]);

  const tracks = playlist?.tracks || [];

  const handlePlayAll = () => {
    if (tracks.length > 0) {
      playTrack(tracks[0], tracks);
    }
  };

  const handleRemoveTrack = async (trackId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || !playlist || isShared) return;
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
            src={playlist?.coverUrl || tracks[0]?.thumbnailUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80'}
            alt={playlist?.name || 'Playlist'}
            className="w-44 h-44 rounded-2xl object-cover shadow-2xl shrink-0 border border-zinc-700/50 bg-zinc-800"
          />

          <div className="text-center md:text-left flex-1 min-w-0">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
              {isShared ? 'Shared playlist' : 'Playlist'}
            </span>
            <h1 className="text-2xl md:text-4xl font-extrabold text-white mt-1 tracking-tight font-['Plus_Jakarta_Sans']">
              {playlist?.name || name || 'Playlist'}
            </h1>
            {playlist?.description && (
              <p className="text-xs text-zinc-400 mt-2 line-clamp-2">
                {playlist.description}
              </p>
            )}
            <p className="text-xs text-zinc-500 mt-1">
              By <span className="text-zinc-300 font-medium">{playlist?.creator || user?.displayName || 'SoundWave'}</span> • {tracks.length} songs
            </p>

            {(tracks.length > 0 || isOwnedPlaylist) && (
              <div className="mt-5 flex flex-wrap items-center justify-center md:justify-start gap-3">
                {tracks.length > 0 && (
                  <button
                    onClick={handlePlayAll}
                    className="px-6 py-2.5 rounded-full bg-emerald-400 hover:bg-emerald-300 text-black font-bold text-sm flex items-center gap-2 shadow-lg transition-transform active:scale-95"
                  >
                    <Play className="w-4 h-4 fill-black" />
                    <span>Play</span>
                  </button>
                )}
                {isOwnedPlaylist && (
                  <button
                    type="button"
                    onClick={() => setShareDialogOpen(true)}
                    className="px-5 py-2.5 rounded-full border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-white font-semibold text-sm flex items-center gap-2 transition-colors"
                  >
                    <Share2 className="w-4 h-4 text-emerald-300" />
                    <span>{playlist?.shareId ? 'Share link' : 'Share playlist'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tracks List */}
      <div className="p-6 md:p-8 max-w-6xl mx-auto">
        {error && (
          <div className="mb-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-between text-xs text-rose-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <span>{error}</span>
            </div>
            <button
              onClick={loadPlaylist}
              className="px-3.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 rounded-lg text-white font-medium flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
        )}

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
                    {!isShared && playlist?.userId === user?.uid && (
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
      <SharePlaylistModal
        isOpen={shareDialogOpen}
        playlist={playlist}
        onClose={() => setShareDialogOpen(false)}
        onShareChange={(shareId) => {
          setPlaylist(current => current ? { ...current, shareId } : current);
          onRefreshPlaylists();
        }}
      />
  );
};
