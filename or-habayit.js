/**
 * or-habayit.js · Or haBayit™ v1.2
 * Makom Intelligence™ · CorreIA LLC
 *
 * Agent Territorial Conversationnel™
 * Proxy Anthropic API · couche Qavanah Bridge intégrée
 *
 * ── Historique ────────────────────────────────────────────────
 * v1.0 · 12 Août 2026 · Proxy passif vers Anthropic
 * v1.1 · 12 Août 2026 · Fix chemin racine
 * v1.2 · 14 Août 2026 · Qavanah Bridge · parsing TAL côté serveur
 *
 * ── Architecture v1.2 ────────────────────────────────────────
 * AVANT : client → Claude → res.json(response)
 * APRÈS : client → Claude → extractTAL → Qavanah → enrichResponse
 *
 * Mode actuel : OBSERVE
 * · Qavanah évalue et conseille
 * · Or haBayit™ continue dans tous les cas (ALLOW / ADJUST / BLOCK)
 * · Fallback gracieux si Qavanah injoignable
 * · La décision Qavanah est dans response.qavanah (métadonnée)
 * · Le bloc <TAL> reste intact pour compatibilité frontend v2f
 *
 * Loi E-02 : Qavanah appelé côté serveur uniquement
 * Loi Fallback : jamais bloquer Or haBayit™ si Qavanah échoue
 */

'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const { checkWithQavanah, enrichResponse } = require('./qavanah-bridge');

const anthropic       = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const QAVANAH_API_URL = process.env.QAVANAH_API_URL || null;

if (QAVANAH_API_URL) {
  console.log(`[OR-HABAYIT] Qavanah Bridge : ACTIF · ${QAVANAH_API_URL}`);
} else {
  console.log('[OR-HABAYIT] Qavanah Bridge : INACTIF (QAVANAH_API_URL absent)');
}

/**
 * Handler POST /v1/or-habayit
 *
 * Body attendu (inchangé depuis v1.1) :
 * {
 *   system:   string  (system prompt complet)
 *   messages: array   (historique de conversation)
 *   // Champs optionnels pour Qavanah context :
 *   sessionId?:    string
 *   icl?:          string  (ICL du lieu courant)
 *   place?:        object
 *   state?:        object
 *   zera?:         object
 *   trajectoryId?: string
 *   step?:         number
 * }
 *
 * Réponse enrichie (v1.2) :
 * {
 *   content: [...] (réponse Claude · inchangée)
 *   qavanah: {     (nouveau · métadonnée de gouvernance)
 *     active:      bool
 *     decision:    'ALLOW' | 'ADJUST' | 'BLOCK'
 *     mode:        'OBSERVE' | 'DEGRADED'
 *     checkId:     string
 *     trajectoryId:string
 *     action:      { type, parameters }
 *     alignment:   { intent, context, action, composite }
 *     drift:       { state, tension, slope, auc }
 *     reasonCodes: string[]
 *     note:        string
 *   }
 * }
 */
module.exports = async function orHabayitHandler(req, res) {
  const { system, messages } = req.body;

  // Validation minimale (inchangée depuis v1.1)
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      error: { code: 'ERR_MESSAGES_REQUIRED', message: 'messages est requis' }
    });
  }

  try {
    // ── Appel Anthropic (inchangé) ──────────────────────────────
    const response = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 1000,
      system:     system || '',
      messages
    });

    // ── Couche Qavanah Bridge (nouveau v1.2) ────────────────────
    const responseText = response.content?.[0]?.text || '';

    // Construire le contexte depuis la requête entrante
    const qavContext = {
      trajectoryId: req.body.trajectoryId  || null,
      sessionId:    req.body.sessionId     || req.headers['x-session-id'] || null,
      icl:          req.body.icl           || req.body.context?.icl || null,
      place:        req.body.place         || req.body.context?.place || {},
      state:        req.body.state         || req.body.context?.state || {},
      zera:         req.body.zera          || req.body.context?.zera || null,
      step:         req.body.step          || 1
    };

    // Évaluation Qavanah · avec fallback gracieux
    let enrichedResponse = response;
    try {
      const qavResult = await checkWithQavanah(responseText, qavContext, QAVANAH_API_URL);
      enrichedResponse = enrichResponse(response, qavResult);

      // Log monitoring
      if (qavResult.qavanah_active) {
        if (qavResult.action) {
          console.log(
            `[QAVANAH] ${qavResult.action.type} → ${qavResult.decision}` +
            ` · tension=${qavResult.drift?.tension ?? 'n/a'}` +
            ` · mode=${qavResult.mode}`
          );
        } else {
          console.log(`[QAVANAH] conversationnel → ALLOW · aucune action TAL`);
        }
      } else {
        console.log(`[QAVANAH] mode dégradé · ${qavResult.note}`);
      }

    } catch (bridgeErr) {
      // Fallback : ne jamais bloquer Or haBayit™ si Qavanah échoue
      console.error('[QAVANAH-BRIDGE] Erreur non gérée :', bridgeErr.message);
      // enrichedResponse reste = response (réponse Claude originale)
    }

    // ── Retour au client ────────────────────────────────────────
    return res.json(enrichedResponse);

  } catch (err) {
    console.error('[OR-HABAYIT] Erreur Anthropic :', err.message);
    return res.status(500).json({
      error: {
        code:    'ERR_ANTHROPIC',
        message: err.message
      }
    });
  }
};
