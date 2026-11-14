// SERVICE CLOUDFLARE (facultatif) — paiement, demandes, disponibilités en direct
// ---------------------------------------------------------------------------
//  GET  /                       page d'état (ce qui est configuré, sans aucun secret)
//  GET  /sante                  même chose en JSON
//  POST /demande                formulaire du site (si formulaire.prestataire = worker)
//  GET  /disponibilites?logement=…  dates bloquées en direct (calendrier.temps_reel)
//  POST /paiement/session       ouvre une page de paiement (paiement.niveau = 2)
//  POST /paiement/webhook/stripe   notification signée de Stripe
//  POST /paiement/webhook/xendit   notification de Xendit
// Toutes les clés sont des SECRETS du service (tableau de bord Cloudflare),
// jamais dans le dépôt GitHub. Voir docs/07-paiement-option.md.

import { ErreurPublique, VERSION, echapperHtml, html, json, lireJson, originesAutorisees } from './outils.js';
import { traiterDemande } from './demande.js';
import { creerSessionPaiement, webhookStripe, webhookXendit } from './paiement.js';
import { disponibilitesActuelles, lireCompteGoogle } from './calendriers.js';
import { logementSite, tarifsSite } from './site.js';
import { canauxNotification, emailConfigure } from './messages.js';

function etat(env) {
  return {
    service: 'paiement-worker',
    version: VERSION,
    site: env.SITE_URL || null,
    fonctions: {
      demandes_par_email: emailConfigure(env),
      notifications: canauxNotification(env),
      anti_robot_turnstile: Boolean(env.TURNSTILE_SECRET),
      paiement_stripe: Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET),
      paiement_stripe_mode: env.STRIPE_SECRET_KEY ? (/_live_/.test(env.STRIPE_SECRET_KEY) ? 'réel' : 'test') : null,
      paiement_xendit: Boolean(env.XENDIT_SECRET_KEY && env.XENDIT_WEBHOOK_TOKEN),
      agenda_google: Boolean(lireCompteGoogle(env)),
      calendriers_en_direct: Object.keys(env).filter((k) => /^ICAL_[A-Z0-9_]+$/.test(k)).length,
      coordonnees_bancaires_par_email: Boolean(env.COORDONNEES_BANCAIRES),
    },
  };
}

function pageEtat(env) {
  const e = etat(env);
  const f = e.fonctions;
  const ligne = (ok, titre, aide) => `<li><span aria-hidden="true">${ok ? '✅' : '➖'}</span> <strong>${echapperHtml(titre)}</strong>${aide ? ` — <span>${echapperHtml(aide)}</span>` : ''}</li>`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Service du site — état</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:46rem;margin:2rem auto;padding:0 1rem;color:#222}li{margin:.4rem 0;list-style:none}ul{padding:0}code{background:#f3f3f3;padding:.1rem .3rem;border-radius:4px}</style></head><body>
<h1>Service du site : en ligne</h1>
<p>Site relié : ${e.site ? `<code>${echapperHtml(e.site)}</code>` : '<strong>aucun (redéployez avec le workflow « Déployer le service Cloudflare »)</strong>'} · version ${VERSION}</p>
<ul>
${ligne(f.demandes_par_email, 'Demandes transmises par e-mail', f.demandes_par_email ? '' : 'secrets RESEND_API_KEY et EMAIL_PROPRIETAIRE')}
${ligne(f.notifications.length > 0, 'Notifications instantanées', f.notifications.length ? f.notifications.join(', ') : 'facultatif : TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID, NTFY_URL ou DISCORD_WEBHOOK_URL')}
${ligne(f.anti_robot_turnstile, 'Anti-robot Turnstile', f.anti_robot_turnstile ? '' : 'facultatif : TURNSTILE_SECRET')}
${ligne(f.paiement_stripe, 'Paiement Stripe', f.paiement_stripe ? `mode ${f.paiement_stripe_mode}` : 'STRIPE_SECRET_KEY et STRIPE_WEBHOOK_SECRET')}
${ligne(f.paiement_xendit, 'Paiement Xendit (Indonésie)', f.paiement_xendit ? '' : 'facultatif : XENDIT_SECRET_KEY, XENDIT_WEBHOOK_TOKEN et PRESTATAIRE_IDR = xendit')}
${ligne(f.agenda_google, 'Blocage automatique dans Google Agenda', f.agenda_google ? '' : 'GOOGLE_SERVICE_ACCOUNT et GCAL_<LOGEMENT>')}
${ligne(f.calendriers_en_direct > 0, 'Calendriers lus en direct', f.calendriers_en_direct ? `${f.calendriers_en_direct} lien(s) iCal` : 'facultatif : mêmes secrets ICAL_… que sur GitHub')}
${ligne(f.coordonnees_bancaires_par_email, 'Coordonnées bancaires envoyées par e-mail (solde)', f.coordonnees_bancaires_par_email ? '' : 'facultatif : COORDONNEES_BANCAIRES')}
</ul>
<p>Aucune clé n’est affichée ici. Mode d’emploi : <code>docs/07-paiement-option.md</code>.</p>
</body></html>`;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const chemin = url.pathname.replace(/\/+$/, '') || '/';
    const origine = request.headers.get('Origin');
    const origineOk = origine ? await origineAutorisee(env, origine) : false;
    const cors = origineOk ? { 'Access-Control-Allow-Origin': origine, Vary: 'Origin' } : { Vary: 'Origin' };
    const depuisNavigateur = ['/demande', '/paiement/session', '/disponibilites'].includes(chemin);

    try {
      if (request.method === 'OPTIONS') {
        if (!depuisNavigateur || !origineOk) return new Response(null, { status: 403 });
        return new Response(null, {
          status: 204,
          headers: { ...cors, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' },
        });
      }
      // Un autre site ne peut pas utiliser ce service depuis un navigateur.
      if (depuisNavigateur && origine && !origineOk) return json({ ok: false, code: 'origine', message: 'Origine non autorisée.' }, 403, cors);

      if (request.method === 'GET' && chemin === '/') return html(pageEtat(env));
      if (request.method === 'GET' && chemin === '/sante') return json({ ok: true, ...etat(env) });

      if (request.method === 'POST' && chemin === '/demande') {
        if (!origineOk) return json({ ok: false, code: 'origine', message: 'Origine non autorisée.' }, 403, cors);
        const reponse = await traiterDemande(request, env, await lireJson(request, 30000));
        return avecEntetes(reponse, cors);
      }

      if (request.method === 'GET' && chemin === '/disponibilites') {
        const slug = url.searchParams.get('logement') || '';
        const { infos } = await logementSite(env, slug);
        const d = await disponibilitesActuelles(env, slug, infos);
        if (!d.sources) return json({ ok: false, statut: 'non-configure', message: 'Aucun calendrier lu en direct pour ce logement.' }, 404, cors);
        // Uniquement des dates : jamais de nom, de description ni de numéro de réservation.
        return json({ statut: d.statut === 'ok' ? 'ok' : 'partiel', verifieLe: d.verifieLe, plages: d.plages }, 200, { ...cors, 'Cache-Control': 'public, max-age=60' });
      }

      if (request.method === 'POST' && chemin === '/paiement/session') {
        if (!origineOk) return json({ ok: false, code: 'origine', message: 'Origine non autorisée.' }, 403, cors);
        return avecEntetes(await creerSessionPaiement(request, env), cors);
      }
      if (request.method === 'POST' && (chemin === '/paiement/webhook/stripe' || chemin === '/paiement/webhook')) return await webhookStripe(request, env, ctx);
      if (request.method === 'POST' && chemin === '/paiement/webhook/xendit') return await webhookXendit(request, env, ctx);

      if (request.method === 'GET' && chemin === '/tarifs') {
        // Diagnostic : le service lit-il bien le site ? (données publiques)
        const t = await tarifsSite(env);
        return json({ ok: true, production: t.production, paiement: t.paiement, logements: Object.keys(t.logements) });
      }
      return json({ ok: false, code: 'introuvable', message: 'Adresse inconnue.' }, 404, cors);
    } catch (e) {
      if (e instanceof ErreurPublique) return json({ ok: false, code: e.code, message: e.message, ...(e.details ? { details: e.details } : {}) }, e.statut, cors);
      console.log(`Erreur interne : ${String(e?.message || e).slice(0, 300)}`);
      return json({ ok: false, code: 'interne', message: 'Erreur interne du service. Réessayez dans un instant.' }, 500, cors);
    }
  },
};

/**
 * Le site autorisé est celui de SITE_URL, ou l'adresse que le site publie
 * lui-même dans tarifs.json (utile avec un nom de domaine personnalisé).
 */
async function origineAutorisee(env, origine) {
  if (originesAutorisees(env).has(origine)) return true;
  try {
    const t = await tarifsSite(env);
    return Boolean(t.site) && new URL(t.site).origin === origine;
  } catch {
    return false;
  }
}

function avecEntetes(reponse, entetes) {
  const r = new Response(reponse.body, reponse);
  for (const [k, v] of Object.entries(entetes)) r.headers.set(k, v);
  return r;
}
