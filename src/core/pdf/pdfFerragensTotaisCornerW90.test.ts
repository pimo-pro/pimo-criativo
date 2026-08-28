import { describe, expect, it } from "vitest";
import { defaultRulesConfig } from "../rules/rulesConfig";
import { CORNER_DIREITA_INFERIOR_V2_ID } from "../cornerCabinet/cornerCabinetRules";
import { cutlistComPrecoFromBox } from "../manufacturing/cutlistFromBoxes";
import { buildFerragensTotaisNormalized } from "../ferragens/ferragensTotaisSsot";
import { COMPONENT_TYPES_DEFAULT } from "../components/componentTypes";
import { FERRAGENS_DEFAULT } from "../ferragens/ferragens";
import { DOBRADICA_W90_NOME } from "../ferragens/ferragensCountRules";
import type { BoxModule, PanelDrillHole } from "../types";

function hingeCups(n: number): PanelDrillHole[] {
  const holes: PanelDrillHole[] = [];
  for (let i = 0; i < n; i++) {
    holes.push({
      x: 20,
      y: 100 + i * 200,
      diameter: 35,
      depth: 13,
      holeType: "dobradica",
    });
  }
  return holes;
}

describe("Canto — Direita (Inferior) — Dobradiça W90", () => {
  const rules = defaultRulesConfig;

  const cornerBox = {
    id: "canto-di",
    nome: "Canto — Direita (Inferior)",
    baseCabinetId: CORNER_DIREITA_INFERIOR_V2_ID,
    portaTipo: "porta_simples",
    dimensoes: { largura: 900, altura: 720, profundidade: 600 },
    prateleiras: 2,
    gavetas: 0,
    cabinetType: "lower",
    feetEnabled: true,
    materialId: "mdf_branco_19",
    doorsLayer: [
      {
        id: "door-1",
        parentBoxId: "canto-di",
        width: 447,
        height: 718,
        thickness: 19,
        openDirection: "left",
        isOpen: false,
        hingeSide: "left",
        pivot: "left-edge",
        posX: 0,
        posY: 0,
        posZ: 0,
        rotY: 0,
      },
    ],
    drawersLayer: [],
  } as BoxModule;

  it("porta canto usa Dobradiça W90, não I-Sensys 8645i", () => {
    const items = cutlistComPrecoFromBox(cornerBox, rules, "mdf_branco_19");
    const doorItems = items.filter((i) => String(i.tipo ?? "").includes("porta"));
    expect(doorItems.length).toBeGreaterThan(0);
    for (const door of doorItems) {
      door.drillHoles = [...(door.drillHoles ?? []), ...hingeCups(2)];
    }

    const norm = buildFerragensTotaisNormalized(
      {
        boxes: [cornerBox],
        rules,
        materialId: "mdf_branco_19",
        projectName: "CantoTest",
      },
      COMPONENT_TYPES_DEFAULT,
      FERRAGENS_DEFAULT
    );

    const w90 = norm.ferragens.find((r) => r.material === DOBRADICA_W90_NOME);
    expect(w90?.quantidade, JSON.stringify(norm.ferragens)).toBeGreaterThan(0);

    const standard = norm.ferragens.find(
      (r) => r.material === "Dobradi\u00e7a" && r.ref === "I-Sensys 8645i"
    );
    expect(standard).toBeUndefined();

    const calco03 = norm.ferragens.find((r) => r.material === "Cal\u00e7o" && r.ref === "03");
    expect(calco03?.quantidade).toBe(1);
  });
});
