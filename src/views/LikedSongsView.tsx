import React from 'react';
import { Heart, Play, Clock, Music } from 'lucide-react';
import { ViewType, Track } from '../types/music.ts';
import { usePlayer } from '../context/PlayerContext.tsx';
import { formatTime } from '../utils/formatters.ts';

interface LikedSongsViewProps {
  onNavigate: (view: ViewType, payload?: any) => void;
}

export const LikedSongsView: React.FC<LikedSongsViewProps> = ({ onNavigate }) => {
  const { likedTracksList, playTrack, currentTrack, isPlaying, togglePlay, toggleLike, isLiked } = usePlayer();

  const handlePlayAll = () => {
    if (likedTracksList.length > 0) {
      playTrack(likedTracksList[0], likedTracksList);
    }
  };

  return (
    <div className="select-none pb-12">
      {/* Header Banner */}
      <div className="p-6 md:p-8 bg-gradient-to-b from-indigo-900/60 via-[#121620] to-[#0c0f14] border-b border-zinc-800/60">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center md:items-end gap-6">
          <div className="w-44 h-44 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 shadow-2xl flex items-center justify-center shrink-0">
            <Heart className="w-20 h-20 text-white fill-white shadow" />
          </div>

          <div className="text-center md:text-left flex-1 min-w-0">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-300">
              Playlist
            </span>
            <h1 className="text-3xl md:text-5xl font-black text-white mt-1 tracking-tight font-['Plus_Jakarta_Sans']">
              Liked Songs
            </h1>
            <p className="text-xs text-zinc-400 mt-2">
              {likedTracksList.length} {likedTracksList.length === 1 ? 'song' : 'songs'} saved to your library
            </p>

            {likedTracksList.length > 0 && (
              <div className="mt-5 flex items-center justify-center md:justify-start gap-3">
                <button
                  onClick={handlePlayAll}
                  className="px-6 py-2.5 rounded-full bg-emerald-400 hover:bg-emerald-300 text-black font-bold text-sm flex items-center gap-2 shadow-lg transition-transform active:scale-95"
                >
                  <Play className="w-4 h-4 fill-black" />
                  <span>Play</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Song List */}
      <div className="p-6 md:p-8 max-w-6xl mx-auto">
        {likedTracksList.length > 0 ? (
          <div className="space-y-1">
            <div className="grid grid-cols-12 px-4 py-2 text-xs font-semibold text-zinc-500 border-b border-zinc-800 mb-2">
              <span className="col-span-1">#</span>
              <span className="col-span-7 md:col-span-6">Title</span>
              <span className="hidden md:block md:col-span-4">Album</span>
              <span className="col-span-4 md:col-span-1 text-right flex justify-end">
                <Clock className="w-4 h-4" />
              </span>
            </div>

            {likedTracksList.map((track, idx) => {
              const isCurrent = currentTrack?.id === track.id;
              return (
                <div
                  key={`${track.id}-${idx}`}
                  onClick={() => playTrack(track, likedTracksList)}
                  className={`grid grid-cols-12 items-center px-4 py-2.5 rounded-xl hover:bg-[#151922] transition-colors cursor-pointer group ${
                    isCurrent ? 'bg-emerald-500/10' : ''
                  }`}
                >
                  <span className="col-span-1 text-xs text-zinc-500 font-mono">
                    {isCurrent ? <span className="text-emerald-400 font-bold">▶</span> : idx + 1}
                  </span>

                  <div className="col-span-7 md:col-span-6 flex items-center gap-3 min-w-0 pr-3">
                    <img
                      src={track.thumbnailUrl}
                      alt={track.title}
                      className="w-10 h-10 rounded-lg object-cover bg-zinc-800 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold truncate ${isCurrent ? 'text-emerald-400' : 'text-white'}`}>
                        {track.title}
                      </p>
                      <p className="text-xs text-zinc-400 truncate">
                        {track.artist}
                      </p>
                    </div>
                  </div>

                  <span className="hidden md:block md:col-span-4 text-xs text-zinc-400 truncate pr-3">
                    {track.album || 'Single'}
                  </span>

                  <div className="col-span-4 md:col-span-1 flex items-center justify-end gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLike(track);
                      }}
                      className="text-emerald-400 hover:text-zinc-500 transition-colors"
                      aria-label="Remove from liked"
                    >
                      <Heart className="w-4 h-4 fill-emerald-400" />
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
          <div className="py-20 text-center text-zinc-500 space-y-3">
            <Heart className="w-12 h-12 mx-auto text-zinc-700" />
            <h3 className="text-base font-bold text-white">Songs you like will appear here</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              Save tracks by clicking the heart icon anywhere in SoundWave.
            </p>
            <button
              onClick={() => onNavigate('home')}
              className="px-5 py-2 rounded-full bg-[#181d26] hover:bg-[#202735] text-white text-xs font-semibold transition-all mt-2"
            >
              Discover music
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
