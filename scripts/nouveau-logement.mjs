#!/usr/bin/env node
// CRÉER UN LOGEMENT (utilisé par le workflow « Créer un logement »).
// Les réponses du formulaire arrivent en variables d'environnement.
// Copie les modèles prêts à l'emploi de content/_modeles (logement et, si
// besoin, adresse et destination) puis y reporte les réponses du formulaire.
// Aucune photo provisoire : le logement reste masqué jusqu'à sa photo 01.

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, appendFileSync } from 'node:fs';
import { chemin, slugifier, listerDossiers, lireMarkdown, relatif, suggestion } from './lib/outils.mjs';

const E = (k, d = '') => String(process.env[k] ?? d).trim();
const resume = [];
const erreur = (m) => { console.error(`❌ ${m}`); if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## ❌ Création impossible\n\n${m}\n`); process.exit(1); };
const nombre = (v, d) => (Number.isFinite(Number(v)) && String(v).trim() !== '' ? Number(v) : d);

/** Remplace la valeur d'un champ du modèle (première ligne « champ: … »), en gardant l'indentation et le commentaire. */
function fixer(texte, champ, valeur) {
  // [ \t] et non \s : ne jamais déborder sur la ligne suivante
  const motif = new RegExp(`^([ \\t]*${champ}:)([^\\n#]*?)([ \\t]+#[^\\n]*)?$`, 'm');
  if (!motif.test(texte)) throw new Error(`Champ « ${champ} » introuvable dans le modèle`);
  const v = typeof valeur === 'string' ? JSON.stringify(valeur) : String(valeur);
  return texte.replace(motif, (_, debut, _ancien, commentaire = '') => {
    const ligne = `${debut} ${v}`;
    return commentaire ? ligne.padEnd(Math.max(ligne.length + 1, 38)) + commentaire.trim() : ligne;
  });
}
const modele = (fichier) => readFileSync(chemin('content/_modeles', fichier), 'utf8');

const nom = E('NOM');
if (!nom) erreur('Le nom du logement est obligatoire.');

// --- Pays : réglages par défaut ---
const PAYS = {
  france: { code: 'FR', fuseau: 'Europe/Paris', devise: 'EUR', nom: 'France' },
  indonesie: { code: 'ID', fuseau: 'Asia/Makassar', devise: 'IDR', nom: 'Indonésie' },
  espagne: { code: 'ES', fuseau: 'Europe/Madrid', devise: 'EUR', nom: 'Espagne' },
  portugal: { code: 'PT', fuseau: 'Europe/Lisbon', devise: 'EUR', nom: 'Portugal' },
  italie: { code: 'IT', fuseau: 'Europe/Rome', devise: 'EUR', nom: 'Italie' },
  maroc: { code: 'MA', fuseau: 'Africa/Casablanca', devise: 'MAD', nom: 'Maroc' },
};
const paysSaisi = E('PAYS', 'France');
const pays = PAYS[slugifier(paysSaisi).replace(/-/g, '')] || { code: 'FR', fuseau: 'Europe/Paris', devise: 'EUR', nom: paysSaisi };
if (!PAYS[slugifier(paysSaisi).replace(/-/g, '')]) resume.push(`⚠️ Pays « ${paysSaisi} » non reconnu : vérifiez code_pays, fuseau_horaire et devise dans la fiche de l'adresse.`);

const types = ['studio', 'appartement', 'duplex', 'loft', 'maison', 'villa', 'chambre', 'gite', 'autre'];
const type = types.includes(E('TYPE')) ? E('TYPE') : 'appartement';

// --- Adresse (établissement) ---
const etabSaisi = E('ETABLISSEMENT');
if (!etabSaisi) erreur("L'adresse est obligatoire : dossier existant (ex. le-84) ou nom d'une nouvelle adresse (ex. Le 37).");
const etablissements = listerDossiers(chemin('content/etablissements'));
let etab = etablissements.includes(etabSaisi) ? etabSaisi : etablissements.find((e) => e === slugifier(etabSaisi));
if (etab) {
  resume.push(`Adresse existante utilisée : **${etab}**.`);
} else {
  etab = slugifier(etabSaisi);
  if (!etab) erreur(`Le nom d'adresse « ${etabSaisi} » ne permet pas de créer un dossier : utilisez des lettres et des chiffres.`);
  const proche = suggestion(etab, etablissements);
  if (proche && E('CONFIRMER_NOUVEL_ETABLISSEMENT', 'false') !== 'true') {
    erreur(`L'adresse « ${etabSaisi} » n'existe pas. Vouliez-vous dire « ${proche} » ? Relancez avec le bon nom, ou cochez « Nouvelle adresse : je confirme ».`);
  }
  // Destination
  const destSaisie = E('DESTINATION') || E('VILLE');
  if (!destSaisie) erreur("Nouvelle adresse : indiquez la destination (dossier existant comme « le-mans », ou nom d'une nouvelle ville/région).");
  const destinations = listerDossiers(chemin('content/destinations'));
  const destinationSlug = destinations.includes(destSaisie) ? destSaisie : slugifier(destSaisie);
  let lat = nombre(E('LATITUDE'), null), lng = nombre(E('LONGITUDE'), null);
  if (destinations.includes(destinationSlug)) {
    if (lat === null || lng === null) {
      const { donnees } = lireMarkdown(chemin('content/destinations', destinationSlug, 'index.md'));
      lat ??= donnees.latitude ?? null; lng ??= donnees.longitude ?? null;
      if (lat !== null) resume.push('⚠️ Coordonnées GPS de la destination utilisées provisoirement : corrigez latitude/longitude dans la fiche de l’adresse.');
    }
  } else {
    if (lat === null || lng === null) erreur('Nouvelle destination : indiquez la latitude et la longitude (Google Maps : clic droit sur le lieu > cliquer sur les coordonnées pour les copier).');
    let d = modele('destination/index.md');
    d = fixer(d, 'nom', destSaisie); d = fixer(d, 'pays', pays.nom); d = fixer(d, 'latitude', lat); d = fixer(d, 'longitude', lng);
    mkdirSync(chemin('content/destinations', destinationSlug), { recursive: true });
    writeFileSync(chemin('content/destinations', destinationSlug, 'index.md'), d);
    resume.push(`Nouvelle destination créée : **${destinationSlug}** (\`content/destinations/${destinationSlug}/index.md\`) — à compléter.`);
  }
  if (lat === null || lng === null) erreur("Indiquez la latitude et la longitude de la nouvelle adresse.");
  const typeLieu = ['villa', 'maison', 'appartement', 'chalet'].includes(type) ? type : 'immeuble';
  let t = modele('etablissement/index.md');
  t = fixer(t, 'nom', etabSaisi); t = fixer(t, 'type', typeLieu); t = fixer(t, 'destination', destinationSlug);
  t = fixer(t, 'ville', E('VILLE') || destSaisie); t = fixer(t, 'pays', pays.nom); t = fixer(t, 'code_pays', pays.code);
  t = fixer(t, 'latitude', lat); t = fixer(t, 'longitude', lng); t = fixer(t, 'fuseau_horaire', pays.fuseau);
  t = fixer(t, 'devise', pays.devise); t = fixer(t, 'arrondi_prix', pays.devise === 'IDR' ? 1000 : 1);
  if (pays.code !== 'FR') {
    // La taxe de séjour du modèle est celle du Mans : à revoir ailleurs
    t = fixer(t, 'code_postal', ''); t = fixer(t, 'region', '');
    t = t.replace(/^([ \t]+mode:[ \t]*)pourcentage\b/m, '$1aucune'); // taxe_sejour.mode (pas arrivee.mode)
    t = fixer(t, 'texte', 'À COMPLÉTER : taxe de séjour locale (voir docs/05)');
  } else if (destinationSlug !== 'le-mans') {
    t = fixer(t, 'texte', 'À COMPLÉTER : taxe de séjour de la commune (voir docs/05)');
    resume.push('⚠️ Taxe de séjour : le modèle reprend celle du Mans, vérifiez celle de la commune (docs/05).');
  }
  mkdirSync(chemin('content/etablissements', etab), { recursive: true });
  writeFileSync(chemin('content/etablissements', etab, 'index.md'), t);
  resume.push(`Nouvelle adresse créée : **${etab}** (\`content/etablissements/${etab}/index.md\`) — complétez l'adresse, les coordonnées GPS, les horaires et le texte.`);
}

// --- Logement : dossier = dossier de l'adresse + précision (convention) ---
const base = slugifier(E('DOSSIER') || nom);
if (!base) erreur(`Le nom « ${nom} » ne permet pas de créer un dossier : utilisez des lettres et des chiffres.`);
const slug = base === etab ? `${etab}-${type}` : base.startsWith(`${etab}-`) ? base : `${etab}-${base}`;
if (existsSync(chemin('content/logements', slug))) erreur(`Un logement « ${slug} » existe déjà (content/logements/${slug}). Choisissez un autre nom.`);

const surDemande = E('RESERVATION') === 'sur-demande';
const capacite = Math.max(1, Math.round(nombre(E('CAPACITE'), 2)));
const dossier = chemin('content/logements', slug);
let f = modele('logement/index.md');
f = fixer(f, 'nom', nom); f = fixer(f, 'etablissement', etab);
f = fixer(f, 'publie', E('PUBLIER', 'true') !== 'false'); f = fixer(f, 'ordre', (listerDossiers(chemin('content/logements')).length + 1) * 10);
f = fixer(f, 'type', type); f = fixer(f, 'reservation', surDemande ? 'sur-demande' : 'directe');
f = fixer(f, 'capacite', capacite); f = fixer(f, 'chambres', Math.max(0, Math.round(nombre(E('CHAMBRES'), type === 'studio' ? 0 : 1))));
f = fixer(f, 'prix_nuit', nombre(E('PRIX_NUIT'), 50));
if (surDemande) f = f.replace(/^calendriers:\n(?:[ \t]+.*\n)+/m, 'calendriers: []\n');
mkdirSync(`${dossier}/photos`, { recursive: true });
writeFileSync(`${dossier}/index.md`, f);
copyFileSync(chemin('content/_modeles/logement/photos/photos.yml'), `${dossier}/photos/photos.yml`);
const secret = slug.toUpperCase().replace(/-/g, '_');

const texte = [
  `## ✅ Logement « ${nom} » créé`, '',
  `- Fiche : \`content/logements/${slug}/index.md\``,
  `- Photos : \`content/logements/${slug}/photos/\` (vide pour l'instant : le logement reste masqué jusqu'à sa photo 01)`,
  `- Réservation : ${surDemande ? 'sur demande (pas de calendrier)' : 'directe (calendriers synchronisés)'}`,
  ...resume.map((r) => `- ${r}`), '',
  '### Prochaines étapes (docs/10)', '',
  `1. Ouvrez \`content/logements/${slug}/index.md\` et remplacez les « À COMPLÉTER » (résumé, description, équipements, prix).`,
  `2. Photos : ajoutez leurs lignes dans \`config/photos-a-importer.yml\` puis lancez « Importer les photos », ou déposez-les dans \`content/logements/${slug}/photos/\` (01 = couverture) avec leurs légendes dans \`photos.yml\` (docs/03).`,
  ...(surDemande ? [] : ['3. Créez les secrets des calendriers dans **Settings > Secrets and variables > Actions** (docs/04) :',
    `   - \`ICAL_${secret}_AIRBNB\``, `   - \`ICAL_${secret}_BOOKING\``]),
].join('\n');
console.log(texte);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, texte + '\n');
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `slug=${slug}\n`);
console.log(`\nFichiers créés dans ${relatif(dossier)}`);
