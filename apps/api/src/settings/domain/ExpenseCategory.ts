import type {
  CreateExpenseCategoryDTO,
  UpdateExpenseCategoryDTO,
} from "@repo/models";

export interface ExpenseCategoryProps {
  id: string;
  code: string;
  label: string;
  bexioAccountNo: string;
  bexioTaxId: number | null;
  vatRate: number | null;
  keywords: string[];
  mccCodes: string[];
  position: number;
  active: boolean;
}

const clean = (values: string[] | undefined) => [
  ...new Set((values ?? []).map((v) => v.trim()).filter(Boolean)),
];

export function createExpenseCategory(
  id: string,
  input: CreateExpenseCategoryDTO,
): ExpenseCategoryProps {
  return {
    id,
    code: input.code.trim(),
    label: input.label.trim(),
    bexioAccountNo: input.bexioAccountNo,
    bexioTaxId: input.bexioTaxId ?? null,
    vatRate: input.vatRate ?? null,
    keywords: clean(input.keywords),
    mccCodes: clean(input.mccCodes),
    position: input.position ?? 0,
    active: input.active ?? true,
  };
}

export function patchExpenseCategory(
  current: ExpenseCategoryProps,
  input: UpdateExpenseCategoryDTO,
): ExpenseCategoryProps {
  return {
    ...current,
    code: input.code?.trim() ?? current.code,
    label: input.label?.trim() ?? current.label,
    bexioAccountNo: input.bexioAccountNo ?? current.bexioAccountNo,
    bexioTaxId:
      input.bexioTaxId !== undefined ? input.bexioTaxId : current.bexioTaxId,
    vatRate: input.vatRate !== undefined ? input.vatRate : current.vatRate,
    keywords: input.keywords ? clean(input.keywords) : current.keywords,
    mccCodes: input.mccCodes ? clean(input.mccCodes) : current.mccCodes,
    position: input.position ?? current.position,
    active: input.active ?? current.active,
  };
}
