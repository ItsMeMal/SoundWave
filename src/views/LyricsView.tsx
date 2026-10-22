import React, { useEffect, useRef, useState, useMemo } from 'react';
import { ArrowLeft, Music, Loader2, AlertCircle, RotateCcw, Volume2, Sparkles } from 'lucide-react';
import { ViewType } from '../types/music.ts';
import { usePlayer } from '../context/PlayerContext.tsx';
import { parseLyrics } from '../utils/formatters.ts';

interface LyricsViewProps {
  onNavigate: (view: ViewType, payload?: any) => void;
}

export const LyricsView: React.FC<LyricsViewProps> = ({ onNavigate }) => {
  const { currentTrack, currentTime, lyrics, lyricsLoading, fetchLyricsForCurrent, seek } = usePlayer();
  const activeLineRef = useRef<HTMLParagraphElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);

  // Fetch lyrics if not present for current track
  useEffect(() => {
    if (currentTrack && (!lyrics || lyrics.id !== currentTrack.id)) {
      fetchLyricsForCurrent();
    }
  }, [currentTrack?.id]);

  // Parse structured lines
  const parsedLines = useMemo(() => {
    if (!lyrics?.lyrics) return [];
    return parseLyrics(lyrics.lyrics);
  }, [lyrics?.lyrics]);

  // Determine active line index based on playback currentTime
  const activeIndex = useMemo(() => {
    if (parsedLines.length === 0) return -1;
    let foundIndex = -1;
    for (let i = 0; i < parsedLines.length; i++) {
      const lineTime = parsedLines[i].time;
      if (lineTime !== undefined && lineTime <= currentTime) {
        foundIndex = i;
      } else if (lineTime !== undefined && lineTime > currentTime) {
        break;
      }
    }
    return foundIndex;
  }, [parsedLines, currentTime]);

  // Auto-scroll active lyric into view if user isn't actively manual scrolling
  useEffect(() => {
    if (!userScrolled && activeLineRef.current && containerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeIndex, userScrolled]);

  // Reset userScrolled timeout after user interaction
  const handleScroll = () => {
    setUserScrolled(true);
    const timeout = setTimeout(() => setUserScrolled(false), 5000);
    return () => clearTimeout(timeout);
  };

  return (
    <div 
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10 relative bg-gradient-to-b from-[#111927]/60 via-[#0a0d14] to-[#0a0d14]"
    >
      {/* Top Bar with Back Button */}
      <div className="flex items-center justify-between mb-8 sticky top-0 bg-[#0a0d14]/80 backdrop-blur-md py-2 z-10">
        <button
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          Back
        </button>

        {lyrics?.source && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Synced Lyrics ({lyrics.source})</span>
          </div>
        )}
      </div>

      {!currentTrack ? (
        <div className="flex flex-col items-center justify-center py-28 text-center">
          <Music className="w-12 h-12 text-zinc-600 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">No song is playing</h2>
          <p className="text-sm text-zinc-400 max-w-sm mb-6">
            Play a track from Home or Search to see real-time synced lyrics.
          </p>
          <button
            onClick={() => onNavigate('home')}
            className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-full text-sm transition-colors"
          >
            Explore Music
          </button>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto">
          {/* Track Banner */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-[#141822]/80 border border-[#1f2636] mb-8 shadow-lg">
            <img
              src={currentTrack.thumbnailUrl}
              alt={currentTrack.title}
              className="w-16 h-16 rounded-lg object-cover shadow-md shrink-0 bg-[#1e2433]"
            />
            <div className="min-w-0 flex-1">
              <h1 className="text-lg md:text-xl font-bold text-white truncate">
                {currentTrack.title}
              </h1>
              <p
                onClick={() => onNavigate('artist', { artistName: currentTrack.artist })}
                className="text-sm text-zinc-400 truncate hover:text-emerald-400 cursor-pointer transition-colors"
              >
                {currentTrack.artist}
              </p>
            </div>
          </div>

          {/* Lyrics Content */}
          {lyricsLoading ? (
            <div className="flex flex-col items-center justify-center py-24 text-zinc-400 gap-3">
              <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
              <p className="text-sm">Fetching lyrics for {currentTrack.title}...</p>
            </div>
          ) : !lyrics?.lyrics || parsedLines.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-[#131720]/40 rounded-2xl border border-[#1d2332] p-8">
              <AlertCircle className="w-10 h-10 text-zinc-500 mb-3" />
              <h3 className="text-lg font-semibold text-white mb-1">
                Lyrics not available
              </h3>
              <p className="text-sm text-zinc-400 max-w-md mb-6">
                We couldn't find verified lyrics for "{currentTrack.title}". Instrumental or newly released tracks may not have synced lyrics.
              </p>
              <button
                onClick={fetchLyricsForCurrent}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#1f2636] hover:bg-[#283247] text-white rounded-full text-sm font-medium transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Retry Search
              </button>
            </div>
          ) : (
            <div className="space-y-6 pb-20 select-none">
              {parsedLines.map((line, idx) => {
                const isActive = idx === activeIndex;
                const isPast = activeIndex !== -1 && idx < activeIndex;
                const isClickable = line.time !== undefined;

                return (
                  <p
                    key={idx}
                    ref={isActive ? activeLineRef : null}
                    onClick={() => {
                      if (line.time !== undefined) {
                        seek(line.time);
                      }
                    }}
                    className={`transition-all duration-300 ${
                      isClickable ? 'cursor-pointer' : ''
                    } ${
                      isActive
                        ? 'text-white text-2xl md:text-3xl font-extrabold tracking-tight scale-102 origin-left py-1 text-emerald-400 drop-shadow-md'
                        : isPast
                        ? 'text-zinc-500 hover:text-zinc-300 text-lg md:text-xl font-medium'
                        : 'text-zinc-600 hover:text-zinc-400 text-lg md:text-xl font-medium'
                    }`}
                  >
                    {line.text}
                  </p>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
