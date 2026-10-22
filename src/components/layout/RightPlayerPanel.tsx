import React, { useState } from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Shuffle, 
  Repeat, 
  Repeat1, 
  Volume2, 
  VolumeX, 
  Heart, 
  MoreHorizontal, 
  FileText, 
  Trash2,
  Plus,
  Music,
  RotateCcw
} from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext.tsx';
import { formatTime } from '../../utils/formatters.ts';
import { ViewType, Track } from '../../types/music.ts';
import { SleepTimerControl } from '../common/SleepTimerControl.tsx';

interface RightPlayerPanelProps {
  onNavigate: (view: ViewType, payload?: any) => void;
  onOpenAddToPlaylist?: (track: Track) => void;
  className?: string;
}

export const RightPlayerPanel: React.FC<RightPlayerPanelProps> = ({ 
  onNavigate, 
  onOpenAddToPlaylist, 
  className = '' 
}) => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isShuffle,
    repeatMode,
    queue,
    queueIndex,
    autoplay,
    isStreamLoading,
    streamError,
    playTrack,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    nextTrack,
    prevTrack,
    removeFromQueue,
    clearQueue,
    toggleAutoplay,
    toggleLike,
    isLiked,
    retryCurrentStream
  } = usePlayer();

  const [activeTab, setActiveTab] = useState<'playing' | 'queue'>('playing');
  const [showOptions, setShowOptions] = useState(false);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const isCurrentLiked = currentTrack ? isLiked(currentTrack.id) : false;
  const upNextTracks = queue.slice(queueIndex + 1);

  return (
    <aside 
      className={`w-80 bg-[#0e1116] border-l border-[#1a1f29] flex flex-col h-full shrink-0 select-none overflow-y-auto custom-scrollbar ${className}`}
      aria-label="SoundWave Player and Queue Panel"
    >
      {/* Top Tabs: Playing | Queue */}
      <div className="p-4 pb-2 flex items-center justify-between border-b border-[#181d26]">
        <div className="flex bg-[#161a22] p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('playing')}
            className={`px-5 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'playing'
                ? 'bg-[#222834] text-white shadow'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Playing
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-5 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'queue'
                ? 'bg-[#222834] text-white shadow'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Queue {queue.length > 0 && `(${queue.length})`}
          </button>
        </div>

        {currentTrack && (
          <div className="relative">
            <button
              onClick={() => setShowOptions(!showOptions)}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-[#161a22] transition-colors"
              aria-label="Track Options"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>

            {showOptions && (
              <div className="absolute right-0 top-9 w-48 bg-[#181d26] border border-zinc-700/60 rounded-xl shadow-2xl py-1.5 z-50">
                <button
                  onClick={() => {
                    setShowOptions(false);
                    onNavigate('lyrics');
                  }}
                  className="w-full px-4 py-2 text-left text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-2.5"
                >
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span>View Lyrics</span>
                </button>
                {onOpenAddToPlaylist && (
                  <button
                    onClick={() => {
                      setShowOptions(false);
                      onOpenAddToPlaylist(currentTrack);
                    }}
                    className="w-full px-4 py-2 text-left text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-2.5"
                  >
                    <Plus className="w-4 h-4 text-emerald-400" />
                    <span>Add to Playlist</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowOptions(false);
                    toggleLike(currentTrack);
                  }}
                  className="w-full px-4 py-2 text-left text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-2.5"
                >
                  <Heart className="w-4 h-4 text-rose-400" />
                  <span>{isCurrentLiked ? 'Remove from Liked' : 'Save to Liked Songs'}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {activeTab === 'playing' ? (
        currentTrack ? (
          <div className="p-5 flex flex-col flex-1">
            {/* Square Album Artwork */}
            <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-[#161a22] shadow-2xl border border-zinc-800/80 group">
              <img
                src={currentTrack.thumbnailUrl}
                alt={currentTrack.title}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = currentTrack.id ? `https://i.ytimg.com/vi/${currentTrack.id}/hqdefault.jpg` : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80';
                }}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              {isStreamLoading && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              <button
                onClick={() => onNavigate('lyrics')}
                className="absolute bottom-3 right-3 px-3 py-1.5 rounded-full bg-black/70 hover:bg-black text-white text-xs font-medium backdrop-blur-md flex items-center gap-1.5 border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-400" />
                <span>Lyrics</span>
              </button>
            </div>

            {/* Error banner if stream failed */}
            {streamError && (
              <div className="mt-3 p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center justify-between text-xs text-rose-400">
                <span className="truncate pr-2">{streamError}</span>
                <button
                  onClick={retryCurrentStream}
                  className="flex items-center gap-1 text-xs font-bold text-white bg-rose-500/30 px-2 py-1 rounded hover:bg-rose-500/50"
                >
                  <RotateCcw className="w-3 h-3" /> Retry
                </button>
              </div>
            )}

            {/* Title, Artist, and Like Action */}
            <div className="mt-4 flex items-center justify-between">
              <div className="min-w-0 flex-1 pr-3">
                <h3 className="text-base font-bold text-white tracking-wide truncate">
                  {currentTrack.title}
                </h3>
                <p 
                  onClick={() => onNavigate('artist', { name: currentTrack.artist })}
                  className="text-xs text-zinc-400 hover:text-emerald-400 cursor-pointer truncate mt-0.5"
                >
                  {currentTrack.artist}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleLike(currentTrack)}
                  className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                  aria-label="Like Track"
                >
                  <Heart 
                    className={`w-5 h-5 transition-transform active:scale-125 ${
                      isCurrentLiked 
                        ? 'text-emerald-400 fill-emerald-400' 
                        : 'text-zinc-400 hover:text-white'
                    }`} 
                  />
                </button>
              </div>
            </div>

            {/* Timeline Scrubber */}
            <div className="mt-4 space-y-1">
              <div 
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickPos = (e.clientX - rect.left) / rect.width;
                  seek(clickPos * duration);
                }}
                className="relative h-1.5 w-full bg-[#202633] rounded-full cursor-pointer group"
              >
                <div 
                  className="absolute top-0 left-0 h-full bg-emerald-400 rounded-full transition-all group-hover:bg-emerald-300"
                  style={{ width: `${progressPercent}%` }}
                />
                <div 
                  className="absolute top-1/2 -translate-y-1/2 -ml-1.5 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 shadow transition-opacity"
                  style={{ left: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-zinc-500 font-medium">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls (Shuffle, Prev, Play/Pause, Next, Repeat) */}
            <div className="mt-3 flex items-center justify-between px-2">
              <button
                type="button"
                onClick={toggleShuffle}
                title={isShuffle ? 'Shuffle on' : 'Shuffle off'}
                className={`p-2 transition-colors relative ${
                  isShuffle ? 'text-emerald-400' : 'text-zinc-400 hover:text-white'
                }`}
                aria-label={isShuffle ? 'Disable shuffle' : 'Enable shuffle'}
                aria-pressed={isShuffle}
              >
                <Shuffle className="w-4 h-4" />
                {isShuffle && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-emerald-400 rounded-full" />}
              </button>

              <button
                onClick={prevTrack}
                className="p-2 text-zinc-300 hover:text-white active:scale-95 transition-all"
                aria-label="Previous Track"
              >
                <SkipBack className="w-5 h-5 fill-current" />
              </button>

              {/* Circular Play/Pause Button */}
              <button
                onClick={togglePlay}
                className="w-12 h-12 rounded-full bg-white hover:bg-zinc-200 text-black flex items-center justify-center shadow-lg active:scale-95 transition-all"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 fill-black text-black" />
                ) : (
                  <Play className="w-5 h-5 fill-black text-black ml-0.5" />
                )}
              </button>

              <button
                onClick={nextTrack}
                className="p-2 text-zinc-300 hover:text-white active:scale-95 transition-all"
                aria-label="Next Track"
              >
                <SkipForward className="w-5 h-5 fill-current" />
              </button>

              <button
                type="button"
                onClick={cycleRepeat}
                title={repeatMode === 'off' ? 'Repeat off' : repeatMode === 'all' ? 'Repeat playlist' : 'Repeat current track'}
                className={`p-2 transition-colors relative ${
                  repeatMode !== 'off' ? 'text-emerald-400' : 'text-zinc-400 hover:text-white'
                }`}
                aria-label={`Repeat mode: ${repeatMode}. Activate to change mode.`}
                aria-pressed={repeatMode !== 'off'}
              >
                {repeatMode === 'one' ? (
                  <Repeat1 className="w-4 h-4" />
                ) : (
                  <Repeat className="w-4 h-4" />
                )}
                {repeatMode !== 'off' && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-emerald-400 rounded-full" />
                )}
              </button>
            </div>

            {/* Volume Control */}
            <div className="mt-4 flex items-center gap-2.5 px-2">
              <button 
                onClick={toggleMute}
                className="text-zinc-400 hover:text-white transition-colors"
                aria-label="Mute / Unmute"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-full h-1 bg-[#202633] rounded-full accent-emerald-400 cursor-pointer"
                aria-label="Volume Slider"
              />
            </div>

            <SleepTimerControl className="mt-5" />

            {/* "Up next" Queue List with Autoplay Toggle */}
            <div className="mt-6 pt-4 border-t border-[#181d26] flex-1">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-white tracking-wide">Up next</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-zinc-400">Autoplay</span>
                  <button
                    onClick={toggleAutoplay}
                    className={`w-8 h-4.5 rounded-full transition-colors relative p-0.5 flex items-center ${
                      autoplay ? 'bg-emerald-500' : 'bg-zinc-700'
                    }`}
                    aria-label="Toggle Autoplay"
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                        autoplay ? 'translate-x-3.5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Real Up Next Items */}
              <div className="space-y-2">
                {upNextTracks.slice(0, 4).map((track, idx) => (
                  <div
                    key={`${track.id}-${idx}`}
                    onClick={() => playTrack(track, queue)}
                    className="flex items-center justify-between p-1.5 rounded-lg hover:bg-[#161a22] transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={track.thumbnailUrl}
                        alt={track.title}
                        className="w-10 h-10 rounded-md object-cover bg-zinc-800 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-white truncate group-hover:text-emerald-400">
                          {track.title}
                        </p>
                        <p className="text-[11px] text-zinc-400 truncate">
                          {track.artist}
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] text-zinc-500 font-mono pl-2 shrink-0">
                      {formatTime(track.duration)}
                    </span>
                  </div>
                ))}

                {upNextTracks.length === 0 && (
                  <p className="text-xs text-zinc-500 text-center py-4">
                    {autoplay ? 'SoundWave will auto-recommend similar songs.' : 'No more songs in queue.'}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Empty player state */
          <div className="p-8 my-auto text-center space-y-3 text-zinc-500">
            <Music className="w-12 h-12 mx-auto text-zinc-700" />
            <h3 className="text-sm font-bold text-white">No track selected</h3>
            <p className="text-xs text-zinc-400">
              Pick a song from Home, Search, or your Library to start playing.
            </p>
          </div>
        )
      ) : (
        /* Full Queue Management View */
        <div className="p-4 flex flex-col flex-1">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <span className="text-xs text-zinc-400 font-medium">
              {queue.length} {queue.length === 1 ? 'song' : 'songs'} in queue
            </span>
            {queue.length > 0 && (
              <button
                onClick={clearQueue}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>

          <div className="mt-3 space-y-1.5 flex-1 overflow-y-auto custom-scrollbar">
            {queue.map((track, idx) => {
              const isCurrent = idx === queueIndex;
              return (
                <div
                  key={`${track.id}-${idx}`}
                  className={`flex items-center justify-between p-2 rounded-lg transition-colors group ${
                    isCurrent ? 'bg-emerald-500/10 border border-emerald-500/30' : 'hover:bg-[#161a22]'
                  }`}
                >
                  <div 
                    onClick={() => playTrack(track, queue)}
                    className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                  >
                    <span className="text-xs text-zinc-500 w-4 font-mono text-center">
                      {isCurrent ? <span className="text-emerald-400 font-bold">▶</span> : idx + 1}
                    </span>
                    <img
                      src={track.thumbnailUrl}
                      alt={track.title}
                      className="w-9 h-9 rounded object-cover bg-zinc-800 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-medium truncate ${isCurrent ? 'text-emerald-400' : 'text-white'}`}>
                        {track.title}
                      </p>
                      <p className="text-[11px] text-zinc-400 truncate">
                        {track.artist}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-zinc-500 font-mono">
                      {formatTime(track.duration)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromQueue(idx);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-rose-400 p-1 transition-opacity"
                      aria-label="Remove from queue"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {queue.length === 0 && (
              <div className="py-16 text-center text-zinc-500 space-y-2">
                <Music className="w-8 h-8 mx-auto text-zinc-700" />
                <p className="text-xs">Your queue is empty.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
