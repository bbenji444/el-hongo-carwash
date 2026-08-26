import fs from "node:fs";
import path from "node:path";

let cache: Buffer | null = null;

// Lee el logo una sola vez desde /public para incrustarlo en los PDFs
// generados con @react-pdf/renderer (solo se usa en rutas server, nunca en
// el cliente).
export function logoBuffer(): Buffer {
  if (!cache) {
    cache = fs.readFileSync(path.join(process.cwd(), "public", "logo.jpg"));
  }
  return cache;
}
