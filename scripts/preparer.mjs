#!/usr/bin/env node
// PRÉPARATION DU SITE (lancée automatiquement avant chaque build)
// 1. lit et valide les réglages et tous les contenus (messages en français) ;
// 2. optimise les photos (sans métadonnées GPS) ;
// 3. calcule prix, disponibilités, adresses des pages, traductions ;
// 4. écrit src/genere/donnees.json, utilisé par les pages Astro.
// Option : --validation-seule (vérifie sans optimiser les photos).

import { writeFileSync, mkdirSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { chemin, lireYaml, relatif, slugifier, estObjet, ErreurContenu, enumerer } from './lib/outils.mjs';
import { Rapport } from './lib/rapport.mjs';
import { valider } from './lib/validation.mjs';
import { schemaConfig, schemaEquipement, JOURS } from './lib/schemas.mjs';
import { chargerContenus, listerPhotos } from './lib/contenu.mjs';
import { traiterImages } from './lib/images.mjs';
import { iconeExiste, tableIcones } from './lib/icones.mjs';
import { markdownVersHtml, texteBrut } from './lib/markdown.mjs';
import { adresseSite } from './lib/adresse-site.mjs';
import { aujourdhui as aujourdhuiTz, ajouterJours, ajouterMois, versNum } from '../src/lib/partage/dates.js';
import { prixAPartirDe } from '../src/lib/partage/tarifs.js';
import { bornerPlages, fusionnerPlages } from '../src/lib/partage/disponibilites.js';

const validationSeule = process.argv.includes('--validation-seule');
const rapport = new Rapport('Préparation du site');
const MAINTENANT = new Date();

// ---------------------------------------------------------------------------
// 1. Réglages
// ---------------------------------------------------------------------------
let configBrute = {};
try { configBrute = lireYaml(chemin('config/site.yml')); } catch (e) { rapport.erreur(e.message, chemin('config/site.yml')); }
const ctxBase = { rapport, iconeExiste };
const config = valider(configBrute, schemaConfig, { ...ctxBase, fichier: chemin('config/site.yml'), quoi: 'Réglages (config/site.yml)' });
const production = config.production === true;
const adresse = adresseSite();

let equipementsBruts = {};
try { equipementsBruts = lireYaml(chemin('config/equipements.yml')); } catch (e) { rapport.erreur(e.message, chemin('config/equipements.yml')); }
const equipements = {};
for (const [cle, def] of Object.entries(equipementsBruts || {})) {
  if (slugifier(cle) !== cle) { rapport.erreur(`Catalogue des équipements : la clé « ${cle} » doit être en minuscules sans accents ni espaces.`, chemin('config/equipements.yml')); continue; }
  equipements[cle] = valider(def, schemaEquipement, { ...ctxBase, fichier: chemin('config/equipements.yml'), quoi: `Équipement « ${cle} »` });
}

const langues = [...new Set([config.langues.defaut, ...config.langues.actives])].filter((l) => ['fr', 'en', 'id'].includes(l));
const langueDefaut = config.langues.defaut;
const textes = Object.fromEntries(['fr', 'en', 'id'].map((l) => [l, JSON.parse(readFileSync(chemin(`src/i18n/${l}.json`), 'utf8'))]));
const T = (l, cle, vars = {}) => {
  const v = cle.split('.').reduce((o, k) => o?.[k], textes[l]) ?? cle.split('.').reduce((o, k) => o?.[k], textes.fr) ?? cle;
  return String(v).replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
};

// Cohérences des réglages
if (config.synchronisation.republier_toutes_les_heures >= config.calendrier.fraicheur_max_heures && config.synchronisation.republier_toutes_les_heures > 0) {
  rapport.avertissement(`Réglages : « republier_toutes_les_heures » (${config.synchronisation.republier_toutes_les_heures} h) devrait être inférieur à « fraicheur_max_heures » (${config.calendrier.fraicheur_max_heures} h), sinon le site affichera parfois « Disponibilités à confirmer ».`);
}
if (adresse.source === 'local' && config.hebergeur !== 'github-pages') {
  rapport.bloquantEnProduction(production, `Hébergeur « ${config.hebergeur} » : indiquez l’adresse publique du site dans « url » (config/site.yml), sinon les liens de partage, le plan du site et l’adresse canonique seront faux.`, chemin('config/site.yml'));
}
if (config.paiement.niveau === 2 && !config.paiement.worker_url) rapport.erreur('Paiement niveau 2 : indiquez « paiement.worker_url » (adresse du service worker), ou revenez au niveau 0.');
if (config.calendrier.temps_reel.active && !config.calendrier.temps_reel.url) rapport.erreur('Calendrier temps réel activé mais « calendrier.temps_reel.url » est vide.');
if (config.formulaire.prestataire === 'worker' && !config.formulaire.worker_url) rapport.avertissement('Formulaire : prestataire « worker » sans « worker_url » : le site utilisera « mailto ».');
if (config.formulaire.turnstile.active && config.formulaire.prestataire !== 'worker') rapport.avertissement('Turnstile n’est vérifié que par le service worker : il est ignoré avec le prestataire actuel.');
if (config.statistiques.fournisseur === 'ga4' && !config.statistiques.ga4_id) rapport.erreur('Statistiques GA4 : indiquez « ga4_id » (ex. G-XXXXXXX).');
if (config.statistiques.fournisseur === 'plausible' && !config.statistiques.plausible_domaine) rapport.erreur('Statistiques Plausible : indiquez « plausible_domaine ».');
if (config.statistiques.fournisseur === 'umami' && (!config.statistiques.umami_script || !config.statistiques.umami_id)) rapport.erreur('Statistiques Umami : indiquez « umami_script » et « umami_id ».');
if (config.statistiques.fournisseur === 'goatcounter' && !config.statistiques.goatcounter_code) rapport.erreur('Statistiques GoatCounter : indiquez « goatcounter_code ».');
if (config.statistiques.fournisseur === 'cloudflare' && !config.statistiques.cloudflare_token) rapport.erreur('Statistiques Cloudflare : indiquez « cloudflare_token ».');
if (config.newsletter.active && !config.newsletter.url_formulaire) rapport.erreur('Newsletter activée sans « url_formulaire ».');

// Prestataire de formulaire effectif (repli automatique sur mailto)
const formulaire = (() => {
  const f = config.formulaire;
  const p = f.prestataire;
  if (p === 'web3forms' && f.web3forms_cle) return { prestataire: 'web3forms', action: 'https://api.web3forms.com/submit', cle: f.web3forms_cle };
  if (p === 'formspree' && f.formspree_id) return { prestataire: 'formspree', action: `https://formspree.io/f/${f.formspree_id}` };
  if (p === 'getform' && f.getform_id) return { prestataire: 'getform', action: `https://getform.io/f/${f.getform_id}` };
  if (p === 'worker' && f.worker_url) return { prestataire: 'worker', action: f.worker_url.replace(/\/$/, '') + '/demande' };
  if (p !== 'mailto') rapport.bloquantEnProduction(production, `Formulaire : la clé ou l'identifiant du prestataire « ${p} » n'est pas renseigné : les demandes s'ouvrent dans la messagerie du visiteur (mailto). Voir docs/02.`);
  return { prestataire: 'mailto', action: '' };
})();

// ---------------------------------------------------------------------------
// 2. Contenus
// ---------------------------------------------------------------------------
const ctx = { ...ctxBase, equipements: Object.keys(equipements), production };
const contenus = chargerContenus(ctx, rapport);
const { destinations, etablissements, logements, avis, guides, pages, accueil } = contenus;

const destParSlug = new Map(destinations.map((d) => [d.slug, d]));
const etabParSlug = new Map(etablissements.map((e) => [e.slug, e]));

// Publication en cascade
for (const l of logements) {
  const e = etabParSlug.get(l.etablissement);
  l.visible = l.publie && !!e && e.publie && !!destParSlug.get(e.destination)?.publie;
  if (l.publie && e && !l.visible) rapport.avertissement(`Le logement « ${l.slug} » est publié mais son établissement ou sa destination ne l'est pas : il reste masqué.`, l.fichier);
}
const logementsVisibles = logements.filter((l) => l.visible);
for (const e of etablissements) {
  e.logements = logementsVisibles.filter((l) => l.etablissement === e.slug).map((l) => l.slug);
  e.visible = e.publie && e.logements.length > 0 && !!destParSlug.get(e.destination)?.publie;
  e.aUnePage = e.visible && e.logements.length >= 2;
}
for (const d of destinations) {
  d.etablissements = etablissements.filter((e) => e.visible && e.destination === d.slug).map((e) => e.slug);
  d.logements = logementsVisibles.filter((l) => etabParSlug.get(l.etablissement)?.destination === d.slug).map((l) => l.slug);
  d.visible = d.publie && d.logements.length > 0;
}
if (!logementsVisibles.length) rapport.erreur('Aucun logement publié : le site a besoin d’au moins un logement avec « publie: true ».');

// Adresses (slugs) uniques par destination
for (const d of destinations) {
  const vus = new Map();
  for (const e of etablissements.filter((x) => x.aUnePage && x.destination === d.slug)) vus.set(e.slug, `établissement « ${e.slug} »`);
  for (const l of logementsVisibles.filter((x) => etabParSlug.get(x.etablissement)?.destination === d.slug)) {
    if (vus.has(l.slug)) rapport.erreur(`Le logement « ${l.slug} » a le même nom de dossier que l'${vus.get(l.slug)} : renommez l'un des deux dossiers (ils partagent la même adresse web).`, l.fichier);
    vus.set(l.slug, `logement « ${l.slug} »`);
  }
}

// ---------------------------------------------------------------------------
// 3. Contrôles de sécurité et de contenu
// ---------------------------------------------------------------------------
const MOTIF_ICAL = /(airbnb\.[a-z.]+\/calendar\/ical|admin\.booking\.com\/hotel\/hoteladmin\/ical|ical\.booking\.com\/v1\/export|(vrbo|abritel|homeaway)\.[a-z.]+\/icalendar\/|calendar\.google\.com\/calendar\/ical\/[^\s"']*private|\/ical\/[^\s"']*\.ics\?|\.ics\?s=)/i;
const MOTIF_CODE = /\b(?:digicode|code(?!\s+postal)|boîte à clés|boite a cles|cadenas|alarme|mot de passe|password)\b[^.\n]{0,30}?\b\d{3,8}\b/i;
const estExemple = (t) => /\bEXEMPLE\b/.test(t) || /\b(?:description|contenu|texte|guide|illustration|avis|photo)s? d['’]exemple\b/i.test(t);
const MOTIF_A_COMPLETER = /À COMPLÉTER|A COMPLETER/;

function parcourirTextes(objet, rappel, chemin = '') {
  if (typeof objet === 'string') rappel(objet, chemin);
  else if (Array.isArray(objet)) objet.forEach((v, i) => parcourirTextes(v, rappel, `${chemin}[${i + 1}]`));
  else if (estObjet(objet)) for (const [k, v] of Object.entries(objet)) if (!['fichier', 'dossier', 'traductions'].includes(k)) parcourirTextes(v, rappel, chemin ? `${chemin}.${k}` : k);
}

function controlerTextes(objet, fichier, quoi, { publie = true } = {}) {
  let exemples = [];
  const aCompleter = [];
  parcourirTextes(objet, (t, champ) => {
    if (publie && MOTIF_A_COMPLETER.test(t) && !/^legal\./.test(champ)) aCompleter.push(champ || 'texte');
    if (MOTIF_ICAL.test(t)) rapport.erreur(`${quoi} : un LIEN iCAL PRIVÉ semble collé dans le champ « ${champ} ». Il serait visible de tous : retirez-le et placez-le dans un secret GitHub (docs/04).`, fichier);
    if (MOTIF_CODE.test(t)) rapport.erreur(`${quoi} : le champ « ${champ} » semble contenir un code d'accès ou un mot de passe. Ne publiez jamais de code sur le site : envoyez-le par message au voyageur.`, fichier);
    if (publie && estExemple(t)) exemples.push(champ || 'texte');
  });
  if (exemples.length) {
    rapport.bloquantEnProduction(production, `${quoi} : contient encore des données d'exemple (champ(s) ${[...new Set(exemples)].slice(0, 6).join(', ')}${exemples.length > 6 ? '…' : ''}).`, fichier);
  }
  if (aCompleter.length && !/^Page « /.test(quoi)) {
    rapport.bloquantEnProduction(production, `${quoi} : il reste des mentions « À COMPLÉTER » (champ(s) ${[...new Set(aCompleter)].slice(0, 6).join(', ')}).`, fichier);
  }
}

controlerTextes({ marque: config.marque, contact: config.contact, seo: config.seo }, chemin('config/site.yml'), 'Réglages');
if (production) {
  if (/exemple/i.test(config.contact.email)) rapport.erreur('Réglages : l’adresse e-mail de contact est encore celle d’exemple.', chemin('config/site.yml'));
  if (/00 00 00|0{6,}/.test(config.contact.telephone || '') || /0{6,}/.test(config.contact.whatsapp || '')) rapport.erreur('Réglages : le téléphone ou WhatsApp est encore celui d’exemple.', chemin('config/site.yml'));
  if (!adresse.url.startsWith('https://')) rapport.erreur(`L'adresse du site n'est pas en https (${adresse.url}). Sur Cloudflare/Netlify, renseignez « url » dans config/site.yml.`, chemin('config/site.yml'));
}
for (const l of logements) controlerTextes({ ...l, corps: l.corps }, l.fichier, `Logement « ${l.slug} »`, { publie: l.visible });
for (const e of etablissements) controlerTextes({ ...e, corps: e.corps }, e.fichier, `Établissement « ${e.slug} »`, { publie: e.visible });
for (const d of destinations) controlerTextes({ ...d, corps: d.corps }, d.fichier, `Destination « ${d.slug} »`, { publie: d.visible });
controlerTextes(accueil, accueil.fichier, "Page d'accueil");
for (const p of Object.values(pages)) controlerTextes(p, p.fichier, `Page « ${p.slug} »`, { publie: p.slug !== 'infos-voyageurs' || config.infos_voyageurs.active });
if (config.guides_locaux.active) for (const g of guides) controlerTextes(g, g.fichier, `Guide « ${g.slug} »`, { publie: g.publie });

// Calendriers : noms de secrets
const secretsVus = new Map();
for (const l of logements) {
  for (const c of l.calendriers) {
    if (!c.secret) c.secret = `ICAL_${l.slug.toUpperCase().replace(/-/g, '_')}_${slugifier(c.type === 'autre' ? c.nom : c.type).toUpperCase().replace(/-/g, '_')}`;
    if (secretsVus.has(c.secret)) rapport.erreur(`Le secret « ${c.secret} » est utilisé par deux calendriers (${secretsVus.get(c.secret)} et ${l.slug}). Chaque calendrier doit avoir son propre secret.`, l.fichier);
    secretsVus.set(c.secret, l.slug);
  }
}

// ---------------------------------------------------------------------------
// 4. Photos
// ---------------------------------------------------------------------------
const empreintesExemple = new Set(existsSync(chemin('scripts/donnees/empreintes-photos-exemple.json'))
  ? JSON.parse(readFileSync(chemin('scripts/donnees/empreintes-photos-exemple.json'), 'utf8')).empreintes : []);

for (const l of logements) l.photosBrutes = listerPhotos(l.dossier, l.legendes_photos, rapport, l.fichier);
for (const e of etablissements) e.photosBrutes = listerPhotos(e.dossier, e.legendes_photos, rapport, e.fichier);
for (const d of destinations) d.photosBrutes = listerPhotos(d.dossier, [], rapport, d.fichier);

function fichierMedia(ref, fichierContexte, quoi) {
  if (!ref) return null;
  const nettoye = ref.replace(/^\/+/, '').replace(/^content\//, '');
  const f = chemin('content', nettoye);
  if (!existsSync(f)) { rapport.erreur(`${quoi} : image introuvable « ${ref} » (attendue dans content/${nettoye}).`, fichierContexte); return null; }
  return f;
}

const demandes = [];
for (const l of logementsVisibles) {
  if (!l.photosBrutes.length) {
    rapport.erreur(`Le logement « ${l.slug} » n'a pas de photo de couverture : ajoutez au moins une photo dans « ${relatif(l.dossier)}/photos/ » (ou passez « publie: false »).`, l.fichier);
  }
  l.photosBrutes.forEach((p, i) => demandes.push({ fichier: p.fichier, og: i === 0 }));
  if (l.plan) { l.planFichier = fichierMedia(`logements/${l.slug}/${l.plan.replace(/^.*\//, '')}`, l.fichier, `Logement « ${l.slug} » (plan)`); if (l.planFichier) demandes.push({ fichier: l.planFichier }); }
}
for (const e of etablissements.filter((x) => x.visible)) e.photosBrutes.forEach((p, i) => demandes.push({ fichier: p.fichier, og: i === 0 }));
for (const d of destinations.filter((x) => x.visible)) d.photosBrutes.forEach((p, i) => demandes.push({ fichier: p.fichier, og: i === 0 }));
const medias = {};
const ajouterMedia = (ref, fichierContexte, quoi, og = true) => {
  const f = fichierMedia(ref, fichierContexte, quoi);
  if (f) { medias[ref] = f; demandes.push({ fichier: f, og }); }
};
if (accueil.image) ajouterMedia(accueil.image, accueil.fichier, "Page d'accueil");
for (const p of Object.values(pages)) if (p.image) ajouterMedia(p.image, p.fichier, `Page « ${p.slug} »`);
if (config.guides_locaux.active) for (const g of guides) if (g.image && g.publie) ajouterMedia(g.image, g.fichier, `Guide « ${g.slug} »`);
if (config.seo.image_partage) ajouterMedia(config.seo.image_partage, chemin('config/site.yml'), 'Image de partage');

const images = validationSeule ? new Map() : await traiterImages(demandes, { avif: true, rapport, empreintesExemple });

function photo(fichier, alt) {
  const m = images.get(fichier);
  if (!m) return validationSeule ? { cle: 'validation', largeur: 1600, hauteur: 1067, couleur: '#ccc', variantes: [960], avif: false, alt } : null;
  return { cle: m.cle, largeur: m.largeur, hauteur: m.hauteur, couleur: m.couleur, variantes: m.variantes, avif: m.avif, og: m.og ? `img/${m.cle}/og.jpg` : null, alt, exemple: m.exemple };
}

function photosDe(element, nomAlt, quoi) {
  const res = [];
  let sansLegende = 0, exemples = 0;
  element.photosBrutes.forEach((p, i) => {
    if (!p.legende) sansLegende++;
    const ph = photo(p.fichier, p.legende || `${nomAlt} — photo ${i + 1}`);
    if (ph) { res.push(ph); if (ph.exemple) exemples++; }
  });
  if (sansLegende && element.visible !== false) rapport.avertissement(`${quoi} : ${sansLegende} photo(s) sans légende. Ajoutez un fichier photos.yml (texte alternatif pour Google et l'accessibilité, voir docs/03).`, element.fichier);
  if (exemples && element.visible !== false) rapport.bloquantEnProduction(production, `${quoi} utilise encore ${exemples} photo(s) d'exemple : remplacez-les par vos vraies photos (docs/03).`, element.fichier);
  return res;
}

// ---------------------------------------------------------------------------
// 5. Disponibilités
// ---------------------------------------------------------------------------
let dispoFichier = { logements: {} };
if (existsSync(chemin('donnees/disponibilites.json'))) {
  try { dispoFichier = JSON.parse(readFileSync(chemin('donnees/disponibilites.json'), 'utf8')); } catch {
    rapport.avertissement('Le fichier donnees/disponibilites.json est illisible : il sera recréé à la prochaine synchronisation.');
  }
}

function graine(texte) { return parseInt(createHash('md5').update(texte).digest('hex').slice(0, 8), 16); }

/** Disponibilités d'exemple (mode démonstration uniquement), stables sur une journée. */
function dispoExemple(slug, aujourdhui) {
  let x = graine(slug + aujourdhui.slice(0, 7));
  const alea = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
  const plages = [];
  let curseur = Math.floor(alea() * 4);
  while (curseur < 300) {
    const duree = 2 + Math.floor(alea() * 6);
    plages.push([ajouterJours(aujourdhui, curseur), ajouterJours(aujourdhui, curseur + duree)]);
    curseur += duree + 1 + Math.floor(alea() * 9);
  }
  return plages;
}

// ---------------------------------------------------------------------------
// 6. Construction des données par élément
// ---------------------------------------------------------------------------
const indexJours = (liste) => (liste || []).map((j) => JOURS.indexOf(j)).filter((i) => i >= 0);
const md = (t, niveau = 2) => markdownVersHtml(t, niveau);
const faqHtml = (faq) => (faq || []).map((q) => ({ question: q.question, reponseHtml: md(q.reponse, 4) }));

/** Champs traduits d'un élément pour chaque langue active. */
function versions(element, construire) {
  const res = {};
  for (const l of langues) {
    const tr = l === 'fr' ? null : element.traductions?.[l];
    res[l] = { ...construire(tr, l), traduit: l === 'fr' || !!tr };
  }
  return res;
}

// Avis (les avis d'exemple ne sont jamais publiés en production)
const avisPublies = avis.filter((a) => a.publie && config.avis.active && (!a.exemple || !production)).map((a) => ({
  id: a.id, auteur: a.auteur, date: a.date, source: a.source, note: a.note, note_sur: Number(a.note_sur), noteSur5: a.note != null ? Math.round((a.note / Number(a.note_sur)) * 5 * 10) / 10 : null,
  logement: a.logement || null, etablissement: a.etablissement || null, langue: a.langue, lien: a.lien || null, exemple: !!a.exemple, texteHtml: md(a.texte, 4),
})).sort((a, b) => b.date.localeCompare(a.date));
if (production && avis.some((a) => a.exemple)) rapport.info(`${avis.filter((a) => a.exemple).length} avis d'exemple ignoré(s) (mode production).`);

function noteMoyenne(liste) {
  const notes = liste.filter((a) => a.noteSur5 != null && !a.exemple);
  if (!notes.length) return null;
  return { valeur: Math.round((notes.reduce((s, a) => s + a.noteSur5, 0) / notes.length) * 10) / 10, nombre: notes.length };
}

// Carte : position exacte ou approximative (décalage stable < rayon/2)
function positionCarte(e) {
  const exacte = config.carte.precision === 'exacte';
  let lat = e.latitude, lng = e.longitude;
  if (!exacte) {
    const g = graine(e.slug);
    const angle = (g % 360) * Math.PI / 180;
    const dist = (config.carte.rayon_approximatif_m * 0.45) * ((g >> 9) % 100) / 100;
    lat += (dist * Math.cos(angle)) / 111320;
    lng += (dist * Math.sin(angle)) / (111320 * Math.cos((e.latitude * Math.PI) / 180));
  }
  return { lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5, exacte, rayon: exacte ? 0 : config.carte.rayon_approximatif_m };
}

const sortieDestinations = destinations.filter((d) => d.visible).map((d) => ({
  slug: d.slug, ordre: d.ordre, pays: d.pays, region: d.region || '', latitude: d.latitude ?? null, longitude: d.longitude ?? null,
  photos: photosDe(d, d.nom, `Destination « ${d.slug} »`), etablissements: d.etablissements, logements: d.logements,
  points_forts: d.points_forts, venir: d.venir,
  i18n: versions(d, (tr) => ({
    nom: tr?.nom || d.nom, accroche: tr?.accroche || d.accroche || '', resume: tr?.resume || d.resume,
    meilleure_periode: tr?.meilleure_periode || d.meilleure_periode || '',
    points_forts: tr?.points_forts || d.points_forts, venir: tr?.venir || d.venir,
    corpsHtml: md(tr?.corps || d.corps), faq: faqHtml(tr?.faq || d.faq), seo: { ...d.seo, ...(tr?.seo || {}) },
  })),
}));

const sortieEtablissements = etablissements.filter((e) => e.visible).map((e) => {
  const dest = destParSlug.get(e.destination);
  return {
    slug: e.slug, ordre: e.ordre, type: e.type, destination: e.destination, aUnePage: e.aUnePage, logements: e.logements,
    adresse: e.adresse || '', code_postal: e.code_postal || '', ville: e.ville, region: e.region || '', pays: e.pays, code_pays: e.code_pays,
    latitude: e.latitude, longitude: e.longitude, carte: positionCarte(e), fuseau: e.fuseau_horaire, devise: e.devise,
    arrivee: e.arrivee, taxe_sejour: e.taxe_sejour, contact: e.contact, langues_accueil: e.langues_accueil,
    a_proximite: e.a_proximite, liens_externes: e.liens_externes, numero_enregistrement: e.numero_enregistrement || '',
    photos: photosDe(e, e.nom, `Établissement « ${e.slug} »`),
    noteMoyenne: noteMoyenne(avisPublies.filter((a) => a.etablissement === e.slug || e.logements.includes(a.logement))),
    i18n: versions(e, (tr, g) => ({
      nom: tr?.nom || e.nom, resume: tr?.resume || e.resume || '', corpsHtml: md(tr?.corps || e.corps),
      faq: faqHtml(tr?.faq || e.faq), arrivee: { ...e.arrivee, ...(tr?.arrivee || {}) }, seo: { ...e.seo, ...(tr?.seo || {}) },
      destinationNom: (g !== 'fr' && dest?.traductions?.[g]?.nom) || dest?.nom || '',
    })),
  };
});
const sortieEtabParSlug = new Map(sortieEtablissements.map((e) => [e.slug, e]));

const aujourdhuiParis = aujourdhuiTz('Europe/Paris', MAINTENANT.getTime());
const sortieDispo = { genereLe: MAINTENANT.toISOString(), logements: {} };

const sortieLogements = logementsVisibles.map((l) => {
  const e = sortieEtabParSlug.get(l.etablissement);
  const etab = etabParSlug.get(l.etablissement);
  const regles = { ...config.sejour };
  for (const [k, v] of Object.entries(l.sejour || {})) {
    if (v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0)) regles[k] = v;
  }
  const reglesIdx = { ...regles, jours_arrivee: indexJours(regles.jours_arrivee), jours_depart: indexJours(regles.jours_depart) };
  const tx = e.taxe_sejour || { mode: 'aucune' };
  const tarif = {
    devise: e.devise, arrondi: etab.arrondi_prix ?? (e.devise === 'IDR' ? 1000 : 1),
    remisePct: l.tarifs.remise_directe_pct ?? config.tarifs.remise_directe_pct,
    remisesCumulables: config.tarifs.remises_cumulables, acomptePct: config.paiement.acompte_pct,
    prix_nuit: l.tarifs.prix_nuit, frais_menage: l.tarifs.frais_menage, voyageurs_inclus: l.tarifs.voyageurs_inclus || l.capacite,
    supplement_voyageur_nuit: l.tarifs.supplement_voyageur_nuit,
    weekend: { nuits: indexJours(l.tarifs.supplement_weekend.nuits), montant: l.tarifs.supplement_weekend.montant, pourcentage: l.tarifs.supplement_weekend.pourcentage },
    saisons: l.tarifs.saisons, speciales: l.tarifs.periodes_speciales, remises: l.tarifs.remises,
    frais_animal: l.tarifs.frais_animal, caution: l.tarifs.caution,
    taxe: { mode: tx.mode, montant: tx.montant_par_adulte_nuit, pourcentage: tx.pourcentage, plafond: tx.plafond_par_adulte_nuit, additionnelle: tx.taxe_additionnelle_pct, ageExo: tx.age_exoneration },
  };
  if (l.tarifs.voyageurs_inclus && l.tarifs.voyageurs_inclus > l.capacite) rapport.avertissement(`Logement « ${l.slug} » : « voyageurs_inclus » (${l.tarifs.voyageurs_inclus}) dépasse la capacité (${l.capacite}).`, l.fichier);
  for (const s of [...l.tarifs.saisons, ...l.tarifs.periodes_speciales]) {
    if (s.du.length === 10 && s.au.length === 10 && s.au < s.du) rapport.erreur(`Logement « ${l.slug} » : la période « ${s.nom} » se termine (${s.au}) avant de commencer (${s.du}).`, l.fichier);
    if ((s.du.length === 10) !== (s.au.length === 10)) rapport.erreur(`Logement « ${l.slug} » : la période « ${s.nom} » mélange les formats "MM-JJ" et "AAAA-MM-JJ" : utilisez le même pour « du » et « au ».`, l.fichier);
  }
  const today = aujourdhuiTz(e.fuseau, MAINTENANT.getTime());
  const aPartirDe = prixAPartirDe(tarif, today);

  // Disponibilités
  const brut = dispoFichier.logements?.[l.slug];
  let dispo;
  const sansSource = !l.calendriers.length;
  if (brut && Array.isArray(brut.plages) && !['non-configure'].includes(brut.statut)) {
    dispo = { statut: brut.statut || 'ok', verifieLe: brut.verifieLe || null, plages: bornerPlages(brut.plages, today, ajouterMois(today, 36)) };
  } else if (!production) {
    dispo = { statut: 'exemple', verifieLe: MAINTENANT.toISOString(), plages: dispoExemple(l.slug, today) };
  } else {
    dispo = { statut: 'non-configure', verifieLe: null, plages: [] };
    rapport.avertissement(`Logement « ${l.slug} » : ${sansSource ? 'aucun calendrier iCal configuré' : 'calendrier pas encore synchronisé'} : le site affichera « disponibilités sur demande » (docs/04).`, l.fichier);
  }
  sortieDispo.logements[l.slug] = { statut: dispo.statut, verifieLe: dispo.verifieLe, plages: dispo.plages };

  const photos = photosDe(l, l.nom, `Logement « ${l.slug} »`);
  const avisL = avisPublies.filter((a) => a.logement === l.slug || (a.etablissement === l.etablissement && !a.logement));
  const equip = l.equipements.filter((k) => equipements[k]).map((k) => ({ cle: k, icone: equipements[k].icone, categorie: equipements[k].categorie, filtre: equipements[k].filtre, libelle: Object.fromEntries(langues.map((g) => [g, equipements[k][g] || equipements[k].fr])) }));
  return {
    slug: l.slug, ordre: l.ordre, type: l.type, etablissement: l.etablissement, destination: e.destination,
    capacite: l.capacite, chambres: l.chambres, lits: l.lits, salles_de_bain: l.salles_de_bain, surface_m2: l.surface_m2 ?? null,
    etage: l.etage || '', ascenseur: l.ascenseur, equipements: equip, regles: l.regles, annulation: l.annulation,
    tarif, reglesSejour: reglesIdx, prixAPartirDe: aPartirDe, prixPlateformeVerifie: l.tarifs.prix_plateforme_verifie,
    photos, plan: l.planFichier ? photo(l.planFichier, `Plan — ${l.nom}`) : null,
    video: l.video || null, visite_virtuelle: l.visite_virtuelle || null, labels: l.labels, mots_cles: l.mots_cles,
    numero_enregistrement: l.numero_enregistrement || e.numero_enregistrement || '', classement: l.classement || '',
    lien_acompte: l.paiement?.lien_acompte || '', liens_externes: l.liens_externes,
    fuseau: e.fuseau, devise: e.devise, carte: e.carte,
    calendriers: l.calendriers.map((c) => ({ nom: c.nom, type: c.type })),
    disponibilites: dispo, avis: avisL.map((a) => a.id), noteMoyenne: noteMoyenne(avisL),
    i18n: versions(l, (tr, g) => ({
      nom: tr?.nom || l.nom, resume: tr?.resume || l.resume, corpsHtml: md(tr?.corps || l.corps, 3),
      faq: [...faqHtml(tr?.faq || l.faq), ...(e.i18n[g]?.faq || [])],
      regles_autres: tr?.regles_autres || l.regles.autres, equipements_libres: tr?.equipements_libres || l.equipements_libres,
      seo: { ...l.seo, ...(tr?.seo || {}) },
    })),
  };
});

// ---------------------------------------------------------------------------
// 7. Pages, accueil, guides, variables des pages légales
// ---------------------------------------------------------------------------
const nomsHebergeurs = {
  'github-pages': 'GitHub Pages — GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis (github.com).',
  cloudflare: 'Cloudflare — Cloudflare, Inc., 101 Townsend Street, San Francisco, CA 94107, États-Unis (cloudflare.com).',
  netlify: 'Netlify — Netlify, Inc., San Francisco, Californie, États-Unis (netlify.com) — adresse postale complète à vérifier sur leur site.',
};
const textesPrestataires = {
  web3forms: 'Web3Forms (web3forms.com), qui nous transmet votre message par e-mail.',
  formspree: 'Formspree (formspree.io, États-Unis), qui nous transmet votre message par e-mail.',
  getform: 'Getform (getform.io), qui nous transmet votre message par e-mail.',
  worker: 'notre service d’envoi hébergé chez Cloudflare (cloudflare.com), qui nous transmet votre message par e-mail.',
  mailto: 'aucun intermédiaire : votre message est envoyé depuis votre propre messagerie.',
};
const textesStats = {
  aucun: 'Ce site n’utilise aucun cookie et aucun outil de mesure d’audience.',
  plausible: 'Nous mesurons l’audience avec Plausible Analytics, un outil sans cookies qui ne collecte aucune donnée personnelle.',
  umami: 'Nous mesurons l’audience avec Umami, un outil sans cookies qui ne collecte aucune donnée personnelle.',
  goatcounter: 'Nous mesurons l’audience avec GoatCounter, un outil sans cookies qui ne collecte aucune donnée personnelle.',
  cloudflare: 'Nous mesurons l’audience avec Cloudflare Web Analytics, un outil sans cookies.',
  ga4: 'Avec votre accord (bandeau de consentement), nous mesurons l’audience avec Google Analytics, qui dépose des cookies. Vous pouvez refuser ou retirer votre consentement à tout moment via le lien « Gérer les cookies » en bas de page.',
};
const emailTexte = config.contact.email.replace('@', ' [arobase] ');
const variables = {
  'legal.editeur_nom': config.legal.editeur_nom || 'À COMPLÉTER', 'legal.editeur_statut': config.legal.editeur_statut || 'À COMPLÉTER',
  'legal.editeur_adresse': config.legal.editeur_adresse || 'À COMPLÉTER', 'legal.directeur_publication': config.legal.directeur_publication || 'À COMPLÉTER',
  'legal.siret_ligne': config.legal.siret ? `- **SIRET :** ${config.legal.siret}` : '',
  'legal.hebergeur': config.legal.hebergeur_texte || nomsHebergeurs[config.hebergeur],
  'legal.mediateur': /^aucun$/i.test(String(config.legal.mediateur_consommation || '').trim())
    ? 'En cas de litige, les parties recherchent d’abord une solution amiable. À défaut, le Locataire peut saisir gratuitement un conciliateur de justice (www.conciliateurs.fr).'
    : config.legal.mediateur_consommation ? `En cas de litige, vous pouvez recourir gratuitement au médiateur de la consommation : ${config.legal.mediateur_consommation}.` : 'À COMPLÉTER : médiateur de la consommation (ou « aucun » si vous louez en simple particulier, voir docs/08).',
  'contact.telephone': config.contact.telephone || '', 'contact.email_texte': emailTexte, 'marque.nom': config.marque.nom, 'site.url': adresse.url,
  'paiement.acompte_pct': String(config.paiement.acompte_pct), 'paiement.solde_jours_avant_arrivee': String(config.paiement.solde_jours_avant_arrivee),
  'formulaire.prestataire_texte': textesPrestataires[formulaire.prestataire], 'statistiques.texte': textesStats[config.statistiques.fournisseur],
  'carte.texte': config.carte.fournisseur === 'osm'
    ? 'OpenStreetMap (© contributeurs OpenStreetMap). Les images de la carte sont chargées depuis les serveurs d’OpenStreetMap, qui reçoivent votre adresse IP ; aucun cookie n’est déposé.'
    : 'Google Maps, chargé uniquement si vous cliquez sur « Afficher Google Maps » (Google peut alors déposer des cookies).',
};
function remplacerVariables(texte, fichier, langue = 'fr') {
  return String(texte || '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (tout, nom) => {
    if (nom === 'annulation.modeles') return ['flexible', 'moderee', 'stricte'].map((m) => `- **${T(langue, `annulation.titre_${m}`)}** — ${T(langue, `annulation.${m}`).replace(/^[^:]+:\s*/, '')}`).join('\n');
    if (nom in variables) return variables[nom];
    rapport.avertissement(`Variable inconnue « ${tout} » dans une page.`, fichier);
    return tout;
  });
}

const sortiePages = {};
// Les encadrés « > **Modèle à faire valider… » des pages fournies servent
// pendant la préparation : ils disparaissent automatiquement en mode réel.
const sansNotesModele = (corps) => (production ? String(corps || '').replace(/^> \*\*Modèle à faire valider[\s\S]*?(?:\n[ \t]*\n|$)/m, '') : corps);
for (const p of Object.values(pages)) {
  if (p.slug === 'infos-voyageurs' && !config.infos_voyageurs.active) continue;
  const html = (corps) => md(remplacerVariables(sansNotesModele(corps), p.fichier));
  sortiePages[p.slug] = {
    slug: p.slug, noindex: p.noindex || p.slug === 'infos-voyageurs', image: p.image ? photo(medias[p.image], p.image_legende || p.titre) : null,
    i18n: versions(p, (tr) => ({
      titre: tr?.titre || p.titre, description: tr?.description || p.description || '', sous_titre: tr?.sous_titre || p.sous_titre || '',
      corpsHtml: html(tr?.corps || p.corps), questions: (tr?.questions || p.questions).map((q) => ({ categorie: q.categorie || '', question: q.question, reponseHtml: md(q.reponse, 4) })),
    })),
  };
  if (production) {
    const brut = remplacerVariables(sansNotesModele(p.corps), p.fichier);
    if (MOTIF_A_COMPLETER.test(brut)) rapport.erreur(`La page « ${p.slug} » contient encore « À COMPLÉTER » : renseignez la rubrique « legal » de config/site.yml ou modifiez la page.`, p.fichier);
  } else if (MOTIF_A_COMPLETER.test(remplacerVariables(p.corps, p.fichier)) && ['mentions-legales', 'conditions-de-reservation', 'confidentialite'].includes(p.slug)) {
    rapport.avertissement(`La page légale « ${p.slug} » contient des mentions « À COMPLÉTER » (bloquant en production).`, p.fichier);
  }
}

if (!sortiePages.contact) {
  sortiePages.contact = { slug: 'contact', noindex: false, image: null, i18n: Object.fromEntries(langues.map((l) => [l, { titre: T(l, 'nav.contact'), description: '', sous_titre: '', corpsHtml: '', questions: [], traduit: true }])) };
}

const vedette = (accueil.logements_vedette?.length ? accueil.logements_vedette : sortieLogements.map((l) => l.slug))
  .filter((s) => sortieLogements.some((l) => l.slug === s)).slice(0, accueil.nombre_vedette || 6);
const sortieAccueil = {
  image: accueil.image ? photo(medias[accueil.image], accueil.image_legende || accueil.titre) : null,
  vedette, sections: accueil.sections,
  i18n: versions(accueil, (tr) => ({
    titre: tr?.titre || accueil.titre, sous_titre: tr?.sous_titre || accueil.sous_titre || '', corpsHtml: md(tr?.corps || accueil.corps),
    faq: faqHtml(tr?.faq_courte || accueil.faq_courte), seo: { ...(accueil.seo || {}), ...(tr?.seo || {}) },
  })),
};

const sortieGuides = config.guides_locaux.active ? guides.filter((g) => g.publie).sort((a, b) => b.date.localeCompare(a.date)).map((g) => ({
  slug: g.slug, date: g.date, destination: g.destination || null, langue: g.langue, mots_cles: g.mots_cles,
  titre: g.titre, resume: g.resume, corpsHtml: md(g.corps), image: g.image ? photo(medias[g.image], g.image_legende || g.titre) : null, seo: g.seo,
})) : [];

// ---------------------------------------------------------------------------
// 8. Adresses des pages (routes) dans chaque langue
// ---------------------------------------------------------------------------
const routes = [];
const seg = (l, cle) => textes[l].segments[cle] || cle;
const prefixe = (l) => (l === langueDefaut ? '' : `/${l}`);
const p = (l, ...morceaux) => `${prefixe(l)}/${morceaux.filter(Boolean).join('/')}${morceaux.filter(Boolean).length ? '/' : ''}`;
const destNom = (slug, l) => sortieDestinations.find((d) => d.slug === slug)?.i18n[l]?.nom || slug;

function ajouterRoute(type, id, construireChemin, options = {}) {
  const parLangue = {};
  for (const l of langues) {
    if (options.langues && !options.langues.includes(l)) continue;
    parLangue[l] = construireChemin(l);
  }
  for (const [l, chemin] of Object.entries(parLangue)) {
    routes.push({ type, id, langue: l, chemin, alternatives: parLangue, noindex: !!options.noindex || !production, sitemap: !options.noindex && options.sitemap !== false });
  }
}
const languesTraduites = (el) => langues.filter((l) => l === 'fr' || el.i18n?.[l]?.traduit);

if (config.maintenance.active) {
  ajouterRoute('maintenance', 'maintenance', (l) => p(l), { noindex: true });
  for (const slug of ['mentions-legales', 'confidentialite']) if (sortiePages[slug]) ajouterRoute('page', slug, (l) => p(l, seg(l, slug)), { langues: languesTraduites(sortiePages[slug]) });
} else {
  ajouterRoute('accueil', 'accueil', (l) => p(l));
  ajouterRoute('liste', 'logements', (l) => p(l, seg(l, 'logements')));
  if (sortieDestinations.length >= 2) ajouterRoute('destinations', 'destinations', (l) => p(l, seg(l, 'destinations')));
  for (const d of sortieDestinations) ajouterRoute('destination', d.slug, (l) => p(l, seg(l, 'logements'), d.slug));
  for (const e of sortieEtablissements.filter((x) => x.aUnePage)) ajouterRoute('etablissement', e.slug, (l) => p(l, seg(l, 'logements'), e.destination, e.slug));
  for (const lg of sortieLogements) ajouterRoute('logement', lg.slug, (l) => p(l, seg(l, 'logements'), lg.destination, lg.slug));
  for (const page of Object.values(sortiePages)) {
    const segment = (l) => (textes[l].segments[page.slug] ? seg(l, page.slug) : page.slug);
    const ls = page.slug === 'contact' ? langues : languesTraduites(page);
    ajouterRoute('page', page.slug, (l) => p(l, segment(l)), { langues: ls, noindex: page.noindex });
  }
  if (config.guides_locaux.active && sortieGuides.length) {
    ajouterRoute('guides', 'guides', (l) => p(l, seg(l, 'guides')), { langues: [langueDefaut] });
    for (const g of sortieGuides) ajouterRoute('guide', g.slug, (l) => p(l, seg(l, 'guides'), g.slug), { langues: [langueDefaut] });
  }
  if (config.paiement.niveau >= 1) {
    for (const lg of sortieLogements.filter((x) => config.paiement.niveau === 2 || x.lien_acompte)) {
      ajouterRoute('paiement', lg.slug, (l) => p(l, seg(l, 'paiement'), lg.slug), { noindex: true });
    }
    if (config.paiement.niveau === 2) {
      ajouterRoute('paiement-merci', 'merci', (l) => p(l, seg(l, 'paiement'), 'merci'), { noindex: true });
      ajouterRoute('paiement-annule', 'annule', (l) => p(l, seg(l, 'paiement'), 'annule'), { noindex: true });
    }
  }
}
const cheminsVus = new Set();
for (const r of routes) {
  if (cheminsVus.has(r.chemin)) rapport.erreur(`Deux pages ont la même adresse « ${r.chemin} » : renommez l'un des contenus (dossier ou fichier).`);
  cheminsVus.add(r.chemin);
}
const routePour = (type, id, l) => routes.find((r) => r.type === type && r.id === id && r.langue === l)?.chemin
  ?? routes.find((r) => r.type === type && r.id === id && r.langue === langueDefaut)?.chemin ?? null;

// Liens vers les pages pour chaque logement / établissement / destination
for (const lg of sortieLogements) lg.url = Object.fromEntries(langues.map((l) => [l, routePour('logement', lg.slug, l)]));
for (const e of sortieEtablissements) e.url = Object.fromEntries(langues.map((l) => [l, e.aUnePage ? routePour('etablissement', e.slug, l) : null]));
for (const d of sortieDestinations) d.url = Object.fromEntries(langues.map((l) => [l, routePour('destination', d.slug, l)]));

// ---------------------------------------------------------------------------
// 9. Icônes utilisées et écriture des fichiers
// ---------------------------------------------------------------------------
const iconesUtilisees = new Set([
  ...Object.values(equipements).map((e) => e.icone),
  ...config.pourquoi_reserver_en_direct.arguments.map((a) => a.icone), ...config.badges.map((b) => b.icone),
  ...sortieDestinations.flatMap((d) => d.points_forts.map((x) => x.icone)),
  // icônes de l'interface
  'users', 'bed-double', 'bath', 'ruler', 'door-open', 'map-pin', 'phone', 'mail', 'message-circle', 'calendar-days', 'chevron-left',
  'chevron-right', 'chevron-down', 'x', 'check', 'star', 'heart', 'share-2', 'printer', 'navigation', 'clock', 'info', 'triangle-alert',
  'shield-check', 'images', 'expand', 'play', 'search', 'sliders-horizontal', 'menu', 'globe', 'arrow-right', 'arrow-left', 'external-link',
  'quote', 'circle-check', 'circle-alert', 'paw-print', 'cigarette-off', 'cigarette', 'party-popper', 'baby', 'volume-x', 'key-round',
  'square-letter-p', 'tram-front', 'train-front', 'plane', 'car', 'bus', 'ship', 'shopping-bag', 'utensils', 'landmark', 'trees', 'waves-horizontal',
  'heart-pulse', 'compass', 'route', 'minus', 'plus', 'layout-grid', 'columns-2', 'building', 'house', 'sparkles', 'credit-card', 'copy',
  'calendar-check', 'circle-question-mark', 'languages', 'arrow-up-right', 'refresh-cw', 'map', 'scale', 'hand-coins', 'piggy-bank', 'list',
]);
// + toutes les icônes citées dans les composants (<Icone nom="…" />)
for (const f of listerSources(chemin('src'))) {
  const texte = readFileSync(f, 'utf8');
  for (const m of texte.matchAll(/<Icone\b[^>]*?\snom="([a-z0-9-]+)"/g)) iconesUtilisees.add(m[1]);
}
const icones = tableIcones([...iconesUtilisees]);
for (const n of iconesUtilisees) if (!icones[n]) rapport.avertissement(`Icône « ${n} » introuvable dans Lucide : elle ne s'affichera pas.`);

const theme = construireTheme(config.theme);

const donnees = {
  genereLe: MAINTENANT.toISOString(), production, demo: !production,
  site: { ...adresse, hebergeur: config.hebergeur },
  config, langues, langueDefaut, formulaire, theme,
  equipements, destinations: sortieDestinations, etablissements: sortieEtablissements, logements: sortieLogements,
  avis: avisPublies, pages: sortiePages, accueil: sortieAccueil, guides: sortieGuides, routes,
  disponibilites: sortieDispo,
  imagePartage: config.seo.image_partage ? photo(medias[config.seo.image_partage], config.marque.nom) : null,
};

if (!validationSeule) {
  mkdirSync(chemin('src/genere'), { recursive: true });
  writeFileSync(chemin('src/genere/donnees.json'), JSON.stringify(donnees));
  writeFileSync(chemin('src/genere/icones.json'), JSON.stringify(icones));
  mkdirSync(chemin('public/donnees'), { recursive: true });
  // Données publiques consultées par le navigateur (dates bloquées uniquement) et par le service worker
  writeFileSync(chemin('public/donnees/disponibilites.json'), JSON.stringify(sortieDispo));
  const cheminsRoute = (type) => Object.fromEntries(routes.filter((r) => r.type === type).map((r) => [r.langue, r.chemin]));
  writeFileSync(chemin('public/donnees/tarifs.json'), JSON.stringify({
    genereLe: donnees.genereLe,
    // Lu par le service de paiement (paiement-worker) : jamais de clé ni de lien iCal ici,
    // seulement des réglages publics et les NOMS des secrets de calendrier.
    production, site: adresse.url, marque: config.marque.nom, langueDefaut,
    paiement: { niveau: config.paiement.niveau, acomptePct: config.paiement.acompte_pct, soldeJours: config.paiement.solde_jours_avant_arrivee, fraicheurH: config.calendrier.fraicheur_max_heures },
    pages: { merci: cheminsRoute('paiement-merci'), annule: cheminsRoute('paiement-annule') },
    logements: Object.fromEntries(sortieLogements.map((l) => [l.slug, { nom: l.i18n[langueDefaut].nom, capacite: l.capacite, tarif: l.tarif, regles: l.reglesSejour, fuseau: l.fuseau, animaux: l.regles.animaux, calendriers: logements.find((x) => x.slug === l.slug).calendriers.map((c) => c.secret), heureArrivee: sortieEtabParSlug.get(l.etablissement).arrivee.heure_arrivee, heureDepart: sortieEtabParSlug.get(l.etablissement).arrivee.heure_depart }])),
  }));
}

rapport.info(`Mode : ${production ? 'PRODUCTION' : 'démonstration (noindex, bandeau visible)'} — adresse : ${adresse.url} (source : ${adresse.source}).`);
rapport.info(`${sortieLogements.length} logement(s), ${sortieEtablissements.length} établissement(s), ${sortieDestinations.length} destination(s), ${routes.length} page(s) générée(s), langue(s) : ${langues.join(', ')}.`);
rapport.info(`Formulaire de demande : ${formulaire.prestataire}.`);
rapport.afficher();
if (!rapport.ok) process.exit(1);

// ---------------------------------------------------------------------------
function listerSources(dossier) {
  const res = [];
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    if (e.name === 'genere') continue;
    const f = `${dossier}/${e.name}`;
    if (e.isDirectory()) res.push(...listerSources(f));
    else if (/\.(astro|ts|js)$/.test(e.name)) res.push(f);
  }
  return res;
}

function construireTheme(t) {
  const presets = {
    lumineux: { fond: '#FFFFFF', fondAlt: '#F6F5F2', surface: '#FFFFFF', texte: '#1C1B19', texteDoux: '#5E5A55', bordure: '#E7E4DF', accent: '#2F6F62', sombre: false },
    chaleureux: { fond: '#FBF8F3', fondAlt: '#F3EDE3', surface: '#FFFFFF', texte: '#221E19', texteDoux: '#665E54', bordure: '#E8E0D4', accent: '#A84E28', sombre: false },
    'sombre-elegant': { fond: '#141311', fondAlt: '#1C1A17', surface: '#211F1B', texte: '#F2EDE5', texteDoux: '#B3AA9D', bordure: '#35312B', accent: '#D4B483', sombre: true },
  };
  const base = { ...presets[t.preset] };
  if (t.couleur_accent) base.accent = t.couleur_accent;
  const lum = (hex) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const contraste = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  const assombrir = (hex, f) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * f).toString(16).padStart(2, '0')).join('');
  const eclaircir = (hex, f) => '#' + [1, 3, 5].map((i) => { const v = parseInt(hex.slice(i, i + 2), 16); return Math.round(v + (255 - v) * f).toString(16).padStart(2, '0'); }).join('');
  // Texte sur bouton d'accent : blanc ou presque noir selon le meilleur contraste
  const surAccent = contraste(base.accent, '#FFFFFF') >= 4.5 ? '#FFFFFF' : '#1A1714';
  if (contraste(base.accent, surAccent) < 4.5) rapport.avertissement(`Thème : la couleur d'accent ${base.accent} offre un contraste faible avec le texte des boutons. Choisissez une couleur plus foncée ou plus claire.`);
  // Accent utilisé pour les liens sur le fond : assombri/éclairci jusqu'à 4,5:1
  let lien = base.accent, n = 0;
  while (contraste(lien, base.fond) < 4.5 && n++ < 30) lien = base.sombre ? eclaircir(lien, 0.08) : assombrir(lien, 0.92);
  const sombreAuto = !base.sombre && t.mode_sombre_auto ? (() => {
    let lienSombre = eclaircir(base.accent, 0.15), k = 0;
    while (contraste(lienSombre, '#151412') < 4.5 && k++ < 30) lienSombre = eclaircir(lienSombre, 0.1);
    return { fond: '#151412', fondAlt: '#1D1B18', surface: '#22201C', texte: '#F1ECE4', texteDoux: '#B5AC9F', bordure: '#37332D', accent: base.accent, lien: lienSombre, surAccent };
  })() : null;
  const polices = {
    titres: { fraunces: "'Fraunces Variable', Georgia, 'Times New Roman', serif", playfair: "'Playfair Display Variable', Georgia, serif", cormorant: "'Cormorant Garamond Variable', Georgia, serif" }[t.police_titres],
    texte: { inter: "'Inter Variable', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", systeme: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" }[t.police_texte],
  };
  const rayons = { aucun: ['0px', '0px', '0px'], petit: ['4px', '8px', '10px'], moyen: ['8px', '14px', '20px'], grand: ['12px', '22px', '30px'] }[t.arrondi];
  return { ...base, lien, surAccent, sombreAuto, polices, rayons, policeTitres: t.police_titres, policeTexte: t.police_texte, animations: t.animations };
}
