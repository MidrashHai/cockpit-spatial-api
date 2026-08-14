/**
 * qavanah-bridge.js
 * Makom Intelligence™ · CorreIA LLC
 * Version : 2.2.0
 * Date    : 2026-08-14
 *
 * CHANGEMENTS v2.2.0 · Priority 3 · Pipeline Bereshit 1:3
 *   · action.sequence_id transmis dans action (et non seulement dans intent)
 *   · action.step_id transmis = type de l'action TAL normalisé
 *   · Qavanah peut maintenant activer MOD-086 + MOD-025 :
 *       MOD-086 : charger SEQ-* depuis PostgreSQL
 *       MOD-025 : vérifier la transition current_state → step_id
 *   · qavanah.sequence retourné dans la réponse enrichie
 *
 * CHANGEMENTS v2.1.0
 *   · fetchZera() : appel GET /v1/zera/:icl → qavanah-api
 *   · context.zera injecté depuis la graine réelle ZM-{icl}
 *
 * CHANGEMENTS v2.0.0
 *   · ACTION_HOQ_MAP : action TAL → hoq_id + sequence_id
 *   · Contexte enrichi : place + state résolus depuis ICL
 *   · intent.scope : hoq_id transmis à Qavanah
 *
 * Pont entre cockpit-spatial-api (Or haBayit™) et QAVANAH API™
 * Loi E-02   : jamais appelé depuis le frontend · côté serveur uniquement
 * Loi Fallback : si Qavanah injoignable → continuer en mode dégradé gracieux
 * Loi Zera   : le Zera est un composant réel du contexte · pas un bonus de score
 * Loi HOQ    : chaque action TAL est liée à une séquence identifiée · jamais anonyme
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
function repairJSON(raw) {
  try {
    return JSON.parse(raw);
  } catch {}

  try {
    const repaired = raw
      .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
      .replace(/:\s*'([^']*)'/g, ': "$1"')
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']');
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
    'FLY_TO':          'FLY_TO',
    'ZOOM_TO':         'ZOOM_TO',
    'RESET_VIEW':      'RESET_VIEW',
    'HIGHLIGHT_ROAD':  'HIGHLIGHT_ROAD',
    'HIGHLIGHT_PLACE': 'HIGHLIGHT_PLACE',
    'SHOW_LAYER':      'SHOW_LAYER',
    'HIDE_LAYER':      'HIDE_LAYER',
    'PLACE_MARKER':    'PLACE_MARKER',
    'START_GPS':       'START_GPS',
    'SEARCH_NUMBER':   'SEARCH_NUMBER',
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

// ─── MAPPING ACTION TAL → HOQ OMEH.AI ────────────────────────────────────────
// Référence : OMEH-HOQ-MATRIX-002 · 17 Hoqim · Golden Dataset OmeH.ai v1.0
// step_id = type de l'action TAL · correspond à l'étape dans la séquence

const ACTION_HOQ_MAP = {
  'SEARCH_PLACE':    { hoq_id: 'OMEH-HOQ-001', sequence_id: 'SEQ-TERRITOIRE-001',   step_id: 'SEARCH_PLACE'    },
  'SEARCH_NUMBER':   { hoq_id: 'OMEH-HOQ-012', sequence_id: 'SEQ-ADRESSE-001',      step_id: 'SEARCH_NUMBER'   },
  'FLY_TO':          { hoq_id: 'OMEH-HOQ-001', sequence_id: 'SEQ-TERRITOIRE-001',   step_id: 'FLY_TO'          },
  'ZOOM_TO':         { hoq_id: 'OMEH-HOQ-001', sequence_id: 'SEQ-TERRITOIRE-001',   step_id: 'ZOOM_TO'         },
  'HIGHLIGHT_PLACE': { hoq_id: 'OMEH-HOQ-001', sequence_id: 'SEQ-TERRITOIRE-001',   step_id: 'HIGHLIGHT_PLACE' },
  'HIGHLIGHT_ROAD':  { hoq_id: 'OMEH-HOQ-001', sequence_id: 'SEQ-TERRITOIRE-001',   step_id: 'HIGHLIGHT_ROAD'  },
  'RESET_VIEW':      { hoq_id: 'OMEH-HOQ-001', sequence_id: 'SEQ-TERRITOIRE-001',   step_id: 'RESET_VIEW'      },
  'PLACE_MARKER':    { hoq_id: 'OMEH-HOQ-001', sequence_id: 'SEQ-TERRITOIRE-001',   step_id: 'PLACE_MARKER'    },
  'SHOW_LAYER':      { hoq_id: 'OMEH-HOQ-007', sequence_id: 'SEQ-ARCHITECTURE-001', step_id: 'SHOW_LAYER'      },
  'HIDE_LAYER':      { hoq_id: 'OMEH-HOQ-007', sequence_id: 'SEQ-ARCHITECTURE-001', step_id: 'HIDE_LAYER'      },
  'START_GPS':       { hoq_id: 'OMEH-HOQ-010', sequence_id: 'SEQ-FALLBACK-001',     step_id: 'START_GPS'       },
};

const HOQ_DEFAULT = {
  hoq_id:      'OMEH-HOQ-001',
  sequence_id: 'SEQ-TERRITOIRE-001',
  step_id:     'SEARCH_PLACE'
};

// ─── RÉSOLUTION CONTEXTE TERRITORIAL ─────────────────────────────────────────
function resolveContextFromICL(icl) {
  if (!icl) return { place: {}, state: {} };

  const clean = icl.trim();

  return {
    place: {
      icl:       clean,
      source:    'PCNT_v3.1',
      territory: 'cocody'
    },
    state: {
      icl_present: true,
      resolved:    true,
      territory:   'cocody'
    }
  };
}

// ─── FETCH ZERA DEPUIS QAVANAH API ───────────────────────────────────────────
// Appel GET /v1/zera/:icl · retourne le contexte zera normalisé
// Loi Zera : composant réel du contexte · pas un bonus de score

async function fetchZera(icl, qavanah_url, timeoutMs = 3000) {
  if (!icl || !qavanah_url) return null;

  try {
    const iclEncoded = icl.trim().replace('|', '%7C');
    const urlStr     = `${qavanah_url}/v1/zera/${iclEncoded}`;
    const parsedUrl  = new URL(urlStr);
    const isHttps    = parsedUrl.protocol === 'https:';
    const lib        = isHttps ? https : http;

    const zeraRaw = await new Promise((resolve, reject) => {
      const opts = {
        hostname: parsedUrl.hostname,
        port:     parsedUrl.port || (isHttps ? 443 : 80),
        path:     parsedUrl.pathname,
        method:   'GET',
        headers:  { 'Content-Type': 'application/json' }
      };

      const req = lib.request(opts, (res) => {
        let raw = '';
        res.on('data', d => raw += d);
        res.on('end', () => {
          try { resolve(JSON.parse(raw)); }
          catch { reject(new Error('ZERA_PARSE_ERROR')); }
        });
      });

      req.on('error', reject);
      req.setTimeout(timeoutMs, () => {
        req.destroy();
        reject(new Error('ZERA_TIMEOUT'));
      });
      req.end();
    });

    if (!zeraRaw || !zeraRaw.zera) return null;

    const z = zeraRaw.zera;

    const zeraContext = {
      zeraId:      z.zera_id,
      seedVersion: z.seed_version,
      state:       z.formation_state,
      confidence:  parseFloat(z.confidence) || 1,
      convergence: z.observed_features?.convergence || null,
      spatial: {
        latitude:  z.spatial_signature?.latitude,
        longitude: z.spatial_signature?.longitude,
        quadrant:  z.spatial_signature?.quadrant
      },
      structural: {
        place_type:        z.structural_signature?.place_type,
        boundary_detected: z.structural_signature?.boundary_detected,
        thresholds:        z.structural_signature?.thresholds
      },
      observed: {
        voirie_proche:   z.observed_features?.voirie_proche,
        distance_voirie: z.observed_features?.distance_voirie,
        pada_count:      z.observed_features?.pada_count,
        source:          z.observed_features?.source
      },
      territorial: {
        zone:      z.territorial_signature?.zone,
        territory: z.territorial_signature?.territory
      }
    };

    console.log(
      `[QAVANAH-BRIDGE] Zera chargé · ${z.zera_id}` +
      ` v${z.seed_version} · ${z.formation_state}` +
      ` · voirie=${z.observed_features?.voirie_proche || 'n/a'}` +
      ` · confidence=${z.confidence}`
    );

    return zeraContext;

  } catch (err) {
    console.warn(`[QAVANAH-BRIDGE] Zera non résolu pour ICL ${icl} : ${err.message}`);
    return null;
  }
}

// ─── APPEL QAVANAH CHECK ─────────────────────────────────────────────────────
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

  // 1 · Extraire l'action TAL depuis la réponse Or haBayit
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

  // 2 · Résoudre HOQ + sequence_id + step_id depuis le type d'action TAL
  const hoqMapping  = ACTION_HOQ_MAP[talResult.action.type] || HOQ_DEFAULT;

  // 3 · Résoudre ICL et contexte territorial
  const icl         = context.icl || null;
  const resolvedCtx = resolveContextFromICL(icl);

  // 4 · Charger le Zera réel depuis Qavanah API
  const zeraContext = context.zera || await fetchZera(icl, qavanah_url);

  // 5 · Construire identifiants
  const trajectoryId = context.trajectoryId || `TRJ-OHB-${Date.now().toString(36).toUpperCase()}`;
  const sessionId    = context.sessionId    || 'unknown-session';

  // 6 · Construire le payload Qavanah complet · v2.2.0
  // Pipeline Bereshit 1:3 :
  //   MOD-247 : action.type vérifié dans catalogue
  //   MOD-086 : action.sequence_id → charger contrat depuis PostgreSQL
  //   MOD-025 : action.step_id → vérifier transition depuis current_state
  //   MOD-207a : context.icl → vérifier contexte territorial résolu
  const payload = {
    trajectoryId,
    intent: {
      contractId:  `IC-OHB-${sessionId}`,
      version:     1,
      source:      'USER_CONFIRMED',
      scope:       hoqMapping.hoq_id
    },
    context: {
      contextId: generateBridgeId('CTX'),
      icl,
      place:  context.place  || resolvedCtx.place,
      state:  context.state  || resolvedCtx.state,
      zera:   zeraContext
    },
    agent: {
      id:    'or-habayit',
      model: 'claude-sonnet-4-6',
      step:  context.step || 1
    },
    // v2.2.0 · sequence_id + step_id dans action pour activer MOD-086 + MOD-025
    action: {
      id:          generateBridgeId('ACT'),
      type:        talResult.action.type,
      sequence_id: hoqMapping.sequence_id,   // ← MOD-086 charge ce contrat
      step_id:     hoqMapping.step_id,       // ← MOD-025 vérifie cette transition
      parameters:  talResult.action.parameters
    }
  };

  // 7 · Appeler Qavanah check
  try {
    const qavanah_decision = await callQavanah(qavanah_url, payload);

    console.log(
      `[QAVANAH-BRIDGE] ${talResult.action.type}` +
      ` → ${qavanah_decision.decision}` +
      ` · hoq=${hoqMapping.hoq_id}` +
      ` · seq=${hoqMapping.sequence_id}` +
      ` · step=${hoqMapping.step_id}` +
      ` · zera=${zeraContext ? zeraContext.zeraId : 'null'}` +
      ` · composite=${qavanah_decision.alignment?.composite ?? 'n/a'}` +
      ` · tension=${qavanah_decision.drift?.tension ?? 'n/a'}` +
      ` · seq_result=${qavanah_decision.sequence?.reason ?? 'n/a'}`
    );

    return {
      qavanah_active: true,
      decision:       qavanah_decision.decision,
      mode:           qavanah_decision.mode,
      trajectoryId,
      checkId:        qavanah_decision.checkId,
      hoq_id:         hoqMapping.hoq_id,
      sequence_id:    hoqMapping.sequence_id,
      step_id:        hoqMapping.step_id,
      zera_id:        zeraContext?.zeraId      || null,
      zera_version:   zeraContext?.seedVersion || null,
      action:         talResult.action,
      talRaw:         talResult.raw,
      alignment:      qavanah_decision.alignment,
      drift:          qavanah_decision.drift,
      sequence:       qavanah_decision.sequence || null,   // ← résultat MOD-086/025
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
  if (decision.decision === 'ALLOW')  return `ALLOW · composite=${decision.alignment?.composite} · ${decision.drift?.state} · seq=${decision.sequence?.reason ?? 'n/a'}`;
  if (decision.decision === 'ADJUST') return `ADJUST · ${decision.reasonCodes?.join(', ')} · RECOMPUTE`;
  if (decision.decision === 'BLOCK')  return `BLOCK · ${decision.reasonCodes?.join(', ')} · STOP`;
  return 'UNKNOWN';
}

// ─── ENRICHISSEMENT RÉPONSE ───────────────────────────────────────────────────
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
      hoq_id:       qavResult.hoq_id       || null,
      sequence_id:  qavResult.sequence_id  || null,
      step_id:      qavResult.step_id      || null,
      zera_id:      qavResult.zera_id      || null,
      zera_version: qavResult.zera_version || null,
      action:       qavResult.action       || null,
      sequence:     qavResult.sequence     || null,   // ← résultat pipeline
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
  fetchZera,
  checkWithQavanah,
  enrichResponse
};
