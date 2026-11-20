# API — Tekad, réconciliation des frais

Azure Functions (Node 22, TypeScript ESM, Inversify, Prisma 7 + PostgreSQL), hexagonal :
chaque module a `domain/`, `application/` (cas d'usage + ports), `infrastructure/` (adaptateurs
Prisma / HTTP / services externes, `ioc/`) et `index.functions.ts`.

| Module         | Rôle                                                                                  |
| -------------- | ------------------------------------------------------------------------------------- |
| `user`         | comptes, rôles, extracteur de rôles SWA, vérification Entra ID, invitation            |
| `config`       | `config/backend`, `health`                                                            |
| `settings`     | comptes de paiement (Revolut, UBS, compte courant) et cartes, types de dépense        |
| `expense`      | pièces de l'inbox bexio : lecture, classement, rapprochement, comptabilisation, Excel |
| `revolut`      | transactions Revolut Business (port `IRevolutGateway`), pièces manquantes             |
| `bexio`        | port `IBexioGateway` et adaptateur HTTP (inbox, fichiers, écritures manuelles)        |
| `extraction`   | port `IReceiptReader`, adaptateur Claude (vision + sortie JSON)                       |
| `sync`         | synchronisations journalisées + minuteur de nuit                                      |
| `dashboard`    | agrégats par statut, compte et type                                                   |
| `notification` | e-mail (Azure Communication Email ou journal)                                         |

## Développement local

```bash
sudo -u postgres psql -c "CREATE USER tekad WITH PASSWORD 'tekad' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE tekad OWNER tekad;"
cp local.settings.json.example local.settings.json   # DATABASE_URL, BEXIO_*, REVOLUT_*, ANTHROPIC_API_KEY
pnpm migrate            # migrations
pnpm seed               # comptes de paiement, types de dépense + démonstration (SEED_DEMO=false : sans)
pnpm dev                # esbuild + func start (Azure Functions Core Tools, Azurite)
pnpm dev:server         # ou, sans Core Tools : mêmes routes sur :7071 (scripts/dev-server.ts)
```

Appel direct (le principal Azure est un en-tête base64) :

```bash
P=$(printf '{"userId":"me","userDetails":"admin@tekad.ch","userRoles":[],"identityProvider":"aad","claims":[]}' | base64 -w0)
curl -H "x-ms-client-principal: $P" http://localhost:7071/api/users/me
curl -H "x-ms-client-principal: $P" -X POST http://localhost:7071/api/sync/all
```

Le premier compte qui se connecte sans administrateur actif en base devient `ADMIN`.

## Tests

`pnpm test` (vitest) : agrégat `Expense`, cas d'usage des pièces avec faux adaptateurs (inbox →
lecture → rapprochement → écriture bexio), adaptateurs bexio et Revolut (fetch simulé, JWT),
normalisation de la lecture Claude, tableau de bord, table des routes, comptes et autorisations.
