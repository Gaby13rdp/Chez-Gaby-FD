// Tests des messages de validation (en français, avec suggestions).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, cpSync, symlinkSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { valider } from '../scripts/lib/validation.mjs';
import { schemaLogement } from '../scripts/lib/schemas.mjs';
import { Rapport } from '../scripts/lib/rapport.mjs';

const executer = promisify(execFile);
const RACINE = new URL('..', import.meta.url).pathname;

function verifier(donnees) {
  const rapport = new Rapport();
  const res = valider(donnees, schemaLogement, { rapport, quoi: 'Logement « test »', equipements: ['wifi', 'parking'], references: { etablissements: ['residence-cathedrale'] } });
  return { res, erreurs: rapport.erreurs.map((e) => e.message).join('\n'), avertissements: rapport.avertissements.map((e) => e.message).join('\n') };
}
const minimal = { nom: 'Test', etablissement: 'residence-cathedrale', resume: 'Résumé', capacite: 2, tarifs: { prix_nuit: 80 } };

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
  assert.match(verifier({ ...minimal, etablissement: 'residence-cathedral' }).erreurs, /Vouliez-vous dire « residence-cathedrale » \?/);
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

test('build : logement sans photo -> erreur claire et build refusé', async () => {
  const dossier = mkdtempSync(join(tmpdir(), 'site-'));
  for (const d of ['config', 'content', 'scripts', 'src', 'donnees', 'package.json']) cpSync(join(RACINE, d), join(dossier, d), { recursive: true });
  symlinkSync(join(RACINE, 'node_modules'), join(dossier, 'node_modules'));
  rmSync(join(dossier, 'content/logements/studio-tesse/photos'), { recursive: true, force: true });
  const fiche = join(dossier, 'content/logements/studio-jacobins/index.md');
  writeFileSync(fiche, readFileSync(fiche, 'utf8').replace('capacite: 3', 'capacite: trois'));
  try {
    await executer(process.execPath, ['scripts/preparer.mjs', '--validation-seule'], { cwd: dossier, env: { ...process.env, GITHUB_ACTIONS: '', GITHUB_STEP_SUMMARY: '' } });
    assert.fail('le build aurait dû échouer');
  } catch (e) {
    assert.equal(e.code, 1);
    assert.match(e.stdout, /Le logement « studio-tesse » n'a pas de photo de couverture/);
    assert.match(e.stdout, /« Voyageurs maximum » \(capacite\) doit être un nombre \(reçu : « trois » \)|doit être un nombre \(reçu : « trois »\)/);
    assert.match(e.stdout, /Le site n’a PAS été mis à jour/);
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
});
