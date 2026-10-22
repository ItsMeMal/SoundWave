import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Track, LyricsResponse } from '../types/music.ts';
import { getStreamUrl, getLyrics, getNextTracks, getRelatedTracks } from '../services/musicApi.ts';
import { getNextTrackIndex, getPreviousTrackIndex, createShuffleIndices } from '../utils/playerLogic.ts';
import { useAuth } from './AuthContext.tsx';
import { 
  addLikedTrack, 
  removeLikedTrack, 
  subscribeLikedTracks, 
  addPlaybackHistory 
} from '../services/firebase.ts';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: any;
  }
}

interface PlayerContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
  queue: Track[];
  queueIndex: number;
  autoplay: boolean;
  playbackQuality: 'Low' | 'Normal' | 'High' | 'Lossless';
  isStreamLoading: boolean;
  streamError: string | null;
  lyrics: LyricsResponse | null;
  lyricsLoading: boolean;
  likedTrackIds: Set<string>;
  likedTracksList: Track[];

  // Actions
  playTrack: (track: Track, newQueue?: Track[]) => Promise<void>;
  togglePlay: () => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  nextTrack: () => Promise<void>;
  prevTrack: () => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  toggleAutoplay: () => void;
  setPlaybackQuality: (quality: 'Low' | 'Normal' | 'High' | 'Lossless') => void;
  toggleLike: (track: Track) => Promise<void>;
  isLiked: (trackId: string) => boolean;
  fetchLyricsForCurrent: () => Promise<void>;
  retryCurrentStream: () => Promise<void>;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, openAuthModal } = useAuth();

  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolumeState] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [queue, setQueue] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState<number>(0);
  const [shuffledIndices, setShuffledIndices] = useState<number[]>([]);
  const [autoplay, setAutoplay] = useState<boolean>(true);
  const [playbackQuality, setPlaybackQuality] = useState<'Low' | 'Normal' | 'High' | 'Lossless'>('High');
  const [isStreamLoading, setIsStreamLoading] = useState<boolean>(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [lyrics, setLyrics] = useState<LyricsResponse | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState<boolean>(false);

  // Liked tracks from Firebase with realtime onSnapshot
  const [likedTrackIds, setLikedTrackIds] = useState<Set<string>>(new Set());
  const [likedTracksList, setLikedTracksList] = useState<Track[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytContainerRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<any>(null);
  const isUsingYtRef = useRef<boolean>(false);
  // YouTube's iframe callbacks are created once; refs keep them connected to current React state.
  const handleTrackEndedRef = useRef<() => void>(() => {});
  const nextTrackRef = useRef<() => Promise<void>>(async () => {});
  const mediaActionsRef = useRef({
    play: () => {},
    pause: () => {},
    next: () => {},
    previous: () => {},
    seek: (_time: number) => {},
    getPosition: () => 0,
    getDuration: () => 0,
  });

  // Subscribe to Liked tracks with realtime onSnapshot when user is authenticated
  useEffect(() => {
    if (!user) {
      setLikedTrackIds(new Set());
      setLikedTracksList([]);
      return;
    }

    const unsubscribe = subscribeLikedTracks(user.uid, (items) => {
      const ids = new Set(items.map(i => i.videoId || i.id));
      setLikedTrackIds(ids);
      const tracks: Track[] = items.map(item => ({
        id: item.videoId || item.id,
        title: item.title,
        artist: item.artist,
        album: item.album || '',
        thumbnailUrl: item.thumbnailUrl,
        duration: item.duration,
        source: 'liked'
      }));
      setLikedTracksList(tracks);
    });

    return () => unsubscribe();
  }, [user]);

  // Initialize resilient background audio engine (YouTube IFrame API)
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const initYt = () => {
      if (window.YT && window.YT.Player && ytContainerRef.current && !ytPlayerRef.current) {
        try {
          ytPlayerRef.current = new window.YT.Player('yt-player-host', {
            height: '0',
            width: '0',
            playerVars: {
              autoplay: 1,
              controls: 0,
              disablekb: 1,
              fs: 0,
              modestbranding: 1,
              playsinline: 1,
            },
            events: {
              onReady: (event: any) => {
                event.target.setVolume(volume * 100);
              },
              onStateChange: (event: any) => {
                if (event.data === 1) { // PLAYING
                  setIsPlaying(true);
                  setIsStreamLoading(false);
                  setStreamError(null);
                } else if (event.data === 2) { // PAUSED
                  setIsPlaying(false);
                } else if (event.data === 0) { // ENDED
                  handleTrackEndedRef.current();
                }
              },
              onError: (err: any) => {
                console.warn('YT Player notice:', err);
                setIsStreamLoading(false);
                setStreamError('Unable to stream this track. Skipping to next...');
                setTimeout(() => { void nextTrackRef.current(); }, 2000);
              }
            }
          });
        } catch (e) {
          console.warn('YT Player init notice:', e);
        }
      }
    };

    if (window.YT && window.YT.Player) {
      initYt();
    } else {
      (window as any).onYouTubeIframeAPIReady = initYt;
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Poll real playback time from actual audio element or player
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (isPlaying) {
      timerRef.current = setInterval(() => {
        if (isUsingYtRef.current && ytPlayerRef.current?.getCurrentTime) {
          try {
            const time = ytPlayerRef.current.getCurrentTime() || 0;
            const dur = ytPlayerRef.current.getDuration() || duration;
            setCurrentTime(time);
            if (dur > 0 && dur !== duration) setDuration(dur);
          } catch {
            // ignore
          }
        } else if (audioRef.current && !audioRef.current.paused) {
          setCurrentTime(audioRef.current.currentTime || 0);
          if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
            setDuration(audioRef.current.duration);
          }
        }
      }, 400);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, duration]);

  // Expose the current song and remote media controls to the OS lock screen/media notification.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const session = navigator.mediaSession;
    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ['play', () => mediaActionsRef.current.play()],
      ['pause', () => mediaActionsRef.current.pause()],
      ['previoustrack', () => mediaActionsRef.current.previous()],
      ['nexttrack', () => mediaActionsRef.current.next()],
      ['seekbackward', details => {
        const offset = details.seekOffset ?? 10;
        mediaActionsRef.current.seek(Math.max(0, mediaActionsRef.current.getPosition() - offset));
      }],
      ['seekforward', details => {
        const duration = mediaActionsRef.current.getDuration();
        const target = mediaActionsRef.current.getPosition() + (details.seekOffset ?? 10);
        mediaActionsRef.current.seek(duration > 0 ? Math.min(duration, target) : target);
      }],
      ['seekto', details => {
        if (typeof details.seekTime === 'number') {
          mediaActionsRef.current.seek(details.seekTime);
        }
      }],
    ];

    const registered: MediaSessionAction[] = [];
    for (const [action, handler] of handlers) {
      try {
        session.setActionHandler(action, handler);
        registered.push(action);
      } catch {
        // Some browsers/devices don't support every media action.
      }
    }

    return () => {
      for (const action of registered) {
        try {
          session.setActionHandler(action, null);
        } catch {
          // Ignore unsupported cleanup actions.
        }
      }
    };
  }, []);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const session = navigator.mediaSession;
    if (!currentTrack) {
      session.metadata = null;
      session.playbackState = 'none';
      return;
    }

    if (typeof MediaMetadata !== 'undefined') {
      try {
        session.metadata = new MediaMetadata({
          title: currentTrack.title,
          artist: currentTrack.artist,
          album: currentTrack.album || 'SoundWave',
          artwork: currentTrack.thumbnailUrl ? [{ src: currentTrack.thumbnailUrl }] : [],
        });
      } catch (error) {
        console.warn('[SoundWave] Could not set media metadata:', error);
      }
    }
  }, [currentTrack]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = !currentTrack ? 'none' : isPlaying ? 'playing' : 'paused';
  }, [currentTrack, isPlaying]);

  useEffect(() => {
    if (!('mediaSession' in navigator) || duration <= 0) return;

    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: 1,
        position: Math.max(0, Math.min(currentTime, duration)),
      });
    } catch {
      // Position state is optional and may be unavailable in some browsers.
    }
  }, [currentTime, duration]);

  // Real track playback
  const playTrack = async (track: Track, newQueue?: Track[]) => {
    if (!track || !track.id) return;

    setIsStreamLoading(true);
    setStreamError(null);
    setCurrentTrack(track);
    setCurrentTime(0);
    setDuration(track.duration || 180);

    // Save playback history to Firestore if logged in
    if (user) {
      addPlaybackHistory(user.uid, track).catch(() => {});
    }

    // Set queue
    if (newQueue && newQueue.length > 0) {
      setQueue(newQueue);
      const idx = newQueue.findIndex(t => t.id === track.id);
      const activeIdx = idx >= 0 ? idx : 0;
      setQueueIndex(activeIdx);
      if (isShuffle) {
        setShuffledIndices(createShuffleIndices(newQueue.length, activeIdx));
      }
    } else if (queue.length === 0 || !queue.some(t => t.id === track.id)) {
      setQueue([track]);
      setQueueIndex(0);
      setShuffledIndices([0]);
    }

    // Pre-fetch next tracks dynamically if queue is running low
    if (autoplay && (!newQueue || newQueue.length <= 1)) {
      getNextTracks(track.id)
        .then(nextItems => {
          if (nextItems.length > 0) {
            setQueue(prev => {
              const existingIds = new Set(prev.map(p => p.id));
              const uniqueNext = nextItems.filter(n => !existingIds.has(n.id));
              return [...prev, ...uniqueNext];
            });
          }
        })
        .catch(() => {});
    }

    // Load verified lyrics asynchronously
    loadLyrics(track);

    // 1. Try HTML5 Audio Stream first
    try {
      const streamUrl = await getStreamUrl(track.id);
      if (streamUrl && audioRef.current) {
        isUsingYtRef.current = false;
        if (ytPlayerRef.current?.pauseVideo) {
          ytPlayerRef.current.pauseVideo();
        }
        audioRef.current.src = streamUrl;
        audioRef.current.volume = isMuted ? 0 : volume;
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          await playPromise;
          setIsPlaying(true);
          setIsStreamLoading(false);
          setStreamError(null);
          return;
        }
      }
    } catch {
      // HTML5 direct stream failed or had Google IP binding
    }

    // 2. Seamless Fallback: Background YouTube Audio Engine (100% reliable for any YouTube track)
    if (ytPlayerRef.current && typeof ytPlayerRef.current.loadVideoById === 'function') {
      try {
        isUsingYtRef.current = true;
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = '';
        }
        ytPlayerRef.current.loadVideoById(track.id);
        ytPlayerRef.current.setVolume(isMuted ? 0 : volume * 100);
        ytPlayerRef.current.playVideo();
        setIsPlaying(true);
        setIsStreamLoading(false);
        setStreamError(null);
        return;
      } catch (err) {
        console.warn('YT audio fallback notice:', err);
      }
    }

    setIsStreamLoading(false);
    setStreamError('Audio stream unavailable. Click to retry.');
  };

  const retryCurrentStream = async () => {
    if (currentTrack) {
      await playTrack(currentTrack, queue);
    }
  };

  const lyricsRequestRef = useRef(0);

  const loadLyrics = async (track: Track) => {
    const requestId = ++lyricsRequestRef.current;
    setLyricsLoading(true);
    setLyrics(null);
    try {
      const data = await getLyrics(track.id, track);
      if (requestId === lyricsRequestRef.current) setLyrics(data);
    } catch {
      if (requestId === lyricsRequestRef.current) setLyrics(null);
    } finally {
      if (requestId === lyricsRequestRef.current) setLyricsLoading(false);
    }
  };

  const fetchLyricsForCurrent = async () => {
    if (currentTrack) {
      await loadLyrics(currentTrack);
    }
  };

  const handleTrackEnded = () => {
    if (repeatMode === 'one') {
      setCurrentTime(0);
      setIsStreamLoading(false);
      setStreamError(null);

      if (isUsingYtRef.current && ytPlayerRef.current?.seekTo && ytPlayerRef.current?.playVideo) {
        ytPlayerRef.current.seekTo(0, true);
        ytPlayerRef.current.playVideo();
        setIsPlaying(true);
      } else if (audioRef.current) {
        audioRef.current.currentTime = 0;
        void audioRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(() => {
          setIsPlaying(false);
        });
      } else {
        setIsPlaying(false);
      }
      return;
    }

    // Keep the finished position visible if no next track is available.
    setCurrentTime(previous => duration > 0 ? duration : previous);
    setIsPlaying(false);
    void nextTrack();
  };

  const togglePlay = () => {
    if (!currentTrack) {
      if (queue.length > 0) {
        playTrack(queue[0]);
      }
      return;
    }

    if (isPlaying) {
      if (isUsingYtRef.current && ytPlayerRef.current?.pauseVideo) {
        ytPlayerRef.current.pauseVideo();
      } else if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
    } else {
      if (isUsingYtRef.current && ytPlayerRef.current?.playVideo) {
        ytPlayerRef.current.playVideo();
      } else if (audioRef.current) {
        audioRef.current.play().catch(() => {});
      }
      setIsPlaying(true);
    }
  };

  const seek = (time: number) => {
    setCurrentTime(time);
    if (isUsingYtRef.current && ytPlayerRef.current?.seekTo) {
      ytPlayerRef.current.seekTo(time, true);
    } else if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const setVolume = (vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    setIsMuted(clamped === 0);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
    if (ytPlayerRef.current?.setVolume) {
      ytPlayerRef.current.setVolume(clamped * 100);
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      if (audioRef.current) audioRef.current.volume = volume;
      if (ytPlayerRef.current?.setVolume) ytPlayerRef.current.setVolume(volume * 100);
    } else {
      setIsMuted(true);
      if (audioRef.current) audioRef.current.volume = 0;
      if (ytPlayerRef.current?.setVolume) ytPlayerRef.current.setVolume(0);
    }
  };

  const toggleShuffle = () => {
    const newShuffle = !isShuffle;
    setIsShuffle(newShuffle);
    if (newShuffle && queue.length > 0) {
      setShuffledIndices(createShuffleIndices(queue.length, queueIndex));
    }
  };

  const cycleRepeat = () => {
    setRepeatMode(prev => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  };

  const nextTrack = async () => {
    if (queue.length === 0) {
      setIsPlaying(false);
      return;
    }

    // If the queue grew while shuffle was enabled, rebuild a complete valid order
    // instead of silently falling back to sequential playback.
    const validShuffleOrder =
      shuffledIndices.length === queue.length &&
      new Set(shuffledIndices).size === queue.length &&
      shuffledIndices.every(index => Number.isInteger(index) && index >= 0 && index < queue.length);
    const shuffleOrder = isShuffle && !validShuffleOrder
      ? createShuffleIndices(queue.length, queueIndex)
      : shuffledIndices;

    if (isShuffle && !validShuffleOrder) {
      setShuffledIndices(shuffleOrder);
    }

    const nextIdx = getNextTrackIndex(queueIndex, queue.length, repeatMode === 'one' ? 'off' : repeatMode, isShuffle, shuffleOrder);
    if (nextIdx !== null && queue[nextIdx]) {
      setQueueIndex(nextIdx);
      await playTrack(queue[nextIdx]);
    } else if (autoplay && currentTrack) {
      try {
        const nextList = await getNextTracks(currentTrack.id);
        if (nextList.length > 0) {
          const existingIds = new Set(queue.map(track => track.id));
          const fresh = nextList.filter(track => !existingIds.has(track.id));
          if (fresh.length > 0) {
            const expandedQueue = [...queue, ...fresh];
            const nextOne = fresh[0];
            setQueueIndex(queue.length);
            await playTrack(nextOne, expandedQueue);
            return;
          }
        }
      } catch (error) {
        console.warn('Unable to load the next track:', error);
      }
      setIsPlaying(false);
    } else {
      setIsPlaying(false);
    }
  };

  // Keep long-lived YouTube callbacks pointed at the latest playback state.
  handleTrackEndedRef.current = handleTrackEnded;
  nextTrackRef.current = nextTrack;

  // Preserve the current shuffle sequence as new queue items are appended.
  useEffect(() => {
    if (!isShuffle || queue.length === 0) return;

    const seen = new Set<number>();
    const valid = shuffledIndices.filter(index => {
      if (!Number.isInteger(index) || index < 0 || index >= queue.length || seen.has(index)) return false;
      seen.add(index);
      return true;
    });
    const missing = Array.from({ length: queue.length }, (_, index) => index)
      .filter(index => !seen.has(index));

    for (let i = missing.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [missing[i], missing[j]] = [missing[j], missing[i]];
    }

    const next = [...valid, ...missing];
    if (next.length !== shuffledIndices.length || next.some((value, index) => value !== shuffledIndices[index])) {
      setShuffledIndices(next);
    }
  }, [queue.length, isShuffle, shuffledIndices]);

  const prevTrack = () => {
    if (queue.length === 0) return;
    const prevIdx = getPreviousTrackIndex(queueIndex, queue.length, currentTime, shuffledIndices);
    if (prevIdx === queueIndex) {
      seek(0);
    } else if (queue[prevIdx]) {
      setQueueIndex(prevIdx);
      playTrack(queue[prevIdx]);
    }
  };

  const addToQueue = (track: Track) => {
    setQueue(prev => [...prev, track]);
    if (!currentTrack) {
      playTrack(track);
    }
  };

  const removeFromQueue = (index: number) => {
    setQueue(prev => prev.filter((_, i) => i !== index));
    setShuffledIndices(prev => prev
      .filter(itemIndex => itemIndex !== index)
      .map(itemIndex => itemIndex > index ? itemIndex - 1 : itemIndex));
    if (index < queueIndex) {
      setQueueIndex(prev => prev - 1);
    }
  };

  const clearQueue = () => {
    if (currentTrack) {
      setQueue([currentTrack]);
      setQueueIndex(0);
      setShuffledIndices(isShuffle ? [0] : []);
    } else {
      setQueue([]);
      setQueueIndex(0);
      setShuffledIndices([]);
    }
  };

  const toggleAutoplay = () => {
    setAutoplay(prev => !prev);
  };

  const toggleLike = async (track: Track) => {
    if (!user) {
      openAuthModal('login');
      return;
    }

    const isCurrentLiked = likedTrackIds.has(track.id);
    if (isCurrentLiked) {
      await removeLikedTrack(user.uid, track.id);
    } else {
      await addLikedTrack(user.uid, track);
    }
  };

  const isLiked = (trackId: string): boolean => {
    return likedTrackIds.has(trackId);
  };

  // Media-session handlers always call current actions, even after React state changes.
  mediaActionsRef.current = {
    play: () => {
      if (!isPlaying) togglePlay();
    },
    pause: () => {
      if (isPlaying) togglePlay();
    },
    next: () => { void nextTrack(); },
    previous: () => prevTrack(),
    seek: (time: number) => seek(time),
    getPosition: () => currentTime,
    getDuration: () => duration,
  };

  return (
    <PlayerContext.Provider
      value={{
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
        playbackQuality,
        isStreamLoading,
        streamError,
        lyrics,
        lyricsLoading,
        likedTrackIds,
        likedTracksList,
        playTrack,
        togglePlay,
        seek,
        setVolume,
        toggleMute,
        toggleShuffle,
        cycleRepeat,
        nextTrack,
        prevTrack,
        addToQueue,
        removeFromQueue,
        clearQueue,
        toggleAutoplay,
        setPlaybackQuality,
        toggleLike,
        isLiked,
        fetchLyricsForCurrent,
        retryCurrentStream,
      }}
    >
      <audio
        ref={audioRef}
        onEnded={handleTrackEnded}
        onError={() => {
          if (currentTrack && !isUsingYtRef.current && ytPlayerRef.current?.loadVideoById) {
            isUsingYtRef.current = true;
            ytPlayerRef.current.loadVideoById(currentTrack.id);
            ytPlayerRef.current.playVideo();
          }
        }}
        preload="auto"
      />
      <div 
        ref={ytContainerRef} 
        style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
      >
        <div id="yt-player-host" />
      </div>

      {children}
    </PlayerContext.Provider>
  );
};

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
}
