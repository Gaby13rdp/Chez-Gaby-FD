// Dates « calendaires » (AAAA-MM-JJ) sans fuseau : toutes les opérations se
// font en jours entiers (UTC), ce qui évite les pièges des changements d'heure.
// Module partagé : scripts Node, pages Astro, navigateur et Worker.

export const JOURS_FR = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const JOUR_MS = 86400000;

/** 'AAAA-MM-JJ' -> nombre de jours depuis le 1970-01-01. */
export function versNum(date) {
  const [a, m, j] = String(date).split('-').map(Number);
  return Math.round(Date.UTC(a, m - 1, j) / JOUR_MS);
}

/** Nombre de jours -> 'AAAA-MM-JJ'. */
export function depuisNum(n) {
  return new Date(n * JOUR_MS).toISOString().slice(0, 10);
}

export const ajouterJours = (date, n) => depuisNum(versNum(date) + n);
export const ecartJours = (a, b) => versNum(b) - versNum(a);
export const estDateValide = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && depuisNum(versNum(d)) === d;

/** Jour de la semaine : 0 = lundi … 6 = dimanche. */
export function jourSemaine(date) {
  return (new Date(versNum(date) * JOUR_MS).getUTCDay() + 6) % 7;
}

export function ajouterMois(date, n) {
  const [a, m, j] = date.split('-').map(Number);
  const cible = new Date(Date.UTC(a, m - 1 + n, 1));
  const dernier = new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth() + 1, 0)).getUTCDate();
  cible.setUTCDate(Math.min(j, dernier));
  return cible.toISOString().slice(0, 10);
}

const formateurs = new Map();
function formateur(fuseau) {
  if (!formateurs.has(fuseau)) {
    formateurs.set(fuseau, new Intl.DateTimeFormat('en-CA', {
      timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }));
  }
  return formateurs.get(fuseau);
}

/** Décompose un instant (ms) en date/heure locales d'un fuseau IANA. */
export function partiesLocales(instant, fuseau) {
  const p = {};
  for (const { type, value } of formateur(fuseau).formatToParts(new Date(instant))) p[type] = value;
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    heure: Number(p.hour), minute: Number(p.minute), seconde: Number(p.second),
  };
}

/** Date du jour (AAAA-MM-JJ) dans un fuseau donné. */
export function aujourdhui(fuseau = 'Europe/Paris', maintenant = Date.now()) {
  return partiesLocales(maintenant, fuseau).date;
}

/** Décalage (ms) d'un fuseau par rapport à UTC à un instant donné. */
export function decalage(instant, fuseau) {
  const p = partiesLocales(instant, fuseau);
  const [a, m, j] = p.date.split('-').map(Number);
  const local = Date.UTC(a, m - 1, j, p.heure, p.minute, p.seconde);
  return local - Math.floor(instant / 1000) * 1000;
}

/** Convertit une heure murale (dans un fuseau) en instant UTC (ms). */
export function instantDepuisLocal(a, m, j, h, min, s, fuseau) {
  const supposition = Date.UTC(a, m - 1, j, h, min, s);
  let instant = supposition - decalage(supposition, fuseau);
  // Seconde passe pour les changements d'heure
  const d2 = decalage(instant, fuseau);
  instant = supposition - d2;
  return instant;
}

/** « 16:30 » -> 990 minutes. */
export function minutesDepuisHeure(heure, defaut = 0) {
  const m = String(heure ?? '').match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : defaut;
}
