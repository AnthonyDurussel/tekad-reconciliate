# Déploiement sur Azure

Même mécanique que Plimo : l'infrastructure en Bicep (azd), une release construite une fois et
déployée telle quelle, GitHub Actions connecté à Azure par OIDC, les secrets dans 1Password puis
le Key Vault. Deux environnements, chacun dans son groupe de ressources, décrits par le même
template :

| Environnement | Adresse                         | Groupe                  | Paramètres                 | Notes 1Password (coffre `Azure-Infra-Secret`)                  |
| ------------- | ------------------------------- | ----------------------- | -------------------------- | -------------------------------------------------------------- |
| staging       | https://tekad-frais.neuralis.dev | `rg-tekad-frais-staging` | `infra/env/staging.env`    | `tekad-frais-infra.staging.provision`, `….staging.deploy`       |
| production    | https://frais.tekad.ch        | `rg-tekad-frais`         | `infra/env/production.env` | `tekad-frais-infra.production.provision`, `….production.deploy` |

> Les deux adresses sont des propositions : à confirmer (et à reporter dans
> `infra/env/<env>.env`, `deploy/env/<env>/deploy.env`, `deploy/env/<env>/appsettings.json` et
> `.github/workflows/deploy.yml`).

```text
infra/                     l'infrastructure (Bicep, azd) — workflow Provision
  main.bicep               groupe de ressources + modules app/
  main.bicepparam          lit infra/env/<env>.env et la note .provision
  env/<env>.env            paramètres non secrets (taille, domaines, rétention…)
  app/                     function, static-web-app, postgresql(-existing), storage, keyvault,
                           monitoring, alerts
  scripts/                 github-oidc.sh, entra-app.sh, postgres-entra-roles.sh
deploy/                    le déploiement d'une release — workflows Release et Deploy
  env/<env>/deploy.env     groupe de ressources, URL publique
  env/<env>/appsettings.json         réglages non secrets de la Function App
  env/<env>/staticwebapp.config.json connexion Entra, routes protégées, en-têtes, CSP
  scripts/deploy.sh        migrations → admin (+ seed) → réglages → API → SPA → santé
  scripts/op-env.sh        lit une note 1Password (variables ou secrets Key Vault)
scripts/release.sh         pnpm release : versions, CHANGELOG.md, tag vX.Y.Z
```

## Architecture

```text
navigateur ──▶ Static Web App (Standard)        connexion Entra ID (fournisseur personnalisé)
                │  SPA + /.auth/*               rolesSource → POST /api/roles
                └─ /api/* (backend lié) ──▶ Function App (Flex Consumption, Node 22)
                                              │  x-ms-client-principal posé par la SWA
                                              ├─ PostgreSQL Flexible Server (identité managée)
                                              ├─ Key Vault (références dans les réglages)
                                              └─ Application Insights ─▶ Log Analytics
```

- **Authentification** : la Static Web App connecte l'utilisateur à Entra ID (application
  d'entreprise de Tekad) et transmet son principal à l'API (`x-ms-client-principal`),
  que `withContext` lit. Le backend étant **lié**, la Function App ne répond qu'à travers la
  Static Web App : personne ne peut l'appeler directement avec un principal forgé. Les droits ne
  viennent pas du jeton : l'API relit le compte et son rôle en base à chaque requête.
- **Base** : l'API se connecte avec **l'identité managée** de la Function App
  (`DATABASE_ENTRA_URL`, un jeton Entra par connexion, `databaseConnection.ts`) ; seules les
  migrations, l'administrateur et le seed passent par le mot de passe du propriétaire
  (`POSTGRES-CONNECTION-STRING`, Key Vault).
- **Santé** : `GET /api/health` (public) — `status`, `version`, `commit`, `database`. Utilisée par
  le test de disponibilité et par la fin de chaque déploiement.

## Ce que fait chaque workflow

**CI** (chaque push et PR, et sur le tag d'une release) : modèles, migrations appliquées à un
vrai PostgreSQL, typecheck / lint / tests de l'API, seed lancé deux fois (idempotence), paquet
Azure Functions, typecheck / i18n / lint / tests / build du frontend ; les templates Bicep
(`az bicep build`, `lint`, `build-params` des deux environnements) et `shellcheck`.

**Release** (à la main, ou un tag `vX.Y.Z` poussé) : `pnpm release` sur `main` (versions
synchronisées par turboversion, `CHANGELOG.md`, tag), CI complète sur le tag, puis **une seule
construction** : `function-app.zip` (bundles esbuild de l'API, d'`ensure-admin` et du seed,
client Prisma généré, schéma, migrations et données d'amorçage — `pnpm --filter api
prepare-release`) et `frontend-dist.tar.gz` (la SPA), publiés sur la release GitHub ; enfin
`Deploy` sur staging. La même construction part ensuite en production.

**Deploy** (environnement + tag, case « seed » facultative) : se place sur le tag (réglages et
configuration de la Static Web App voyagent avec le code), se connecte à Azure par OIDC, recopie
la note `…<env>.deploy` de 1Password dans le Key Vault, puis `deploy/scripts/deploy.sh` :

1. `prisma migrate deploy` avec la chaîne du propriétaire ;
2. compte administrateur confirmé (`ADMIN_EMAIL`), puis, si « seed » est coché, les lieux, qualités
   et machines du classeur (idempotent : à cocher au premier déploiement d'un environnement) ;
3. réglages de la Function App : **exactement** ceux de `appsettings.json` de l'environnement
   (valeurs en clair, et secrets de la note listés par `keyVaultSecret`, en référence Key Vault),
   plus `APP_VERSION` et `GIT_SHA`. Un secret de la note absent du fichier ne va pas à la
   Function App ; un secret listé mais absent du coffre est omis avec un avertissement ;
4. paquet de la Function App (mise à jour progressive) ;
5. la SPA : tenant Entra injecté dans `staticwebapp.config.json`, identifiant et secret de
   l'inscription d'application posés dans les réglages de la Static Web App, puis `swa deploy` ;
6. attente que `https://<domaine>/api/health` annonce la nouvelle version (5 min au plus).

**Provision** (environnement) : `azd provision` applique `infra/main.bicep` avec
`infra/env/<env>.env` et la note `…<env>.provision`. Le template réécrit les réglages de la
Function App : le workflow redéploie ensuite la release qui tournait, pour lui rendre les siens.

Aucun identifiant Azure n'est stocké dans GitHub : chaque job prend l'identité managée de son
environnement GitHub (OIDC). Le seul secret du dépôt est `OP_SERVICE_ACCOUNT_TOKEN` (compte de
service 1Password, lecture du coffre `Azure-Infra-Secret`).

## Sans interruption

La Function App est en **Flex Consumption** avec `siteUpdateStrategy: RollingUpdate` : pendant
quelques minutes, deux versions tournent côte à côte. D'où trois règles :

- **Migrations expand/contract** : ajouter des tables, des colonnes nullables ou avec défaut. Un
  `DROP`, un `RENAME` ou un nouveau `NOT NULL` vient dans la release _suivante_.
- **Réglages, puis API, puis SPA** : l'ancienne SPA parle à la nouvelle API, jamais l'inverse.
- **Contrat d'API additif** : une route ou un champ de DTO s'ajoute dans une release et disparaît
  dans la suivante.

## Mise en place d'un environnement (une fois)

Prérequis : propriétaire de l'abonnement, `az login`, `gh auth login` (admin du dépôt), `psql`.

1. **Identités GitHub (OIDC)** :

   ```bash
   infra/scripts/github-oidc.sh staging <subscription-id>
   ```

   Crée le groupe de ressources, les identités `id-github-tekad-frais-staging` (Deploy) et
   `id-github-tekad-frais-staging-infra` (Provision), et les environnements GitHub `staging` et
   `staging-infra` avec leurs variables `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`,
   `AZURE_SUBSCRIPTION_ID`, `AZURE_PRINCIPAL_ID`. En production, ajouter des « Required
   reviewers » à l'environnement GitHub `production`. Secret du dépôt : `OP_SERVICE_ACCOUNT_TOKEN`.

2. **Inscription d'application Entra** (dans le tenant dont les comptes se connecteront — celui de
   Tekad en production) : application web, URI de redirection
   `https://<domaine>/.auth/login/aad/callback` et `https://<domaine>/public/log-in` (retour de la
   déconnexion Entra ID ; les mêmes pour le nom d'hôte de la Static Web App tant que le domaine
   n'existe pas), jeton d'ID activé avec le claim facultatif `login_hint` (passé en `logout_hint`
   à la déconnexion : la session Microsoft du compte est fermée sans choix du compte), un secret
   client. Restreindre l'accès aux
   personnes concernées par « Affectation requise » sur l'application d'entreprise.

   Le script fait tout cela et affiche les lignes `ENTRA_*` de la note `….deploy` (connecté avec
   `az login` à ce tenant ; `--subscription` ajoute le nom d'hôte de la Static Web App une fois
   Provision passé, `--new-secret` ajoute un secret à une application existante) :

   ```bash
   infra/scripts/entra-app.sh staging --subscription <subscription-id> --assignment-required
   ```

3. **Notes 1Password** (coffre `Azure-Infra-Secret`, une ligne `CLÉ=valeur` par variable) :

   `tekad-frais-infra.<env>.provision` — lu par Provision :

   ```text
   POSTGRESQL_ADMIN_PASSWORD=<openssl rand -base64 32>
   POSTGRESQL_ENTRA_ADMIN_OBJECT_ID=<object id de l'administrateur Entra (personne ou groupe)>
   POSTGRESQL_ENTRA_ADMIN_NAME=<son UPN ou nom de groupe>
   POSTGRESQL_ENTRA_ADMIN_TYPE=User
   ALERT_EMAILS=moi@exemple.ch,autre@exemple.ch
   ```

   En staging, la base est créée sur le serveur partagé `pg-neuralis-shared`
   (`POSTGRESQL_EXISTING_SERVER_ID` dans `infra/env/staging.env`) : `POSTGRESQL_ADMIN_PASSWORD`
   est alors le mot de passe actuel de son administrateur. En production, un serveur dédié
   (B1ms, sauvegardes 35 jours géo-redondantes).

   `tekad-frais-infra.<env>.deploy` — recopié dans le Key Vault à chaque déploiement :

   ```text
   ADMIN_EMAIL=<e-mail de l'administrateur Tekad>
   ENTRA_TENANT_ID=<id du tenant de l'inscription>
   ENTRA_CLIENT_ID=<id d'application (client)>
   ENTRA_CLIENT_SECRET=<secret client>
   # e-mails d'invitation (facultatifs : sans eux, les e-mails ne partent pas et sont écrits au journal)
   ACS_ACCESS_KEY=<clé d'accès de la ressource Communication Services>
   # réconciliation (facultatifs : sans eux, la source correspondante répond 409)
   BEXIO_API_TOKEN=<jeton personnel bexio : fichiers + comptabilité>
   SETTINGS_ENCRYPTION_KEY=<secret aléatoire ≥ 32 caractères : scelle la clé OpenRouter saisie dans l'application>
   OPENROUTER_API_KEY=<facultatif : clé OpenRouter si elle n'est pas saisie dans l'application>
   # comptes : vérification du tenant Entra ID du domaine (facultatif : sans elles, rien n'est vérifié)
   ENTRA_GRAPH_CLIENT_ID=<id d'application (client) de l'inscription Graph>
   ENTRA_GRAPH_CLIENT_SECRET=<son secret client>
   ```

   **Vérification Entra ID des comptes** : à la création d'un compte et au changement de son
   adresse, l'API vérifie que le domaine appartient au tenant de l'inscription de connexion ou à
   un tenant qu'elle autorise. La Function App reçoit `ENTRA_TENANT_ID` et
   `ENTRA_APP_CLIENT_ID` (= `ENTRA_CLIENT_ID`) des secrets de connexion déjà présents, et lit
   Microsoft Graph avec une inscription à part, dans le même tenant : permissions
   **d'application** `Application.Read.All`, `CrossTenantInformation.ReadBasic.All`, `User.Invite.All` (invités externes) et `AppRoleAssignment.ReadWrite.All` (les affecter à l'application quand l'affectation est requise ; sans elle, à faire à la main), consentement
   administrateur, un secret client → `ENTRA_GRAPH_CLIENT_ID` / `ENTRA_GRAPH_CLIENT_SECRET`.
   L'une sans l'autre : la création de comptes est refusée (409).

   **E-mails** : une ressource Azure Communication Services + Email Communication Services avec
   un domaine d'envoi vérifié (le domaine Azure gratuit suffit en staging), reliés l'une à
   l'autre. Son point de terminaison et l'expéditeur vont en clair dans
   `deploy/env/<env>/appsettings.json` (`ACS_ENDPOINT=https://<ressource>.communication.azure.com`,
   `ACS_SENDER_ADDRESS=DoNotReply@<domaine vérifié>`), la clé dans la note ;
   `APP_PUBLIC_URL` (même fichier) compose les liens.

   Seuls les secrets listés dans `deploy/env/<env>/appsettings.json` (`"keyVaultSecret"`) vont à
   la Function App : ajouter une clé à la note, c'est aussi l'ajouter au fichier. Pour retirer un
   secret : le retirer du fichier (la référence est supprimée au déploiement suivant), puis de la
   note et du Key Vault.

4. **Infrastructure** : Actions → `Provision` → l'environnement. Le résumé du job donne le nom
   d'hôte de la Static Web App (`STATIC_WEB_APP_HOSTNAME`).

5. **DNS**, chez le registraire, puis relancer `Provision` avec le domaine dans `CUSTOM_DOMAINS`
   (`infra/env/<env>.env`) :

   | Domaine                                     | Enregistrement                        |
   | ------------------------------------------- | ------------------------------------- |
   | `tekad-frais.neuralis.dev`                   | `CNAME` → `<STATIC_WEB_APP_HOSTNAME>` |
   | `frais.tekad.ch` (à confirmer) | `CNAME` → `<STATIC_WEB_APP_HOSTNAME>` |

   Tant que le DNS n'existe pas, laisser `CUSTOM_DOMAINS` vide (la validation échouerait).

6. **Rôle PostgreSQL de la Function App** (en administrateur Entra du serveur) :

   ```bash
   infra/scripts/postgres-entra-roles.sh staging <subscription-id>
   ```

   Sans accès en lecture au Key Vault, le script s'attribue « Key Vault Secrets User » sur le
   coffre le temps de l'exécution (il faut pouvoir attribuer des rôles : Owner ou User Access
   Administrator) et le retire à la fin.

7. **Premier déploiement** : `pnpm release` (ou Actions → Release), puis Actions → `Deploy` →
   l'environnement, le tag, **seed coché** (lieux, qualités et machines du classeur ; en staging aussi des journées de démonstration, jamais en production). Staging reçoit ensuite chaque
   release automatiquement ; la production par `Deploy`, derrière ses relecteurs.

## Coûts (ordre de grandeur, CHF/mois)

| Ressource                    | staging              | production                            |
| ---------------------------- | -------------------- | ------------------------------------- |
| Static Web App Standard      | ~9                   | ~9                                    |
| Functions Flex Consumption   | ~0 (à l'exécution)   | ~0–5 (à l'exécution)                  |
| PostgreSQL Flexible          | serveur partagé      | ~15 (B1ms, sauvegarde géo-redondante) |
| Storage, Key Vault           | < 2                  | < 2                                   |
| Log Analytics / App Insights | < 3 (plafond 1 Go/j) | < 5 (plafond 1 Go/j)                  |

## Exploitation

- **Version en service** : `curl https://frais.tekad.ch/api/health`.
- **Retour arrière** : `Deploy` avec le tag précédent. Une migration n'est jamais annulée : elle
  est additive (règle ci-dessus).
- **Logs et erreurs** : Application Insights ; une réponse 500 porte un `correlationId`
  (l'identifiant d'invocation), à rechercher dans `AppRequests` / `AppTraces`.
- **Administrateur supplémentaire** : depuis l'administration de l'application, ou
  `ADMIN_EMAIL=… DATABASE_URL=<POSTGRES-CONNECTION-STRING> node dist/ensure-admin.cjs` dans le
  paquet de la release.
