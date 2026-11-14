// Favicon généré : l'initiale du nom sur la couleur d'accent du thème.
import { D, C } from '../lib/site';

export function GET() {
  const initiale = (C.marque.logo_texte || C.marque.nom || '?').trim().charAt(0).toUpperCase().replace(/[<&>]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${D.theme.accent}"/><text x="32" y="44" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="38" font-weight="600" fill="${D.theme.surAccent}">${initiale}</text></svg>`;
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml' } });
}
