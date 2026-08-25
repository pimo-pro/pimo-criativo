import { describe, it, expect } from "vitest";
import { defaultRulesConfig } from "../rules/rulesConfig";
import { buildIndustrialFerragensForProject } from "../industriais/buildIndustrialFerragensForProject";
import { buildFerragensTotaisArmazemData } from "../industrial/industrialBottomSectionData";
import { normalizeFerragensTotaisForPdf } from "./pdfFerragensTotaisNormalize";
import { FERRAGENS_DEFAULT } from "../ferragens/ferragens";
import { cutlistComPrecoFromBox } from "../manufacturing/cutlistFromBoxes";
import type { BoxModule } from "../types";

describe("ferragens_totais sem duplicacao", () => {
  const rules = defaultRulesConfig;
  const box = {
    id: "box1",
    nome: "Caixa1",
    dimensoes: { largura: 600, altura: 720, profundidade: 560 },
    prateleiras: 3,
    gavetas: 0,
    portaTipo: "sem_porta",
    cabinetType: "lower",
    feetEnabled: true,
    materialId: "mdf_branco_19",
  } as BoxModule;

  it("nao duplica suporte/cavilha/parafuso/pe para uma unica caixa", () => {
    const items = cutlistComPrecoFromBox(box, rules, "mdf_branco_19");
    const industrial = buildIndustrialFerragensForProject({
      projectName: "T",
      boxes: [box],
      rules,
      materialId: "mdf_branco_19",
    });
    const rawBy: Record<string, number> = {};
    for (const r of industrial.rows) {
      rawBy[r.ferragem] = (rawBy[r.ferragem] ?? 0) + r.qtd;
    }

    const { ferragens } = buildFerragensTotaisArmazemData(
      { boxes: [box], rules, materialId: "mdf_branco_19", projectName: "T" },
      [],
      FERRAGENS_DEFAULT,
      []
    );
    const norm = normalizeFerragensTotaisForPdf({
      ferragens,
      cutlistItems: items,
      boxes: [box],
      rules,
    });
    const by = Object.fromEntries(norm.map((r) => [r.material, r.quantidade]));

    const shelves = items
      .filter((i) => /prateleira/i.test(i.tipo))
      .reduce((s, i) => s + (i.quantidade || 1), 0);
    const expectedSuportes = shelves * (rules.prateleiras?.suportesPorPrateleira ?? 4);

    expect(by["Suporte de Prateleira"], JSON.stringify({ rawBy, by })).toBe(expectedSuportes);
    // Única fonte: furos CAVILHA_10x40 → nome comercial "Cavilha 10mm" (sem legado 8mm).
    expect(by["Cavilha 10mm"], JSON.stringify({ rawBy, by })).toBe(8);
    expect(by["Cavilha 8mm"]).toBeUndefined();
    expect(rawBy["Cavilha 8mm"]).toBeUndefined();
    expect(rawBy["CAVILHA_10x40"] ?? rawBy["Cavilha 10mm"]).toBe(8);
    expect(by["P\u00e9"], JSON.stringify({ rawBy, by })).toBe(4);

    const parafuso = norm.find((r) => /parafuso\s*4/i.test(r.material));
    expect(parafuso?.quantidade, JSON.stringify(norm)).toBe(8);
  });

  it("caixa duplicada no array nao duplica totais", () => {
    const items = cutlistComPrecoFromBox(box, rules, "mdf_branco_19");
    const { ferragens } = buildFerragensTotaisArmazemData(
      {
        boxes: [box, { ...box }],
        rules,
        materialId: "mdf_branco_19",
        projectName: "T",
      },
      [],
      FERRAGENS_DEFAULT,
      []
    );
    const norm = normalizeFerragensTotaisForPdf({
      ferragens,
      cutlistItems: items,
      boxes: [box],
      rules,
    });
    const by = Object.fromEntries(norm.map((r) => [r.material, r.quantidade]));
    expect(by["Suporte de Prateleira"]).toBe(12);
    expect(by["Cavilha 10mm"]).toBe(8);
  });
});
