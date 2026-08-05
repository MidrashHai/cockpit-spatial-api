/**
 * PCNT™ v3.1 · Protocole Canonique de Nomination Territoriale
 * Makom Intelligence™ · CorreIA LLC
 *
 * Module Node.js extrait depuis Cockpit Spatial™ v3.1
 * Calcul pur · déterministe · sans dépendance externe
 */

'use strict';

// ── TABLE CANONIQUE ────────────────────────────────────────────
const LM = [
  { n:0, let:'Ayin',  heb:'ע', mv:'Vision intérieure · voit ce qui est invisible · qualifie depuis sa position' },
  { n:1, let:'Aleph', heb:'א', mv:'Origine · souffle premier · ce qui précède toute forme' },
  { n:2, let:'Beit',  heb:'ב', mv:'Demeure · ce qui contient · structure intérieure' },
  { n:3, let:'Gimel', heb:'ג', mv:"Mouvement vers l'autre · propulsion · don" },
  { n:4, let:'Dalet', heb:'ד', mv:"Seuil · porte · ce qui s'ouvre" },
  { n:5, let:'He',    heb:'ה', mv:'Souffle · ouverture · révélation dans le monde' },
  { n:6, let:'Vav',   heb:'ו', mv:'Axe · lien · descente · connexion' },
  { n:7, let:'Zayin', heb:'ז', mv:'Acte inscrit · coupure juste · ce qui distingue' },
  { n:8, let:'Het',   heb:'ח', mv:'Clôture vivante · espace protégé · souffle contenu' },
  { n:9, let:'Tet',   heb:'ט', mv:"Bien caché · gestation · ce qui est bon avant d'être visible" },
];

// ── CODEX DES DOUBLES · Shaon haRuah ──────────────────────────
const CODEX_DOUBLES = {
  '00':'Vision matricielle','11':'Connexion matricielle','22':'Habitation du Souffle',
  '33':'Propulsion','44':'Porte derrière la Porte','55':'Incarnation',
  '66':'Connexion profonde / Intime','77':'Nouveau territoire','88':'Matrice vivante',
  '99':'Bien caché révélé','51':'Construction fonctionnelle','12':'Connexion fonctionnelle',
  '14':"Yad · main de l'action",'16':'Maîtrise','18':'Vie intégrée',
  '24':'Direction du passage','23':'Lev · stabilisation intérieure','27':'Shem · identité',
  '48':'Double porte','42':'Direction du passage','40':'Alignement',
  '32':'Lev · stabilisation intérieure','29':'Force de la main',
  '34':'Mouvement vers le Seuil','49':'Seuil · Gestation',
};

// ── HAZAKAH TRIPLES ────────────────────────────────────────────
const HAZAKAH_TRIPLES = {
  "441":"Porte derrière la Porte · Origine · lieux à double seuil avant l'Origine",
  "530":"Souffle révélé en mouvement · lieux de traversée révélatrice",
  "531":"Souffle révélé en mouvement vers l'Origine · traversée constituante",
};

// ── TABLES SHEM ────────────────────────────────────────────────
const MAKOM_TABLE = {
  0:{ h:'מָקוֹם עֵין הַמָּקוֹם', l:"Makom Ein haMakom",  fr:"Le Lieu du Regard Fondateur", s:"Ce lieu voit ce qui précède toute forme · la vision est sa nature constitutive" },
  1:{ h:'מָקוֹם רֵאשִׁית',       l:"Makom Reshit",         fr:"Le Lieu de l'Origine",         s:"Ce lieu porte en lui le commencement · l'impulsion naît ici" },
  2:{ h:'מָקוֹם הַבַּיִת',       l:"Makom haBayit",        fr:"Le Lieu de la Demeure",        s:"Ce lieu est structure vivante · il protège ce qui s'y loge" },
  3:{ h:'מָקוֹם הַנָּהָר',       l:"Makom haNahar",        fr:"Le Lieu du Fleuve",            s:"Ce lieu transmet en circulant · le passage lui-même est la révélation" },
  4:{ h:'מָקוֹם הַסַּף',         l:"Makom haSaf",          fr:"Le Lieu du Seuil",             s:"Ce lieu est seuil constitutif · ce qui entre est déjà en train de traverser" },
  5:{ h:'מָקוֹם הָאוֹר',         l:"Makom haOr",           fr:"Le Lieu de la Lumière",        s:"Ce lieu révèle · ce qui y entre ne reste pas dans l'ombre" },
  6:{ h:'מָקוֹם הַצִּיר',        l:"Makom haTzir",         fr:"Le Lieu de l'Axe",             s:"Ce lieu est point de connexion · il relie ce qui ne pouvait se rejoindre" },
  7:{ h:'מָקוֹם הַהַבְחָנָה',    l:"Makom haHavhanah",     fr:"Le Lieu du Discernement",      s:"Ce lieu tranche avec justesse · la coupure juste est sa loi" },
  8:{ h:'מָקוֹם הַמָּעוֹן',      l:"Makom haMaon",         fr:"Le Lieu de l'Abri",            s:"Ce lieu protège · l'espace protégé est sa première nature" },
  9:{ h:'מָקוֹם הַסּוֹד',        l:"Makom haSod",          fr:"Le Lieu du Secret",            s:"Ce lieu porte ce qui n'est pas encore visible · la gestation est sa loi" },
};

const SHAAR_TABLE = {
  0:{ h:'שַׁעַר הָרְאִיָּה',    l:"Sha'ar haR'iyah",    fr:"La Porte de la Vision",         s:"La porte filtre par le regard · seul ce qui peut être vu entre" },
  1:{ h:'שַׁעַר הָרֵאשִׁית',   l:"Sha'ar haReshit",    fr:"La Porte de l'Origine",          s:"La porte réinitialise · ce qui entre recommence depuis l'origine" },
  2:{ h:'שַׁעַר הַבַּיִת',     l:"Sha'ar haBayit",     fr:"La Porte de la Demeure",         s:"La porte accueille · elle reçoit dans un espace constitué" },
  3:{ h:'שַׁעַר הַמַּסָּע',    l:"Sha'ar haMasa",      fr:"La Porte du Voyage",             s:"La porte met en mouvement · ce qui entre sort en direction" },
  4:{ h:'שַׁעַר הַמַּעֲבָר',   l:"Sha'ar haMaavar",    fr:"La Porte du Passage",            s:"La porte est elle-même le passage · franchir est l'acte" },
  5:{ h:'שַׁעַר הַגִּלּוּי',   l:"Sha'ar haGilui",     fr:"La Porte de la Révélation",      s:"La porte révèle · ce qui était caché devient lisible en franchissant" },
  6:{ h:'שַׁעַר הַחִבּוּר',    l:"Sha'ar haHibbur",    fr:"La Porte de la Connexion",       s:"La porte relie · traverser ici c'est entrer dans un réseau" },
  7:{ h:'שַׁעַר הַהַבְחָנָה',  l:"Sha'ar haHavhanah",  fr:"La Porte du Discernement",       s:"La porte sépare · seul ce qui a traversé l'épreuve continue" },
  8:{ h:'שַׁעַר הַקַּבָּלָה',  l:"Sha'ar haKabalah",   fr:"La Porte de la Réception",       s:"La porte prépare ce qu'elle reçoit · la réception est conditionnée" },
  9:{ h:'שַׁעַר הַבִּכּוּרִים',l:"Sha'ar haBikkurim",  fr:"La Porte des Premiers Fruits",   s:"La porte s'ouvre à maturité · pas à la demande" },
};

const MISHKAN_TABLE = {
  0:{ h:'מִשְׁכַּן הָאַיִן',    l:'Mishkan haAyin',    fr:'La Demeure du Regard',       s:"Ce qui sort d'ici a été vu avant d'être formulé · la vision précède" },
  1:{ h:'מִשְׁכַּן הָרֵאשִׁית', l:'Mishkan haReshit',  fr:"La Demeure de l'Origine",    s:"Ce qui sort d'ici porte une impulsion première · une fondation naît" },
  2:{ h:'מִשְׁכַּן הַבַּיִת',   l:'Mishkan haBayit',   fr:'La Demeure de la Maison',    s:"Ce qui sort d'ici est logé · il porte la structure de ce lieu" },
  3:{ h:'מִשְׁכַּן הַנָּהָר',   l:'Mishkan haNahar',   fr:'La Demeure du Fleuve',       s:"Ce qui sort d'ici est en mouvement · il transmet en circulant" },
  4:{ h:'מִשְׁכַּן הַפֶּתַח',   l:'Mishkan haPetah',   fr:"La Demeure de l'Ouverture",  s:"Ce qui sort d'ici s'ouvre · le seuil franchi donne direction" },
  5:{ h:'מִשְׁכַּן הָאוֹר',     l:'Mishkan haOr',      fr:'La Demeure de la Lumière',   s:"Ce qui sort d'ici éclaire · la révélation est son accomplissement" },
  6:{ h:'מִשְׁכַּן הַחִבּוּר',  l:'Mishkan haHibbur',  fr:'La Demeure de la Connexion', s:"Ce qui sort d'ici relie · le lien établi ici ne se défait pas" },
  7:{ h:'מִשְׁכַּן הַבֵּירּוּר',l:'Mishkan haBirrur',  fr:'La Demeure du Discernement', s:"Ce qui sort d'ici est purifié · la coupure juste a opéré" },
  8:{ h:'מִשְׁכַּן הַשּׁוֹמֵר', l:'Mishkan haShomer',  fr:'La Demeure du Gardien',      s:"Ce qui sort d'ici est protégé · le lieu a tenu son rôle de garde" },
  9:{ h:'מִשְׁכַּן הַלֵּידָה',  l:'Mishkan haLeidah',  fr:'La Demeure de la Naissance', s:"Ce qui sort d'ici est né · la gestation s'est accomplie" },
};

const SHEM_FAMILLE = {
  '53':{ heb:'מִשְׁפַּחַת הֵא·גִּימֶל', lat:'Mishpahat He·Gimel', fr:'Famille du Souffle en Mouvement',     sig:'Le Souffle se révèle en traversant · ces lieux ne retiennent pas' },
  '44':{ heb:'מִשְׁפַּחַת דָּלֶת·דָּלֶת',lat:'Mishpahat Dalet·Dalet',fr:'Famille du Double Seuil',          sig:'Tous les lieux de cette famille sont constitués d\'un double passage' },
  '41':{ heb:'מִשְׁפַּחַת דָּלֶת·אָלֶף', lat:'Mishpahat Dalet·Aleph',fr:"Famille du Seuil vers l'Origine",  sig:"L'Origine n'est pas immédiatement accessible · deux seuils doivent être franchis" },
  '55':{ heb:'מִשְׁפַּחַת הֵא·הֵא',      lat:'Mishpahat He·He',     fr:'Famille de la Double Révélation',   sig:'Tous les lieux de cette famille sont dans le registre de ce qui se montre doublement' },
  '35':{ heb:'מִשְׁפַּחַת גִּימֶל·הֵא',  lat:'Mishpahat Gimel·He',  fr:'Famille du Mouvement vers la Révélation', sig:'Le mouvement mène à la révélation · ce qui circule ici se dévoile en arrivant' },
  '33':{ heb:'מִשְׁפַּחַת גִּימֶל·גִּימֶל',lat:'Mishpahat Gimel·Gimel',fr:'Famille de la Double Propulsion', sig:'Ce qui entre dans ces lieux reçoit une double impulsion · le mouvement est leur nature' },
  '86':{ heb:'מִשְׁפַּחַת חֵת·וָו',      lat:'Mishpahat Het·Vav',   fr:'Famille de l\'Abri Connecté',       sig:'L\'espace protégé relie · ces lieux sont des abris qui transmettent' },
  '68':{ heb:'מִשְׁפַּחַת וָו·חֵת',      lat:'Mishpahat Vav·Het',   fr:'Famille de la Connexion Abritée',   sig:'La connexion trouve ici son espace de protection' },
  '39':{ heb:'מִשְׁפַּחַת גִּימֶל·טֵת',  lat:'Mishpahat Gimel·Tet', fr:'Famille du Mouvement vers le Secret', sig:'Le mouvement mène ici vers ce qui est encore invisible · ces lieux portent ce qui mûrit' },
};

// ── ALGORITHME ─────────────────────────────────────────────────

function extractParts(coord) {
  const abs = Math.abs(coord);
  const entier = Math.floor(abs);
  const decStr = (abs - entier).toFixed(7).substring(2);
  const dec7 = decStr.substring(0, 7).split('').map(Number);
  return { entier, dec7 };
}

function entierToSeq(n) {
  return String(n).split('').map(Number);
}

function readDouble(a, b) {
  return CODEX_DOUBLES[String(a) + String(b)] || null;
}

function readTriple(a, b, c) {
  return HAZAKAH_TRIPLES[String(a) + String(b) + String(c)] || null;
}

function readSeqWithCodex(seq) {
  const parts = [];
  let i = 0;
  while (i < seq.length) {
    if (i + 2 < seq.length) {
      const triple = readTriple(seq[i], seq[i+1], seq[i+2]);
      if (triple) { parts.push({ type:'triple', vals:[seq[i],seq[i+1],seq[i+2]], reading:triple, hazakah:true }); i += 3; continue; }
    }
    if (i + 1 < seq.length) {
      const dbl = readDouble(seq[i], seq[i+1]);
      if (dbl) { parts.push({ type:'double', vals:[seq[i],seq[i+1]], reading:dbl, hazakah:false }); i += 2; continue; }
    }
    parts.push({ type:'single', vals:[seq[i]], reading: LM[seq[i]].let + ' · ' + LM[seq[i]].mv, hazakah:false });
    i++;
  }
  return parts;
}

function ponderationExp(dec7) {
  // FL-315 · lecture droite-à-gauche · décimales fines = poids fort
  const rev = [...dec7].reverse();
  let val = 0;
  for (let i = 0; i < 7; i++) val += rev[i] * Math.exp(-(i + 1));
  return val;
}

function condenser4(val) {
  const frac = val - Math.floor(val);
  const n = Math.round(frac * 10000);
  return String(n).padStart(4, '0').split('').map(Number);
}

function genShemFamille(latEntierSeq, lonEntierSeq) {
  const kLat = String(latEntierSeq[latEntierSeq.length - 1]);
  const kLon = String(lonEntierSeq[lonEntierSeq.length - 1]);
  const key = kLat + kLon;
  if (SHEM_FAMILLE[key]) return SHEM_FAMILLE[key];
  // Génération dynamique
  const letLat = LM[parseInt(kLat)];
  const letLon = LM[parseInt(kLon)];
  const famLatStr = latEntierSeq.map(n => LM[n].let).join('·');
  const famLonStr = lonEntierSeq.map(n => LM[n].let).join('·');
  return {
    heb: 'מִשְׁפַּחַת ' + latEntierSeq.map(n => LM[n].heb).join('·') + '·' + lonEntierSeq.map(n => LM[n].heb).join('·'),
    lat: 'Mishpahat ' + famLatStr + '/' + famLonStr,
    fr: 'Famille ' + letLat.let + '·' + letLon.let,
    sig: letLat.mv + ' vers ' + letLon.mv + '. Tous les lieux de cette famille partagent cette nature de fond.',
  };
}

function genChecksum(lat, lon) {
  let h = 0;
  const s = lat.toFixed(7) + '|' + lon.toFixed(7) + '|PCNT-v3.1';
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return 'cs-' + Math.abs(h).toString(16).padStart(8, '0');
}

function genSignatureId(lat, lon) {
  return 'MKM-' + Math.abs(Math.floor(lat * 10000 + lon * 10000)).toString(16).toUpperCase().substring(0, 5);
}

// ── FONCTION PRINCIPALE ────────────────────────────────────────
/**
 * compute(lat, lon) → TerritorialContext™ v3.1
 * Entrée  : latitude et longitude décimales signées (float)
 * Sortie  : objet JSON complet · PUBLISHED
 */
function compute(lat, lon) {
  // Validation
  if (typeof lat !== 'number' || typeof lon !== 'number') throw new Error('latitude et longitude doivent être des nombres');
  if (lat < -90 || lat > 90)   throw new Error('latitude hors plage [-90, 90]');
  if (lon < -180 || lon > 180) throw new Error('longitude hors plage [-180, 180]');

  const pLat = extractParts(lat);
  const pLon = extractParts(lon);

  // Étape 1 · Grande Famille depuis les entiers
  const latEntierSeq = entierToSeq(pLat.entier);
  const lonEntierSeq = entierToSeq(pLon.entier);
  const shemFamille  = genShemFamille(latEntierSeq, lonEntierSeq);

  // Étape 2 · Pondération exponentielle droite→gauche
  const valLat = ponderationExp(pLat.dec7);
  const valLon = ponderationExp(pLon.dec7);

  // Étape 3 · Condensation → 4 chiffres par axe
  const seqLat = condenser4(valLat);
  const seqLon = condenser4(valLon);

  // Étape 4 · Lecture canonique (Codex Doubles + Hazakah)
  const dblLat = readSeqWithCodex(seqLat);
  const dblLon = readSeqWithCodex(seqLon);

  const lectureLat = dblLat.map(p => p.reading + (p.hazakah ? ' ✦' : '')).join(' · ');
  const lectureLon = dblLon.map(p => p.reading + (p.hazakah ? ' ✦' : '')).join(' · ');

  // Étape 5 · Trois Shem
  const mIdx   = seqLat[0];                                // Makom  · ouverture Lat
  const sIdx   = seqLon[0];                                // Sha'ar · ouverture Lon
  const mshIdx = (seqLat[seqLat.length-1] + seqLon[seqLon.length-1]) % 10; // Mishkan

  const makom   = MAKOM_TABLE[mIdx]   || MAKOM_TABLE[5];
  const shaar   = SHAAR_TABLE[sIdx]   || SHAAR_TABLE[5];
  const mishkan = MISHKAN_TABLE[mshIdx]|| MISHKAN_TABLE[5];

  // Étape 6 · Shem Graine · Zera haMakom™ · 4e décimale
  const dec4Lat  = pLat.dec7[3];
  const dec4Lon  = pLon.dec7[3];
  const shemGraine = {
    heb:     LM[dec4Lat].heb + '·' + LM[dec4Lon].heb,
    lat:     LM[dec4Lat].let + '·' + LM[dec4Lon].let,
    fr:      'Cellule 10 m · ' + LM[dec4Lat].let + ' (Nord/Sud) · ' + LM[dec4Lon].let + ' (Est/Ouest)',
    dec4_lat: dec4Lat,
    dec4_lon: dec4Lon,
    cellule_m: 10,
  };

  // Étape 7 · ICL™ · 8 lettres
  const iclLat = seqLat.map(n => LM[n].let).join('·');
  const iclLon = seqLon.map(n => LM[n].let).join('·');

  // Étape 8 · Guématria
  const gLat   = seqLat.reduce((a, b) => a + b, 0);
  const gLon   = seqLon.reduce((a, b) => a + b, 0);
  const gTotal = gLat + gLon;

  return {
    version:    '3.1',
    status:     'PUBLISHED',
    protocol:   'PCNT-v3.1',
    codex:      'Codex Shem haMakomot v3.1',
    signatureId: genSignatureId(lat, lon),
    coordinates: {
      lat: parseFloat(lat.toFixed(7)),
      lon: parseFloat(lon.toFixed(7)),
    },
    grande_famille: {
      lat:     latEntierSeq.map(n => LM[n].let).join('·'),
      lon:     lonEntierSeq.map(n => LM[n].let).join('·'),
      shem:    shemFamille,
    },
    ponderation: {
      val_lat:     parseFloat(valLat.toFixed(4)),
      seq_lat:     seqLat,
      lecture_lat: lectureLat,
      val_lon:     parseFloat(valLon.toFixed(4)),
      seq_lon:     seqLon,
      lecture_lon: lectureLon,
    },
    icl: {
      lettres:  iclLat + '|' + iclLon,
      lat_seq:  seqLat,
      lon_seq:  seqLon,
    },
    shem_makom:   { heb: makom.h,   lat: makom.l,   fr: makom.fr,   sig: makom.s   },
    shem_shaar:   { heb: shaar.h,   lat: shaar.l,   fr: shaar.fr,   sig: shaar.s   },
    shem_mishkan: { heb: mishkan.h, lat: mishkan.l, fr: mishkan.fr, sig: mishkan.s },
    shem_graine:  shemGraine,
    guematria: {
      g_lat:   gLat,
      g_lon:   gLon,
      g_total: gTotal,
    },
    checksum: genChecksum(lat, lon),
    statut_epistemique: 'EXP',
  };
}

module.exports = { compute, LM, CODEX_DOUBLES, HAZAKAH_TRIPLES };
