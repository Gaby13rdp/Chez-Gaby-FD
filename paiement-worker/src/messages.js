// Envoi des e-mails (Resend) et des notifications instantanées
// (Telegram, ntfy, Discord). Toutes les clés sont des secrets du service.

import { fetchDelai } from './outils.js';

export const emailConfigure = (env) => Boolean(env.RESEND_API_KEY && env.EMAIL_PROPRIETAIRE);

export function canauxNotification(env) {
  const c = [];
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) c.push('telegram');
  if (env.NTFY_URL) c.push('ntfy');
  if (env.DISCORD_WEBHOOK_URL) c.push('discord');
  return c;
}

/**
 * Envoie un e-mail via Resend.
 * @param {object} m { a, objet, texte, html?, repondreA?, cle? (idempotence : un même e-mail n'est jamais envoyé deux fois) }
 */
export async function envoyerEmail(env, m) {
  if (!env.RESEND_API_KEY) return { statut: 'non-configure' };
  const r = await fetchDelai('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      ...(m.cle ? { 'Idempotency-Key': String(m.cle).slice(0, 256) } : {}),
    },
    body: JSON.stringify({
      from: env.EMAIL_EXPEDITEUR || 'Réservations <onboarding@resend.dev>',
      to: Array.isArray(m.a) ? m.a : [m.a],
      subject: m.objet,
      text: m.texte,
      ...(m.html ? { html: m.html } : {}),
      ...(m.repondreA ? { reply_to: m.repondreA } : {}),
    }),
  }, 10000);
  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    throw new Error(`l’envoi de l’e-mail a été refusé (HTTP ${r.status}) ${detail.slice(0, 160)}`);
  }
  return { statut: 'envoye' };
}

/** Notification courte au propriétaire sur tous les canaux configurés. */
export async function notifier(env, titre, texte) {
  const taches = [];
  const message = `${titre}\n\n${texte}`;
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    taches.push(fetchDelai(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: message.slice(0, 4000), disable_web_page_preview: true }),
    }, 8000));
  }
  if (env.NTFY_URL) {
    // Publication JSON (gère les accents) : https://ntfy.sh/mon-sujet -> serveur + sujet
    try {
      const u = new URL(env.NTFY_URL);
      const sujet = u.pathname.replace(/^\/+|\/+$/g, '');
      taches.push(fetchDelai(u.origin, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: sujet, title: titre.slice(0, 200), message: texte.slice(0, 3500), priority: 4 }),
      }, 8000));
    } catch { /* adresse ntfy invalide : ignorée */ }
  }
  if (env.DISCORD_WEBHOOK_URL) {
    taches.push(fetchDelai(env.DISCORD_WEBHOOK_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message.slice(0, 1900), allowed_mentions: { parse: [] } }),
    }, 8000));
  }
  const res = await Promise.allSettled(taches);
  return res.filter((x) => x.status === 'fulfilled' && x.value?.ok).length;
}
