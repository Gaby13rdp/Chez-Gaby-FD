// Conversion Markdown -> HTML (descriptions, pages, FAQ).
// Le HTML brut est désactivé : un texte saisi ne peut pas injecter de code.

import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: false,
  quotes: '«  »‹  ›',
});

// Liens externes : nouvel onglet + rel="noopener noreferrer"
const rendreLien = md.renderer.rules.link_open || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const href = tokens[idx].attrGet('href') || '';
  if (/^https?:\/\//i.test(href)) {
    tokens[idx].attrSet('target', '_blank');
    tokens[idx].attrSet('rel', 'noopener noreferrer');
  }
  return rendreLien(tokens, idx, options, env, self);
};

// Titres : le niveau le plus haut utilisé dans le texte devient le niveau
// demandé (h2 sous le titre de page, h3 dans une section). Peu importe que
// l'on écrive « ## Titre » ou « ### Titre » : la hiérarchie reste correcte
// pour les lecteurs d'écran et le référencement.
md.core.ruler.push('niveau_titres', (state) => {
  const titres = state.tokens.filter((t) => (t.type === 'heading_open' || t.type === 'heading_close') && /^h[1-6]$/.test(t.tag));
  if (!titres.length) return;
  const niveau = Number(state.env?.niveau) || 2;
  const min = Math.min(...titres.map((t) => Number(t.tag[1])));
  for (const t of titres) t.tag = 'h' + Math.max(2, Math.min(6, Number(t.tag[1]) - min + niveau));
});

// Images interdites dans les textes (les photos passent par le dossier photos/)
md.disable(['image']);

/** @param niveau niveau HTML du premier titre du texte (2 = <h2>). */
export const markdownVersHtml = (texte, niveau = 2) => (texte ? md.render(String(texte), { niveau }) : '');
export const markdownEnLigne = (texte) => (texte ? md.renderInline(String(texte)) : '');

/** Texte brut (pour les méta-descriptions). */
export function texteBrut(texte, max = 0) {
  const t = String(texte || '')
    .replace(/[#*_>`~\[\]()!|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!max || t.length <= max) return t;
  return t.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}
