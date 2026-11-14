// MOTEUR DE TARIFS — partagé par le site (navigateur), les pages et le Worker.
// Le même code calcule le devis affiché au voyageur et le montant recalculé
// côté serveur pour le paiement (on ne fait jamais confiance au navigateur).
//
// Entrée « tarif » (préparée par scripts/preparer.mjs) :
// {
//   devise, arrondi, remisePct, remisesCumulables, acomptePct,
//   prix_nuit, frais_menage, voyageurs_inclus, supplement_voyageur_nuit,
//   weekend: { nuits:[0-6], montant, pourcentage },
//   saisons:[{du,au,prix_nuit,nuits_min,ferme}], speciales:[…],
//   remises:{ semaine_pct, mois_pct, anticipee_jours, anticipee_pct,
//             derniere_minute_jours, derniere_minute_pct },
//   frais_animal, caution,
//   taxe:{ mode, montant, pourcentage, plafond, additionnelle }
// }

import { ajouterJours, ecartJours, jourSemaine } from './dates.js';

const DEVISES_SANS_DECIMALES = new Set(['IDR', 'JPY', 'KRW', 'VND', 'CLP', 'ISK', 'HUF', 'TWD', 'XOF', 'XAF', 'XPF']);

export function decimalesDevise(devise) {
  return DEVISES_SANS_DECIMALES.has(String(devise).toUpperCase()) ? 0 : 2;
}

/** Arrondi d'un montant final selon la devise (centimes ou unité). */
export function arrondirMontant(x, devise) {
  const f = 10 ** decimalesDevise(devise);
  return Math.round((x + Number.EPSILON) * f) / f;
}

/** Arrondi d'un prix par nuit au pas choisi (1 € ; 1000 IDR…). */
export function arrondirPas(x, pas = 1) {
  if (!pas || pas <= 0) return x;
  return Math.round(x / pas) * pas;
}

/** La date (AAAA-MM-JJ) est-elle dans la période [du, au] (inclus) ? du/au en "MM-JJ" ou "AAAA-MM-JJ". */
export function dansPeriode(date, du, au) {
  if (du.length === 10 && au.length === 10) return date >= du && date <= au;
  const md = date.slice(5);
  const d = du.length === 10 ? du.slice(5) : du;
  const a = au.length === 10 ? au.slice(5) : au;
  if (d <= a) return md >= d && md <= a;
  return md >= d || md <= a; // période à cheval sur deux années (ex. 12-20 -> 01-05)
}

/** Période (saison ou date spéciale) applicable à une nuit. Les dates spéciales sont prioritaires. */
export function periodePour(date, tarif) {
  for (const p of tarif.speciales || []) if (dansPeriode(date, p.du, p.au)) return p;
  for (const p of tarif.saisons || []) if (dansPeriode(date, p.du, p.au)) return p;
  return null;
}

/** Prix d'une nuit : { plateforme, direct, ferme, periode } */
export function prixNuit(date, tarif) {
  const periode = periodePour(date, tarif);
  let prix = periode?.prix_nuit ?? tarif.prix_nuit;
  const we = tarif.weekend;
  if (we && we.nuits?.includes(jourSemaine(date))) {
    if (we.montant) prix += we.montant;
    else if (we.pourcentage) prix *= 1 + we.pourcentage / 100;
  }
  const plateforme = arrondirPas(prix, tarif.arrondi);
  const direct = arrondirPas(prix * (1 - (tarif.remisePct || 0) / 100), tarif.arrondi);
  return { plateforme, direct, ferme: !!periode?.ferme, periode: periode?.nom || null };
}

/** Nuits minimum imposées par la saison de la nuit d'arrivée. */
export function nuitsMinPour(arrivee, tarif) {
  return periodePour(arrivee, tarif)?.nuits_min || 0;
}

/** Prix « à partir de » par nuit (le plus bas sur les 12 prochains mois). */
export function prixAPartirDe(tarif, depuis) {
  let min = Infinity, minPlateforme = Infinity;
  for (let i = 0; i < 366; i++) {
    const p = prixNuit(ajouterJours(depuis, i), tarif);
    if (p.ferme) continue;
    if (p.direct < min) { min = p.direct; minPlateforme = p.plateforme; }
  }
  if (!Number.isFinite(min)) min = arrondirPas(tarif.prix_nuit * (1 - (tarif.remisePct || 0) / 100), tarif.arrondi);
  return { direct: min, plateforme: Number.isFinite(minPlateforme) ? minPlateforme : tarif.prix_nuit };
}

/**
 * Calcule le devis complet.
 * @returns {object} { nuits, detail:[{date,direct,plateforme}], hebergement, remise:{pct,montant,motifs}, menage,
 *   supplementVoyageurs, fraisAnimaux, taxeSejour, total, totalPlateforme, economie, acompte, solde, caution, fermees }
 */
export function calculerDevis(tarif, { arrivee, depart, adultes = 1, enfants = 0, animaux = 0, aujourdhui = null }) {
  const devise = tarif.devise || 'EUR';
  const nuits = ecartJours(arrivee, depart);
  if (!(nuits > 0)) return null;
  const detail = [];
  const fermees = [];
  let hebergement = 0, hebergementPlateforme = 0;
  for (let i = 0; i < nuits; i++) {
    const date = ajouterJours(arrivee, i);
    const p = prixNuit(date, tarif);
    if (p.ferme) fermees.push(date);
    detail.push({ date, direct: p.direct, plateforme: p.plateforme });
    hebergement += p.direct;
    hebergementPlateforme += p.plateforme;
  }

  // Remises
  const r = tarif.remises || {};
  const candidates = [];
  if (nuits >= 28 && r.mois_pct) candidates.push({ motif: 'mois', pct: r.mois_pct });
  else if (nuits >= 7 && r.semaine_pct) candidates.push({ motif: 'semaine', pct: r.semaine_pct });
  if (aujourdhui) {
    const delai = ecartJours(aujourdhui, arrivee);
    if (r.anticipee_jours > 0 && r.anticipee_pct && delai >= r.anticipee_jours) candidates.push({ motif: 'anticipee', pct: r.anticipee_pct });
    if (r.derniere_minute_jours > 0 && r.derniere_minute_pct && delai >= 0 && delai <= r.derniere_minute_jours) candidates.push({ motif: 'derniere-minute', pct: r.derniere_minute_pct });
  }
  let pct = 0, motifs = [];
  if (candidates.length) {
    if (tarif.remisesCumulables) {
      pct = Math.min(90, candidates.reduce((s, c) => s + c.pct, 0));
      motifs = candidates.map((c) => c.motif);
    } else {
      const meilleure = candidates.reduce((a, b) => (b.pct > a.pct ? b : a));
      pct = meilleure.pct; motifs = [meilleure.motif];
    }
  }
  const remise = arrondirMontant(hebergement * pct / 100, devise);
  const hebergementNet = hebergement - remise;

  const voyageurs = adultes + enfants;
  const inclus = tarif.voyageurs_inclus || voyageurs;
  const supplementVoyageurs = arrondirMontant(Math.max(0, voyageurs - inclus) * (tarif.supplement_voyageur_nuit || 0) * nuits, devise);
  const menage = tarif.frais_menage || 0;
  const fraisAnimaux = animaux > 0 ? arrondirMontant(animaux * (tarif.frais_animal || 0), devise) : 0;
  const taxeSejour = calculerTaxe(tarif.taxe, { adultes, enfants, nuits, prixNuitMoyen: (hebergementNet + supplementVoyageurs) / nuits, devise });

  const total = arrondirMontant(hebergementNet + supplementVoyageurs + menage + fraisAnimaux + taxeSejour, devise);
  const totalPlateforme = arrondirMontant(hebergementPlateforme + supplementVoyageurs + menage + fraisAnimaux + taxeSejour, devise);
  const acompte = arrondirPas(arrondirMontant(total * (tarif.acomptePct || 0) / 100, devise), devise === 'IDR' ? 1000 : 0.01);
  return {
    devise, nuits, detail, fermees,
    hebergement: arrondirMontant(hebergement, devise),
    hebergementPlateforme: arrondirMontant(hebergementPlateforme, devise),
    remise: { pct, montant: remise, motifs },
    supplementVoyageurs, menage, fraisAnimaux, taxeSejour, total, totalPlateforme,
    economie: arrondirMontant(Math.max(0, totalPlateforme - total), devise),
    acompte: arrondirMontant(acompte, devise),
    solde: arrondirMontant(total - acompte, devise),
    caution: tarif.caution || 0,
    prixMoyenNuit: arrondirMontant(hebergementNet / nuits, devise),
  };
}

/** Taxe de séjour : fixe (par adulte et par nuit) ou proportionnelle (meublé non classé). */
export function calculerTaxe(taxe, { adultes, enfants = 0, nuits, prixNuitMoyen, devise }) {
  if (!taxe || taxe.mode === 'aucune' || !adultes || !nuits) return 0;
  let parAdulteNuit = 0;
  if (taxe.mode === 'fixe') {
    parAdulteNuit = taxe.montant || 0;
  } else if (taxe.mode === 'pourcentage') {
    const occupants = Math.max(1, adultes + enfants);
    parAdulteNuit = (prixNuitMoyen / occupants) * (taxe.pourcentage || 0) / 100;
    if (taxe.plafond > 0) parAdulteNuit = Math.min(parAdulteNuit, taxe.plafond);
  }
  const base = parAdulteNuit * adultes * nuits;
  return arrondirMontant(base * (1 + (taxe.additionnelle || 0) / 100), devise);
}

/** Formatage monétaire localisé : 1 234 €, Rp 1.500.000 */
export function formaterMontant(montant, devise = 'EUR', langue = 'fr') {
  const locale = { fr: 'fr-FR', en: 'en-GB', id: 'id-ID' }[langue] || langue;
  const dec = decimalesDevise(devise);
  const entier = Number.isInteger(montant);
  return new Intl.NumberFormat(locale, {
    style: 'currency', currency: devise,
    minimumFractionDigits: entier || dec === 0 ? 0 : 2,
    maximumFractionDigits: dec,
  }).format(montant);
}
