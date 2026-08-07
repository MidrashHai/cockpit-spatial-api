// resolve-voie.js
// Version     : v1.10
// Date        : 2026-08-08
// Contexte    : Suppression normalisation apostrophe (introduite en v1.9)
//               La base PostgreSQL stocke \u2019 (apostrophe typographique)
//               Le GeoJSON HTML envoie aussi \u2019
//               La normalisation vers ASCII ' causait un mismatch
//               Solution : laisser le nom tel quel — même caractère des deux côtés
//               pg.Client conservé (42P01 résolu en v1.7)
//               Colonnes corrigées (42703 résolu en v1.8)
// Auteur      : McOmh.ai · Makom Intelligence™ · CorreIA LLC

'use strict';

const { Client } = require('pg');

function makeResolveVoieHandler() {
  return async function resolveVoieHandler(req, res) {

    const nom = (req.query.nom || '').trim();

    if (!nom) {
      return res.status(400).json({
        error: 'ERR_NOM_REQUIRED',
        message: 'Paramètre nom requis. Exemple : /v1/voie?nom=RUE TANO ATCHIMON'
      });
    }

    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    try {
      await client.connect();
      await client.query('SET search_path TO public');

      const sql = `
        SELECT
          v.st_name,
          v.longueur_m,
          v.icl_debut,
          v.icl_fin,
          v.convergence,
          v.shem_rue,
          v.mishkan_index_debut,
          v.mishkan_index_fin,
          sm_d.shem_lat  AS shem_makom_debut_lat,
          sm_d.shem_heb  AS shem_makom_debut_heb,
          sm_d.shem_fr   AS shem_makom_debut_fr,
          sm_f.shem_lat  AS shem_makom_fin_lat,
          sm_f.shem_heb  AS shem_makom_fin_heb,
          sm_f.shem_fr   AS shem_makom_fin_fr
        FROM public.voies v
        LEFT JOIN public.shem_reference sm_d
          ON sm_d.indice = v.idx_makom_debut AND sm_d.famille = 'MAKOM'
        LEFT JOIN public.shem_reference sm_f
          ON sm_f.indice = v.idx_makom_fin   AND sm_f.famille = 'MAKOM'
        WHERE UPPER(v.st_name) = UPPER($1)
        LIMIT 1
      `;

      const result = await client.query(sql, [nom]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'ERR_VOIE_NOT_FOUND',
          message: `Voie non trouvée : ${nom}`,
          hint: 'Vérifier le nom exact. Exemple : RUE TANO ATCHIMON'
        });
      }

      const row = result.rows[0];

      return res.status(200).json({
        version: '1.10',
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
      console.error('[resolve-voie] DB error:', err.code, err.message, err.hint || '');
      return res.status(500).json({
        error:   'ERR_DB',
        pg_code: err.code    || null,
        pg_hint: err.hint    || null,
        message: err.message || 'Erreur base de données'
      });
    } finally {
      try { await client.end(); } catch (_) {}
    }
  };
}

module.exports = { makeResolveVoieHandler };
