// OPTIMISATION DES PHOTOS
// • redresse les photos selon l'orientation de l'appareil ;
// • SUPPRIME toutes les métadonnées (EXIF, position GPS, modèle d'appareil…) ;
// • crée des versions AVIF + WebP de plusieurs largeurs (srcset) ;
// • crée une image de partage 1200×630 (Open Graph) pour les couvertures ;
// • met en cache le résultat (dossier public/img, par empreinte du fichier).
// Les originaux ne sont jamais publiés.

import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync, rmSync, renameSync } from 'node:fs';
import { cpus } from 'node:os';
import { chemin, relatif } from './outils.mjs';

export const VERSION_PIPELINE = 'v3';
export const LARGEURS = [480, 960, 1440, 1920];
export const EXTENSIONS_IMAGES = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'tif', 'tiff', 'heic', 'heif', 'gif'];
const DOSSIER_SORTIE = chemin('public', 'img');

sharp.cache(false);

const empreinte = (tampon) => createHash('sha1').update(VERSION_PIPELINE).update(tampon).digest('hex').slice(0, 14);

/**
 * Traite une liste de photos.
 * @param {Array<{fichier:string, og?:boolean}>} demandes
 * @param {{avif:boolean, rapport, production:boolean, empreintesExemple:Set}} options
 * @returns {Map<string, object>} fichier -> informations (dimensions, couleur, variantes, og)
 */
export async function traiterImages(demandes, { avif = true, rapport, empreintesExemple = new Set() } = {}) {
  mkdirSync(DOSSIER_SORTIE, { recursive: true });
  const resultats = new Map();
  const utilises = new Set();
  const uniques = new Map();
  for (const d of demandes) {
    const prec = uniques.get(d.fichier);
    uniques.set(d.fichier, { fichier: d.fichier, og: !!(d.og || prec?.og) });
  }
  const file = [...uniques.values()];
  let nouvelles = 0, enCache = 0;
  const travailleurs = Math.max(1, Math.min(4, cpus().length));
  const verrous = new Map();
  const sousVerrou = (cle, tache) => {
    const suite = (verrous.get(cle) || Promise.resolve()).then(tache, tache);
    verrous.set(cle, suite.catch(() => {}));
    return suite;
  };

  async function traiter(d) {
    const ext = d.fichier.split('.').pop().toLowerCase();
    if (ext === 'heic' || ext === 'heif') {
      rapport?.erreur(`La photo « ${relatif(d.fichier)} » est au format HEIC (iPhone), non pris en charge. Convertissez-la en JPG (voir docs/03-photos.md, rubrique iPhone).`, d.fichier);
      return;
    }
    let tampon;
    try { tampon = readFileSync(d.fichier); } catch { rapport?.erreur(`Photo introuvable : « ${relatif(d.fichier)} ».`, d.fichier); return; }
    const sha1 = createHash('sha1').update(tampon).digest('hex');
    const cle = empreinte(tampon);
    utilises.add(cle);
    const dossier = `${DOSSIER_SORTIE}/${cle}`;
    const fichierMeta = `${dossier}/meta.json`;
    let meta = null;
    try {
      // Une même photo peut se trouver dans plusieurs dossiers : son traitement
      // est fait une seule fois à la fois (sinon deux écritures simultanées).
      meta = await sousVerrou(cle, async () => {
        let m = null;
        if (existsSync(fichierMeta)) {
          try { m = JSON.parse(readFileSync(fichierMeta, 'utf8')); } catch { m = null; }
          if (m && (m.avif !== avif || (d.og && !m.og))) m = null; // réglages différents : on refait
          if (m && !m.variantes.every((w) => existsSync(`${dossier}/${w}.webp`))) m = null;
        }
        if (m) { enCache++; return m; }
        m = await produire(tampon, dossier, { avif, og: d.og });
        nouvelles++;
        return m;
      });
    } catch (e) {
      rapport?.erreur(`La photo « ${relatif(d.fichier)} » est illisible ou endommagée (${e.message}). Ré-enregistrez-la en JPG.`, d.fichier);
      return;
    }
    if (meta.largeurOriginale < 1600) {
      rapport?.avertissement(`Photo petite (${meta.largeurOriginale} px de large) : « ${relatif(d.fichier)} ». 2000 px minimum conseillés pour un rendu net.`, d.fichier);
    }
    if (meta.hauteur > meta.largeur * 1.05) {
      rapport?.avertissement(`Photo en portrait (verticale) : « ${relatif(d.fichier)} ». Le format paysage (horizontal) est conseillé.`, d.fichier);
    }
    resultats.set(d.fichier, { ...meta, cle, exemple: empreintesExemple.has(sha1) });
  }

  for (let i = 0; i < file.length; i += travailleurs) {
    await Promise.all(file.slice(i, i + travailleurs).map(traiter));
  }

  // Nettoyage : supprime les images qui ne sont plus utilisées
  for (const nom of readdirSync(DOSSIER_SORTIE)) {
    if (!utilises.has(nom)) rmSync(`${DOSSIER_SORTIE}/${nom}`, { recursive: true, force: true });
  }
  rapport?.info(`Photos : ${resultats.size} au total (${nouvelles} optimisée(s), ${enCache} déjà en cache).`);
  return resultats;
}

async function produire(tampon, dossier, { avif, og }) {
  const tmp = `${dossier}.tmp`;
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  // .rotate() sans argument : redresse selon l'EXIF ; la sortie ne contient aucune métadonnée.
  const base = sharp(tampon, { failOn: 'error', limitInputPixels: 120_000_000 }).rotate();
  const m = await sharp(tampon).metadata();
  const tourne = (m.orientation || 1) >= 5; // orientations 5 à 8 : largeur et hauteur inversées
  const width = tourne ? m.height : m.width;
  const height = tourne ? m.width : m.height;
  const stats = await sharp(tampon).rotate().resize(64).stats();
  const d = stats.dominant;
  const couleur = '#' + [d.r, d.g, d.b].map((x) => x.toString(16).padStart(2, '0')).join('');
  const variantes = LARGEURS.filter((w) => w < width);
  if (!variantes.length || width - variantes.at(-1) > 200) variantes.push(Math.min(width, LARGEURS.at(-1)));
  const uniques = [...new Set(variantes)].sort((a, b) => a - b);
  for (const w of uniques) {
    const redim = base.clone().resize({ width: w, withoutEnlargement: true });
    await redim.clone().webp({ quality: 76, effort: 4 }).toFile(`${tmp}/${w}.webp`);
    if (avif) await redim.clone().avif({ quality: 52, effort: 2 }).toFile(`${tmp}/${w}.avif`);
  }
  if (og) {
    await base.clone().resize({ width: 1200, height: 630, fit: 'cover', position: 'attention' })
      .jpeg({ quality: 80, mozjpeg: true }).toFile(`${tmp}/og.jpg`);
  }
  const meta = {
    largeur: width, hauteur: height, largeurOriginale: width, couleur,
    variantes: uniques, avif, og: !!og, version: VERSION_PIPELINE,
  };
  writeFileSync(`${tmp}/meta.json`, JSON.stringify(meta));
  rmSync(dossier, { recursive: true, force: true });
  renameSync(tmp, dossier);
  return meta;
}

/** Vérifie qu'un fichier optimisé ne contient aucune métadonnée EXIF/GPS (contrôle qualité). */
export async function sansMetadonnees(fichier) {
  const m = await sharp(fichier).metadata();
  return !m.exif && !m.xmp && !m.iptc;
}
