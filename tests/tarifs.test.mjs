// Tests du moteur de tarifs (identique côté site et côté service de paiement).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculerDevis, prixNuit, dansPeriode, calculerTaxe, prixAPartirDe, formaterMontant, nuitsMinPour, arrondirMontant } from '../src/lib/partage/tarifs.js';

const base = (o = {}) => ({
  devise: 'EUR', arrondi: 1, remisePct: 15, remisesCumulables: false, acomptePct: 30,
  prix_nuit: 100, frais_menage: 30, voyageurs_inclus: 2, supplement_voyageur_nuit: 10,
  weekend: { nuits: [], montant: 0, pourcentage: 0 }, saisons: [], speciales: [],
  remises: { semaine_pct: 10, mois_pct: 25, anticipee_jours: 0, anticipee_pct: 0, derniere_minute_jours: 0, derniere_minute_pct: 0 },
  frais_animal: 20, caution: 300, taxe: { mode: 'aucune' }, ...o,
});

test('prix direct = prix plateforme moins la remise (15 %), arrondi à l’euro', () => {
  assert.deepEqual(prixNuit('2026-11-04', base({ prix_nuit: 82 })), { plateforme: 82, direct: 70, ferme: false, periode: null });
});

test('saisons récurrentes (MM-JJ), y compris à cheval sur deux années', () => {
  assert.ok(dansPeriode('2026-07-14', '07-01', '08-31'));
  assert.ok(!dansPeriode('2026-09-01', '07-01', '08-31'));
  assert.ok(dansPeriode('2026-12-28', '12-20', '01-05'));
  assert.ok(dansPeriode('2027-01-03', '12-20', '01-05'));
  assert.ok(!dansPeriode('2027-01-06', '12-20', '01-05'));
  assert.ok(dansPeriode('2027-06-10', '2027-06-09', '2027-06-13'));
});

test('les dates spéciales priment sur les saisons', () => {
  const t = base({ saisons: [{ nom: 'Été', du: '06-01', au: '08-31', prix_nuit: 120 }], speciales: [{ nom: '24 Heures', du: '2027-06-09', au: '2027-06-13', prix_nuit: 240, nuits_min: 3 }] });
  assert.equal(prixNuit('2027-06-10', t).plateforme, 240);
  assert.equal(prixNuit('2027-06-20', t).plateforme, 120);
  assert.equal(nuitsMinPour('2027-06-10', t), 3);
});

test('supplément week-end (montant ou pourcentage) sur les nuits de vendredi et samedi', () => {
  const t = base({ weekend: { nuits: [4, 5], montant: 10, pourcentage: 0 } });
  assert.equal(prixNuit('2026-11-06', t).plateforme, 110); // vendredi
  assert.equal(prixNuit('2026-11-08', t).plateforme, 100); // dimanche
  const t2 = base({ weekend: { nuits: [5], montant: 0, pourcentage: 20 } });
  assert.equal(prixNuit('2026-11-07', t2).plateforme, 120); // samedi
});

test('devis complet : remise semaine, ménage, voyageur en plus, acompte', () => {
  const d = calculerDevis(base(), { arrivee: '2026-11-02', depart: '2026-11-09', adultes: 3, enfants: 0 });
  assert.equal(d.nuits, 7);
  assert.equal(d.hebergement, 7 * 85);
  assert.deepEqual(d.remise, { pct: 10, montant: 59.5, motifs: ['semaine'] });
  assert.equal(d.supplementVoyageurs, 70);
  assert.equal(d.menage, 30);
  assert.equal(d.total, 595 - 59.5 + 70 + 30);
  assert.equal(d.acompte, Math.round(d.total * 0.3 * 100) / 100);
  assert.equal(d.solde, Math.round((d.total - d.acompte) * 100) / 100);
  assert.equal(d.caution, 300);
});

test('remise mois (28 nuits) remplace la remise semaine ; remises non cumulables = la meilleure', () => {
  const d = calculerDevis(base(), { arrivee: '2026-11-01', depart: '2026-11-29', adultes: 2 });
  assert.deepEqual(d.remise.motifs, ['mois']);
  const t = base({ remises: { semaine_pct: 10, mois_pct: 0, anticipee_jours: 30, anticipee_pct: 12, derniere_minute_jours: 0, derniere_minute_pct: 0 } });
  const d2 = calculerDevis(t, { arrivee: '2027-01-10', depart: '2027-01-17', adultes: 2, aujourdhui: '2026-10-31' });
  assert.deepEqual(d2.remise, { pct: 12, montant: Math.round(7 * 85 * 0.12 * 100) / 100, motifs: ['anticipee'] });
  const d3 = calculerDevis({ ...t, remisesCumulables: true }, { arrivee: '2027-01-10', depart: '2027-01-17', adultes: 2, aujourdhui: '2026-10-31' });
  assert.equal(d3.remise.pct, 22);
});

test('remise dernière minute', () => {
  const t = base({ remises: { semaine_pct: 0, mois_pct: 0, anticipee_jours: 0, anticipee_pct: 0, derniere_minute_jours: 3, derniere_minute_pct: 5 } });
  assert.equal(calculerDevis(t, { arrivee: '2026-11-02', depart: '2026-11-04', aujourdhui: '2026-10-31' }).remise.pct, 5);
  assert.equal(calculerDevis(t, { arrivee: '2026-11-10', depart: '2026-11-12', aujourdhui: '2026-10-31' }).remise.pct, 0);
});

test('taxe de séjour fixe : par adulte et par nuit, mineurs exonérés, taxe additionnelle', () => {
  assert.equal(calculerTaxe({ mode: 'fixe', montant: 1, additionnelle: 10 }, { adultes: 2, enfants: 2, nuits: 3, prixNuitMoyen: 100, devise: 'EUR' }), 6.6);
});

test('taxe de séjour proportionnelle (meublé non classé) avec plafond', () => {
  // 100 €/nuit pour 4 occupants = 25 € par personne ; 5 % = 1,25 € ; 2 adultes × 3 nuits ; +10 %
  assert.equal(calculerTaxe({ mode: 'pourcentage', pourcentage: 5, plafond: 2.3, additionnelle: 10 }, { adultes: 2, enfants: 2, nuits: 3, prixNuitMoyen: 100, devise: 'EUR' }), 8.25);
  // 400 €/nuit pour 1 adulte : 20 € plafonnés à 2,30 €
  assert.equal(calculerTaxe({ mode: 'pourcentage', pourcentage: 5, plafond: 2.3, additionnelle: 0 }, { adultes: 1, nuits: 2, prixNuitMoyen: 400, devise: 'EUR' }), 4.6);
  assert.equal(calculerTaxe({ mode: 'aucune' }, { adultes: 2, nuits: 2, prixNuitMoyen: 100, devise: 'EUR' }), 0);
});

test('roupies indonésiennes : montants entiers, acompte arrondi à 1 000 IDR', () => {
  const t = base({ devise: 'IDR', arrondi: 1000, prix_nuit: 3500000, frais_menage: 0, supplement_voyageur_nuit: 0, acomptePct: 33 });
  const d = calculerDevis(t, { arrivee: '2026-11-02', depart: '2026-11-05', adultes: 2 });
  assert.equal(d.hebergement, 3 * 2975000);
  assert.equal(d.acompte % 1000, 0);
  assert.ok(Number.isInteger(d.total));
  assert.equal(formaterMontant(2975000, 'IDR', 'id').replace(/\s/g, ' '), 'Rp 2.975.000');
  assert.equal(arrondirMontant(10.005, 'EUR'), 10.01);
});

test('période fermée signalée', () => {
  const t = base({ saisons: [{ nom: 'Travaux', du: '2026-12-01', au: '2026-12-10', ferme: true }] });
  assert.deepEqual(calculerDevis(t, { arrivee: '2026-11-29', depart: '2026-12-02' }).fermees, ['2026-12-01']);
});

test('prix « à partir de » : le plus bas des 12 prochains mois', () => {
  const t = base({ saisons: [{ nom: 'Hiver', du: '01-05', au: '02-28', prix_nuit: 60 }] });
  assert.deepEqual(prixAPartirDe(t, '2026-10-31'), { direct: 51, plateforme: 60 });
});
