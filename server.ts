import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import dotenv from 'dotenv';

dotenv.config();

// CVE-2026-111497: fail closed on Node.js releases that do not contain the
// patched Brotli decoder. Vercel's managed Node 22.x runtime is patched
// automatically; this guard protects deployments that run this server elsewhere.
const [nodeMajor, nodeMinor, nodePatch] = process.versions.node.split('.').map(Number);
const patchedMinimums: Record<number, [number, number]> = {
  22: [23, 4],
  24: [22, 1],
  26: [12, 1],
};
const minimum = patchedMinimums[nodeMajor];
const nodeIsPatched = Boolean(
  minimum &&
  (nodeMinor > minimum[0] || (nodeMinor === minimum[0] && nodePatch >= minimum[1]))
);

if (!nodeIsPatched) {
  console.error(
    '[Security] Node.js ' + process.versions.node +
    ' is not an approved patched runtime for CVE-2026-111497. ' +
    'Upgrade to Node 22.23.4+, 24.22.1+, or 26.12.1+ before starting SoundWave.'
  );
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';
const MUSIC_API_BASE = 'https://music-api.amanenime.my.id';
const MUSIC_API_ORIGIN = new URL(MUSIC_API_BASE).origin;
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 100;
const MAX_CACHEABLE_JSON_BYTES = 512 * 1024;
const MAX_JSON_RESPONSE_BYTES = 10 * 1024 * 1024;
const MAX_PROXY_URL_LENGTH = 2048;

const cache = new Map<string, { data: unknown; contentType: string; expires: number }>();
const rateWindows = new Map<string, { startedAt: number; count: number }>();
const RATE_WINDOW_MS = 60_000;

function consumeRateLimit(key: string, maximum: number): number {
  const now = Date.now();
  const current = rateWindows.get(key);
  if (!current || now - current.startedAt >= RATE_WINDOW_MS || now < current.startedAt) {
    rateWindows.set(key, { startedAt: now, count: 1 });
    return 0;
  }
  if (current.count >= maximum) {
    return Math.max(1, Math.ceil((RATE_WINDOW_MS - (now - current.startedAt)) / 1000));
  }
  current.count += 1;
  return 0;
}

function pruneRateWindows(): void {
  if (rateWindows.size < 5000) return;
  const now = Date.now();
  for (const [key, value] of rateWindows) {
    if (now - value.startedAt > RATE_WINDOW_MS * 2) rateWindows.delete(key);
  }
}

// Configure TRUST_PROXY_HOPS only when this service is reachable solely through
// a trusted reverse proxy; otherwise an attacker could forge forwarded client IPs.
if (process.env.TRUST_PROXY_HOPS && /^\d+$/.test(process.env.TRUST_PROXY_HOPS)) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS));
}

// Avoid revealing Express/version information and add baseline browser protections.
app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // Same-origin browser usage is supported; do not expose the proxy to arbitrary
  // cross-origin browser scripts. CORS is not an authentication boundary.
  const origin = _req.get('origin');
  const requestOrigin = `${_req.protocol}://${_req.get('host')}`;
  if (origin && origin === requestOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (_req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

app.use(express.json({ limit: '32kb' }));

async function readJsonBodyLimited(response: Response, maxBytes: number): Promise<{ data: unknown; byteLength: number }> {
  if (!response.body) return { data: null, byteLength: 0 };

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;

      byteLength += result.value.byteLength;
      if (byteLength > maxBytes) {
        await reader.cancel();
        throw new Error('Upstream JSON response exceeded the configured size limit.');
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = Buffer.concat(chunks.map(chunk => Buffer.from(chunk))).toString('utf8');
  return { data: JSON.parse(body), byteLength };
}

function cacheJson(key: string, data: unknown, contentType: string, byteLength: number): void {
  if (byteLength > MAX_CACHEABLE_JSON_BYTES) return;

  const now = Date.now();
  for (const [entryKey, entry] of cache) {
    if (entry.expires <= now) cache.delete(entryKey);
  }

  while (cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }

  cache.set(key, { data, contentType, expires: now + CACHE_TTL_MS });
}

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Only GET/HEAD requests are forwarded. The destination host is fixed, the
// URL length is bounded, upstream JSON is size-limited, and binary responses stream.
app.get('/api/music/*', async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  pruneRateWindows();
  const globalWait = consumeRateLimit('all:' + ip, 180);
  if (globalWait) {
    res.setHeader('Retry-After', String(globalWait));
    res.setHeader('Cache-Control', 'no-store');
    res.status(429).json({ error: 'Request limit reached. Please retry shortly.' });
    return;
  }

  const requestUrl = new URL(req.originalUrl, 'http://localhost');
  if (requestUrl.pathname.length + requestUrl.search.length > MAX_PROXY_URL_LENGTH) {
    res.status(414).json({ error: 'Music API request URL is too long.' });
    return;
  }

  let apiPath = requestUrl.pathname.slice('/api/music'.length);
  if (!apiPath.startsWith('/api/')) apiPath = '/api' + apiPath;
  const match = /^\/api\/(health|search|suggestions|track|stream|lyrics|related|next|playlist|artist|album)(?:\/([A-Za-z0-9_-]{1,160}))?$/.exec(apiPath);
  if (!match) {
    res.status(404).json({ error: 'Unknown music API endpoint.' });
    return;
  }

  const route = match[1];
  const id = match[2];
  const idRoutes = new Set(['track', 'stream', 'lyrics', 'related', 'next', 'playlist', 'artist', 'album']);
  if ((idRoutes.has(route) && !id) || (!idRoutes.has(route) && id)) {
    res.status(400).json({ error: 'Invalid music API path.' });
    return;
  }

  const permittedParams: Record<string, string[]> = {
    health: [], search: ['q', 'limit'], suggestions: ['q'], track: [],
    stream: ['f'], lyrics: [], related: [], next: [], playlist: [], artist: [], album: [],
  };
  for (const key of requestUrl.searchParams.keys()) {
    if (!permittedParams[route].includes(key) || requestUrl.searchParams.getAll(key).length !== 1) {
      res.status(400).json({ error: 'Unsupported or duplicate query parameter.' });
      return;
    }
  }

  const targetUrl = new URL('/api/' + route + (id ? '/' + id : ''), MUSIC_API_BASE);
  if (route === 'search') {
    const query = (requestUrl.searchParams.get('q') || '').trim();
    if (!query || query.length > 100) {
      res.status(400).json({ error: 'Search query must contain 1–100 characters.' });
      return;
    }
    const rawLimit = requestUrl.searchParams.get('limit') || '20';
    if (!/^\d+$/.test(rawLimit) || !Number.isSafeInteger(Number(rawLimit)) || Number(rawLimit) < 1) {
      res.status(400).json({ error: 'Invalid search result limit.' });
      return;
    }
    targetUrl.searchParams.set('q', query);
    targetUrl.searchParams.set('limit', String(Math.min(20, Number(rawLimit))));
    const searchWait = consumeRateLimit('search:' + ip, 75);
    if (searchWait) {
      res.setHeader('Retry-After', String(searchWait));
      res.status(429).json({ error: 'Search limit reached. Please retry shortly.' });
      return;
    }
  } else if (route === 'suggestions') {
    const query = (requestUrl.searchParams.get('q') || '').trim();
    if (query.length < 2 || query.length > 80) {
      res.status(400).json({ error: 'Suggestion query must contain 2–80 characters.' });
      return;
    }
    targetUrl.searchParams.set('q', query);
    const searchWait = consumeRateLimit('search:' + ip, 75);
    if (searchWait) {
      res.setHeader('Retry-After', String(searchWait));
      res.status(429).json({ error: 'Search limit reached. Please retry shortly.' });
      return;
    }
  } else if (route === 'stream') {
    const format = requestUrl.searchParams.get('f');
    if (format !== null && format !== '140' && format !== '251') {
      res.status(400).json({ error: 'Unsupported stream format.' });
      return;
    }
    if (format) targetUrl.searchParams.set('f', format);
    const streamWait = consumeRateLimit('stream:' + ip, 60);
    if (streamWait) {
      res.setHeader('Retry-After', String(streamWait));
      res.status(429).json({ error: 'Stream lookup limit reached. Please retry shortly.' });
      return;
    }
  }
  const cacheKey = targetUrl.toString();
  if (req.method === 'GET') {
    const cached = cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      res.status(200).set('Content-Type', cached.contentType).json(cached.data);
      return;
    }
    if (cached) cache.delete(cacheKey);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const headers: Record<string, string> = {
      'User-Agent': 'SoundWave-App/1.0',
    };
    headers.Accept = 'application/json';

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      signal: controller.signal,
    });
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    if (req.method === 'HEAD' || response.status === 204 || response.status === 304) {
      res.status(response.status).set('Content-Type', contentType).end();
      return;
    }

    if (contentType.includes('application/json')) {
      const result = await readJsonBodyLimited(response, MAX_JSON_RESPONSE_BYTES);
      if (response.ok && req.method === 'GET') {
        cacheJson(cacheKey, result.data, contentType, result.byteLength);
      }
      res.status(response.status).set('Content-Type', contentType).json(result.data);
      return;
    }

    res.status(response.status).set('Content-Type', contentType);
    if (!response.body) {
      res.end();
      return;
    }

    try {
      await pipeline(Readable.fromWeb(response.body as import('node:stream/web').ReadableStream), res);
    } catch (streamError) {
      if (res.headersSent) res.destroy();
      throw streamError;
    }
  } catch (error) {
    console.warn(
      '[SoundWave] Music proxy request failed:',
      error instanceof Error ? error.name : 'UnknownError'
    );
    if (res.headersSent) {
      if (!res.destroyed) res.destroy();
      return;
    }
    res.status(502).json({ error: 'The music provider is temporarily unavailable.' });
  } finally {
    clearTimeout(timeout);
  }
});

// Explicitly reject mutating methods on the public proxy.
app.all(['/api/music', '/api/music/*'], (_req, res) => {
  res.setHeader('Allow', 'GET, HEAD, OPTIONS');
  res.status(405).json({ error: 'Method not allowed.' });
});

if (!isProd) {
  const { createServer } = await import('vite');
  const vite = await createServer({
    server: {
      middlewareMode: true,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.resolve(__dirname, 'dist'), {
    dotfiles: 'deny',
    index: false,
  }));
  app.get('*', (_req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

// Keep development middleware private by default; production hosts must be reachable.
const host = isProd ? '0.0.0.0' : (process.env.DEV_HOST || '127.0.0.1');
app.listen(PORT, host, () => {
  console.log('SoundWave server listening on http://' + host + ':' + PORT);
});
