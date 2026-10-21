import { Track, SearchResult, LyricsResponse, Playlist } from '../types/music.ts';

const API_PREFIX = '/api/music';

// Client-side in-memory cache for speed and resilience
const clientCache = new Map<string, { data: any; time: number }>();

async function fetchWithFallback(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const cleanPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const fullApiPath = cleanPath.startsWith('/api') ? cleanPath : `/api${cleanPath}`;
  const proxyUrl = `${API_PREFIX}${fullApiPath}`;

  // Check client memory cache (5 minute TTL)
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
 * Normalizes raw track from API into SoundWave Track format
 */
export function normalizeTrack(raw: any): Track {
  const artistsList = Array.isArray(raw.artists)
    ? raw.artists.map((a: any) => ({ name: typeof a === 'string' ? a : a.name || 'Unknown Artist' }))
    : [{ name: raw.artist || 'Unknown Artist' }];

  const artistName = artistsList.map((a: { name: string }) => a.name).join(', ') || 'Unknown Artist';

  let thumb = 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&q=80';
  if (Array.isArray(raw.thumbnails) && raw.thumbnails.length > 0) {
    thumb = raw.thumbnails[raw.thumbnails.length - 1].url || raw.thumbnails[0].url;
  } else if (raw.thumbnail) {
    thumb = typeof raw.thumbnail === 'string' ? raw.thumbnail : raw.thumbnail.url || thumb;
  }

  if (thumb && thumb.startsWith('//')) {
    thumb = 'https:' + thumb;
  }

  return {
    id: raw.id || raw.videoId || String(Math.random()),
    title: raw.title || 'Untitled Track',
    artist: artistName,
    artists: artistsList,
    album: raw.album?.name || raw.album || '',
    thumbnailUrl: thumb,
    thumbnails: raw.thumbnails || [{ url: thumb }],
    duration: typeof raw.duration === 'number' ? raw.duration : 180,
    streamUrl: raw.stream_url || undefined,
    source: 'api'
  };
}

/**
 * Search tracks, artists, albums, playlists
 */
export async function searchMusic(query: string, limit: number = 20): Promise<SearchResult> {
  if (!query || !query.trim()) {
    return { tracks: [], total: 0 };
  }

  try {
    const res = await fetchWithFallback(`/api/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    if (!res.ok) {
      throw new Error(`Search failed with status ${res.status}`);
    }
    const data = await res.json();
    const tracks: Track[] = (data.tracks || []).map(normalizeTrack);
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
    const res = await fetchWithFallback(`/api/suggestions?q=${encodeURIComponent(query)}`);
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
 * Fetch stream URL from API with fallback formats
 */
export async function getStreamUrl(videoId: string): Promise<string | null> {
  try {
    const res = await fetchWithFallback(`/api/stream/${videoId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.stream_url) return data.stream_url;
    }
  } catch (err) {
    console.warn(`Initial stream fetch notice for ${videoId}:`, err);
  }

  try {
    const res140 = await fetchWithFallback(`/api/stream/${videoId}?f=140`);
    if (res140.ok) {
      const data140 = await res140.json();
      if (data140.stream_url) return data140.stream_url;
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Fetch lyrics
 */
export async function getLyrics(videoId: string): Promise<LyricsResponse | null> {
  try {
    const res = await fetchWithFallback(`/api/lyrics/${videoId}`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      id: data.id || videoId,
      source: data.source || 'Musixmatch',
      lyrics: data.lyrics || ''
    };
  } catch {
    return null;
  }
}

/**
 * Fetch related tracks
 */
export async function getRelatedTracks(videoId: string): Promise<Track[]> {
  try {
    const res = await fetchWithFallback(`/api/related/${videoId}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.tracks || []).map(normalizeTrack);
  } catch {
    return [];
  }
}

/**
 * Fetch up next tracks
 */
export async function getNextTracks(videoId: string): Promise<Track[]> {
  try {
    const res = await fetchWithFallback(`/api/next/${videoId}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.tracks || []).map(normalizeTrack);
  } catch {
    return [];
  }
}

/**
 * Fetch curated or browse playlist
 */
export async function getBrowsePlaylist(browseId: string): Promise<Playlist | null> {
  try {
    const res = await fetchWithFallback(`/api/playlist/${browseId}`);
    if (!res.ok) return null;
    const data = await res.json();
    const tracks: Track[] = (data.tracks || []).map(normalizeTrack);
    return {
      id: data.id || browseId,
      name: data.title || 'Playlist',
      description: data.description || '',
      coverUrl: data.thumbnails?.[0]?.url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&q=80',
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
export async function getArtistDetail(browseId: string) {
  try {
    const res = await fetchWithFallback(`/api/artist/${browseId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Fetch album detail
 */
export async function getAlbumDetail(browseId: string) {
  try {
    const res = await fetchWithFallback(`/api/album/${browseId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
