// ANALYSE DES CALENDRIERS iCAL (RFC 5545) -> nuits bloquées.
// Partagé par la synchronisation (scripts/synchro-calendriers.mjs) et le
// service temps réel (worker/). Ne conserve QUE des dates : aucun nom,
// description, identifiant de réservation ou numéro de téléphone.
//
// Règles :
//  • Événement « journée entière » (VALUE=DATE) : nuits [DTSTART, DTEND)
//    — DTEND est exclusif : la nuit du jour de départ reste libre.
//    Sans DTEND : une nuit (RFC 5545, durée implicite d'un jour).
//  • Événement horaire : converti dans le fuseau du logement. La nuit N
//    (de N à l'heure d'arrivée jusqu'à N+1 à l'heure de départ) est bloquée
//    si l'événement la chevauche.
//  • STATUS:CANCELLED : ignoré.
//  • RRULE (récurrence) : seule la première occurrence est bloquée, avec un
//    avertissement (n'utilisez pas de récurrences dans le calendrier maître).
//  • Doublons et chevauchements : fusionnés.

import { versNum, depuisNum, partiesLocales, instantDepuisLocal, minutesDepuisHeure } from './dates.js';
import { fusionnerPlages } from './disponibilites.js';

const TZ_WINDOWS = {
  'romance standard time': 'Europe/Paris',
  'w. europe standard time': 'Europe/Berlin',
  'central europe standard time': 'Europe/Budapest',
  'gmt standard time': 'Europe/London',
  'utc': 'UTC',
  'singapore standard time': 'Asia/Singapore',
  'se asia standard time': 'Asia/Bangkok',
  'china standard time': 'Asia/Shanghai',
  'w. australia standard time': 'Australia/Perth',
  'eastern standard time': 'America/New_York',
  'pacific standard time': 'America/Los_Angeles',
};

const MAX_EVENEMENTS = 20000;

/** Déplie les lignes (RFC 5545 §3.1) et découpe propriétés / paramètres / valeurs. */
export function lignesIcal(texte) {
  const brut = String(texte).replace(/\r\n|\r/g, '\n').replace(/\n[ \t]/g, '');
  const res = [];
  for (const ligne of brut.split('\n')) {
    if (!ligne.trim()) continue;
    // Séparation nom;params:valeur en tenant compte des guillemets dans les paramètres
    let i = 0, guillemets = false;
    for (; i < ligne.length; i++) {
      const c = ligne[i];
      if (c === '"') guillemets = !guillemets;
      else if (c === ':' && !guillemets) break;
    }
    const tete = ligne.slice(0, i);
    const valeur = ligne.slice(i + 1);
    const [nom, ...params] = tete.split(';');
    const p = {};
    for (const x of params) {
      const k = x.indexOf('=');
      if (k > 0) p[x.slice(0, k).toUpperCase()] = x.slice(k + 1).replace(/^"|"$/g, '');
    }
    res.push({ nom: nom.toUpperCase().trim(), params: p, valeur: valeur.trim() });
  }
  return res;
}

/** Valeur DATE ou DATE-TIME -> { type:'date', date } | { type:'instant', instant } | { type:'flottant', ... } */
export function lireDateIcal(valeur, params = {}, fuseauDefaut = 'UTC', avertir = () => {}) {
  const v = String(valeur).trim();
  const md = v.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (md || params.VALUE === 'DATE') {
    const m = md || v.match(/^(\d{4})(\d{2})(\d{2})/);
    if (!m) return null;
    return { type: 'date', date: `${m[1]}-${m[2]}-${m[3]}` };
  }
  const mt = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!mt) return null;
  const [, a, mo, j, h, mi, s = '00', z] = mt;
  const nums = [a, mo, j, h, mi, s].map(Number);
  if (z) return { type: 'instant', instant: Date.UTC(nums[0], nums[1] - 1, nums[2], nums[3], nums[4], nums[5]) };
  let fuseau = fuseauDefaut;
  if (params.TZID) {
    const tz = params.TZID.replace(/^\//, '');
    const connu = fuseauValide(tz) ? tz : TZ_WINDOWS[tz.toLowerCase()];
    if (connu) fuseau = connu;
    else avertir(`fuseau horaire inconnu « ${tz} » : heure interprétée dans le fuseau du logement (${fuseauDefaut})`);
  }
  return { type: 'instant', instant: instantDepuisLocal(...nums, fuseau) };
}

function fuseauValide(tz) {
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; }
}

/** Durée ISO 8601 (P1D, PT2H30M, P1W…) -> millisecondes ; jours séparés pour les dates. */
export function lireDuree(valeur) {
  const m = String(valeur).match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return null;
  const signe = m[1] === '-' ? -1 : 1;
  const jours = (Number(m[2] || 0) * 7 + Number(m[3] || 0));
  const ms = ((Number(m[4] || 0) * 60 + Number(m[5] || 0)) * 60 + Number(m[6] || 0)) * 1000;
  return { jours: signe * jours, ms: signe * ms };
}

/** Extrait les événements utiles (dates seulement) d'un texte iCal. */
export function evenementsIcal(texte, { fuseau = 'Europe/Paris' } = {}) {
  const avertissements = [];
  const avertir = (m) => { if (!avertissements.includes(m)) avertissements.push(m); };
  const lignes = lignesIcal(texte);
  if (!lignes.some((l) => l.nom === 'BEGIN' && l.valeur.toUpperCase() === 'VCALENDAR')) {
    throw new Error('le contenu reçu n’est pas un calendrier iCal (BEGIN:VCALENDAR absent) — vérifiez le lien');
  }
  const evenements = [];
  let courant = null, profondeur = 0;
  for (const l of lignes) {
    if (l.nom === 'BEGIN') {
      if (l.valeur.toUpperCase() === 'VEVENT') { courant = { params: {} }; profondeur = 0; }
      else if (courant) profondeur++;
      continue;
    }
    if (l.nom === 'END') {
      if (l.valeur.toUpperCase() === 'VEVENT' && courant) {
        evenements.push(courant); courant = null;
        if (evenements.length > MAX_EVENEMENTS) throw new Error('calendrier trop volumineux');
      } else if (courant && profondeur > 0) profondeur--;
      continue;
    }
    if (!courant || profondeur > 0) continue; // ignore VALARM, etc.
    if (['DTSTART', 'DTEND', 'DURATION', 'STATUS', 'RRULE', 'RECURRENCE-ID', 'UID'].includes(l.nom)) {
      courant[l.nom] = l.valeur;
      courant.params[l.nom] = l.params;
    }
  }
  const resultat = [];
  for (const e of evenements) {
    if ((e.STATUS || '').toUpperCase() === 'CANCELLED') continue;
    if (!e.DTSTART) { avertir('un événement sans date de début a été ignoré'); continue; }
    const debut = lireDateIcal(e.DTSTART, e.params.DTSTART, fuseau, avertir);
    if (!debut) { avertir(`date de début illisible « ${e.DTSTART} » (événement ignoré)`); continue; }
    let fin = e.DTEND ? lireDateIcal(e.DTEND, e.params.DTEND, fuseau, avertir) : null;
    if (!fin && e.DURATION) {
      const d = lireDuree(e.DURATION);
      if (d) {
        fin = debut.type === 'date'
          ? { type: 'date', date: depuisNum(versNum(debut.date) + d.jours) }
          : { type: 'instant', instant: debut.instant + d.jours * 86400000 + d.ms };
      }
    }
    if (!fin) {
      fin = debut.type === 'date' ? { type: 'date', date: depuisNum(versNum(debut.date) + 1) } : { ...debut };
    }
    if (e.RRULE) avertir('un événement récurrent (RRULE) a été trouvé : seule sa première occurrence est bloquée. Évitez les répétitions dans le calendrier maître.');
    resultat.push({ debut, fin });
  }
  return { evenements: resultat, avertissements };
}

/**
 * Convertit un événement en plage de nuits [debut, fin) dans le fuseau du logement.
 * @param {object} options { fuseau, heureArrivee: "16:00", heureDepart: "11:00" }
 */
export function nuitsEvenement(ev, { fuseau = 'Europe/Paris', heureArrivee = '16:00', heureDepart = '11:00' } = {}) {
  const { debut, fin } = ev;
  // Journée entière (ou mélange date / date) : DTEND exclusif
  if (debut.type === 'date') {
    const f = fin.type === 'date' ? fin.date : partiesLocales(fin.instant, fuseau).date;
    const d = debut.date;
    return f > d ? [d, f] : [d, depuisNum(versNum(d) + 1)];
  }
  // Événement horaire
  const s = partiesLocales(debut.instant, fuseau);
  const e = fin.type === 'date' ? { date: fin.date, heure: 0, minute: 0 } : partiesLocales(fin.instant, fuseau);
  const arr = minutesDepuisHeure(heureArrivee, 960);
  const dep = minutesDepuisHeure(heureDepart, 660);
  const minS = s.heure * 60 + s.minute;
  const minE = e.heure * 60 + e.minute;
  const nS = versNum(s.date), nE = versNum(e.date);
  // Nuit N = [N + arrivée, N+1 + départ). Chevauchement si début < (N+1)+départ et fin > N+arrivée.
  // Première nuit touchée : la veille si l'événement commence avant l'heure de départ.
  const premiere = minS < dep ? nS - 1 : nS;
  // Dernière nuit touchée : N tel que fin > N + arrivée.
  const derniere = minE > arr ? nE : nE - 1;
  if (derniere < premiere) {
    // Événement court entre départ et arrivée (ex. 12:00-14:00) : on bloque par prudence la nuit du jour
    return [s.date, depuisNum(nS + 1)];
  }
  return [depuisNum(premiere), depuisNum(derniere + 1)];
}

/** Texte iCal -> { plages:[[debut,fin)], avertissements, nombre } */
export function plagesDepuisIcal(texte, options = {}) {
  const { evenements, avertissements } = evenementsIcal(texte, options);
  const plages = evenements.map((ev) => nuitsEvenement(ev, options));
  return { plages: fusionnerPlages(plages), avertissements, nombre: evenements.length };
}
