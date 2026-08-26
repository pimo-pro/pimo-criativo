import { describe, expect, it, afterEach } from "vitest";
import type { CutlistItemForPieces } from "../cutlayout/cutLayoutEngine";
import {
  clearChapasOficiaisPro,
  getChapasOficiaisProValid,
} from "./chapasOficiaisProStore";
import { publishChapasOficiaisFromProBundles } from "./chapasOficiaisPublish";
import { buildChapasOficiaisFingerprint } from "./cutlistFingerprint";
import { computeChapasReal } from "./computeChapasReal";

function item(): CutlistItemForPieces {
  return {
    nome: "Lateral",
    tipo: "lateral_esquerda",
    quantidade: 1,
    espessura: 19,
    dimensoes: { largura: 600, altura: 400, profundidade: 19 },
    boxId: "box-1",
    material: "MDF Branco",
    materialId: "mdf_branco-19",
  };
}

describe("publishChapasOficiaisFromProBundles", () => {
  afterEach(() => {
    clearChapasOficiaisPro();
  });

  it("isProMode false → no-op", () => {
    const items = [item()];
    const ok = publishChapasOficiaisFromProBundles({
      projectId: "Proj Publish",
      projectName: "Proj Publish",
      items,
      boxes: [{ id: "box-1" }],
      isProMode: false,
      bundles: [
        {
          thicknessMm: 19,
          materialLabel: "MDF Branco",
          items,
          layoutResult: {
            sheets: [
              {
                sheet: { largura_mm: 2800, altura_mm: 2070, espessura_mm: 19 },
                placements: [
                  {
                    x_mm: 0,
                    y_mm: 0,
                    largura_mm: 600,
                    altura_mm: 400,
                    rotacao: 0,
                    sheetIndex: 0,
                    boxId: "box-1",
                    partName: "lateral_esquerda",
                  },
                ],
              },
            ],
          },
        },
      ],
    });
    expect(ok).toBe(false);
    expect(
      getChapasOficiaisProValid(
        "Proj Publish",
        buildChapasOficiaisFingerprint(items)
      )
    ).toBeNull();
  });

  it("isProMode true → computeChapasReal fica oficial_pro", () => {
    const items = [item()];
    const projectName = "Proj Publish Pro";
    expect(
      publishChapasOficiaisFromProBundles({
        projectId: projectName,
        projectName,
        items,
        boxes: [{ id: "box-1", nome: "C1" }],
        isProMode: true,
        bundles: [
          {
            thicknessMm: 19,
            materialLabel: "MDF Branco",
            items,
            layoutResult: {
              sheets: [
                {
                  sheet: { largura_mm: 2800, altura_mm: 2070, espessura_mm: 19 },
                  placements: [
                    {
                      x_mm: 0,
                      y_mm: 0,
                      largura_mm: 600,
                      altura_mm: 400,
                      rotacao: 0,
                      sheetIndex: 0,
                      boxId: "box-1",
                      partName: "lateral_esquerda",
                    },
                  ],
                },
              ],
            },
          },
        ],
      })
    ).toBe(true);

    const result = computeChapasReal(items as never, projectName, [{ id: "box-1" }], {
      projectId: projectName,
    });
    expect(result.mode).toBe("oficial_pro");
    expect(result.totalSheets).toBe(1);
  });
});
