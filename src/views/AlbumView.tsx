import React, { useState, useEffect } from 'react';
import { ArrowLeft, Play, Pause, Heart, Clock, Disc, Loader2, AlertCircle, RotateCcw } from 'lucide-react';
import { ViewType, AlbumDetail, Track } from '../types/music.ts';
import { getAlbumDetail, searchMusic } from '../services/musicApi.ts';
import { usePlayer } from '../context/PlayerContext.tsx';
import { formatTime } from '../utils/formatters.ts';

interface AlbumViewProps {
  albumId: string;
  albumTitle?: string;
  artistName?: string;
  onNavigate: (view: ViewType, payload?: any) => void;
}

export const AlbumView: React.FC<AlbumViewProps> = ({
  albumId,
  albumTitle = 'Album',
  artistName = 'Unknown Artist',
  onNavigate
}) => {
  const { playTrack, currentTrack, isPlaying, togglePlay, toggleLike, isLiked } = usePlayer();
  const [album, setAlbum] = useState<AlbumDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAlbum = async () => {
    setLoading(true);
    setError(null);
    try {
      if (albumId) {
        const detail = await getAlbumDetail(albumId);
        if (detail && detail.tracks && detail.tracks.length > 0) {
          setAlbum(detail);
          setLoading(false);
          return;
        }
      }

      // Fallback: search query for album tracks
      const query = `${albumTitle} ${artistName}`.trim();
      const res = await searchMusic(query, 12);
      if (res.tracks.length > 0) {
        setAlbum({
          id: albumId || query,
          title: albumTitle,
          artist: artistName,
          coverUrl: res.tracks[0]?.thumbnailUrl || '',
          trackCount: res.tracks.length,
          tracks: res.tracks,
        });
      } else {
        setAlbum(null);
      }
    } catch {
      setError('Unable to load album tracks.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlbum();
  }, [albumId, albumTitle, artistName]);

  const tracks = album?.tracks || [];
  const coverUrl = album?.coverUrl || tracks[0]?.thumbnailUrl || '';
  const isCurrentAlbumPlaying = tracks.some(t => t.id === currentTrack?.id) && isPlaying;

  const handlePlayAlbum = () => {
    if (tracks.length === 0) return;
    if (isCurrentAlbumPlaying) {
      togglePlay();
    } else {
      playTrack(tracks[0], tracks);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8">
      {/* Back Button */}
      <button
        onClick={() => onNavigate('home')}
        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors mb-6 group"
      >
        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
        Back
      </button>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-zinc-400 gap-3">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-sm">Loading album details...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="w-12 h-12 text-rose-400 mb-3" />
          <h3 className="text-lg font-semibold text-white mb-1">Failed to load album</h3>
          <p className="text-sm text-zinc-400 mb-4">{error}</p>
          <button
            onClick={loadAlbum}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-full text-sm transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Retry
          </button>
        </div>
      ) : !album || tracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Disc className="w-12 h-12 text-zinc-600 mb-3" />
          <h3 className="text-lg font-semibold text-white mb-1">Album not found</h3>
          <p className="text-sm text-zinc-400">No tracks are available for this album.</p>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex flex-col md:flex-row items-center md:items-end gap-6 mb-8">
            <div className="w-48 h-48 md:w-56 md:h-56 rounded-xl overflow-hidden shadow-2xl bg-[#141820] shrink-0 border border-[#232936]">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt={album.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-600">
                  <Disc className="w-16 h-16" />
                </div>
              )}
            </div>

            <div className="flex flex-col items-center md:items-start text-center md:text-left flex-1 min-w-0">
              <span className="text-xs font-semibold tracking-wider uppercase text-emerald-400 mb-2">
                Album
              </span>
              <h1 className="text-2xl md:text-4xl lg:text-5xl font-black text-white tracking-tight mb-3 line-clamp-2">
                {album.title}
              </h1>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-sm text-zinc-400">
                <span
                  onClick={() => onNavigate('artist', { artistName: album.artist })}
                  className="text-white hover:text-emerald-400 font-medium cursor-pointer transition-colors"
                >
                  {album.artist}
                </span>
                {album.year && (
                  <>
                    <span>•</span>
                    <span>{album.year}</span>
                  </>
                )}
                <span>•</span>
                <span>{tracks.length} songs</span>
              </div>

              {/* Play All button */}
              <div className="mt-6 flex items-center gap-4">
                <button
                  onClick={handlePlayAlbum}
                  className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black flex items-center justify-center shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all"
                  aria-label={isCurrentAlbumPlaying ? 'Pause album' : 'Play album'}
                >
                  {isCurrentAlbumPlaying ? (
                    <Pause className="w-6 h-6 fill-black" />
                  ) : (
                    <Play className="w-6 h-6 fill-black ml-1" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Tracklist Table */}
          <div className="bg-[#12161f]/60 rounded-xl border border-[#1e2430] overflow-hidden">
            <div className="grid grid-cols-12 px-4 py-3 border-b border-[#1e2430] text-xs font-semibold uppercase tracking-wider text-zinc-400">
              <div className="col-span-1 text-center">#</div>
              <div className="col-span-7 md:col-span-8">Title</div>
              <div className="hidden md:block col-span-2 text-right">
                <Clock className="w-4 h-4 inline-block" />
              </div>
              <div className="col-span-4 md:col-span-1 text-center">Action</div>
            </div>

            <div className="divide-y divide-[#1e2430]/40">
              {tracks.map((track, idx) => {
                const isThisPlaying = currentTrack?.id === track.id && isPlaying;
                const isThisCurrent = currentTrack?.id === track.id;
                const liked = isLiked(track.id);

                return (
                  <div
                    key={`${track.id}-${idx}`}
                    className={`grid grid-cols-12 items-center px-4 py-3 group hover:bg-[#181e2b] transition-colors ${
                      isThisCurrent ? 'bg-[#181e2b]/80' : ''
                    }`}
                  >
                    {/* Track Number / Play Icon */}
                    <div className="col-span-1 flex items-center justify-center">
                      <button
                        onClick={() => {
                          if (isThisPlaying) {
                            togglePlay();
                          } else {
                            playTrack(track, tracks);
                          }
                        }}
                        className="w-6 h-6 flex items-center justify-center text-zinc-400 group-hover:text-white"
                      >
                        {isThisPlaying ? (
                          <div className="flex items-end gap-0.5 h-4">
                            <span className="w-1 h-3 bg-emerald-400 rounded-full animate-bounce" />
                            <span className="w-1 h-4 bg-emerald-400 rounded-full animate-bounce delay-100" />
                            <span className="w-1 h-2 bg-emerald-400 rounded-full animate-bounce delay-200" />
                          </div>
                        ) : (
                          <>
                            <span className="group-hover:hidden text-sm font-medium text-zinc-500">
                              {idx + 1}
                            </span>
                            <Play className="w-4 h-4 hidden group-hover:block fill-current" />
                          </>
                        )}
                      </button>
                    </div>

                    {/* Title & Artist */}
                    <div className="col-span-7 md:col-span-8 flex items-center gap-3 min-w-0 pr-2">
                      <img
                        src={track.thumbnailUrl}
                        alt={track.title}
                        className="w-10 h-10 rounded-md object-cover shrink-0 bg-[#161a22]"
                      />
                      <div className="min-w-0">
                        <p
                          className={`text-sm font-medium truncate cursor-pointer hover:underline ${
                            isThisCurrent ? 'text-emerald-400 font-semibold' : 'text-white'
                          }`}
                          onClick={() => playTrack(track, tracks)}
                        >
                          {track.title}
                        </p>
                        <p
                          className="text-xs text-zinc-400 truncate hover:text-zinc-200 cursor-pointer"
                          onClick={() => onNavigate('artist', { artistName: track.artist })}
                        >
                          {track.artist}
                        </p>
                      </div>
                    </div>

                    {/* Duration */}
                    <div className="hidden md:block col-span-2 text-right text-xs text-zinc-400 font-mono">
                      {formatTime(track.duration)}
                    </div>

                    {/* Actions */}
                    <div className="col-span-4 md:col-span-1 flex items-center justify-center">
                      <button
                        onClick={() => toggleLike(track)}
                        className={`p-1.5 rounded-full transition-colors ${
                          liked ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                        aria-label={liked ? 'Unlike' : 'Like'}
                      >
                        <Heart className={`w-4 h-4 ${liked ? 'fill-emerald-400' : ''}`} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
