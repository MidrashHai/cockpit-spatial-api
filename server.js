/**
 * Cockpit Spatial™ API · v1.7-stable
 * Makom Intelligence™ · CorreIA LLC
 *
 * Serveur Express · expose PCNT™ v3.1 comme endpoint REST
 * Compatible avec le stack SHC Governance Engine existant
 *
 * ── Version ────────────────────────────────────────────────────
 * v1.7-stable · 13 Août 2026
 * OmeH.ai™ · Territorial Conversation Engine · Stable
 * Territory Action Layer™ · formalisé · gelé
 *
 * ── Capacités stables ──────────────────────────────────────────
 * Présence territoriale GPS + perception Ayin haMakom™
 * Identification ICL™ PCNT v3.1
 * Conversation Or haBayit™ · données PADA™
 * Pilotage cartographique conversationnel · Territory Action Layer™
 * Cas de référence : RUE TANO ATCHIMON · validé en production
 *
 * ── FREEZE ─────────────────────────────────────────────────────
 * Aucun nouveau comportement fonctionnel majeur ne sera ajouté
 * à cette version. Le prochain cycle part d'une base stabilisée.
 *
 * ── Historique des versions ────────────────────────────────────
 * v1.0 · 6 Août 2026  · Déploiement initial · C-01 / C-02
 * v1.1 · 7 Août 2026  · Ajout GET /v1/voie · fix search_path
 * v1.2 · 7 Août 2026  · Bump version · apostrophes
 * v1.3 · 7 Août 2026  · Fix double injection DATABASE_URL
 * v1.4 · 10 Août 2026 · Correction CORS · C-07
 * v1.5 · 12 Août 2026 · Proxy Or haBayit · C-05
 * v1.5b· 12 Août 2026 · Fix chemin or-habayit.js racine
 * v1.6 · 12 Août 2026 · Ajout POST /v1/auth · C-05 phase 2
 * v1.7 · 13 Août 2026 · GET /v1/territoire + GET /v1/voiries
 * v1.7-stable · 13 Août 2026 · FREEZE · TAL™ formalisé
 */

'use strict';

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { Pool } = require('pg');
const { compute } = require('./pcnt');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Connexion PostgreSQL ───────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ── CORS · Autorisation navigateur ────────────────────────────
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-app-key']
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json());

// ── GET /health ────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status:    'ok',
    service:   'Cockpit Spatial™ API',
    protocol:  'PCNT-v3.1',
    version:   '1.7-stable',
    engine:    'OmeH.ai™ · Territorial Conversation Engine · Stable',
    tal:       'Territory Action Layer™ · FREEZE',
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

// ── GET /v1/voie ───────────────────────────────────────────────
app.get('/v1/voie', (req, res) => {
  delete require.cache[require.resolve('./resolve-voie')];
  const { makeResolveVoieHandler } = require('./resolve-voie');
  return makeResolveVoieHandler()(req, res);
});

// ── POST /v1/or-habayit ────────────────────────────────────────
app.post('/v1/or-habayit', require('./or-habayit'));

// ── POST /v1/auth ──────────────────────────────────────────────
app.post('/v1/auth', require('./auth'));

// ── GET /v1/territoire ─────────────────────────────────────────
// Sol computationnel · 6025 adresses PADA · Cocody
app.get('/v1/territoire', require('./territoire'));

// ── GET /v1/voiries ────────────────────────────────────────────
// Réseau viaire · 386 voies · Cocody
app.get('/v1/voiries', require('./voiries'));

// ── GET /v1/info ───────────────────────────────────────────────
app.get('/v1/info', (req, res) => {
  res.json({
    service:   'Cockpit Spatial™ API',
    pcnt:      'v3.1',
    engine:    'OmeH.ai™ · Territorial Conversation Engine · Stable',
    tal:       'Territory Action Layer™ · FREEZE',
    codex:     'Codex Shem haMakomot v3.1',
    publisher: 'Makom Intelligence™ · CorreIA LLC',
    version:   '1.7-stable',
    endpoints: [
      'POST /v1/territorial-context',
      'POST /v1/territorial-context/batch',
      'POST /v1/resolve-presence',
      'GET  /v1/voie?nom=NOM_RUE',
      'POST /v1/or-habayit',
      'POST /v1/auth',
      'GET  /v1/territoire',
      'GET  /v1/voiries',
      'GET  /v1/info',
      'GET  /health',
    ],
  });
});

// ── DÉMARRAGE ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║   Cockpit Spatial™ API · v1.7-stable                ║');
  console.log('║   PCNT™ v3.1 · Makom Intelligence™                  ║');
  console.log('║   OmeH.ai™ · Territorial Conversation Engine        ║');
  console.log('║   Territory Action Layer™ · FREEZE                  ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`[SERVER] Port     : ${PORT}`);
  console.log(`[SERVER] CORS     : origin=* · preflight OPTIONS activé`);
  console.log(`[SERVER] Endpoint : POST /v1/territorial-context`);
  console.log(`[SERVER] Endpoint : GET  /v1/voie`);
  console.log(`[SERVER] Endpoint : POST /v1/or-habayit`);
  console.log(`[SERVER] Endpoint : POST /v1/auth`);
  console.log(`[SERVER] Endpoint : GET  /v1/territoire`);
  console.log(`[SERVER] Endpoint : GET  /v1/voiries`);
  console.log(`[SERVER] Health   : GET  /health`);
  console.log('');
  console.log('[FREEZE] Ayin haMakom™ voit.');
  console.log('[FREEZE] Or haBayit™ comprend et parle.');
  console.log('[FREEZE] Territory Action Layer™ agit.');
  console.log('[FREEZE] La carte manifeste.');
  console.log('[FREEZE] Ayin haMakom™ voit à nouveau.');
  console.log('');
});

module.exports = app;
