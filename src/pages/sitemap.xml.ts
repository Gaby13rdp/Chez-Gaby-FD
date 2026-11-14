// Plan du site (sitemap.xml) avec les versions linguistiques (hreflang).
// Seules les pages indexables y figurent (aucune en mode démonstration).
import { D, urlAbsolue } from '../lib/site';

const echapper = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function GET() {
  const pages = D.routes.filter((r: any) => !r.noindex && r.sitemap);
  const jour = D.genereLe.slice(0, 10);
  const urls = pages.map((r: any) => {
    const alternatives = Object.entries(r.alternatives || {});
    const liens = alternatives.length > 1
      ? alternatives.map(([l, c]) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${echapper(urlAbsolue(c as string))}"/>`).join('\n') + '\n'
      : '';
    return `  <url>\n    <loc>${echapper(urlAbsolue(r.chemin))}</loc>\n${liens}    <lastmod>${jour}</lastmod>\n  </url>`;
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
