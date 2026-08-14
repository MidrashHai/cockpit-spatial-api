/**
 * qavanah-bridge.js
 * Makom Intelligence™ · CorreIA LLC
 * Version : 1.0.1
 * Date : 2026-08-14
 * FIX : suppression require('uuid') · parser TAL robuste
 *
 * Pont entre cockpit-spatial-api (Or haBayit™) et QAVANAH API™
 * Loi E-02 : jamais appelé depuis le frontend · côté serveur uniquement
 * Loi Fallback : si Qavanah injoignable → continuer en mode dégradé gracieux
 */

'use strict';

const https = require('https');
const http  = require('http');

// ─── ID GENERATOR · sans uuid ────────────────────────────────────────────────
function generateBridgeId(prefix) {
  const ts = Date.now().toString(36).toUpperCase();
  const rd = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${ts}${rd}`;
}

// ─── EXTRACTION TAL · ROBUSTE ─────────────────────────────────────────────────
// Tente de réparer le JSON avant d'abandonner
// Gère : clés sans guillemets · virgules trailing · apostrophes

function repairJSON(raw) {
  try {
    // Tentative directe
    return JSON.parse(raw);
  } catch {}

  try {
    // Ajouter guillemets autour des clés sans guillemets
    // {action:"SEARCH_PLACE"} → {"action":"SEARCH_PLACE"}
    const repaired = raw
      .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
      .replace(/:\s*'([^']*)'/g, ': "$1"')   // apostrophes → guillemets
      .replace(/,\s*}/g, '}')                 // trailing comma
      .replace(/,\s*]/g, ']');               // trailing comma array
    return JSON.parse(repaired);
  } catch {}

  return null;
}

function extractTAL(text) {
  if (!text) return null;

  const match = text.match(/<TAL>([\s\S]*?)<\/TAL>/);
  if (!match) return null;

  const raw    = match[1].trim();
  const action = repairJSON(raw);

  if (!action) {
    console.error('[QAVANAH-BRIDGE] Erreur parse TAL (non réparable) :', raw.substring(0, 80));
    return null;
  }

  return {
    raw,
    action: normalizeAction(action)
  };
}

// ─── NORMALISATION ACTION TAL → FORMAT QAVANAH ───────────────────────────────
function normalizeAction(talAction) {
  if (!talAction) return null;

  const typeMap = {
    'SEARCH_PLACE':    'SEARCH_PLACE',
    'SEARCH_ROAD':     'SEARCH_PLACE',
    'FLY_TO':         'FLY_TO',
    'ZOOM_TO':        'ZOOM_TO',
    'RESET_VIEW':     'RESET_VIEW',
    'HIGHLIGHT_ROAD': 'HIGHLIGHT_ROAD',
    'HIGHLIGHT_PLACE':'HIGHLIGHT_PLACE',
    'SHOW_LAYER':     'SHOW_LAYER',
    'HIDE_LAYER':     'HIDE_LAYER',
    'PLACE_MARKER':   'PLACE_MARKER',
    'START_GPS':      'START_GPS',
    'SEARCH_NUMBER':  'SEARCH_NUMBER',
  };

  const type       = typeMap[talAction.action] || talAction.action;
  const parameters = {};

  if (talAction.query)     parameters.query     = talAction.query;
  if (talAction.icl)       parameters.icl       = talAction.icl;
  if (talAction.lat)       parameters.lat       = talAction.lat;
  if (talAction.lon)       parameters.lon       = talAction.lon;
  if (talAction.zoom)      parameters.level     = talAction.zoom;
  if (talAction.roadName)  parameters.roadName  = talAction.roadName;
  if (talAction.placeName) parameters.placeName = talAction.placeName;
  if (talAction.layer)     parameters.layer     = talAction.layer;
  if (talAction.label)     parameters.label     = talAction.label;
  if (talAction.numero)    parameters.query     = String(talAction.numero);

  return { type, parameters };
}

// ─── APPEL QAVANAH ───────────────────────────────────────────────────────────
function callQavanah(qavanah_url, payload, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    try {
      const url     = new URL('/v1/qavanah/check', qavanah_url);
      const body    = JSON.stringify(payload);
      const isHttps = url.protocol === 'https:';
      const lib     = isHttps ? https : http;

      const opts = {
        hostname: url.hostname,
        port:     url.port || (isHttps ? 443 : 80),
        path:     url.pathname,
        method:   'POST',
        headers:  {
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      };

      const req = lib.request(opts, (res) => {
        let raw = '';
        res.on('data', d => raw += d);
        res.on('end', () => {
          try { resolve(JSON.parse(raw)); }
          catch { reject(new Error('QAVANAH_PARSE_ERROR')); }
        });
      });

      req.on('error', reject);
      req.setTimeout(timeoutMs, () => {
        req.destroy();
        reject(new Error('QAVANAH_TIMEOUT'));
      });

      req.write(body);
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

// ─── INTERFACE PRINCIPALE ────────────────────────────────────────────────────

async function checkWithQavanah(responseText, context, qavanah_url) {

  const defaultResult = {
    qavanah_active: false,
    decision:       'ALLOW',
    mode:           'DEGRADED',
    note:           'Qavanah non joignable · mode dégradé gracieux',
    talExtracted:   null
  };

  if (!qavanah_url) {
    return { ...defaultResult, note: 'QAVANAH_API_URL non configuré' };
  }

  // 1 · Extraire l'action TAL
  const talResult = extractTAL(responseText);

  if (!talResult) {
    return {
      qavanah_active: true,
      decision:       'ALLOW',
      mode:           'OBSERVE',
      note:           'Aucune action TAL détectée · réponse conversationnelle',
      talExtracted:   null
    };
  }

  // 2 · Construire le payload Qavanah
  const trajectoryId = context.trajectoryId || `TRJ-OHB-${Date.now().toString(36).toUpperCase()}`;
  const sessionId    = context.sessionId    || 'unknown-session';
  const icl          = context.icl          || null;

  const payload = {
    trajectoryId,
    intent: {
      contractId: `IC-OHB-${sessionId}`,
      version:    1,
      source:     'USER_CONFIRMED',
      scope:      null
    },
    context: {
      contextId: generateBridgeId('CTX'),
      icl,
      place:   context.place   || {},
      state:   context.state   || {},
      zera:    context.zera    || null
    },
    agent: {
      id:    'or-habayit',
      model: 'claude-sonnet-4-6',
      step:  context.step || 1
    },
    action: {
      id:         generateBridgeId('ACT'),
      type:       talResult.action.type,
      parameters: talResult.action.parameters
    }
  };

  // 3 · Appeler Qavanah
  try {
    const qavanah_decision = await callQavanah(qavanah_url, payload);

    console.log(`[QAVANAH-BRIDGE] ${talResult.action.type} → ${qavanah_decision.decision} · tension=${qavanah_decision.drift?.tension}`);

    return {
      qavanah_active: true,
      decision:       qavanah_decision.decision,
      mode:           qavanah_decision.mode,
      trajectoryId,
      checkId:        qavanah_decision.checkId,
      action:         talResult.action,
      talRaw:         talResult.raw,
      alignment:      qavanah_decision.alignment,
      drift:          qavanah_decision.drift,
      reasonCodes:    qavanah_decision.reasonCodes,
      evidence:       qavanah_decision.evidence,
      next:           qavanah_decision.next,
      note:           buildNote(qavanah_decision)
    };

  } catch (err) {
    console.error('[QAVANAH-BRIDGE] Erreur :', err.message);
    return {
      ...defaultResult,
      qavanah_active: false,
      decision:       'ALLOW',
      mode:           'DEGRADED',
      talExtracted:   talResult,
      error:          err.message,
      note:           `Qavanah injoignable (${err.message}) · mode dégradé`
    };
  }
}

function buildNote(decision) {
  if (decision.decision === 'ALLOW')  return `ALLOW · composite=${decision.alignment?.composite} · ${decision.drift?.state}`;
  if (decision.decision === 'ADJUST') return `ADJUST · ${decision.reasonCodes?.join(', ')} · RECOMPUTE`;
  if (decision.decision === 'BLOCK')  return `BLOCK · ${decision.reasonCodes?.join(', ')} · STOP`;
  return 'UNKNOWN';
}

// ─── ENRICHISSEMENT ──────────────────────────────────────────────────────────
function enrichResponse(claudeResponse, qavResult) {
  if (!claudeResponse || !claudeResponse.content) return claudeResponse;
  return {
    ...claudeResponse,
    qavanah: {
      active:       qavResult.qavanah_active,
      decision:     qavResult.decision,
      mode:         qavResult.mode,
      checkId:      qavResult.checkId      || null,
      trajectoryId: qavResult.trajectoryId || null,
      action:       qavResult.action       || null,
      alignment:    qavResult.alignment    || null,
      drift:        qavResult.drift        || null,
      reasonCodes:  qavResult.reasonCodes  || [],
      note:         qavResult.note         || null
    }
  };
}

module.exports = {
  extractTAL,
  normalizeAction,
  checkWithQavanah,
  enrichResponse
};
