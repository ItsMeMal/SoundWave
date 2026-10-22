type Counter = { windowStartedAt: number; count: number };
type CachedResponse = { body: string; status: number; contentType: string; expiresAt: number };

const MUSIC_API_BASE = 'https://music-api.amanenime.my.id';
const PUBLIC_PREFIX = '/api/music';
const WINDOW_MS = 60_000;
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const MAX_CACHE_ENTRIES = 250;

// Best-effort per warm Vercel function instance. The Vercel WAF should provide
// the authoritative global bot/rate-limit layer when enabled for this project.
const requestCounters = new Map<string, Counter>();
const responseCache = new Map<string, CachedResponse>();

const ID_ROUTES = new Set(['track', 'stream', 'lyrics', 'related', 'next', 'playlist', 'artist', 'album']);
const NO_ID_ROUTES = new Set(['health', 'search', 'suggestions']);
const EXPENSIVE_ROUTES = new Set(['search', 'suggestions']);
const ALLOWED_QUERY_KEYS: Record<string, string[]> = {
  health: [],
  search: ['q', 'limit'],
  suggestions: ['q'],
  track: [],
  stream: ['f'],
  lyrics: [],
  related: [],
  next: [],
  playlist: [],
  artist: [],
  album: [],
};

function headersFor(origin?: string, extra?: Record<string, string>): Headers {
  const headers = new Headers({
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Vary': 'Origin',
    ...extra,
  });

  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type');
  }

  return headers;
}

function jsonResponse(
  payload: unknown,
  status: number,
  origin?: string,
  extraHeaders?: Record<string, string>
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: headersFor(origin, extraHeaders),
  });
}

function getClientIp(request: Request): string {
  // Vercel supplies these at the edge. This is still only an app-level
  // best-effort key; use the platform WAF for authoritative source-IP limits.
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp && realIp.length <= 80) return realIp;

  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded && forwarded.length <= 80 ? forwarded : 'unknown';
}

function consumeWindow(key: string, maximum: number, now = Date.now()): number {
  const current = requestCounters.get(key);

  if (!current || now - current.windowStartedAt >= WINDOW_MS || now < current.windowStartedAt) {
    requestCounters.set(key, { windowStartedAt: now, count: 1 });
    return 0;
  }

  if (current.count >= maximum) {
    return Math.max(1, Math.ceil((WINDOW_MS - (now - current.windowStartedAt)) / 1000));
  }

  current.count += 1;
  return 0;
}

function pruneCounters(now = Date.now()): void {
  if (requestCounters.size < 5000) return;

  for (const [key, counter] of requestCounters) {
    if (now - counter.windowStartedAt >= WINDOW_MS * 2) requestCounters.delete(key);
  }
}

function pruneCache(now = Date.now()): void {
  for (const [key, item] of responseCache) {
    if (item.expiresAt <= now) responseCache.delete(key);
  }
  while (responseCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = responseCache.keys().next().value;
    if (oldest === undefined) break;
    responseCache.delete(oldest);
  }
}

async function readLimitedBody(response: Response): Promise<string> {
  if (!response.body) return '';

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      total += result.value.byteLength;

      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error('upstream-response-too-large');
      }

      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }

  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(combined);
}

function routeError(status: number, message: string, origin?: string, retryAfter?: number): Response {
  const extra: Record<string, string> = {};
  if (retryAfter && retryAfter > 0) extra['Retry-After'] = String(retryAfter);
  return jsonResponse({ error: message }, status, origin, extra);
}

export default {
  async fetch(request: Request): Promise<Response> {
    const requestUrl = new URL(request.url);
    const originHeader = request.headers.get('origin');
    const origin = originHeader && originHeader === requestUrl.origin ? originHeader : undefined;

    // Browser-side defense-in-depth against other sites calling this API.
    // This is not authentication: non-browser clients can forge HTTP headers.
    if (originHeader && originHeader !== requestUrl.origin) {
      return routeError(403, 'Cross-origin API access is not allowed.');
    }
    if (request.headers.get('sec-fetch-site') === 'cross-site') {
      return routeError(403, 'Cross-site API access is not allowed.', origin);
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: headersFor(origin),
      });
    }
    if (request.method !== 'GET') {
      return routeError(405, 'Method not allowed.', origin, undefined);
    }

    const ip = getClientIp(request);
    pruneCounters();
    const globalRetryAfter = consumeWindow('all:' + ip, 180);
    if (globalRetryAfter) return routeError(429, 'Request limit reached. Please retry shortly.', origin, globalRetryAfter);

    const path = requestUrl.pathname.slice(PUBLIC_PREFIX.length);
    const match = /^\/api\/(health|search|suggestions|track|stream|lyrics|related|next|playlist|artist|album)(?:\/([A-Za-z0-9_-]{1,160}))?$/.exec(path);

    if (!match) return routeError(404, 'Unknown music API endpoint.', origin);

    const route = match[1];
    const id = match[2];
    if ((ID_ROUTES.has(route) && !id) || (NO_ID_ROUTES.has(route) && id)) {
      return routeError(400, 'Invalid music API path.', origin);
    }

    const incomingParams = requestUrl.searchParams;
    const permittedParams = new Set(ALLOWED_QUERY_KEYS[route]);
    for (const key of incomingParams.keys()) {
      if (!permittedParams.has(key)) {
        return routeError(400, 'Unsupported query parameter.', origin);
      }
      if (incomingParams.getAll(key).length !== 1) {
        return routeError(400, 'Duplicate query parameter.', origin);
      }
    }

    const upstreamUrl = new URL('/api/' + route + (id ? '/' + id : ''), MUSIC_API_BASE);

    if (route === 'search') {
      const query = (incomingParams.get('q') || '').trim();
      if (!query || query.length > 100) {
        return routeError(400, 'Search query must contain 1–100 characters.', origin);
      }
      const rawLimit = incomingParams.get('limit') || '20';
      if (!/^\d+$/.test(rawLimit)) return routeError(400, 'Invalid search result limit.', origin);
      const requestedLimit = Number(rawLimit);
      if (!Number.isSafeInteger(requestedLimit) || requestedLimit < 1) {
        return routeError(400, 'Invalid search result limit.', origin);
      }

      upstreamUrl.searchParams.set('q', query);
      upstreamUrl.searchParams.set('limit', String(Math.min(20, requestedLimit)));

      const retryAfter = consumeWindow('search:' + ip, 75);
      if (retryAfter) return routeError(429, 'Search limit reached. Please retry shortly.', origin, retryAfter);
    } else if (route === 'suggestions') {
      const query = (incomingParams.get('q') || '').trim();
      if (query.length < 2 || query.length > 80) {
        return routeError(400, 'Suggestion query must contain 2–80 characters.', origin);
      }
      upstreamUrl.searchParams.set('q', query);

      const retryAfter = consumeWindow('search:' + ip, 75);
      if (retryAfter) return routeError(429, 'Search limit reached. Please retry shortly.', origin, retryAfter);
    } else if (route === 'stream') {
      const format = incomingParams.get('f');
      if (format !== null && format !== '140' && format !== '251') {
        return routeError(400, 'Unsupported stream format.', origin);
      }
      if (format) upstreamUrl.searchParams.set('f', format);

      const retryAfter = consumeWindow('stream:' + ip, 60);
      if (retryAfter) return routeError(429, 'Stream lookup limit reached. Please retry shortly.', origin, retryAfter);
    }

    const cacheKey = upstreamUrl.toString();
    const now = Date.now();
    pruneCache(now);
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return new Response(cached.body, {
        status: cached.status,
        headers: headersFor(origin, { 'Content-Type': cached.contentType }),
      });
    }
    if (cached) responseCache.delete(cacheKey);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);

    try {
      const upstream = await fetch(upstreamUrl, {
        method: 'GET',
        redirect: 'error',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'SoundWave-App/1.0',
        },
        signal: controller.signal,
      });

      const contentType = upstream.headers.get('content-type') || '';
      if (!contentType.toLowerCase().includes('application/json')) {
        return routeError(502, 'Music provider returned an unsupported response.', origin);
      }

      const body = await readLimitedBody(upstream);
      if (!upstream.ok) {
        // Do not pass upstream diagnostic messages through to public callers.
        return routeError(upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502,
          'Music provider request failed.', origin);
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        return routeError(502, 'Music provider returned invalid JSON.', origin);
      }

      let ttlMs = 60_000;
      if (route === 'health') ttlMs = 0;
      else if (route === 'search' || route === 'suggestions') ttlMs = 20_000;
      else if (route === 'stream') ttlMs = 10_000;
      else if (route === 'lyrics') ttlMs = 5 * 60_000;

      if (ttlMs > 0 && body.length <= MAX_RESPONSE_BYTES) {
        pruneCache();
        responseCache.set(cacheKey, {
          body,
          status: upstream.status,
          contentType: 'application/json; charset=utf-8',
          expiresAt: Date.now() + ttlMs,
        });
      }

      return new Response(body, {
        status: 200,
        headers: headersFor(origin),
      });
    } catch {
      return routeError(502, 'Music provider is temporarily unavailable.', origin);
    } finally {
      clearTimeout(timeout);
    }
  },
};
