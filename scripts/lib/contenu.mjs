// Chargement et validation des contenus (dossier content/).

import { existsSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import {
  chemin, lireMarkdown, lireYaml, listerDossiers, listerFichiers, slugifier, relatif, ErreurContenu, estObjet, suggestion,
} from './outils.mjs';
import { valider } from './validation.mjs';
import {
  schemaLogement, schemaEtablissement, schemaDestination, schemaAvis, schemaGuide, schemaPage, schemaAccueil, traductionsSchemas, LANGUES,
} from './schemas.mjs';
import { EXTENSIONS_IMAGES } from './images.mjs';

const C = (...p) => chemin('content', ...p);

function lireSur(fichier, rapport) {
  try { return lireMarkdown(fichier); } catch (e) {
    rapport.erreur(e instanceof ErreurContenu ? e.message : `Impossible de lire « ${relatif(fichier)} » : ${e.message}`, fichier);
    return null;
  }
}

/** Traductions : fichiers index.en.md / index.id.md (ou <slug>.en.md pour les pages). */
function lireTraductions(base, type, ctx, rapport) {
  const res = {};
  for (const l of LANGUES) {
    const f = `${base}.${l}.md`;
    if (!existsSync(f)) continue;
    const lu = lireSur(f, rapport);
    if (!lu) continue;
    const donnees = valider(lu.donnees, { type: 'objet', champs: traductionsSchemas[type] || {}, libre: true }, { ...ctx, fichier: f, quoi: `Traduction (${l}) « ${relatif(f)} »` });
    res[l] = { ...donnees, corps: lu.corps.trim() };
  }
  return res;
}

/** Collections organisées en dossiers : content/<collection>/<slug>/index.md */
function chargerDossiers(collection, schema, quoi, ctx, rapport, type) {
  const elements = [];
  for (const dossier of listerDossiers(C(collection))) {
    const fichier = C(collection, dossier, 'index.md');
    if (!existsSync(fichier)) {
      const autres = listerFichiers(C(collection, dossier), ['md']);
      rapport.erreur(`Le dossier « content/${collection}/${dossier} » ne contient pas de fichier « index.md »${autres.length ? ` (trouvé : ${autres.join(', ')} — renommez-le en index.md)` : ''}.`, C(collection, dossier));
      continue;
    }
    if (slugifier(dossier) !== dossier) {
      rapport.erreur(`Le nom de dossier « ${dossier} » doit être en minuscules, sans accents ni espaces (ex. « ${slugifier(dossier)} »). Il sert d'adresse web.`, fichier);
      continue;
    }
    const lu = lireSur(fichier, rapport);
    if (!lu) continue;
    const donnees = valider(lu.donnees, schema, { ...ctx, fichier, quoi: `${quoi} « ${dossier} »` });
    elements.push({
      slug: dossier, fichier, dossier: C(collection, dossier), corps: lu.corps.trim(), ...donnees,
      traductions: lireTraductions(C(collection, dossier, 'index'), type, ctx, rapport),
    });
  }
  return elements.sort((a, b) => (a.ordre ?? 100) - (b.ordre ?? 100) || a.slug.localeCompare(b.slug));
}

/** Photos d'un dossier (photos/) avec légendes (photos.yml + liste du formulaire). */
export function listerPhotos(dossier, legendesFormulaire = [], rapport, fichierContexte) {
  const dossierPhotos = `${dossier}/photos`;
  const fichiers = listerFichiers(dossierPhotos, EXTENSIONS_IMAGES);
  // Dossier encore vide (photos pas encore importées) : pas d'avertissement
  // sur les légendes, l'absence de photo est signalée une seule fois ailleurs.
  if (!fichiers.length) return [];
  const legendes = {};
  const fichierYml = `${dossierPhotos}/photos.yml`;
  if (existsSync(fichierYml)) {
    try {
      const y = lireYaml(fichierYml);
      if (estObjet(y)) {
        for (const [k, v] of Object.entries(y)) {
          if (!fichiers.includes(k)) {
            const s = suggestion(k, fichiers);
            rapport.avertissement(`photos.yml : la légende de « ${k} » ne correspond à aucune photo du dossier.${s ? ` Vouliez-vous dire « ${s} » ?` : ''}`, fichierYml);
          } else legendes[k] = String(v ?? '').trim();
        }
      }
    } catch (e) { rapport.erreur(e.message, fichierYml); }
  }
  // Ordre et légendes saisis dans Pages CMS (prioritaires)
  const ordre = [];
  for (const item of legendesFormulaire || []) {
    if (!item?.photo) continue;
    const nom = basename(String(item.photo));
    if (!fichiers.includes(nom)) {
      rapport.avertissement(`La photo « ${nom} » citée dans la rubrique « Photos : légendes et ordre » est introuvable dans ${relatif(dossierPhotos)}.`, fichierContexte);
      continue;
    }
    if (item.legende) legendes[nom] = item.legende;
    if (!ordre.includes(nom)) ordre.push(nom);
  }
  const tries = [...ordre, ...fichiers.filter((f) => !ordre.includes(f))];
  for (const f of fichiers) {
    if (/[A-Z\s]|[^\x00-\x7F]/.test(f)) {
      rapport.avertissement(`Nom de photo à simplifier : « ${f} » (minuscules, sans accents ni espaces, ex. « ${slugifier(f.replace(/\.[^.]+$/, ''))}.${f.split('.').pop().toLowerCase()} »).`, `${dossierPhotos}/${f}`);
    }
  }
  return tries.map((f) => ({ fichier: `${dossierPhotos}/${f}`, nom: f, legende: legendes[f] || '' }));
}

export function chargerContenus(ctx, rapport) {
  const destinations = chargerDossiers('destinations', schemaDestination, 'Destination', ctx, rapport, 'destination');
  ctx.references = { ...(ctx.references || {}), destinations: destinations.map((d) => d.slug) };

  // Les établissements doivent connaître les destinations ; les logements, les établissements.
  const etablissements = chargerDossiers('etablissements', schemaEtablissement, 'Établissement', ctx, rapport, 'etablissement');
  ctx.references.etablissements = etablissements.map((e) => e.slug);
  const logements = chargerDossiers('logements', schemaLogement, 'Logement', ctx, rapport, 'logement');
  ctx.references.logements = logements.map((l) => l.slug);

  // Avis : fichiers simples content/avis/*.md
  const avis = [];
  for (const nom of listerFichiers(C('avis'), ['md'])) {
    const fichier = C('avis', nom);
    const lu = lireSur(fichier, rapport);
    if (!lu) continue;
    const d = valider(lu.donnees, schemaAvis, { ...ctx, fichier, quoi: `Avis « ${nom} »` });
    if (!lu.corps.trim()) rapport.avertissement(`L'avis « ${nom} » n'a pas de texte.`, fichier);
    avis.push({ id: nom.replace(/\.md$/, ''), fichier, ...d, texte: lu.corps.trim() });
  }

  // Guides locaux
  const guides = [];
  for (const nom of listerFichiers(C('guides-locaux'), ['md'])) {
    if (/\.(en|id)\.md$/.test(nom)) continue;
    const fichier = C('guides-locaux', nom);
    const lu = lireSur(fichier, rapport);
    if (!lu) continue;
    const slug = nom.replace(/\.md$/, '');
    if (slugifier(slug) !== slug) { rapport.erreur(`Nom de fichier de guide invalide « ${nom} » (minuscules, sans accents ni espaces).`, fichier); continue; }
    const d = valider(lu.donnees, schemaGuide, { ...ctx, fichier, quoi: `Guide « ${slug} »` });
    guides.push({ slug, fichier, ...d, corps: lu.corps.trim() });
  }

  // Pages
  const pages = {};
  let accueil = null;
  for (const nom of listerFichiers(C('pages'), ['md'])) {
    if (/\.(en|id)\.md$/.test(nom)) continue;
    const fichier = C('pages', nom);
    const slug = nom.replace(/\.md$/, '');
    const lu = lireSur(fichier, rapport);
    if (!lu) continue;
    if (slug === 'accueil') {
      const d = valider(lu.donnees, schemaAccueil, { ...ctx, fichier, quoi: "Page d'accueil" });
      accueil = { slug, fichier, ...d, corps: lu.corps.trim(), traductions: lireTraductions(C('pages', 'accueil'), 'accueil', ctx, rapport) };
      continue;
    }
    if (slugifier(slug) !== slug) { rapport.erreur(`Nom de page invalide « ${nom} » (minuscules, sans accents ni espaces).`, fichier); continue; }
    const d = valider(lu.donnees, schemaPage, { ...ctx, fichier, quoi: `Page « ${slug} »` });
    pages[slug] = { slug, fichier, ...d, corps: lu.corps.trim(), traductions: lireTraductions(C('pages', slug), 'page', ctx, rapport) };
  }
  if (!accueil) {
    rapport.erreur("La page d'accueil « content/pages/accueil.md » est introuvable (elle contient le grand titre du site).", C('pages'));
    accueil = { titre: '', sections: {}, faq_courte: [], logements_vedette: [], traductions: {} };
  }
  for (const requise of ['mentions-legales', 'confidentialite', 'conditions-de-reservation']) {
    if (!pages[requise]) rapport.avertissement(`La page « content/pages/${requise}.md » est absente (page légale conseillée).`);
  }
  return { destinations, etablissements, logements, avis, guides, pages, accueil };
}
