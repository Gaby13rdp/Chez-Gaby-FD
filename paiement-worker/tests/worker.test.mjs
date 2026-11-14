// Tests du service Cloudflare (paiement, demandes, temps réel).
// Toutes les API externes (site, Stripe, Xendit, Google, Resend, calendriers)
// sont simulées : aucun appel réseau réel, aucune vraie clé.
// Lancer : npm test (à la racine du projet)

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, generateKeyPairSync, createVerify } from 'node:crypto';
import worker from '../src/index.js';
import { viderCacheSite } from '../src/site.js';
import { viderCacheCalendriers, viderJetonsGoogle } from '../src/calendriers.js';
import { verifierSignatureStripe, versMontantStripe, lireReferenceXendit, referenceXendit } from '../src/prestataires.js';
import { aujourdhui, ajouterJours } from '../../src/lib/partage/dates.js';

const SITE = 'https://site.exemple';
const AUJ = aujourdhui('Europe/Paris');
const J = (n) => ajouterJours(AUJ, n);
const SECRET_WEBHOOK = 'whsec_test_secret_simule';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });

const reglesBase = { nuits_min: 2, nuits_max: 28, jours_arrivee: [], jours_depart: [], nuits_preparation: 0, delai_min_jours: 1, horizon_mois: 18 };
const tarifBase = { devise: 'EUR', arrondi: 1, remisePct: 0, remisesCumulables: false, acomptePct: 30, prix_nuit: 100, frais_menage: 30, voyageurs_inclus: 2, supplement_voyageur_nuit: 0, weekend: { nuits: [], montant: 0, pourcentage: 0 }, saisons: [], speciales: [], remises: {}, frais_animal: 0, caution: 0, taxe: { mode: 'aucune' } };

let TARIFS, DISPO, ICAL, appels, routes, EVENEMENTS_AGENDA;

function fixtures() {
  TARIFS = {
    genereLe: new Date().toISOString(), production: true, site: SITE, marque: 'Séjours Test', langueDefaut: 'fr',
    paiement: { niveau: 2, acomptePct: 30, soldeJours: 30, fraicheurH: 6 },
    pages: { merci: { fr: '/paiement/merci/', en: '/en/payment/merci/' }, annule: { fr: '/paiement/annule/', en: '/en/payment/annule/' } },
    logements: {
      'studio-test': { nom: 'Studio Test', capacite: 2, tarif: { ...tarifBase }, regles: { ...reglesBase }, fuseau: 'Europe/Paris', animaux: 'non', calendriers: ['ICAL_STUDIO_TEST_AIRBNB'], heureArrivee: '16:00', heureDepart: '11:00' },
      'villa-test': { nom: 'Villa Test', capacite: 6, tarif: { ...tarifBase, devise: 'IDR', arrondi: 1000, prix_nuit: 3500000, frais_menage: 0, voyageurs_inclus: 6 }, regles: { ...reglesBase }, fuseau: 'Asia/Makassar', animaux: 'non', calendriers: [], heureArrivee: '14:00', heureDepart: '12:00' },
    },
  };
  DISPO = { genereLe: new Date().toISOString(), logements: {
    'studio-test': { statut: 'ok', verifieLe: new Date().toISOString(), plages: [[J(10), J(13)]] },
    'villa-test': { statut: 'ok', verifieLe: new Date().toISOString(), plages: [] },
  } };
  const d = (x) => x.replace(/-/g, '');
  ICAL = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Test//FR', 'BEGIN:VEVENT', 'UID:abc@airbnb', `DTSTART;VALUE=DATE:${d(J(20))}`, `DTEND;VALUE=DATE:${d(J(23))}`, 'SUMMARY:Reserved - Jean Dupont HMABC123', 'DESCRIPTION:Reservation URL https://www.airbnb.fr/hosting/reservations/details/HMABC123', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}

const reponseJson = (v, statut = 200) => new Response(JSON.stringify(v), { status: statut, headers: { 'Content-Type': 'application/json' } });

function routesParDefaut() {
  return [
    { si: (u) => u === `${SITE}/donnees/tarifs.json`, alors: () => reponseJson(TARIFS) },
    { si: (u) => u === `${SITE}/donnees/disponibilites.json`, alors: () => reponseJson(DISPO) },
    { si: (u) => u === 'https://calendrier.exemple/airbnb.ics', alors: () => new Response(ICAL, { headers: { 'Content-Type': 'text/calendar' } }) },
    { si: (u, i) => u === 'https://api.stripe.com/v1/checkout/sessions' && i.method === 'POST', alors: () => reponseJson({ id: 'cs_test_123', url: 'https://checkout.stripe.com/c/pay/cs_test_123' }) },
    { si: (u) => u === 'https://api.xendit.co/v2/invoices', alors: () => reponseJson({ id: 'inv_1', invoice_url: 'https://checkout.xendit.co/web/inv_1' }) },
    { si: (u) => u === 'https://api.resend.com/emails', alors: () => reponseJson({ id: 'email_1' }) },
    { si: (u) => u === 'https://oauth2.googleapis.com/token', alors: () => reponseJson({ access_token: 'jeton-google', expires_in: 3600 }) },
    { si: (u, i) => u.startsWith('https://www.googleapis.com/calendar/v3/calendars/') && u.includes('/events?') && (i.method || 'GET') === 'GET', alors: () => reponseJson({ items: EVENEMENTS_AGENDA }) },
    { si: (u, i) => u.startsWith('https://www.googleapis.com/calendar/v3/calendars/') && (i.method || 'GET') === 'GET', alors: () => reponseJson({ error: { code: 404 } }, 404) },
    { si: (u, i) => u.startsWith('https://www.googleapis.com/calendar/v3/calendars/') && i.method === 'POST', alors: (u, i) => reponseJson({ id: JSON.parse(i.body).id, status: 'confirmed' }) },
    { si: (u) => u === 'https://challenges.cloudflare.com/turnstile/v0/siteverify', alors: (u, i) => reponseJson({ success: JSON.parse(i.body).response === 'jeton-valide' }) },
  ];
}

globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  appels.push({ url: u, init, methode: init.method || 'GET' });
  for (const r of routes) if (r.si(u, init)) return r.alors(u, init);
  return new Response('introuvable', { status: 404 });
};

beforeEach(() => {
  viderCacheSite();
  viderCacheCalendriers();
  viderJetonsGoogle();
  EVENEMENTS_AGENDA = [];
  fixtures();
  appels = [];
  routes = routesParDefaut();
});

const envBase = (plus = {}) => ({ SITE_URL: SITE, ...plus });
const ctx = { waitUntil() {} };
const appeler = (chemin, { methode = 'GET', corps, entetes = {}, env = envBase() } = {}) => worker.fetch(new Request(`https://service.exemple${chemin}`, {
  method: methode,
  headers: { ...(corps !== undefined ? { 'Content-Type': 'application/json' } : {}), ...entetes },
  ...(corps !== undefined ? { body: typeof corps === 'string' ? corps : JSON.stringify(corps) } : {}),
}), env, ctx);
const depuisSite = { Origin: SITE };
const appelsVers = (debut) => appels.filter((a) => a.url.startsWith(debut));

// ---------------------------------------------------------------------------

test('page d’état : liste les fonctions sans révéler les secrets', async () => {
  const r = await appeler('/', { env: envBase({ STRIPE_SECRET_KEY: 'sk_test_SECRETSECRET', STRIPE_WEBHOOK_SECRET: SECRET_WEBHOOK, RESEND_API_KEY: 're_SECRET', EMAIL_PROPRIETAIRE: 'proprio@exemple.fr' }) });
  assert.equal(r.status, 200);
  const t = await r.text();
  assert.match(t, /Paiement Stripe/);
  assert.match(t, /mode test/);
  assert.doesNotMatch(t, /SECRETSECRET|re_SECRET|proprio@exemple\.fr|whsec_/);
});

test('CORS : seul le site autorisé peut appeler le service depuis un navigateur', async () => {
  const ok = await appeler('/paiement/session', { methode: 'OPTIONS', entetes: { Origin: SITE, 'Access-Control-Request-Method': 'POST' } });
  assert.equal(ok.status, 204);
  assert.equal(ok.headers.get('Access-Control-Allow-Origin'), SITE);
  const ko = await appeler('/paiement/session', { methode: 'OPTIONS', entetes: { Origin: 'https://pirate.exemple' } });
  assert.equal(ko.status, 403);
  const post = await appeler('/paiement/session', { methode: 'POST', corps: {}, entetes: { Origin: 'https://pirate.exemple' } });
  assert.equal(post.status, 403);
  // Nom de domaine personnalisé : reconnu grâce à l'adresse publiée par le site
  TARIFS.site = 'https://www.mes-locations.fr';
  viderCacheSite();
  const domaine = await appeler('/paiement/session', { methode: 'OPTIONS', entetes: { Origin: 'https://www.mes-locations.fr' } });
  assert.equal(domaine.status, 204);
});

test('demande : transmise par e-mail au propriétaire, réponse directe au voyageur', async () => {
  const env = envBase({ RESEND_API_KEY: 're_test', EMAIL_PROPRIETAIRE: 'proprio@exemple.fr', EMAIL_EXPEDITEUR: 'Site <site@exemple.fr>' });
  const r = await appeler('/demande', { methode: 'POST', entetes: depuisSite, env, corps: { type: 'reservation', objet: 'Demande — Studio Test', champs: { nom: 'Marie Martin', email: 'marie@exemple.com', telephone: '0600000000' }, texte: 'Bonjour, est-ce libre ?', langue: 'fr' } });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).ok, true);
  const mails = appelsVers('https://api.resend.com/');
  assert.equal(mails.length, 1);
  const corps = JSON.parse(mails[0].init.body);
  assert.deepEqual(corps.to, ['proprio@exemple.fr']);
  assert.equal(corps.reply_to, 'marie@exemple.com');
  assert.match(corps.text, /est-ce libre/);
});

test('demande : champ piège, champs manquants, anti-robot, service non configuré', async () => {
  const env = envBase({ RESEND_API_KEY: 're_test', EMAIL_PROPRIETAIRE: 'proprio@exemple.fr', TURNSTILE_SECRET: 'ts_secret' });
  const piege = await appeler('/demande', { methode: 'POST', entetes: depuisSite, env, corps: { site_web: 'http://spam', champs: { nom: 'x', email: 'x@y.fr' }, texte: 'x' } });
  assert.equal(piege.status, 200);
  assert.equal(appelsVers('https://api.resend.com/').length, 0);
  const incomplet = await appeler('/demande', { methode: 'POST', entetes: depuisSite, env, corps: { champs: { nom: 'Marie' }, texte: 'x' } });
  assert.equal(incomplet.status, 400);
  const robot = await appeler('/demande', { methode: 'POST', entetes: depuisSite, env, corps: { champs: { nom: 'Marie', email: 'm@exemple.com' }, texte: 'x', turnstile: 'faux' } });
  assert.equal(robot.status, 403);
  const humain = await appeler('/demande', { methode: 'POST', entetes: depuisSite, env, corps: { champs: { nom: 'Marie', email: 'm@exemple.com' }, texte: 'x', turnstile: 'jeton-valide' } });
  assert.equal(humain.status, 200);
  const sansConfig = await appeler('/demande', { methode: 'POST', entetes: depuisSite, corps: { champs: { nom: 'Marie', email: 'm@exemple.com' }, texte: 'x' } });
  assert.equal(sansConfig.status, 503);
});

test('disponibilités en direct : uniquement des dates, union avec les données publiées', async () => {
  const env = envBase({ ICAL_STUDIO_TEST_AIRBNB: 'https://calendrier.exemple/airbnb.ics' });
  const r = await appeler(`/disponibilites?logement=studio-test`, { entetes: depuisSite, env });
  assert.equal(r.status, 200);
  const texte = await r.text();
  assert.doesNotMatch(texte, /Dupont|HMABC123|airbnb/i);
  const j = JSON.parse(texte);
  assert.equal(j.statut, 'ok');
  assert.deepEqual(j.plages, [[J(10), J(13)], [J(20), J(23)]]);
  const sansSecret = await appeler(`/disponibilites?logement=studio-test`, { entetes: depuisSite });
  assert.equal(sansSecret.status, 404);
  const inconnu = await appeler(`/disponibilites?logement=../../etc`, { entetes: depuisSite, env });
  assert.equal(inconnu.status, 404);
});

test('session de paiement : montant recalculé côté serveur (le navigateur ne décide pas du prix)', async () => {
  const env = envBase({ STRIPE_SECRET_KEY: 'sk_live_simule', ICAL_STUDIO_TEST_AIRBNB: 'https://calendrier.exemple/airbnb.ics' });
  const r = await appeler('/paiement/session', { methode: 'POST', entetes: depuisSite, env, corps: { logement: 'studio-test', arrivee: J(30), depart: J(33), adultes: 2, enfants: 0, animaux: 0, langue: 'fr', montant: 1, total: 1 } });
  assert.equal(r.status, 200, await r.clone().text());
  const j = await r.json();
  assert.equal(j.url, 'https://checkout.stripe.com/c/pay/cs_test_123');
  assert.equal(j.total, 330); // 3 nuits × 100 + ménage 30
  assert.equal(j.montant, 99); // acompte 30 %
  const appel = appelsVers('https://api.stripe.com/v1/checkout/sessions')[0];
  const p = new URLSearchParams(appel.init.body);
  assert.equal(p.get('line_items[0][price_data][unit_amount]'), '9900');
  assert.equal(p.get('line_items[0][price_data][currency]'), 'eur');
  assert.equal(p.get('metadata[logement]'), 'studio-test');
  assert.equal(p.get('metadata[total]'), '330');
  assert.equal(p.get('success_url'), `${SITE}/paiement/merci/`);
  assert.equal(p.get('mode'), 'payment');
  assert.ok(appel.init.headers['Idempotency-Key']);
});

test('session de paiement : dates déjà prises (publiées ou lues en direct) et règles non respectées', async () => {
  const env = envBase({ STRIPE_SECRET_KEY: 'sk_live_simule', ICAL_STUDIO_TEST_AIRBNB: 'https://calendrier.exemple/airbnb.ics' });
  const prisEnDirect = await appeler('/paiement/session', { methode: 'POST', entetes: depuisSite, env, corps: { logement: 'studio-test', arrivee: J(21), depart: J(24), adultes: 2 } });
  assert.equal(prisEnDirect.status, 409);
  assert.equal((await prisEnDirect.json()).code, 'indisponible');
  const prisPublie = await appeler('/paiement/session', { methode: 'POST', entetes: depuisSite, env, corps: { logement: 'studio-test', arrivee: J(11), depart: J(14), adultes: 2 } });
  assert.equal((await prisPublie.json()).code, 'indisponible');
  const uneNuit = await appeler('/paiement/session', { methode: 'POST', entetes: depuisSite, env, corps: { logement: 'studio-test', arrivee: J(40), depart: J(41), adultes: 2 } });
  assert.equal(uneNuit.status, 409);
  const j = await uneNuit.json();
  assert.equal(j.code, 'regles');
  assert.match(j.message, /durée minimale/);
  const tropNombreux = await appeler('/paiement/session', { methode: 'POST', entetes: depuisSite, env, corps: { logement: 'studio-test', arrivee: J(40), depart: J(43), adultes: 3 } });
  assert.equal((await tropNombreux.json()).code, 'regles');
  assert.equal(appelsVers('https://api.stripe.com/').length, 0);
});

test('session de paiement : désactivée, non configurée, données périmées, site de démonstration', async () => {
  const corps = { logement: 'studio-test', arrivee: J(30), depart: J(33), adultes: 2 };
  TARIFS.paiement.niveau = 1;
  let r = await appeler('/paiement/session', { methode: 'POST', entetes: depuisSite, env: envBase({ STRIPE_SECRET_KEY: 'sk_live_simule' }), corps });
  assert.equal((await r.json()).code, 'inactif');

  viderCacheSite(); fixtures();
  r = await appeler('/paiement/session', { methode: 'POST', entetes: depuisSite, corps });
  assert.equal((await r.json()).code, 'non-configure');

  viderCacheSite(); fixtures();
  DISPO.logements['studio-test'].verifieLe = new Date(Date.now() - 10 * 3600 * 1000).toISOString();
  r = await appeler('/paiement/session', { methode: 'POST', entetes: depuisSite, env: envBase({ STRIPE_SECRET_KEY: 'sk_live_simule' }), corps });
  assert.equal((await r.json()).code, 'perime');

  // Site réel avec une clé de TEST : refusé (un paiement fictif ne doit rien bloquer)
  viderCacheSite(); fixtures();
  r = await appeler('/paiement/session', { methode: 'POST', entetes: depuisSite, env: envBase({ STRIPE_SECRET_KEY: 'sk_test_simule' }), corps });
  assert.equal(r.status, 503);
  assert.equal((await r.json()).code, 'non-configure');

  viderCacheSite(); fixtures();
  TARIFS.production = false;
  DISPO.logements['studio-test'].statut = 'exemple';
  r = await appeler('/paiement/session', { methode: 'POST', entetes: depuisSite, env: envBase({ STRIPE_SECRET_KEY: 'sk_live_reelle' }), corps });
  assert.equal((await r.json()).code, 'demo');
  r = await appeler('/paiement/session', { methode: 'POST', entetes: depuisSite, env: envBase({ STRIPE_SECRET_KEY: 'sk_test_simule' }), corps });
  assert.equal(r.status, 200);
});

test('villa à Bali : roupies (IDR) via Stripe (×100) ou via Xendit', async () => {
  const corps = { logement: 'villa-test', arrivee: J(30), depart: J(33), adultes: 4, langue: 'en' };
  let r = await appeler('/paiement/session', { methode: 'POST', entetes: depuisSite, env: envBase({ STRIPE_SECRET_KEY: 'sk_live_simule' }), corps });
  assert.equal(r.status, 200);
  let p = new URLSearchParams(appelsVers('https://api.stripe.com/')[0].init.body);
  assert.equal(p.get('line_items[0][price_data][currency]'), 'idr');
  assert.equal(p.get('line_items[0][price_data][unit_amount]'), String(3150000 * 100));
  assert.equal(p.get('success_url'), `${SITE}/en/payment/merci/`);
  assert.equal(p.get('locale'), 'en');

  appels = [];
  r = await appeler('/paiement/session', { methode: 'POST', entetes: depuisSite, env: envBase({ STRIPE_SECRET_KEY: 'sk_live_simule', XENDIT_SECRET_KEY: 'xnd_production_simule', PRESTATAIRE_IDR: 'xendit' }), corps });
  assert.equal((await r.json()).url, 'https://checkout.xendit.co/web/inv_1');
  const facture = JSON.parse(appelsVers('https://api.xendit.co/')[0].init.body);
  assert.equal(facture.amount, 3150000);
  assert.equal(facture.currency, 'IDR');
  assert.deepEqual(lireReferenceXendit(facture.external_id), { logement: 'villa-test', arrivee: J(30), depart: J(33), adultes: 4, enfants: 0, animaux: 0, langue: 'en' });
  assert.equal(appelsVers('https://api.stripe.com/').length, 0);
});

test('montants Stripe : devises à décimales et sans décimales', () => {
  assert.equal(versMontantStripe(99.5, 'EUR'), 9950);
  assert.equal(versMontantStripe(3150000, 'IDR'), 315000000);
  assert.equal(versMontantStripe(5000, 'JPY'), 5000);
  const ref = referenceXendit({ logement: 'villa-kayu-manis', arrivee: '2027-01-02', depart: '2027-01-09', adultes: 2, enfants: 1, animaux: 0, langue: 'fr' });
  assert.equal(lireReferenceXendit(ref).logement, 'villa-kayu-manis');
  assert.equal(lireReferenceXendit('autre-chose'), null);
});

// ---------------------------------------------------------------------------
// Notifications Stripe (webhooks)
// ---------------------------------------------------------------------------

function signer(corps, t = Math.floor(Date.now() / 1000), secret = SECRET_WEBHOOK) {
  return `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${corps}`).digest('hex')}`;
}

test('signature Stripe : valide, falsifiée, trop ancienne, absente', async () => {
  const corps = '{"id":"evt_1"}';
  assert.equal((await verifierSignatureStripe(corps, signer(corps), SECRET_WEBHOOK)).ok, true);
  assert.equal((await verifierSignatureStripe(corps + ' ', signer(corps), SECRET_WEBHOOK)).ok, false);
  assert.equal((await verifierSignatureStripe(corps, signer(corps, Math.floor(Date.now() / 1000) - 900), SECRET_WEBHOOK)).ok, false);
  assert.equal((await verifierSignatureStripe(corps, signer(corps, undefined, 'whsec_autre'), SECRET_WEBHOOK)).ok, false);
  assert.equal((await verifierSignatureStripe(corps, '', SECRET_WEBHOOK)).ok, false);
  assert.equal((await verifierSignatureStripe(corps, 't=abc,v1=00', SECRET_WEBHOOK)).ok, false);
});

function envPaiement(plus = {}) {
  return envBase({
    STRIPE_SECRET_KEY: 'sk_test_simule', STRIPE_WEBHOOK_SECRET: SECRET_WEBHOOK,
    RESEND_API_KEY: 're_test', EMAIL_PROPRIETAIRE: 'proprio@exemple.fr',
    GOOGLE_SERVICE_ACCOUNT: JSON.stringify({ client_email: 'site@projet.iam.gserviceaccount.com', private_key: privateKey }),
    GCAL_STUDIO_TEST: 'agenda-studio@group.calendar.google.com',
    COORDONNEES_BANCAIRES: 'IBAN FR76 0000 0000 0000 (EXEMPLE)',
    ...plus,
  });
}

function preparerSessionStripe({ dejaTraite = false, arrivee = J(30), depart = J(33), livemode = true } = {}) {
  const session = {
    id: 'cs_test_123', object: 'checkout.session', livemode, payment_status: 'paid', amount_total: 9900, currency: 'eur', payment_intent: 'pi_1',
    customer_details: { email: 'marie@exemple.com', name: 'Marie Martin', phone: '+33600000000' },
    metadata: { source: 'site-direct', logement: 'studio-test', arrivee, depart, adultes: '2', enfants: '0', animaux: '0', langue: 'fr', total: '330', paye: '99', devise: 'EUR' },
  };
  routes.unshift(
    { si: (u) => u === 'https://api.stripe.com/v1/checkout/sessions/cs_test_123', alors: () => reponseJson(session) },
    { si: (u, i) => u === 'https://api.stripe.com/v1/payment_intents/pi_1' && (i.method || 'GET') === 'GET', alors: () => reponseJson({ id: 'pi_1', metadata: dejaTraite ? { reservation_enregistree: 'oui' } : {} }) },
    { si: (u, i) => u === 'https://api.stripe.com/v1/payment_intents/pi_1' && i.method === 'POST', alors: () => reponseJson({ id: 'pi_1' }) },
  );
  const evt = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', data: { object: { id: 'cs_test_123' } } });
  return { evt, signature: signer(evt) };
}

test('paiement confirmé : dates bloquées dans Google Agenda, e-mails envoyés une seule fois', async () => {
  const { evt, signature } = preparerSessionStripe();
  const r = await appeler('/paiement/webhook/stripe', { methode: 'POST', corps: evt, entetes: { 'Stripe-Signature': signature }, env: envPaiement() });
  assert.equal(r.status, 200, await r.clone().text());
  const j = await r.json();
  assert.equal(j.statut, 'enregistre');
  assert.equal(j.agenda, 'ajoute');

  // Jeton Google : JWT RS256 correctement signé avec la clé du compte de service
  const assertion = new URLSearchParams(appelsVers('https://oauth2.googleapis.com/token')[0].init.body).get('assertion');
  const [h, c, s] = assertion.split('.');
  const verif = createVerify('RSA-SHA256'); verif.update(`${h}.${c}`);
  assert.ok(verif.verify(publicKey, Buffer.from(s, 'base64url')));
  assert.equal(JSON.parse(Buffer.from(c, 'base64url')).scope, 'https://www.googleapis.com/auth/calendar.events');

  const ajout = appelsVers('https://www.googleapis.com/calendar/v3/').find((a) => a.methode === 'POST');
  const ev = JSON.parse(ajout.init.body);
  assert.deepEqual([ev.start.date, ev.end.date], [J(30), J(33)]);
  assert.match(ev.id, /^sd[0-9a-f]{40}$/);
  assert.doesNotMatch(JSON.stringify(ev), /Marie|marie@/); // pas de données personnelles dans l'agenda

  const mails = appelsVers('https://api.resend.com/');
  assert.equal(mails.length, 2);
  const [proprio, voyageur] = mails.map((m) => ({ corps: JSON.parse(m.init.body), cle: m.init.headers['Idempotency-Key'] }));
  assert.deepEqual(proprio.corps.to, ['proprio@exemple.fr']);
  assert.equal(proprio.cle, 'cs_test_123-proprietaire');
  assert.match(proprio.corps.subject, /Réservation payée/);
  assert.match(proprio.corps.text, /reste à payer : 231\D/);
  assert.deepEqual(voyageur.corps.to, ['marie@exemple.com']);
  assert.equal(voyageur.cle, 'cs_test_123-voyageur');
  assert.match(voyageur.corps.text, /IBAN FR76/); // coordonnées bancaires : par e-mail uniquement
  assert.ok(appels.some((a) => a.url === 'https://api.stripe.com/v1/payment_intents/pi_1' && a.methode === 'POST'));
});

test('notification reçue deux fois : aucun doublon (agenda, e-mails)', async () => {
  const { evt, signature } = preparerSessionStripe({ dejaTraite: true });
  const r = await appeler('/paiement/webhook/stripe', { methode: 'POST', corps: evt, entetes: { 'Stripe-Signature': signature }, env: envPaiement() });
  assert.equal((await r.json()).statut, 'deja-traite');
  assert.equal(appelsVers('https://api.resend.com/').length, 0);
  assert.equal(appelsVers('https://www.googleapis.com/').length, 0);

  // Événement déjà présent dans l'agenda (marquage Stripe perdu) : pas de second blocage,
  // e-mails renvoyés avec les mêmes clés d'idempotence (Resend ignore les doublons)
  viderCacheSite(); appels = []; routes = routesParDefaut();
  const s2 = preparerSessionStripe();
  routes.unshift({ si: (u, i) => /\/events\/sd[0-9a-f]+$/.test(u) && (i.method || 'GET') === 'GET', alors: () => reponseJson({ id: 'sdx', status: 'confirmed' }) });
  const r2 = await appeler('/paiement/webhook/stripe', { methode: 'POST', corps: s2.evt, entetes: { 'Stripe-Signature': s2.signature }, env: envPaiement() });
  assert.equal((await r2.json()).statut, 'renvoye');
  assert.equal(appelsVers('https://www.googleapis.com/calendar/v3/').filter((a) => a.methode === 'POST').length, 0);
  assert.deepEqual(appelsVers('https://api.resend.com/').map((m) => m.init.headers['Idempotency-Key']), ['cs_test_123-proprietaire', 'cs_test_123-voyageur']);
});

test('conflit de dates découvert après paiement : alerte, pas de blocage, pas de coordonnées bancaires', async () => {
  const { evt, signature } = preparerSessionStripe({ arrivee: J(21), depart: J(24) });
  const r = await appeler('/paiement/webhook/stripe', { methode: 'POST', corps: evt, entetes: { 'Stripe-Signature': signature }, env: envPaiement({ ICAL_STUDIO_TEST_AIRBNB: 'https://calendrier.exemple/airbnb.ics' }) });
  assert.equal((await r.json()).statut, 'conflit');
  assert.equal(appelsVers('https://www.googleapis.com/calendar/v3/').filter((a) => a.methode === 'POST').length, 0);
  const [proprio, voyageur] = appelsVers('https://api.resend.com/').map((m) => JSON.parse(m.init.body));
  assert.match(proprio.subject, /CONFLIT/);
  assert.match(voyageur.text, /revérifions la disponibilité/);
  assert.doesNotMatch(voyageur.text, /IBAN/);
});

test('webhook refusé si signature invalide ; erreur 500 si personne n’a pu être prévenu', async () => {
  const { evt } = preparerSessionStripe();
  const faux = await appeler('/paiement/webhook/stripe', { methode: 'POST', corps: evt, entetes: { 'Stripe-Signature': signer(evt, undefined, 'whsec_pirate') }, env: envPaiement() });
  assert.equal(faux.status, 400);
  assert.equal(appelsVers('https://api.stripe.com/').length, 0);

  routes.unshift({ si: (u) => u === 'https://api.resend.com/emails', alors: () => reponseJson({ message: 'clé invalide' }, 401) });
  const s = preparerSessionStripe();
  const r = await appeler('/paiement/webhook/stripe', { methode: 'POST', corps: s.evt, entetes: { 'Stripe-Signature': s.signature }, env: envPaiement() });
  assert.equal(r.status, 500); // Stripe renverra la notification plus tard
  assert.ok(!appels.some((a) => a.url === 'https://api.stripe.com/v1/payment_intents/pi_1' && a.methode === 'POST'));
});

test('Xendit : jeton de notification vérifié, facture relue chez Xendit', async () => {
  const ref = referenceXendit({ logement: 'villa-test', arrivee: J(30), depart: J(33), adultes: 2, enfants: 0, animaux: 0, langue: 'id' });
  routes.unshift({ si: (u) => u === 'https://api.xendit.co/v2/invoices/inv_1', alors: () => reponseJson({ id: 'inv_1', status: 'PAID', external_id: ref, amount: 3150000, paid_amount: 3150000, currency: 'IDR', payer_email: 'tamu@exemple.id' }) });
  const env = envBase({ XENDIT_SECRET_KEY: 'xnd_production_simule', XENDIT_WEBHOOK_TOKEN: 'jeton-xendit', RESEND_API_KEY: 're_test', EMAIL_PROPRIETAIRE: 'proprio@exemple.fr' });
  const faux = await appeler('/paiement/webhook/xendit', { methode: 'POST', corps: { id: 'inv_1', status: 'PAID' }, entetes: { 'x-callback-token': 'mauvais' }, env });
  assert.equal(faux.status, 401);
  const r = await appeler('/paiement/webhook/xendit', { methode: 'POST', corps: { id: 'inv_1', status: 'PAID' }, entetes: { 'x-callback-token': 'jeton-xendit' }, env });
  assert.equal(r.status, 200, await r.clone().text());
  const mails = appelsVers('https://api.resend.com/').map((m) => JSON.parse(m.init.body));
  assert.equal(mails.length, 2);
  assert.match(mails[1].subject, /Pemesanan dikonfirmasi/);
  assert.match(mails[0].text, /BLOQUEZ CES DATES/); // agenda Google non relié pour la villa
});

// ---------------------------------------------------------------------------
// Corrections issues de la revue indépendante
// ---------------------------------------------------------------------------

test('revue M1 : un e-mail en échec puis une nouvelle notification → les e-mails partent quand même', async () => {
  let tentative = 0;
  routes.unshift({ si: (u) => u === 'https://api.resend.com/emails', alors: () => (++tentative <= 2 ? reponseJson({ message: 'panne' }, 500) : reponseJson({ id: 'ok' })) });
  const s1 = preparerSessionStripe();
  const r1 = await appeler('/paiement/webhook/stripe', { methode: 'POST', corps: s1.evt, entetes: { 'Stripe-Signature': s1.signature }, env: envPaiement() });
  assert.equal(r1.status, 500);
  const idCree = JSON.parse(appelsVers('https://www.googleapis.com/calendar/v3/').find((a) => a.methode === 'POST').init.body).id;
  // Seconde notification de Stripe : l'événement existe désormais
  appels = [];
  routes.unshift({ si: (u, i) => u.endsWith(`/events/${idCree}`) && (i.method || 'GET') === 'GET', alors: () => reponseJson({ id: idCree, status: 'confirmed' }) });
  const s2 = preparerSessionStripe();
  const r2 = await appeler('/paiement/webhook/stripe', { methode: 'POST', corps: s2.evt, entetes: { 'Stripe-Signature': s2.signature }, env: envPaiement() });
  assert.equal(r2.status, 200);
  assert.equal((await r2.json()).statut, 'renvoye');
  assert.equal(appelsVers('https://api.resend.com/').length, 2);
  assert.equal(appelsVers('https://www.googleapis.com/calendar/v3/').filter((a) => a.methode === 'POST').length, 0);
});

test('revue M2 : un seul calendrier sur deux lu en direct → les données publiées doivent être récentes', async () => {
  TARIFS.logements['studio-test'].calendriers = ['ICAL_STUDIO_TEST_AIRBNB', 'ICAL_STUDIO_TEST_BOOKING'];
  DISPO.logements['studio-test'] = { statut: 'erreur', verifieLe: new Date(Date.now() - 5 * 86400000).toISOString(), plages: [] };
  const env = envBase({ STRIPE_SECRET_KEY: 'sk_live_simule', ICAL_STUDIO_TEST_AIRBNB: 'https://calendrier.exemple/airbnb.ics' });
  const r = await appeler('/paiement/session', { methode: 'POST', entetes: depuisSite, env, corps: { logement: 'studio-test', arrivee: J(30), depart: J(33), adultes: 2 } });
  assert.equal(r.status, 409);
  assert.equal((await r.json()).code, 'perime');
  const d = await (await appeler('/disponibilites?logement=studio-test', { entetes: depuisSite, env })).json();
  assert.equal(d.statut, 'partiel');
});

test('revue M3 : paiement de test → agenda réel intact, pas de coordonnées bancaires, mention [TEST]', async () => {
  const { evt, signature } = preparerSessionStripe({ livemode: false });
  const r = await appeler('/paiement/webhook/stripe', { methode: 'POST', corps: evt, entetes: { 'Stripe-Signature': signature }, env: envPaiement() });
  const j = await r.json();
  assert.equal(r.status, 200);
  assert.equal(j.agenda, 'non-configure'); // GCAL_TEST absent : rien n'est bloqué
  assert.equal(appelsVers('https://www.googleapis.com/calendar/v3/').filter((a) => a.methode === 'POST').length, 0);
  const [proprio, voyageur] = appelsVers('https://api.resend.com/').map((m) => JSON.parse(m.init.body));
  assert.match(proprio.subject, /^\[TEST\]/);
  assert.match(voyageur.subject, /^\[TEST\]/);
  assert.doesNotMatch(voyageur.text, /IBAN/);
  // Avec un agenda de test : c'est lui (et lui seul) qui reçoit l'événement
  viderCacheSite(); appels = []; routes = routesParDefaut();
  const s2 = preparerSessionStripe({ livemode: false });
  await appeler('/paiement/webhook/stripe', { methode: 'POST', corps: s2.evt, entetes: { 'Stripe-Signature': s2.signature }, env: envPaiement({ GCAL_TEST: 'agenda-test@group.calendar.google.com' }) });
  const ajout = appelsVers('https://www.googleapis.com/calendar/v3/').find((a) => a.methode === 'POST');
  assert.ok(ajout.url.includes(encodeURIComponent('agenda-test@group.calendar.google.com')));
});

test('revue M4 : réservation déjà notée dans l’agenda Google → paiement refusé, et conflit détecté après paiement', async () => {
  EVENEMENTS_AGENDA = [{ id: 'resa-directe', status: 'confirmed', start: { date: J(31) }, end: { date: J(33) } }];
  const env = envPaiement({ STRIPE_SECRET_KEY: 'sk_live_simule' });
  const r = await appeler('/paiement/session', { methode: 'POST', entetes: depuisSite, env, corps: { logement: 'studio-test', arrivee: J(30), depart: J(33), adultes: 2 } });
  assert.equal(r.status, 409);
  assert.equal((await r.json()).code, 'indisponible');
  // Deux voyageurs payent presque en même temps : le second paiement est signalé en conflit
  const { evt, signature } = preparerSessionStripe();
  const w = await appeler('/paiement/webhook/stripe', { methode: 'POST', corps: evt, entetes: { 'Stripe-Signature': signature }, env: envPaiement() });
  assert.equal((await w.json()).statut, 'conflit');
  assert.equal(appelsVers('https://www.googleapis.com/calendar/v3/').filter((a) => a.methode === 'POST').length, 0);
  // Un événement horaire qui ne touche pas les nuits demandées n'empêche rien
  EVENEMENTS_AGENDA = [{ id: 'menage', status: 'confirmed', start: { dateTime: `${J(33)}T12:00:00+01:00` }, end: { dateTime: `${J(33)}T14:00:00+01:00` } }];
  viderCacheSite(); appels = [];
  const ok = await appeler('/paiement/session', { methode: 'POST', entetes: depuisSite, env, corps: { logement: 'studio-test', arrivee: J(30), depart: J(33), adultes: 2 } });
  assert.equal(ok.status, 200, await ok.clone().text());
});

test('revue L1 : double clic → même clé d’idempotence ET mêmes paramètres envoyés à Stripe', async () => {
  const env = envBase({ STRIPE_SECRET_KEY: 'sk_live_simule' });
  const corps = { logement: 'studio-test', arrivee: J(30), depart: J(33), adultes: 2 };
  await appeler('/paiement/session', { methode: 'POST', entetes: depuisSite, env, corps });
  await new Promise((r) => setTimeout(r, 1100));
  await appeler('/paiement/session', { methode: 'POST', entetes: depuisSite, env, corps });
  const [a, b] = appelsVers('https://api.stripe.com/v1/checkout/sessions');
  if (a.init.headers['Idempotency-Key'] === b.init.headers['Idempotency-Key']) assert.equal(a.init.body, b.init.body);
});

test('revue L2 : plusieurs visites rapprochées → un seul téléchargement du calendrier', async () => {
  const env = envBase({ ICAL_STUDIO_TEST_AIRBNB: 'https://calendrier.exemple/airbnb.ics' });
  for (let i = 0; i < 5; i++) await appeler('/disponibilites?logement=studio-test', { entetes: depuisSite, env });
  assert.equal(appelsVers('https://calendrier.exemple/').length, 1);
});
