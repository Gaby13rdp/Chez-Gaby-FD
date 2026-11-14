// Prestataires de paiement : Stripe Checkout (cartes, toutes devises dont EUR
// et IDR) et Xendit (paiements locaux indonésiens en IDR). Chaque prestataire
// expose : créer une page de paiement, relire un paiement, vérifier une notification.

import { ErreurPublique, egaliteConstante, fetchDelai, hmacSha256Hex } from './outils.js';

// ---------------------------------------------------------------------------
// Stripe
// ---------------------------------------------------------------------------

// Devises « sans décimales » pour l'API Stripe (montant = unité). Attention :
// IDR, HUF, TWD, ISK et UGX s'expriment en centièmes chez Stripe (× 100).
const ZERO_DECIMALE_STRIPE = new Set(['BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'VND', 'VUV', 'XAF', 'XOF', 'XPF']);

export const versMontantStripe = (montant, devise) => (ZERO_DECIMALE_STRIPE.has(String(devise).toUpperCase()) ? Math.round(montant) : Math.round(montant * 100));
export const depuisMontantStripe = (unites, devise) => (ZERO_DECIMALE_STRIPE.has(String(devise).toUpperCase()) ? unites : unites / 100);

/** Encode un objet imbriqué au format attendu par l'API Stripe (a[b][0][c]=v). */
export function encoderStripe(objet, prefixe = '', res = new URLSearchParams()) {
  for (const [k, v] of Object.entries(objet)) {
    if (v === undefined || v === null) continue;
    const cle = prefixe ? `${prefixe}[${k}]` : k;
    if (typeof v === 'object') encoderStripe(v, cle, res);
    else res.append(cle, String(v));
  }
  return res;
}

async function appelStripe(env, chemin, { methode = 'GET', parametres, idempotence } = {}) {
  const r = await fetchDelai(`https://api.stripe.com/v1/${chemin}`, {
    method: methode,
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      ...(parametres ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      ...(idempotence ? { 'Idempotency-Key': idempotence } : {}),
    },
    ...(parametres ? { body: encoderStripe(parametres).toString() } : {}),
  }, 15000);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.log(`Stripe ${methode} ${chemin.split('/')[0]} : HTTP ${r.status} ${j?.error?.message || ''}`.slice(0, 300));
    throw new Error(`Stripe a refusé la demande (HTTP ${r.status}${j?.error?.code ? `, ${j.error.code}` : ''})`);
  }
  return j;
}

export const stripe = {
  nom: 'Stripe',
  async creer(env, { montant, devise, libelle, description, urlSucces, urlAnnulation, langue, metadonnees, idempotence, expiresAt }) {
    const session = await appelStripe(env, 'checkout/sessions', {
      methode: 'POST',
      idempotence,
      parametres: {
        mode: 'payment',
        success_url: urlSucces,
        cancel_url: urlAnnulation,
        locale: ['fr', 'en', 'id'].includes(langue) ? langue : 'auto',
        // Page de paiement valable environ 1 h. Valeur identique pendant toute la fenêtre
        // d'idempotence : Stripe refuse une même clé envoyée avec des paramètres différents.
        expires_at: expiresAt || Math.floor(Date.now() / 1000) + 3600,
        phone_number_collection: { enabled: true },
        line_items: [{
          quantity: 1,
          price_data: { currency: devise.toLowerCase(), unit_amount: versMontantStripe(montant, devise), product_data: { name: libelle, description } },
        }],
        metadata: metadonnees,
        payment_intent_data: { description: `${libelle} · ${description}`.slice(0, 1000), metadata: metadonnees },
      },
    });
    if (!session.url) throw new Error('Stripe n’a pas renvoyé de page de paiement');
    return { url: session.url, id: session.id };
  },
  lireSession: (env, id) => appelStripe(env, `checkout/sessions/${encodeURIComponent(id)}`),
  lirePaiement: (env, id) => appelStripe(env, `payment_intents/${encodeURIComponent(id)}`),
  marquerTraite: (env, id) => appelStripe(env, `payment_intents/${encodeURIComponent(id)}`, { methode: 'POST', parametres: { metadata: { reservation_enregistree: 'oui' } } }),
};

/**
 * Vérifie l'en-tête « Stripe-Signature » (t=…,v1=…) : HMAC-SHA256 de « t.corps »
 * avec le secret de signature (whsec_…), et ancienneté maximale (5 min par défaut).
 */
export async function verifierSignatureStripe(corpsBrut, entete, secret, toleranceS = 300, maintenant = Date.now()) {
  if (!secret) return { ok: false, raison: 'secret de signature absent (STRIPE_WEBHOOK_SECRET)' };
  if (!entete) return { ok: false, raison: 'en-tête Stripe-Signature absent' };
  const parties = String(entete).split(',').map((p) => {
    const i = p.indexOf('=');
    return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
  });
  const t = parties.find(([k]) => k === 't')?.[1];
  const signatures = parties.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!t || !/^\d+$/.test(t) || !signatures.length) return { ok: false, raison: 'en-tête Stripe-Signature mal formé' };
  if (Math.abs(maintenant / 1000 - Number(t)) > toleranceS) return { ok: false, raison: 'signature trop ancienne (rejouée ?)' };
  const attendue = await hmacSha256Hex(secret, `${t}.${corpsBrut}`);
  return signatures.some((s) => egaliteConstante(s, attendue)) ? { ok: true } : { ok: false, raison: 'signature invalide' };
}

// ---------------------------------------------------------------------------
// Xendit (Indonésie) : factures (« Invoice API »)
// ---------------------------------------------------------------------------

async function appelXendit(env, chemin, { methode = 'GET', corps } = {}) {
  const r = await fetchDelai(`https://api.xendit.co/${chemin}`, {
    method: methode,
    headers: {
      Authorization: `Basic ${btoa(`${env.XENDIT_SECRET_KEY}:`)}`,
      ...(corps ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(corps ? { body: JSON.stringify(corps) } : {}),
  }, 15000);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.log(`Xendit ${methode} ${chemin.split('/')[1] || chemin} : HTTP ${r.status} ${j?.message || ''}`.slice(0, 300));
    throw new Error(`Xendit a refusé la demande (HTTP ${r.status}${j?.error_code ? `, ${j.error_code}` : ''})`);
  }
  return j;
}

/** Référence Xendit lisible : sd_<logement>_<arrivée>_<départ>_<adultes>-<enfants>-<animaux>_<langue>_<aléa> */
export function referenceXendit(r) {
  const alea = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
  return `sd_${r.logement}_${r.arrivee}_${r.depart}_${r.adultes}-${r.enfants}-${r.animaux}_${r.langue}_${alea}`;
}
export function lireReferenceXendit(ref) {
  const m = /^sd_([a-z0-9-]+)_(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})_(\d+)-(\d+)-(\d+)_([a-z]{2})_[a-z0-9]+$/.exec(String(ref || ''));
  return m ? { logement: m[1], arrivee: m[2], depart: m[3], adultes: +m[4], enfants: +m[5], animaux: +m[6], langue: m[7] } : null;
}

export const xendit = {
  nom: 'Xendit',
  async creer(env, { montant, devise, libelle, description, urlSucces, urlAnnulation, langue, reference }) {
    const f = await appelXendit(env, 'v2/invoices', {
      methode: 'POST',
      corps: {
        external_id: reference,
        amount: devise === 'IDR' ? Math.round(montant) : montant,
        currency: devise,
        description: `${libelle} · ${description}`.slice(0, 1000),
        invoice_duration: 3600,
        success_redirect_url: urlSucces,
        failure_redirect_url: urlAnnulation,
        locale: langue === 'id' ? 'id' : 'en',
      },
    });
    if (!f.invoice_url) throw new Error('Xendit n’a pas renvoyé de page de paiement');
    return { url: f.invoice_url, id: f.id };
  },
  lireFacture: (env, id) => appelXendit(env, `v2/invoices/${encodeURIComponent(id)}`),
};

/** Choix du prestataire selon la devise (secret PRESTATAIRE_IDR = "xendit", sinon Stripe). */
export function choisirPrestataire(env, devise) {
  const choix = String(env[`PRESTATAIRE_${String(devise).toUpperCase()}`] || env.PRESTATAIRE || 'stripe').trim().toLowerCase();
  if (choix === 'xendit') return env.XENDIT_SECRET_KEY ? { ...xendit, cle: env.XENDIT_SECRET_KEY } : null;
  return env.STRIPE_SECRET_KEY ? { ...stripe, cle: env.STRIPE_SECRET_KEY } : null;
}

export function erreurPrestataire(e) {
  return new ErreurPublique(`Le paiement n’a pas pu être préparé (${e.message}). Réessayez dans un instant ou contactez-nous.`, 502, 'prestataire');
}
