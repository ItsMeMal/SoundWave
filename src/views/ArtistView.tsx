import React, { useState, useEffect } from 'react';
import { ArrowLeft, Play, Pause, Heart, CheckCircle2, Music, Loader2, AlertCircle, RotateCcw } from 'lucide-react';
import { ViewType, Track, ArtistDetail } from '../types/music.ts';
import { getArtistDetail, searchMusic } from '../services/musicApi.ts';
import { usePlayer } from '../context/PlayerContext.tsx';
import { formatTime } from '../utils/formatters.ts';

interface ArtistViewProps {
  artistName: string;
  artistId?: string;
  onNavigate: (view: ViewType, payload?: any) => void;
}

export const ArtistView: React.FC<ArtistViewProps> = ({ artistName, artistId, onNavigate }) => {
  const { playTrack, currentTrack, isPlaying, togglePlay, toggleLike, isLiked } = usePlayer();
  const [artistData, setArtistData] = useState<ArtistDetail | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);

  const loadArtist = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Try artist endpoint if artistId provided
      if (artistId) {
        const detail = await getArtistDetail(artistId);
        if (detail && detail.topTracks.length > 0) {
          setArtistData(detail);
          setTracks(detail.topTracks);
          setLoading(false);
          return;
        }
      }

      // 2. Fetch real tracks by artist name from API search
      const res = await searchMusic(artistName, 15);
      if (res.tracks.length > 0) {
        setTracks(res.tracks);
        setArtistData({
          id: artistId || artistName,
          name: artistName,
          topTracks: res.tracks,
        });
      } else {
        setTracks([]);
      }
    } catch (err: any) {
      setError('Unable to load artist information.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArtist();
  }, [artistName, artistId]);

  const topTrack = tracks[0];

  return (
    <div className="select-none pb-12">
      {/* Hero Banner */}
      <div className="relative min-h-[300px] bg-gradient-to-b from-emerald-950/60 via-[#121620] to-[#0c0f14] p-6 md:p-10 flex flex-col justify-between border-b border-zinc-800/60">
        <button
          onClick={() => onNavigate('home')}
          className="self-start p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-black/40 transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-xs font-semibold">Back</span>
        </button>

        <div className="flex flex-col md:flex-row items-center md:items-end gap-6 max-w-6xl mx-auto w-full pt-4">
          <img
            src={topTrack?.thumbnailUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80'}
            alt={artistName}
            className="w-40 h-40 rounded-full object-cover shadow-2xl border-2 border-emerald-500/30 bg-zinc-800"
          />

          <div className="flex-1 text-center md:text-left min-w-0">
            <div className="flex items-center justify-center md:justify-start gap-1.5 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
              <CheckCircle2 className="w-4 h-4 fill-emerald-400 text-black" />
              <span>Artist</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight font-['Plus_Jakarta_Sans']">
              {artistName}
            </h1>
            {artistData?.subscribers && (
              <p className="text-xs text-zinc-400 mt-2">
                {artistData.subscribers}
              </p>
            )}

            <div className="mt-5 flex items-center justify-center md:justify-start gap-3">
              {tracks.length > 0 && (
                <button
                  onClick={() => playTrack(tracks[0], tracks)}
                  className="px-6 py-2.5 rounded-full bg-emerald-400 hover:bg-emerald-300 text-black font-bold text-sm flex items-center gap-2 shadow-lg transition-transform active:scale-95"
                >
                  <Play className="w-4 h-4 fill-black" />
                  <span>Play</span>
                </button>
              )}
              <button
                onClick={() => setIsFollowing(!isFollowing)}
                className={`px-5 py-2.5 rounded-full border text-xs font-semibold transition-all ${
                  isFollowing
                    ? 'bg-zinc-800 border-zinc-700 text-white'
                    : 'border-zinc-700 hover:border-white text-white hover:bg-zinc-800'
                }`}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Top Tracks List */}
      <div className="p-6 md:p-10 max-w-6xl mx-auto">
        {error && (
          <div className="mb-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-between text-xs text-rose-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <span>{error}</span>
            </div>
            <button
              onClick={loadArtist}
              className="px-3.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 rounded-lg text-white font-medium flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
        )}

        <h2 className="text-lg font-bold text-white mb-4">Top tracks</h2>
        {loading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          </div>
        ) : tracks.length > 0 ? (
          <div className="space-y-1">
            {tracks.map((track, idx) => {
              const isCurrent = currentTrack?.id === track.id;
              const liked = isLiked(track.id);
              return (
                <div
                  key={`${track.id}-${idx}`}
                  onClick={() => playTrack(track, tracks)}
                  className={`flex items-center justify-between p-2.5 rounded-xl hover:bg-[#151922] transition-colors cursor-pointer group ${
                    isCurrent ? 'bg-emerald-500/10' : ''
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <span className="text-xs text-zinc-500 w-5 font-mono text-center">
                      {isCurrent ? <span className="text-emerald-400 font-bold">▶</span> : idx + 1}
                    </span>
                    <img
                      src={track.thumbnailUrl}
                      alt={track.title}
                      className="w-10 h-10 rounded-lg object-cover bg-zinc-800 shrink-0"
                    />
                    <div className="min-w-0 pr-3">
                      <p className={`text-sm font-semibold truncate ${isCurrent ? 'text-emerald-400' : 'text-white'}`}>
                        {track.title}
                      </p>
                      <p className="text-xs text-zinc-400 truncate">
                        {track.album || track.artist}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLike(track);
                      }}
                      className="p-1.5 text-zinc-500 hover:text-white"
                    >
                      <Heart className={`w-4 h-4 ${liked ? 'text-emerald-400 fill-emerald-400' : ''}`} />
                    </button>
                    <span className="text-xs text-zinc-400 font-mono">
                      {formatTime(track.duration)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center text-zinc-500">
            <Music className="w-10 h-10 mx-auto mb-2 text-zinc-600" />
            <p className="text-xs">No tracks found for this artist.</p>
          </div>
        )}
      </div>
    </div>
  );
};
