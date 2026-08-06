/**
 * Cockpit Spatial™ API · v1.0
 * Makom Intelligence™ · CorreIA LLC
 *
 * Serveur Express · expose PCNT™ v3.1 comme endpoint REST
 * Compatible avec le stack SHC Governance Engine existant
 */

'use strict';

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { compute } = require('./pcnt');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ── GET /health ────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status:    'ok',
    service:   'Cockpit Spatial™ API',
    protocol:  'PCNT-v3.1',
    version:   '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ── POST /v1/territorial-context ──────────────────────────────
app.post('/v1/territorial-context', (req, res) => {
  const { latitude, longitude } = req.body;

  if (latitude === undefined || longitude === undefined) {
    return res.status(400).json({
      error: {
        code:     'ERR_BODY_INVALID',
        message:  'latitude et longitude sont requis',
        expected: '{ "latitude": float, "longitude": float }',
      }
    });
  }

  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);

  if (isNaN(lat) || lat < -90 || lat > 90) {
    return res.status(400).json({
      error: {
        code:     'ERR_LAT_RANGE',
        message:  `latitude ${latitude} hors plage [-90, 90]`,
        field:    'latitude',
        received:  latitude,
        expected: 'float dans [-90.0, 90.0]',
      }
    });
  }

  if (isNaN(lon) || lon < -180 || lon > 180) {
    return res.status(400).json({
      error: {
        code:     'ERR_LON_RANGE',
        message:  `longitude ${longitude} hors plage [-180, 180]`,
        field:    'longitude',
        received:  longitude,
        expected: 'float dans [-180.0, 180.0]',
      }
    });
  }

  try {
    const t0      = Date.now();
    const context = compute(lat, lon);
    const ms      = Date.now() - t0;
    return res.json({ ...context, computation_ms: ms });
  } catch (err) {
    return res.status(500).json({
      error: { code: 'ERR_COMPUTE', message: err.message }
    });
  }
});

// ── POST /v1/territorial-context/batch ────────────────────────
app.post('/v1/territorial-context/batch', (req, res) => {
  const { locations } = req.body;

  if (!Array.isArray(locations) || locations.length === 0) {
    return res.status(400).json({
      error: { code: 'ERR_BODY_INVALID', message: 'locations doit être un tableau non vide' }
    });
  }

  const MAX = parseInt(process.env.NIM_MAX_BATCH) || 1000;
  if (locations.length > MAX) {
    return res.status(400).json({
      error: { code: 'ERR_BATCH_SIZE', message: `batch limité à ${MAX} entrées` }
    });
  }

  const t0      = Date.now();
  const results = [];
  let   success = 0;
  let   errors  = 0;

  for (const loc of locations) {
    const lat = parseFloat(loc.latitude);
    const lon = parseFloat(loc.longitude);
    try {
      const ctx = compute(lat, lon);
      results.push({ id: loc.id || null, ...ctx });
      success++;
    } catch (err) {
      results.push({ id: loc.id || null, status: 'ERROR', error: err.message });
      errors++;
    }
  }

  return res.json({
    results,
    total:          locations.length,
    success,
    errors,
    computation_ms: Date.now() - t0,
  });
});

// ── POST /v1/resolve-presence ──────────────────────────────────
app.post('/v1/resolve-presence', async (req, res) => {
  const { makeResolvePresenceHandler } = require('./resolve-presence');
  return makeResolvePresenceHandler(compute)(req, res);
});

// ── GET /v1/info ───────────────────────────────────────────────
app.get('/v1/info', (req, res) => {
  res.json({
    service:   'Cockpit Spatial™ API',
    pcnt:      'v3.1',
    codex:     'Codex Shem haMakomot v3.1',
    publisher: 'Makom Intelligence™ · CorreIA LLC',
    endpoints: [
      'POST /v1/territorial-context',
      'POST /v1/territorial-context/batch',
      'POST /v1/resolve-presence',
      'GET  /v1/info',
      'GET  /health',
    ],
  });
});

// ── DÉMARRAGE ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   Cockpit Spatial™ API · v1.0               ║');
  console.log('║   PCNT™ v3.1 · Makom Intelligence™          ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
  console.log(`[SERVER] Port     : ${PORT}`);
  console.log(`[SERVER] Endpoint : POST /v1/territorial-context`);
  console.log(`[SERVER] Health   : GET  /health`);
  console.log('');
});

module.exports = app;
