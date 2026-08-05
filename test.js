/**
 * Tests de validation · Cockpit Spatial™ API
 * Vecteurs de référence terrain · Abidjan · Cocody
 */

'use strict';

const { compute } = require('./pcnt');

const VECTEURS = [
  {
    label: 'MKM-37F0 · Résidence Scribe · Intérieur',
    lat:  5.385840,
    lon: -3.953762,
    attendu: {
      graine_lat: 8, // Het   · valeur calculée depuis ces coordonnées exactes
      graine_lon: 7, // Zayin
    }
  },
  {
    label: 'MKM-37FA · Résidence Scribe · Portail',
    lat:  5.386638,
    lon: -3.953629,
    attendu: {
      graine_lat: 6, // Vav   · valeur calculée depuis ces coordonnées exactes
      graine_lon: 6, // Vav
    }
  },
  {
    label: 'Terrain A · 20 pas depuis référence',
    lat:  5.3861145,
    lon: -3.9544268,
    attendu: {
      graine_lat: 1, // Aleph
      graine_lon: 4, // Dalet
    }
  },
];

let passed = 0;
let failed = 0;

console.log('');
console.log('═══════════════════════════════════════════════════');
console.log('  Cockpit Spatial™ API · Tests de validation');
console.log('  PCNT™ v3.1 · Vecteurs terrain Abidjan');
console.log('═══════════════════════════════════════════════════');
console.log('');

for (const v of VECTEURS) {
  const result = compute(v.lat, v.lon);
  const g = result.shem_graine;

  const okLat = g.dec4_lat === v.attendu.graine_lat;
  const okLon = g.dec4_lon === v.attendu.graine_lon;
  const ok    = okLat && okLon;

  if (ok) passed++;
  else failed++;

  const icon = ok ? '✓' : '✗';
  console.log(`${icon}  ${v.label}`);
  console.log(`   Coords     : ${v.lat.toFixed(7)} N · ${Math.abs(v.lon).toFixed(7)} O`);
  console.log(`   SignatureId: ${result.signatureId}`);
  console.log(`   Shem Makom : ${result.shem_makom.lat}`);
  console.log(`   Shem Sha'ar: ${result.shem_shaar.lat}`);
  console.log(`   Shem Mishkan: ${result.shem_mishkan.lat}`);
  console.log(`   Graine Lat : ${g.dec4_lat} → ${g.heb.split('·')[0]}  [attendu: ${v.attendu.graine_lat}] ${okLat ? '✓' : '✗'}`);
  console.log(`   Graine Lon : ${g.dec4_lon} → ${g.heb.split('·')[1]}  [attendu: ${v.attendu.graine_lon}] ${okLon ? '✓' : '✗'}`);
  console.log(`   Graine     : ${g.lat} · ${g.fr}`);
  console.log(`   Checksum   : ${result.checksum}`);
  console.log('');
}

console.log('───────────────────────────────────────────────────');
console.log(`  Résultat : ${passed}/${VECTEURS.length} tests passés · ${failed} échec(s)`);
console.log('───────────────────────────────────────────────────');
console.log('');

if (failed > 0) process.exit(1);
