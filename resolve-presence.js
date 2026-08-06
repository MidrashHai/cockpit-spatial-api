'use strict';

const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

let compute;

async function resolvePresence({ person_id, lat, lon, session_id = null }) {
  if (!compute) compute = require('./pcnt').compute;

  const icl_result = compute(lat, lon);
  const icl_detectee = icl_result.icl.identifiant;

  const zone_query = await pool.query(
    'SELECT id, nom, collectivite, mishkan_index FROM zones WHERE icl = $1 AND actif = TRUE LIMIT 1',
    [icl_detectee]
  );
  const zone = zone_query.rows[0] || null;

  let role_resolu = 'inconnu';
  let collectivite = null;

  if (zone) {
    collectivite = zone.collectivite;
    const profil_query = await pool.query(
      'SELECT role FROM profils WHERE person_id = $1 AND icl = $2 AND actif = TRUE LIMIT 1',
      [person_id, icl_detectee]
    );
    role_resolu = profil_query.rows.length > 0 ? profil_query.rows[0].role : 'visiteur';
  }

  let ressources = [];
  if (zone && role_resolu !== 'inconnu') {
    const res_query = await pool.query(
      'SELECT id, titre, contenu, type, url_externe, priorite FROM ressources WHERE icl = $1 AND collectivite = $2 AND (role_cible = $3 OR role_cible = $4) AND actif = TRUE ORDER BY priorite DESC',
      [icl_detectee, collectivite, role_resolu, 'tous']
    );
    ressources = res_query.rows;
  }

  const ressources_ids = ressources.map(r => r.id);
  await pool.query(
    'INSERT INTO presences (person_id, icl_detectee, lat, lon, role_resolu, collectivite, ressources_ids, session_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [person_id, icl_detectee, lat, lon, role_resolu, collectivite, ressources_ids, session_id]
  );

  return {
    status: 'ok',
    presence: { person_id, lat, lon, timestamp: new Date().toISOString(), session_id },
    lieu: zone
      ? { icl: icl_detectee, nom: zone.nom, collectivite: zone.collectivite, mishkan_index: zone.mishkan_index, contexte_actif: true }
      : { icl: icl_detectee, contexte_actif: false, message: 'Lieu non gouverné' },
    role: role_resolu,
    ressources: ressources.map(r => ({
      id: r.id,
      titre: r.titre,
      contenu: r.contenu,
      type: r.type,
      url: r.url_externe || null,
      priorite: r.priorite,
    })),
    icl_computed: {
      identifiant: icl_result.icl.identifiant,
      guematria: icl_result.icl.guematria,
      mishkan_index: icl_result.icl.mishkan_index.index,
    },
  };
}

async function resolvePresenceHandler(req, res) {
  const { person_id, lat, lon, session_id } = req.body || {};

  if (!person_id || typeof person_id !== 'string' || person_id.trim() === '')
    return res.status(400).json({ status: 'error', code: 'ERR_PERSON_ID_MISSING', message: 'person_id requis' });

  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);

  if (isNaN(latNum) || latNum < -90 || latNum > 90)
    return res.status(400).json({ status: 'error', code: 'ERR_LAT_INVALID', message: 'lat invalide' });

  if (isNaN(lonNum) || lonNum < -180 || lonNum > 180)
    return res.status(400).json({ status: 'error', code: 'ERR_LON_INVALID', message: 'lon invalide' });

  try {
    const result = await resolvePresence({
      person_id: person_id.trim(),
      lat: latNum,
      lon: lonNum,
      session_id: session_id || null,
    });
    return res.status(200).json(result);
  } catch (err) {
    console.error('[resolve-presence]', err.message);
    return res.status(500).json({ status: 'error', code: 'ERR_INTERNAL', message: 'Erreur interne' });
  }
}

module.exports = { resolvePresence, resolvePresenceHandler };
