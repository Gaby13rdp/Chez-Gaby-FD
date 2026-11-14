#!/usr/bin/env node
// Génère .pages.yml (configuration de l'interface d'édition Pages CMS) à
// partir des schémas de scripts/lib/schemas.mjs : le formulaire contient
// TOUS les champs, sinon Pages CMS effacerait les champs absents en
// enregistrant. Lancer après toute modification des schémas : npm run cms

import { writeFileSync, readFileSync } from 'node:fs';
import YAML from 'yaml';
import { chemin, lireYaml } from './lib/outils.mjs';
import {
  schemaLogement, schemaEtablissement, schemaDestination, schemaAvis, schemaGuide, schemaPage, schemaAccueil,
} from './lib/schemas.mjs';

const equipements = lireYaml(chemin('config/equipements.yml'));
const REFS = { etablissements: 'etablissements', destinations: 'destinations', logements: 'logements' };

function champ(nom, s) {
  const base = { name: nom, label: s.label || nom };
  if (s.aide) base.description = s.aide;
  if (s.requis) base.required = true;
  if (s.cms === false) base.hidden = true;
  if (s.defaut !== undefined && !(Array.isArray(s.defaut) && !s.defaut.length) && typeof s.defaut !== 'object') base.default = s.defaut;
  switch (s.type) {
    case 'texte': case 'url': case 'email': case 'telephone': case 'couleur': case 'heure': case 'jour-ou-date': case 'fuseau': case 'devise': case 'icone':
      if (s.type === 'icone' && !base.description) base.description = 'Nom d’icône Lucide (https://lucide.dev/icons), ex. piggy-bank';
      if (s.type === 'heure') base.description ??= 'Format 16:00';
      return { ...base, type: 'string' };
    case 'texte-long': return { ...base, type: 'text' };
    case 'nombre': return { ...base, type: 'number', ...(s.min !== undefined || s.max !== undefined ? { options: { ...(s.min !== undefined ? { min: s.min } : {}), ...(s.max !== undefined ? { max: s.max } : {}) } } : {}) };
    case 'booleen': return { ...base, type: 'boolean', default: s.defaut ?? false };
    case 'date': return { ...base, type: 'date' };
    case 'choix': {
      const valeurs = typeof s.options === 'function'
        ? Object.entries(equipements).map(([k, v]) => ({ value: k, label: v.fr }))
        : (s.cmsValeurs || s.options).filter((v) => v !== '').map(String);
      if (base.default !== undefined) base.default = String(base.default);
      return { ...base, type: 'select', options: { values: valeurs } };
    }
    case 'reference': return { ...base, type: 'reference', options: { collection: REFS[s.collection], search: 'nom', value: '{parentPath}', label: '{nom}' } };
    case 'image': return { ...base, type: 'image', options: { media: s.media || 'medias' } };
    case 'liste': {
      const el = s.element;
      if (el.type === 'objet') {
        return { ...base, type: 'object', list: s.replie ? { collapsible: { collapsed: true, summary: `{${Object.keys(el.champs)[0]}}` } } : true, fields: Object.entries(el.champs).map(([k, v]) => champ(k, v)) };
      }
      if (el.type === 'choix') {
        const c = champ(nom, el);
        return { ...base, type: 'select', options: { ...c.options, multiple: true } };
      }
      if (el.type === 'reference') return { ...base, type: 'reference', options: { collection: REFS[el.collection], search: 'nom', value: '{parentPath}', label: '{nom}', multiple: true } };
      return { ...base, type: 'string', list: true };
    }
    case 'objet': return { ...base, type: 'object', fields: Object.entries(s.champs).map(([k, v]) => champ(k, v)) };
    case 'libre': return null;
    default: throw new Error(`type non géré : ${s.type}`);
  }
}

const champs = (schema, corps = 'Description') => [
  ...Object.entries(schema.champs).map(([k, v]) => champ(k, v)).filter(Boolean),
  ...(corps ? [{ name: 'body', label: corps, type: 'rich-text', options: { format: 'markdown' } }] : []),
];

const media = (name, label, dossier) => ({ name, label, input: dossier, output: dossier, extensions: ['jpg', 'jpeg', 'png', 'webp'], rename: 'safe' });

const config = {
  media: [
    media('logements', 'Photos des logements', 'content/logements'),
    media('etablissements', 'Photos des établissements', 'content/etablissements'),
    media('destinations', 'Photos des destinations', 'content/destinations'),
    { ...media('medias', 'Images du site', 'content/medias'), output: 'medias' },
  ],
  content: [
    {
      name: 'logements', label: 'Logements', type: 'collection', path: 'content/logements',
      filename: '{fields.nom}/index.md', format: 'yaml-frontmatter', subfolders: true,
      exclude: ['photos.yml', 'index.en.md', 'index.id.md'],
      view: { layout: 'tree', node: { filename: 'index.md', hideDirs: 'others' }, primary: 'nom', fields: ['nom', 'publie', 'capacite'], search: ['nom'] },
      fields: champs(schemaLogement),
    },
    {
      name: 'etablissements', label: 'Établissements', type: 'collection', path: 'content/etablissements',
      filename: '{fields.nom}/index.md', format: 'yaml-frontmatter', subfolders: true,
      exclude: ['photos.yml', 'index.en.md', 'index.id.md'],
      view: { layout: 'tree', node: { filename: 'index.md', hideDirs: 'others' }, primary: 'nom', fields: ['nom', 'ville', 'publie'] },
      fields: champs(schemaEtablissement),
    },
    {
      name: 'destinations', label: 'Destinations', type: 'collection', path: 'content/destinations',
      filename: '{fields.nom}/index.md', format: 'yaml-frontmatter', subfolders: true,
      exclude: ['photos.yml', 'index.en.md', 'index.id.md'],
      view: { layout: 'tree', node: { filename: 'index.md', hideDirs: 'others' }, primary: 'nom', fields: ['nom', 'pays', 'publie'] },
      fields: champs(schemaDestination, 'Présentation'),
    },
    {
      name: 'avis', label: 'Avis', type: 'collection', path: 'content/avis', filename: '{year}-{month}-{fields.auteur}.md',
      format: 'yaml-frontmatter', subfolders: false,
      view: { primary: 'auteur', fields: ['auteur', 'date', 'source', 'logement'], default: { sort: 'date', order: 'desc' } },
      fields: champs(schemaAvis, "Texte de l'avis (recopié tel quel)"),
    },
    {
      name: 'accueil', label: "Page d'accueil", type: 'file', path: 'content/pages/accueil.md', format: 'yaml-frontmatter',
      fields: champs(schemaAccueil, "Texte d'introduction"),
    },
    {
      name: 'pages', label: 'Pages (À propos, FAQ, légal…)', type: 'collection', path: 'content/pages', filename: '{fields.titre}.md',
      format: 'yaml-frontmatter', subfolders: false, exclude: ['accueil.md'],
      view: { primary: 'titre', fields: ['titre'] },
      fields: champs(schemaPage, 'Contenu'),
    },
    {
      name: 'guides', label: 'Guides locaux', type: 'collection', path: 'content/guides-locaux', filename: '{fields.titre}.md',
      format: 'yaml-frontmatter', subfolders: false,
      view: { primary: 'titre', fields: ['titre', 'date', 'publie'], default: { sort: 'date', order: 'desc' } },
      fields: champs(schemaGuide, 'Article'),
    },
    { name: 'reglages', label: 'Réglages du site (avancé)', type: 'file', path: 'config/site.yml', format: 'code' },
    { name: 'catalogue', label: 'Catalogue des équipements (avancé)', type: 'file', path: 'config/equipements.yml', format: 'code' },
    { name: 'redirections', label: 'Redirections (avancé)', type: 'file', path: 'config/redirections.yml', format: 'code' },
  ],
};

const entete = [
  '# ════════════════════════════════════════════════════════════════════════════',
  '# Configuration de Pages CMS (https://pagescms.org) — interface d’édition.',
  '# FICHIER GÉNÉRÉ AUTOMATIQUEMENT par « npm run cms » à partir de',
  '# scripts/lib/schemas.mjs : ne le modifiez pas à la main.',
  '# Mode d’emploi : docs/02-utilisation-quotidienne.md',
  '# ════════════════════════════════════════════════════════════════════════════',
  '',
].join('\n');
const sortie = entete + YAML.stringify(config, { lineWidth: 0 });
const ancien = (() => { try { return readFileSync(chemin('.pages.yml'), 'utf8'); } catch { return ''; } })();
if (ancien !== sortie) writeFileSync(chemin('.pages.yml'), sortie);
console.log(`.pages.yml ${ancien === sortie ? 'déjà à jour' : 'régénéré'} (${config.content.length} rubriques).`);
