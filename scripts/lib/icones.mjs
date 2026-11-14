// Icônes Lucide (https://lucide.dev, licence ISC) : on extrait au build
// uniquement les icônes utilisées, à partir du paquet @lucide/astro.

import { readFileSync, existsSync } from 'node:fs';
import { chemin } from './outils.mjs';

const DOSSIER = chemin('node_modules', '@lucide', 'astro', 'src');
let alias = null;

function chargerAlias() {
  if (alias) return alias;
  alias = new Map();
  const f = `${DOSSIER}/aliases/aliases.ts`;
  if (existsSync(f)) {
    const t = readFileSync(f, 'utf8');
    for (const m of t.matchAll(/default as (\w+)\s*\}\s*from '\.\.\/icons\/([\w-]+)'/g)) {
      alias.set(kebab(m[1]), m[2]);
    }
  }
  return alias;
}

const kebab = (s) => String(s).replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').toLowerCase();

function fichierIcone(nom) {
  const n = kebab(String(nom).trim());
  if (existsSync(`${DOSSIER}/icons/${n}.ts`)) return `${DOSSIER}/icons/${n}.ts`;
  const cible = chargerAlias().get(n);
  if (cible && existsSync(`${DOSSIER}/icons/${cible}.ts`)) return `${DOSSIER}/icons/${cible}.ts`;
  return null;
}

export const iconeExiste = (nom) => !!fichierIcone(nom);

/** Retourne le contenu SVG (éléments enfants) d'une icône. */
export function svgIcone(nom) {
  const f = fichierIcone(nom);
  if (!f) return null;
  const t = readFileSync(f, 'utf8');
  const m = t.match(/const iconData: LucideIconData = (\{.*?\});/s);
  if (!m) return null;
  const data = JSON.parse(m[1]);
  return data.node
    .map(([balise, attrs]) => `<${balise} ${Object.entries(attrs).filter(([k]) => k !== 'key').map(([k, v]) => `${k}="${String(v).replace(/"/g, '&quot;')}"`).join(' ')}/>`)
    .join('');
}

/** Construit la table { nom: contenuSvg } pour une liste de noms. */
export function tableIcones(noms) {
  const table = {};
  for (const n of new Set(noms)) {
    const svg = svgIcone(n);
    if (svg) table[n] = svg;
  }
  return table;
}
