// territoire.js · v1.1 · 13 Août 2026
// Makom Intelligence™ · CorreIA LLC · Scribe du Souffle
// Route : GET /v1/territoire
// Colonnes réelles : id, city, st_name, numero, lat, lon, icl
// Source : public.territoire · 6025 adresses PADA · Cocody · mk_omhai

const { Client } = require('pg');

module.exports = async (req, res) => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    const result = await client.query(
      'SELECT icl, st_name, numero, lat, lon, city FROM public.territoire'
    );
    await client.end();

    const features = result.rows.map(r => ({
      type: 'Feature',
      properties: {
        icl:        r.icl,
        st_name:    r.st_name,
        numero:     r.numero,
        city:       r.city
      },
      geometry: {
        type: 'Point',
        coordinates: [parseFloat(r.lon), parseFloat(r.lat)]
      }
    }));

    res.json({ type: 'FeatureCollection', features });

  } catch (err) {
    try { await client.end(); } catch (_) {}
    console.error('[territoire.js] ERR:', err.message);
    res.status(500).json({ error: 'ERR_TERRITOIRE', message: err.message });
  }
};
