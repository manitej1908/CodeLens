/* ============================================================
   POST /api/save
   Body: { files, sessionId }
   Returns: { success, savedAt, sessionId, fileCount }

   Persists workspace state to data/<sessionId>.json on the
   server. The client can later retrieve sessions by sessionId.
   ============================================================ */

'use strict';

const express = require('express');
const router  = express.Router();
const { writeFile, readFile } = require('fs/promises');
const path    = require('path');
const { v4: uuidv4 } = require('uuid');

const SAVE_DIR = path.resolve(process.env.SAVE_DIR || './data');
const MAX_FILE_SIZE_BYTES = 500 * 1024; // 500 KB per save

// ── Sanitize files before writing ───────────────────────────
function sanitizeFiles(files) {
  if (!Array.isArray(files)) return [];
  return files.map(f => ({
    id:         String(f.id   || '').substring(0, 64),
    name:       String(f.name || 'untitled').substring(0, 128),
    lang:       String(f.lang || 'Unknown').substring(0, 32),
    ext:        String(f.ext  || '.txt').substring(0, 16),
    icon:       String(f.icon || '📄').substring(0, 8),
    monacoLang: String(f.monacoLang || 'plaintext').substring(0, 32),
    content:    String(f.content || '').substring(0, 100_000), // 100 KB max per file
    modified:   Boolean(f.modified),
  }));
}

// ── POST /api/save ────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { files, sessionId: clientSessionId } = req.body;

    // Use client's sessionId if valid UUID-shaped string, otherwise generate new
    const sessionId = (typeof clientSessionId === 'string' && /^[\w-]{8,64}$/.test(clientSessionId))
      ? clientSessionId
      : uuidv4();

    const sanitized = sanitizeFiles(files);
    const savedAt   = new Date().toISOString();

    const payload = JSON.stringify({
      sessionId,
      savedAt,
      fileCount: sanitized.length,
      files:     sanitized,
    }, null, 2);

    // Guard against oversized saves
    if (Buffer.byteLength(payload, 'utf8') > MAX_FILE_SIZE_BYTES) {
      return res.status(413).json({ error: 'Save payload too large (max 500 KB).' });
    }

    const savePath = path.join(SAVE_DIR, `${sessionId}.json`);
    await writeFile(savePath, payload, 'utf8');

    res.json({ success: true, savedAt, sessionId, fileCount: sanitized.length });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/save/:sessionId — retrieve a saved session ──────
router.get('/:sessionId', async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    // Validate sessionId to prevent path traversal
    if (!/^[\w-]{8,64}$/.test(sessionId)) {
      return res.status(400).json({ error: 'Invalid sessionId.' });
    }

    const savePath = path.join(SAVE_DIR, `${sessionId}.json`);
    const raw      = await readFile(savePath, 'utf8');
    res.json(JSON.parse(raw));
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'Session not found.' });
    }
    next(err);
  }
});

module.exports = router;
