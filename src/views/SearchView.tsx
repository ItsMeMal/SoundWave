import React, { useState, useEffect } from 'react';
import { Search as SearchIcon, Play, Pause, Heart, MoreHorizontal, Loader2, Music, AlertCircle } from 'lucide-react';
import { ViewType, Track } from '../types/music.ts';
import { searchMusic } from '../services/musicApi.ts';
import { usePlayer } from '../context/PlayerContext.tsx';
import { formatTime } from '../utils/formatters.ts';

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

  const filterChips: FilterChip[] = ['All', 'Songs', 'Artists', 'Albums', 'Playlists', 'Videos'];

  // Trigger search
  const performSearch = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await searchMusic(searchTerm.trim(), 20);
      setResults(res.tracks);
    } catch (err: any) {
      console.error('Search error:', err);
      setError('Unable to load search results. Please check your network and retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      performSearch(initialQuery);
    } else {
      // Default initial query matching reference screenshot
      performSearch('dreams');
      setQuery('dreams');
    }
  }, [initialQuery]);

  const topResult = results.length > 0 ? results[0] : null;
  const songResults = results.slice(1);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl mx-auto select-none">
      {/* Search Input Bar (Visible especially on mobile or dedicated search page) */}
      <div className="relative">
        <div className="flex items-center bg-[#151922] border border-[#232936] rounded-xl px-4 py-3 focus-within:border-emerald-500/60 focus-within:ring-1 focus-within:ring-emerald-500/30 transition-all">
          <SearchIcon className="w-5 h-5 text-zinc-400 mr-3 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && performSearch(query)}
            placeholder="Search songs, artists, albums, playlists..."
            className="w-full bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none"
          />
          {loading ? (
            <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
          ) : (
            <button
              onClick={() => performSearch(query)}
              className="text-xs px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-md font-medium transition-colors"
            >
              Search
            </button>
          )}
        </div>
      </div>

      {/* Filter Chips (Exact reference match) */}
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
            className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 rounded-lg text-white font-medium"
          >
            Retry
          </button>
        </div>
      )}

      {/* Top Result Card & Songs Section (Exact layout from reference UI) */}
      {topResult && (
        <div className="space-y-6">
          {/* Top Result Card */}
          <section>
            <h2 className="text-base font-bold text-white mb-3">Top result</h2>
            <div className="bg-[#12161f] border border-[#1e2330] p-5 rounded-2xl flex items-center justify-between group hover:bg-[#151a25] transition-all">
              <div 
                onClick={() => playTrack(topResult, results)}
                className="flex items-center gap-4 min-w-0 flex-1 cursor-pointer"
              >
                <img
                  src={topResult.thumbnailUrl}
                  alt={topResult.title}
                  className="w-20 h-20 rounded-xl object-cover bg-zinc-800 shadow-md shrink-0"
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

              <div className="flex items-center gap-3 shrink-0 ml-4">
                <button
                  onClick={() => playTrack(topResult, results)}
                  className="w-12 h-12 rounded-full bg-emerald-400 hover:bg-emerald-300 text-black flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
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
                  className="p-2 text-zinc-400 hover:text-white"
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
              {(songResults.length > 0 ? songResults : [topResult]).map((track, idx) => {
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
                      <img
                        src={track.thumbnailUrl}
                        alt={track.title}
                        className="w-11 h-11 rounded-lg object-cover bg-zinc-800 shrink-0 shadow-sm"
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
                            <button
                              onClick={() => {
                                onOpenAddToPlaylist?.(track);
                                setActiveMenuId(null);
                              }}
                              className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:text-white hover:bg-zinc-800"
                            >
                              Add to playlist
                            </button>
                            <button
                              onClick={() => {
                                onNavigate('artist', { name: track.artist });
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
      {!loading && results.length === 0 && !error && (
        <div className="py-16 text-center text-zinc-500 space-y-2">
          <Music className="w-12 h-12 mx-auto text-zinc-600" />
          <p className="text-sm font-medium">No results found for "{query}".</p>
          <p className="text-xs text-zinc-500">Try searching for song titles, artist names, or albums.</p>
        </div>
      )}
    </div>
  );
};
