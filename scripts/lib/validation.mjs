// Validateur générique : vérifie les données d'un fichier par rapport à un
// schéma (voir schemas.mjs), applique les valeurs par défaut et produit des
// messages d'erreur clairs en français.

import { estObjet, suggestion, enumerer } from './outils.mjs';

const FUSEAUX = new Set(typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []);
FUSEAUX.add('UTC');

/**
 * @param {any} valeur        donnée lue dans le fichier
 * @param {object} spec       description du champ (voir schemas.mjs)
 * @param {object} ctx        { rapport, fichier, chemin: [], production, references, quoi }
 */
export function valider(valeur, spec, ctx, chemin = []) {
  const nom = libelle(spec, chemin);
  const vide = valeur === undefined || valeur === null || (typeof valeur === 'string' && valeur.trim() === '');

  if (vide) {
    if (spec.requis) {
      ctx.rapport.erreur(`${ctx.quoi} : le champ ${nom} est obligatoire.${spec.aide ? ` (${spec.aide})` : ''}`, ctx.fichier);
    }
    if (spec.type === 'objet') return valider({}, { ...spec, requis: false }, ctx, chemin);
    if (spec.type === 'liste') return spec.defaut !== undefined ? structuredClone(spec.defaut) : [];
    return spec.defaut !== undefined ? structuredClone(spec.defaut) : (spec.type === 'booleen' ? false : undefined);
  }

  const err = (msg) => { ctx.rapport.erreur(`${ctx.quoi} : ${nom} ${msg}`, ctx.fichier); return spec.defaut; };

  switch (spec.type) {
    case 'texte': case 'texte-long': case 'markdown': {
      if (typeof valeur === 'number' || typeof valeur === 'boolean') valeur = String(valeur);
      if (typeof valeur !== 'string') return err(`doit être un texte.`);
      const t = valeur.trim();
      if (spec.max && t.length > spec.max) ctx.rapport.avertissement(`${ctx.quoi} : ${nom} est long (${t.length} caractères, ${spec.max} conseillés).`, ctx.fichier);
      if (spec.motif && !new RegExp(spec.motif).test(t)) return err(spec.motifMessage || `n'a pas le bon format.`);
      return t;
    }
    case 'url': {
      const t = String(valeur).trim();
      if (spec.relatifAutorise && t.startsWith('/')) return t;
      try {
        const u = new URL(t);
        if (!/^https?:$/.test(u.protocol)) throw new Error();
        // http:// est toléré uniquement pour un service lancé sur l'ordinateur (tests locaux)
        const local = /^(localhost|127\.0\.0\.1)$/.test(u.hostname);
        if (spec.httpsSeulement && u.protocol !== 'https:' && !local) return err(`doit commencer par « https:// » (reçu : « ${t} »).`);
        return t;
      } catch {
        return err(`doit être une adresse web complète commençant par https:// (reçu : « ${t} »).`);
      }
    }
    case 'email': {
      const t = String(valeur).trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t)) return err(`n'est pas une adresse e-mail valide (reçu : « ${t} »).`);
      return t;
    }
    case 'telephone': {
      const t = String(valeur).trim();
      if (!/^\+?[0-9 ().-]{6,20}$/.test(t)) return err(`n'est pas un numéro de téléphone valide (reçu : « ${t} »). Exemple : "+33 6 12 34 56 78".`);
      return t;
    }
    case 'couleur': {
      const t = String(valeur).trim();
      if (!/^#[0-9a-fA-F]{6}$/.test(t)) return err(`doit être une couleur au format "#RRGGBB" (reçu : « ${t} »). Exemple : "#B4532A".`);
      return t.toUpperCase();
    }
    case 'heure': {
      const t = String(valeur).trim().replace('h', ':').replace(/^(\d):/, '0$1:');
      const m = t.match(/^([01]\d|2[0-3]):([0-5]\d)$/) || t.match(/^([01]\d|2[0-3]):?$/);
      if (!m) return err(`doit être une heure au format "16:00" (reçu : « ${valeur} »).`);
      return `${m[1]}:${m[2] ?? '00'}`;
    }
    case 'date': {
      const t = valeur instanceof Date ? valeur.toISOString().slice(0, 10) : String(valeur).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || isNaN(Date.parse(t + 'T00:00:00Z'))) {
        return err(`doit être une date au format "AAAA-MM-JJ", par exemple "2026-07-14" (reçu : « ${t} »).`);
      }
      return t;
    }
    case 'jour-ou-date': { // "MM-JJ" (chaque année) ou "AAAA-MM-JJ"
      const t = valeur instanceof Date ? valeur.toISOString().slice(0, 10) : String(valeur).trim();
      if (/^\d{2}-\d{2}$/.test(t)) {
        const [mm, jj] = t.split('-').map(Number);
        if (mm >= 1 && mm <= 12 && jj >= 1 && jj <= 31) return t;
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(t) && !isNaN(Date.parse(t + 'T00:00:00Z'))) {
        return t;
      }
      return err(`doit être "MM-JJ" (chaque année, ex. "07-14") ou "AAAA-MM-JJ" (ex. "2027-07-14") (reçu : « ${t} »).`);
    }
    case 'nombre': {
      let n = valeur;
      if (typeof n === 'string') n = Number(n.replace(',', '.').replace(/\s/g, ''));
      if (typeof n !== 'number' || Number.isNaN(n)) return err(`doit être un nombre (reçu : « ${valeur} »). Écrivez uniquement des chiffres, sans € ni %.`);
      if (spec.entier && !Number.isInteger(n)) return err(`doit être un nombre entier (reçu : ${valeur}).`);
      if (spec.min !== undefined && n < spec.min) return err(`doit être supérieur ou égal à ${spec.min} (reçu : ${n}).`);
      if (spec.max !== undefined && n > spec.max) return err(`doit être inférieur ou égal à ${spec.max} (reçu : ${n}).`);
      return n;
    }
    case 'booleen': {
      if (typeof valeur === 'boolean') return valeur;
      const t = String(valeur).trim().toLowerCase();
      if (['true', 'oui', 'yes', 'vrai', '1'].includes(t)) return true;
      if (['false', 'non', 'no', 'faux', '0'].includes(t)) return false;
      return err(`doit valoir true (oui) ou false (non) (reçu : « ${valeur} »).`);
    }
    case 'choix': {
      const options = typeof spec.options === 'function' ? spec.options(ctx) : spec.options;
      const t = String(valeur).trim();
      if (options.includes(t)) return t;
      const t2 = options.find((o) => String(o).toLowerCase() === t.toLowerCase());
      if (t2 !== undefined) return t2;
      const s = suggestion(t, options);
      return err(`a une valeur inconnue « ${t} ».${s ? ` Vouliez-vous dire « ${s} » ?` : ''} Valeurs possibles : ${options.join(', ')}.`);
    }
    case 'fuseau': {
      const t = String(valeur).trim();
      if (FUSEAUX.size && !FUSEAUX.has(t)) {
        const s = suggestion(t, [...FUSEAUX]);
        return err(`n'est pas un fuseau horaire reconnu (reçu : « ${t} »).${s ? ` Vouliez-vous dire « ${s} » ?` : ''} Exemples : "Europe/Paris", "Asia/Makassar" (Bali).`);
      }
      return t;
    }
    case 'devise': {
      const t = String(valeur).trim().toUpperCase();
      try { new Intl.NumberFormat('fr-FR', { style: 'currency', currency: t }); } catch {
        return err(`n'est pas un code de devise valide (reçu : « ${valeur} »). Exemples : "EUR", "IDR".`);
      }
      if (!/^[A-Z]{3}$/.test(t)) return err(`doit être un code à 3 lettres comme "EUR" ou "IDR".`);
      return t;
    }
    case 'reference': {
      const brut = String(valeur).trim();
      // Accepte "residence-cathedrale", "content/etablissements/residence-cathedrale" ou ".../index.md"
      const slug = brut.replace(/\/index\.md$/, '').replace(/\.md$/, '').split('/').filter(Boolean).pop();
      const possibles = ctx.references?.[spec.collection];
      if (possibles && !possibles.includes(slug)) {
        const s = suggestion(slug, possibles);
        return err(`fait référence à « ${slug} », qui n'existe pas.${s ? ` Vouliez-vous dire « ${s} » ?` : ''}${possibles.length ? ` Disponibles : ${possibles.join(', ')}.` : ''}`);
      }
      return slug;
    }
    case 'image': case 'fichier': {
      const t = String(valeur).trim();
      if (/^https?:\/\//.test(t)) return err(`doit être une image du dépôt (pas une adresse web externe) : déposez l'image dans le dépôt.`);
      return t.replace(/^\/+/, '');
    }
    case 'icone': {
      const t = String(valeur).trim();
      if (ctx.iconeExiste && !ctx.iconeExiste(t)) return err(`utilise l'icône inconnue « ${t} ». Choisissez un nom sur https://lucide.dev/icons (ex. "wifi", "piggy-bank").`);
      return t;
    }
    case 'liste': {
      let liste = valeur;
      if (!Array.isArray(liste)) {
        if (spec.element?.type === 'texte' || spec.element?.type === 'choix' || spec.element?.type === 'reference') {
          liste = String(liste).split(',').map((x) => x.trim()).filter(Boolean);
        } else {
          return err(`doit être une liste (chaque élément sur une ligne commençant par « - »).`);
        }
      }
      if (spec.min && liste.length < spec.min) err(`doit contenir au moins ${spec.min} élément(s).`);
      if (spec.max && liste.length > spec.max) err(`doit contenir au plus ${spec.max} élément(s).`);
      const resultat = [];
      liste.forEach((el, i) => {
        const v = valider(el, { ...spec.element, label: spec.element.label || `élément n°${i + 1}` }, ctx, [...chemin, String(i + 1)]);
        if (v !== undefined && v !== null) resultat.push(v);
      });
      if (spec.unique) {
        const vus = new Set();
        for (const v of resultat) {
          const cle = JSON.stringify(v);
          if (vus.has(cle)) ctx.rapport.avertissement(`${ctx.quoi} : ${nom} contient deux fois « ${typeof v === 'string' ? v : cle} ».`, ctx.fichier);
          vus.add(cle);
        }
      }
      return resultat;
    }
    case 'objet': {
      if (!estObjet(valeur)) return err(`doit contenir des sous-champs (lignes décalées « nom: valeur »).`);
      const resultat = {};
      const champs = spec.champs || {};
      for (const [cle, sousSpec] of Object.entries(champs)) {
        const v = valider(valeur[cle], { ...sousSpec, _cle: cle }, ctx, [...chemin, cle]);
        if (v !== undefined) resultat[cle] = v;
      }
      if (!spec.libre) {
        for (const cle of Object.keys(valeur)) {
          if (!(cle in champs) && !cle.startsWith('_')) {
            const s = suggestion(cle, Object.keys(champs));
            ctx.rapport.avertissement(
              `${ctx.quoi} : champ inconnu « ${[...chemin, cle].join('.')} » ignoré.${s ? ` Vouliez-vous dire « ${s} » ?` : ''}`,
              ctx.fichier
            );
          }
        }
      } else {
        for (const [cle, v] of Object.entries(valeur)) if (!(cle in champs)) resultat[cle] = v;
      }
      return resultat;
    }
    case 'libre':
      return valeur;
    default:
      throw new Error(`Type de champ inconnu dans le schéma : ${spec.type}`);
  }
}

function libelle(spec, chemin) {
  const cle = chemin.join('.') || spec._cle || '';
  return spec.label ? `« ${spec.label} »${cle ? ` (${cle})` : ''}` : `« ${cle} »`;
}

export { enumerer };
