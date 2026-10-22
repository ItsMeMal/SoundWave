import type { IncomingMessage, ServerResponse } from 'node:http';

type RequestLike = IncomingMessage & { url?: string };
type CacheEntry = { body: string; expiresAt: number; status: number };
type RateEntry = { startedAt: number; count: number };

const MUSIC_API_BASE = 'https://music-api.amanenime.my.id';
const WINDOW_MS = 60_000;
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const MAX_CACHE_ENTRIES = 200;
const responseCache = new Map<string, CacheEntry>();
const rateWindows = new Map<string, RateEntry>();

const routesWithId = new Set(['track', 'stream', 'lyrics', 'related', 'next', 'playlist', 'artist', 'album']);
const routesWithoutId = new Set(['health', 'search', 'suggestions']);
const allowedParams: Record<string, string[]> = {
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

function setSecurityHeaders(response: ServerResponse, origin?: string): void {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (origin) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.setHeader('Vary', 'Origin');
  }
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
  origin?: string,
  extraHeaders: Record<string, string> = {},
): void {
  setSecurityHeaders(response, origin);
  for (const [key, value] of Object.entries(extraHeaders)) response.setHeader(key, value);
  response.statusCode = status;
  response.end(JSON.stringify(body));
}

function getTrustedRequestOrigin(request: RequestLike, requestUrl: URL): string | undefined {
  const originHeader = request.headers.origin;
  if (typeof originHeader !== 'string') return undefined;
  try {
    return new URL(originHeader).origin === requestUrl.origin ? originHeader : undefined;
  } catch {
    return undefined;
  }
}

function getClientIp(request: RequestLike): string {
  // Vercel provides forwarding headers. Take the last hop; rate limiting here
  // remains a best-effort fallback, with the platform WAF as the global layer.
  const forwarded = request.headers['x-forwarded-for'];
  const realIp = request.headers['x-real-ip'];
  const value = typeof forwarded === 'string'
    ? forwarded.split(',').map(part => part.trim()).filter(Boolean).at(-1)
    : typeof realIp === 'string' ? realIp.trim() : undefined;
  return value && value.length <= 80 ? value : 'unknown';
}

function consumeRateWindow(key: string, maximum: number): number {
  const now = Date.now();
  const entry = rateWindows.get(key);
  if (!entry || now < entry.startedAt || now - entry.startedAt >= WINDOW_MS) {
    rateWindows.set(key, { startedAt: now, count: 1 });
    return 0;
  }
  if (entry.count >= maximum) {
    return Math.max(1, Math.ceil((WINDOW_MS - (now - entry.startedAt)) / 1000));
  }
  entry.count += 1;
  return 0;
}

function pruneState(): void {
  const now = Date.now();
  if (rateWindows.size > 4000) {
    for (const [key, value] of rateWindows) {
      if (now - value.startedAt >= WINDOW_MS * 2) rateWindows.delete(key);
    }
  }
  for (const [key, value] of responseCache) {
    if (value.expiresAt <= now) responseCache.delete(key);
  }
  while (responseCache.size > MAX_CACHE_ENTRIES) {
    const first = responseCache.keys().next().value;
    if (first === undefined) break;
    responseCache.delete(first);
  }
}

async function readLimitedJson(response: globalThis.Response): Promise<string> {
  if (!response.body) return '{}';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error('upstream_response_too_large');
      }
      chunks.push(value);
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
  const body = new TextDecoder().decode(combined);
  JSON.parse(body);
  return body;
}

function endpointFor(rawPath: string): { route: string; id?: string } | null {
  // Rewrites turn /api/music/api/search into /api/music-proxy?path=api/search.
  const normalized = rawPath.startsWith('/') ? rawPath : '/' + rawPath;
  const apiPath = normalized.startsWith('/api/') || normalized === '/api'
    ? normalized
    : '/api' + normalized;
  const match = /^\/api\/(health|search|suggestions|track|stream|lyrics|related|next|playlist|artist|album)(?:\/([A-Za-z0-9_-]{1,160}))?$/.exec(apiPath);
  if (!match) return null;
  const route = match[1];
  const id = match[2];
  if ((routesWithId.has(route) && !id) || (routesWithoutId.has(route) && id)) return null;
  return { route, id };
}

export default async function handler(request: RequestLike, response: ServerResponse): Promise<void> {
  const proto = typeof request.headers['x-forwarded-proto'] === 'string'
    ? request.headers['x-forwarded-proto'].split(',')[0].trim()
    : 'https';
  const host = typeof request.headers.host === 'string' ? request.headers.host : 'localhost';
  const requestUrl = new URL(request.url || '/', proto + '://' + host);
  const originHeader = request.headers.origin;
  const origin = getTrustedRequestOrigin(request, requestUrl);

  setSecurityHeaders(response, origin);

  // This is defense in depth for browser clients, not a substitute for authentication/WAF.
  if (typeof originHeader === 'string' && !origin) {
    sendJson(response, 403, { error: 'Cross-origin API access is not allowed.' });
    return;
  }
  if (request.headers['sec-fetch-site'] === 'cross-site') {
    sendJson(response, 403, { error: 'Cross-site API access is not allowed.' }, origin);
    return;
  }

  if (request.method === 'OPTIONS') {
    response.statusCode = 204;
    response.end();
    return;
  }
  if (request.method !== 'GET') {
    sendJson(response, 405, { error: 'Method not allowed.' }, origin, { Allow: 'GET, OPTIONS' });
    return;
  }

  const incoming = requestUrl.searchParams;
  const rawPathValues = incoming.getAll('path');
  if (rawPathValues.length !== 1 || !rawPathValues[0] || rawPathValues[0].length > 220) {
    sendJson(response, 400, { error: 'Invalid music API route.' }, origin);
    return;
  }

  const endpoint = endpointFor(rawPathValues[0]);
  if (!endpoint) {
    sendJson(response, 404, { error: 'Unknown music API endpoint.' }, origin);
    return;
  }

  // Strip the internal rewrite parameter and reject everything outside the route allowlist.
  incoming.delete('path');
  for (const key of incoming.keys()) {
    if (!allowedParams[endpoint.route].includes(key) || incoming.getAll(key).length !== 1) {
      sendJson(response, 400, { error: 'Unsupported or duplicate query parameter.' }, origin);
      return;
    }
  }

  const ip = getClientIp(request);
  pruneState();

  const generalWait = consumeRateWindow('all:' + ip, 180);
  if (generalWait) {
    sendJson(response, 429, { error: 'Request limit reached. Please retry shortly.' }, origin, { 'Retry-After': String(generalWait) });
    return;
  }

  const upstreamUrl = new URL('/api/' + endpoint.route + (endpoint.id ? '/' + endpoint.id : ''), MUSIC_API_BASE);
  if (endpoint.route === 'search') {
    const query = (incoming.get('q') || '').trim();
    if (!query || query.length > 100) {
      sendJson(response, 400, { error: 'Search query must contain 1–100 characters.' }, origin);
      return;
    }
    const rawLimit = incoming.get('limit') || '20';
    if (!/^\d+$/.test(rawLimit) || !Number.isSafeInteger(Number(rawLimit)) || Number(rawLimit) < 1) {
      sendJson(response, 400, { error: 'Invalid search result limit.' }, origin);
      return;
    }
    upstreamUrl.searchParams.set('q', query);
    upstreamUrl.searchParams.set('limit', String(Math.min(20, Number(rawLimit))));
    const wait = consumeRateWindow('search:' + ip, 75);
    if (wait) {
      sendJson(response, 429, { error: 'Search limit reached. Please retry shortly.' }, origin, { 'Retry-After': String(wait) });
      return;
    }
  } else if (endpoint.route === 'suggestions') {
    const query = (incoming.get('q') || '').trim();
    if (query.length < 2 || query.length > 80) {
      sendJson(response, 400, { error: 'Suggestion query must contain 2–80 characters.' }, origin);
      return;
    }
    upstreamUrl.searchParams.set('q', query);
    const wait = consumeRateWindow('search:' + ip, 75);
    if (wait) {
      sendJson(response, 429, { error: 'Search limit reached. Please retry shortly.' }, origin, { 'Retry-After': String(wait) });
      return;
    }
  } else if (endpoint.route === 'stream') {
    const format = incoming.get('f');
    if (format !== null && format !== '140' && format !== '251') {
      sendJson(response, 400, { error: 'Unsupported stream format.' }, origin);
      return;
    }
    if (format) upstreamUrl.searchParams.set('f', format);
    const wait = consumeRateWindow('stream:' + ip, 60);
    if (wait) {
      sendJson(response, 429, { error: 'Stream lookup limit reached. Please retry shortly.' }, origin, { 'Retry-After': String(wait) });
      return;
    }
  }

  const cacheKey = upstreamUrl.toString();
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    setSecurityHeaders(response, origin);
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.statusCode = cached.status;
    response.end(cached.body);
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'GET',
      redirect: 'error',
      headers: { Accept: 'application/json', 'User-Agent': 'SoundWave-App/1.0' },
      signal: controller.signal,
    });
    if (!(upstream.headers.get('content-type') || '').toLowerCase().includes('application/json')) {
      sendJson(response, 502, { error: 'Music provider returned an unsupported response.' }, origin);
      return;
    }

    const body = await readLimitedJson(upstream);
    if (!upstream.ok) {
      sendJson(response, upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502,
        { error: 'Music provider request failed.' }, origin);
      return;
    }

    let ttl = 60_000;
    if (endpoint.route === 'health') ttl = 0;
    else if (endpoint.route === 'search' || endpoint.route === 'suggestions') ttl = 20_000;
    else if (endpoint.route === 'stream') ttl = 10_000;
    else if (endpoint.route === 'lyrics') ttl = 5 * 60_000;

    if (ttl > 0) {
      pruneState();
      responseCache.set(cacheKey, { body, status: 200, expiresAt: Date.now() + ttl });
    }
    setSecurityHeaders(response, origin);
    response.statusCode = 200;
    response.end(body);
  } catch {
    if (response.headersSent) {
      response.destroy();
      return;
    }
    sendJson(response, 502, { error: 'Music provider is temporarily unavailable.' }, origin);
  } finally {
    clearTimeout(timeout);
  }
}
