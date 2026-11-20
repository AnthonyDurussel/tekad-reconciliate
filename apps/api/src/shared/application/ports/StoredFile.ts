/** Un fichier lu d'un service externe (pièce de l'inbox bexio). */
export interface StoredFile {
  fileName: string;
  mimeType: string;
  data: Buffer;
}
