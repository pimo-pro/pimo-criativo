import { describe, expect, it } from "vitest";
import { defaultRulesConfig } from "../rules/rulesConfig";
import { buildFerragensTotaisPdfData } from "./industrialBottomSectionData";
import { buildFerragensTotaisNormalized } from "../ferragens/ferragensTotaisSsot";
import { COMPONENT_TYPES_DEFAULT } from "../components/componentTypes";
import { FERRAGENS_DEFAULT } from "../ferragens/ferragens";
import { CAVILHA_10x40_FERRAGEM_NOME } from "../drill/cavilha10x40Rule";
import type { BoxModule } from "../types";

describe("Ferragens Totais UI parity com SSOT normalize", () => {
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
    drawersLayer: [],
  } as BoxModule;

  const project = {
    boxes: [box],
    rules,
    materialId: "mdf_branco_19",
    projectName: "Parity",
  };

  it("porTipo usa só nomes comerciais, sem IDs técnicos duplicados", () => {
    const { porTipo, totalQty } = buildFerragensTotaisPdfData(
      project,
      COMPONENT_TYPES_DEFAULT,
      FERRAGENS_DEFAULT
    );
    const labels = porTipo.map(([name]) => name);
    expect(labels.some((l) => l === "cavilha_10x40" || l === "cavilha_10mm")).toBe(false);
    expect(labels.some((l) => l === "prego_costa" || l === "Prego para Costa")).toBe(false);
    expect(labels.some((l) => l.includes(CAVILHA_10x40_FERRAGEM_NOME))).toBe(true);

    const norm = buildFerragensTotaisNormalized(
      project,
      COMPONENT_TYPES_DEFAULT,
      FERRAGENS_DEFAULT
    );
    expect(totalQty).toBe(norm.totalQty);
  });
});
