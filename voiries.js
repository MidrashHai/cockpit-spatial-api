// voiries.js · v1.0 · 13 Août 2026
// Makom Intelligence™ · CorreIA LLC · Scribe du Souffle
// Route : GET /v1/voiries
// Source : SELECT depuis public.voies · 386 voies · Cocody · mk_omhai
// Retourne : GeoJSON FeatureCollection · chargé une fois au démarrage mobile
// Loi : le sol vient de la base · jamais de données embarquées dans le HTML mobile

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
         longueur_m,
         shem_fr,
         shem_heb,
         mishkan_fr,
         convergence,
         ST_AsGeoJSON(geom)::json AS geom
       FROM public.voies`
    );
    await client.end();

    const features = result.rows.map(r => ({
      type: 'Feature',
      properties: {
        st_name:    r.st_name,
        longueur_m: r.longueur_m,
        shem_fr:    r.shem_fr,
        shem_heb:   r.shem_heb,
        mishkan_fr: r.mishkan_fr,
        convergence: r.convergence
      },
      geometry: r.geom
    }));

    res.json({ type: 'FeatureCollection', features });

  } catch (err) {
    try { await client.end(); } catch (_) {}
    console.error('[voiries.js] ERR:', err.message);
    res.status(500).json({ error: 'ERR_VOIRIES', message: err.message });
  }
};
