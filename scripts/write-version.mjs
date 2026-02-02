#!/usr/bin/env node
/**
 * Escreve public/version.json com a versão atual.
 * Executado antes do build (ex.: em scripts/deploy.sh).
 *
 * Uso: node scripts/write-version.mjs [version]
 * Se version não for passado, gera vYYYY.MM.DD-HHMM
 */

import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function pad2(n) {
  return String(n).padStart(2, "0");
}

function generateVersionLabel() {
  const d = new Date();
  return `v${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}`;
}

const version = process.argv[2] || generateVersionLabel();
const payload = {
  version,
  buildTime: new Date().toISOString(),
};
const outPath = join(root, "public", "version.json");
writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
console.log(`version.json escrito: ${version}`);
