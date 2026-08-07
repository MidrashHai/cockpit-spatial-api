// resolve-voie.js
// GET /v1/voie?nom=RUE+DOUBASSI+KABAH
// Retourne ICL début/fin + Shemot + convergence depuis la table voies
// McOmh.ai · CorreIA LLC · C-06 · Août 2026

'use strict';

function makeResolveVoieHandler(pool) {
  return async function resolveVoie(req, res) {
    const nom = (req.query.nom || '').trim().toUpperCase();

    if (!nom || nom.length < 2) {
      return res.status(400).json({
        error: 'Paramètre nom requis (ex: ?nom=RUE+DOUBASSI+KABAH)'
      });
    }

    try {
      // Recherche insensible à la casse, correspondance partielle
      const voieResult = await pool.query(
        `SELECT 
           v.id,
           v.nom_rue,
           v.city,
           v.icl_debut,
           v.icl_fin,
           -- Shemot seuil début
           sd_m.shem_lat   AS debut_makom_lat,
           sd_m.shem_heb   AS debut_makom_heb,
           sd_m.shem_fr    AS debut_makom_fr,
           sd_s.shem_lat   AS debut_shaar_lat,
           sd_s.shem_heb   AS debut_shaar_heb,
           sd_s.shem_fr    AS debut_shaar_fr,
           sd_mk.shem_lat  AS debut_mishkan_lat,
           sd_mk.shem_heb  AS debut_mishkan_heb,
           sd_mk.shem_fr   AS debut_mishkan_fr,
           -- Shemot seuil fin
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
         -- Joins seuil début
         LEFT JOIN shem_reference sd_m  ON sd_m.icl  = v.icl_debut AND sd_m.famille  = 'MAKOM'
         LEFT JOIN shem_reference sd_s  ON sd_s.icl  = v.icl_debut AND sd_s.famille  = 'SHAAR'
         LEFT JOIN shem_reference sd_mk ON sd_mk.icl = v.icl_debut AND sd_mk.famille = 'MISHKAN'
         -- Joins seuil fin
         LEFT JOIN shem_reference sf_m  ON sf_m.icl  = v.icl_fin   AND sf_m.famille  = 'MAKOM'
         LEFT JOIN shem_reference sf_s  ON sf_s.icl  = v.icl_fin   AND sf_s.famille  = 'SHAAR'
         LEFT JOIN shem_reference sf_mk ON sf_mk.icl = v.icl_fin   AND sf_mk.famille = 'MISHKAN'
         WHERE UPPER(v.nom_rue) LIKE $1
         ORDER BY LENGTH(v.nom_rue) ASC
         LIMIT 5`,
        [`%${nom}%`]
      );

      if (voieResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Voie non trouvée',
          query: nom
        });
      }

      const voies = voieResult.rows.map(row => {
        // Calcul convergence
        const debut_mishkan = row.debut_mishkan_lat || '';
        const fin_mishkan   = row.fin_mishkan_lat   || '';
        let convergence = 'TENSION';
        if (debut_mishkan && fin_mishkan) {
          if (debut_mishkan === fin_mishkan) {
            convergence = 'FORTE';
          } else {
            // Partielle si même famille (MAKOM/SHAAR/MISHKAN)
            const debutFam = getMishkanFamille(row.icl_debut);
            const finFam   = getMishkanFamille(row.icl_fin);
            if (debutFam && finFam && debutFam === finFam) {
              convergence = 'PARTIELLE';
            }
          }
        }

        return {
          id:        row.id,
          nom_rue:   row.nom_rue,
          city:      row.city,
          longueur_m: row.longueur_m || null,
          convergence,
          seuil_debut: {
            icl: row.icl_debut,
            shem_makom:   { lat: row.debut_makom_lat,   heb: row.debut_makom_heb,   fr: row.debut_makom_fr   },
            shem_shaar:   { lat: row.debut_shaar_lat,   heb: row.debut_shaar_heb,   fr: row.debut_shaar_fr   },
            shem_mishkan: { lat: row.debut_mishkan_lat, heb: row.debut_mishkan_heb, fr: row.debut_mishkan_fr }
          },
          seuil_fin: {
            icl: row.icl_fin,
            shem_makom:   { lat: row.fin_makom_lat,   heb: row.fin_makom_heb,   fr: row.fin_makom_fr   },
            shem_shaar:   { lat: row.fin_shaar_lat,   heb: row.fin_shaar_heb,   fr: row.fin_shaar_fr   },
            shem_mishkan: { lat: row.fin_mishkan_lat, heb: row.fin_mishkan_heb, fr: row.fin_mishkan_fr }
          }
        };
      });

      // Si une seule voie : retourner directement l'objet
      // Si plusieurs : retourner le tableau
      return res.status(200).json(
        voies.length === 1
          ? { version: '3.1', protocol: 'PCNT-v3.1', ...voies[0] }
          : { version: '3.1', protocol: 'PCNT-v3.1', count: voies.length, voies }
      );

    } catch (err) {
      console.error('[resolve-voie] Erreur DB:', err.message);
      return res.status(500).json({
        error: 'Erreur serveur',
        detail: err.message
      });
    }
  };
}

// Helper: famille du Mishkan depuis l'ICL (premier chiffre du Mishkan index)
// À adapter selon la logique PCNT si disponible
function getMishkanFamille(icl) {
  if (!icl) return null;
  // Logique simplifiée — peut être enrichie depuis shem_reference
  return null;
}

module.exports = { makeResolveVoieHandler };
