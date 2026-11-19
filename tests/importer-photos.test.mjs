// Test du script « Importer les photos » avec un faux serveur d'images local.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { siteTemporaire } from './site-temporaire.mjs';

const executer = promisify(execFile);

test('import des photos : téléchargement, conversion, légendes, échecs et relance sans doublon', async () => {
  const jpeg = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#b48c64' } }).jpeg().toBuffer();
  const png = await sharp({ create: { width: 300, height: 400, channels: 3, background: '#4080c0' } }).png().toBuffer();
  let appels = 0;
  const serveur = createServer((req, res) => {
    appels++;
    if (req.url === '/salon.jpg') { res.writeHead(200, { 'Content-Type': 'image/jpeg' }); res.end(jpeg); }
    else if (req.url === '/chambre.png') { res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(png); }
    else if (req.url === '/page.jpg') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<html>' + 'x'.repeat(5000) + '</html>'); }
    else { res.writeHead(404); res.end('non'); }
  });
  await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
  const u = (c) => `http://127.0.0.1:${serveur.address().port}/${c}`;
  const site = siteTemporaire();
  const liste = join(site.dossier, 'liste.yml');
  writeFileSync(liste, `immeuble-test:
  photos:
    - url: ${u('salon.jpg')}
      fichier: 01-facade.jpg
      legende: "Façade"
  logements:
    immeuble-test-studio-3:
      - url: ${u('salon.jpg')}
        fichier: 01-salon.jpg
        legende: "Salon lumineux"
      - url: ${u('chambre.png')}
        fichier: 02-chambre.jpg
        legende: "Chambre"
      - url: ${u('page.jpg')}
        fichier: 03-erreur.jpg
      - url: ${u('absente.jpg')}
        fichier: 04-absente.jpg
    logement-inconnu:
      - url: ${u('salon.jpg')}
        fichier: 01-x.jpg
`);
  const env = { ...process.env, LISTE_PHOTOS: liste, IMPORT_ESSAIS_RAPIDES: '1', GITHUB_ACTIONS: '', GITHUB_STEP_SUMMARY: '', GITHUB_OUTPUT: '' };
  try {
    let { stdout } = await executer(process.execPath, ['scripts/importer-photos.mjs'], { cwd: site.dossier, env, timeout: 60000 });
    const dossier = join(site.dossier, 'content/logements/immeuble-test-studio-3/photos');
    assert.ok(existsSync(join(site.dossier, 'content/etablissements/immeuble-test/photos/01-facade.jpg')));
    assert.ok(existsSync(join(dossier, '01-salon.jpg')));
    // PNG converti en vrai JPEG
    assert.equal((await sharp(join(dossier, '02-chambre.jpg')).metadata()).format, 'jpeg');
    assert.ok(!existsSync(join(dossier, '03-erreur.jpg')), 'une page web ne doit pas être enregistrée comme photo');
    assert.match(stdout, /03-erreur\.jpg : la réponse n'est pas une image/);
    assert.match(stdout, /04-absente\.jpg : photo introuvable \(HTTP 404\)/);
    assert.match(stdout, /Dossier introuvable : créez d'abord la fiche `content\/logements\/logement-inconnu\/index\.md`/);
    assert.match(stdout, /Bilan : 3 photo\(s\) ajoutée\(s\), 0 déjà présente\(s\), 3 en échec/);
    const legendes = readFileSync(join(dossier, 'photos.yml'), 'utf8');
    assert.match(legendes, /^01-salon\.jpg: "Salon lumineux"$/m);
    assert.match(legendes, /^02-chambre\.jpg: "Chambre"$/m);
    // Relance : rien n'est re-téléchargé
    const avant = appels;
    ({ stdout } = await executer(process.execPath, ['scripts/importer-photos.mjs'], { cwd: site.dossier, env, timeout: 60000 }));
    assert.match(stdout, /Bilan : 0 photo\(s\) ajoutée\(s\), 3 déjà présente\(s\), 3 en échec/);
    assert.equal(appels - avant, 3 + 1, 'seules les photos en échec sont réessayées : 3 essais pour la page web, 1 seul pour la 404 (définitive)');
  } finally {
    serveur.close();
    site.nettoyer();
  }
});
