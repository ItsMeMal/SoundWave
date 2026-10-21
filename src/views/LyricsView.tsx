import React, { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Music, RefreshCw, Volume2 } from 'lucide-react';
import { ViewType } from '../types/music.ts';
import { usePlayer } from '../context/PlayerContext.tsx';
import { parseLyrics, LyricLine } from '../utils/formatters.ts';

interface LyricsViewProps {
  onNavigate: (view: ViewType) => void;
}

export const LyricsView: React.FC<LyricsViewProps> = ({ onNavigate }) => {
  const { currentTrack, lyrics, lyricsLoading, fetchLyricsForCurrent, currentTime, seek } = usePlayer();
  const [parsedLines, setParsedLines] = useState<LyricLine[]>([]);

  useEffect(() => {
    if (lyrics?.lyrics) {
      setParsedLines(parseLyrics(lyrics.lyrics));
    } else {
      setParsedLines([]);
    }
  }, [lyrics]);

  // Find active line index based on current playback time
  const activeIndex = parsedLines.findIndex((line, i) => {
    if (line.time === undefined) return false;
    const nextLineTime = parsedLines[i + 1]?.time ?? Infinity;
    return currentTime >= line.time && currentTime < nextLineTime;
  });

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto space-y-8 select-none">
      {/* Top Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
        <button
          onClick={() => onNavigate('home')}
          className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-xs font-semibold">Back</span>
        </button>

        <div className="text-center">
          <h2 className="text-sm font-bold text-white truncate max-w-xs">
            {currentTrack?.title || 'No song selected'}
          </h2>
          <p className="text-xs text-zinc-400 truncate">
            {currentTrack?.artist || 'SoundWave'}
          </p>
        </div>

        <button
          onClick={() => fetchLyricsForCurrent()}
          className="p-2 text-zinc-400 hover:text-emerald-400 rounded-lg hover:bg-zinc-800 transition-colors"
          title="Reload lyrics"
        >
          <RefreshCw className={`w-4 h-4 ${lyricsLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Lyrics Display */}
      {lyricsLoading ? (
        <div className="py-24 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
          <p className="text-sm text-zinc-400">Loading verified lyrics...</p>
        </div>
      ) : parsedLines.length > 0 ? (
        <div className="space-y-6 py-6 text-center md:text-left font-['Plus_Jakarta_Sans']">
          {parsedLines.map((line, idx) => {
            const isActive = idx === activeIndex;
            return (
              <p
                key={idx}
                onClick={() => line.time !== undefined && seek(line.time)}
                className={`text-xl md:text-2xl font-bold tracking-tight transition-all duration-300 cursor-pointer ${
                  isActive
                    ? 'text-white scale-102 font-extrabold drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                    : 'text-zinc-600 hover:text-zinc-300'
                }`}
              >
                {line.text}
              </p>
            );
          })}

          <div className="pt-10 pb-6 text-xs text-zinc-500 text-center border-t border-zinc-800/80">
            {lyrics?.source || 'Source: Musixmatch'}
          </div>
        </div>
      ) : (
        <div className="py-24 text-center space-y-3 text-zinc-500">
          <Music className="w-12 h-12 mx-auto text-zinc-600" />
          <h3 className="text-base font-bold text-white">No lyrics available</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            We couldn't find lyrics for this track right now. Enjoy the melody!
          </p>
          <button
            onClick={() => fetchLyricsForCurrent()}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold mt-3"
          >
            Retry fetch
          </button>
        </div>
      )}
    </div>
  );
};
