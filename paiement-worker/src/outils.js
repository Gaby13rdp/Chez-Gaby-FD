// Petits outils communs du service (réponses, cryptographie, délais).
// Aucune dépendance externe : uniquement les API standard (fetch, WebCrypto),
// disponibles à la fois dans Cloudflare Workers et dans Node.js (tests).

export const VERSION = '1.0.0';

/** Erreur dont le message peut être montré au visiteur. */
export class ErreurPublique extends Error {
  constructor(message, statut = 400, code = 'erreur', details = undefined) {
    super(message);
    this.statut = statut;
    this.code = code;
    this.details = details;
  }
}

export function json(donnees, statut = 200, entetes = {}) {
  return new Response(JSON.stringify(donnees), {
    status: statut,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...entetes },
  });
}

export function html(contenu, statut = 200, entetes = {}) {
  return new Response(contenu, {
    status: statut,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', ...entetes },
  });
}

const encodeur = new TextEncoder();
export const octets = (texte) => encodeur.encode(String(texte));

export function hex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(texte) {
  return hex(await crypto.subtle.digest('SHA-256', octets(texte)));
}

export async function hmacSha256Hex(cle, message) {
  const k = await crypto.subtle.importKey('raw', octets(cle), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, octets(message)));
}

/** Comparaison en temps constant (évite de deviner une signature caractère par caractère). */
export function egaliteConstante(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export function base64url(donnee) {
  const tab = typeof donnee === 'string' ? octets(donnee) : new Uint8Array(donnee);
  let bin = '';
  for (const b of tab) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** fetch avec délai maximal (une API lente ne bloque jamais le service). */
export async function fetchDelai(url, options = {}, ms = 10000) {
  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } catch (e) {
    if (e?.name === 'AbortError') throw new Error(`pas de réponse après ${Math.round(ms / 1000)} s`);
    throw e;
  } finally {
    clearTimeout(minuteur);
  }
}

/** Lit un corps JSON en limitant sa taille. */
export async function lireJson(request, max = 20000) {
  const texte = await request.text();
  if (texte.length > max) throw new ErreurPublique('Requête trop volumineuse.', 413, 'trop-volumineux');
  try {
    const v = JSON.parse(texte || '{}');
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error();
    return v;
  } catch {
    throw new ErreurPublique('Requête illisible.', 400, 'illisible');
  }
}

export const texteCourt = (v, max = 200) => String(v ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);
export const texteLong = (v, max = 8000) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]+/g, '').trim().slice(0, max);
export const estEmail = (v) => typeof v === 'string' && v.length <= 200 && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/.test(v);

export const echapperHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Nom de secret calculé à partir d'un identifiant (studio-cathedrale -> STUDIO_CATHEDRALE). */
export const enMajuscules = (slug) => String(slug).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');

/** Adresse publique du site, sans barre finale. */
export function adresseSite(env) {
  const brute = String(env.SITE_URL || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//.test(brute)) {
    throw new ErreurPublique('Service non configuré : l’adresse du site (SITE_URL) est absente. Redéployez le service avec le workflow « Déployer le service Cloudflare ».', 503, 'configuration');
  }
  return brute;
}

/** Origines (sites) autorisées à appeler le service depuis un navigateur. */
export function originesAutorisees(env) {
  const res = new Set();
  for (const brute of [env.SITE_URL, ...String(env.ORIGINES_SUPPLEMENTAIRES || '').split(/[\s,]+/)]) {
    try { if (brute) res.add(new URL(String(brute).trim()).origin); } catch { /* ignorée */ }
  }
  return res;
}

/** Clé de paiement « réelle » (et non de test) ? */
export const estCleReelle = (cle) => /^(sk|rk)_live_/.test(String(cle || '')) || /^xnd_production_/.test(String(cle || ''));
