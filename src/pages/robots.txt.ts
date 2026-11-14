// robots.txt : en démonstration, les pages sont marquées « noindex » (les
// robots doivent pouvoir les lire pour en tenir compte) ; en production,
// le plan du site est indiqué.
import { D, urlAbsolue } from '../lib/site';

export function GET() {
  const lignes = ['User-agent: *', 'Allow: /'];
  if (D.production) lignes.push('', `Sitemap: ${urlAbsolue('sitemap.xml')}`);
  return new Response(lignes.join('\n') + '\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
