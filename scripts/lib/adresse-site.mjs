// Calcule l'adresse publique (origine + chemin de base) du site.
// Priorité : variable d'environnement SITE_URL (fournie automatiquement par
// le workflow GitHub Pages) > réglage « url » de config/site.yml >
// variable URL de Netlify > adresse locale de développement.
// C'est l'unique paramètre d'adresse : tout le reste en découle.

import { readFileSync, existsSync } from 'node:fs';
import YAML from 'yaml';
import { chemin } from './outils.mjs';

export function adresseSite() {
  let urlConfig = '';
  try {
    if (existsSync(chemin('config/site.yml'))) {
      urlConfig = String(YAML.parse(readFileSync(chemin('config/site.yml'), 'utf8'))?.url || '').trim();
    }
  } catch { /* l'erreur sera signalée par la validation */ }
  const brute = (process.env.SITE_URL || '').trim() || urlConfig || (process.env.URL || '').trim() || 'http://localhost:4321';
  let u;
  try { u = new URL(brute); } catch { u = new URL('http://localhost:4321'); }
  let base = u.pathname.replace(/\/+$/, '');
  if (!base.startsWith('/')) base = '/' + base;
  return {
    origine: u.origin,
    base: base === '/' ? '' : base,          // '' ou '/mon-depot'
    url: u.origin + (base === '/' ? '' : base), // sans barre finale
    source: process.env.SITE_URL ? 'SITE_URL' : urlConfig ? 'config' : process.env.URL ? 'URL' : 'local',
  };
}
