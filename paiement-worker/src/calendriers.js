// Calendriers : lecture en temps réel des liens iCal (stockés en secrets du
// service, sous les MÊMES noms que les secrets GitHub) et agenda Google
// « maître » (vérification d'occupation et blocage des dates après paiement).
// Seules des dates sortent d'ici : jamais de nom, de description ni de numéro.

import { plagesDepuisIcal, nuitsEvenement } from '../../src/lib/partage/ical.js';
import { fusionnerPlages, bornerPlages } from '../../src/lib/partage/disponibilites.js';
import { aujourdhui, ajouterJours, ajouterMois } from '../../src/lib/partage/dates.js';
import { base64url, enMajuscules, fetchDelai, octets, sha256Hex } from './outils.js';
import { disponibilitesPubliees } from './site.js';

const NOM_SECRET = /^[A-Z][A-Z0-9_]*$/;

/** Noms des calendriers déclarés dans la fiche du logement (publiés dans tarifs.json). */
export const secretsDeclares = (infos) => (infos.calendriers || []).filter((n) => NOM_SECRET.test(n));

/** Parmi eux, ceux dont le lien iCal est réellement enregistré dans le service. */
export const secretsIcal = (env, infos) => secretsDeclares(infos).filter((n) => typeof env[n] === 'string' && /^https?:\/\//.test(env[n].trim()));

// Petit cache par calendrier : un afflux de visites ne provoque pas un
// téléchargement par visite (et ne fait pas limiter vos liens par Airbnb).
const cacheFlux = new Map();
export const viderCacheCalendriers = () => cacheFlux.clear();

async function plagesFlux(env, nom, options, maxAgeS) {
  const deja = cacheFlux.get(nom);
  if (deja && deja.url === env[nom] && Date.now() - deja.le < maxAgeS * 1000) return deja.plages;
  const r = await fetchDelai(env[nom].trim(), {
    headers: { 'User-Agent': 'site-reservation-directe/1.0 (verification en temps reel)', Accept: 'text/calendar, text/plain;q=0.9, */*;q=0.5' },
    redirect: 'follow',
  }, 8000);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const texte = await r.text();
  if (texte.length > 8_000_000) throw new Error('calendrier anormalement volumineux');
  const plages = plagesDepuisIcal(texte, options).plages;
  cacheFlux.set(nom, { url: env[nom], le: Date.now(), plages });
  return plages;
}

/**
 * Dates bloquées à l'instant T : union des calendriers lus en direct et des
 * données publiées (prudence : une source en panne ne libère jamais de dates).
 * « ok » seulement si TOUS les calendriers déclarés ont été lus en direct.
 */
export async function disponibilitesActuelles(env, slug, infos, { maxAgeS = 60, maintenant = Date.now() } = {}) {
  const publie = await disponibilitesPubliees(env, slug).catch(() => ({ statut: 'erreur', plages: [] }));
  const declares = secretsDeclares(infos);
  const noms = secretsIcal(env, infos);
  const options = { fuseau: infos.fuseau || 'Europe/Paris', heureArrivee: infos.heureArrivee || '16:00', heureDepart: infos.heureDepart || '11:00' };
  const resultats = await Promise.allSettled(noms.map((nom) => plagesFlux(env, nom, options, maxAgeS)));
  const erreurs = resultats.filter((r) => r.status === 'rejected');
  for (const [i, r] of resultats.entries()) {
    // Le nom du secret peut apparaître dans les journaux, jamais son contenu (le lien).
    if (r.status === 'rejected') console.log(`Calendrier ${noms[i]} : ${String(r.reason?.message || r.reason).slice(0, 120)}`);
  }
  const enDirect = resultats.filter((r) => r.status === 'fulfilled').flatMap((r) => r.value);
  const depuis = aujourdhui(options.fuseau, maintenant);
  const plages = bornerPlages(fusionnerPlages([...(publie.plages || []), ...enDirect]), depuis, ajouterMois(depuis, (infos.regles?.horizon_mois || 18) + 1));
  const toutEnDirect = noms.length > 0 && noms.length === declares.length && erreurs.length === 0;
  return {
    statut: toutEnDirect ? 'ok' : noms.length ? 'partiel' : 'publie',
    verifieLe: toutEnDirect ? new Date(maintenant).toISOString() : publie.verifieLe || null,
    statutPublie: publie.statut,
    plages,
    sources: noms.length,
    erreurs: erreurs.length,
  };
}

// ---------------------------------------------------------------------------
// Google Agenda (compte de service)
// ---------------------------------------------------------------------------

function pemVersDer(pem) {
  const b64 = String(pem).replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const bin = atob(b64);
  const res = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) res[i] = bin.charCodeAt(i);
  return res.buffer;
}

export function lireCompteGoogle(env) {
  if (!env.GOOGLE_SERVICE_ACCOUNT) return null;
  try {
    const c = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT);
    return c.client_email && c.private_key ? c : null;
  } catch {
    return null;
  }
}

/** Secret contenant l'ID de l'agenda : GCAL_<LOGEMENT>, ou GCAL_TEST pour les paiements de test. */
export const secretAgendaGoogle = (slug, test = false) => (test ? 'GCAL_TEST' : `GCAL_${enMajuscules(slug)}`);

const jetons = new Map();
async function jetonGoogle(compte) {
  const deja = jetons.get(compte.client_email);
  if (deja && deja.expire > Date.now()) return deja.jeton;
  const maintenant = Math.floor(Date.now() / 1000);
  const entete = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const contenu = base64url(JSON.stringify({
    iss: compte.client_email,
    scope: 'https://www.googleapis.com/auth/calendar.events',
    aud: 'https://oauth2.googleapis.com/token',
    iat: maintenant,
    exp: maintenant + 3600,
  }));
  const cle = await crypto.subtle.importKey('pkcs8', pemVersDer(compte.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cle, octets(`${entete}.${contenu}`));
  const r = await fetchDelai('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${entete}.${contenu}.${base64url(signature)}` }).toString(),
  }, 8000);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`connexion Google refusée (HTTP ${r.status})`);
  jetons.set(compte.client_email, { jeton: j.access_token, expire: Date.now() + 50 * 60 * 1000 });
  return j.access_token;
}
export const viderJetonsGoogle = () => jetons.clear();

/** Identifiant d'événement stable : un même paiement ne crée jamais deux événements. */
export const idEvenement = async (reference) => 'sd' + (await sha256Hex(reference)).slice(0, 40);

function agendaConfigure(env, slug, test) {
  const compte = lireCompteGoogle(env);
  const agenda = env[secretAgendaGoogle(slug, test)];
  return compte && agenda ? { compte, base: `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(String(agenda).trim())}/events` } : null;
}

/**
 * Un événement de l'agenda Google « direct » occupe-t-il une nuit de [arrivee, depart) ?
 * (réservation directe notée à la main, ou payée en ligne mais pas encore synchronisée)
 * @returns {{ configure: boolean, conflit: boolean }}
 */
export async function occupationAgenda(env, slug, infos, { arrivee, depart, sauf = '', test = false }) {
  const a = agendaConfigure(env, slug, test);
  if (!a) return { configure: false, conflit: false };
  const jeton = await jetonGoogle(a.compte);
  const params = new URLSearchParams({
    timeMin: `${ajouterJours(arrivee, -2)}T00:00:00Z`,
    timeMax: `${ajouterJours(depart, 2)}T00:00:00Z`,
    singleEvents: 'true',
    maxResults: '250',
  });
  const r = await fetchDelai(`${a.base}?${params}`, { headers: { Authorization: `Bearer ${jeton}` } }, 8000);
  if (!r.ok) throw new Error(`lecture de l'agenda Google refusée (HTTP ${r.status})`);
  const j = await r.json().catch(() => ({}));
  const options = { fuseau: infos.fuseau || 'Europe/Paris', heureArrivee: infos.heureArrivee || '16:00', heureDepart: infos.heureDepart || '11:00' };
  const versIcal = (x) => (x?.date ? { type: 'date', date: x.date } : x?.dateTime ? { type: 'instant', instant: Date.parse(x.dateTime) } : null);
  for (const ev of j.items || []) {
    if (ev.status === 'cancelled' || (sauf && ev.id === sauf)) continue;
    const debut = versIcal(ev.start), fin = versIcal(ev.end);
    if (!debut || !fin) continue;
    const [d, f] = nuitsEvenement({ debut, fin }, options);
    if (d < depart && f > arrivee) return { configure: true, conflit: true };
  }
  return { configure: true, conflit: false };
}

/**
 * Bloque [arrivee, depart) dans l'agenda Google du logement.
 * @returns {{ statut: 'non-configure'|'ajoute'|'deja-present', id?: string }}
 */
export async function bloquerDansAgenda(env, slug, { arrivee, depart, reference, resume, description, test = false }) {
  const a = agendaConfigure(env, slug, test);
  if (!a) return { statut: 'non-configure' };
  const jeton = await jetonGoogle(a.compte);
  const id = await idEvenement(reference);
  const r = await fetchDelai(a.base, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, summary: resume, description, start: { date: arrivee }, end: { date: depart }, transparency: 'opaque' }),
  }, 8000);
  if (r.status === 409) return { statut: 'deja-present', id };
  if (!r.ok) throw new Error(`Google Agenda a refusé l’ajout (HTTP ${r.status}) : vérifiez que l’agenda est partagé avec ${a.compte.client_email} (« Apporter des modifications aux événements »)`);
  return { statut: 'ajoute', id };
}

/** L'événement de ce paiement existe-t-il déjà (notification reçue une seconde fois) ? */
export async function dejaDansAgenda(env, slug, reference, { test = false } = {}) {
  const a = agendaConfigure(env, slug, test);
  if (!a) return false;
  try {
    const jeton = await jetonGoogle(a.compte);
    const id = await idEvenement(reference);
    const r = await fetchDelai(`${a.base}/${id}`, { headers: { Authorization: `Bearer ${jeton}` } }, 8000);
    if (!r.ok) return false;
    const ev = await r.json().catch(() => ({}));
    return ev.status !== 'cancelled';
  } catch {
    return false;
  }
}
