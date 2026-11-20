# Deploy

Déploie une **release publiée** (`function-app.zip` et `frontend-dist.tar.gz`, attachés à la
release GitHub par le workflow Release) sur un environnement. La même construction va en staging,
puis en production.

```text
env/<env>/deploy.env                 groupe de ressources, URL publique
env/<env>/appsettings.json           tous les réglages de la Function App : valeurs, et secrets
                                     de la note 1Password par "keyVaultSecret"
env/<env>/staticwebapp.config.json   connexion Entra (__ENTRA_TENANT_ID__ remplacé au déploiement),
                                     routes protégées, en-têtes, CSP
scripts/deploy.sh                    migrations → admin (+ seed) → réglages → API → SPA → santé
scripts/op-env.sh                    note 1Password → variables du job ou secrets Key Vault
```

Workflow **Deploy** (Actions → Deploy → environnement + tag), ou depuis un poste connecté à Azure
(`az login`) et à GitHub (`gh auth login`) :

```bash
pnpm install --filter @repo/deploy
deploy/scripts/deploy.sh staging v0.2.0           # SEED=true pour charger lieux, qualités, machines
```

Détails : [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md).
