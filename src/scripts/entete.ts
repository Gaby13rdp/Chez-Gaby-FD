// En-tête : menu mobile, choix de langue, ombre au défilement, e-mails masqués.

const entete = document.querySelector<HTMLElement>('[data-entete]');
const menu = document.getElementById('menu-mobile') as HTMLDialogElement | null;

document.querySelector('[data-ouvrir-menu]')?.addEventListener('click', () => menu?.showModal());
document.querySelector('[data-fermer-menu]')?.addEventListener('click', () => menu?.close());
menu?.addEventListener('click', (e) => { if (e.target === menu) menu.close(); });
menu?.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => menu.close()));

document.querySelector<HTMLSelectElement>('[data-choix-langue]')?.addEventListener('change', (e) => {
  const valeur = (e.target as HTMLSelectElement).value;
  try { localStorage.setItem('langue-choisie', '1'); } catch { /* stockage indisponible */ }
  window.location.href = valeur;
});

if (entete) {
  const maj = () => entete.classList.toggle('defile', window.scrollY > 8);
  maj();
  window.addEventListener('scroll', maj, { passive: true });
}

// Adresses e-mail reconstituées au clic (protection contre les robots)
document.querySelectorAll<HTMLAnchorElement>('[data-email-u]').forEach((a) => {
  const adresse = () => `${[...(a.dataset.emailU || '')].reverse().join('')}@${[...(a.dataset.emailD || '')].reverse().join('')}`;
  a.addEventListener('click', (e) => {
    if (a.getAttribute('href') === '#') { e.preventDefault(); window.location.href = `mailto:${adresse()}`; }
  });
  a.addEventListener('focus', () => a.setAttribute('href', `mailto:${adresse()}`), { once: true });
  a.addEventListener('mouseenter', () => a.setAttribute('href', `mailto:${adresse()}`), { once: true });
  a.querySelectorAll('[data-email-texte]').forEach((s) => { s.textContent = adresse(); });
});
