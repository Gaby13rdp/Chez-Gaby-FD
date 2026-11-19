// Tests des messages de validation (en français, avec suggestions).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { valider } from '../scripts/lib/validation.mjs';
import { schemaLogement } from '../scripts/lib/schemas.mjs';
import { Rapport } from '../scripts/lib/rapport.mjs';

import { siteTemporaire } from './site-temporaire.mjs';

const executer = promisify(execFile);

function verifier(donnees) {
  const rapport = new Rapport();
  const res = valider(donnees, schemaLogement, { rapport, quoi: 'Logement « test »', equipements: ['wifi', 'parking'], references: { etablissements: ['immeuble-test'] } });
  return { res, erreurs: rapport.erreurs.map((e) => e.message).join('\n'), avertissements: rapport.avertissements.map((e) => e.message).join('\n') };
}
const minimal = { nom: 'Test', etablissement: 'immeuble-test', resume: 'Résumé', capacite: 2, tarifs: { prix_nuit: 80 } };

test('champ obligatoire manquant', () => {
  const { erreurs } = verifier({ ...minimal, nom: undefined });
  assert.match(erreurs, /le champ « Nom du logement » \(nom\) est obligatoire/);
});

test('nombre mal écrit', () => {
  assert.match(verifier({ ...minimal, capacite: 'deux' }).erreurs, /« Voyageurs maximum » \(capacite\) doit être un nombre/);
  assert.equal(verifier({ ...minimal, tarifs: { prix_nuit: '82,50' } }).res.tarifs.prix_nuit, 82.5);
});

test('faute de frappe dans un nom de champ : suggestion', () => {
  assert.match(verifier({ ...minimal, capcite: 3 }).avertissements, /champ inconnu « capcite » ignoré\. Vouliez-vous dire « capacite » \?/);
});

test('valeur de liste inconnue : suggestion et valeurs possibles', () => {
  assert.match(verifier({ ...minimal, equipements: ['wiif'] }).erreurs, /valeur inconnue « wiif »\. Vouliez-vous dire « wifi » \?/);
  assert.equal(verifier({ ...minimal, type: 'Studio' }).res.type, 'studio');
});

test('référence à un établissement inexistant', () => {
  assert.match(verifier({ ...minimal, etablissement: 'immeuble-tes' }).erreurs, /Vouliez-vous dire « immeuble-test » \?/);
});

test('un lien iCal collé à la place du nom de secret est refusé', () => {
  assert.match(verifier({ ...minimal, calendriers: [{ nom: 'Airbnb', type: 'airbnb', secret: 'https://www.airbnb.fr/calendar/ical/123.ics?s=abc' }] }).erreurs, /Ne collez JAMAIS le lien iCal ici/);
});

test('valeurs par défaut appliquées', () => {
  const { res } = verifier(minimal);
  assert.equal(res.publie, true);
  assert.equal(res.regles.animaux, 'non');
  assert.equal(res.annulation.modele, 'moderee');
  assert.deepEqual(res.tarifs.supplement_weekend.nuits, ['vendredi', 'samedi']);
});

const env = { ...process.env, GITHUB_ACTIONS: '', GITHUB_STEP_SUMMARY: '' };

test('build : logement sans photo -> simplement masqué, le site se construit', async () => {
  const { dossier, nettoyer } = siteTemporaire();
  try {
    const { stdout } = await executer(process.execPath, ['scripts/preparer.mjs', '--validation-seule'], { cwd: dossier, env });
    assert.match(stdout, /Le logement « immeuble-test-studio-3 » n'a pas encore de photo : il reste masqué/);
  } finally {
    nettoyer();
  }
});

test('build : aucun logement avec photo + erreur de saisie -> messages clairs et build refusé', async () => {
  const { dossier, nettoyer } = siteTemporaire();
  for (const l of ['immeuble-test-studio-1', 'immeuble-test-studio-2', 'maison-test-villa']) rmSync(join(dossier, 'content/logements', l, 'photos'), { recursive: true, force: true });
  const fiche = join(dossier, 'content/logements/immeuble-test-studio-2/index.md');
  writeFileSync(fiche, readFileSync(fiche, 'utf8').replace('capacite: 3', 'capacite: trois'));
  try {
    await executer(process.execPath, ['scripts/preparer.mjs', '--validation-seule'], { cwd: dossier, env });
    assert.fail('le build aurait dû échouer');
  } catch (e) {
    assert.equal(e.code, 1);
    assert.match(e.stdout, /Aucun logement visible : 4 logement\(s\) publié\(s\) attendent encore leurs photos/);
    assert.match(e.stdout, /doit être un nombre \(reçu : « trois » ?\)/);
    assert.match(e.stdout, /Le site n’a PAS été mis à jour/);
  } finally {
    nettoyer();
  }
});

test('build : pages d’adresse automatiques et réservation sur demande', async () => {
  const { dossier, nettoyer } = siteTemporaire();
  try {
    const { stdout } = await executer(process.execPath, ['scripts/preparer.mjs'], { cwd: dossier, env, timeout: 120000 });
    assert.match(stdout, /réservation « sur-demande », ses calendriers iCal sont ignorés/);
    const D = JSON.parse(readFileSync(join(dossier, 'src/genere/donnees.json'), 'utf8'));
    const etab = (s) => D.etablissements.find((e) => e.slug === s);
    // Adresse à 2 logements visibles : une page ; adresse à 1 logement : pas de page en double
    assert.deepEqual(etab('immeuble-test').logements, ['immeuble-test-studio-1', 'immeuble-test-studio-2']);
    assert.equal(etab('immeuble-test').aUnePage, true);
    assert.equal(etab('maison-test').aUnePage, false);
    assert.ok(D.routes.some((r) => r.type === 'etablissement' && r.id === 'immeuble-test'));
    assert.ok(!D.routes.some((r) => r.type === 'etablissement' && r.id === 'maison-test'));
    // La destination liste automatiquement ses deux adresses
    assert.deepEqual(D.destinations.find((d) => d.slug === 'ville-test').etablissements, ['immeuble-test', 'maison-test']);
    // Logement sans photo : absent du site
    assert.ok(!D.logements.some((l) => l.slug === 'immeuble-test-studio-3'));
    // Sur demande : pas de calendrier, pas de dates bloquées
    const villa = D.logements.find((l) => l.slug === 'maison-test-villa');
    assert.equal(villa.reservation, 'sur-demande');
    assert.equal(villa.disponibilites.statut, 'sur-demande');
    assert.deepEqual(villa.disponibilites.plages, []);
    assert.equal(D.logements.find((l) => l.slug === 'immeuble-test-studio-2').reservation, 'directe');
  } finally {
    nettoyer();
  }
});
