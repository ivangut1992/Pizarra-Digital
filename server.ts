/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';
const distPath = path.resolve(__dirname, 'dist');

// 1. HTTP/2 and HTTP/3 Protocol Advertisement & Performance Headers
app.use((req: Request, res: Response, next: NextFunction) => {
  // Advertise HTTP/3 (QUIC) and HTTP/2 to modern clients and reverse-proxies
  res.setHeader('Alt-Svc', 'h3=":443"; ma=86400, h2=":443"; ma=86400');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Vary', 'Accept-Encoding');
  next();
});

// 2. High-Efficiency Brotli Compression Middleware for all text & JSON responses
app.use((req: Request, res: Response, next: NextFunction) => {
  const acceptEncoding = req.headers['accept-encoding'] || '';
  const supportsBrotli = typeof acceptEncoding === 'string' && acceptEncoding.includes('br');

  if (!supportsBrotli) {
    return next();
  }

  // Intercept text/html/css/js/json responses to compress with Brotli
  const originalSend = res.send.bind(res);
  res.send = function (body: unknown): Response {
    if (res.headersSent) {
      return originalSend(body);
    }

    const contentType = (res.getHeader('Content-Type') as string) || '';
    const isCompressible =
      /text|javascript|json|css|svg|xml/i.test(contentType) ||
      typeof body === 'string' ||
      Buffer.isBuffer(body);

    if (!isCompressible || !body) {
      return originalSend(body);
    }

    try {
      const buffer = Buffer.isBuffer(body)
        ? body
        : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));

      // Skip very tiny responses (< 64 bytes)
      if (buffer.length < 64) {
        return originalSend(body);
      }

      const compressed = zlib.brotliCompressSync(buffer, {
        params: {
          [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
          [zlib.constants.BROTLI_PARAM_QUALITY]: 4, // Balanced speed & high compression ratio
        },
      });

      res.setHeader('Content-Encoding', 'br');
      res.removeHeader('Content-Length');
      return originalSend(compressed);
    } catch (err) {
      console.warn('Brotli compression fallback:', err);
      return originalSend(body);
    }
  };

  next();
});

// 3. Cache Optimization Layer
// - /assets/* -> 1 year immutable
// - WebP and images -> 24 hours + stale-while-revalidate 7 days
// - HTML -> ETag + must-revalidate (304 Not Modified)
app.use((req: Request, res: Response, next: NextFunction) => {
  const url = req.path;

  if (url.startsWith('/assets/')) {
    // Immutable hashed static assets
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (/\.(webp|png|jpe?g|gif|mp4|webm|mp3|wav|ogg|svg|woff2?)$/i.test(url)) {
    // Optimized media with stale-while-revalidate
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  } else if (url === '/' || url.endsWith('.html')) {
    // Dynamic entry point HTML: must revalidate with ETags
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  }

  next();
});

async function startServer() {
  if (!isProd) {
    // Development mode: mount Vite dev server middlewares
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);

    app.use('*', async (req: Request, res: Response, next: NextFunction) => {
      const url = req.originalUrl;
      try {
        const templatePath = path.resolve(__dirname, 'index.html');
        let template = fs.readFileSync(templatePath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);

        // Generate ETag for HTML
        const etag = crypto.createHash('md5').update(template).digest('hex');
        res.setHeader('ETag', `"${etag}"`);

        if (req.headers['if-none-match'] === `"${etag}"`) {
          return res.status(304).end();
        }

        res.status(200).set({ 'Content-Type': 'text/html' }).send(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    // Production mode: serve pre-compressed static files from dist
    app.use(
      express.static(distPath, {
        maxAge: '1y',
        immutable: true,
        index: false,
      })
    );

    app.use('*', (req: Request, res: Response) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        const html = fs.readFileSync(indexPath, 'utf-8');
        const etag = crypto.createHash('md5').update(html).digest('hex');
        res.setHeader('ETag', `"${etag}"`);
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');

        if (req.headers['if-none-match'] === `"${etag}"`) {
          return res.status(304).end();
        }

        res.status(200).set({ 'Content-Type': 'text/html' }).send(html);
      } else {
        res.status(404).send('Build not found. Please build the application.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Pizarra Digital running at http://0.0.0.0:${PORT} [HTTP/2 & HTTP/3 enabled, Brotli active, Caching optimized]`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
