import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Track, LyricsResponse } from '../types/music.ts';
import { getStreamUrl, getLyrics, getNextTracks, getRelatedTracks } from '../services/musicApi.ts';
import { getNextTrackIndex, getPreviousTrackIndex, createShuffleIndices } from '../utils/playerLogic.ts';
import { useAuth } from './AuthContext.tsx';
import { useToast } from './ToastContext.tsx';
import { 
  addLikedTrack, 
  removeLikedTrack, 
  subscribeLikedTracks, 
  addPlaybackHistory,
  savePlaybackProgress,
  clearPlaybackProgress,
  saveListeningSession,
} from '../services/firebase.ts';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: any;
  }
}

export type EqualizerPreset = 'Off' | 'Flat' | 'Bass Boost' | 'Pop' | 'Rock' | 'Vocal' | 'Treble' | 'Custom';

const EQUALIZER_PRESETS: Record<EqualizerPreset, number[]> = {
  Off: [0, 0, 0, 0, 0, 0],
  Flat: [0, 0, 0, 0, 0, 0],
  'Bass Boost': [8, 5, 2, 0, 1, 2],
  Pop: [-1, 2, 4, 3, 1, -1],
  Rock: [5, 3, -1, 2, 4, 5],
  Vocal: [-2, 0, 3, 5, 3, 0],
  Treble: [-2, -1, 0, 1, 4, 7],
  Custom: [0, 0, 0, 0, 0, 0],
};

const EQUALIZER_STORAGE_KEY = 'soundwave_equalizer_settings_v1';

function readEqualizerPreferences(): { preset: EqualizerPreset; bands: number[] } {
  const fallback = { preset: 'Off' as EqualizerPreset, bands: [...EQUALIZER_PRESETS.Off] };
  try {
    const raw = localStorage.getItem(EQUALIZER_STORAGE_KEY);
    if (!raw) return fallback;
    const saved = JSON.parse(raw) as { preset?: unknown; bands?: unknown };
    const preset = typeof saved.preset === 'string' &&
      Object.prototype.hasOwnProperty.call(EQUALIZER_PRESETS, saved.preset)
      ? saved.preset as EqualizerPreset
      : fallback.preset;
    const bands = Array.isArray(saved.bands) && saved.bands.length === 6 &&
      saved.bands.every(value => typeof value === 'number' && Number.isFinite(value))
      ? saved.bands.map(value => Math.max(-12, Math.min(12, value as number)))
      : [...EQUALIZER_PRESETS[preset]];
    return { preset, bands };
  } catch {
    return fallback;
  }
}

interface ActiveListeningSession {
  id: string;
  userId: string;
  track: Track;
  sessionStartedAt: string;
  elapsedSeconds: number;
  playingSince: number | null;
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
  equalizerPreset: EqualizerPreset;
  equalizerBands: number[];
  sleepTimerRemainingSeconds: number | null;
  sleepTimerEndOfTrack: boolean;
  isStreamLoading: boolean;
  streamError: string | null;
  lyrics: LyricsResponse | null;
  lyricsLoading: boolean;
  likedTrackIds: Set<string>;
  likedTracksList: Track[];

  // Actions
  playTrack: (track: Track, newQueue?: Track[], startAtSeconds?: number) => Promise<void>;
  resumeTrack: (track: Track, position: number) => Promise<void>;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  setEqualizerPreset: (preset: EqualizerPreset) => void;
  setEqualizerBand: (index: number, gain: number) => void;
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
  scheduleSleepTimer: (minutes: number) => void;
  scheduleSleepTimerEndOfTrack: () => void;
  cancelSleepTimer: () => void;
  toggleLike: (track: Track) => Promise<void>;
  isLiked: (trackId: string) => boolean;
  fetchLyricsForCurrent: () => Promise<void>;
  retryCurrentStream: () => Promise<void>;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, openAuthModal } = useAuth();
  const { notify } = useToast();

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
  const [initialEqualizer] = useState(readEqualizerPreferences);
  const [equalizerPreset, setEqualizerPresetState] = useState<EqualizerPreset>(initialEqualizer.preset);
  const [equalizerBands, setEqualizerBands] = useState<number[]>(initialEqualizer.bands);
  const [sleepTimerEndAt, setSleepTimerEndAt] = useState<number | null>(null);
  const [sleepTimerRemainingSeconds, setSleepTimerRemainingSeconds] = useState<number | null>(null);
  const [sleepTimerEndOfTrack, setSleepTimerEndOfTrack] = useState(false);
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
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const equalizerFiltersRef = useRef<BiquadFilterNode[]>([]);
  const backgroundResumeIntentRef = useRef(false);
  const isPlayingRef = useRef(isPlaying);
  const currentTrackRef = useRef<Track | null>(currentTrack);
  const currentTimeRef = useRef(currentTime);
  const durationRef = useRef(duration);
  const userIdRef = useRef(user?.uid || null);
  const activeSessionRef = useRef<ActiveListeningSession | null>(null);
  currentTrackRef.current = currentTrack;
  isPlayingRef.current = isPlaying;
  currentTimeRef.current = currentTime;
  durationRef.current = duration;
  userIdRef.current = user?.uid || null;

  useEffect(() => {
    try {
      localStorage.setItem(EQUALIZER_STORAGE_KEY, JSON.stringify({
        preset: equalizerPreset,
        bands: equalizerBands,
      }));
    } catch {
      // The equalizer remains functional when browser storage is unavailable.
    }
  }, [equalizerPreset, equalizerBands]);

  const persistCurrentProgress = (
    track = currentTrackRef.current,
    position = currentTimeRef.current,
    actualDuration = durationRef.current
  ) => {
    const userId = userIdRef.current;
    if (!userId || !track || !Number.isFinite(position) || position < 5) return;
    void savePlaybackProgress(userId, track, position, actualDuration);
  };

  const writeActiveSession = (mode: 'snapshot' | 'pause' | 'finish', completed = false) => {
    const session = activeSessionRef.current;
    if (!session) return;
    const elapsed = session.elapsedSeconds + (session.playingSince === null
      ? 0 : Math.max(0, Math.floor((Date.now() - session.playingSince) / 1000)));
    void saveListeningSession(session.userId, session.id, session.track, elapsed, session.sessionStartedAt, completed);
    if (mode === 'pause') activeSessionRef.current = { ...session, elapsedSeconds: elapsed, playingSince: null };
    else if (mode === 'finish') activeSessionRef.current = null;
  };

  const resumeListeningSession = (track: Track | null) => {
    const userId = userIdRef.current;
    if (!userId || !track) return;
    const existing = activeSessionRef.current;
    if (existing && existing.userId === userId && existing.track.id === track.id) {
      if (existing.playingSince === null) activeSessionRef.current = { ...existing, playingSince: Date.now() };
      return;
    }
    writeActiveSession('finish');
    const startedAt = new Date().toISOString();
    const session: ActiveListeningSession = {
      id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID() : `session_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      userId, track, sessionStartedAt: startedAt, elapsedSeconds: 0, playingSince: Date.now(),
    };
    activeSessionRef.current = session;
    void saveListeningSession(userId, session.id, track, 0, startedAt);
  };

  const initializeEqualizer = async (gains: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audioSourceNodeRef.current && audioContextRef.current) {
      equalizerFiltersRef.current.forEach((filter, index) => { filter.gain.value = gains[index] || 0; });
      if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();
      return;
    }
    const originalSource = audio.currentSrc || audio.src;
    const wasUsingYoutube = isUsingYtRef.current;
    const wasPlaying = !audio.paused && !wasUsingYoutube;
    const previousPosition = audio.currentTime || currentTimeRef.current;
    const trackId = currentTrackRef.current?.id;
    audio.pause();
    audio.crossOrigin = 'anonymous';
    if (originalSource && !wasUsingYoutube) {
      audio.removeAttribute('src');
      audio.load();
    }
    const AudioContextConstructor = window.AudioContext;
    if (!AudioContextConstructor) throw new Error('Web Audio API is not supported by this browser.');
    const context = new AudioContextConstructor();
    const source = context.createMediaElementSource(audio);
    const frequencies = [60, 170, 350, 1000, 3500, 10000];
    const filters = frequencies.map((frequency, index) => {
      const filter = context.createBiquadFilter();
      filter.type = index === 0 ? 'lowshelf' : index === frequencies.length - 1 ? 'highshelf' : 'peaking';
      filter.frequency.value = frequency;
      if (filter.type === 'peaking') filter.Q.value = 1;
      filter.gain.value = gains[index] || 0;
      return filter;
    });
    source.connect(filters[0]);
    for (let index = 0; index < filters.length - 1; index++) filters[index].connect(filters[index + 1]);
    filters[filters.length - 1].connect(context.destination);
    audioContextRef.current = context;
    audioSourceNodeRef.current = source;
    equalizerFiltersRef.current = filters;
    if (originalSource && !wasUsingYoutube) {
      audio.addEventListener('loadedmetadata', () => {
        if (trackId && currentTrackRef.current?.id !== trackId) return;
        try {
          audio.currentTime = Math.min(previousPosition, Number.isFinite(audio.duration) ? audio.duration : previousPosition);
          setCurrentTime(audio.currentTime);
        } catch { /* Stream metadata may not be seekable yet. */ }
        if (wasPlaying) void audio.play().catch(() => {
          // Streams without CORS support fall back to the existing YouTube playback engine.
        });
      }, { once: true });
      audio.src = originalSource;
      audio.load();
    }
    await context.resume();
  };

  const changeEqualizerPreset = (preset: EqualizerPreset) => {
    const gains = [...EQUALIZER_PRESETS[preset]];
    setEqualizerPresetState(preset);
    setEqualizerBands(gains);
    if (preset === 'Off' || preset === 'Flat') {
      equalizerFiltersRef.current.forEach((filter, index) => { filter.gain.value = gains[index] || 0; });
      return;
    }
    void initializeEqualizer(gains).catch(error => notify({
      variant: 'warning',
      title: 'Equalizer is unavailable',
      description: error instanceof Error ? error.message : 'This stream or browser does not support audio processing.',
    }));
  };

  const changeEqualizerBand = (index: number, gain: number) => {
    if (index < 0 || index >= 6) return;
    const next = [...equalizerBands];
    next[index] = Math.max(-12, Math.min(12, gain));
    setEqualizerBands(next);
    setEqualizerPresetState('Custom');
    if (audioSourceNodeRef.current) {
      if (equalizerFiltersRef.current[index]) equalizerFiltersRef.current[index].gain.value = next[index];
    } else if (next.some(value => value !== 0)) {
      void initializeEqualizer(next).catch(error => notify({
        variant: 'warning',
        title: 'Equalizer is unavailable',
        description: error instanceof Error ? error.message : 'This stream or browser does not support audio processing.',
      }));
    }
  };

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

  useEffect(() => {
    if (!user?.uid || !currentTrack || !isPlaying) return;
    const interval = window.setInterval(() => {
      const track = currentTrackRef.current;
      const position = currentTimeRef.current;
      if (track && position >= 5) persistCurrentProgress(track, position, durationRef.current);
      writeActiveSession('snapshot');
    }, 15000);
    return () => window.clearInterval(interval);
  }, [user?.uid, currentTrack?.id, isPlaying]);

  useEffect(() => {
    const resumeAfterInterruption = async () => {
      if (!backgroundResumeIntentRef.current || document.visibilityState !== 'visible') return;
      backgroundResumeIntentRef.current = false;

      try {
        const context = audioContextRef.current;
        if (context && context.state !== 'running' && context.state !== 'closed') {
          await context.resume();
        }

        const track = currentTrackRef.current;
        if (!track) return;

        if (isUsingYtRef.current && ytPlayerRef.current?.playVideo) {
          ytPlayerRef.current.playVideo();
        } else if (audioRef.current?.paused) {
          await audioRef.current.play();
        }

        setIsPlaying(true);
        resumeListeningSession(track);
      } catch {
        // Some browsers require a fresh user gesture after an OS-level audio interruption.
        setIsPlaying(false);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const audioIsPlaying = Boolean(audioRef.current && !audioRef.current.paused);
        let youtubeIsPlaying = false;
        if (isUsingYtRef.current && ytPlayerRef.current?.getPlayerState) {
          try {
            youtubeIsPlaying = ytPlayerRef.current.getPlayerState() === 1;
          } catch {
            youtubeIsPlaying = false;
          }
        }

        backgroundResumeIntentRef.current = isPlayingRef.current || audioIsPlaying || youtubeIsPlaying;
        if (backgroundResumeIntentRef.current) {
          persistCurrentProgress();
          writeActiveSession('snapshot');
          const context = audioContextRef.current;
          if (context && context.state !== 'running' && context.state !== 'closed') {
            void context.resume().catch(() => {});
          }
        }
        return;
      }

      void resumeAfterInterruption();
    };

    const onPageHide = () => {
      persistCurrentProgress();
      writeActiveSession('snapshot');
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pageshow', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pageshow', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);

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
                  resumeListeningSession(currentTrackRef.current);
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

  // Sleep timer: pause playback after a duration without relying on tab visibility.
  useEffect(() => {
    if (sleepTimerEndAt === null) return;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((sleepTimerEndAt - Date.now()) / 1000));
      setSleepTimerRemainingSeconds(remaining);
      if (remaining > 0) return;

      setSleepTimerEndAt(null);
      setSleepTimerRemainingSeconds(null);
      setSleepTimerEndOfTrack(false);
      persistCurrentProgress();
      writeActiveSession('pause');

      if (isUsingYtRef.current && ytPlayerRef.current?.pauseVideo) {
        ytPlayerRef.current.pauseVideo();
      } else {
        audioRef.current?.pause();
      }
      setIsPlaying(false);
      notify({
        variant: 'info',
        title: 'Sleep timer finished',
        description: 'Playback has been paused.',
      });
    };

    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [sleepTimerEndAt, notify]);

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
  const playTrack = async (track: Track, newQueue?: Track[], startAtSeconds = 0) => {
    if (!track || !track.id) return;
    backgroundResumeIntentRef.current = false;
    if (currentTrack && currentTime > 5) persistCurrentProgress(currentTrack, currentTime, duration);
    writeActiveSession('finish');

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
        if (equalizerBands.some(gain => gain !== 0)) {
          try {
            // Restore saved equalizer settings before starting a direct stream.
            await initializeEqualizer(equalizerBands);
          } catch (error) {
            console.warn('[SoundWave] Saved equalizer could not be restored:', error);
          }
        }
        isUsingYtRef.current = false;
        if (audioSourceNodeRef.current && audioContextRef.current &&
            audioContextRef.current.state !== 'running' && audioContextRef.current.state !== 'closed') {
          await audioContextRef.current.resume().catch(() => {});
        }
        if (ytPlayerRef.current?.pauseVideo) {
          ytPlayerRef.current.pauseVideo();
        }
        if (audioSourceNodeRef.current) audioRef.current.crossOrigin = 'anonymous';
        if (startAtSeconds > 0) {
          const audio = audioRef.current;
          audio.addEventListener('loadedmetadata', () => {
            if (currentTrackRef.current?.id !== track.id) return;
            try {
              audio.currentTime = Math.min(startAtSeconds, Number.isFinite(audio.duration) ? audio.duration : startAtSeconds);
              setCurrentTime(audio.currentTime);
            } catch { /* Seek when metadata is ready. */ }
          }, { once: true });
        }
        audioRef.current.src = streamUrl;
        audioRef.current.volume = isMuted ? 0 : volume;
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          await playPromise;
          setIsPlaying(true);
          setIsStreamLoading(false);
          setStreamError(null);
          if (startAtSeconds > 0 && currentTrackRef.current?.id === track.id) {
            try {
              audioRef.current.currentTime = Math.min(startAtSeconds, Number.isFinite(audioRef.current.duration) ? audioRef.current.duration : startAtSeconds);
              setCurrentTime(audioRef.current.currentTime);
            } catch { /* The loadedmetadata handler above will seek. */ }
          }
          resumeListeningSession(track);
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
        if (startAtSeconds > 0) {
          window.setTimeout(() => {
            if (currentTrackRef.current?.id !== track.id || !ytPlayerRef.current?.seekTo) return;
            ytPlayerRef.current.seekTo(startAtSeconds, true);
            setCurrentTime(startAtSeconds);
          }, 900);
        }
        resumeListeningSession(track);
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

  const resumeTrack = async (track: Track, position: number) => {
    await playTrack(track, [track], Math.max(0, Number.isFinite(position) ? position : 0));
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
    if (currentTrack && userIdRef.current) void clearPlaybackProgress(userIdRef.current, currentTrack.id);
    writeActiveSession('finish', true);
    if (sleepTimerEndOfTrack) {
      setSleepTimerEndOfTrack(false);
      setIsPlaying(false);
      setCurrentTime(duration > 0 ? duration : currentTime);
      setIsStreamLoading(false);
      notify({
        variant: 'info',
        title: 'Sleep timer finished',
        description: 'Playback stopped at the end of the track.',
      });
      return;
    }

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

  const reorderQueue = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= queue.length || toIndex >= queue.length) return;
    const nextQueue = [...queue];
    const [moved] = nextQueue.splice(fromIndex, 1);
    nextQueue.splice(toIndex, 0, moved);
    const mapOldIndex = (oldIndex: number) => {
      if (oldIndex === fromIndex) return toIndex;
      if (fromIndex < toIndex && oldIndex > fromIndex && oldIndex <= toIndex) return oldIndex - 1;
      if (fromIndex > toIndex && oldIndex >= toIndex && oldIndex < fromIndex) return oldIndex + 1;
      return oldIndex;
    };
    setQueue(nextQueue);
    setQueueIndex(previous => mapOldIndex(previous));
    setShuffledIndices(previous => previous.map(mapOldIndex));
  };

  const togglePlay = () => {
    // An intentional play/pause action overrides any pending background recovery.
    backgroundResumeIntentRef.current = false;
    if (!currentTrack) {
      if (queue.length > 0) {
        playTrack(queue[0]);
      }
      return;
    }

    if (isPlaying) {
      persistCurrentProgress();
      writeActiveSession('pause');
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
        const audio = audioRef.current;
        void (async () => {
          try {
            const context = audioContextRef.current;
            if (context && context.state !== 'running' && context.state !== 'closed') {
              await context.resume();
            }
            await audio.play();
            setIsPlaying(true);
          } catch {
            setIsPlaying(false);
          }
        })();
      } else {
        setIsPlaying(true);
      }
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

  const scheduleSleepTimer = (minutes: number) => {
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    const endsAt = Date.now() + Math.round(minutes * 60) * 1000;
    setSleepTimerEndOfTrack(false);
    setSleepTimerEndAt(endsAt);
    setSleepTimerRemainingSeconds(Math.round(minutes * 60));
    notify({
      variant: 'success',
      title: 'Sleep timer set',
      description: `Playback will pause in ${minutes} minutes.`,
    });
  };

  const scheduleSleepTimerEndOfTrack = () => {
    setSleepTimerEndAt(null);
    setSleepTimerRemainingSeconds(null);
    setSleepTimerEndOfTrack(true);
    notify({
      variant: 'success',
      title: 'Sleep timer set',
      description: 'Playback will pause when the current track ends.',
    });
  };

  const cancelSleepTimer = () => {
    const wasActive = sleepTimerEndAt !== null || sleepTimerEndOfTrack;
    setSleepTimerEndAt(null);
    setSleepTimerRemainingSeconds(null);
    setSleepTimerEndOfTrack(false);
    if (wasActive) {
      notify({
        variant: 'info',
        title: 'Sleep timer cancelled',
      });
    }
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
        equalizerPreset,
        equalizerBands,
        sleepTimerRemainingSeconds,
        sleepTimerEndOfTrack,
        isStreamLoading,
        streamError,
        lyrics,
        lyricsLoading,
        likedTrackIds,
        likedTracksList,
        playTrack,
        resumeTrack,
        reorderQueue,
        setEqualizerPreset: changeEqualizerPreset,
        setEqualizerBand: changeEqualizerBand,
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
        scheduleSleepTimer,
        scheduleSleepTimerEndOfTrack,
        cancelSleepTimer,
        toggleLike,
        isLiked,
        fetchLyricsForCurrent,
        retryCurrentStream,
      }}
    >
      <audio
        ref={audioRef}
        onPlay={() => {
          if (!isUsingYtRef.current) {
            setIsPlaying(true);
            setStreamError(null);
            resumeListeningSession(currentTrackRef.current);
          }
        }}
        onPause={() => {
          if (!isUsingYtRef.current && !audioRef.current?.ended) {
            // Mobile browsers can interrupt the media element while switching apps or locking the screen.
            // Keep the playback intent when that happens so it can recover when the page becomes active.
            if (document.visibilityState === 'hidden' && backgroundResumeIntentRef.current) return;
            setIsPlaying(false);
            persistCurrentProgress();
            writeActiveSession('pause');
          }
        }}
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
