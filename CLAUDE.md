# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`tekad-reconciliate` reconciles the **company's expenses** between **Revolut Business**, **UBS**,
**Anthony's current account** (compte courant associé) and **bexio**. Every receipt is dropped into
the **bexio inbox**; the app imports it, **reads it** (**Mistral OCR through OpenRouter**, then an LLM chosen in the
app extracts merchant, date, amount, VAT, **the last 4 digits of the card**), **classifies it by payment account** from the card, proposes an
**expense type** and the **bexio booking** (debit expense account / credit payment account / VAT
code), **matches Revolut receipts with the Revolut Business transactions** — imported from the **CSV
statement exported from Revolut Business** (the subscription has no API access) — and lists the
**Revolut debits without a receipt** (receipts to ask for). UBS reconciliation stays in bexio (bank
reconciliation): for UBS the app only proposes the booking.

Same architecture as `famsa-desk` (forked from it): a **pnpm + Turbo monorepo** (`pnpm@12`,
Node ≥ 22, `minimumReleaseAge` 24 h) with three workspaces:

- `apps/api` — backend on **Azure Functions** (TypeScript, ESM, Inversify, Prisma + PostgreSQL). Hexagonal/DDD. Bundled with esbuild.
- `apps/frontend` — **React 19 + Vite + Mantine + Redux Toolkit (RTK Query)** SPA, TekAD branding (www.tekad.ch: logo « TEK/D » with the green stroke `#16DB65`, black `#0D1012`; action green `#0A9E46`; Barlow).
- `packages/models` — `@repo/models`: DTOs, Yup request schemas, roles/permissions and **the pure reconciliation rules** (`utils/reconciliation.ts`), consumed by both apps **from its compiled `dist/`** — run `pnpm build` there after any change.

UI language is **French** (i18n fr + en).

## Hexagonal layout (API)

Each module: `domain/` (pure), `application/` (use cases + **ports**: `repositories/I*Repository.ts`,
`ports/I*.ts`), `infrastructure/` (Prisma repositories, HTTP controllers, **adapters** to bexio /
Revolut / OpenRouter, `ioc/` bindings), `index.functions.ts` (routes). Use cases only see ports.

| Module            | Role                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `user`            | accounts, roles, Entra access (from famsa-desk)                                                                                            |
| `settings`        | payment accounts + cards, expense types (`IPaymentAccountRepository`, `IExpenseCategoryRepository`)                                        |
| `expense`         | receipts: import, extraction, classification, matching, booking (`IExpenseRepository`)                                                    |
| `revolut`         | Revolut transactions (`IRevolutTransactionRepository`), CSV statement import (`domain/RevolutStatement.ts`, pure parser)                   |
| `bexio`           | port `IBexioGateway` (inbox files, download, accounts, taxes, manual entries + attachment), adapter `BexioHttpGateway`                     |
| `extraction`      | port `IReceiptReader`, adapter `OpenRouterReceiptReader` (Mistral OCR `file-parser` plugin + JSON-schema output)                          |
| `ai`              | AI settings administered in the app (`ai_settings`, like dranse-risque): OpenRouter key sealed, extraction model, OCR engine; `AiRuntime` |
| `bexio-expense`   | bexio expenses (« Ausgaben », `GET 4.0/expenses`) synced to `bexio_expenses`: receipt linked, reconciliation checked (`checkBexioExpense()`), « Lier une pièce » |
| `sync`            | orchestration: `SyncUseCases` (inbox → extraction → matching; Revolut statement import + matching), `sync_runs` log, nightly timer        |
| `dashboard`       | aggregates per status / account / type, missing receipts                                                                                   |
| `config`          | backend info                                                                                                                               |
| `notification`    | e-mails (invitation)                                                                                                                       |

A gateway whose env is missing is **not configured**: `sync/status` says so and the sync routes
answer 409 — never a 500.

## Domain

| Notion                                                                                                                                                                                                                       | Code                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Compte de paiement: any account (nature `REVOLUT`, `UBS` = bank, `PERSONAL`, `OTHER` — display and defaults only); bexio account credited (`1021`, `1020`, `2210`…); **rapprochement** `reconciliation`: `BEXIO` (bank reconciliation done in bexio, e.g. UBS — the app proposes the booking only), `STATEMENT_IMPORT` (CSV statement imported here, format `statementFormat` `REVOLUT_BUSINESS` / `REVOLUT_PERSONAL`; every debit needs its receipt; optional statement account name `revolutAccountId` for multi-account Business statements) or `NONE` (no statement, e.g. compte courant); `bookingMode` derived (`bookingModeFor()`: BEXIO → `BEXIO_RECONCILIATION`, else `MANUAL_ENTRY`) | `payment_accounts`, `PaymentAccountDTO`                  |
| Carte: typed in full or masked in « Comptes et cartes » (`number`, never stored) → last 4 digits (unique) + masked form `516760******4721` (`maskCardNumber()`); also added automatically from the Revolut statement (`Card number`, `Card label`) to the Revolut account; the card read on a receipt gives its payment account (`accountForCard()`) | `payment_cards`                                          |
| Type de dépense: **taken from the bexio chart of accounts** — one per active EXPENSE account (`POST expense-categories/sync-bexio`: code = account number, label = bexio name, bexio `tax_id` and its rate; default keyword / MCC rules by account number on creation, `DEFAULT_RULES_BY_ACCOUNT`; the user's rules kept; a type whose account left bexio is deactivated); **keywords** and **MCC codes** (`categoryByRules()`) | `expense_categories` (`bexio_account_id`), `ExpenseCategoryDTO` |
| Pièce: one bexio inbox file; extraction, account (+ source CARD / TRANSACTION / MANUAL), type (+ source RULE / AI / MANUAL), booking overrides, Revolut transaction, bexio entry                                             | `expenses`, `ExpenseDTO`, `Expense` (domain)             |
| Transaction Revolut: one statement row (ID + `Account`); `requiresReceipt()` (debit, completed/pending, not exchange/fee/topup/refund); may be ignored (« pas de pièce ») with a reason                                    | `revolut_transactions`, `RevolutTransactionDTO`          |

bexio chart (`GET bexio/accounts`, `GET bexio/taxes`, port `IBexioGateway.listAccounts/listTaxes`): with bexio configured, an expense type's account must be an EXPENSE account and a payment account's an ASSET or LIABILITY account of the chart (400 otherwise); without bexio the number is taken as typed. The screens pick accounts and VAT codes from these lists (free text when bexio answers 409).

Status (`expenseStatus()`): `NEW` (not read) → `TO_REVIEW` / `READY` (computed: date, amount,
payment account, type, and **for a `STATEMENT_IMPORT` account the matched transaction**) → `BOOKED`; `IGNORED` aside.
Precedence: a MANUAL value is never overwritten by a re-extraction or a sync.

Classification order for the payment account: card on the receipt → the matched Revolut
transaction's account → manual. Type: keyword/MCC rule → the AI's proposal (`categoryCode`) → manual.

Statement import (`POST revolut/import`, `paymentAccountId` = the account whose statement it is —
required when several accounts are `STATEMENT_IMPORT`; its `statementFormat` applies; a file of the
other format is refused). `REVOLUT_PERSONAL` = Revolut app CSV (`Type, Product, Started Date,
Completed Date, Description, Amount, Fee, Currency, State, Balance`; no ID → stable hash; fee apart).
Revolut Business statement (`parseRevolutStatement()`): Revolut Business → Transactions → Statement → CSV.
Columns found by name (English export: `Date started (UTC)`, `Date completed (UTC)`, `ID`, `Type`,
`State`, `Description` = merchant, `Card number` `516760******4721`, `Orig currency` / `Orig amount`
(unsigned), `Payment currency`, `Amount`, `Total amount` = Amount + Fee, `Account` « CHF Main »,
`MCC`; French headers, `;` and `jj.mm.aaaa` tolerated). Amount kept = `Total amount` (what left the
account); `Orig amount` in its currency = `billAmount` for matching. Unique (ID, Account): re-importing
or overlapping statements updates, never duplicates. Rows go to the payment account whose
`revolutAccountId` equals `Account` (case-insensitive) among the imported accounts, else the chosen
account. Unknown cards of the statement join that account (`cardsAdded`). The
import then runs the matching.

Matching (`scoreMatch()`, `autoMatch()`): amount is mandatory (account amount, or bill amount in the
receipt currency, ±0.01), date ≤ 5 days, card, merchant similarity; auto-match at ≥ 70 points and
10 ahead of the next. A transaction belongs to one receipt at most.

Dépenses bexio (`bexio-expense`): `POST sync/bexio-expenses` (also last step of `sync/all`) reads every
bexio expense, resolves its booking account (chart) and its paying bank account (`3.0/banking/accounts`), stores
them (the paying payment account: chosen on the expense `bexio_expenses.payment_account_id`, kept by
syncs › the payment account associated with the bexio bank account `bexio_bank_account_id` › the
payment account whose `bexioAccountNo` is the bank's chart account; `paymentAccountSource`), and links each pièce whose
file UUID (`expenses.bexio_file_uuid`) is among the expense's `attachment_ids` (`Expense.linkBexioExpense`
→ BOOKED); a pièce linked to an expense gone from bexio is unlinked. `checkBexioExpense()` flags
`MISSING_RECEIPT` (no attachment, no linked pièce), `NOT_RECONCILED` (account `BEXIO`: no bexio
`transaction_id`; account `STATEMENT_IMPORT`: linked pièce without statement transaction and no bexio
`transaction_id`; `NONE`: not required), `UNKNOWN_ACCOUNT`, `DRAFT`. `POST bexio-expenses/{id}/link`
attaches the pièce's file to the bexio expense (`PUT 4.0/expenses/{id}` with all its fields +
`attachment_ids`) and links it; one pièce per bexio expense.

Booking (`bookingProposal()`): debit = override ?? type account, credit = override ?? payment
account's bexio account, tax = override ?? type's; amount CHF = Revolut debited amount, else the
receipt amount if CHF. `POST expenses/{id}/book` on a `READY` receipt: `MANUAL_ENTRY` → when the
credited account is a bexio **bank account**, a bexio **expense** (`POST 4.0/expenses` with the pièce's
file UUID in `attachment_ids`, bank and booking account, tax, then `PUT …/bookings/DONE`;
`bexioExpenseId` kept), otherwise (compte courant…) a bexio manual entry + receipt attached
(`bexioEntryId` kept); `BEXIO_RECONCILIATION` → marked booked (done
in bexio).

## Roles & permissions

Static, in `packages/models/src/@types/authorization.ts`. **Never test a role in business code** — ask for a permission.

| Role         | Permissions                                                      |
| ------------ | ---------------------------------------------------------------- |
| `ADMIN`      | all                                                              |
| `ACCOUNTANT` | `EXPENSE_VIEW`, `EXPENSE_MANAGE`, `EXPENSE_BOOK`, `SYNC_RUN`     |
| `VIEWER`     | `EXPENSE_VIEW`                                                   |

`SETTINGS_MANAGE` (accounts, cards, types), `USER_MANAGE` (accounts) are ADMIN only.

## API contract (`/api/...`)

Every route goes through `route()` (`shared/infrastructure/http/registerRoute.ts`): principal (401) →
typed errors → request container → declared `access` (403). Bodies: `parseBody(request, schema)`.

| Route                                                                                        | Permission                         | Body / answer                                                     |
| -------------------------------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------- |
| `GET users/me`, `GET users/options`, `PUT users/me/preferences`                              | authenticated                      |                                                                   |
| `GET/POST users`, `PUT/DELETE users/{id}`, `POST users/{id}/invitation`, `GET users/entra-access` | `USER_MANAGE`                  |                                                                   |
| `GET config/backend`; `POST roles`, `GET health` (public)                                    | authenticated / —                  |                                                                   |
| `GET payment-accounts`, `GET expense-categories`                                             | `EXPENSE_VIEW` or `SETTINGS_MANAGE` | `PaymentAccountDTO[]` / `ExpenseCategoryDTO[]` (`expenseCount`)  |
| `POST`, `PUT/DELETE …/{id}` on both                                                          | `SETTINGS_MANAGE`                  | delete → 409 while used: deactivate                               |
| `POST expense-categories/sync-bexio`                                                         | `SETTINGS_MANAGE`                  | → `CategorySyncResultDTO`; 409 without bexio                      |
| `GET bexio/accounts`, `GET bexio/taxes`                                                      | `EXPENSE_VIEW` or `SETTINGS_MANAGE` | `BexioAccountDTO[]` / `BexioTaxDTO[]`; 409 without bexio          |
| `GET expenses?from&to&paymentAccountId&categoryId&status&search`                             | `EXPENSE_VIEW`                     | `ExpenseDTO[]` (`paymentAccountId=none` / `categoryId=none`: unset) |
| `GET expenses/export?…same filters`                                                          | `EXPENSE_VIEW`                     | `.xlsx`                                                           |
| `GET expenses/{id}`, `GET expenses/{id}/candidates`, `GET expenses/{id}/file`                | `EXPENSE_VIEW`                     | `ExpenseDTO` (+ `transaction`) / `MatchCandidateDTO[]` / the file |
| `PUT expenses/{id}`                                                                          | `EXPENSE_MANAGE`                   | `UpdateExpenseDTO` → `ExpenseDTO` (set fields become MANUAL)      |
| `POST expenses/{id}/extract`, `/match`, `/ignore`, `/restore`                                | `EXPENSE_MANAGE`                   | — / `MatchExpenseDTO` / `IgnoreDTO` → `ExpenseDTO`                |
| `POST expenses/{id}/book`, `/unbook`                                                         | `EXPENSE_BOOK`                     | → `ExpenseDTO`; 409 unless READY (book) / BOOKED (unbook)         |
| `GET revolut/transactions?from&to&filter&search`                                             | `EXPENSE_VIEW`                     | `RevolutTransactionDTO[]`; `filter=missing` = receipts to ask for |
| `POST revolut/transactions/{id}/ignore`, `/restore`                                          | `EXPENSE_MANAGE`                   | `IgnoreDTO` → `RevolutTransactionDTO`                             |
| `GET bexio-expenses?from&to&paymentAccountId&issue&search`                                  | `EXPENSE_VIEW`                     | `BexioExpenseDTO[]` (`issue` = a `BexioExpenseIssueDTO` or `ok`)  |
| `GET bexio-expenses/{id}`                                                                    | `EXPENSE_VIEW`                     | `BexioExpenseDetailDTO` (+ `attachments`: uuid, name, mime — `3.0/files/search` by uuid) |
| `GET bexio-expenses/{id}/files/{uuid}`                                                       | `EXPENSE_VIEW`                     | the attached file (only one of this expense, or its linked pièce's) |
| `PUT bexio-expenses/{id}/payment-account`                                                    | `EXPENSE_MANAGE`                   | `SetBexioExpenseAccountDTO` (`applyToBankAccount` → `payment_accounts.bexio_bank_account_id`) |
| `POST bexio-expenses/{id}/link`, `/unlink`                                                   | `EXPENSE_MANAGE`                   | `LinkBexioExpenseDTO` → `BexioExpenseDTO`                         |
| `GET dashboard?from&to`                                                                      | `EXPENSE_VIEW`                     | `DashboardDTO`                                                    |
| `GET sync/status`, `GET sync/runs`                                                           | `EXPENSE_VIEW`                     | `SyncStatusDTO` / `SyncRunDTO[]` (50 last)                        |
| `GET/PUT/DELETE ai/settings`, `POST ai/settings/models`, `POST ai/settings/test`              | `SETTINGS_MANAGE`                  | `AiSettingsDTO` / `UpdateAiSettingsDTO` (`apiKey` absent keeps the stored one) / back to env; `AiConnectionDTO` → `AiModelDTO[]` / `AiConnectionTestDTO` |
| `POST revolut/import`                                                                        | `SYNC_RUN`                         | `RevolutImportDTO` (CSV text, ≤ 10 MB) → `RevolutImportResultDTO`; 400 if unreadable |
| `POST sync/bexio-inbox`, `POST sync/extract`, `POST sync/match`, `POST sync/bexio-expenses`, `POST sync/all`             | `SYNC_RUN`                         | → `SyncRunDTO` (`sync/all` → `SyncRunDTO[]`); 409 if not configured |

Timer `nightlySync` (05:15 UTC, `SYNC_CRON` overrides): `sync/all` when configured.

## Configuration (app settings / `local.settings.json`)

- `DATABASE_URL` (local) / `DATABASE_ENTRA_URL` (Azure).
- bexio: `BEXIO_API_TOKEN` (personal access token, scopes: `file`, `accounting`, `kb_expense_show` + expense write, `bank_account_show`, `kb_*` read), `BEXIO_API_URL` (default `https://api.bexio.com`).
- Revolut: nothing — the statement is uploaded (`POST revolut/import`).
- AI: set in the app (« Intelligence artificielle », `SETTINGS_MANAGE`) — OpenRouter API key (sealed AES-256-GCM with `SETTINGS_ENCRYPTION_KEY` ≥ 32 chars, hint `…abcd` only, never returned), extraction model (catalogue `GET /models` listed by the screen, « JSON » badge = structured outputs), OCR engine (`mistral-ocr` default, `pdf-text`, `native`), test call. `AiRuntime` resolves stored row (disabled or unreadable key → AI off) › env `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` / `OPENROUTER_OCR_ENGINE`; cached 30 s, invalidated on save.

## AI — reading a receipt

`OpenRouterReceiptReader`: one `POST /chat/completions` on OpenRouter with the file as a `file` part
(PDF; a JPEG / PNG is first wrapped into a one-page PDF with pdf-lib so that Mistral OCR reads it;
other images, or engine `native`, go as `image_url` to the model), `plugins: [{ id: "file-parser",
pdf: { engine } }]`, `response_format` json_schema (strict) and a French system prompt; the answer is
normalised by `toExtraction()` (dates, ISO currency, card last 4 cross-checked with
`detectCardLast4()`, category code only from the list passed).

## Frontend screens

`/dashboard` « Tableau de bord » (KPIs per status, amounts per payment account and per type, missing
Revolut receipts, last syncs + sync buttons); `/expenses` « Pièces » (filters: period, **payment
account**, **type**, status, search — kept in the URL; table with account / type / booking / status;
Excel); `/expenses/:id` (receipt preview, extracted fields, account & type, booking proposal,
Revolut match + candidates, actions); `/revolut` « Revolut » (« Importer le relevé Revolut (CSV) », also in the dashboard sync panel; transactions; tab **Pièces manquantes**);
`/admin/accounts` « Comptes et cartes », `/admin/categories` « Types de dépense », `/admin/ai` « Intelligence artificielle », `/admin/users`.
Home: `/dashboard`.

## Commands

From the repo root: `pnpm install`, `pnpm build`, `pnpm lint`, `pnpm test`.

- `packages/models`: `pnpm build`, `pnpm test`.
- `apps/api`: `pnpm dev`, **`pnpm dev:server`** (routes on :7071 without Azure Functions Core Tools), `pnpm build`, `pnpm test`, `pnpm migrate` / `pnpm migrate:deploy`, `pnpm seed` (payment accounts — expense types come from bexio; idempotent).
- `apps/frontend`: `pnpm dev` (Vite, proxies `/api` to :7071, mocks `/.auth`), `pnpm build`, `pnpm vitest`, `pnpm check-i18n`, `pnpm typecheck`.

## Deployment (Azure)

Same mechanics as famsa-desk — `docs/DEPLOYMENT.md`, Bicep in `infra/`, workflows Provision / Release / Deploy.

## Conventions

- Commit messages: Conventional Commits.
- Mirror an existing module when adding one (`domain/`, `application/`, `infrastructure/` + `ioc/`, `index.functions.ts`).
- Errors are typed (`shared/domain/errors.ts`); a 500 never leaks a message.
- Money: `Decimal(12,2)` in the database, `number` in DTOs.
