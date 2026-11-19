#!/usr/bin/env node
// IMPORTER LES PHOTOS (workflow « Importer les photos », docs/03)
// ---------------------------------------------------------------------------
// Lit config/photos-a-importer.yml (adresse > logement > photos) et télécharge
// chaque photo absente dans le bon dossier :
//   content/etablissements/<adresse>/photos/<fichier>   (photos de l'adresse)
//   content/logements/<logement>/photos/<fichier>       (photos d'un logement)
// • Plus grande taille disponible : Airbnb = image originale (secours :
//   ?im_w=1200) ; Booking = tailles plus grandes essayées, sinon max1280x900.
// • User-Agent de navigateur, 3 essais par adresse, contrôle que c'est bien
//   une image (et pas une page d'erreur), conversion en JPEG si besoin.
// • Une photo déjà présente n'est jamais re-téléchargée : relancer est sans
//   risque. La légende est ajoutée à photos.yml si elle n'y est pas.
// • Compte rendu par logement (réussites / échecs) dans le résumé GitHub.
// Options : --simulation (n'écrit rien), LISTE_PHOTOS=chemin (tests).

import { existsSync, mkdirSync, writeFileSync, readFileSync, appendFileSync, readdirSync } from 'node:fs';
import { chemin, lireYaml, relatif } from './lib/outils.mjs';

const LISTE = process.env.LISTE_PHOTOS || chemin('config/photos-a-importer.yml');
const simulation = process.argv.includes('--simulation');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';
const ATTENTES = process.env.IMPORT_ESSAIS_RAPIDES ? [0, 20, 20] : [0, 3000, 10000]; // pauses entre les 3 essais
// Tailles Booking essayées (de la plus grande à la plus petite) avant celle de la liste
const TAILLES_BOOKING = ['max3000', 'max1920x1080', 'max1280x900'];
let sharp = null;
try { sharp = (await import('sharp')).default; } catch { /* sans conversion ni mesure */ }

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const resume = [];
const ecrireResume = (t) => { if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${t}\n`); };
const sortie = (k, v) => { if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`); };

function typeImage(b) {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (b.toString('ascii', 4, 8) === 'ftyp' && /avif|heic|mif1/.test(b.toString('ascii', 8, 12))) return 'avif';
  return null;
}

class ErreurDefinitive extends Error {}

/** Télécharge une adresse : Buffer d'image, ou erreur explicite. */
async function telecharger(url) {
  const origine = /bstatic\.com/.test(url) ? 'https://www.booking.com/' : /muscache\.com/.test(url) ? 'https://www.airbnb.fr/' : undefined;
  let derniere;
  for (const attente of ATTENTES) {
    if (attente) await pause(attente);
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8', 'Accept-Language': 'fr-FR,fr;q=0.9', ...(origine ? { Referer: origine } : {}) },
        redirect: 'follow', signal: AbortSignal.timeout(60000),
      });
      if (r.status === 404 || r.status === 410) throw new ErreurDefinitive(`photo introuvable (HTTP ${r.status}) : l'annonce a peut-être changé`);
      if (!r.ok) throw new Error(`HTTP ${r.status}${r.status === 403 || r.status === 429 ? ' (le site refuse : réessayez plus tard ou utilisez le script Windows, docs/03)' : ''}`);
      const tampon = Buffer.from(await r.arrayBuffer());
      const type = typeImage(tampon);
      if (!type || tampon.length < 500) throw new Error(`la réponse n'est pas une image (${tampon.length} octets, ${r.headers.get('content-type') || 'type inconnu'})`);
      return { tampon, type };
    } catch (e) {
      derniere = e.name === 'TimeoutError' ? new Error('pas de réponse du site en 60 s')
        : e.message === 'fetch failed' ? new Error(`connexion impossible${e.cause?.code ? ` (${e.cause.code})` : ''}`) : e;
      if (e instanceof ErreurDefinitive) break;
    }
  }
  throw derniere;
}

async function dimensions(tampon) {
  if (!sharp) return null;
  try { const m = await sharp(tampon).metadata(); return { l: m.width, h: m.height }; } catch { return null; }
}

/** Plus grande version disponible d'une photo. */
async function meilleureVersion(url) {
  const sansParam = url.split('?')[0];
  if (/muscache\.com/.test(url)) {
    // Airbnb : originale sans paramètre, sinon 1200 px
    try { return { ...(await telecharger(sansParam)), source: 'originale' }; } catch (e) {
      try { return { ...(await telecharger(`${sansParam}?im_w=1200`)), source: '1200 px (secours)' }; } catch { throw e; }
    }
  }
  const booking = url.match(/^(https:\/\/[^/]*bstatic\.com\/xdata\/images\/hotel\/)([^/]+)(\/.*)$/);
  const base = await telecharger(url);
  if (!booking || !sharp) return { ...base, source: booking ? booking[2] : 'telle quelle' };
  // Booking : on essaie plus grand ; on ne garde que si c'est la même photo, en plus grand
  const ref = await dimensions(base.tampon);
  for (const taille of TAILLES_BOOKING) {
    if (taille === booking[2]) break;
    try {
      const essai = await telecharger(`${booking[1]}${taille}${booking[3]}`);
      const d = await dimensions(essai.tampon);
      if (ref && d && d.l > ref.l && Math.abs(d.l / d.h - ref.l / ref.h) < 0.02) return { ...essai, source: taille };
    } catch { /* taille non proposée : on garde la suivante */ }
  }
  return { ...base, source: booking[2] };
}

// ---------------------------------------------------------------------------
if (!existsSync(LISTE)) {
  console.log(`Aucune liste de photos (${relatif(LISTE)}) : rien à importer.`);
  sortie('nouvelles', 0); sortie('echecs', 0);
  process.exit(0);
}
let liste;
try { liste = lireYaml(LISTE) || {}; } catch (e) {
  const m = `La liste ${relatif(LISTE)} est mal écrite : ${e.message}. Vérifiez l'alignement des lignes (espaces en début de ligne).`;
  console.log(`❌ ${m}`); ecrireResume(`## ❌ Import impossible\n\n${m}`); sortie('nouvelles', 0); sortie('echecs', 1);
  process.exit(1);
}

// Groupes : { titre, dossier, photos[] }
const groupes = [];
const problemes = [];
for (const [adresse, contenu] of Object.entries(liste)) {
  if (!contenu || typeof contenu !== 'object') continue;
  const ficheAdresse = chemin('content/etablissements', adresse, 'index.md');
  if (contenu.photos?.length) groupes.push({ titre: `Adresse « ${adresse} »`, dossier: chemin('content/etablissements', adresse), fiche: ficheAdresse, photos: contenu.photos });
  for (const [logement, photos] of Object.entries(contenu.logements || {})) {
    if (Array.isArray(photos) && photos.length) groupes.push({ titre: `Logement « ${logement} »`, dossier: chemin('content/logements', logement), fiche: chemin('content/logements', logement, 'index.md'), photos, logement });
  }
  for (const cle of Object.keys(contenu)) if (!['photos', 'logements'].includes(cle)) problemes.push(`Adresse « ${adresse} » : rubrique « ${cle} » inconnue (attendu : photos ou logements).`);
}

let nouvelles = 0, deja = 0, echecs = 0;
const lignesResume = ['## 📷 Import des photos', ''];
for (const g of groupes) {
  const lignes = [];
  if (!existsSync(g.fiche)) {
    lignes.push(`- ❌ Dossier introuvable : créez d'abord la fiche \`${relatif(g.fiche)}\` (docs/10 et 11). ${g.photos.length} photo(s) ignorée(s).`);
    echecs += g.photos.length;
  } else {
    const dossierPhotos = `${g.dossier}/photos`;
    const fichierLegendes = `${dossierPhotos}/photos.yml`;
    let legendes = existsSync(fichierLegendes) ? readFileSync(fichierLegendes, 'utf8') : '# Légendes des photos (docs/03)\n';
    let legendesModifiees = false;
    for (const p of g.photos) {
      const nom = String(p?.fichier || '').trim();
      const url = String(p?.url || '').trim();
      if (!/^[a-z0-9][a-z0-9-]*\.(jpe?g|png|webp)$/.test(nom)) { lignes.push(`- ❌ « ${nom || '(sans nom)'} » : nom de fichier invalide (minuscules, chiffres et tirets, ex. 01-salon.jpg).`); echecs++; continue; }
      if (!/^https:\/\/|^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) { lignes.push(`- ❌ ${nom} : adresse de la photo absente ou invalide.`); echecs++; continue; }
      const cible = `${dossierPhotos}/${nom}`;
      if (existsSync(cible)) { deja++; continue; }
      try {
        const v = await meilleureVersion(url);
        let tampon = v.tampon;
        const brut = await dimensions(tampon);
        if (brut && (brut.l < 200 || brut.h < 150)) throw new Error(`image minuscule (${brut.l} × ${brut.h} px) : sans doute une image d'erreur du site, pas la photo`);
        const veutJpeg = /\.jpe?g$/.test(nom);
        if (veutJpeg && v.type !== 'jpeg' && sharp) tampon = await sharp(tampon).rotate().jpeg({ quality: 90, mozjpeg: true }).toBuffer();
        const d = await dimensions(tampon);
        if (!simulation) { mkdirSync(dossierPhotos, { recursive: true }); writeFileSync(cible, tampon); }
        nouvelles++;
        lignes.push(`- ✅ ${nom}${d ? ` — ${d.l} × ${d.h} px` : ''} (${v.source})`);
        const leg = String(p.legende || '').trim();
        if (leg && !new RegExp(`^${nom.replace(/[.]/g, '\\.')}\\s*:`, 'm').test(legendes)) {
          legendes = `${legendes.replace(/\n?$/, '\n')}${nom}: ${JSON.stringify(leg)}\n`;
          legendesModifiees = true;
        }
      } catch (e) {
        echecs++;
        lignes.push(`- ❌ ${nom} : ${e.message}`);
      }
    }
    if (legendesModifiees && !simulation) writeFileSync(fichierLegendes, legendes);
    const fichiers = existsSync(dossierPhotos) ? readdirSync(dossierPhotos) : [];
    if (g.logement && !fichiers.some((f) => /^01[-_.]/.test(f))) lignes.push('- ⚠️ Pas encore de photo de couverture « 01-… » : le logement reste masqué sur le site.');
  }
  const resumeGroupe = `### ${g.titre} — ${g.photos.length} photo(s) dans la liste`;
  console.log(`\n${resumeGroupe}\n${lignes.join('\n') || '- (toutes déjà présentes)'}`);
  lignesResume.push(resumeGroupe, '', ...(lignes.length ? lignes : ['- Toutes déjà présentes.']), '');
}
for (const p of problemes) { console.log(`⚠️  ${p}`); lignesResume.push(`- ⚠️ ${p}`); }
const bilan = `**Bilan : ${nouvelles} photo(s) ajoutée(s), ${deja} déjà présente(s), ${echecs} en échec.**`;
lignesResume.push(bilan);
if (echecs) lignesResume.push('', 'Photos en échec : relancez le workflow plus tard (les photos réussies ne seront pas re-téléchargées). Si le problème persiste, utilisez le script Windows (docs/03).');
console.log(`\n${bilan.replace(/\*/g, '')}`);
ecrireResume(lignesResume.join('\n'));
sortie('nouvelles', nouvelles);
sortie('echecs', echecs);
