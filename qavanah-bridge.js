/**
 * qavanah-bridge.js
 * Makom Intelligence™ · CorreIA LLC
 * Version : 1.0.0
 * Date : 2026-08-14
 *
 * Pont entre cockpit-spatial-api (Or haBayit™) et QAVANAH API™
 *
 * Responsabilités :
 * 1 · Extraire l'action TAL depuis la réponse texte d'Or haBayit™
 * 2 · Construire le payload Qavanah depuis le contexte de la requête
 * 3 · Appeler POST /v1/qavanah/check
 * 4 · Retourner la décision enrichie
 *
 * Loi E-02 : jamais appelé depuis le frontend · côté serveur uniquement
 * Loi Fallback : si Qavanah injoignable → continuer en mode dégradé gracieux
 * Mode actuel : OBSERVE · Qavanah conseille · Or haBayit continue dans tous les cas
 */

'use strict';

const https = require('https');
const http  = require('http');
// uuid non requis · ID générés depuis Date.now()
function generateBridgeId(prefix) {
  const ts = Date.now().toString(36).toUpperCase();
  const rd = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${ts}${rd}`;
}

// ─── EXTRACTION TAL ──────────────────────────────────────────────────────────
// Extrait le bloc <TAL>{...}</TAL> depuis le texte libre d'Or haBayit™

function extractTAL(text) {
  if (!text) return null;

  const match = text.match(/<TAL>([\s\S]*?)<\/TAL>/);
  if (!match) return null;

  try {
    const action = JSON.parse(match[1].trim());
    return {
      raw:    match[1].trim(),
      action: normalizeAction(action)
    };
  } catch (e) {
    console.error('[QAVANAH-BRIDGE] Erreur parse TAL :', e.message);
    return null;
  }
}

// Normalise l'action TAL vers le format Qavanah
function normalizeAction(talAction) {
  if (!talAction) return null;

  // Mapping format TAL → format Qavanah
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

  const type = typeMap[talAction.action] || talAction.action;
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

/**
 * checkWithQavanah
 * Extraire l'action TAL · appeler Qavanah · retourner la décision enrichie
 *
 * @param {string} responseText  - texte brut d'Or haBayit™
 * @param {object} context       - contexte de la requête (icl, sessionId, etc.)
 * @param {string} qavanah_url   - URL de QAVANAH API™ (depuis env QAVANAH_API_URL)
 * @returns {object}             - { talExtracted, decision, enrichedResponse }
 */
async function checkWithQavanah(responseText, context, qavanah_url) {

  // Résultat par défaut (mode dégradé gracieux si Qavanah injoignable)
  const defaultResult = {
    qavanah_active:  false,
    decision:        'ALLOW',
    mode:            'DEGRADED',
    note:            'Qavanah non joignable · mode dégradé gracieux',
    talExtracted:    null
  };

  if (!qavanah_url) {
    return { ...defaultResult, note: 'QAVANAH_API_URL non configuré' };
  }

  // 1 · Extraire l'action TAL
  const talResult = extractTAL(responseText);

  if (!talResult) {
    // Pas d'action TAL dans la réponse → texte conversationnel pur → ALLOW implicite
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
      scope:      null  // Or haBayit™ détermine le scope dynamiquement
    },
    context: {
      contextId: `CTX-OHB-${Date.now().toString(36).toUpperCase()}`,
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
      id:         `ACT-OHB-${Date.now().toString(36).toUpperCase()}`,
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
      decision:       qavanah_decision.decision,        // ALLOW | ADJUST | BLOCK
      mode:           qavanah_decision.mode,            // OBSERVE
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
    // Fallback gracieux : Qavanah injoignable → continuer sans bloquer
    console.error('[QAVANAH-BRIDGE] Erreur :', err.message);
    return {
      ...defaultResult,
      qavanah_active: false,
      decision:       'ALLOW',
      mode:           'DEGRADED',
      talExtracted:   talResult,
      error:          err.message,
      note:           `Qavanah injoignable (${err.message}) · mode dégradé · action autorisée par défaut`
    };
  }
}

function buildNote(decision) {
  if (decision.decision === 'ALLOW')  return `ALLOW · composite=${decision.alignment?.composite} · ${decision.drift?.state}`;
  if (decision.decision === 'ADJUST') return `ADJUST · ${decision.reasonCodes?.join(', ')} · RECOMPUTE`;
  if (decision.decision === 'BLOCK')  return `BLOCK · ${decision.reasonCodes?.join(', ')} · STOP`;
  return 'UNKNOWN';
}

// ─── ENRICHISSEMENT DE LA RÉPONSE ────────────────────────────────────────────
// Enrichit la réponse Or haBayit™ avec la décision Qavanah
// Le format texte + TAL reste inchangé pour le frontend

function enrichResponse(claudeResponse, qavResult) {
  if (!claudeResponse || !claudeResponse.content) return claudeResponse;

  // En mode OBSERVE : la décision est ajoutée comme métadonnée
  // Le texte et le bloc TAL restent intacts pour le frontend
  return {
    ...claudeResponse,
    qavanah: {
      active:      qavResult.qavanah_active,
      decision:    qavResult.decision,
      mode:        qavResult.mode,
      checkId:     qavResult.checkId     || null,
      trajectoryId:qavResult.trajectoryId || null,
      action:      qavResult.action      || null,
      alignment:   qavResult.alignment   || null,
      drift:       qavResult.drift       || null,
      reasonCodes: qavResult.reasonCodes || [],
      note:        qavResult.note        || null
    }
  };
}

module.exports = {
  extractTAL,
  normalizeAction,
  checkWithQavanah,
  enrichResponse
};
