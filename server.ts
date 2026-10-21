import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const MUSIC_API_BASE = 'https://music-api.amanenime.my.id';

// In-memory cache for API responses (5 minute TTL)
const cache = new Map<string, { data: any; contentType: string; expires: number }>();

app.use(express.json());

// Enable CORS for all clients
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Music API Proxy route with caching and generous timeout
app.all('/api/music/*', async (req, res) => {
  try {
    const rawPath = req.originalUrl.replace(/^\/api\/music/, '');
    const targetPath = rawPath.startsWith('/api') ? rawPath : `/api${rawPath}`;
    const targetUrl = `${MUSIC_API_BASE}${targetPath}`;

    // Cache hit check for GET requests
    if (req.method === 'GET') {
      const cached = cache.get(targetUrl);
      if (cached && cached.expires > Date.now()) {
        res.status(200).set('Content-Type', cached.contentType);
        return res.json(cached.data);
      }
    }

    const headers: Record<string, string> = {
      'User-Agent': 'SoundWave-App/1.0',
    };
    if (req.headers['accept']) headers['Accept'] = req.headers['accept'] as string;

    // Up to 25s timeout to accommodate external music-api processing latency
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const contentType = response.headers.get('content-type') || 'application/json';
    res.status(response.status).set('Content-Type', contentType);

    if (contentType.includes('application/json')) {
      const data = await response.json();
      // Cache successful GET responses for 10 minutes
      if (response.ok && req.method === 'GET') {
        cache.set(targetUrl, {
          data,
          contentType,
          expires: Date.now() + 10 * 60 * 1000
        });
      }
      return res.json(data);
    } else {
      const buffer = await response.arrayBuffer();
      return res.send(Buffer.from(buffer));
    }
  } catch (err: any) {
    console.warn('Music Proxy Warning:', err.message);
    res.status(502).json({ error: 'Proxy request failed', message: err.message });
  }
});

// Mount Vite middleware in dev or static files in production
const isProd = process.env.NODE_ENV === 'production';

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
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`SoundWave server listening on http://0.0.0.0:${PORT}`);
});
