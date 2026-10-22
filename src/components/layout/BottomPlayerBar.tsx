import React, { useState } from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Heart, 
  ChevronDown, 
  Volume2, 
  VolumeX, 
  Shuffle, 
  Repeat,
  Repeat1,
  FileText
} from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext.tsx';
import { formatTime } from '../../utils/formatters.ts';
import { ViewType } from '../../types/music.ts';

interface BottomPlayerBarProps {
  onNavigate: (view: ViewType, payload?: any) => void;
  className?: string;
}

export const BottomPlayerBar: React.FC<BottomPlayerBarProps> = ({ onNavigate, className = '' }) => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isShuffle,
    repeatMode,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    nextTrack,
    prevTrack,
    toggleLike,
    isLiked
  } = usePlayer();

  const [expanded, setExpanded] = useState(false);

  if (!currentTrack) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const isCurrentLiked = isLiked(currentTrack.id);

  return (
    <>
      {/* Mini Player Bar */}
      <div 
        className={`bg-[#12161f]/95 backdrop-blur-lg border-t border-[#1e2430] px-4 py-2 flex items-center justify-between select-none z-40 transition-all ${className}`}
      >
        <div 
          onClick={() => setExpanded(true)}
          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
        >
          <img
            src={currentTrack.thumbnailUrl}
            alt={currentTrack.title}
            onError={(e) => {
              (e.target as HTMLImageElement).src = currentTrack.id ? `https://i.ytimg.com/vi/${currentTrack.id}/hqdefault.jpg` : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&q=80';
            }}
            className="w-11 h-11 rounded-lg object-cover bg-zinc-800 shadow shrink-0"
          />
          <div className="min-w-0 pr-2">
            <p className="text-xs font-semibold text-white truncate hover:underline">
              {currentTrack.title}
            </p>
            <p className="text-[11px] text-zinc-400 truncate">
              {currentTrack.artist}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => toggleLike(currentTrack)}
            className="p-2 text-zinc-400 hover:text-white"
            aria-label="Like"
          >
            <Heart className={`w-4 h-4 ${isCurrentLiked ? 'text-emerald-400 fill-emerald-400' : ''}`} />
          </button>

          <button
            onClick={prevTrack}
            className="p-2 text-zinc-300 hover:text-white hidden sm:block"
            aria-label="Previous"
          >
            <SkipBack className="w-4 h-4 fill-current" />
          </button>

          <button
            onClick={togglePlay}
            className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-black" />
            ) : (
              <Play className="w-4 h-4 fill-black ml-0.5" />
            )}
          </button>

          <button
            onClick={nextTrack}
            className="p-2 text-zinc-300 hover:text-white"
            aria-label="Next"
          >
            <SkipForward className="w-4 h-4 fill-current" />
          </button>
        </div>

        {/* Progress line across top edge */}
        <div 
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            seek(pos * duration);
          }}
          className="absolute top-0 left-0 right-0 h-1 bg-zinc-800 cursor-pointer"
        >
          <div 
            className="h-full bg-emerald-400"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Expanded Full-Screen Player Modal */}
      {expanded && (
        <div className="fixed inset-0 bg-[#0c0f14] z-50 flex flex-col p-6 animate-in slide-in-from-bottom duration-300 select-none overflow-y-auto">
          <div className="flex items-center justify-between pb-4">
            <button
              onClick={() => setExpanded(false)}
              className="p-2 text-zinc-400 hover:text-white rounded-full bg-zinc-800/60"
              aria-label="Collapse"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
            <div className="text-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                Playing from SoundWave
              </span>
              <p className="text-xs text-white font-medium truncate max-w-[200px]">
                {currentTrack.album || currentTrack.title}
              </p>
            </div>
            <button
              onClick={() => {
                setExpanded(false);
                onNavigate('lyrics');
              }}
              className="p-2 text-zinc-400 hover:text-emerald-400 rounded-full bg-zinc-800/60"
              aria-label="Lyrics"
            >
              <FileText className="w-5 h-5" />
            </button>
          </div>

          <div className="my-auto py-6 max-w-sm mx-auto w-full">
            <div className="aspect-square rounded-2xl overflow-hidden shadow-2xl border border-zinc-800">
              <img
                src={currentTrack.thumbnailUrl}
                alt={currentTrack.title}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="mt-6 flex items-center justify-between">
              <div className="min-w-0 pr-4">
                <h2 className="text-xl font-bold text-white truncate">
                  {currentTrack.title}
                </h2>
                <p 
                  onClick={() => {
                    setExpanded(false);
                    onNavigate('artist', { name: currentTrack.artist });
                  }}
                  className="text-sm text-zinc-400 hover:text-emerald-400 cursor-pointer truncate mt-1"
                >
                  {currentTrack.artist}
                </p>
              </div>
              <button
                onClick={() => toggleLike(currentTrack)}
                className="p-2"
                aria-label="Like"
              >
                <Heart className={`w-6 h-6 ${isCurrentLiked ? 'text-emerald-400 fill-emerald-400' : 'text-zinc-400'}`} />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="mt-6 space-y-1">
              <div 
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pos = (e.clientX - rect.left) / rect.width;
                  seek(pos * duration);
                }}
                className="h-2 w-full bg-zinc-800 rounded-full cursor-pointer relative"
              >
                <div 
                  className="h-full bg-emerald-400 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-zinc-400 font-mono">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={toggleShuffle}
                className={`p-2 ${isShuffle ? 'text-emerald-400' : 'text-zinc-400'}`}
              >
                <Shuffle className="w-5 h-5" />
              </button>

              <button onClick={prevTrack} className="p-3 text-white">
                <SkipBack className="w-6 h-6 fill-current" />
              </button>

              <button
                onClick={togglePlay}
                className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-2xl active:scale-95"
              >
                {isPlaying ? <Pause className="w-7 h-7 fill-black" /> : <Play className="w-7 h-7 fill-black ml-1" />}
              </button>

              <button onClick={nextTrack} className="p-3 text-white">
                <SkipForward className="w-6 h-6 fill-current" />
              </button>

              <button
                onClick={cycleRepeat}
                className={`p-2 ${repeatMode !== 'off' ? 'text-emerald-400' : 'text-zinc-400'}`}
              >
                {repeatMode === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
              </button>
            </div>

            {/* Volume */}
            <div className="mt-8 flex items-center gap-3">
              <button onClick={toggleMute} className="text-zinc-400">
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded-full accent-emerald-400 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
