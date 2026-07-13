/* ============================================================
   CODELENS — Express Backend
   Serves the client/ frontend and exposes /api routes
   ============================================================ */

'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const explainRouter = require('./routes/explain');
const mentorRouter = require('./routes/mentor');
const runRouter = require('./routes/run');
const saveRouter = require('./routes/save');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Ensure data/ directory exists ────────────────────────
const SAVE_DIR = path.resolve(process.env.SAVE_DIR || './data');
if (!fs.existsSync(SAVE_DIR)) {
  fs.mkdirSync(SAVE_DIR, { recursive: true });
}

// ── CORS ─────────────────────────────────────────────────
// ── CORS ─────────────────────────────────────────────────
// ── CORS ─────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

console.log("RAW ALLOWED_ORIGINS =", process.env.ALLOWED_ORIGINS);
console.log("PARSED ALLOWED_ORIGINS =", JSON.stringify(allowedOrigins));

app.use(cors({
  origin: true,
  credentials: true,
}));


// ── Body parsing ─────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// ── Serve static frontend ─────────────────────────────────
app.use(express.static(path.join(__dirname, '../client')));

// ── API routes ────────────────────────────────────────────
app.use('/api/explain', explainRouter);
app.use('/api/mentor', mentorRouter);
app.use('/api/run', runRouter);
app.use('/api/save', saveRouter);

// ── Health check ──────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

// ── SPA fallback — serve index.html for non-API routes ────
app.get('*', (req, res) => {
  // Don't catch /api/* — let errorHandler deal with unknown APIs
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// ── Global error handler ──────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\x1b[36m%s\x1b[0m', `
  ╔══════════════════════════════════════╗
  ║      CodeLens Backend  🔭            ║
  ║  http://localhost:${PORT}              ║
  ╚══════════════════════════════════════╝
  `);
  console.log('\x1b[32m✔\x1b[0m API routes:  /api/explain  /api/mentor  /api/run  /api/save');
  console.log('\x1b[32m✔\x1b[0m Static:      /client  →  http://localhost:' + PORT);
  console.log('\x1b[2m   Press Ctrl+C to stop\x1b[0m\n');
});
