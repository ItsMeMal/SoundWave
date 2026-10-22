import { Track, SearchResult, LyricsResponse, Playlist, ArtistDetail, AlbumDetail } from '../types/music.ts';

const API_PREFIX = '/api/music';

// Client-side in-memory cache for speed and resilience (5 minute TTL)
const clientCache = new Map<string, { data: any; time: number }>();

async function fetchWithFallback(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const cleanPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const fullApiPath = cleanPath.startsWith('/api') ? cleanPath : `/api${cleanPath}`;
  const proxyUrl = `${API_PREFIX}${fullApiPath}`;

  // Check client memory cache for GET requests
  if (!options.method || options.method === 'GET') {
    const cached = clientCache.get(proxyUrl);
    if (cached && Date.now() - cached.time < 5 * 60 * 1000) {
      return new Response(JSON.stringify(cached.data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(proxyUrl, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok && (!options.method || options.method === 'GET')) {
      const cloned = res.clone();
      cloned.json().then(data => {
        clientCache.set(proxyUrl, { data, time: Date.now() });
      }).catch(() => {});
    }
    return res;
  } catch (err: any) {
    clearTimeout(timer);
    // If proxy failed, attempt direct fetch with short timeout as secondary fallback
    try {
      const directController = new AbortController();
      const directTimer = setTimeout(() => directController.abort(), 8000);
      const directRes = await fetch(`https://music-api.amanenime.my.id${fullApiPath}`, {
        ...options,
        signal: directController.signal,
      });
      clearTimeout(directTimer);
      return directRes;
    } catch {
      throw err;
    }
  }
}

/**
 * Normalizes raw track from API into SoundWave Track format based on actual API schema
 */
export function normalizeTrack(raw: any): Track {
  if (!raw) {
    throw new Error('Cannot normalize null or undefined track');
  }

  const id = raw.id || raw.videoId || '';
  const title = raw.title || 'Untitled Track';

  const artistsList = Array.isArray(raw.artists)
    ? raw.artists.map((a: any) => ({
        name: typeof a === 'string' ? a : a.name || 'Unknown Artist',
        id: a.id || undefined,
      }))
    : [{ name: raw.artist || 'Unknown Artist' }];

  const artistName = artistsList.map((a: { name: string }) => a.name).join(', ') || 'Unknown Artist';

  let thumb = id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&q=80';
  if (Array.isArray(raw.thumbnails) && raw.thumbnails.length > 0) {
    const sorted = [...raw.thumbnails].sort((a: any, b: any) => (b.width || 0) - (a.width || 0));
    const candidate = sorted[0]?.url || raw.thumbnails[0]?.url;
    if (candidate) thumb = candidate;
  } else if (raw.thumbnail) {
    thumb = typeof raw.thumbnail === 'string' ? raw.thumbnail : raw.thumbnail.url || thumb;
  }

  if (thumb.includes('googleusercontent.com') && thumb.includes('=w')) {
    thumb = thumb.replace(/=w\d+-h\d+/, '=w500-h500');
  }

  if (thumb && thumb.startsWith('//')) {
    thumb = 'https:' + thumb;
  }

  const duration = typeof raw.duration === 'number' 
    ? raw.duration 
    : typeof raw.lengthSeconds === 'number' 
      ? raw.lengthSeconds 
      : 180;

  return {
    id,
    title,
    artist: artistName,
    artists: artistsList,
    album: raw.album?.name || (typeof raw.album === 'string' ? raw.album : undefined),
    thumbnailUrl: thumb,
    thumbnails: raw.thumbnails || [{ url: thumb }],
    duration,
    streamUrl: raw.stream_url || undefined,
    source: 'api'
  };
}

/**
 * Health check endpoint
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const res = await fetchWithFallback('/health');
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Search tracks, artists, albums, playlists
 */
export async function searchMusic(query: string, limit: number = 20): Promise<SearchResult> {
  if (!query || !query.trim()) {
    return { tracks: [], total: 0 };
  }

  try {
    const res = await fetchWithFallback(`/api/search?q=${encodeURIComponent(query.trim())}&limit=${limit}`);
    if (!res.ok) {
      throw new Error(`Search failed with status ${res.status}`);
    }
    const data = await res.json();
    const tracks: Track[] = (data.tracks || [])
      .filter((t: any) => t && (t.id || t.videoId))
      .map(normalizeTrack);

    return {
      tracks,
      total: data.total || tracks.length
    };
  } catch (error: any) {
    console.warn('searchMusic notice:', error.message || error);
    return { tracks: [], total: 0 };
  }
}

/**
 * Autocomplete search suggestions
 */
export async function getSuggestions(query: string): Promise<string[]> {
  if (!query || query.trim().length < 2) return [];

  try {
    const res = await fetchWithFallback(`/api/suggestions?q=${encodeURIComponent(query.trim())}`);
    if (!res.ok) return [];
    const data = await res.json();
    const list: string[] = [];

    if (Array.isArray(data.suggestions)) {
      for (const s of data.suggestions) {
        if (Array.isArray(s.contents)) {
          for (const c of s.contents) {
            if (c.suggestion?.text) {
              list.push(c.suggestion.text);
            }
          }
        }
      }
    }
    return list.slice(0, 8);
  } catch {
    return [];
  }
}

/**
 * Fetch track metadata
 */
export async function getTrack(videoId: string): Promise<Track | null> {
  if (!videoId) return null;
  try {
    const res = await fetchWithFallback(`/api/track/${videoId}`);
    if (!res.ok) return null;
    const data = await res.json();
    return normalizeTrack(data);
  } catch {
    return null;
  }
}

/**
 * Fetch stream URL from API with fallback formats (standard, f=140, f=251)
 */
export async function getStreamUrl(videoId: string): Promise<string | null> {
  if (!videoId) return null;

  // 1. Standard format
  try {
    const res = await fetchWithFallback(`/api/stream/${videoId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.stream_url) return data.stream_url;
    }
  } catch (err) {
    console.warn(`Initial stream fetch notice for ${videoId}:`, err);
  }

  // 2. Format 140 (M4A audio)
  try {
    const res140 = await fetchWithFallback(`/api/stream/${videoId}?f=140`);
    if (res140.ok) {
      const data140 = await res140.json();
      if (data140.stream_url) return data140.stream_url;
    }
  } catch {
    // ignore
  }

  // 3. Format 251 (Opus audio)
  try {
    const res251 = await fetchWithFallback(`/api/stream/${videoId}?f=251`);
    if (res251.ok) {
      const data251 = await res251.json();
      if (data251.stream_url) return data251.stream_url;
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Fetch lyrics, preferring timestamped lyrics for live line highlighting.
 * The music API remains the primary source; LRCLIB is a fallback when its
 * response contains plain text or no lyrics.
 */
export async function getLyrics(videoId: string, track?: Track): Promise<LyricsResponse | null> {
  if (!videoId) return null;

  const hasTimestamps = (value: string) => /\[\d{2,}:\d{2}(?:\.\d{2,3})?\]/.test(value);
  let fallback: LyricsResponse | null = null;

  try {
    const res = await fetchWithFallback(`/api/lyrics/${videoId}`);
    if (res.ok) {
      const data = await res.json();
      const text = typeof data.lyrics === 'string' ? data.lyrics : '';
      fallback = text ? {
        id: videoId,
        source: data.source || 'Music API',
        lyrics: text,
      } : null;

      if (text && hasTimestamps(text)) {
        return fallback;
      }
    }
  } catch {
    // Try LRCLIB below if track metadata is available.
  }

  if (!track?.title || !track.artist) return fallback;

  try {
    const params = new URLSearchParams({
      track_name: track.title,
      artist_name: track.artist,
    });
    if (track.album) params.set('album_name', track.album);
    if (track.duration > 0 && track.duration <= 3600) {
      params.set('duration', String(Math.round(track.duration)));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    let response: Response;
    try {
      response = await fetch(`https://lrclib.net/api/get?${params.toString()}`, {
        signal: controller.signal,
        headers: { 'Lrclib-Client': 'SoundWave/1.0 (https://github.com/ItsMeMal/SoundWave)' },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (response.ok) {
      const data = await response.json();
      const syncedLyrics = typeof data.syncedLyrics === 'string' ? data.syncedLyrics : '';
      if (syncedLyrics && hasTimestamps(syncedLyrics)) {
        return { id: videoId, source: 'LRCLIB', lyrics: syncedLyrics };
      }

      const plainLyrics = typeof data.plainLyrics === 'string' ? data.plainLyrics : '';
      if (!fallback && plainLyrics) {
        fallback = { id: videoId, source: 'LRCLIB', lyrics: plainLyrics };
      }
    }
  } catch {
    // The primary music API may still have usable plain lyrics.
  }

  return fallback;
}

/**
 * Fetch related tracks
 */
export async function getRelatedTracks(videoId: string): Promise<Track[]> {
  if (!videoId) return [];
  try {
    const res = await fetchWithFallback(`/api/related/${videoId}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.tracks || [])
      .filter((t: any) => t && (t.id || t.videoId))
      .map(normalizeTrack);
  } catch {
    return [];
  }
}

/**
 * Fetch up next tracks
 */
export async function getNextTracks(videoId: string): Promise<Track[]> {
  if (!videoId) return [];
  try {
    const res = await fetchWithFallback(`/api/next/${videoId}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.tracks || [])
      .filter((t: any) => t && (t.id || t.videoId))
      .map(normalizeTrack);
  } catch {
    return [];
  }
}

/**
 * Fetch playlist detail
 */
export async function getBrowsePlaylist(browseId: string): Promise<Playlist | null> {
  if (!browseId) return null;
  try {
    const res = await fetchWithFallback(`/api/playlist/${browseId}`);
    if (!res.ok) return null;
    const data = await res.json();
    const tracks: Track[] = (data.tracks || [])
      .filter((t: any) => t && (t.id || t.videoId))
      .map(normalizeTrack);

    return {
      id: data.id || browseId,
      name: data.title || 'Playlist',
      description: data.description || '',
      coverUrl: data.thumbnails?.[0]?.url || (tracks[0]?.thumbnailUrl || ''),
      trackCount: tracks.length,
      tracks,
      creator: data.author || 'SoundWave'
    };
  } catch {
    return null;
  }
}

/**
 * Fetch artist detail
 */
export async function getArtistDetail(browseId: string): Promise<ArtistDetail | null> {
  if (!browseId) return null;
  try {
    const res = await fetchWithFallback(`/api/artist/${browseId}`);
    if (!res.ok) return null;
    const data = await res.json();
    const topTracks: Track[] = (data.top_tracks || data.tracks || [])
      .filter((t: any) => t && (t.id || t.videoId))
      .map(normalizeTrack);

    return {
      id: data.id || browseId,
      name: data.name || data.title || 'Artist',
      subscribers: data.subscribers || data.subscriberCount || undefined,
      description: data.description || undefined,
      thumbnails: data.thumbnails || [],
      topTracks,
      albums: data.albums || [],
    };
  } catch {
    return null;
  }
}

/**
 * Fetch album detail
 */
export async function getAlbumDetail(browseId: string): Promise<AlbumDetail | null> {
  if (!browseId) return null;
  try {
    const res = await fetchWithFallback(`/api/album/${browseId}`);
    if (!res.ok) return null;
    const data = await res.json();
    const tracks: Track[] = (data.tracks || [])
      .filter((t: any) => t && (t.id || t.videoId))
      .map(normalizeTrack);

    return {
      id: data.id || browseId,
      title: data.title || 'Album',
      artist: data.artist || (data.artists?.[0]?.name || 'Unknown Artist'),
      year: data.year || undefined,
      coverUrl: data.thumbnails?.[0]?.url || (tracks[0]?.thumbnailUrl || ''),
      trackCount: tracks.length,
      tracks,
    };
  } catch {
    return null;
  }
}
