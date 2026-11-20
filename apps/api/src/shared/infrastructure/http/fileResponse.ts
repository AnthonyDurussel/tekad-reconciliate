import type { HttpResponseInit } from "@azure/functions";
import type { StoredFile } from "@/shared/application/ports/StoredFile.js";

/** Un fichier servi en ligne (aperçu), jamais interprété par le navigateur. */
export function fileResponse(file: StoredFile): HttpResponseInit {
  const name = file.fileName.replace(/["\r\n]/g, "");
  return {
    status: 200,
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `inline; filename="${name}"`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
    body: new Uint8Array(file.data),
  };
}
