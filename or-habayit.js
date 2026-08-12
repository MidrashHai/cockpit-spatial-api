/**
 * routes/or-habayit.js · v1.0
 * Makom Intelligence™ · CorreIA LLC
 *
 * Agent Or haBayit™ · Agent Territorial Conversationnel
 * Proxy Anthropic · OmeH.ai · Canal conversationnel Cocody
 *
 * ── Version ────────────────────────────────────────────────────
 * v1.0 · 12 Août 2026 · Chantier C-05 · Premier déploiement
 *
 * ── Chantier actif ─────────────────────────────────────────────
 * C-05 · Proxy Or haBayit · Ouverture du Canal conversationnel
 *        Contexte : OmeH_ai_mobile_v2d.html appelle POST /v1/or-habayit
 *        avec { system, messages } et attend une réponse Anthropic standard.
 *        Ce fichier relaie la requête vers api.anthropic.com/v1/messages
 *        en injectant la clé depuis process.env.ANTHROPIC_API_KEY.
 *        Aucune clé n'est jamais transmise au navigateur (loi E-02).
 *
 * ── Correction appliquée dans cette version ────────────────────
 * v1.0 · Premier déploiement · pas de correction — création initiale
 *        Loi E-02 (Note_Transmission_FL715) : appel Anthropic depuis serveur
 *        uniquement · header anthropic-version obligatoire · model fixé à
 *        claude-sonnet-4-6 · max_tokens : 1024
 *
 * ── Lois canoniques appliquées ─────────────────────────────────
 * E-02 · Anthropic ne peut pas être appelé depuis le navigateur
 *        → ce proxy est l'unique point d'appel autorisé
 * E-05 · Or haBayit doit répondre sans Markdown · sans tirets longs
 *        → l'interdiction est inscrite dans le Corpus du Passage (côté frontend)
 * E-06 · ICL toujours au format LLLL espace pipe espace OOOO
 *        → inscrit dans le Corpus du Passage (côté frontend)
 *
 * ── Historique des versions ────────────────────────────────────
 * v1.0 · 12 Août 2026 · Création · C-05 · Canal Or haBayit ouvert
 *
 * ── Usage ──────────────────────────────────────────────────────
 * POST /v1/or-habayit
 * Body : { system: string, messages: Array<{role, content}> }
 * Retour : réponse Anthropic brute (content, usage, model, etc.)
 */

'use strict';

const fetch = require('node-fetch');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL             = 'claude-sonnet-4-6';
const MAX_TOKENS        = 1024;

module.exports = async function orHaBayit(req, res) {
  try {
    const { system, messages } = req.body;

    // ── Vérification clé API ──────────────────────────────────
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('[or-habayit] ANTHROPIC_API_KEY absente · configurer dans Render Environment');
      return res.status(500).json({
        error: {
          code:    'ERR_NO_API_KEY',
          message: 'ANTHROPIC_API_KEY non configurée sur le serveur · contacter l\'administrateur'
        }
      });
    }

    // ── Vérification body ─────────────────────────────────────
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: {
          code:     'ERR_BODY_INVALID',
          message:  'messages est requis et doit être un tableau non vide',
          expected: '{ "system": string, "messages": [{role, content}] }'
        }
      });
    }

    // ── Appel Anthropic ───────────────────────────────────────
    const t0 = Date.now();

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: MAX_TOKENS,
        system:     system  || '',
        messages:   messages
      })
    });

    const data = await response.json();
    const ms   = Date.now() - t0;

    console.log(`[or-habayit] ${response.status} · ${ms}ms · ${messages.length} message(s)`);

    // ── Retour brut au frontend ───────────────────────────────
    return res.status(response.status).json(data);

  } catch (err) {
    console.error('[or-habayit] Erreur réseau ou serveur :', err.message);
    return res.status(500).json({
      error: {
        code:    'ERR_PROXY',
        message: `Connexion au Canal impossible · ${err.message}`
      }
    });
  }
};
