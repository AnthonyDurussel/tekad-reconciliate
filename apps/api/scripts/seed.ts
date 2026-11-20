/**
 * Amorçage du paramétrage : les comptes de paiement (Revolut, UBS, compte
 * courant d'Anthony). Idempotent : un compte se retrouve par son nom ; rien
 * d'existant n'est modifié. Les types de dépense viennent du plan comptable
 * bexio (« Synchroniser avec bexio » dans Types de dépense) ; les cartes se
 * saisissent dans Comptes et cartes, ou arrivent avec le relevé Revolut.
 *
 * Puis, sauf `SEED_DEMO=false` (toujours en production), quelques pièces et
 * transactions Revolut de démonstration (`demo-*`), pour l'interface.
 *
 *   pnpm seed              # DATABASE_URL : environnement, local.settings.json, puis .env
 *   SEED_DEMO=false pnpm seed
 *   node dist/seed.cjs     # depuis le paquet de la release (workflow Deploy)
 */
import "./load-env.mjs";
import {
  BookingModeDTO,
  ExpenseStatusDTO,
  PaymentAccountKindDTO,
  RoleDTO,
} from "@repo/models";
import { prisma } from "@/shared/infrastructure/prismaClient.js";

const ACCOUNTS = [
  {
    kind: PaymentAccountKindDTO.REVOLUT,
    name: "Revolut Business",
    bexio_account_no: "1021",
    booking_mode: BookingModeDTO.MANUAL_ENTRY,
  },
  {
    kind: PaymentAccountKindDTO.UBS,
    name: "UBS",
    bexio_account_no: "1020",
    booking_mode: BookingModeDTO.BEXIO_RECONCILIATION,
  },
  {
    kind: PaymentAccountKindDTO.PERSONAL,
    name: "Compte courant Anthony",
    bexio_account_no: "2210",
    booking_mode: BookingModeDTO.MANUAL_ENTRY,
  },
];

async function seedSettings() {
  let created = 0;
  for (const [position, a] of ACCOUNTS.entries()) {
    if (
      !(await prisma.paymentAccountDB.findUnique({ where: { name: a.name } }))
    ) {
      await prisma.paymentAccountDB.create({ data: { ...a, position } });
      created++;
    }
  }
  console.log(`paramétrage : ${created} élément(s) créé(s)`);
}

/** Démonstration : une carte Revolut, 4 transactions, 4 pièces lues. */
async function seedDemo() {
  const revolut = await prisma.paymentAccountDB.findUnique({
    where: { name: "Revolut Business" },
  });
  if (!revolut) return;
  if (!revolut.revolut_account_id) {
    await prisma.paymentAccountDB.update({
      where: { id: revolut.id },
      data: { revolut_account_id: "CHF Main" },
    });
  }
  if (!(await prisma.paymentCardDB.findUnique({ where: { last4: "4821" } }))) {
    await prisma.paymentCardDB.create({
      data: { account_id: revolut.id, last4: "4821", label: "Carte Anthony" },
    });
  }
  const day = (offset: number) => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - offset);
    return d;
  };
  const txs = [
    {
      id: "demo-tx-1",
      merchant: "Swisscom",
      amount: -89.9,
      mcc: "4814",
      offset: 3,
    },
    {
      id: "demo-tx-2",
      merchant: "Restaurant du Flon",
      amount: -64.5,
      mcc: "5812",
      offset: 5,
    },
    {
      id: "demo-tx-3",
      merchant: "Google Workspace",
      amount: -23.4,
      mcc: "5818",
      offset: 7,
      bill: -24,
      billCurrency: "EUR",
    },
    {
      id: "demo-tx-4",
      merchant: "SBB CFF FFS",
      amount: -112,
      mcc: "4112",
      offset: 9,
    },
  ];
  for (const t of txs) {
    await prisma.revolutTransactionDB.upsert({
      where: { revolut_id_leg_id: { revolut_id: t.id, leg_id: `${t.id}-leg` } },
      update: {},
      create: {
        revolut_id: t.id,
        leg_id: `${t.id}-leg`,
        revolut_account_id: "CHF Main",
        payment_account_id: revolut.id,
        type: "card_payment",
        state: "completed",
        occurred_at: day(t.offset),
        merchant_name: t.merchant,
        description: t.merchant,
        mcc: t.mcc,
        amount: t.amount,
        currency: "CHF",
        bill_amount: t.bill ?? t.amount,
        bill_currency: t.billCurrency ?? "CHF",
        card_last4: "4821",
        requires_receipt: true,
      },
    });
  }
  const receipts = [
    {
      file: "demo-1",
      name: "swisscom-facture.pdf",
      merchant: "Swisscom (Schweiz) AG",
      total: 89.9,
      currency: "CHF",
      card: "4821",
      offset: 3,
    },
    {
      file: "demo-2",
      name: "ticket-restaurant.jpg",
      merchant: "Restaurant du Flon",
      total: 64.5,
      currency: "CHF",
      card: "4821",
      offset: 5,
    },
    {
      file: "demo-3",
      name: "google-invoice.pdf",
      merchant: "Google Cloud EMEA",
      total: 24,
      currency: "EUR",
      card: "4821",
      offset: 7,
    },
    {
      file: "demo-4",
      name: "migros-ticket.jpg",
      merchant: "Migros",
      total: 37.15,
      currency: "CHF",
      card: null,
      offset: 4,
    },
  ];
  for (const r of receipts) {
    if (await prisma.expenseDB.findUnique({ where: { bexio_file_id: r.file } }))
      continue;
    await prisma.expenseDB.create({
      data: {
        bexio_file_id: r.file,
        file_name: r.name,
        mime_type: r.name.endsWith(".pdf") ? "application/pdf" : "image/jpeg",
        status: ExpenseStatusDTO.TO_REVIEW,
        date: day(r.offset),
        merchant: r.merchant,
        total_amount: r.total,
        currency: r.currency,
        vat_rate: 8.1,
        card_last4: r.card,
        payment_method: r.card ? "card" : "cash",
        extracted_at: new Date(),
        extraction: {
          merchant: r.merchant,
          date: day(r.offset).toISOString().slice(0, 10),
          totalAmount: r.total,
          currency: r.currency,
          vatAmount: null,
          vatRate: 8.1,
          cardLast4: r.card,
          paymentMethod: r.card ? "card" : "cash",
          categoryCode: null,
          description: null,
          confidence: 0.9,
          error: null,
        },
      },
    });
  }
  console.log(
    "démonstration : 4 pièces lues et 4 transactions Revolut — lancez « Rapprocher » (POST sync/match)",
  );
}

/** Comptes de développement offerts par la page de connexion simulée (`apps/frontend/mock`). */
async function seedDevUsers() {
  const users = [
    { email: "admin@tekad.dev", name: "Admin Tekad", role: RoleDTO.ADMIN },
    {
      email: "comptable@tekad.dev",
      name: "Comptable",
      role: RoleDTO.ACCOUNTANT,
    },
    { email: "lecture@tekad.dev", name: "Lecture", role: RoleDTO.VIEWER },
  ];
  for (const u of users) {
    if (!(await prisma.userDB.findUnique({ where: { email: u.email } }))) {
      await prisma.userDB.create({ data: u });
    }
  }
}

async function main() {
  await seedSettings();
  if (process.env.SEED_DEMO?.trim().toLowerCase() !== "false") {
    await seedDevUsers();
    await seedDemo();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
