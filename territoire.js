// territoire.js · v1.0 · 13 Août 2026
// Makom Intelligence™ · CorreIA LLC · Scribe du Souffle
// Route : GET /v1/territoire
// Source : SELECT depuis public.territoire · 6025 adresses PADA · Cocody · mk_omhai
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

    // Vérification défensive
    const check = await client.query('SELECT current_database()');
    if (check.rows[0].current_database !== 'mk_omhai') {
      await client.end();
      return res.status(500).json({ error: 'ERR_WRONG_DB', message: 'Base incorrecte · attendu mk_omhai' });
    }

    const result = await client.query(
      'SELECT icl, st_name, st_num, latitude, longitude, collectivite FROM public.territoire'
    );
    await client.end();

    const features = result.rows.map(r => ({
      type: 'Feature',
      properties: {
        icl: r.icl,
        st_name: r.st_name,
        st_num: r.st_num,
        collectivite: r.collectivite
      },
      geometry: {
        type: 'Point',
        coordinates: [parseFloat(r.longitude), parseFloat(r.latitude)]
      }
    }));

    res.json({ type: 'FeatureCollection', features });

  } catch (err) {
    try { await client.end(); } catch (_) {}
    console.error('[territoire.js] ERR:', err.message);
    res.status(500).json({ error: 'ERR_TERRITOIRE', message: err.message });
  }
};
