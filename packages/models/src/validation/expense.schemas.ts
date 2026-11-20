import { number, string, type ObjectSchema } from "yup";
import type {
  IgnoreDTO,
  MatchExpenseDTO,
  UpdateExpenseDTO,
} from "../@types/dto/expense.dto.js";
import type { RevolutSyncRequestDTO } from "../@types/dto/sync.dto.js";
import {
  optionalDay,
  optionalId,
  optionalText,
  strictObject,
} from "./common.schemas.js";

const money = () =>
  number().min(-1_000_000).max(1_000_000).nullable().optional();

const accountNo = () =>
  string()
    .trim()
    .matches(/^\d{3,6}$/, "compte bexio : 3 à 6 chiffres")
    .nullable()
    .optional();

export const updateExpenseSchema: ObjectSchema<UpdateExpenseDTO> = strictObject({
  date: optionalDay(),
  merchant: string().trim().max(255).nullable().optional(),
  description: optionalText(1000),
  totalAmount: money(),
  currency: string()
    .trim()
    .uppercase()
    .matches(/^[A-Z]{3}$/, "devise : code ISO à 3 lettres")
    .nullable()
    .optional(),
  vatAmount: money(),
  vatRate: number().min(0).max(100).nullable().optional(),
  cardLast4: string()
    .trim()
    .matches(/^\d{4}$/, "carte : 4 chiffres")
    .nullable()
    .optional(),
  paymentAccountId: optionalId(),
  categoryId: optionalId(),
  debitAccountNo: accountNo(),
  creditAccountNo: accountNo(),
  bexioTaxId: number().integer().min(1).nullable().optional(),
  note: optionalText(),
});

export const matchExpenseSchema: ObjectSchema<MatchExpenseDTO> = strictObject({
  transactionId: string().trim().uuid().nullable().defined(),
});

export const ignoreSchema: ObjectSchema<IgnoreDTO> = strictObject({
  reason: optionalText(500),
});

export const revolutSyncSchema: ObjectSchema<RevolutSyncRequestDTO> =
  strictObject({ from: optionalDay(), to: optionalDay() });
