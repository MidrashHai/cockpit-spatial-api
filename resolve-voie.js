// resolve-voie.js
// Version     : v1.7
// Date        : 2026-08-08
// Heure       : cycle suivant FL-715 · 7 Août 2026
// Contexte    : Remplacement complet du Pool par pg.Client
//               Connexion créée et détruite à chaque requête HTTP
//               Aucune connexion persistante — Raqia avant la coupure
//               16 tentatives pool épuisées (T-01 à T-16 · Note FL-715)
//               JOIN canonique : shem_reference.indice + famille (Note Technique DB 6Aout2026)
// Auteur      : McOmh.ai · Makom Intelligence™ · CorreIA LLC

'use strict';

const { Client } = require('pg');

/**
 * makeResolveVoieHandler()
 * Retourne le handler Express pour GET /v1/voie?nom=
 * Chaque appel HTTP crée un pg.Client frais, l'utilise, puis le détruit.
 * DATABASE_URL est lue à chaque requête depuis process.env — jamais figée.
 */
function makeResolveVoieHandler() {
  return async function resolveVoieHandler(req, res) {
    const nom = (req.query.nom || '').trim();

    if (!nom) {
      return res.status(400).json({
        error: 'ERR_NOM_REQUIRED',
        message: 'Paramètre nom requis. Exemple : /v1/voie?nom=RUE TANO ATCHIMON'
      });
    }

    // Connexion fraîche — créée ici, détruite après la requête
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    try {
      await client.connect();

      // SET explicite sur cette connexion neuve
      await client.query('SET search_path TO public');

      const sql = `
        SELECT
          v.st_name,
          v.longueur_m,
          v.icl_debut,
          v.icl_fin,
          v.convergence,
          v.shem_rue,
          v.mishkan_debut,
          v.mishkan_fin,
          sm_d.shem_lat  AS shem_makom_debut_lat,
          sm_d.shem_heb  AS shem_makom_debut_heb,
          sm_d.shem_fr   AS shem_makom_debut_fr,
          sm_f.shem_lat  AS shem_makom_fin_lat,
          sm_f.shem_heb  AS shem_makom_fin_heb,
          sm_f.shem_fr   AS shem_makom_fin_fr
        FROM public.voies v
        LEFT JOIN public.shem_reference sm_d
          ON sm_d.indice = v.mishkan_debut AND sm_d.famille = 'MAKOM'
        LEFT JOIN public.shem_reference sm_f
          ON sm_f.indice = v.mishkan_fin   AND sm_f.famille = 'MAKOM'
        WHERE UPPER(v.st_name) = UPPER($1)
        LIMIT 1
      `;

      const result = await client.query(sql, [nom]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'ERR_VOIE_NOT_FOUND',
          message: `Voie non trouvée : ${nom}`,
          hint: 'Vérifier le nom exact (casse ignorée). Exemple : RUE TANO ATCHIMON'
        });
      }

      const row = result.rows[0];

      return res.status(200).json({
        version: '1.7',
        status: 'OK',
        voie: {
          nom:         row.st_name,
          longueur_m:  row.longueur_m,
          convergence: row.convergence,
          shem_rue:    row.shem_rue,
          icl: {
            debut: row.icl_debut,
            fin:   row.icl_fin
          },
          shem_debut: {
            lat: row.shem_makom_debut_lat,
            heb: row.shem_makom_debut_heb,
            fr:  row.shem_makom_debut_fr
          },
          shem_fin: {
            lat: row.shem_makom_fin_lat,
            heb: row.shem_makom_fin_heb,
            fr:  row.shem_makom_fin_fr
          }
        }
      });

    } catch (err) {
      // Toujours exposer err.code + err.hint — loi extraite T-02 (faux message masquant)
      console.error('[resolve-voie] DB error:', err.code, err.message, err.hint || '');
      return res.status(500).json({
        error:   'ERR_DB',
        pg_code: err.code    || null,
        pg_hint: err.hint    || null,
        message: err.message || 'Erreur base de données'
      });
    } finally {
      // Destruction garantie — connexion ne survit pas à la requête
      try { await client.end(); } catch (_) {}
    }
  };
}

module.exports = { makeResolveVoieHandler };
