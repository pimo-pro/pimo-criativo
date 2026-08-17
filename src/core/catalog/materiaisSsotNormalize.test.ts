import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseMateriaisSsotWorkbook } from "./materiaisSsotReader";
import { resolveSsotChapas, propagateSsotChapaFamilies, groupSsotChapasByFamilia } from "./materiaisSsotNormalize";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const XLSX = path.join(ROOT, "public", "config", "materiais-ssot.xlsx");

describe("materiaisSsotNormalize + apply mapping", () => {
  it("propaga família e resolve IDs industriais existentes", async () => {
    const catalog = await parseMateriaisSsotWorkbook(fs.readFileSync(XLSX));
    const propagated = propagateSsotChapaFamilies(catalog.chapas);
    expect(propagated.some((r) => r.nomeNovoPadronizado === "MDF Branco")).toBe(true);

    const resolved = resolveSsotChapas(catalog);
    const mdf19 = resolved.find((r) => r.industrialCanonicalId === "mdf_branco-19");
    expect(mdf19?.familia).toBe("MDF Branco");
    expect(mdf19?.espessuraMm).toBe(19);

    const withIndustrial = resolved.filter((r) => r.industrialCanonicalId);
    expect(withIndustrial.length).toBeGreaterThanOrEqual(8);

    const grupos = groupSsotChapasByFamilia(resolved);
    const mdfBranco = grupos.find((g) => g.familia === "MDF Branco");
    expect(mdfBranco).toBeTruthy();
    expect(mdfBranco!.espessuras.length).toBeGreaterThanOrEqual(2);
    const aglBranco = grupos.find((g) => g.familia === "AGL LAM BRANCO");
    expect(aglBranco).toBeTruthy();
    expect(aglBranco!.espessuras.map((e) => e.espessuraMm)).toEqual(
      expect.arrayContaining([8, 10, 16, 19])
    );
    expect(resolved.find((r) => r.industrialCanonicalId === "agl_branco-16")?.precoPorM2Eur).toBe(
      6.5
    );
    expect(grupos.every((g) => g.familia && !/\d+\s*mm$/i.test(g.familia))).toBe(true);
  });
});
