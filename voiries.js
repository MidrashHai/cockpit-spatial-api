// voiries.js · v1.1 · 13 Août 2026
// Makom Intelligence™ · CorreIA LLC · Scribe du Souffle
// Route : GET /v1/voiries
// Colonnes réelles : st_name, city, longueur_m, icl_debut, icl_fin,
//                   lat_debut, lon_debut, lat_fin, lon_fin,
//                   mishkan_index_debut, convergence
// Source : public.voies · 386 voies · Cocody · mk_omhai
// Note : shem_fr / mishkan_fr absents de voies · non sélectionnés

const { Client } = require('pg');

module.exports = async (req, res) => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    const result = await client.query(
      `SELECT
         st_name,
         city,
         longueur_m,
         icl_debut,
         icl_fin,
         lat_debut,
         lon_debut,
         lat_fin,
         lon_fin,
         mishkan_index_debut,
         convergence
       FROM public.voies`
    );
    await client.end();

    const features = result.rows.map(r => ({
      type: 'Feature',
      properties: {
        st_name:             r.st_name,
        city:                r.city,
        longueur_m:          r.longueur_m,
        icl_debut:           r.icl_debut,
        icl_fin:             r.icl_fin,
        mishkan_index_debut: r.mishkan_index_debut,
        convergence:         r.convergence
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [parseFloat(r.lon_debut), parseFloat(r.lat_debut)],
          [parseFloat(r.lon_fin),   parseFloat(r.lat_fin)]
        ]
      }
    }));

    res.json({ type: 'FeatureCollection', features });

  } catch (err) {
    try { await client.end(); } catch (_) {}
    console.error('[voiries.js] ERR:', err.message);
    res.status(500).json({ error: 'ERR_VOIRIES', message: err.message });
  }
};
