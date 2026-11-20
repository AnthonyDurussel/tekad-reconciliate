/**
 * Amorçage du paramétrage : comptes de paiement (Revolut, UBS, compte
 * courant d'Anthony) et types de dépense d'une PME suisse (plan comptable
 * PME/KMU). Idempotent : un compte se retrouve par son nom, un type par son
 * code ; rien d'existant n'est modifié. Les cartes et les codes TVA bexio
 * (`tax_id`) se règlent ensuite dans l'administration.
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

const CATEGORIES: {
  code: string;
  label: string;
  bexio_account_no: string;
  vat_rate: number | null;
  keywords: string[];
  mcc_codes: string[];
}[] = [
  {
    code: "IT",
    label: "Informatique et logiciels",
    bexio_account_no: "6570",
    vat_rate: 8.1,
    keywords: [
      "google",
      "microsoft",
      "adobe",
      "github",
      "aws",
      "amazon web services",
      "openai",
      "anthropic",
      "notion",
      "atlassian",
      "slack",
      "zoom",
      "figma",
      "jetbrains",
      "vercel",
      "azure",
      "infomaniak",
      "hostpoint",
    ],
    mcc_codes: ["5734", "5817", "5818", "7372", "4816"],
  },
  {
    code: "MATINFO",
    label: "Matériel informatique",
    bexio_account_no: "6570",
    vat_rate: 8.1,
    keywords: [
      "digitec",
      "galaxus",
      "brack",
      "interdiscount",
      "apple store",
      "fust",
    ],
    mcc_codes: ["5732", "5045"],
  },
  {
    code: "TEL",
    label: "Téléphone et internet",
    bexio_account_no: "6510",
    vat_rate: 8.1,
    keywords: ["swisscom", "salt", "sunrise", "wingo", "yallo"],
    mcc_codes: ["4814", "4899"],
  },
  {
    code: "REPAS",
    label: "Repas et représentation",
    bexio_account_no: "6640",
    vat_rate: 8.1,
    keywords: ["restaurant", "café", "cafe", "brasserie", "pizzeria", "bistro"],
    mcc_codes: ["5812", "5813", "5814"],
  },
  {
    code: "DEPL",
    label: "Déplacements (train, avion, hôtel)",
    bexio_account_no: "6640",
    vat_rate: 8.1,
    keywords: [
      "sbb",
      "cff",
      "ffs",
      "easyjet",
      "swiss international",
      "lufthansa",
      "booking com",
      "airbnb",
      "uber",
      "hotel",
      "mobility",
    ],
    mcc_codes: ["4111", "4112", "4121", "4131", "4511", "7011"],
  },
  {
    code: "VEHI",
    label: "Véhicule et carburant",
    bexio_account_no: "6200",
    vat_rate: 8.1,
    keywords: [
      "shell",
      "avia",
      "tamoil",
      "migrol",
      "socar",
      "eni",
      "parking",
      "bp",
    ],
    mcc_codes: ["5541", "5542", "7523"],
  },
  {
    code: "BUREAU",
    label: "Fournitures et frais de bureau",
    bexio_account_no: "6500",
    vat_rate: 8.1,
    keywords: ["papeterie", "office world", "poste", "la poste"],
    mcc_codes: ["5111", "5943", "9402"],
  },
  {
    code: "PUB",
    label: "Marketing et publicité",
    bexio_account_no: "6600",
    vat_rate: 8.1,
    keywords: [
      "linkedin",
      "meta platforms",
      "facebook",
      "google ads",
      "mailchimp",
    ],
    mcc_codes: ["7311"],
  },
  {
    code: "FORM",
    label: "Formation",
    bexio_account_no: "5810",
    vat_rate: 8.1,
    keywords: ["udemy", "coursera", "formation"],
    mcc_codes: ["8299"],
  },
  {
    code: "BANQUE",
    label: "Frais bancaires",
    bexio_account_no: "6940",
    vat_rate: null,
    keywords: ["frais bancaires", "commission"],
    mcc_codes: [],
  },
  {
    code: "DIVERS",
    label: "Autres charges",
    bexio_account_no: "6700",
    vat_rate: 8.1,
    keywords: [],
    mcc_codes: [],
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
  for (const [position, c] of CATEGORIES.entries()) {
    if (
      !(await prisma.expenseCategoryDB.findUnique({ where: { code: c.code } }))
    ) {
      await prisma.expenseCategoryDB.create({ data: { ...c, position } });
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
      data: { revolut_account_id: "demo-revolut-chf" },
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
        revolut_account_id: "demo-revolut-chf",
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

async function main() {
  await seedSettings();
  if (process.env.SEED_DEMO?.trim().toLowerCase() !== "false") {
    await seedDemo();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
