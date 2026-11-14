# 09 — Dépannage

## Le réflexe : l'onglet « Actions »

Toute modification passe par une vérification automatique. Pour savoir où en est une publication :

1. Dépôt GitHub › onglet **Actions**.
2. La ligne la plus haute est la plus récente : **rond jaune** = en cours, **coche verte** = réussi, **croix rouge** = refusé.
3. Cliquez sur une croix rouge, puis sur l'étape en rouge : le message explique **en français** quoi corriger et dans quel fichier. Un résumé apparaît aussi en bas de la page de l'exécution.

**Une publication refusée ne casse jamais le site** : la dernière version valide reste en ligne. Corrigez, enregistrez : une nouvelle publication démarre.

GitHub vous envoie aussi un e-mail lorsqu'une exécution échoue.

---

## Messages fréquents lors de la publication

| Message (extrait) | Cause | Solution |
|---|---|---|
| « n'a pas de photo de couverture » | dossier `photos/` vide ou absent | ajoutez au moins une photo (`01-….jpg`) ou masquez le logement (`publie: false`) |
| « le champ … est obligatoire » | champ requis vide | complétez le champ indiqué |
| « Vouliez-vous dire … ? » | faute de frappe dans un nom de réglage ou de dossier | corrigez selon la suggestion |
| Erreur de lecture YAML, « ligne N » | indentation ou guillemet manquant dans la partie réglages | vérifiez les espaces en début de ligne et fermez les guillemets ; comparez avec le modèle `content/_modeles/` |
| « format HEIC (iPhone) » | photo iPhone non convertie | voir [03-photos.md](03-photos.md#photos-prises-avec-un-iphone-format-heic) |
| « LIEN iCAL PRIVÉ semble collé » | un lien de calendrier a été écrit dans un fichier | retirez-le immédiatement et rangez-le dans un secret ([04](04-calendriers-ical.md)) ; si le fichier a été enregistré, **régénérez le lien** sur la plateforme (l'historique GitHub est public) |
| « semble contenir un code d'accès » | un code de porte, de boîte à clés ou un mot de passe dans un texte | retirez-le ; envoyez les codes par message, jamais sur le site |
| « Le secret … est utilisé par deux calendriers » | même nom de secret dans deux logements | donnez un nom différent à chaque calendrier |
| « la période … se termine avant de commencer » | dates de saison inversées | corrigez `du` / `au` |
| « contient encore des données d'exemple » / « photo(s) d'exemple » / « À COMPLÉTER » | le site est en `production: true` et un exemple subsiste | remplacez l'élément cité, ou repassez en `production: false` le temps de finir |
| « Hébergeur cloudflare : indiquez l'adresse publique » | `url` vide avec Cloudflare ou Netlify | renseignez `url` dans `config/site.yml` |
| « Lien cassé » | un lien interne pointe vers une page qui n'existe plus | corrigez le lien dans le texte cité, ou ajoutez une redirection |

## Problèmes de mise en ligne

**« Get Pages site failed » ou « Not Found » à la première publication** — GitHub Pages n'est pas activé : **Settings › Pages › Source : GitHub Actions** ([01](01-mise-en-ligne.md)), puis sur l'exécution en échec : **Re-run jobs**.

**Le site ne change pas après une modification** — vérifiez dans **Actions** que la publication est terminée (2 à 5 min). Puis rechargez la page sans le cache du navigateur (**Ctrl + F5** sur PC, **Cmd + Maj + R** sur Mac) ou testez en navigation privée.

**« Secrets Cloudflare manquants »** — `hebergeur: cloudflare` sans les secrets `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID` ([01](01-mise-en-ligne.md#cloudflare-alternative-recommandée)). Si la clé existe mais est refusée (« Authentication error »), recréez-la avec le modèle **Edit Cloudflare Workers**.

**« You need to register a workers.dev subdomain »** — ouvrez une fois **Workers & Pages** dans le tableau de bord Cloudflare, puis relancez.

**Nom de domaine : « DNS check unsuccessful »** — attendez jusqu'à 24 h après la modification DNS et vérifiez les enregistrements ([01](01-mise-en-ligne.md#utiliser-votre-propre-nom-de-domaine-facultatif)).

## Calendriers

Ouvrez **Actions › Synchroniser les calendriers** › dernière exécution › résumé : chaque calendrier y figure avec son état.

| État affiché | Cause | Solution |
|---|---|---|
| « le calendrier n'existe plus (HTTP 404/410) » | le lien a été régénéré ou l'annonce supprimée | recopiez le nouveau lien d'export dans le secret (**Settings › Secrets › Update**) |
| « accès refusé (HTTP 401/403) » | lien invalide ou expiré | idem |
| « trop de requêtes (HTTP 429) » | la plateforme limite temporairement | rien à faire : la prochaine synchronisation réessaie |
| « pas un calendrier iCal » | le secret contient autre chose qu'un lien iCal (page web, lien tronqué) | recopiez le lien complet |
| « secret absent » / logement « non configuré » | le secret n'existe pas sous ce nom | vérifiez l'orthographe exacte du nom (majuscules, `_`) |
| « pas de réponse après 25 secondes » | plateforme lente | rien à faire si ponctuel |

**Le site affiche « Disponibilités à confirmer »** — aucune synchronisation réussie depuis 6 heures. Vérifiez la dernière exécution ; lancez **Run workflow** à la main.

**La synchronisation ne tourne plus du tout** — **Actions › Synchroniser les calendriers** : si GitHub affiche « This scheduled workflow is disabled… », cliquez **Enable workflow**. Les exécutions planifiées peuvent aussi être retardées aux heures de forte charge chez GitHub : c'est normal si cela reste ponctuel.

**Une réservation n'apparaît pas encore** — délais normaux : jusqu'à 30 minutes (plus le délai éventuel de GitHub) pour le site, environ 3 heures pour Airbnb. Forcez la synchronisation (**Run workflow**) et, sur Airbnb ou Booking, utilisez **Actualiser / Importer maintenant**.

**Une date bloquée ne se libère pas** — si un calendrier est en erreur, ses dernières dates connues sont conservées par prudence ; réparez le lien en erreur.

## Formulaire de demande

**Le bouton ouvre la messagerie au lieu d'envoyer** — la clé du prestataire (`web3forms_cle`…) est vide : c'est le mode de secours. Voir [02](02-utilisation-quotidienne.md#recevoir-les-demandes-par-e-mail).

**Je ne reçois pas les demandes** — regardez dans les indésirables ; vérifiez sur le site du prestataire (Web3Forms) l'adresse de réception et le quota (250 demandes par mois en gratuit). Faites un essai vous-même.

**Des demandes « robots »** — le champ piège en arrête la plupart. Si cela continue : prestataire `worker` avec Cloudflare Turnstile ([07](07-paiement-option.md)).

## Photos

**Une photo n'apparaît pas** — vérifiez son emplacement (`content/logements/NOM/photos/`), son extension (`.jpg`, `.jpeg`, `.png`, `.webp`), et qu'elle fait moins de 25 Mo (limite de l'envoi par navigateur).

**L'ordre n'est pas le bon** — l'ordre suit les numéros des noms de fichiers (`01-`, `02-`…), sauf si vous l'avez défini dans Pages CMS (« Photos : légendes et ordre »).

## Pages CMS

**Le dépôt n'apparaît pas** — l'application GitHub de Pages CMS n'a pas accès au dépôt : sur GitHub, **Settings** (de votre compte) › **Applications** › Pages CMS › **Configure** › ajoutez le dépôt.

**« Configuration invalide »** — le fichier `.pages.yml` a été modifié à la main. Il est généré automatiquement : restaurez-le depuis l'historique (voir ci-dessous).

## Paiement en ligne (niveau 2)

Ouvrez l'adresse du service (`https://paiement-worker….workers.dev`) : la page d'état indique ce qui manque.

| Message affiché au voyageur | Cause |
|---|---|
| « Le paiement en ligne n'est pas encore configuré » | clé Stripe (ou Xendit) absente du service, ou clé **de test** alors que le site est en `production: true` |
| « Les disponibilités ne peuvent pas être confirmées » | aucune synchronisation récente des calendriers |
| « Site en démonstration : seul le mode test… » | clé Stripe réelle alors que le site est en `production: false` |
| « Ces dates ne sont plus disponibles » | dates prises entre-temps (fonctionnement normal) |

Dans Stripe : **Développeurs › Webhooks** › votre destination › onglet des tentatives : un code 400 signifie un secret de signature (`STRIPE_WEBHOOK_SECRET`) erroné ; un code 500 signifie que ni l'e-mail ni les notifications n'ont pu vous prévenir (vérifiez Resend) : Stripe renvoie alors automatiquement la notification pendant plusieurs jours.

Google Cloud refuse de créer une clé JSON (« Key creation is disabled ») : cela arrive avec un compte Google d'entreprise ; utilisez un compte Google personnel pour le projet.

## Contrôle qualité en rouge

L'automatisme **Contrôle qualité** (tests, audit de performance et d'accessibilité) ne bloque jamais la publication. Un échec ponctuel de l'audit Lighthouse peut venir d'une lenteur passagère de la machine de GitHub : relancez-le (**Re-run jobs**). S'il échoue durablement après une modification du code, c'est la modification qu'il faut revoir.

---

## Revenir en arrière

Tout l'historique est conservé par GitHub.

- **Un fichier** : ouvrez-le sur github.com › **History** (en haut à droite) › choisissez la version voulue › **⋯** › **View file** › copiez le contenu › revenez au fichier actuel › crayon ✏️ › collez › **Commit changes**.
- **Une photo supprimée** : **History** du dossier `photos/` › ouvrez la modification › **Browse files** › téléchargez la photo › renvoyez-la.
- Pour revenir en arrière sur un ensemble de modifications, GitHub Desktop propose **History › clic droit › Revert changes in commit**.

## Demander de l'aide

Transmettez :

1. une capture de l'écran d'erreur (page de l'exécution dans **Actions**, partie en rouge) ;
2. ce que vous avez modifié juste avant ;
3. le fichier `memoire_site_papa.md` (description complète du projet) si vous faites appel à un assistant ou à un développeur.

Ne transmettez **jamais** vos liens iCal, clés Stripe, Resend ou Cloudflare : personne n'en a besoin pour vous aider.
