import express from 'express';

const router = express.Router();

// These endpoints proxy third-party assets (face-api.js + model files)
// so the browser loads them from same-origin `/api/vendor/...`.
// This avoids mobile tracking-prevention blocking storage access on `unpkg.com`.

const memoryCache = new Map();

function isSafeFileName(name) {
  const v = String(name || '').trim();
  if (!v) return false;
  // Allow common model filenames like:
  // - tiny_face_detector_model-weights_manifest.json
  // - tiny_face_detector_model-shard1
  // - face_recognition_model-shard2
  // - mtcnn_model-weights_manifest.json
  return /^[A-Za-z0-9._-]+$/.test(v);
}

function contentTypeFor(fileName) {
  const f = String(fileName || '').toLowerCase();
  if (f.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (f.endsWith('.json')) return 'application/json; charset=utf-8';
  if (f.endsWith('.wasm')) return 'application/wasm';
  if (f.endsWith('.bin')) return 'application/octet-stream';
  // Shards often have no extension
  if (f.includes('shard')) return 'application/octet-stream';
  return 'application/octet-stream';
}

async function proxyTo(res, cacheKey, upstreamUrl, { contentType, maxAgeSeconds = 60 * 60 * 24 } = {}) {
  const cached = memoryCache.get(cacheKey);
  if (cached) {
    res.setHeader('Content-Type', cached.contentType);
    res.setHeader('Cache-Control', `public, max-age=${cached.maxAgeSeconds}`);
    if (cached.etag) res.setHeader('ETag', cached.etag);
    return res.send(cached.body);
  }

  const r = await fetch(upstreamUrl, {
    redirect: 'follow',
    headers: {
      // avoid upstream gzip surprises; node fetch handles decompression but keep it simple
      'Accept': '*/*',
    },
  });

  if (!r.ok) {
    const text = await r.text().catch(() => '');
    res.status(r.status);
    return res.json({ message: `Upstream fetch failed (${r.status})`, url: upstreamUrl, detail: text.slice(0, 500) });
  }

  const buf = Buffer.from(await r.arrayBuffer());
  const ct = contentType || r.headers.get('content-type') || 'application/octet-stream';
  const etag = r.headers.get('etag') || '';

  memoryCache.set(cacheKey, { body: buf, contentType: ct, etag, maxAgeSeconds });

  res.setHeader('Content-Type', ct);
  res.setHeader('Cache-Control', `public, max-age=${maxAgeSeconds}`);
  if (etag) res.setHeader('ETag', etag);
  return res.send(buf);
}

// GET /api/vendor/face-api.min.js
router.get('/face-api.min.js', async (req, res, next) => {
  try {
    const upstream = 'https://unpkg.com/face-api.js@0.22.2/dist/face-api.min.js';
    return await proxyTo(res, 'face-api.min.js', upstream, {
      contentType: 'application/javascript; charset=utf-8',
      maxAgeSeconds: 60 * 60 * 24,
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/vendor/face-models/:file
router.get('/face-models/:file', async (req, res, next) => {
  try {
    const file = req.params.file;
    if (!isSafeFileName(file)) return res.status(400).json({ message: 'invalid file name' });

    // Models hosted by face-api.js author
    const upstream = `https://justadudewhohacks.github.io/face-api.js/models/${encodeURIComponent(file)}`;

    return await proxyTo(res, `model:${file}`, upstream, {
      contentType: contentTypeFor(file),
      maxAgeSeconds: 60 * 60 * 24,
    });
  } catch (e) {
    next(e);
  }
});

export default router;
