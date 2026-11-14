# 07 — Paiement de l'acompte (option)

Par défaut, le site ne prend **aucun paiement** : le voyageur envoie une demande, vous confirmez par e-mail. Trois niveaux sont possibles, réglés dans `config/site.yml` (`paiement: niveau:`).

| Niveau | Fonctionnement | Mise en place | Pour qui |
|---|---|---|---|
| **0** (défaut) | demande → vous confirmez par e-mail → acompte par virement | aucune | recommandé pour démarrer |
| **1** | après votre confirmation, le voyageur paie l'acompte via un **lien de paiement** (Stripe, PayPal…) | 15 min par logement | si les virements sont trop lents |
| **2** | le voyageur paie l'acompte **en ligne, immédiatement**, après revérification automatique des disponibilités ; les dates se bloquent toutes seules | 1 à 2 heures, une fois | volume important, réservation « instantanée » |

**Vos coordonnées bancaires ne sont jamais publiées sur le site** : au niveau 0 et 1, vous les envoyez par e-mail au voyageur après confirmation ; au niveau 2, le service les envoie par e-mail uniquement au voyageur dont l'acompte est payé (pour le solde).

---

## Niveau 0 — confirmation manuelle (défaut)

1. Le voyageur choisit ses dates, voit le devis indicatif et envoie sa demande.
2. Vous vérifiez vos calendriers, puis vous répondez par e-mail : disponibilité, prix définitif, conditions, montant de l'acompte et vos coordonnées bancaires.
3. À réception de l'acompte, la réservation est ferme : notez-la **immédiatement** dans l'agenda Google « direct » du logement ([04-calendriers-ical.md](04-calendriers-ical.md)).

Rien à configurer. Le montant de l'acompte et la date du solde viennent de `acompte_pct` et `solde_jours_avant_arrivee`.

## Niveau 1 — lien de paiement

1. Créez un lien de paiement chez le prestataire de votre choix :
   - **Stripe Payment Links** : [dashboard.stripe.com](https://dashboard.stripe.com) › **Liens de paiement** › **Nouveau** › produit « Acompte — Studio Cathédrale » ; choisissez **Laisser les clients choisir le montant** si l'acompte varie selon les dates (vous indiquez le montant dans votre e-mail) ;
   - ou PayPal, Mollie, SumUp…
2. Dans le logement : rubrique **Paiement** › `lien_acompte: "https://buy.stripe.com/…"`.
3. Dans `config/site.yml` : `paiement: niveau: 1`.

Après votre confirmation par e-mail, envoyez au voyageur l'adresse de la page de paiement du logement (`/paiement/studio-cathedrale/`, non référencée par Google) ou directement le lien. Le devis du site affiche alors aussi le montant de l'acompte.

---

## Niveau 2 — paiement en ligne automatique

### Comment ça marche

```
Voyageur ── choisit ses dates ──► Site ──► Service Cloudflare (paiement-worker)
                                             1. relit vos prix publiés et recalcule le montant
                                             2. revérifie les disponibilités (calendriers en direct)
                                             3. ouvre une page de paiement Stripe (ou Xendit)
Voyageur ── paie l'acompte ─────► Stripe ──► notification signée au service
                                             4. bloque les dates dans l'agenda Google « direct »
                                             5. vous envoie un e-mail (+ Telegram si configuré)
                                             6. envoie la confirmation au voyageur (dans sa langue)
```

Sécurité :

- le **montant est toujours recalculé par le service** à partir des tarifs publiés : un visiteur ne peut pas modifier le prix ;
- les notifications de Stripe sont **vérifiées par signature** (et refusées si elles ont plus de 5 minutes) ;
- une notification reçue deux fois n'a **aucun effet** la seconde fois (pas de double blocage, pas de double e-mail) ;
- si les dates ont été prises ailleurs entre-temps (fenêtre de synchronisation), vous recevez une alerte **« CONFLIT DE DATES »** et le voyageur un e-mail indiquant que vous revérifiez : vous remboursez depuis Stripe si nécessaire ;
- **toutes les clés sont des secrets du service Cloudflare**, jamais dans GitHub ;
- les **réservations déjà notées dans l'agenda Google « direct »** (ou payées quelques minutes plus tôt par un autre voyageur) sont vues immédiatement, sans attendre la synchronisation ;
- **site de démonstration = clés de test uniquement ; site réel = clés réelles uniquement**. Un paiement de test ne bloque jamais votre agenda réel et n'envoie jamais vos coordonnées bancaires (les e-mails portent la mention « [TEST] »).

### Avant de commencer

- Hébergez le site sur **Cloudflare** plutôt que GitHub Pages (conditions d'utilisation de GitHub Pages pour les transactions commerciales) : voir [01-mise-en-ligne.md](01-mise-en-ligne.md#cloudflare-alternative-recommandée).
- Synchronisez vos calendriers ([04](04-calendriers-ical.md)) : le paiement est refusé si les disponibilités ne sont pas fiables (aucune synchronisation réussie depuis 6 h).
- Comptez 1 à 2 heures pour l'ensemble des étapes.

### Étape 1 — Cloudflare et déploiement du service

1. Compte Cloudflare, clé d'accès (modèle **Edit Cloudflare Workers**) et identifiant de compte : mêmes étapes 1 à 5 que dans [01-mise-en-ligne.md › Cloudflare](01-mise-en-ligne.md#cloudflare-alternative-recommandée) (secrets GitHub `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID`).
2. GitHub › **Actions › Déployer le service Cloudflare › Run workflow** (laissez l'adresse vide si `url` est renseignée dans `config/site.yml`).
3. À la fin, ouvrez l'adresse `https://paiement-worker.VOTRE-SOUS-DOMAINE.workers.dev` affichée dans l'étape « Déployer sur Cloudflare » : une page **« Service du site : en ligne »** liste ce qui est configuré (✅) ou non (➖). Elle n'affiche jamais de clé. Revenez-y après chaque étape.

Les clés des étapes suivantes s'ajoutent dans Cloudflare : **Workers & Pages › paiement-worker › Settings › Variables and Secrets › Add** › type **Secret** › nom › valeur › **Deploy**.

### Étape 2 — Stripe

1. Créez un compte sur [stripe.com](https://stripe.com/fr) (particulier ou entreprise individuelle, en France, avec un compte bancaire français). Restez d'abord en **mode test**.
2. **Développeurs › Clés API** : copiez la **clé secrète** (`sk_test_…`) → secret Cloudflare `STRIPE_SECRET_KEY`.
   *Option plus prudente : une clé limitée (`rk_…`) avec les droits « Checkout Sessions : écriture » et « PaymentIntents : écriture ».*
3. **Développeurs › Webhooks › Ajouter une destination** :
   - adresse : `https://paiement-worker.VOTRE-SOUS-DOMAINE.workers.dev/paiement/webhook/stripe` ;
   - événements : `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` ;
   - copiez le **secret de signature** (`whsec_…`) → secret Cloudflare `STRIPE_WEBHOOK_SECRET`.

### Étape 3 — E-mails (Resend)

1. Créez un compte sur [resend.com](https://resend.com) (gratuit : 3 000 e-mails par mois, 100 par jour).
2. **Domains › Add domain** : ajoutez votre nom de domaine et les enregistrements DNS indiqués chez votre registraire (sans domaine vérifié, Resend ne peut écrire qu'à votre propre adresse : suffisant pour tester, pas pour écrire aux voyageurs).
3. **API Keys › Create** → secret `RESEND_API_KEY`.
4. Secrets `EMAIL_PROPRIETAIRE` (votre adresse, qui reçoit les alertes) et `EMAIL_EXPEDITEUR` (ex. `Réservations <reservations@mes-locations.fr>`).

### Étape 4 — Blocage automatique dans Google Agenda

1. [console.cloud.google.com](https://console.cloud.google.com) › créez un projet (ex. « site-locations »).
2. **API et services › Bibliothèque** › **Google Calendar API** › **Activer**.
3. **IAM et administration › Comptes de service › Créer un compte de service** (nom : « site-reservations ») › **OK** (aucun rôle à ajouter).
4. Ouvrez ce compte › onglet **Clés** › **Ajouter une clé › Créer une clé › JSON** : un fichier se télécharge. Copiez **tout son contenu** dans le secret Cloudflare `GOOGLE_SERVICE_ACCOUNT`, puis supprimez le fichier de votre ordinateur.
5. Dans Google Agenda, pour chaque agenda « direct » : **Paramètres et partage › Partager avec des personnes › Ajouter** › l'adresse du compte de service (`site-reservations@….iam.gserviceaccount.com`) › autorisation **Apporter des modifications aux événements**.
6. Toujours dans les paramètres : **Intégrer l'agenda › ID de l'agenda** → secret Cloudflare `GCAL_<LOGEMENT>` (ex. `GCAL_STUDIO_CATHEDRALE`, nom du dossier en majuscules, tirets remplacés par `_`).

Sans cette étape, le paiement fonctionne quand même, mais l'e-mail vous demande de **bloquer les dates vous-même**.

### Étape 5 — Options

| Secret Cloudflare | Rôle |
|---|---|
| `COORDONNEES_BANCAIRES` | texte (titulaire, IBAN, BIC) envoyé par e-mail au voyageur pour le solde |
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | notification instantanée sur Telegram |
| `NTFY_URL` | notification via l'application ntfy (ex. `https://ntfy.sh/un-nom-long-et-secret`) |
| `DISCORD_WEBHOOK_URL` | notification sur un salon Discord |
| `ICAL_…` (mêmes noms que sur GitHub) | lecture des calendriers en direct (plus sûr ; enregistrez **tous** les calendriers d'un logement, voir docs/04) |
| `GCAL_TEST` | ID d'un agenda Google d'essai pour les paiements de test (étape 7) |
| `TURNSTILE_SECRET` | anti-robot Cloudflare Turnstile pour le formulaire (`formulaire: prestataire: worker`) |

### Étape 6 — Activer sur le site

Dans `config/site.yml` :

```yaml
paiement:
  niveau: 2
  acompte_pct: 30
  solde_jours_avant_arrivee: 30
  worker_url: "https://paiement-worker.VOTRE-SOUS-DOMAINE.workers.dev"
```

Le bouton **« Payer l'acompte »** apparaît sur la carte de réservation quand les dates choisies sont libres et conformes aux règles.

### Étape 7 — Tester, puis passer en réel

1. Facultatif mais conseillé : créez un agenda Google **« Essais paiement »**, partagé avec le compte de service comme à l'étape 4 mais **importé nulle part** (ni Airbnb, ni Booking, ni le site), et enregistrez son ID dans le secret Cloudflare `GCAL_TEST`. Les paiements de test y créeront leurs événements, sans toucher à vos vrais agendas.
2. Site en mode démonstration (`production: false`), clés Stripe **de test** : choisissez des dates, cliquez **Payer l'acompte**, payez avec la carte de test `4242 4242 4242 4242` (date future quelconque, code `123`).
3. Vérifiez : page « Merci », e-mails « [TEST] » reçus (vous et l'adresse saisie), événement dans l'agenda « Essais paiement », paiement visible dans Stripe (mode test).
4. Passage en réel, en une seule fois : `production: true` dans `config/site.yml` **et**, dans Cloudflare, `STRIPE_SECRET_KEY` remplacée par la clé réelle (`sk_live_…`), webhook recréé en mode réel et `STRIPE_WEBHOOK_SECRET` mis à jour. Pendant les quelques minutes de bascule, le bouton de paiement affiche une erreur : c'est voulu (le service n'accepte jamais une clé de test sur un site réel, ni l'inverse).

### Frais Stripe (France, octobre 2026, à vérifier sur [stripe.com/fr/pricing](https://stripe.com/fr/pricing))

| Carte | Commission |
|---|---|
| Carte standard de l'Espace économique européen | 1,5 % + 0,25 € |
| Carte premium de l'EEE | 2,8 % + 0,25 € |
| Carte britannique | 2,5 % + 0,25 € |
| Carte hors EEE | 3,15 % + 0,25 € |
| Conversion de devise (ex. paiement en roupies) | + 2 % |

Pas d'abonnement. Un litige (contestation de paiement) coûte 20 €, remboursés si vous le gagnez. Exemple : acompte de 100 € par carte française standard → 1,75 € de frais.

---

## La villa à Bali (roupies)

L'Indonésie impose en principe l'usage de la **roupie** pour les transactions réalisées sur son territoire (règlement de Bank Indonesia) : les prix de la villa sont donc affichés en IDR.

| Solution | Points forts | Limites |
|---|---|---|
| **Stripe (compte français) en IDR** — réglage par défaut | aucune démarche supplémentaire ; cartes du monde entier | conversion en euros (+2 %) ; validez auprès d'un conseil local l'encaissement depuis la France d'une activité exercée en Indonésie |
| **Xendit** (prestataire indonésien) | moyens de paiement locaux (virement, QRIS, portefeuilles), cartes 2,9 % + 2 000 IDR | compte réservé aux Indonésiens (carte KTP) ou aux sociétés (PT PMA) : passe en pratique par la société ou le gestionnaire local qui exploite la villa |
| **PayPal** | connu des voyageurs | l'IDR n'est pas une devise de transaction PayPal ; frais de conversion |
| **Virement (Wise)** | simple pour un acompte en euros | pas de compte en IDR chez Wise ; manuel (niveau 0) |

Pour utiliser Xendit au niveau 2 : secrets Cloudflare `XENDIT_SECRET_KEY`, `XENDIT_WEBHOOK_TOKEN` (jeton de vérification des notifications, dans le tableau de bord Xendit) et `PRESTATAIRE_IDR` = `xendit` ; dans Xendit, adresse de notification des factures : `https://…workers.dev/paiement/webhook/xendit`. Les logements en euros continuent de passer par Stripe.

Les obligations locales (licence, taxe PBJT, déclaration des voyageurs) sont résumées dans [08-obligations-legales.md](08-obligations-legales.md#bali-indonésie).

---

## Questions fréquentes

**Peut-on prendre une empreinte bancaire pour la caution ?** Pas de façon fiable : une autorisation de carte expire au bout d'environ 7 jours. Le site affiche la caution à titre d'information ; encaissez-la sur place ou par un lien au moment de l'arrivée.

**Que se passe-t-il si le service Cloudflare est en panne ?** Le bouton de paiement affiche un message d'erreur ; le voyageur peut toujours envoyer une demande classique, vous appeler ou vous écrire sur WhatsApp.

**Combien coûte le service Cloudflare ?** L'offre gratuite de Cloudflare Workers (100 000 requêtes par jour) suffit très largement.
