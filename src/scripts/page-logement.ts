// Petits comportements de la page logement : partage, impression, fenêtres.

document.querySelectorAll<HTMLButtonElement>('[data-partager]').forEach((b) => {
  b.addEventListener('click', async () => {
    const url = location.href.split('?')[0];
    try {
      if (navigator.share) { await navigator.share({ title: b.dataset.titre || document.title, url }); return; }
      await navigator.clipboard.writeText(url);
      const initial = b.innerHTML;
      b.textContent = b.dataset.copie || 'OK';
      setTimeout(() => { b.innerHTML = initial; }, 2000);
    } catch { /* partage annulé */ }
  });
});

document.querySelectorAll('[data-imprimer]').forEach((b) => b.addEventListener('click', () => window.print()));

document.querySelectorAll<HTMLElement>('[data-ouvrir-dialogue]').forEach((b) => {
  const d = document.getElementById(b.dataset.ouvrirDialogue || '') as HTMLDialogElement | null;
  b.addEventListener('click', () => d?.showModal());
  d?.querySelector('[data-fermer-dialogue]')?.addEventListener('click', () => d.close());
  d?.addEventListener('click', (e) => { if (e.target === d) d.close(); });
});
