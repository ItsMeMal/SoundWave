import React, { useState, useEffect } from 'react';
import { Play, Plus, Check, ChevronRight, Sparkles, Flame, Radio, Dumbbell, Compass, Heart } from 'lucide-react';
import { ViewType, Track, Playlist } from '../types/music.ts';
import { usePlayer } from '../context/PlayerContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { getGreeting } from '../utils/formatters.ts';
import { searchMusic } from '../services/musicApi.ts';

interface HomeViewProps {
  onNavigate: (view: ViewType, payload?: any) => void;
  onOpenCreatePlaylist: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onNavigate, onOpenCreatePlaylist }) => {
  const { user, userProfile } = useAuth();
  const { playTrack, currentTrack, isPlaying, togglePlay, toggleLike, isLiked } = usePlayer();

  const [savedBanner, setSavedBanner] = useState(false);
  const [trendingTracks, setTrendingTracks] = useState<Track[]>([]);
  const [recentTracks, setRecentTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  const greeting = getGreeting();
  const userName = user?.displayName || userProfile?.displayName || 'Mallss';

  // Seed curated tracks to ensure instant gorgeous view on first paint while API fetches
  const heroPlaylist: Track[] = [
    {
      id: 'WKZO-CWeOVA',
      title: 'BIRDS OF A FEATHER',
      artist: 'Billie Eilish',
      album: 'HIT ME HARD AND SOFT',
      thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&q=80',
      duration: 210,
    },
    {
      id: 'LUNCH_TRACK',
      title: 'LUNCH',
      artist: 'Billie Eilish',
      album: 'HIT ME HARD AND SOFT',
      thumbnailUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&q=80',
      duration: 179,
    },
    {
      id: 'LOVELY_TRACK',
      title: 'lovely',
      artist: 'Billie Eilish, Khalid',
      album: '13 Reasons Why',
      thumbnailUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600&q=80',
      duration: 200,
    }
  ];

  // Recently played cards matching reference image:
  // Chill Vibes, Good Days, The 1975, Midnight, Sonne, After Hours
  const referenceRecent = [
    {
      id: 'rec_1',
      title: 'Chill Vibes',
      subtitle: 'Playlist • Mallss',
      type: 'playlist',
      cover: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&q=80',
      isArtist: false,
      searchQuery: 'Chill Vibes'
    },
    {
      id: 'rec_2',
      title: 'Good Days',
      subtitle: 'Album • SZA',
      type: 'album',
      cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80',
      isArtist: false,
      searchQuery: 'Good Days SZA'
    },
    {
      id: 'rec_3',
      title: 'The 1975',
      subtitle: 'Artist',
      type: 'artist',
      cover: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&q=80',
      isArtist: true,
      searchQuery: 'The 1975'
    },
    {
      id: 'rec_4',
      title: 'Midnight',
      subtitle: 'Playlist • Mallss',
      type: 'playlist',
      cover: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=400&q=80',
      isArtist: false,
      searchQuery: 'Midnight'
    },
    {
      id: 'rec_5',
      title: 'Sonne',
      subtitle: 'Song • Rammstein',
      type: 'song',
      cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80',
      isArtist: false,
      searchQuery: 'Sonne Rammstein'
    },
    {
      id: 'rec_6',
      title: 'After Hours',
      subtitle: 'Album • The Weeknd',
      type: 'album',
      cover: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=400&q=80',
      isArtist: false,
      searchQuery: 'After Hours The Weeknd'
    }
  ];

  // New releases matching reference image:
  // GNX (Kendrick Lamar), HIT ME HARD AND SOFT (Billie Eilish), THE TORTURED POETS DEPARTMENT (Taylor Swift)
  const newReleases = [
    {
      title: 'GNX',
      artist: 'Kendrick Lamar',
      type: 'Album',
      cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&q=80',
      search: 'Kendrick Lamar GNX'
    },
    {
      title: 'HIT ME HARD AND SOFT',
      artist: 'Billie Eilish',
      type: 'Album',
      cover: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=200&q=80',
      search: 'Billie Eilish HIT ME HARD AND SOFT'
    },
    {
      title: 'THE TORTURED POETS DEPARTMENT',
      artist: 'Taylor Swift',
      type: 'Album',
      cover: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=200&q=80',
      search: 'Taylor Swift Tortured Poets'
    }
  ];

  // Fetch real trending tracks from API on mount
  useEffect(() => {
    let isMounted = true;
    async function loadTrending() {
      try {
        const res = await searchMusic('trending songs 2024', 12);
        if (isMounted && res.tracks.length > 0) {
          setTrendingTracks(res.tracks);
        }
      } catch (err) {
        console.warn('Trending fetch fallback:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadTrending();
    return () => { isMounted = false; };
  }, []);

  const handlePlayHero = () => {
    if (currentTrack?.id === heroPlaylist[0].id) {
      togglePlay();
    } else {
      playTrack(heroPlaylist[0], heroPlaylist);
    }
  };

  const handleCardClick = async (queryStr: string) => {
    try {
      const res = await searchMusic(queryStr, 5);
      if (res.tracks.length > 0) {
        playTrack(res.tracks[0], res.tracks);
      }
    } catch {
      onNavigate('search', { query: queryStr });
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8 select-none max-w-7xl mx-auto">
      {/* Top Grid: Hero Banner + "Made for you" side box (Exact Reference Match) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Hero Card (8 cols on desktop) */}
        <div className="lg:col-span-8 relative rounded-2xl overflow-hidden min-h-[260px] flex flex-col justify-between p-7 shadow-2xl border border-zinc-800/80 bg-zinc-900 group">
          {/* Moody Dusk Landscape Background */}
          <img
            src="https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1200&q=80"
            alt="Dusk Landscape"
            className="absolute inset-0 w-full h-full object-cover opacity-45 group-hover:scale-102 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-transparent" />

          {/* Top text */}
          <div className="relative z-10">
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight font-['Plus_Jakarta_Sans']">
              {greeting}, {userName}
            </h1>
            <p className="text-sm text-zinc-300 mt-1 font-medium">
              Here's what's playing for you today.
            </p>
          </div>

          {/* Bottom Actions and Playlist Info */}
          <div className="relative z-10 flex flex-wrap items-end justify-between gap-4 pt-6">
            <div className="flex items-center gap-3">
              <button
                onClick={handlePlayHero}
                className="px-6 py-2.5 rounded-full bg-white hover:bg-zinc-100 text-black font-bold text-sm flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all"
              >
                <Play className="w-4 h-4 fill-black" />
                <span>Play</span>
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

            {/* Right label matching image */}
            <div className="text-right hidden sm:block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Playlist
              </span>
              <p className="text-base font-bold text-white">Evening Vibes</p>
              <span className="text-xs text-zinc-400">50 songs • 3h 12m</span>
            </div>
          </div>
        </div>

        {/* Right "Made for you" Box (4 cols on desktop) */}
        <div className="lg:col-span-4 bg-[#12161f] border border-[#1d222e] rounded-2xl p-5 flex flex-col justify-between shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-white tracking-wide">Made for you</h2>
          </div>

          {/* Discover Weekly Featured Card */}
          <div 
            onClick={() => handleCardClick('Discover Weekly')}
            className="relative rounded-xl overflow-hidden p-4 bg-gradient-to-br from-purple-700 via-indigo-600 to-blue-700 shadow-md group cursor-pointer flex items-center justify-between"
          >
            <div className="min-w-0 pr-3 text-white">
              <h3 className="font-bold text-sm tracking-tight">Discover Weekly</h3>
              <p className="text-xs text-purple-200 mt-0.5">Your weekly mixtape</p>
            </div>
            <button 
              className="w-10 h-10 rounded-full bg-emerald-400 group-hover:scale-110 text-black flex items-center justify-center shadow-lg transition-transform shrink-0"
              aria-label="Play Discover Weekly"
            >
              <Play className="w-4 h-4 fill-black ml-0.5" />
            </button>
          </div>

          {/* Curated list */}
          <div className="mt-4 space-y-2">
            {[
              { name: 'Chill Vibes', source: 'Spotify', img: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=100&q=80' },
              { name: 'Indie Mix', source: 'YouTube Music', img: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&q=80' },
              { name: 'Workout Mix', source: 'YouTube Music', img: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=100&q=80' }
            ].map((item, idx) => (
              <div
                key={idx}
                onClick={() => handleCardClick(item.name)}
                className="flex items-center gap-3 p-1.5 rounded-lg hover:bg-[#181d28] transition-colors cursor-pointer group"
              >
                <img
                  src={item.img}
                  alt={item.name}
                  className="w-10 h-10 rounded-md object-cover bg-zinc-800 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white group-hover:text-emerald-400 truncate">
                    {item.name}
                  </p>
                  <p className="text-[11px] text-zinc-400 truncate">
                    Playlist • {item.source}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recently Played Section (Exact cards from reference image) */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white tracking-tight">Recently played</h2>
          <button 
            onClick={() => onNavigate('library')}
            className="text-xs font-semibold text-zinc-400 hover:text-emerald-400 transition-colors"
          >
            See all
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {referenceRecent.map((item) => (
            <div
              key={item.id}
              onClick={() => handleCardClick(item.searchQuery)}
              className="bg-[#12161f]/60 hover:bg-[#161b26] p-3 rounded-xl border border-transparent hover:border-zinc-800 transition-all cursor-pointer group flex flex-col"
            >
              <div className="relative aspect-square w-full mb-3 overflow-hidden shadow-md">
                <img
                  src={item.cover}
                  alt={item.title}
                  className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                    item.isArtist ? 'rounded-full' : 'rounded-lg'
                  }`}
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
                {item.subtitle}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Trending Section + New Releases Side Column */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Trending Column (8 cols) */}
        <section className="lg:col-span-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">Trending</h2>
            </div>
            <button 
              onClick={() => onNavigate('search', { query: 'Trending songs' })}
              className="text-xs font-semibold text-zinc-400 hover:text-emerald-400 transition-colors"
            >
              See all
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {(trendingTracks.length > 0 ? trendingTracks.slice(0, 8) : heroPlaylist).map((track, idx) => {
              const liked = isLiked(track.id);
              return (
                <div
                  key={`${track.id}-${idx}`}
                  onClick={() => playTrack(track, trendingTracks)}
                  className="bg-[#12161f]/60 hover:bg-[#161b26] p-3 rounded-xl border border-transparent hover:border-zinc-800 transition-all cursor-pointer group flex flex-col"
                >
                  <div className="relative aspect-square w-full mb-3 rounded-lg overflow-hidden shadow-md">
                    <img
                      src={track.thumbnailUrl}
                      alt={track.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
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
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-[11px] text-zinc-400 truncate">
                      {track.artist}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLike(track);
                      }}
                      className="text-zinc-500 hover:text-rose-400 p-0.5"
                    >
                      <Heart className={`w-3.5 h-3.5 ${liked ? 'text-emerald-400 fill-emerald-400' : ''}`} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* New Releases Section (4 cols - Exact reference match) */}
        <section className="lg:col-span-4 bg-[#12161f] border border-[#1d222e] rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white tracking-wide">New releases</h2>
              <button 
                onClick={() => onNavigate('search', { query: 'New albums 2024' })}
                className="text-xs font-semibold text-zinc-400 hover:text-emerald-400 transition-colors"
              >
                See all
              </button>
            </div>

            <div className="space-y-3">
              {newReleases.map((album, idx) => (
                <div
                  key={idx}
                  onClick={() => handleCardClick(album.search)}
                  className="flex items-center gap-3.5 p-2 rounded-xl hover:bg-[#181d28] transition-colors cursor-pointer group"
                >
                  <img
                    src={album.cover}
                    alt={album.title}
                    className="w-12 h-12 rounded-lg object-cover bg-zinc-800 shadow shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs font-bold text-white group-hover:text-emerald-400 truncate uppercase">
                      {album.title}
                    </h3>
                    <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                      {album.artist} • {album.type}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-white transition-colors shrink-0" />
                </div>
              ))}
            </div>
          </div>

          {/* Quick Create Playlist CTA at bottom of widget */}
          <div className="mt-6 pt-4 border-t border-[#1d222e]">
            <button
              onClick={onOpenCreatePlaylist}
              className="w-full py-2.5 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Playlist</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
