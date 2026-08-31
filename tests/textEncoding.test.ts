/**
 * Guard de codificação UTF-8 no código-fonte.
 *
 * Complementa o guard de labels em `financeiroP323Ui.test.ts`, que cobre apenas
 * os textos do relatório financeiro.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const SRC_ROOT = join(process.cwd(), "src");

/**
 * Sequências impossíveis em português correcto:
 * - `Ã`, `Â` ou `ï` seguidos de byte de continuação UTF-8 (UTF-8 lido como Latin-1)
 * - U+FFFD literal (carácter de substituição)
 *
 * `â` isolado é legítimo (câmara, âmbito) e por isso não é sinalizado.
 */
const MOJIBAKE = /[ÃÂï][\u0080-\u00BF]|\uFFFD/;

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return listSourceFiles(path);
    if (!/\.(ts|tsx)$/.test(entry)) return [];
    return [path];
  });
}

function posixRelative(file: string): string {
  return relative(process.cwd(), file).split(sep).join("/");
}

describe("codificação de texto no código-fonte", () => {
  it(
    "nenhum ficheiro em src/ contém sequências de mojibake",
    () => {
      const offenders = listSourceFiles(SRC_ROOT)
        .filter((file) => !file.includes(".test."))
        .filter((file) => MOJIBAKE.test(readFileSync(file, "utf8")))
        .map((file) => posixRelative(file));

      expect(offenders).toEqual([]);
    },
    60_000
  );
});
