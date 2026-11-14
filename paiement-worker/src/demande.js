// POST /demande : formulaire de demande de réservation ou de contact.
// Vérifie l'anti-robot (Turnstile), puis transmet la demande par e-mail au
// propriétaire (réponse directe au voyageur) et par notification.
// Rien n'est conservé par le service.

import { ErreurPublique, estEmail, fetchDelai, json, texteCourt, texteLong } from './outils.js';
import { canauxNotification, emailConfigure, envoyerEmail, notifier } from './messages.js';

export async function verifierTurnstile(secret, jeton, ip) {
  if (!jeton || typeof jeton !== 'string' || jeton.length > 4096) return false;
  try {
    const r = await fetchDelai('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: jeton, ...(ip ? { remoteip: ip } : {}) }),
    }, 8000);
    const j = await r.json().catch(() => ({}));
    return j.success === true;
  } catch {
    return false;
  }
}

export async function traiterDemande(request, env, corps) {
  if (corps.site_web) return json({ ok: true }); // champ piège rempli : robot, on fait semblant
  const champs = corps.champs && typeof corps.champs === 'object' && !Array.isArray(corps.champs) ? corps.champs : {};
  const nom = texteCourt(champs.nom, 120);
  const email = texteCourt(champs.email, 200);
  const texte = texteLong(corps.texte, 8000);
  if (!nom || !estEmail(email) || !texte) throw new ErreurPublique('Merci d’indiquer votre nom, une adresse e-mail valide et votre message.', 400, 'incomplet');

  if (env.TURNSTILE_SECRET) {
    const ok = await verifierTurnstile(env.TURNSTILE_SECRET, corps.turnstile, request.headers.get('CF-Connecting-IP'));
    if (!ok) throw new ErreurPublique('La vérification anti-robot a échoué. Rechargez la page et réessayez.', 403, 'anti-robot');
  }

  const canaux = canauxNotification(env);
  if (!emailConfigure(env) && !canaux.length) {
    throw new ErreurPublique('Le service de demande n’est pas encore configuré.', 503, 'non-configure');
  }

  const objet = texteCourt(corps.objet, 180) || `Nouvelle demande de ${nom}`;
  const lignes = Object.entries(champs)
    .filter(([k, v]) => /^[a-z_]{1,40}$/.test(k) && v !== '' && v != null && typeof v !== 'object')
    .slice(0, 30)
    .map(([k, v]) => `${k} : ${texteCourt(v, 500)}`);
  const corpsEmail = `${texte}\n\n— Détails —\n${lignes.join('\n')}\n\nRépondez directement à cet e-mail pour écrire à ${nom}.`;

  let envoye = 0;
  const erreurs = [];
  if (emailConfigure(env)) {
    try {
      await envoyerEmail(env, { a: env.EMAIL_PROPRIETAIRE, objet, texte: corpsEmail, repondreA: email });
      envoye++;
    } catch (e) {
      erreurs.push(e.message);
    }
  }
  if (canaux.length) envoye += await notifier(env, objet, `${nom} <${email}>\n${texte.slice(0, 1200)}`);
  if (!envoye) {
    console.log(`Demande non transmise : ${erreurs.join(' ; ')}`);
    throw new ErreurPublique('La demande n’a pas pu être transmise. Contactez-nous par téléphone ou WhatsApp.', 502, 'envoi-impossible');
  }
  return json({ ok: true });
}
