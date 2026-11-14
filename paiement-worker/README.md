# paiement-worker — service Cloudflare facultatif

Petit service qui ajoute au site statique ce qui nécessite un serveur :

| Adresse | Rôle | Réglage du site |
|---|---|---|
| `GET /` | page d'état (ce qui est configuré, sans aucune clé) | — |
| `POST /demande` | reçoit le formulaire, vérifie l'anti-robot Turnstile, vous transmet la demande par e-mail et notification | `formulaire: prestataire: worker` |
| `GET /disponibilites?logement=…` | dates bloquées lues en direct (uniquement des dates) | `calendrier: temps_reel` |
| `POST /paiement/session` | recalcule le prix, revérifie les disponibilités, ouvre la page de paiement | `paiement: niveau: 2` |
| `POST /paiement/webhook/stripe` | notification signée de Stripe : agenda Google + e-mails | — |
| `POST /paiement/webhook/xendit` | notification de Xendit (Indonésie) | — |

**Mode d'emploi complet : [docs/07-paiement-option.md](../docs/07-paiement-option.md).**

## Déploiement

GitHub › **Actions › Déployer le service Cloudflare › Run workflow** (secrets GitHub `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID` requis). Le workflow lance les tests, puis déploie avec l'adresse du site (`SITE_URL`).

## Secrets (Cloudflare › Workers & Pages › paiement-worker › Settings › Variables and Secrets)

Toutes les valeurs sont de type **Secret**. Aucune ne doit figurer dans le dépôt GitHub.

| Nom | Obligatoire pour | Où le trouver |
|---|---|---|
| `RESEND_API_KEY` | e-mails | resend.com › API Keys |
| `EMAIL_PROPRIETAIRE` | e-mails | votre adresse |
| `EMAIL_EXPEDITEUR` | e-mails (domaine vérifié) | ex. `Réservations <reservations@mon-domaine.fr>` |
| `STRIPE_SECRET_KEY` | paiement Stripe | Stripe › Développeurs › Clés API (`sk_test_…` puis `sk_live_…`, ou clé limitée `rk_…`) |
| `STRIPE_WEBHOOK_SECRET` | paiement Stripe | Stripe › Webhooks › destination › secret de signature (`whsec_…`) |
| `GOOGLE_SERVICE_ACCOUNT` | blocage dans Google Agenda | contenu complet du fichier JSON de la clé du compte de service |
| `GCAL_<LOGEMENT>` | blocage dans Google Agenda | ID de l'agenda « direct » (ex. `GCAL_STUDIO_CATHEDRALE`) |
| `GCAL_TEST` | facultatif (essais) | ID d'un agenda d'essai, importé nulle part, utilisé par les paiements de test |
| `COORDONNEES_BANCAIRES` | facultatif | texte envoyé par e-mail pour le solde |
| `ICAL_<LOGEMENT>_<SOURCE>` | facultatif (temps réel) | mêmes liens et mêmes noms que les secrets GitHub |
| `TURNSTILE_SECRET` | facultatif (anti-robot) | Cloudflare › Turnstile › clé secrète |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | facultatif | bot Telegram (@BotFather) |
| `NTFY_URL` | facultatif | ex. `https://ntfy.sh/un-sujet-long-et-secret` |
| `DISCORD_WEBHOOK_URL` | facultatif | Discord › salon › Intégrations › Webhooks |
| `XENDIT_SECRET_KEY`, `XENDIT_WEBHOOK_TOKEN` | facultatif (Indonésie) | tableau de bord Xendit |
| `PRESTATAIRE_IDR` | facultatif | `xendit` pour encaisser les roupies avec Xendit (sinon Stripe) |
| `ORIGINES_SUPPLEMENTAIRES` | développement | adresses supplémentaires autorisées (ex. `http://localhost:4321`) |

`SITE_URL` est fourni automatiquement par le workflow de déploiement.

## Garanties

- Le prix n'est jamais fourni par le navigateur : il est recalculé à partir de `donnees/tarifs.json` publié par le site, avec les mêmes fonctions de calcul (`src/lib/partage/`).
- Les disponibilités sont revérifiées avant d'ouvrir le paiement, puis à la réception du paiement (alerte « CONFLIT DE DATES » si nécessaire).
- Signature Stripe vérifiée (HMAC-SHA256, tolérance 5 minutes, comparaison à temps constant) ; jeton Xendit vérifié, facture relue chez Xendit.
- Idempotence : identifiant d'événement d'agenda dérivé du paiement, marquage du paiement chez Stripe, clés d'idempotence Resend (une notification renvoyée après un échec d'e-mail renvoie les e-mails sans rebloquer l'agenda).
- Site de démonstration = clés de test uniquement ; site réel = clés réelles uniquement. Les paiements de test (`livemode` faux) n'écrivent que dans `GCAL_TEST` et n'envoient jamais les coordonnées bancaires.
- Avant d'ouvrir le paiement puis à sa réception, l'agenda Google « direct » est relu directement (réservations pas encore synchronisées).
- Seuls les sites autorisés (adresse `SITE_URL` ou adresse publiée par le site) peuvent appeler le service depuis un navigateur.
- Aucune donnée n'est stockée par le service.

## Développement

```bash
npm test                  # depuis la racine du projet : inclut ces tests (API simulées)
cd paiement-worker
npm ci
npx wrangler dev          # service local (créez un fichier .dev.vars pour les secrets de test)
npm run verifier          # construction sans déploiement
```
