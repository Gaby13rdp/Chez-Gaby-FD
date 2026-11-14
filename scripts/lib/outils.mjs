// Outils génériques utilisés par les scripts (aucune dépendance externe).

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

export const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const chemin = (...morceaux) => join(RACINE, ...morceaux);

/** Transforme un texte en identifiant d'URL : "Studio Cathédrale" -> "studio-cathedrale". */
export function slugifier(texte) {
  return String(texte ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[œ]/g, 'oe').replace(/[æ]/g, 'ae')
    .toLowerCase()
    .replace(/['’]/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Fusion profonde : les valeurs de `source` remplacent celles de `base` (tableaux remplacés). */
export function fusionner(base, source) {
  if (!estObjet(base)) return source === undefined ? base : source;
  const resultat = { ...base };
  if (!estObjet(source)) return resultat;
  for (const [cle, valeur] of Object.entries(source)) {
    if (valeur === undefined) continue;
    resultat[cle] = estObjet(valeur) && estObjet(base[cle]) ? fusionner(base[cle], valeur) : valeur;
  }
  return resultat;
}

/** Distance de Levenshtein (pour proposer « Vouliez-vous dire … ? »). */
export function distance(a, b) {
  a = String(a); b = String(b);
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[m][n];
}

/** Retourne la valeur la plus proche dans une liste, si elle est suffisamment proche. */
export function suggestion(valeur, possibles) {
  const v = slugifier(valeur);
  let meilleure = null, score = Infinity;
  for (const p of possibles) {
    const s = distance(v, slugifier(p));
    if (s < score) { score = s; meilleure = p; }
  }
  if (meilleure === null) return null;
  const tolerance = Math.max(2, Math.floor(String(meilleure).length / 3));
  return score <= tolerance ? meilleure : null;
}

/** Lit un fichier YAML. Lève une erreur en français si la syntaxe est invalide. */
export function lireYaml(fichier) {
  const texte = readFileSync(fichier, 'utf8');
  return analyserYaml(texte, fichier);
}

export function analyserYaml(texte, fichier = '') {
  try {
    const doc = YAML.parseDocument(texte, { prettyErrors: true, uniqueKeys: true });
    if (doc.errors.length) throw doc.errors[0];
    return doc.toJS({ maxAliasCount: 50 }) ?? {};
  } catch (e) {
    const ligne = e.linePos?.[0]?.line;
    throw new ErreurContenu(
      `Le fichier « ${relatif(fichier)} » contient une erreur de mise en forme${ligne ? ` à la ligne ${ligne}` : ''}. ` +
      `Vérifiez les espaces en début de ligne, les deux-points « : » et les guillemets. (Détail : ${traduireErreurYaml(e.message)})`,
      fichier
    );
  }
}

function traduireErreurYaml(message = '') {
  const premiere = String(message).split('\n')[0];
  if (/Map keys must be unique/i.test(premiere)) return 'un même champ est écrit deux fois';
  if (/Implicit map keys need to be followed by map values/i.test(premiere)) return 'il manque probablement « : » après un nom de champ';
  if (/Nested mappings are not allowed in compact mappings/i.test(premiere)) return 'un texte contenant « : » doit être mis entre guillemets';
  if (/Missing closing "quote/i.test(premiere)) return 'un guillemet n’est pas refermé';
  if (/bad indentation|Indentation/i.test(premiere)) return 'décalage (indentation) incorrect';
  if (/tab/i.test(premiere)) return 'une tabulation est utilisée au lieu d’espaces';
  return premiere;
}

/** Sépare l'en-tête (front matter) YAML du corps Markdown. */
export function lireMarkdown(fichier) {
  const texte = readFileSync(fichier, 'utf8').replace(/^﻿/, '');
  const m = texte.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/);
  if (!m) {
    if (texte.trimStart().startsWith('---')) {
      throw new ErreurContenu(
        `Le fichier « ${relatif(fichier)} » commence par « --- » mais l'en-tête n'est pas refermé par une seconde ligne « --- ».`,
        fichier
      );
    }
    return { donnees: {}, corps: texte };
  }
  const donnees = analyserYaml(m[1], fichier);
  if (!estObjet(donnees)) {
    throw new ErreurContenu(`L'en-tête du fichier « ${relatif(fichier)} » doit être une liste de champs « nom: valeur ».`, fichier);
  }
  return { donnees, corps: m[2] ?? '' };
}

export class ErreurContenu extends Error {
  constructor(message, fichier) {
    super(message);
    this.fichier = fichier;
  }
}

export const relatif = (f) => String(f || '').replace(RACINE + '/', '').replace(RACINE, '.');

export function listerDossiers(dossier) {
  if (!existsSync(dossier)) return [];
  return readdirSync(dossier, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.'))
    .map((d) => d.name)
    .sort();
}

export function listerFichiers(dossier, extensions) {
  if (!existsSync(dossier)) return [];
  return readdirSync(dossier, { withFileTypes: true })
    .filter((d) => d.isFile() && !d.name.startsWith('.') && !d.name.startsWith('_'))
    .map((d) => d.name)
    .filter((n) => !extensions || extensions.includes(n.split('.').pop().toLowerCase()))
    .sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
}

export const existe = (f) => existsSync(f);
export const taille = (f) => statSync(f).size;

/** Formatte une liste pour un message : « a », « b » et « c ». */
export function enumerer(liste) {
  const l = liste.map((x) => `« ${x} »`);
  if (l.length <= 1) return l.join('');
  return `${l.slice(0, -1).join(', ')} et ${l.at(-1)}`;
}
