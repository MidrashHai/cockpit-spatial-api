// resolve-voie.js
// GET /v1/voie?nom=RUE+DOUBASSI+KABAH
// Retourne ICL début/fin + Shemot + longueur depuis la table voies
// McOmh.ai · CorreIA LLC · C-06
//
// ── Version ─────────────────────────────────────────────────────
// v1.4 · 7 Août 2026 · 12:00 UTC
//
// ── Corrections appliquées ──────────────────────────────────────
// v1.1 · Jointure shem_reference : icl → indice (colonne réelle)
// v1.2 · Catch enrichi : code + hint PostgreSQL pour diagnostic
// v1.3 · Client dédié + SET search_path TO public
// v1.4 · Pool autonome créé dans le module — indépendant du pool Express
//        Contourne le problème de search_path sur le pool partagé.
//        Le pool Express (server.js) garde ses connexions persistantes
//        avec un search_path vide. Ce pool local crée ses propres
//        connexions avec DATABASE_URL directement et voit public.

'use strict';

const { Pool } = require('pg');

// Pool autonome — indépendant du pool Express
const voiePool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
  idleTimeoutMillis: 10000
});

function makeResolveVoieHandler() {
  return async function resolveVoie(req, res) {
    const nom = (req.query.nom || '').trim().toUpperCase();

    if (!nom || nom.length < 2) {
      return res.status(400).json({
        error: 'Parametre nom requis (ex: ?nom=RUE+DOUBASSI+KABAH)'
      });
    }

    try {
      const client = await voiePool.connect();
      let voieResult;
      try {
        await client.query('SET search_path TO public');
        voieResult = await client.query(
          `SELECT
             v.id,
             v.st_name,
             v.city,
             v.longueur_m,
             v.icl_debut,
             v.icl_fin,
             v.mishkan_index_debut,
             v.mishkan_index_fin,
             sd_m.shem_lat   AS debut_makom_lat,
             sd_m.shem_heb   AS debut_makom_heb,
             sd_m.shem_fr    AS debut_makom_fr,
             sd_s.shem_lat   AS debut_shaar_lat,
             sd_s.shem_heb   AS debut_shaar_heb,
             sd_s.shem_fr    AS debut_shaar_fr,
             sd_mk.shem_lat  AS debut_mishkan_lat,
             sd_mk.shem_heb  AS debut_mishkan_heb,
             sd_mk.shem_fr   AS debut_mishkan_fr,
             sf_m.shem_lat   AS fin_makom_lat,
             sf_m.shem_heb   AS fin_makom_heb,
             sf_m.shem_fr    AS fin_makom_fr,
             sf_s.shem_lat   AS fin_shaar_lat,
             sf_s.shem_heb   AS fin_shaar_heb,
             sf_s.shem_fr    AS fin_shaar_fr,
             sf_mk.shem_lat  AS fin_mishkan_lat,
             sf_mk.shem_heb  AS fin_mishkan_heb,
             sf_mk.shem_fr   AS fin_mishkan_fr
           FROM voies v
           LEFT JOIN shem_reference sd_m  ON sd_m.indice = v.mishkan_index_debut AND sd_m.famille = 'MAKOM'
           LEFT JOIN shem_reference sd_s  ON sd_s.indice = v.mishkan_index_debut AND sd_s.famille = 'SHAAR'
           LEFT JOIN shem_reference sd_mk ON sd_mk.indice = v.mishkan_index_debut AND sd_mk.famille = 'MISHKAN'
           LEFT JOIN shem_reference sf_m  ON sf_m.indice = v.mishkan_index_fin   AND sf_m.famille = 'MAKOM'
           LEFT JOIN shem_reference sf_s  ON sf_s.indice = v.mishkan_index_fin   AND sf_s.famille = 'SHAAR'
           LEFT JOIN shem_reference sf_mk ON sf_mk.indice = v.mishkan_index_fin  AND sf_mk.famille = 'MISHKAN'
           WHERE UPPER(v.st_name) LIKE $1
           ORDER BY LENGTH(v.st_name) ASC
           LIMIT 5`,
          [`%${nom}%`]
        );
      } finally {
        client.release();
      }

      if (voieResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Voie non trouvee',
          query: nom
        });
      }

      const voies = voieResult.rows.map(row => {
        const mi_d = row.mishkan_index_debut;
        const mi_f = row.mishkan_index_fin;
        let convergence = 'TENSION';
        if (mi_d !== null && mi_f !== null) {
          if (mi_d === mi_f) convergence = 'FORTE';
          else if (Math.abs(mi_d - mi_f) === 1) convergence = 'PARTIELLE';
        }

        const lon_m = row.longueur_m;
        const longueur = lon_m
          ? (lon_m >= 1000 ? (lon_m / 1000).toFixed(2) + ' km' : Math.round(lon_m) + ' m')
          : null;

        return {
          id:         row.id,
          nom_rue:    row.st_name,
          city:       row.city,
          longueur,
          longueur_m: lon_m,
          convergence,
          seuil_debut: {
            icl:           row.icl_debut,
            mishkan_index: mi_d,
            shem_makom:   { lat: row.debut_makom_lat,   heb: row.debut_makom_heb,   fr: row.debut_makom_fr   },
            shem_shaar:   { lat: row.debut_shaar_lat,   heb: row.debut_shaar_heb,   fr: row.debut_shaar_fr   },
            shem_mishkan: { lat: row.debut_mishkan_lat, heb: row.debut_mishkan_heb, fr: row.debut_mishkan_fr }
          },
          seuil_fin: {
            icl:           row.icl_fin,
            mishkan_index: mi_f,
            shem_makom:   { lat: row.fin_makom_lat,   heb: row.fin_makom_heb,   fr: row.fin_makom_fr   },
            shem_shaar:   { lat: row.fin_shaar_lat,   heb: row.fin_shaar_heb,   fr: row.fin_shaar_fr   },
            shem_mishkan: { lat: row.fin_mishkan_lat, heb: row.fin_mishkan_heb, fr: row.fin_mishkan_fr }
          }
        };
      });

      return res.status(200).json(
        voies.length === 1
          ? { version: '1.4', protocol: 'PCNT-v3.1', ...voies[0] }
          : { version: '1.4', protocol: 'PCNT-v3.1', count: voies.length, voies }
      );

    } catch (err) {
      console.error('[resolve-voie] Erreur DB:', err.message, 'code:', err.code);
      return res.status(500).json({
        error: 'Erreur serveur',
        detail: err.message,
        code: err.code || null
      });
    }
  };
}

module.exports = { makeResolveVoieHandler };
