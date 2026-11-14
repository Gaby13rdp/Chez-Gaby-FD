// Accès aux données préparées (src/genere/donnees.json) et petites aides
// utilisées par toutes les pages.

import donnees from '../genere/donnees.json';
import icones from '../genere/icones.json';
import fr from '../i18n/fr.json';
import en from '../i18n/en.json';
import id from '../i18n/id.json';
import { formaterMontant } from './partage/tarifs.js';

export const D: any = donnees;
export const C: any = D.config;
export const ICONES: Record<string, string> = icones as any;
export const TEXTES: Record<string, any> = { fr, en, id };
export type Langue = 'fr' | 'en' | 'id';

const BASE = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');

/** Lien interne : ajoute le chemin de base (GitHub Pages « projet »). */
export function lien(chemin = '/'): string {
  if (!chemin) return BASE;
  if (/^(https?:|mailto:|tel:|#)/.test(chemin)) return chemin;
  return BASE + String(chemin).replace(/^\/+/, '');
}

/** Adresse absolue (canonique, Open Graph, sitemap). */
export function urlAbsolue(chemin = '/'): string {
  return D.site.origine + lien(chemin);
}

/** Lien vers un fichier de public/ (images optimisées, données). */
export const fichier = (chemin: string) => lien(chemin);

/** Traduction d'une clé (ex. « reservation.total »), avec variables {x}. */
export function t(langue: string, cle: string, vars: Record<string, any> = {}): string {
  const lire = (l: string) => cle.split('.').reduce((o: any, k) => (o == null ? undefined : o[k]), TEXTES[l]);
  const v = lire(langue) ?? lire('fr') ?? cle;
  return String(v).replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

/** Pluriel simple : clé_un / clé_plusieurs. */
export function tn(langue: string, cle: string, n: number, vars: Record<string, any> = {}): string {
  return t(langue, `${cle}_${n > 1 || n === 0 ? 'plusieurs' : 'un'}`, { n, ...vars });
}

export const prix = (montant: number, devise = 'EUR', langue = 'fr') => formaterMontant(montant, devise, langue);

export function locale(langue: string) { return TEXTES[langue]?.locale || 'fr-FR'; }

export function dateLongue(date: string, langue: string) {
  return new Intl.DateTimeFormat(locale(langue), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(date + 'T00:00:00Z'));
}

// ---- Accès aux contenus -----------------------------------------------------
export const logement = (slug: string) => D.logements.find((l: any) => l.slug === slug);
export const etablissement = (slug: string) => D.etablissements.find((e: any) => e.slug === slug);
export const destination = (slug: string) => D.destinations.find((d: any) => d.slug === slug);
export const avisDe = (ids: string[]) => D.avis.filter((a: any) => ids.includes(a.id));

/** Adresse d'une page dans une langue (repli sur la langue par défaut). */
export function route(type: string, idPage: string, langue: string): string | null {
  const r = D.routes.find((x: any) => x.type === type && x.id === idPage && x.langue === langue)
    ?? D.routes.find((x: any) => x.type === type && x.id === idPage && x.langue === D.langueDefaut);
  return r ? r.chemin : null;
}

export const lienRoute = (type: string, idPage: string, langue: string) => {
  const r = route(type, idPage, langue);
  return r ? lien(r) : null;
};

/** Texte localisé d'un élément (champ i18n), avec repli sur la langue par défaut. */
export function loc(element: any, langue: string) {
  return element?.i18n?.[langue] ?? element?.i18n?.[D.langueDefaut] ?? {};
}

// ---- Images -----------------------------------------------------------------
export function srcset(photo: any, format: 'webp' | 'avif') {
  return photo.variantes.map((w: number) => `${fichier(`img/${photo.cle}/${w}.${format}`)} ${w}w`).join(', ');
}
export function srcPhoto(photo: any, largeurCible = 960) {
  const w = photo.variantes.find((x: number) => x >= largeurCible) ?? photo.variantes[photo.variantes.length - 1];
  return fichier(`img/${photo.cle}/${w}.webp`);
}
export const ogPhoto = (photo: any) => (photo?.og ? urlAbsolue(photo.og) : null);

// ---- Divers -----------------------------------------------------------------
export const telLien = (tel: string) => 'tel:' + String(tel || '').replace(/[^+\d]/g, '');
/** Numéro affiché sans retour à la ligne au milieu (espaces insécables). */
export const telAffiche = (tel: string) => String(tel || '').replace(/ /g, '\u00A0');
export const waNumero = (tel: string) => String(tel || '').replace(/[^\d]/g, '');

/** Adresse e-mail découpée (anti-robots) : reconstituée par le navigateur. */
export function emailMasque(email: string) {
  const [u, d] = String(email || '').split('@');
  return { u: [...u].reverse().join(''), d: [...(d || '')].reverse().join('') };
}

export function joursTexte(indices: number[], langue: string) {
  const noms = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  const fmt = new Intl.DateTimeFormat(locale(langue), { weekday: 'long', timeZone: 'UTC' });
  return indices.map((i) => fmt.format(new Date(Date.UTC(2024, 0, 1 + i)))).join(', ') || noms.join(', ');
}

export function libelleType(type: string, langue: string) { return t(langue, `types.${type}`); }

export function lienItineraire(lat: number, lng: number) {
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    apple: `https://maps.apple.com/?daddr=${lat},${lng}`,
    waze: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
  };
}

/** Image de partage par défaut (réseaux sociaux). */
export function imageParDefaut(): string | null {
  const candidates = [D.imagePartage, D.accueil?.image, D.logements[0]?.photos?.[0]];
  for (const p of candidates) if (p?.og) return urlAbsolue(p.og);
  return null;
}

/** Ajoute le chemin de base aux liens internes d'un texte HTML (Markdown). */
export function htmlAvecBase(html: string): string {
  return String(html || '').replace(/href="\/(?!\/)/g, `href="${BASE}`);
}
