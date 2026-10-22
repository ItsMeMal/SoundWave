import React, { useState, useEffect } from 'react';
import { Play, Plus, Check, ChevronRight, Music, AlertCircle, RotateCcw, Clock, Sparkles } from 'lucide-react';
import { ViewType, Track, PlaybackHistoryItem } from '../types/music.ts';
import { usePlayer } from '../context/PlayerContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { getGreeting } from '../utils/formatters.ts';
import { searchMusic, getRelatedTracks } from '../services/musicApi.ts';
import { subscribePlaybackHistory } from '../services/firebase.ts';
import { CoverImage } from '../components/common/CoverImage.tsx';

interface HomeViewProps {
  onNavigate: (view: ViewType, payload?: any) => void;
  onOpenCreatePlaylist: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onNavigate, onOpenCreatePlaylist }) => {
  const { user } = useAuth();
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();

  const [heroTrack, setHeroTrack] = useState<Track | null>(null);
  const [discoverTracks, setDiscoverTracks] = useState<Track[]>([]);
  const [madeForYouTracks, setMadeForYouTracks] = useState<Track[]>([]);
  const [historyItems, setHistoryItems] = useState<PlaybackHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [savedBanner, setSavedBanner] = useState<boolean>(false);

  const greeting = getGreeting();
  const userName = user?.displayName || user?.email?.split('@')[0] || 'Listener';

  // Load real history from Firestore with realtime onSnapshot
  useEffect(() => {
    if (!user) {
      setHistoryItems([]);
      return;
    }
    const unsub = subscribePlaybackHistory(user.uid, (items) => {
      setHistoryItems(items);
    });
    return () => unsub();
  }, [user]);

  // Load real music catalog from Music API
  const loadHomeMusic = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch real discover tracks from Music API
      const res = await searchMusic('popular songs hits', 16);
      const tracks = res.tracks;

      if (tracks.length > 0) {
        setHeroTrack(tracks[0]);
        setDiscoverTracks(tracks.slice(1, 9));

        // 2. Load "Made for You" from related tracks of the first song
        try {
          const related = await getRelatedTracks(tracks[0].id);
          if (related.length > 0) {
            setMadeForYouTracks(related.slice(0, 4));
          } else {
            setMadeForYouTracks(tracks.slice(9, 13));
          }
        } catch {
          setMadeForYouTracks(tracks.slice(9, 13));
        }
      }
    } catch (err: any) {
      console.warn('Home fetch notice:', err.message);
      setError('Unable to load music stream. Please check connection and retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHomeMusic();
  }, []);

  const handlePlayHero = () => {
    if (!heroTrack) return;
    if (currentTrack?.id === heroTrack.id) {
      togglePlay();
    } else {
      playTrack(heroTrack, discoverTracks.length > 0 ? [heroTrack, ...discoverTracks] : [heroTrack]);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8 select-none max-w-7xl mx-auto">
      {/* Error state */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-between text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadHomeMusic}
            className="px-3.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 rounded-lg text-white font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Top Grid: Hero Section + Made For You */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Hero Card */}
        <div className="lg:col-span-8 relative rounded-2xl overflow-hidden min-h-[260px] flex flex-col justify-between p-7 shadow-2xl border border-zinc-800/80 bg-zinc-900 group">
          {heroTrack ? (
            <>
              <img
                src={heroTrack.thumbnailUrl}
                alt=""
                onError={(e) => {
                  (e.target as HTMLImageElement).src = heroTrack.id ? `https://i.ytimg.com/vi/${heroTrack.id}/hqdefault.jpg` : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1000&q=80';
                }}
                className="absolute inset-0 w-full h-full object-cover opacity-45 group-hover:scale-102 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/65 to-transparent" />

              <div className="relative z-10">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  Featured Track
                </span>
                <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight font-['Plus_Jakarta_Sans'] mt-2">
                  {greeting}, {userName}
                </h1>
                <p className="text-sm text-zinc-300 mt-1 font-medium truncate max-w-lg">
                  {heroTrack.title} — {heroTrack.artist}
                </p>
              </div>

              <div className="relative z-10 flex flex-wrap items-end justify-between gap-4 pt-6">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handlePlayHero}
                    className="px-6 py-2.5 rounded-full bg-white hover:bg-zinc-100 text-black font-bold text-sm flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all"
                  >
                    <Play className="w-4 h-4 fill-black" />
                    <span>{currentTrack?.id === heroTrack.id && isPlaying ? 'Pause' : 'Play'}</span>
                  </button>
                  <button
                    onClick={() => setSavedBanner(!savedBanner)}
                    className={`px-5 py-2.5 rounded-full border text-sm font-semibold flex items-center gap-2 backdrop-blur-md transition-all active:scale-95 ${
                      savedBanner
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-400'
                        : 'bg-black/40 hover:bg-black/60 border-zinc-600/60 text-white'
                    }`}
                  >
                    {savedBanner ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    <span>{savedBanner ? 'Saved' : 'Save'}</span>
                  </button>
                </div>

                <div className="text-right hidden sm:block">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    Live Stream
                  </span>
                  <p className="text-sm font-bold text-white truncate max-w-[200px]">{heroTrack.artist}</p>
                </div>
              </div>
            </>
          ) : loading ? (
            <div className="h-full flex flex-col justify-between animate-pulse">
              <div className="h-6 w-48 bg-zinc-800 rounded mb-2" />
              <div className="h-4 w-72 bg-zinc-800 rounded" />
              <div className="h-10 w-32 bg-zinc-800 rounded-full mt-6" />
            </div>
          ) : (
            <div className="my-auto text-center space-y-2 text-zinc-500">
              <Music className="w-10 h-10 mx-auto text-zinc-600" />
              <p className="text-sm">Search for songs above to populate your player.</p>
            </div>
          )}
        </div>

        {/* Right "Made for you" Box */}
        <div className="lg:col-span-4 bg-[#12161f] border border-[#1d222e] rounded-2xl p-5 flex flex-col justify-between shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Made for you</span>
            </h2>
          </div>

          {loading ? (
            <div className="space-y-3 py-2 animate-pulse">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-zinc-800 rounded-lg" />
                  <div className="space-y-1 flex-1">
                    <div className="h-3 w-32 bg-zinc-800 rounded" />
                    <div className="h-2.5 w-20 bg-zinc-800 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : madeForYouTracks.length > 0 ? (
            <div className="space-y-2.5">
              {madeForYouTracks.map((track, idx) => (
                <div
                  key={`${track.id}-${idx}`}
                  onClick={() => playTrack(track, madeForYouTracks)}
                  className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-[#181d28] transition-colors cursor-pointer group"
                >
                  <CoverImage
                    src={track.thumbnailUrl}
                    videoId={track.id}
                    className="w-11 h-11 rounded-lg shadow-sm"
                    iconSize="w-5 h-5"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white group-hover:text-emerald-400 truncate">
                      {track.title}
                    </p>
                    <p className="text-[11px] text-zinc-400 truncate">
                      {track.artist}
                    </p>
                  </div>
                  <button 
                    className="w-8 h-8 rounded-full bg-emerald-400 group-hover:scale-105 text-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shrink-0"
                    aria-label="Play song"
                  >
                    <Play className="w-3.5 h-3.5 fill-black ml-0.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-500 py-6 text-center">
              Play songs to get tailored recommendations.
            </p>
          )}

          <div className="mt-4 pt-3 border-t border-[#1d222e]">
            <button
              onClick={() => onNavigate('search')}
              className="w-full py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold text-center transition-colors block"
            >
              Explore Music Catalog
            </button>
          </div>
        </div>
      </div>

      {/* Recently Played Section (Real User History from Firestore) */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-400" />
            <span>Recently played</span>
          </h2>
          {historyItems.length > 0 && (
            <button 
              onClick={() => onNavigate('library')}
              className="text-xs font-semibold text-zinc-400 hover:text-emerald-400 transition-colors"
            >
              See library
            </button>
          )}
        </div>

        {historyItems.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {historyItems.slice(0, 6).map((item) => {
              const trackObj: Track = {
                id: item.videoId || item.id,
                title: item.title,
                artist: item.artist,
                thumbnailUrl: item.thumbnailUrl,
                duration: item.duration || 180,
                source: 'history'
              };

              return (
                <div
                  key={item.id}
                  onClick={() => playTrack(trackObj)}
                  className="bg-[#12161f]/60 hover:bg-[#161b26] p-3 rounded-xl border border-transparent hover:border-zinc-800 transition-all cursor-pointer group flex flex-col"
                >
                  <div className="relative aspect-square w-full mb-3 overflow-hidden rounded-lg shadow-md">
                    <img
                      src={item.thumbnailUrl}
                      alt={item.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <button 
                      className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-emerald-400 text-black flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-2 shadow-xl transition-all"
                      aria-label={`Play ${item.title}`}
                    >
                      <Play className="w-4 h-4 fill-black ml-0.5" />
                    </button>
                  </div>
                  <h3 className="text-xs font-bold text-white truncate group-hover:text-emerald-400">
                    {item.title}
                  </h3>
                  <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                    {item.artist}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-[#12161f]/40 border border-[#1e2330] rounded-2xl p-6 text-center text-zinc-500">
            <Clock className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
            <p className="text-xs font-medium text-zinc-400">
              {user ? 'No listening history yet. Play songs to see them here!' : 'Sign in to sync your listening history across devices.'}
            </p>
          </div>
        )}
      </section>

      {/* Discover Music Section (Real Tracks from Music API) */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white tracking-tight">Discover Music</h2>
          <button 
            onClick={() => onNavigate('search')}
            className="text-xs font-semibold text-zinc-400 hover:text-emerald-400 transition-colors"
          >
            Search all
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4 animate-pulse">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="bg-[#12161f] p-3 rounded-xl space-y-2">
                <div className="aspect-square w-full bg-zinc-800 rounded-lg" />
                <div className="h-3 w-3/4 bg-zinc-800 rounded" />
                <div className="h-2.5 w-1/2 bg-zinc-800 rounded" />
              </div>
            ))}
          </div>
        ) : discoverTracks.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {discoverTracks.map((track, idx) => (
              <div
                key={`${track.id}-${idx}`}
                onClick={() => playTrack(track, discoverTracks)}
                className="bg-[#12161f]/60 hover:bg-[#161b26] p-3 rounded-xl border border-transparent hover:border-zinc-800 transition-all cursor-pointer group flex flex-col"
              >
                <div className="relative aspect-square w-full mb-3 rounded-lg overflow-hidden shadow-md">
                  <CoverImage
                    src={track.thumbnailUrl}
                    videoId={track.id}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    iconSize="w-8 h-8"
                  />
                  <button 
                    className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-emerald-400 text-black flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-2 shadow-xl transition-all"
                    aria-label="Play track"
                  >
                    <Play className="w-4 h-4 fill-black ml-0.5" />
                  </button>
                </div>
                <h3 className="text-xs font-bold text-white truncate group-hover:text-emerald-400">
                  {track.title}
                </h3>
                <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                  {track.artist}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-zinc-500">
            <p className="text-xs">No tracks returned from API right now.</p>
          </div>
        )}
      </section>
    </div>
  );
};
