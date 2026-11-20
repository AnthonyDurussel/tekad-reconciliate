import { describe, expect, it } from "vitest";
import { ReconciliationModeDTO } from "@repo/models";
import {
  paymentSourceKey,
  previewFiles,
  previewKind,
  reconciliationState,
} from "./bexioExpenseDetail";

const urls = {
  attachment: (id: string, uuid: string) => `/b/${id}/${uuid}`,
  expense: (id: string) => `/e/${id}`,
};

describe("previewKind", () => {
  it("affiche les images, le reste dans un cadre", () => {
    expect(previewKind("image/png")).toBe("image");
    expect(previewKind("IMAGE/JPEG")).toBe("image");
    expect(previewKind("application/pdf")).toBe("frame");
    expect(previewKind(null)).toBe("frame");
    expect(previewKind(undefined)).toBe("frame");
  });
});

describe("previewFiles", () => {
  it("prend les fichiers joints dans bexio d'abord", () => {
    const files = previewFiles(
      {
        id: "b1",
        expenseId: "e1",
        attachments: [
          { uuid: "u1", name: "ticket.pdf", mimeType: "application/pdf" },
          { uuid: "u2", name: null, mimeType: "image/jpeg" },
        ],
      },
      urls,
    );
    expect(files).toEqual([
      { key: "u1", url: "/b/b1/u1", name: "ticket.pdf", kind: "frame" },
      { key: "u2", url: "/b/b1/u2", name: null, kind: "image" },
    ]);
  });

  it("sans fichier joint, montre la pièce liée", () => {
    expect(
      previewFiles({ id: "b1", expenseId: "e1", attachments: [] }, urls, {
        fileName: "scan.png",
        mimeType: "image/png",
      }),
    ).toEqual([
      { key: "expense:e1", url: "/e/e1", name: "scan.png", kind: "image" },
    ]);
    expect(
      previewFiles({ id: "b1", expenseId: "e1", attachments: [] }, urls),
    ).toEqual([{ key: "expense:e1", url: "/e/e1", name: null, kind: "frame" }]);
  });

  it("rien sans fichier ni pièce", () => {
    expect(
      previewFiles({ id: "b1", expenseId: null, attachments: [] }, urls),
    ).toEqual([]);
  });
});

describe("paymentSourceKey", () => {
  it("dit d'où vient le compte payeur", () => {
    expect(
      paymentSourceKey({ paymentAccountId: null, paymentAccountSource: null }),
    ).toBe("UNKNOWN");
    expect(
      paymentSourceKey({
        paymentAccountId: "a1",
        paymentAccountSource: "MANUAL",
      }),
    ).toBe("MANUAL");
    expect(
      paymentSourceKey({
        paymentAccountId: "a1",
        paymentAccountSource: "BANK_ACCOUNT",
      }),
    ).toBe("BANK_ACCOUNT");
    expect(
      paymentSourceKey({ paymentAccountId: "a1", paymentAccountSource: null }),
    ).toBe("ACCOUNT_NO");
  });
});

describe("reconciliationState", () => {
  const base = {
    reconciled: false as boolean | null,
    bexioReconciled: false,
    reconciliation: ReconciliationModeDTO.BEXIO as ReconciliationModeDTO | null,
    expenseId: null as string | null,
  };
  it("non requis sans relevé", () => {
    expect(reconciliationState({ ...base, reconciled: null })).toBe(
      "notRequired",
    );
  });
  it("rapprochée dans bexio ou par le relevé", () => {
    expect(
      reconciliationState({ ...base, reconciled: true, bexioReconciled: true }),
    ).toBe("inBexio");
    expect(reconciliationState({ ...base, reconciled: true })).toBe(
      "byStatement",
    );
  });
  it("à rapprocher : dans bexio, par le relevé, ou pièce à lier d'abord", () => {
    expect(reconciliationState(base)).toBe("toReconcileInBexio");
    expect(
      reconciliationState({
        ...base,
        reconciliation: ReconciliationModeDTO.STATEMENT_IMPORT,
      }),
    ).toBe("linkReceiptFirst");
    expect(
      reconciliationState({
        ...base,
        reconciliation: ReconciliationModeDTO.STATEMENT_IMPORT,
        expenseId: "e1",
      }),
    ).toBe("toReconcileByStatement");
  });
});

describe("reconciliationState — compte inconnu", () => {
  it("demande d'associer le compte avant tout", () => {
    expect(
      reconciliationState({
        reconciled: null,
        bexioReconciled: false,
        reconciliation: null,
        expenseId: null,
        paymentAccountId: null,
      }),
    ).toBe("unknownAccount");
  });
});
