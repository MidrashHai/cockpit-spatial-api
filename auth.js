// auth.js · v1.1 · 12 Aout 2026 · Fix SSL pg.Client
// POST /v1/auth · Inscription d'un acteur OmeH.ai
// Makom Intelligence™ · CorreIA LLC · Scribe du Souffle
// Pattern : pg.Client (fresh connection · search_path respecté)
// Colonnes ciblées : person_id · nom · email · telephone · icl_residence · role · collectivite · token_session · token_expires · actif

'use strict';

const { Client } = require('pg');
const crypto = require('crypto');

// Rôles acceptés pour le pilote Cocody
const ROLES_VALIDES = ['resident', 'visiteur', 'agent_territorial', 'mairie', 'admin'];

// Collectivité par défaut
const COLLECTIVITE_DEFAUT = 'Mairie de Cocody';

module.exports = async function handleAuth(req, res) {
  // ── 1 · Lecture et validation du corps ──────────────────────
  const {
    nom,
    email,
    telephone,
    icl_residence,
    role,
    collectivite
  } = req.body || {};

  // nom obligatoire
  if (!nom || typeof nom !== 'string' || nom.trim().length === 0) {
    return res.status(400).json({
      error: {
        code: 'ERR_NOM_REQUIS',
        message: 'Le champ nom est obligatoire.'
      }
    });
  }

  // role : défaut 'resident' si absent · rejet si invalide
  const roleFinal = (role || 'resident').toLowerCase().trim();
  if (!ROLES_VALIDES.includes(roleFinal)) {
    return res.status(400).json({
      error: {
        code: 'ERR_ROLE_INVALIDE',
        message: `Rôle invalide : "${roleFinal}". Valeurs acceptées : ${ROLES_VALIDES.join(' · ')}`
      }
    });
  }

  // collectivite : défaut 'Mairie de Cocody'
  const collectiviteFinal = (collectivite || COLLECTIVITE_DEFAUT).trim();

  // ── 2 · Génération des identifiants ─────────────────────────
  // person_id : UUID v4 sans tirets · 32 chars · tient dans varchar(64)
  const person_id = crypto.randomUUID().replace(/-/g, '');

  // token_session : hex 64 chars · tient dans varchar(128)
  const token_session = crypto.randomBytes(32).toString('hex');

  // token_expires : 30 jours à partir de maintenant
  const token_expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // ── 3 · Insertion en base ───────────────────────────────────
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Vérification de la base (loi canonique)
    const check = await client.query('SELECT current_database()');
    if (check.rows[0].current_database !== 'mk_omhai') {
      await client.end();
      return res.status(500).json({
        error: {
          code: 'ERR_MAUVAISE_BASE',
          message: 'Mauvaise base de données connectée · attendu mk_omhai'
        }
      });
    }

    // Vérification email unique si fourni
    if (email && email.trim().length > 0) {
      const emailCheck = await client.query(
        'SELECT id FROM public.acteurs WHERE email = $1 AND actif = true LIMIT 1',
        [email.trim().toLowerCase()]
      );
      if (emailCheck.rows.length > 0) {
        await client.end();
        return res.status(409).json({
          error: {
            code: 'ERR_EMAIL_EXISTANT',
            message: 'Un acteur avec cet email est déjà inscrit.'
          }
        });
      }
    }

    // INSERT avec colonnes explicites (loi canonique · jamais de ... abrégé)
    const result = await client.query(
      `INSERT INTO public.acteurs
        (person_id, nom, email, telephone, icl_residence, role, collectivite,
         token_session, token_expires, actif, created_at, updated_at)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, now(), now())
       RETURNING person_id, nom, email, telephone, icl_residence, role,
                 collectivite, token_session, token_expires, actif, created_at`,
      [
        person_id,
        nom.trim(),
        email ? email.trim().toLowerCase() : null,
        telephone ? telephone.trim() : null,
        icl_residence ? icl_residence.trim() : null,
        roleFinal,
        collectiviteFinal,
        token_session,
        token_expires
      ]
    );

    await client.end();

    const acteur = result.rows[0];

    // ── 4 · Réponse ─────────────────────────────────────────────
    return res.status(201).json({
      ok: true,
      acteur: {
        person_id: acteur.person_id,
        nom: acteur.nom,
        email: acteur.email,
        telephone: acteur.telephone,
        icl_residence: acteur.icl_residence,
        role: acteur.role,
        collectivite: acteur.collectivite,
        token_session: acteur.token_session,
        token_expires: acteur.token_expires,
        actif: acteur.actif,
        created_at: acteur.created_at
      }
    });

  } catch (err) {
    try { await client.end(); } catch (_) {}
    console.error('[auth] Erreur DB :', err.message);
    return res.status(500).json({
      error: {
        code: 'ERR_DB',
        message: 'Erreur base de données · ' + err.message
      }
    });
  }
};
