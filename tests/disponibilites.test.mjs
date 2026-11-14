import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nuitsBloquees, verifierSejour, departMaximum, datesAlternatives, sejourLibre, estPerime } from '../src/lib/partage/disponibilites.js';
import { versNum, jourSemaine, ajouterMois, aujourdhui, instantDepuisLocal } from '../src/lib/partage/dates.js';

const regles = { nuits_min: 2, nuits_max: 28, jours_arrivee: [], jours_depart: [], nuits_preparation: 0, delai_min_jours: 1, horizon_mois: 18 };
const bloquees = nuitsBloquees([['2026-11-10', '2026-11-14']]);

test('nuits bloquées et séjour libre (le jour de départ d’un voyageur est libre pour une arrivée)', () => {
  assert.ok(bloquees.has(versNum('2026-11-10')) && bloquees.has(versNum('2026-11-13')));
  assert.ok(!bloquees.has(versNum('2026-11-14')));
  assert.ok(sejourLibre('2026-11-14', '2026-11-16', bloquees));
  assert.ok(sejourLibre('2026-11-07', '2026-11-10', bloquees));
  assert.ok(!sejourLibre('2026-11-08', '2026-11-11', bloquees));
});

test('nuits de préparation autour des réservations', () => {
  const b = nuitsBloquees([['2026-11-10', '2026-11-14']], 1);
  assert.ok(b.has(versNum('2026-11-09')) && b.has(versNum('2026-11-14')) && !b.has(versNum('2026-11-15')));
});

test('départ maximum = première nuit déjà réservée', () => {
  assert.equal(departMaximum('2026-11-05', bloquees, '2027-01-01'), '2026-11-10');
  assert.equal(departMaximum('2026-11-20', bloquees, '2026-12-01'), '2026-12-01');
});

test('règles de séjour : minimum, jours d’arrivée, délai, capacité, animaux, indisponibilité', () => {
  const v = (o) => verifierSejour({ regles, capacite: 4, bloquees, aujourdhui: '2026-10-31', ...o }).map((p) => p.code);
  assert.deepEqual(v({ arrivee: '2026-11-05', depart: '2026-11-07' }), []);
  assert.deepEqual(v({ arrivee: '2026-11-05', depart: '2026-11-06' }), ['nuits-min']);
  assert.deepEqual(v({ arrivee: '2026-11-05', depart: '2026-11-08', nuitsMinSaison: 4 }), ['nuits-min']);
  assert.deepEqual(v({ arrivee: '2026-10-31', depart: '2026-11-03' }), ['trop-tot']);
  assert.deepEqual(v({ arrivee: '2026-11-05', depart: '2026-11-08', voyageurs: 5 }), ['capacite']);
  assert.deepEqual(v({ arrivee: '2026-11-05', depart: '2026-11-08', animaux: 1 }), ['animaux-refuses']);
  assert.deepEqual(v({ arrivee: '2026-11-08', depart: '2026-11-12' }), ['indisponible']);
  assert.deepEqual(v({ arrivee: '2028-06-01', depart: '2028-06-04' }), ['trop-loin']);
  assert.deepEqual(v({ arrivee: '2026-11-07', depart: '2026-11-05' }), ['depart-avant-arrivee']);
  const samedi = { ...regles, jours_arrivee: [5] };
  assert.equal(jourSemaine('2026-11-07'), 5);
  assert.deepEqual(verifierSejour({ arrivee: '2026-11-05', depart: '2026-11-08', regles: samedi, aujourdhui: '2026-10-31' }).map((p) => p.code), ['jour-arrivee']);
});

test('dates alternatives proposées autour de la période demandée', () => {
  const alt = datesAlternatives({ arrivee: '2026-11-09', depart: '2026-11-12', bloquees, regles, aujourdhui: '2026-10-31' });
  assert.ok(alt.length >= 1 && alt.length <= 3);
  for (const a of alt) assert.ok(sejourLibre(a.arrivee, a.depart, bloquees));
});

test('fraîcheur des données', () => {
  const maintenant = Date.parse('2026-10-31T12:00:00Z');
  assert.equal(estPerime('2026-10-31T08:00:00Z', 6, maintenant), false);
  assert.equal(estPerime('2026-10-31T05:00:00Z', 6, maintenant), true);
  assert.equal(estPerime(null, 6, maintenant), true);
});

test('dates : fuseaux et mois', () => {
  assert.equal(ajouterMois('2026-01-31', 1), '2026-02-28');
  assert.equal(aujourdhui('Asia/Makassar', Date.parse('2026-10-31T17:30:00Z')), '2026-11-01');
  assert.equal(aujourdhui('Europe/Paris', Date.parse('2026-10-31T17:30:00Z')), '2026-10-31');
  assert.equal(new Date(instantDepuisLocal(2026, 7, 1, 16, 0, 0, 'Europe/Paris')).toISOString(), '2026-07-01T14:00:00.000Z');
  assert.equal(new Date(instantDepuisLocal(2026, 1, 15, 16, 0, 0, 'Europe/Paris')).toISOString(), '2026-01-15T15:00:00.000Z');
});
