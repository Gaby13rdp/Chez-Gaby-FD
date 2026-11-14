#!/usr/bin/env node
// CRÉER UN LOGEMENT (utilisé par le workflow « Créer un logement »).
// Les réponses du formulaire arrivent en variables d'environnement.
// Crée content/logements/<nom>/ depuis le modèle (et, si besoin, un nouvel
// établissement et une nouvelle destination).

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, appendFileSync } from 'node:fs';
import { chemin, slugifier, listerDossiers, lireMarkdown, relatif, suggestion } from './lib/outils.mjs';

const E = (k, d = '') => String(process.env[k] ?? d).trim();
const resume = [];
const erreur = (m) => { console.error(`❌ ${m}`); if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## ❌ Création impossible\n\n${m}\n`); process.exit(1); };

const nom = E('NOM');
if (!nom) erreur('Le nom du logement est obligatoire.');
const slug = slugifier(nom);
if (!slug) erreur(`Le nom « ${nom} » ne permet pas de créer une adresse web : utilisez des lettres et des chiffres.`);
if (existsSync(chemin('content/logements', slug))) erreur(`Un logement « ${slug} » existe déjà (content/logements/${slug}). Choisissez un autre nom.`);

const remplir = (modele, valeurs) => readFileSync(chemin('content/_modeles', modele), 'utf8').replace(/\{\{(\w+)\}\}/g, (_, k) => (valeurs[k] ?? ''));
const nombre = (v, d) => (Number.isFinite(Number(v)) && String(v).trim() !== '' ? Number(v) : d);

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
if (!PAYS[slugifier(paysSaisi).replace(/-/g, '')]) resume.push(`⚠️ Pays « ${paysSaisi} » non reconnu : vérifiez code_pays, fuseau_horaire et devise dans la fiche de l'établissement.`);

// --- Établissement ---
const etabSaisi = E('ETABLISSEMENT');
if (!etabSaisi) erreur("L'établissement est obligatoire (dossier existant, ex. residence-cathedrale, ou nom d'un nouvel établissement).");
const etablissements = listerDossiers(chemin('content/etablissements'));
let etab = etablissements.includes(etabSaisi) ? etabSaisi : etablissements.find((e) => e === slugifier(etabSaisi));
let destinationSlug;
if (etab) {
  resume.push(`Établissement existant utilisé : **${etab}**.`);
} else {
  etab = slugifier(etabSaisi);
  const proche = suggestion(etab, etablissements);
  if (proche && E('CONFIRMER_NOUVEL_ETABLISSEMENT', 'false') !== 'true') {
    erreur(`L'établissement « ${etabSaisi} » n'existe pas. Vouliez-vous dire « ${proche} » ? Relancez avec le bon nom, ou cochez « Nouvel établissement : je confirme ».`);
  }
  // Destination
  const destSaisie = E('DESTINATION') || E('VILLE');
  if (!destSaisie) erreur("Nouvel établissement : indiquez la destination (dossier existant comme « le-mans », ou nom d'une nouvelle ville/région).");
  const destinations = listerDossiers(chemin('content/destinations'));
  destinationSlug = destinations.includes(destSaisie) ? destSaisie : slugifier(destSaisie);
  let lat = nombre(E('LATITUDE'), null), lng = nombre(E('LONGITUDE'), null);
  if (destinations.includes(destinationSlug)) {
    if (lat === null || lng === null) {
      const { donnees } = lireMarkdown(chemin('content/destinations', destinationSlug, 'index.md'));
      lat ??= donnees.latitude ?? null; lng ??= donnees.longitude ?? null;
      if (lat !== null) resume.push('⚠️ Coordonnées GPS de la destination utilisées provisoirement : corrigez latitude/longitude dans la fiche de l’établissement.');
    }
  } else {
    if (lat === null || lng === null) erreur('Nouvelle destination : indiquez la latitude et la longitude (Google Maps : clic droit sur le lieu > cliquer sur les coordonnées pour les copier).');
    mkdirSync(chemin('content/destinations', destinationSlug), { recursive: true });
    writeFileSync(chemin('content/destinations', destinationSlug, 'index.md'), remplir('destination/index.md', { nom: destSaisie, pays: pays.nom, latitude: lat, longitude: lng }));
    resume.push(`Nouvelle destination créée : **${destinationSlug}** (\`content/destinations/${destinationSlug}/index.md\`) — à compléter.`);
  }
  if (lat === null || lng === null) erreur('Indiquez la latitude et la longitude du nouvel établissement.');
  mkdirSync(chemin('content/etablissements', etab), { recursive: true });
  const type = ['villa', 'maison', 'appartement', 'chalet'].includes(E('TYPE')) ? (E('TYPE') === 'chalet' ? 'chalet' : E('TYPE')) : 'immeuble';
  writeFileSync(chemin('content/etablissements', etab, 'index.md'), remplir('etablissement/index.md', {
    nom: etabSaisi, type, destination: destinationSlug, ville: E('VILLE') || destSaisie, pays: pays.nom, code_pays: pays.code,
    latitude: lat, longitude: lng, fuseau: pays.fuseau, devise: pays.devise,
  }));
  resume.push(`Nouvel établissement créé : **${etab}** (\`content/etablissements/${etab}/index.md\`) — complétez l'adresse, les horaires et la taxe de séjour.`);
}

// --- Logement ---
const types = ['studio', 'appartement', 'duplex', 'loft', 'maison', 'villa', 'chambre', 'gite', 'autre'];
const type = types.includes(E('TYPE')) ? E('TYPE') : 'appartement';
const capacite = Math.max(1, Math.round(nombre(E('CAPACITE'), 2)));
const dossier = chemin('content/logements', slug);
mkdirSync(`${dossier}/photos`, { recursive: true });
const ordre = (listerDossiers(chemin('content/logements')).length + 1) * 10;
writeFileSync(`${dossier}/index.md`, remplir('logement/index.md', {
  nom, etablissement: etab, publie: E('PUBLIER', 'false') === 'true' ? 'true' : 'false', ordre, type,
  capacite, chambres: Math.max(0, Math.round(nombre(E('CHAMBRES'), type === 'studio' ? 0 : 1))),
  prix_nuit: nombre(E('PRIX_NUIT'), 100), secret: slug.toUpperCase().replace(/-/g, '_'),
}));
copyFileSync(chemin('content/_modeles/logement/photos/01-a-remplacer.jpg'), `${dossier}/photos/01-a-remplacer.jpg`);
copyFileSync(chemin('content/_modeles/logement/photos/photos.yml'), `${dossier}/photos/photos.yml`);
const secret = slug.toUpperCase().replace(/-/g, '_');

const texte = [
  `## ✅ Logement « ${nom} » créé`, '',
  `- Fiche : \`content/logements/${slug}/index.md\``,
  `- Photos : \`content/logements/${slug}/photos/\` (une photo provisoire « 01-a-remplacer.jpg » a été ajoutée)`,
  `- Publié : ${E('PUBLIER', 'false') === 'true' ? 'oui' : '**non** (passez `publie: true` quand la fiche est prête)'}`,
  ...resume.map((r) => `- ${r}`), '',
  '### Prochaines étapes', '',
  `1. Ouvrez \`content/logements/${slug}/index.md\` et complétez les lignes « À COMPLÉTER » (description, équipements, tarifs).`,
  `2. Déposez vos photos dans \`content/logements/${slug}/photos/\` (01 = couverture), supprimez « 01-a-remplacer.jpg » et complétez \`photos.yml\` (docs/03).`,
  '3. Créez les secrets des calendriers dans **Settings > Secrets and variables > Actions** (docs/04) :',
  `   - \`ICAL_${secret}_AIRBNB\``, `   - \`ICAL_${secret}_BOOKING\``, `   - \`ICAL_${secret}_DIRECT\` (calendrier maître Google Agenda)`,
  '4. Passez `publie: true` pour afficher le logement sur le site.',
].join('\n');
console.log(texte);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, texte + '\n');
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `slug=${slug}\n`);
console.log(`\nFichiers créés dans ${relatif(dossier)}`);
