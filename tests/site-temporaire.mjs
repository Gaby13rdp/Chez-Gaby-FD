// Aide aux tests : construit un site temporaire avec les contenus FICTIFS de
// tests/fixtures/contenu (jamais vos vrais logements), pour que les tests ne
// dépendent pas de ce que vous publiez.
import { mkdtempSync, cpSync, symlinkSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const RACINE = new URL('..', import.meta.url).pathname;

export function siteTemporaire() {
  const dossier = mkdtempSync(join(tmpdir(), 'site-'));
  for (const d of ['config', 'scripts', 'src', 'donnees', 'package.json']) cpSync(join(RACINE, d), join(dossier, d), { recursive: true });
  for (const d of ['pages', '_modeles']) cpSync(join(RACINE, 'content', d), join(dossier, 'content', d), { recursive: true });
  for (const d of ['destinations', 'etablissements', 'logements']) cpSync(join(RACINE, 'tests/fixtures/contenu', d), join(dossier, 'content', d), { recursive: true });
  for (const d of ['avis', 'medias', 'guides-locaux']) mkdirSync(join(dossier, 'content', d), { recursive: true });
  symlinkSync(join(RACINE, 'node_modules'), join(dossier, 'node_modules'));
  return { dossier, nettoyer: () => rmSync(dossier, { recursive: true, force: true }) };
}
