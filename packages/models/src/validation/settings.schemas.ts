import { array, boolean, mixed, number, string, type ObjectSchema } from "yup";
import {
  BookingModeDTO,
  PaymentAccountKindDTO,
  type CreateExpenseCategoryDTO,
  type CreatePaymentAccountDTO,
  type PaymentCardDTO,
  type UpdateExpenseCategoryDTO,
  type UpdatePaymentAccountDTO,
} from "../@types/dto/settings.dto.js";
import { requiredLabel, strictObject } from "./common.schemas.js";

const accountNo = () =>
  string()
    .trim()
    .matches(/^\d{3,6}$/, "compte bexio : 3 à 6 chiffres");

/** Le numéro, s'il est donné, doit finir par les 4 chiffres annoncés. */
const cardSchema: ObjectSchema<PaymentCardDTO> = strictObject({
  id: string().trim().uuid().optional(),
  number: string()
    .trim()
    .max(40)
    .matches(/^[\d\s*xX•.-]*\d{4}$/, "numéro de carte : il doit finir par 4 chiffres")
    .optional(),
  last4: string()
    .trim()
    .matches(/^\d{4}$/, "carte : 4 chiffres")
    .required(),
  maskedNumber: string().trim().max(40).nullable().optional(),
  label: string().trim().max(255).nullable().optional(),
  holder: string().trim().max(255).nullable().optional(),
  active: boolean().optional(),
}).test("number-last4", "le numéro ne finit pas par ces 4 chiffres", (card) =>
  !card?.number || card.number.replace(/\D/g, "").endsWith(card.last4 ?? ""),
) as ObjectSchema<PaymentCardDTO>;

const accountShape = {
  kind: mixed<PaymentAccountKindDTO>().oneOf(Object.values(PaymentAccountKindDTO)),
  name: requiredLabel(),
  bexioAccountNo: accountNo().nullable().optional(),
  bookingMode: mixed<BookingModeDTO>()
    .oneOf(Object.values(BookingModeDTO))
    .optional(),
  revolutAccountId: string().trim().max(64).nullable().optional(),
  position: number().integer().min(0).optional(),
  active: boolean().optional(),
  cards: array(cardSchema)
    .max(50)
    .optional()
    .test("unique-cards", "une carte apparaît deux fois", (cards) => {
      if (!cards) return true;
      return new Set(cards.map((c) => c.last4)).size === cards.length;
    }),
};

export const createPaymentAccountSchema: ObjectSchema<CreatePaymentAccountDTO> =
  strictObject({ ...accountShape, kind: accountShape.kind.required() });

export const updatePaymentAccountSchema: ObjectSchema<UpdatePaymentAccountDTO> =
  strictObject({
    ...accountShape,
    kind: accountShape.kind.optional(),
    name: requiredLabel().optional(),
  });

const keywordList = () =>
  array(string().trim().min(2).max(60).required()).max(100).optional();

const categoryShape = {
  bexioAccountId: number().integer().min(1).nullable().optional(),
  code: string()
    .trim()
    .min(1)
    .max(20)
    .matches(/^\S(.*\S)?$/, "code : sans espace au début ni à la fin"),
  label: requiredLabel(),
  bexioAccountNo: accountNo(),
  bexioTaxId: number().integer().min(1).nullable().optional(),
  vatRate: number().min(0).max(100).nullable().optional(),
  keywords: keywordList(),
  mccCodes: array(
    string()
      .trim()
      .matches(/^\d{4}$/, "MCC : 4 chiffres")
      .required(),
  )
    .max(100)
    .optional(),
  position: number().integer().min(0).optional(),
  active: boolean().optional(),
};

export const createExpenseCategorySchema: ObjectSchema<CreateExpenseCategoryDTO> =
  strictObject({
    ...categoryShape,
    code: categoryShape.code.required(),
    bexioAccountNo: categoryShape.bexioAccountNo.required(),
  });

export const updateExpenseCategorySchema: ObjectSchema<UpdateExpenseCategoryDTO> =
  strictObject({
    ...categoryShape,
    code: categoryShape.code.optional(),
    label: requiredLabel().optional(),
    bexioAccountNo: categoryShape.bexioAccountNo.optional(),
  });
