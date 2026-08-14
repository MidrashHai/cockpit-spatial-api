/**
 * or-habayit.js · Or haBayit™ v1.2
 * Makom Intelligence™ · CorreIA LLC
 *
 * v1.2 · 14 Août 2026 · Qavanah Bridge · parsing TAL côté serveur
 * FIX   · fetch natif Node.js 24 · pas de SDK Anthropic · pas de uuid
 */

'use strict';

const { checkWithQavanah, enrichResponse } = require('./qavanah-bridge');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const QAVANAH_API_URL   = process.env.QAVANAH_API_URL || null;

if (QAVANAH_API_URL) {
  console.log(`[OR-HABAYIT] Qavanah Bridge : ACTIF · ${QAVANAH_API_URL}`);
} else {
  console.log('[OR-HABAYIT] Qavanah Bridge : INACTIF (QAVANAH_API_URL absent)');
}

module.exports = async function orHabayitHandler(req, res) {
  const { system, messages } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      error: { code: 'ERR_MESSAGES_REQUIRED', message: 'messages est requis' }
    });
  }

  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: { code: 'ERR_API_KEY', message: 'ANTHROPIC_API_KEY non configurée sur le serveur · contacter l\'administrateur' }
    });
  }

  try {
    // ── Appel Anthropic · fetch natif Node.js 24 ───────────────
    const raw = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 1000,
        system:     system || '',
        messages
      })
    });

    if (!raw.ok) {
      const errBody = await raw.text();
      console.error('[OR-HABAYIT] Erreur Anthropic HTTP :', raw.status, errBody);
      return res.status(raw.status).json({
        error: { code: 'ERR_ANTHROPIC_HTTP', status: raw.status, message: errBody }
      });
    }

    const response = await raw.json();

    // ── Couche Qavanah Bridge (v1.2) ────────────────────────────
    const responseText = response.content?.[0]?.text || '';

    const qavContext = {
      trajectoryId: req.body.trajectoryId  || null,
      sessionId:    req.body.sessionId     || req.headers['x-session-id'] || null,
      icl:          req.body.icl           || req.body.context?.icl || null,
      place:        req.body.place         || req.body.context?.place || {},
      state:        req.body.state         || req.body.context?.state || {},
      zera:         req.body.zera          || req.body.context?.zera || null,
      step:         req.body.step          || 1
    };

    let enrichedResponse = response;
    try {
      const qavResult = await checkWithQavanah(responseText, qavContext, QAVANAH_API_URL);
      enrichedResponse = enrichResponse(response, qavResult);

      if (qavResult.qavanah_active) {
        if (qavResult.action) {
          console.log(`[QAVANAH] ${qavResult.action.type} → ${qavResult.decision} · tension=${qavResult.drift?.tension ?? 'n/a'} · mode=${qavResult.mode}`);
        } else {
          console.log('[QAVANAH] conversationnel → ALLOW · aucune action TAL');
        }
      } else {
        console.log(`[QAVANAH] mode dégradé · ${qavResult.note}`);
      }
    } catch (bridgeErr) {
      console.error('[QAVANAH-BRIDGE] Erreur non gérée :', bridgeErr.message);
    }

    return res.json(enrichedResponse);

  } catch (err) {
    console.error('[OR-HABAYIT] Erreur :', err.message);
    return res.status(500).json({
      error: { code: 'ERR_OR_HABAYIT', message: err.message }
    });
  }
};
