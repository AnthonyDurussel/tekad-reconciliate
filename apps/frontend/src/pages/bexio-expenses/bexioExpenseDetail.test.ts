import { describe, expect, it } from "vitest";
import { previewFiles, previewKind } from "./bexioExpenseDetail";

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

  it("sans fichier joint, montre la pièce de la dépense rattachée", () => {
    expect(
      previewFiles({ id: "b1", expenseId: "e1", attachments: [] }, urls, {
        receiptId: "r1",
        fileName: "scan.png",
        mimeType: "image/png",
      }),
    ).toEqual([
      { key: "expense:e1", url: "/e/e1", name: "scan.png", kind: "image" },
    ]);
  });

  it("rien quand la dépense rattachée n'a pas de pièce (ou pas encore chargée)", () => {
    expect(
      previewFiles({ id: "b1", expenseId: "e1", attachments: [] }, urls, {
        receiptId: null,
        fileName: null,
        mimeType: null,
      }),
    ).toEqual([]);
    expect(
      previewFiles({ id: "b1", expenseId: "e1", attachments: [] }, urls),
    ).toEqual([]);
  });

  it("rien sans fichier ni pièce", () => {
    expect(
      previewFiles({ id: "b1", expenseId: null, attachments: [] }, urls),
    ).toEqual([]);
  });
});
