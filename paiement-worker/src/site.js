// Lecture des données PUBLIQUES du site (tarifs et dates bloquées publiés).
// Le service ne fait jamais confiance aux montants envoyés par le navigateur :
// il recalcule tout à partir de ces fichiers, produits lors de la publication.

import { ErreurPublique, adresseSite, fetchDelai } from './outils.js';

const memoire = new Map(); // petit cache en mémoire (quelques secondes à quelques minutes)

export async function donneesSite(env, fichier, ttlSecondes = 120) {
  const url = `${adresseSite(env)}/donnees/${fichier}`;
  const deja = memoire.get(url);
  if (deja && deja.expire > Date.now()) return deja.valeur;
  let r;
  try {
    r = await fetchDelai(url, { headers: { Accept: 'application/json' }, cf: { cacheTtl: ttlSecondes } }, 8000);
  } catch (e) {
    throw new ErreurPublique(`Le site ne répond pas (${e.message}).`, 502, 'site-injoignable');
  }
  if (!r.ok) throw new ErreurPublique(`Données du site inaccessibles (HTTP ${r.status}). Vérifiez SITE_URL.`, 502, 'site-injoignable');
  const valeur = await r.json();
  memoire.set(url, { valeur, expire: Date.now() + ttlSecondes * 1000 });
  return valeur;
}

export async function tarifsSite(env) {
  const t = await donneesSite(env, 'tarifs.json', 300);
  if (!t || typeof t.logements !== 'object') throw new ErreurPublique('Fichier tarifs.json invalide : republiez le site.', 502, 'site-invalide');
  return t;
}

export async function logementSite(env, slug) {
  if (typeof slug !== 'string' || !/^[a-z0-9][a-z0-9-]{0,80}$/.test(slug)) throw new ErreurPublique('Logement inconnu.', 404, 'introuvable');
  const tarifs = await tarifsSite(env);
  const infos = tarifs.logements[slug];
  if (!infos) throw new ErreurPublique('Logement inconnu.', 404, 'introuvable');
  return { tarifs, infos };
}

/** Dates bloquées publiées par la synchronisation (peut dater de quelques minutes). */
export async function disponibilitesPubliees(env, slug) {
  const d = await donneesSite(env, 'disponibilites.json', 60);
  return d?.logements?.[slug] || { statut: 'non-configure', plages: [] };
}

/** Vide le cache mémoire (tests). */
export const viderCacheSite = () => memoire.clear();
