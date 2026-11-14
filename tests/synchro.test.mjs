// Test d'intégration de la synchronisation : un faux serveur iCal local,
// des « secrets » passés en variables d'environnement, et un fichier de sortie temporaire.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { ajouterJours, aujourdhui } from '../src/lib/partage/dates.js';

const executer = promisify(execFile);
const auj = aujourdhui('Europe/Paris');
const ics = (d) => d.replace(/-/g, '');
const calendrier = (debut, fin, resume) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nDTSTART;VALUE=DATE:${ics(debut)}\r\nDTEND;VALUE=DATE:${ics(fin)}\r\nSUMMARY:${resume}\r\nDESCRIPTION:Téléphone 06 12 34 56 78\r\nUID:abc@exemple\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;

const serveur = createServer((req, res) => {
  if (req.url === '/airbnb.ics') { res.writeHead(200, { 'Content-Type': 'text/calendar' }); res.end(calendrier(ajouterJours(auj, 10), ajouterJours(auj, 14), 'Reserved')); }
  else if (req.url === '/booking.ics') { res.writeHead(200, { 'Content-Type': 'text/calendar' }); res.end(calendrier(ajouterJours(auj, 14), ajouterJours(auj, 17), 'Marie Martin')); }
  else if (req.url === '/vide.ics') { res.writeHead(200, { 'Content-Type': 'text/calendar' }); res.end('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n'); }
  else if (req.url === '/introuvable.ics') { res.writeHead(404); res.end('non'); }
  else { res.writeHead(500); res.end('erreur'); }
});

async function synchro(secrets, fichier) {
  const env = { ...process.env, SYNCHRO_FICHIER: fichier, SECRETS_JSON: JSON.stringify(secrets), GITHUB_ACTIONS: '', GITHUB_OUTPUT: '', GITHUB_STEP_SUMMARY: '' };
  const { stdout } = await executer(process.execPath, ['scripts/synchro-calendriers.mjs'], { cwd: new URL('..', import.meta.url).pathname, env, timeout: 120000 });
  return { sortie: stdout, donnees: existsSync(fichier) ? JSON.parse(readFileSync(fichier, 'utf8')) : null };
}

test('synchronisation : fusion, panne partielle, conservation des dernières données valides', async () => {
  await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
  const url = (c) => `http://127.0.0.1:${serveur.address().port}/${c}`;
  const fichier = join(mkdtempSync(join(tmpdir(), 'synchro-')), 'disponibilites.json');
  try {
    // 1. Airbnb et Booking répondent, le calendrier direct est en panne -> « partiel »
    let r = await synchro({ ICAL_STUDIO_CATHEDRALE_AIRBNB: url('airbnb.ics'), ICAL_STUDIO_CATHEDRALE_BOOKING: url('booking.ics'), ICAL_STUDIO_CATHEDRALE_DIRECT: url('panne.ics') }, fichier);
    let s = r.donnees.logements['studio-cathedrale'];
    assert.equal(s.statut, 'partiel');
    assert.deepEqual(s.plages, [[ajouterJours(auj, 10), ajouterJours(auj, 17)]]);
    assert.equal(r.donnees.logements['studio-plantagenet'].statut, 'non-configure');
    const texte = readFileSync(fichier, 'utf8');
    for (const interdit of ['Reserved', 'Marie', 'Martin', '06 12', 'abc@exemple', '127.0.0.1']) assert.ok(!texte.includes(interdit), `fuite : ${interdit}`);
    assert.ok(!r.sortie.includes('127.0.0.1'), 'les liens iCal ne doivent jamais apparaître dans les journaux');

    // 2. Tous répondent -> « ok » avec date de vérification
    r = await synchro({ ICAL_STUDIO_CATHEDRALE_AIRBNB: url('airbnb.ics'), ICAL_STUDIO_CATHEDRALE_BOOKING: url('booking.ics'), ICAL_STUDIO_CATHEDRALE_DIRECT: url('vide.ics') }, fichier);
    s = r.donnees.logements['studio-cathedrale'];
    assert.equal(s.statut, 'ok');
    assert.ok(Date.now() - Date.parse(s.verifieLe) < 120000);
    const verifie = s.verifieLe;

    // 3. Plus rien ne répond -> « erreur », on garde les dates connues et l'ancienne vérification
    r = await synchro({ ICAL_STUDIO_CATHEDRALE_AIRBNB: url('introuvable.ics'), ICAL_STUDIO_CATHEDRALE_BOOKING: url('panne.ics'), ICAL_STUDIO_CATHEDRALE_DIRECT: url('panne.ics') }, fichier);
    s = r.donnees.logements['studio-cathedrale'];
    assert.equal(s.statut, 'erreur');
    assert.deepEqual(s.plages, [[ajouterJours(auj, 10), ajouterJours(auj, 17)]]);
    assert.equal(s.verifieLe, verifie);
    assert.match(r.sortie, /n'existe plus \(HTTP 404\)/);

    // 4. Secret absent : calendrier simplement ignoré
    r = await synchro({ ICAL_STUDIO_CATHEDRALE_AIRBNB: url('airbnb.ics') }, fichier);
    assert.equal(r.donnees.logements['studio-cathedrale'].statut, 'ok');
    assert.match(r.sortie, /secret ICAL_STUDIO_CATHEDRALE_BOOKING absent/);
  } finally {
    serveur.close();
  }
});
