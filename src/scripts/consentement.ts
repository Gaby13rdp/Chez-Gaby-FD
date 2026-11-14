// Bandeau de consentement : Google Analytics (GA4) n'est chargé qu'après
// acceptation. Le choix est mémorisé 6 mois sur l'appareil du visiteur.

const CLE = 'consentement-statistiques';
const bandeau = document.querySelector<HTMLElement>('[data-consentement]');
const boutonAccepter = bandeau?.querySelector<HTMLButtonElement>('[data-accepter]');
const idGa = boutonAccepter?.dataset.ga || '';

function lire(): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(CLE) || 'null');
    if (v && Date.now() - v.date < 182 * 86400000) return v.choix;
  } catch { /* stockage indisponible */ }
  return null;
}
function ecrire(choix: string) {
  try { localStorage.setItem(CLE, JSON.stringify({ choix, date: Date.now() })); } catch { /* ignore */ }
}
function chargerGa() {
  if (!idGa || (window as any).__gaCharge) return;
  (window as any).__gaCharge = true;
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(idGa)}`;
  document.head.appendChild(s);
  const w = window as any;
  w.dataLayer = w.dataLayer || [];
  w.gtag = function gtag() { w.dataLayer.push(arguments); };
  w.gtag('js', new Date());
  w.gtag('config', idGa, { anonymize_ip: true });
}

const choix = lire();
if (choix === 'oui') chargerGa();
else if (choix === null && bandeau) bandeau.hidden = false;

boutonAccepter?.addEventListener('click', () => { ecrire('oui'); bandeau!.hidden = true; chargerGa(); });
bandeau?.querySelector('[data-refuser]')?.addEventListener('click', () => { ecrire('non'); bandeau.hidden = true; });
document.querySelectorAll('[data-gerer-cookies]').forEach((b) => b.addEventListener('click', () => {
  try { localStorage.removeItem(CLE); } catch { /* ignore */ }
  if (bandeau) { bandeau.hidden = false; bandeau.querySelector('button')?.focus(); }
}));
