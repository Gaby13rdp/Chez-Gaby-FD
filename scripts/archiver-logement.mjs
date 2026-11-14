#!/usr/bin/env node
// ARCHIVER OU SUPPRIMER UN LOGEMENT (workflow « Archiver ou supprimer un logement »).
//  • ACTION=masquer   : passe « publie: false » (rien n'est effacé, réversible).
//  • ACTION=supprimer : efface le dossier (photos comprises) — exige CONFIRMATION=SUPPRIMER.
//  • REDIRIGER=true   : l'ancienne adresse renvoie vers l'établissement ou la destination.

import { readFileSync, writeFileSync, existsSync, rmSync, appendFileSync } from 'node:fs';
import YAML from 'yaml';
import { chemin, slugifier, listerDossiers, listerFichiers, lireMarkdown, suggestion } from './lib/outils.mjs';

const E = (k, d = '') => String(process.env[k] ?? d).trim();
const fin = (titre, texte, code = 0) => {
  console.log(`${titre}\n${texte}`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## ${titre}\n\n${texte}\n`);
  process.exit(code);
};

const saisi = E('LOGEMENT');
const logements = listerDossiers(chemin('content/logements'));
const slug = logements.includes(saisi) ? saisi : slugifier(saisi);
if (!logements.includes(slug)) {
  const s = suggestion(slug, logements);
  fin('❌ Logement introuvable', `Aucun dossier « content/logements/${slug} ».${s ? ` Vouliez-vous dire « ${s} » ?` : ''}\n\nLogements existants : ${logements.join(', ')}`, 1);
}
const action = E('ACTION', 'masquer');
const fichier = chemin('content/logements', slug, 'index.md');

// Adresse actuelle et cible de redirection
const { donnees } = lireMarkdown(fichier);
const etabSlug = String(donnees.etablissement || '').split('/').filter(Boolean).pop();
let destination = '';
try { destination = lireMarkdown(chemin('content/etablissements', etabSlug, 'index.md')).donnees.destination || ''; } catch { /* ignoré */ }
const autresDuMemeEtab = logements.filter((l) => l !== slug && (() => { try { const d = lireMarkdown(chemin('content/logements', l, 'index.md')).donnees; return d.etablissement === etabSlug && d.publie !== false; } catch { return false; } })());
const de = `/logements/${destination}/${slug}/`;
const vers = autresDuMemeEtab.length >= 2 ? `/logements/${destination}/${etabSlug}/` : destination ? `/logements/${destination}/` : '/logements/';

function ajouterRedirection() {
  if (E('REDIRIGER', 'true') !== 'true' || !destination) return '';
  const f = chemin('config/redirections.yml');
  const doc = existsSync(f) ? YAML.parseDocument(readFileSync(f, 'utf8')) : YAML.parseDocument('redirections: []\n');
  const liste = doc.get('redirections') || doc.createNode([]);
  liste.flow = false;
  const deja = (liste.items || []).some((i) => i?.get?.('de') === de);
  if (!deja) {
    const element = doc.createNode({ de, vers });
    element.flow = false;
    liste.add(element);
    doc.set('redirections', liste);
    writeFileSync(f, doc.toString());
  }
  return `\n- L'ancienne adresse \`${de}\` redirige désormais vers \`${vers}\` (fichier config/redirections.yml).`;
}

if (action === 'masquer') {
  const texte = readFileSync(fichier, 'utf8');
  const nouveau = /^publie:\s*\S+/m.test(texte) ? texte.replace(/^publie:\s*\S+/m, 'publie: false') : texte.replace(/^---\r?\n/, '---\npublie: false\n');
  writeFileSync(fichier, nouveau);
  const r = ajouterRedirection();
  fin(`✅ Logement « ${slug} » masqué`, `- \`publie: false\` dans \`content/logements/${slug}/index.md\`. Rien n'est effacé : remettez \`publie: true\` pour le réafficher.${r}\n- Pensez à vider ou bloquer ses calendriers Airbnb/Booking si vous ne le louez plus.`);
}

if (action === 'supprimer') {
  if (E('CONFIRMATION') !== 'SUPPRIMER') {
    fin('❌ Suppression non confirmée', 'Pour supprimer définitivement, tapez exactement **SUPPRIMER** (en majuscules) dans le champ de confirmation. Rien n’a été modifié.', 1);
  }
  rmSync(chemin('content/logements', slug), { recursive: true, force: true });
  const r = ajouterRedirection();
  // Les avis qui citaient ce logement sont dépubliés (et non effacés)
  const avisModifies = [];
  for (const f of listerFichiers(chemin('content/avis'), ['md'])) {
    const t = readFileSync(chemin('content/avis', f), 'utf8');
    if (new RegExp(`^logement:\\s*["']?${slug}["']?\\s*$`, 'm').test(t)) {
      writeFileSync(chemin('content/avis', f), t.replace(new RegExp(`^logement:.*$`, 'm'), 'logement: ""').replace(/^publie:.*$/m, 'publie: false'));
      avisModifies.push(f);
    }
  }
  fin(`🗑️ Logement « ${slug} » supprimé`, `- Le dossier \`content/logements/${slug}\` (fiche et photos) a été effacé. Il reste récupérable dans l'historique Git (onglet « Commits »).${r}\n${avisModifies.length ? `\n- Avis dépubliés car ils citaient ce logement : ${avisModifies.join(', ')}.` : ''}\n- Supprimez aussi les secrets \`ICAL_${slug.toUpperCase().replace(/-/g, '_')}_…\` devenus inutiles.`);
}

fin('❌ Action inconnue', `Action « ${action} » : choisissez « masquer » ou « supprimer ».`, 1);
