// Tests de l'analyse iCal (node --test). Lancer : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { plagesDepuisIcal, evenementsIcal, lireDuree, lignesIcal } from '../src/lib/partage/ical.js';
import { bornerPlages, fusionnerPlages } from '../src/lib/partage/disponibilites.js';

const cal = (...evenements) => ['BEGIN:VCALENDAR', 'VERSION:2.0', ...evenements.flatMap((e) => ['BEGIN:VEVENT', ...e, 'END:VEVENT']), 'END:VCALENDAR'].join('\r\n');
const paris = { fuseau: 'Europe/Paris', heureArrivee: '16:00', heureDepart: '11:00' };

test('journée entière : DTEND exclusif (la nuit du départ reste libre)', () => {
  const r = plagesDepuisIcal(cal(['DTSTART;VALUE=DATE:20261103', 'DTEND;VALUE=DATE:20261107']), paris);
  assert.deepEqual(r.plages, [['2026-11-03', '2026-11-07']]);
});

test('journée entière sans DTEND : une seule nuit', () => {
  const r = plagesDepuisIcal(cal(['DTSTART;VALUE=DATE:20261103']), paris);
  assert.deepEqual(r.plages, [['2026-11-03', '2026-11-04']]);
});

test('DURATION au lieu de DTEND', () => {
  const r = plagesDepuisIcal(cal(['DTSTART;VALUE=DATE:20261103', 'DURATION:P3D']), paris);
  assert.deepEqual(r.plages, [['2026-11-03', '2026-11-06']]);
  assert.deepEqual(lireDuree('PT2H30M'), { jours: 0, ms: 9000000 });
  assert.deepEqual(lireDuree('P1W'), { jours: 7, ms: 0 });
});

test('événement horaire avec TZID (arrivée 16 h, départ 11 h)', () => {
  const r = plagesDepuisIcal(cal(['DTSTART;TZID=Europe/Paris:20261103T160000', 'DTEND;TZID=Europe/Paris:20261107T110000']), paris);
  assert.deepEqual(r.plages, [['2026-11-03', '2026-11-07']]);
});

test('heures UTC (Z) converties dans le fuseau du logement (Bali, UTC+8)', () => {
  const bali = { fuseau: 'Asia/Makassar', heureArrivee: '14:00', heureDepart: '12:00' };
  // 07:00Z = 15:00 à Bali ; 03:00Z = 11:00 à Bali
  const r = plagesDepuisIcal(cal(['DTSTART:20261103T070000Z', 'DTEND:20261107T030000Z']), bali);
  assert.deepEqual(r.plages, [['2026-11-03', '2026-11-07']]);
  // 20:00Z le 2 = 04:00 le 3 à Bali : la nuit du 2 est occupée (le voyageur serait encore là)
  const r2 = plagesDepuisIcal(cal(['DTSTART:20261102T200000Z', 'DTEND:20261103T020000Z']), bali);
  assert.deepEqual(r2.plages, [['2026-11-02', '2026-11-03']]);
});

test('heure « flottante » (sans fuseau) = heure locale du logement', () => {
  const r = plagesDepuisIcal(cal(['DTSTART:20261103T150000', 'DTEND:20261105T100000']), paris);
  assert.deepEqual(r.plages, [['2026-11-03', '2026-11-05']]);
});

test('fuseau Windows (Outlook) reconnu', () => {
  const r = plagesDepuisIcal(cal(['DTSTART;TZID="Romance Standard Time":20261103T170000', 'DTEND;TZID="Romance Standard Time":20261104T100000']), paris);
  assert.deepEqual(r.plages, [['2026-11-03', '2026-11-04']]);
  assert.equal(r.avertissements.length, 0);
});

test('changement d’heure (fin mars) sans décalage de jour', () => {
  const r = plagesDepuisIcal(cal(['DTSTART;TZID=Europe/Paris:20260328T160000', 'DTEND;TZID=Europe/Paris:20260330T110000']), paris);
  assert.deepEqual(r.plages, [['2026-03-28', '2026-03-30']]);
});

test('événements annulés ignorés', () => {
  const r = plagesDepuisIcal(cal(['DTSTART;VALUE=DATE:20261103', 'DTEND;VALUE=DATE:20261107', 'STATUS:CANCELLED']), paris);
  assert.deepEqual(r.plages, []);
});

test('doublons et chevauchements fusionnés, plages contiguës réunies', () => {
  const r = plagesDepuisIcal(cal(
    ['DTSTART;VALUE=DATE:20261103', 'DTEND;VALUE=DATE:20261107'],
    ['DTSTART;VALUE=DATE:20261103', 'DTEND;VALUE=DATE:20261107'],
    ['DTSTART;VALUE=DATE:20261105', 'DTEND;VALUE=DATE:20261109'],
    ['DTSTART;VALUE=DATE:20261109', 'DTEND;VALUE=DATE:20261111'],
    ['DTSTART;VALUE=DATE:20261120', 'DTEND;VALUE=DATE:20261122'],
  ), paris);
  assert.deepEqual(r.plages, [['2026-11-03', '2026-11-11'], ['2026-11-20', '2026-11-22']]);
  assert.deepEqual(fusionnerPlages([['2026-01-05', '2026-01-07'], ['2026-01-01', '2026-01-03']]), [['2026-01-01', '2026-01-03'], ['2026-01-05', '2026-01-07']]);
});

test('passé ignoré et horizon respecté', () => {
  const p = bornerPlages([['2026-10-20', '2026-10-25'], ['2026-10-29', '2026-11-03'], ['2026-12-01', '2027-08-01']], '2026-10-31', '2027-05-01');
  assert.deepEqual(p, [['2026-10-31', '2026-11-03'], ['2026-12-01', '2027-05-01']]);
});

test('récurrence (RRULE) : avertissement et première occurrence bloquée', () => {
  const r = plagesDepuisIcal(cal(['DTSTART;VALUE=DATE:20261107', 'DTEND;VALUE=DATE:20261108', 'RRULE:FREQ=WEEKLY;COUNT=10']), paris);
  assert.deepEqual(r.plages, [['2026-11-07', '2026-11-08']]);
  assert.match(r.avertissements.join(' '), /RRULE/);
});

test('lignes repliées (RFC 5545) et alarmes imbriquées', () => {
  const texte = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDESCRIPTION:une très longue description qui conti\r\n nue sur la ligne suivante\r\nDTSTART;VALUE=DATE:2026\r\n 1103\r\nDTEND;VALUE=DATE:20261105\r\nBEGIN:VALARM\r\nTRIGGER:-PT15M\r\nDTSTART:19700101T000000\r\nEND:VALARM\r\nEND:VEVENT\r\nEND:VCALENDAR';
  assert.deepEqual(plagesDepuisIcal(texte, paris).plages, [['2026-11-03', '2026-11-05']]);
  assert.equal(lignesIcal('A:1\r\n B').at(0).valeur, '1B');
});

test('contenu qui n’est pas un calendrier : erreur claire', () => {
  assert.throws(() => evenementsIcal('<html>Page de connexion</html>'), /pas un calendrier iCal/);
});

test('exports réels Airbnb / Booking : seules des dates sortent (aucune donnée personnelle)', () => {
  const a = plagesDepuisIcal(readFileSync(new URL('./fixtures/airbnb.ics', import.meta.url), 'utf8'), paris);
  const b = plagesDepuisIcal(readFileSync(new URL('./fixtures/booking.ics', import.meta.url), 'utf8'), paris);
  assert.deepEqual(a.plages, [['2099-11-03', '2099-11-07'], ['2099-12-10', '2099-12-15']]);
  assert.deepEqual(b.plages, [['2099-11-07', '2099-11-10']]); // la réservation annulée est ignorée
  const sortie = JSON.stringify([a, b]);
  for (const interdit of ['Reserved', 'Phone', '1234', 'HMXXXX', 'Jean Dupont', 'airbnb.com', 'UID']) assert.ok(!sortie.includes(interdit), interdit);
  assert.deepEqual(fusionnerPlages([...a.plages, ...b.plages]), [['2099-11-03', '2099-11-10'], ['2099-12-10', '2099-12-15']]);
});
