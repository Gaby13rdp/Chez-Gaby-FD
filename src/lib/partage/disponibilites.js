// Disponibilités : manipulation des plages de nuits bloquées.
// Une plage [debut, fin) bloque les nuits de « debut » à la veille de « fin »
// (comme le DTEND exclusif du format iCal : le jour « fin » est libre pour
// une arrivée).

import { versNum, depuisNum, ajouterJours, jourSemaine, ajouterMois, ecartJours, estDateValide } from './dates.js';

/** Trie et fusionne des plages qui se chevauchent ou se touchent. */
export function fusionnerPlages(plages) {
  const triees = plages
    .filter((p) => p && p[0] && p[1] && p[0] < p[1])
    .map((p) => [p[0], p[1]])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const res = [];
  for (const p of triees) {
    const der = res[res.length - 1];
    if (der && p[0] <= der[1]) {
      if (p[1] > der[1]) der[1] = p[1];
    } else res.push(p);
  }
  return res;
}

/** Retire le passé et coupe au-delà de l'horizon. */
export function bornerPlages(plages, depuis, jusqua) {
  return fusionnerPlages(plages)
    .filter((p) => p[1] > depuis && (!jusqua || p[0] < jusqua))
    .map((p) => [p[0] < depuis ? depuis : p[0], jusqua && p[1] > jusqua ? jusqua : p[1]]);
}

/** Ensemble des nuits bloquées (numéros de jour), avec nuits de préparation. */
export function nuitsBloquees(plages, preparation = 0) {
  const set = new Set();
  for (const [d, f] of plages || []) {
    const a = versNum(d) - preparation, b = versNum(f) + preparation;
    for (let n = a; n < b; n++) set.add(n);
  }
  return set;
}

/** Toutes les nuits de [arrivee, depart) sont-elles libres ? */
export function sejourLibre(arrivee, depart, bloquees) {
  const a = versNum(arrivee), b = versNum(depart);
  for (let n = a; n < b; n++) if (bloquees.has(n)) return false;
  return true;
}

/** Dernière date de départ possible depuis une arrivée (première nuit bloquée). */
export function departMaximum(arrivee, bloquees, limite) {
  const a = versNum(arrivee), max = versNum(limite);
  for (let n = a; n < max; n++) if (bloquees.has(n)) return depuisNum(n);
  return limite;
}

/**
 * Règles résolues d'un logement (fusion réglages généraux + logement) :
 * { nuits_min, nuits_max, jours_arrivee:[0-6], jours_depart:[0-6],
 *   nuits_preparation, delai_min_jours, horizon_mois }
 */
export function verifierSejour({ arrivee, depart, voyageurs = 1, animaux = 0, regles, capacite, animauxAcceptes = 'non', bloquees, aujourdhui, nuitsMinSaison, fermees = [] }) {
  const problemes = [];
  if (!estDateValide(arrivee) || !estDateValide(depart)) return [{ code: 'dates-invalides' }];
  const nuits = ecartJours(arrivee, depart);
  if (nuits <= 0) return [{ code: 'depart-avant-arrivee' }];
  const min = Math.max(regles.nuits_min || 1, nuitsMinSaison || 0);
  if (nuits < min) problemes.push({ code: 'nuits-min', min });
  if (regles.nuits_max && nuits > regles.nuits_max) problemes.push({ code: 'nuits-max', max: regles.nuits_max });
  if (regles.jours_arrivee?.length && !regles.jours_arrivee.includes(jourSemaine(arrivee))) problemes.push({ code: 'jour-arrivee', jours: regles.jours_arrivee });
  if (regles.jours_depart?.length && !regles.jours_depart.includes(jourSemaine(depart))) problemes.push({ code: 'jour-depart', jours: regles.jours_depart });
  if (aujourdhui) {
    if (ecartJours(aujourdhui, arrivee) < (regles.delai_min_jours || 0)) problemes.push({ code: 'trop-tot', delai: regles.delai_min_jours || 0 });
    const horizon = ajouterMois(aujourdhui, regles.horizon_mois || 18);
    if (depart > horizon) problemes.push({ code: 'trop-loin', horizon });
  }
  if (capacite && voyageurs > capacite) problemes.push({ code: 'capacite', max: capacite });
  if (animaux > 0 && animauxAcceptes === 'non') problemes.push({ code: 'animaux-refuses' });
  if (fermees.length) problemes.push({ code: 'ferme', dates: fermees });
  if (bloquees && !sejourLibre(arrivee, depart, bloquees)) problemes.push({ code: 'indisponible' });
  return problemes;
}

/**
 * Propose jusqu'à `nombre` séjours de même durée, libres et conformes aux
 * règles, autour des dates demandées (± fenetre jours).
 */
export function datesAlternatives({ arrivee, depart, bloquees, regles, aujourdhui, fenetre = 21, nombre = 3, estFermee = () => false }) {
  const nuits = Math.max(ecartJours(arrivee, depart), regles.nuits_min || 1);
  const candidats = [];
  for (let decal = 1; decal <= fenetre; decal++) {
    for (const signe of [1, -1]) {
      const a = ajouterJours(arrivee, decal * signe);
      const d = ajouterJours(a, nuits);
      const pb = verifierSejour({ arrivee: a, depart: d, regles, bloquees, aujourdhui });
      let ferme = false;
      for (let n = 0; n < nuits && !ferme; n++) ferme = estFermee(ajouterJours(a, n));
      if (!pb.length && !ferme) candidats.push({ arrivee: a, depart: d, ecart: decal });
      if (candidats.length >= nombre) return candidats;
    }
  }
  return candidats;
}

/** Disponibilités « à confirmer » si la dernière synchronisation est trop ancienne. */
export function estPerime(verifieLe, maxHeures, maintenant = Date.now()) {
  if (!verifieLe) return true;
  const t = Date.parse(verifieLe);
  return Number.isNaN(t) || maintenant - t > maxHeures * 3600000;
}
