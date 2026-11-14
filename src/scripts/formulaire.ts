// Envoi des formulaires (demande de réservation et contact).
// Prestataires : Web3Forms, Formspree, Getform, service worker, ou mailto.
// Les erreurs sont affichées en clair et un moyen de contact direct est
// toujours proposé si l'envoi échoue.

type Contexte = { champs: Record<string, string>; resume: string; objet: string; nom: string };
const contextes = new Map<string, Contexte>();

document.addEventListener('demande:maj', (e: Event) => {
  const d = (e as CustomEvent).detail as Contexte & { formulaire: string };
  contextes.set(d.formulaire, d);
  const form = document.getElementById(d.formulaire);
  const recap = form?.querySelector<HTMLElement>('[data-recapitulatif]');
  if (recap) recap.innerHTML = d.resume;
});

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
let turnstileCharge: Promise<void> | null = null;

function chargerTurnstile(): Promise<void> {
  if (turnstileCharge) return turnstileCharge;
  turnstileCharge = new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true; s.defer = true;
    s.onload = () => ok(); s.onerror = () => ko(new Error('turnstile'));
    document.head.appendChild(s);
  });
  return turnstileCharge;
}

function texteErreur(champ: HTMLElement, message: string) {
  const err = document.getElementById(`${champ.id}-err`) || document.getElementById(`${(champ as HTMLInputElement).form?.id}-${(champ as HTMLInputElement).name}-err`);
  if (message) champ.setAttribute('aria-invalid', 'true'); else champ.removeAttribute('aria-invalid');
  if (err) { err.textContent = message; err.hidden = !message; }
}

document.querySelectorAll<HTMLFormElement>('form[data-formulaire]').forEach((form) => {
  const config = JSON.parse(form.dataset.config || '{}');
  const T = JSON.parse(form.dataset.textes || '{}');
  const messages = form.querySelector<HTMLElement>('[data-messages-formulaire]')!;
  const bouton = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const libelleBouton = bouton.innerHTML;
  const autres = form.querySelector<HTMLElement>('[data-autres-moyens]');
  const succes = document.querySelector<HTMLElement>(`[data-succes="${form.id}"]`);
  const destinataire = `${[...config.destinataire[0]].reverse().join('')}@${[...config.destinataire[1]].reverse().join('')}`;

  if (config.turnstile) {
    const zone = form.querySelector<HTMLElement>('[data-turnstile]');
    const afficher = () => chargerTurnstile().then(() => {
      const w = window as any;
      if (zone && !zone.dataset.rendu && w.turnstile) { zone.dataset.rendu = '1'; w.turnstile.render(zone, { sitekey: config.turnstile, language: config.langue }); }
    }).catch(() => {});
    form.addEventListener('focusin', afficher, { once: true });
  }

  const message = (html: string, type = 'erreur') => { messages.innerHTML = `<div class="message message--${type}" role="alert">${html}</div>`; };

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    messages.innerHTML = '';
    const donnees = new FormData(form);
    // Vérifications
    let premiereErreur: HTMLElement | null = null;
    form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[name], textarea[name]').forEach((c) => {
      if (c.name === 'site_web') return;
      let m = '';
      if (c.type === 'checkbox' && c.required && !(c as HTMLInputElement).checked) m = T.erreurConsentement;
      else if (c.required && !c.value.trim()) m = T.erreurRequis;
      else if (c.type === 'email' && c.value && !EMAIL.test(c.value.trim())) m = T.erreurEmail;
      texteErreur(c, m);
      if (m && !premiereErreur) premiereErreur = c;
    });
    if (premiereErreur) { message(T.erreurChamp); (premiereErreur as HTMLElement).focus(); return; }

    const ctx = contextes.get(form.id);
    const champs: Record<string, string> = { ...(ctx?.champs || {}) };
    for (const [k, v] of donnees.entries()) if (typeof v === 'string' && k !== 'consentement') champs[k] = v.trim();
    const piege = champs.site_web; delete champs.site_web;
    const nom = champs.nom || '';
    const objet = form.dataset.formulaire === 'reservation' && ctx ? ctx.objet : T.objetContact + (champs.logement ? ` — ${champs.logement}` : '');
    const corpsTexte = [
      ...(ctx ? [ctx.champs.texte_recapitulatif || ''] : []),
      champs.logement && !ctx ? `Logement : ${champs.logement}` : '',
      `Nom : ${nom}`, `E-mail : ${champs.email || ''}`, champs.telephone ? `Téléphone : ${champs.telephone}` : '',
      champs.heure_arrivee ? `Heure d'arrivée : ${champs.heure_arrivee}` : '', '', champs.message || '',
    ].filter((x) => x !== undefined).join('\n');

    const reussite = () => {
      form.hidden = true;
      if (succes) {
        succes.hidden = false;
        succes.querySelector('[data-succes-titre]')!.textContent = T.succesTitre;
        succes.querySelector('[data-succes-texte]')!.textContent = form.dataset.formulaire === 'reservation'
          ? T.succesTexte.replace('{nom}', nom.split(' ')[0] || '').replace('{delai}', T.delai || '')
          : T.succesMessage;
        succes.focus();
      }
      document.dispatchEvent(new CustomEvent('demande:envoyee', { detail: { formulaire: form.id } }));
    };

    if (piege) { reussite(); return; } // robot : on fait semblant

    if (config.prestataire === 'mailto') {
      const url = `mailto:${destinataire}?subject=${encodeURIComponent(objet)}&body=${encodeURIComponent(corpsTexte)}`;
      message(T.mailtoInfo, 'succes');
      window.location.href = url;
      return;
    }

    bouton.disabled = true;
    bouton.textContent = T.envoi;
    try {
      let reponse: Response;
      if (config.prestataire === 'web3forms') {
        reponse = await fetch(config.action, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ access_key: config.cle, subject: objet, from_name: config.marque, ...champs, name: nom, message: corpsTexte, botcheck: '' }),
        });
      } else if (config.prestataire === 'formspree') {
        reponse = await fetch(config.action, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ ...champs, _subject: objet, message: corpsTexte }),
        });
      } else if (config.prestataire === 'getform') {
        const fd = new FormData();
        for (const [k, v] of Object.entries({ ...champs, subject: objet, message: corpsTexte })) fd.append(k, v);
        reponse = await fetch(config.action, { method: 'POST', headers: { Accept: 'application/json' }, body: fd });
      } else {
        const jeton = (form.querySelector<HTMLInputElement>('[name="cf-turnstile-response"]')?.value) || '';
        reponse = await fetch(config.action, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: form.dataset.formulaire, objet, champs, texte: corpsTexte, langue: config.langue, turnstile: jeton }),
        });
      }
      if (!reponse.ok) throw new Error(String(reponse.status));
      const json = await reponse.json().catch(() => ({}));
      if (json && (json.success === false || json.ok === false)) throw new Error(json.message || 'refus');
      reussite();
    } catch {
      message(`${T.erreur}`);
      if (autres) autres.hidden = false;
      const wa = autres?.querySelector<HTMLAnchorElement>('[data-lien-whatsapp]');
      if (wa) wa.href = `${wa.href.split('?')[0]}?text=${encodeURIComponent(corpsTexte.slice(0, 1500))}`;
      const w = window as any;
      if (config.turnstile && w.turnstile) w.turnstile.reset();
    } finally {
      bouton.disabled = false;
      bouton.innerHTML = libelleBouton;
    }
  });
});
