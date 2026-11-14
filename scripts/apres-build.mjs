#!/usr/bin/env node
// CONTRÔLES APRÈS LA CONSTRUCTION DU SITE (dossier dist/)
// 1. redirections des logements supprimés (config/redirections.yml) ;
// 2. fichiers _headers / _redirects (Cloudflare, Netlify) ;
// 3. vérification de tous les liens internes ;
// 4. aucune donnée secrète ou privée dans les fichiers publiés ;
// 5. aucune métadonnée (EXIF/GPS) dans les images publiées.

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import sharp from 'sharp';
import { chemin, lireYaml, relatif } from './lib/outils.mjs';
import { Rapport } from './lib/rapport.mjs';
import { adresseSite } from './lib/adresse-site.mjs';

const DIST = chemin('dist');
const rapport = new Rapport('Contrôle du site construit');
if (!existsSync(DIST)) { console.error('Le dossier dist/ est introuvable : lancez d’abord « npm run build ».'); process.exit(1); }
const adresse = adresseSite();
const base = adresse.base; // '' ou '/depot'
const donnees = JSON.parse(readFileSync(chemin('src/genere/donnees.json'), 'utf8'));

function lister(dossier) {
  const res = [];
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    const f = join(dossier, e.name);
    if (e.isDirectory()) res.push(...lister(f)); else res.push(f);
  }
  return res;
}

// 1. Redirections ------------------------------------------------------------
const redirections = [];
if (existsSync(chemin('config/redirections.yml'))) {
  try {
    const r = lireYaml(chemin('config/redirections.yml'));
    for (const x of (r?.redirections || [])) {
      if (!x?.de || !x?.vers) continue;
      const de = '/' + String(x.de).replace(/^\/+|\/+$/g, '') + '/';
      const vers = '/' + String(x.vers).replace(/^\/+|\/+$/g, '') + '/';
      if (existsSync(join(DIST, de, 'index.html'))) { rapport.avertissement(`Redirection ignorée : la page « ${de} » existe toujours.`); continue; }
      redirections.push({ de, vers });
      const cible = `${base}${vers}`;
      mkdirSync(join(DIST, de), { recursive: true });
      writeFileSync(join(DIST, de, 'index.html'), `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Page déplacée</title><meta name="robots" content="noindex"><link rel="canonical" href="${adresse.origine}${cible}"><meta http-equiv="refresh" content="0; url=${cible}"></head><body><p>Cette page a été déplacée : <a href="${cible}">continuer</a>.</p></body></html>`);
    }
  } catch (e) { rapport.erreur(e.message, chemin('config/redirections.yml')); }
}

// 2. _headers et _redirects (utilisés par Cloudflare et Netlify, ignorés par GitHub Pages)
const entetes = [
  '/*',
  '  X-Content-Type-Options: nosniff',
  '  Referrer-Policy: strict-origin-when-cross-origin',
  '  X-Frame-Options: SAMEORIGIN',
  '  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()',
  ...(donnees.production ? [] : ['  X-Robots-Tag: noindex']),
  '',
  `${base}/_astro/*`,
  '  Cache-Control: public, max-age=31536000, immutable',
  '',
  `${base}/img/*`,
  '  Cache-Control: public, max-age=31536000, immutable',
  '',
  `${base}/donnees/*`,
  '  Cache-Control: public, max-age=300',
  '  Access-Control-Allow-Origin: *',
];
writeFileSync(join(DIST, '_headers'), entetes.join('\n') + '\n');
writeFileSync(join(DIST, '_redirects'), redirections.map((r) => `${base}${r.de} ${base}${r.vers} 301`).join('\n') + (redirections.length ? '\n' : ''));

// 3. Liens internes -------------------------------------------------------------
const fichiers = lister(DIST);
const html = fichiers.filter((f) => f.endsWith('.html'));
const existeCible = (url) => {
  let p = decodeURIComponent(url.split('#')[0].split('?')[0]);
  if (base && p.startsWith(base)) p = p.slice(base.length);
  else if (base && p.startsWith('/')) return false; // lien sans le chemin de base
  const f = join(DIST, p);
  if (p.endsWith('/')) return existsSync(join(f, 'index.html'));
  return existsSync(f) && statSync(f).isFile() || existsSync(join(f, 'index.html'));
};
let liensVerifies = 0;
const casses = new Map();
for (const f of html) {
  const t = readFileSync(f, 'utf8');
  for (const m of t.matchAll(/\s(?:href|src|srcset|data-src|data-srcset|content)="([^"]+)"/g)) {
    for (let url of m[1].split(',').map((x) => x.trim().split(/\s+/)[0])) {
      if (!url || !url.startsWith('/') || url.startsWith('//')) {
        if (url && url.startsWith(adresse.origine + '/')) url = url.slice(adresse.origine.length);
        else continue;
      }
      liensVerifies++;
      if (!existeCible(url)) {
        if (!casses.has(url)) casses.set(url, new Set());
        casses.get(url).add(relatif(f).replace('dist/', ''));
      }
    }
  }
}
for (const [url, pages] of casses) rapport.erreur(`Lien cassé « ${url} » (dans ${[...pages].slice(0, 3).join(', ')}${pages.size > 3 ? '…' : ''}).`);
rapport.info(`${html.length} page(s) HTML, ${liensVerifies} lien(s) interne(s) vérifié(s).`);

// 4. Aucune donnée secrète publiée ---------------------------------------------------
const MOTIFS_SECRETS = [
  [/https?:\/\/(?:www\.)?airbnb\.[a-z.]+\/calendar\/ical\/[^\s"'<]+/i, 'lien iCal Airbnb'],
  [/admin\.booking\.com\/hotel\/hoteladmin\/ical[^\s"'<]*/i, 'lien iCal Booking.com'],
  [/ical\.booking\.com\/v1\/export[^\s"'<]*/i, 'lien iCal Booking.com'],
  [/(?:vrbo|abritel|homeaway)\.[a-z.]+\/icalendar\/[^\s"'<]+/i, 'lien iCal Vrbo / Abritel'],
  [/calendar\.google\.com\/calendar\/ical\/[^\s"'<]*private[^\s"'<]*/i, 'lien iCal privé Google Agenda'],
  [/\bsk_(?:live|test)_[A-Za-z0-9]{10,}/, 'clé secrète Stripe'],
  [/\bwhsec_[A-Za-z0-9]{10,}/, 'secret de webhook Stripe'],
  [/\bxnd_(?:production|development)_[A-Za-z0-9]{10,}/, 'clé secrète Xendit'],
  [/-----BEGIN (?:RSA )?PRIVATE KEY-----/, 'clé privée'],
  [/\bghp_[A-Za-z0-9]{30,}/, 'jeton GitHub'],
];
for (const f of fichiers.filter((x) => /\.(html|js|json|xml|txt|css|webmanifest)$/.test(x))) {
  const t = readFileSync(f, 'utf8');
  for (const [motif, nom] of MOTIFS_SECRETS) {
    if (motif.test(t)) rapport.erreur(`Donnée sensible détectée (${nom}) dans le fichier publié « ${relatif(f)} ». Publication bloquée : retirez-la du contenu.`);
  }
}

// 5. Images sans métadonnées ---------------------------------------------------------
const images = fichiers.filter((f) => /\.(webp|avif|jpe?g|png)$/i.test(f) && f.includes(`${DIST}/img/`));
let avecMeta = 0;
for (const f of images) {
  try {
    const m = await sharp(f).metadata();
    if (m.exif || m.xmp || m.iptc) { avecMeta++; rapport.erreur(`L'image publiée « ${relatif(f)} » contient encore des métadonnées (EXIF/GPS).`); }
  } catch { /* format non lisible : ignoré */ }
}
rapport.info(`${images.length} image(s) publiée(s) contrôlée(s) : ${avecMeta ? `${avecMeta} avec métadonnées` : 'aucune métadonnée (EXIF/GPS) présente'}.`);
if (redirections.length) rapport.info(`${redirections.length} redirection(s) créée(s).`);

rapport.afficher();
if (!rapport.ok) process.exit(1);
