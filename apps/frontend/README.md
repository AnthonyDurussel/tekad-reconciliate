# Frontend — Tekad · Réconciliation des frais

SPA React 19 + Vite + Mantine + Redux Toolkit (RTK Query). Charte : sarcelle `#0B8577` (couleur
`tekad` de `theme.ts`) sur encre bleu nuit `#0F1C2B`, police Barlow.

- `pnpm dev` : Vite sur :5173, `/api` relayé vers :7071 (`pnpm dev` ou `pnpm dev:server` dans
  `apps/api`), `/.auth` simulé : la page de connexion propose les comptes de dev
  (`mock/token.ts`) : ADMIN, ACCOUNTANT, VIEWER. Le rôle effectif vient de l'API (`POST roles`).
- `src/pages/dashboard/` — tableau de bord (statuts, montants par compte et par type, pièces
  Revolut manquantes) et panneau de synchronisation.
- `src/pages/expenses/` — liste filtrée (filtres dans l'URL, export Excel) et détail d'une pièce
  (aperçu, champs, imputation bexio, rapprochement Revolut, actions).
- `src/pages/revolut/` — transactions Revolut, onglet « Pièces manquantes » (liste à copier).
- `src/pages/admin/` — comptes et cartes, types de dépense, utilisateurs.
- `src/store/slices/api/` — un `createApi` (`baseApi`), un module par domaine
  (`settingsApi`, `expensesApi`, `revolutApi`, `dashboardApi`, `syncApi`, `usersApi`) ; les
  mutations invalident les étiquettes des listes qu'elles changent.
- `src/components/loading/` — rideau de chargement animé sur la marque Tekad (le ticket et son
  losange).

`pnpm typecheck`, `pnpm eslint`, `pnpm vitest`, `pnpm check-i18n`, `pnpm build`.
