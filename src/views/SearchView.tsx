import React, { useState, useEffect, useRef } from 'react';
import { Search as SearchIcon, Play, Pause, Heart, MoreHorizontal, Loader2, Music, AlertCircle, RotateCcw } from 'lucide-react';
import { ViewType, Track } from '../types/music.ts';
import { searchMusic } from '../services/musicApi.ts';
import { usePlayer } from '../context/PlayerContext.tsx';
import { formatTime } from '../utils/formatters.ts';
import { CoverImage } from '../components/common/CoverImage.tsx';

interface SearchViewProps {
  initialQuery?: string;
  onNavigate: (view: ViewType, payload?: any) => void;
  onOpenAddToPlaylist?: (track: Track) => void;
}

type FilterChip = 'All' | 'Songs' | 'Artists' | 'Albums' | 'Playlists' | 'Videos';

export const SearchView: React.FC<SearchViewProps> = ({ 
  initialQuery = '', 
  onNavigate,
  onOpenAddToPlaylist 
}) => {
  const { playTrack, currentTrack, isPlaying, togglePlay, toggleLike, isLiked, addToQueue } = usePlayer();

  const [query, setQuery] = useState(initialQuery);
  const [activeChip, setActiveChip] = useState<FilterChip>('All');
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const activeRequestRef = useRef<number>(0);

  const filterChips: FilterChip[] = ['All', 'Songs', 'Artists', 'Albums', 'Playlists', 'Videos'];

  const performSearch = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    const requestId = ++activeRequestRef.current;
    setLoading(true);
    setError(null);

    try {
      // Append filter keyword if specific chip selected
      const queryWithFilter = activeChip !== 'All' && activeChip !== 'Songs'
        ? `${searchTerm.trim()} ${activeChip.toLowerCase()}`
        : searchTerm.trim();

      const res = await searchMusic(queryWithFilter, 20);

      // Ignore stale responses
      if (requestId === activeRequestRef.current) {
        setResults(res.tracks);
      }
    } catch (err: any) {
      if (requestId === activeRequestRef.current) {
        setError('Unable to load search results. Please check your connection and retry.');
      }
    } finally {
      if (requestId === activeRequestRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      performSearch(initialQuery);
    }
  }, [initialQuery]);

  useEffect(() => {
    if (query.trim()) {
      performSearch(query);
    }
  }, [activeChip]);

  const topResult = results.length > 0 ? results[0] : null;
  const songResults = results.slice(1);

  return (
    <div className="w-full min-w-0 p-4 sm:p-6 md:p-8 space-y-6 max-w-6xl mx-auto select-none">
      {/* Filter Category Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
        {filterChips.map((chip) => (
          <button
            key={chip}
            onClick={() => setActiveChip(chip)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              activeChip === chip
                ? 'bg-emerald-400 text-black shadow-md'
                : 'bg-[#181d26] text-zinc-300 hover:text-white hover:bg-[#202735]'
            }`}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-between text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => performSearch(query)}
            className="px-3.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 rounded-lg text-white font-medium flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-4 animate-pulse">
          <div className="h-28 bg-[#12161f] rounded-2xl w-full" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-14 bg-[#12161f] rounded-xl w-full" />
            ))}
          </div>
        </div>
      )}

      {/* Real API Search Results */}
      {!loading && topResult && (
        <div className="space-y-6">
          {/* Top Result Card */}
          <section>
            <h2 className="text-base font-bold text-white mb-3">Top result</h2>
            <div className="bg-[#12161f] border border-[#1e2330] p-5 rounded-2xl flex items-center justify-between group hover:bg-[#151a25] transition-all overflow-hidden">
              <div 
                onClick={() => playTrack(topResult, results)}
                className="flex items-center gap-4 min-w-0 pr-4 flex-1 cursor-pointer"
              >
                <CoverImage
                  src={topResult.thumbnailUrl}
                  videoId={topResult.id}
                  className="w-20 h-20 rounded-xl shadow-md"
                  iconSize="w-8 h-8"
                />
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors truncate">
                    {topResult.title}
                  </h3>
                  <p className="text-xs text-zinc-400 truncate mt-1">
                    {topResult.artist} • <span className="capitalize">Song</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 pr-1">
                <button
                  onClick={() => playTrack(topResult, results)}
                  className="w-12 h-12 rounded-full bg-emerald-400 hover:bg-emerald-300 text-black flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all shrink-0"
                  aria-label="Play Top Result"
                >
                  {currentTrack?.id === topResult.id && isPlaying ? (
                    <Pause className="w-5 h-5 fill-black" />
                  ) : (
                    <Play className="w-5 h-5 fill-black ml-0.5" />
                  )}
                </button>
                <button
                  onClick={() => toggleLike(topResult)}
                  className="p-2 text-zinc-400 hover:text-white shrink-0"
                  aria-label="Like"
                >
                  <Heart className={`w-5 h-5 ${isLiked(topResult.id) ? 'text-emerald-400 fill-emerald-400' : ''}`} />
                </button>
              </div>
            </div>
          </section>

          {/* Songs List */}
          <section>
            <h2 className="text-base font-bold text-white mb-3">Songs</h2>
            <div className="space-y-1">
              {songResults.map((track, idx) => {
                const isCurrent = currentTrack?.id === track.id;
                const liked = isLiked(track.id);
                return (
                  <div
                    key={`${track.id}-${idx}`}
                    className={`flex items-center justify-between p-2.5 rounded-xl hover:bg-[#141822] transition-colors group ${
                      isCurrent ? 'bg-emerald-500/10' : ''
                    }`}
                  >
                    <div
                      onClick={() => playTrack(track, results)}
                      className="flex items-center gap-3.5 min-w-0 flex-1 cursor-pointer"
                    >
                      <CoverImage
                        src={track.thumbnailUrl}
                        videoId={track.id}
                        className="w-11 h-11 rounded-lg shadow-sm"
                        iconSize="w-5 h-5"
                      />
                      <div className="min-w-0 pr-3">
                        <p className={`text-sm font-semibold truncate ${isCurrent ? 'text-emerald-400' : 'text-white'}`}>
                          {track.title}
                        </p>
                        <p className="text-xs text-zinc-400 truncate mt-0.5">
                          {track.artist} {track.album ? `• ${track.album}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <button
                        onClick={() => toggleLike(track)}
                        className="p-1.5 text-zinc-500 hover:text-white transition-colors"
                        aria-label="Like track"
                      >
                        <Heart className={`w-4 h-4 ${liked ? 'text-emerald-400 fill-emerald-400' : ''}`} />
                      </button>

                      <span className="text-xs text-zinc-400 font-mono w-10 text-right">
                        {formatTime(track.duration)}
                      </span>

                      <div className="relative">
                        <button
                          onClick={() => setActiveMenuId(activeMenuId === track.id ? null : track.id)}
                          className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition-colors"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {activeMenuId === track.id && (
                          <div className="absolute right-0 top-7 w-40 bg-[#1a1f29] border border-zinc-700/60 rounded-xl shadow-2xl py-1 z-50">
                            <button
                              onClick={() => {
                                addToQueue(track);
                                setActiveMenuId(null);
                              }}
                              className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:text-white hover:bg-zinc-800"
                            >
                              Add to queue
                            </button>
                            {onOpenAddToPlaylist && (
                              <button
                                onClick={() => {
                                  onOpenAddToPlaylist(track);
                                  setActiveMenuId(null);
                                }}
                                className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:text-white hover:bg-zinc-800"
                              >
                                Add to playlist
                              </button>
                            )}
                            <button
                              onClick={() => {
                                onNavigate('artist', { artistName: track.artists?.[0]?.name || track.artist, artistId: track.artists?.find((artist) => artist.id)?.id });
                                setActiveMenuId(null);
                              }}
                              className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:text-white hover:bg-zinc-800"
                            >
                              Go to artist
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* Empty State */}
      {!loading && query.trim() && results.length === 0 && !error && (
        <div className="py-20 text-center text-zinc-500 space-y-2">
          <Music className="w-12 h-12 mx-auto text-zinc-600" />
          <p className="text-sm font-medium text-white">No results found for "{query}"</p>
          <p className="text-xs text-zinc-400">Try searching with a different artist, song title, or album.</p>
        </div>
      )}

      {/* Initial Query Prompt */}
      {!loading && !query.trim() && (
        <div className="py-20 text-center text-zinc-500 space-y-2">
          <SearchIcon className="w-12 h-12 mx-auto text-zinc-600" />
          <p className="text-sm font-medium text-white">Search SoundWave</p>
          <p className="text-xs text-zinc-400">Find your favorite tracks, artists, albums, and playlists.</p>
        </div>
      )}
    </div>
  );
};
