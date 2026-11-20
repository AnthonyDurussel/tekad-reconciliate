import ExcelJS from "exceljs";
import type { HttpResponseInit } from "@azure/functions";

/** Une colonne d'une feuille : en-tête, clé, largeur, format numérique. */
export interface SheetColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
  width?: number;
  numFmt?: string;
}

export const FMT_CHF = "#,##0.00";
export const FMT_INT = "#,##0";

/** Ajoute une feuille : en-tête en gras sur fond bleu Tekad, figé, filtrable. */
export function addSheet<T>(
  workbook: ExcelJS.Workbook,
  name: string,
  columns: SheetColumn<T>[],
  rows: T[],
): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = columns.map((c, i) => ({
    header: c.header,
    key: `c${i}`,
    width: c.width ?? Math.max(12, c.header.length + 2),
    style: c.numFmt ? { numFmt: c.numFmt } : {},
  }));
  for (const row of rows) {
    sheet.addRow(columns.map((c) => c.value(row) ?? null));
  }
  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFDCE7F3" },
  };
  if (rows.length) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: columns.length },
    };
  }
  return sheet;
}

export function newWorkbook(): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Tekad";
  workbook.created = new Date();
  return workbook;
}

export async function xlsxResponse(
  workbook: ExcelJS.Workbook,
  fileName: string,
): Promise<HttpResponseInit> {
  const buffer = await workbook.xlsx.writeBuffer();
  return {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
    body: new Uint8Array(buffer as ArrayBuffer),
  };
}
