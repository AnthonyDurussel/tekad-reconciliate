# Infrastructure

Un environnement Azure de Tekad · Réconciliation des frais (staging, production) : `main.bicep`
déploie ses modules (`app/`) dans le groupe de ressources de l'environnement, créé par
`scripts/github-oidc.sh`, avec les paramètres de `env/<env>.env` et de la note 1Password
`tekad-frais-infra.<env>.provision` (`main.bicepparam`). Appliqué par `azd provision` (projet
`azure.yaml` à la racine) dans le workflow **Provision**.

| Module                          | Ressources                                                                    |
| ------------------------------- | ----------------------------------------------------------------------------- |
| `app/monitoring.bicep`          | Log Analytics (rétention, plafond quotidien), Application Insights            |
| `app/keyvault.bicep`            | Key Vault (RBAC), Secrets Officer pour l'identité de déploiement              |
| `app/storage.bicep`             | Compte de stockage : stockage de l'hôte Functions, paquet déployé             |
| `app/postgresql.bicep`          | PostgreSQL Flexible Server 16, Entra + mot de passe, base `tekad`     |
| `app/postgresql-existing.bicep` | La base sur un serveur existant (`POSTGRESQL_EXISTING_SERVER_ID`), à la place |
| `app/function.bicep`            | Function App Flex Consumption (Node 22), rolling update, identité managée     |
| `app/static-web-app.bicep`      | Static Web App Standard, backend lié (`/api`), domaines personnalisés         |
| `app/alerts.bicep`              | Test de disponibilité (`/api/health`), alertes journaux et métriques, e-mail  |

Scripts, lancés à la main une fois par environnement (`az login`) :

| Script                            | Rôle                                                                     |
| --------------------------------- | ------------------------------------------------------------------------ |
| `scripts/github-oidc.sh`          | Identités GitHub Actions (OIDC, aucun secret Azure stocké)               |
| `scripts/entra-app.sh`            | Inscription d'application Entra (connexion des utilisateurs)             |
| `scripts/postgres-entra-roles.sh` | Rôle PostgreSQL de l'identité de la Function App, droits sur les données |

Ordre de mise en place, notes 1Password, DNS et exploitation : [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md).

Les templates sont compilés et vérifiés par la CI (`az bicep build`, `az bicep lint`).
