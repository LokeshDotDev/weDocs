import { Router } from 'express';
import {
  listFiles,
  getFileUrl,
  listUsers,
  listUploads,
  listFormattedFiles,
  getFileContent,
  saveFileContent,
  getDocxFileUrl,
  saveDocxFile,
  streamDocxByKey,
} from '../controllers/filesController.js';

const router = Router();

router.get('/list', listFiles);
router.get('/url', getFileUrl);
router.get('/users', listUsers);
router.get('/uploads', listUploads);
router.get('/formatted', listFormattedFiles);
router.get('/content', getFileContent);
router.post('/content', saveFileContent);

// ONLYOFFICE DOCX endpoints
router.get('/docx-url', getDocxFileUrl);
router.get('/docx-by-key', streamDocxByKey); // Stream directly by MinIO key (no presigned URL)
router.post('/docx-save', saveDocxFile);
// Health check endpoint for ONLYOFFICE container connectivity
router.get('/callback-health', (_req, res) => {
  res.json({ status: 'ok', message: 'ONLYOFFICE can reach this callback endpoint' });
});
// Proxy endpoint to fetch document with proper CORS headers
// Usage: /api/files/docx-proxy?url=<presigned-url>
router.get('/docx-proxy', async (req, res, next) => {
  try {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'url parameter is required' });
    }

    // Normalize and rewrite URL if needed for host environment
    let targetUrl = url;
    try {
      const u = new URL(url);
      // If ONLYOFFICE passed internal Docker hostname 'minio', rewrite to host-mapped port
      if (u.hostname === 'minio') {
        u.hostname = 'localhost';
        if (!u.port) u.port = '9000';
        targetUrl = u.toString();
      }
      if (u.hostname === 'host.docker.internal') {
        u.hostname = 'localhost';
        targetUrl = u.toString();
      }
    } catch (e) {
      console.warn('[docx-proxy] Invalid URL provided, using raw string');
    }

    console.log(`[docx-proxy] Fetching: ${targetUrl} (original: ${url})`);

    // Forward Range and HEAD requests; stream response to support partial content
    const headers: Record<string, string> = {};
    if (req.headers['range']) headers['range'] = String(req.headers['range']);

    let response: Response;
    try {
      response = await fetch(targetUrl, { method: req.method as any, headers });
    } catch (fetchError) {
      console.error(`[docx-proxy] Network error fetching ${targetUrl}`, fetchError);
      return res.status(502).json({ error: `Failed to fetch document: ${String(fetchError)}` });
    }

    if (!response.ok && response.status !== 206) {
      console.error(`[docx-proxy] Upstream returned ${response.status}: ${response.statusText}`);
      return res
        .status(response.status)
        .json({ error: `Failed to fetch document: ${response.status} ${response.statusText}` });
    }

    // Copy relevant headers
    const passthroughHeaders = [
      'content-type',
      'content-length',
      'accept-ranges',
      'content-range',
      'etag',
      'last-modified',
      'cache-control',
    ];
    for (const h of passthroughHeaders) {
      const v = response.headers.get(h);
      if (v) res.setHeader(h, v);
    }

    // Add permissive CORS for ONLYOFFICE
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Expose-Headers', '*');

    // Status passthrough (200 or 206)
    res.status(response.status);

    if (req.method === 'HEAD') {
      return res.end();
    }

    // Stream body
    const reader = response.body?.getReader();
    if (!reader) {
      return res.end();
    }

    // Pipe chunks to response
    res.flushHeaders();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) res.write(Buffer.from(value));
    }
    res.end();
  } catch (error) {
    console.error('[docx-proxy] Error:', error);
    next(error);
  }
});

export default router;
