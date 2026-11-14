// Configuration Astro — rien à modifier ici : l'adresse du site se règle
// dans config/site.yml (« url ») ou via la variable SITE_URL.
import { defineConfig } from 'astro/config';
import { adresseSite } from './scripts/lib/adresse-site.mjs';

const adresse = adresseSite();

export default defineConfig({
  site: adresse.origine,
  base: adresse.base || '/',
  trailingSlash: 'always',
  compressHTML: true,
  build: {
    format: 'directory',
    assets: '_astro',
    inlineStylesheets: 'always',
  },
  devToolbar: { enabled: false },
  server: { host: true },
  vite: {
    build: { assetsInlineLimit: 0 },
  },
});
