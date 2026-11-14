#!/usr/bin/env node
// SYNCHRONISATION DES CALENDRIERS (Airbnb, Booking, Google Agenda…)
// ---------------------------------------------------------------------------
// • Les liens iCal sont lus dans les secrets GitHub (fichier temporaire
//   SECRETS_FICHIER préparé par le workflow, limité aux secrets ICAL_…) —
//   ils ne sont JAMAIS écrits dans le dépôt.
// • Seules les dates bloquées sont enregistrées (donnees/disponibilites.json) :
//   aucun nom, aucune description, aucun numéro de réservation.
// • Si un calendrier ne répond pas, les dernières données valides sont
//   conservées (par prudence, les anciennes dates restent bloquées).
// Options : --forcer (republie même sans changement), --simulation (n'écrit rien).
// Pour tester en local : ICAL_STUDIO_CATHEDRALE_AIRBNB="https://…" npm run synchro

import { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { chemin, lireMarkdown, lireYaml, listerDossiers } from './lib/outils.mjs';
import { plagesDepuisIcal } from '../src/lib/partage/ical.js';
import { fusionnerPlages, bornerPlages } from '../src/lib/partage/disponibilites.js';
import { aujourdhui, ajouterMois } from '../src/lib/partage/dates.js';

const forcer = process.argv.includes('--forcer');
const simulation = process.argv.includes('--simulation');
const MAINTENANT = new Date();
const FICHIER = process.env.SYNCHRO_FICHIER || chemin('donnees/disponibilites.json');
const SEUIL_ALERTE_H = 24;

const config = (() => { try { return lireYaml(chemin('config/site.yml')); } catch { return {}; } })();
const republierH = Number(config?.synchronisation?.republier_toutes_les_heures ?? 4);
const horizonMois = Number(config?.sejour?.horizon_mois ?? 18);

let secrets = {};
try {
  // Fichier temporaire préparé par le workflow (uniquement les secrets ICAL_…), ou variable SECRETS_JSON (tests).
  const brut = process.env.SECRETS_FICHIER && existsSync(process.env.SECRETS_FICHIER) ? readFileSync(process.env.SECRETS_FICHIER, 'utf8') : process.env.SECRETS_JSON || '{}';
  secrets = JSON.parse(brut || '{}');
} catch { console.log('⚠️  Liste des secrets illisible : seuls les secrets passés en variables d’environnement seront utilisés.'); }
const lireSecret = (nom) => (secrets[nom] || process.env[nom] || '').trim();

const precedent = (() => {
  if (!existsSync(FICHIER)) return { logements: {} };
  try { return JSON.parse(readFileSync(FICHIER, 'utf8')); } catch { return { logements: {} }; }
})();

// Établissements : fuseau horaire et heures d'arrivée / de départ
const etablissements = {};
for (const slug of listerDossiers(chemin('content/etablissements'))) {
  try {
    const { donnees } = lireMarkdown(chemin('content/etablissements', slug, 'index.md'));
    etablissements[slug] = {
      fuseau: donnees.fuseau_horaire || 'Europe/Paris',
      heureArrivee: donnees.arrivee?.heure_arrivee || '16:00',
      heureDepart: donnees.arrivee?.heure_depart || '11:00',
    };
  } catch { /* établissement illisible : valeurs par défaut */ }
}

async function telecharger(url) {
  let derniere;
  for (const attente of [0, 3000, 8000]) {
    if (attente) await new Promise((r) => setTimeout(r, attente));
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': 'site-reservation-directe/1.0 (synchronisation iCal)', Accept: 'text/calendar, text/plain;q=0.9, */*;q=0.5' },
        redirect: 'follow', signal: AbortSignal.timeout(25000),
      });
      if (!r.ok) {
        derniere = new Error(r.status === 404 || r.status === 410 ? `le calendrier n'existe plus (HTTP ${r.status}) : le lien a peut-être été régénéré, mettez à jour le secret`
          : r.status === 401 || r.status === 403 ? `accès refusé (HTTP ${r.status}) : lien invalide ou expiré`
          : r.status === 429 ? 'trop de requêtes (HTTP 429) : la plateforme limite temporairement l’accès'
          : `erreur HTTP ${r.status}`);
        if (r.status < 500 && r.status !== 429) break;
        continue;
      }
      const texte = await r.text();
      if (texte.length > 8_000_000) throw new Error('calendrier anormalement volumineux');
      return texte;
    } catch (e) {
      derniere = e.name === 'TimeoutError' ? new Error('pas de réponse après 25 secondes') : e;
    }
  }
  throw derniere;
}

const resultat = { version: 1, genereLe: MAINTENANT.toISOString(), publieLe: precedent.publieLe || null, logements: {} };
const lignesResume = [];
let alerte = false;
let nbSources = 0, nbErreurs = 0;

console.log('Synchronisation des calendriers…\n');
for (const slug of listerDossiers(chemin('content/logements'))) {
  let d;
  try { ({ donnees: d } = lireMarkdown(chemin('content/logements', slug, 'index.md'))); } catch (e) { console.log(`✗ ${slug} : fiche illisible (${e.message})`); continue; }
  if (d.publie === false) continue;
  const etab = etablissements[String(d.etablissement || '').split('/').filter(Boolean).pop()] || { fuseau: 'Europe/Paris', heureArrivee: '16:00', heureDepart: '11:00' };
  const today = aujourdhui(etab.fuseau, MAINTENANT.getTime());
  const limite = ajouterMois(today, horizonMois + 1);
  const prec = precedent.logements?.[slug];
  const sources = (Array.isArray(d.calendriers) ? d.calendriers : []).map((c) => ({
    nom: String(c.nom || c.type || 'Calendrier'),
    secret: String(c.secret || `ICAL_${slug.toUpperCase().replace(/-/g, '_')}_${String(c.type || 'autre').toUpperCase().replace(/-/g, '_')}`),
  }));
  const configurees = sources.filter((s) => lireSecret(s.secret));
  const absentes = sources.filter((s) => !lireSecret(s.secret));

  if (!configurees.length) {
    resultat.logements[slug] = { statut: 'non-configure', verifieLe: null, plages: [] };
    const msg = sources.length ? `secret(s) absent(s) : ${absentes.map((s) => s.secret).join(', ')}` : 'aucun calendrier déclaré';
    console.log(`○ ${slug} : non synchronisé (${msg})`);
    lignesResume.push(`| ${slug} | non configuré | — | ${msg} |`);
    continue;
  }

  const plages = [];
  const erreurs = [];
  const avertissements = [];
  for (const s of configurees) {
    nbSources++;
    try {
      const texte = await telecharger(lireSecret(s.secret));
      const r = plagesDepuisIcal(texte, { fuseau: etab.fuseau, heureArrivee: etab.heureArrivee, heureDepart: etab.heureDepart });
      plages.push(...r.plages);
      for (const a of r.avertissements) avertissements.push(`${s.nom} : ${a}`);
      console.log(`  ✓ ${slug} / ${s.nom} : ${r.nombre} événement(s)`);
    } catch (e) {
      nbErreurs++;
      erreurs.push(`${s.nom} : ${e.message}`);
      console.log(`  ✗ ${slug} / ${s.nom} : ${e.message}`);
      if (process.env.GITHUB_ACTIONS) console.log(`::warning::Calendrier « ${s.nom} » du logement « ${slug} » : ${e.message}`);
    }
  }
  for (const a of avertissements) {
    console.log(`  ⚠ ${slug} / ${a}`);
    if (process.env.GITHUB_ACTIONS) console.log(`::notice::${slug} — ${a}`);
  }
  const notes = absentes.map((s) => `${s.nom} ignoré (secret ${s.secret} absent)`);
  for (const n of notes) console.log(`  ⚠ ${slug} / ${n}`);

  let entree;
  if (!erreurs.length) {
    entree = { statut: 'ok', verifieLe: MAINTENANT.toISOString(), plages: bornerPlages(plages, today, limite) };
  } else if (erreurs.length < configurees.length) {
    // Une partie des calendriers a répondu : on ajoute par prudence les dates connues auparavant
    const anciennes = prec?.plages || [];
    entree = { statut: 'partiel', verifieLe: prec?.verifieLe || null, plages: bornerPlages(fusionnerPlages([...plages, ...anciennes]), today, limite) };
  } else {
    entree = { statut: 'erreur', verifieLe: prec?.verifieLe || null, plages: bornerPlages(prec?.plages || [], today, limite) };
  }
  if (entree.statut !== 'ok') {
    const age = entree.verifieLe ? (MAINTENANT - new Date(entree.verifieLe)) / 3600000 : Infinity;
    if (age > SEUIL_ALERTE_H) alerte = true;
  }
  resultat.logements[slug] = entree;
  lignesResume.push(`| ${slug} | ${entree.statut} | ${entree.plages.length} | ${[...erreurs, ...notes].join(' ; ') || 'ok'} |`);
}

// Changement réel ? (on ignore les dates de vérification)
const empreinte = (o) => JSON.stringify(Object.entries(o.logements || {}).sort().map(([k, v]) => [k, v.statut, v.plages]));
const changement = empreinte(resultat) !== empreinte(precedent);
const ageMax = republierH > 0 && precedent.publieLe ? (MAINTENANT - new Date(precedent.publieLe)) / 3600000 : Infinity;
const publier = forcer || changement || !precedent.publieLe || (republierH > 0 && ageMax >= republierH - 0.25);

if (publier && !simulation) {
  resultat.publieLe = MAINTENANT.toISOString();
  mkdirSync(dirname(FICHIER), { recursive: true });
  writeFileSync(FICHIER, JSON.stringify(resultat, null, 1) + '\n');
}

const bilan = `${nbSources} calendrier(s) interrogé(s), ${nbErreurs} erreur(s). Changement des disponibilités : ${changement ? 'oui' : 'non'}. Publication : ${publier ? 'oui' : 'non'}${simulation ? ' (simulation : rien n’est écrit)' : ''}.`;
console.log('\n' + bilan);
if (alerte) console.log(`\n⚠️  Au moins un calendrier n'a pas pu être synchronisé depuis plus de ${SEUIL_ALERTE_H} h : vérifiez les liens iCal (docs/04, docs/09).`);

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `changement=${changement ? 'oui' : 'non'}\npublier=${publier && !simulation ? 'oui' : 'non'}\nalerte=${alerte ? 'oui' : 'non'}\n`);
}
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, [
    '## 📅 Synchronisation des calendriers', '', bilan, '',
    '| Logement | État | Plages bloquées | Détail |', '|---|---|---|---|', ...lignesResume, '',
    alerte ? `> ⚠️ Un calendrier ne répond plus depuis plus de ${SEUIL_ALERTE_H} h. Le site affiche « Disponibilités à confirmer » pour ce logement. Voir docs/09-depannage.md.` : '',
  ].join('\n') + '\n');
}
