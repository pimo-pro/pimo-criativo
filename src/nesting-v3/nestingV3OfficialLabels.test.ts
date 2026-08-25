import { describe, expect, it, vi } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { defaultRulesConfig } from "../core/rules/rulesConfig";
import type { BoxModule, CutListItemComPreco } from "../core/types";
import type { ProjectState } from "../context/projectTypes";
import type { NestingV3State, V3Piece } from "./nestingV3Types";
import { DEFAULT_NESTING_V3_SETTINGS } from "./nestingV3Settings";
import {
  buildNestingV3EtiquetaPayload,
  buildNestingV3OfficialLabelsPdf,
  matchV3PieceToCutlistItem,
} from "./nestingV3OfficialLabels";
import { buildIndustrialId, buildFullIndustrialName } from "../core/naming/industrialNaming";
import { resolveEtiquetaDisplayCodeV5 } from "../core/etiquetas/qr/etiquetaQr";

vi.mock("../core/industrial/IndustrialCenter", () => ({
  getUeeItems: (project: { __testItems?: CutListItemComPreco[] }) =>
    project.__testItems ?? [],
}));

vi.stubGlobal(
  "fetch",
  vi.fn(async () => ({ ok: false }) as Response)
);

function makeItem(overrides: Partial<CutListItemComPreco> & { tipo: string }): CutListItemComPreco {
  return {
    id: overrides.id ?? overrides.tipo,
    nome: overrides.nome ?? overrides.tipo,
    tipo: overrides.tipo,
    quantidade: overrides.quantidade ?? 1,
    dimensoes: overrides.dimensoes ?? {
      largura: 500,
      altura: 700,
      profundidade: 18,
    },
    espessura: overrides.espessura ?? 18,
    material: overrides.material ?? "mdf_branco",
    materialId: overrides.materialId ?? "mdf_branco",
    boxId: overrides.boxId ?? "box-1",
    precoUnitario: 0,
    precoTotal: 0,
    metadata: overrides.metadata,
  };
}

describe("nestingV3OfficialLabels — UEE", () => {
  it("matchV3PieceToCutlistItem usa sourceBoxId + tipo (não só name)", () => {
    const pool = [
      makeItem({ tipo: "lateral_esquerda", nome: "Lateral esquerda", boxId: "box-1" }),
      makeItem({ tipo: "lateral_direita", nome: "Lateral direita", boxId: "box-1" }),
    ];
    const piece: V3Piece = {
      id: "v3-1",
      name: "C1_lat_esq",
      widthMm: 500,
      heightMm: 700,
      thicknessMm: 18,
      originalHoles: [],
      rotation: 0,
      color: "#fff",
      sourceBoxId: "box-1",
      pieceTipo: "lateral_esquerda",
    };
    const idx = matchV3PieceToCutlistItem(piece, pool);
    expect(idx).toBe(0);
    expect(pool[idx!]!.tipo).toBe("lateral_esquerda");
  });

  it("payload UEE: nome completo + N QR = buildIndustrialId", async () => {
    const items = [
      makeItem({
        tipo: "lateral_esquerda",
        nome: "Lateral esquerda",
        boxId: "box-1",
        dimensoes: { largura: 500, altura: 700, profundidade: 18 },
      }),
    ];
    const boxes: BoxModule[] = [
      {
        id: "box-1",
        nome: "C 1",
        dimensoes: { largura: 600, altura: 720, profundidade: 500 },
        espessura: 18,
        portaTipo: "sem_porta",
        gavetas: 0,
        prateleiras: 0,
        tipoBorda: "reta",
        cutList: [],
        cutListComPreco: [],
        models: [],
        alturaGaveta: 0,
        doorsLayer: [],
        drawersLayer: [],
        ferragens: [],
        precoTotalPecas: 0,
        estrutura3D: null,
      } as BoxModule,
    ];

    const piece: V3Piece = {
      id: "v3-lat",
      name: "C1_lat_esq",
      widthMm: 500,
      heightMm: 700,
      thicknessMm: 18,
      originalHoles: [],
      rotation: 0,
      color: "#abc",
      sourceBoxId: "box-1",
      pieceTipo: "lateral_esquerda",
    };

    const state: NestingV3State = {
      pieces: [piece],
      sheets: [
        {
          index: 0,
          widthMm: 2800,
          heightMm: 2070,
          thicknessMm: 18,
          materialName: "MDF",
        },
      ],
      placements: [{ pieceId: "v3-lat", sheetIndex: 0, xMm: 10, yMm: 20 }],
      unplacedPieceIds: [],
      activeSheetIndex: 0,
      settings: DEFAULT_NESTING_V3_SETTINGS,
    };

    const project = {
      projectName: "Khaled Cozinha Nova",
      boxes,
      rules: defaultRulesConfig,
      __testItems: items,
    } as unknown as ProjectState & { __testItems: CutListItemComPreco[] };

    const payload = buildNestingV3EtiquetaPayload({
      state,
      project,
      projectName: "Khaled Cozinha Nova",
    });

    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]!.tipo).toBe("lateral_esquerda");

    const expectedFull = buildFullIndustrialName(
      "Khaled Cozinha Nova",
      "C 1",
      "lateral_esquerda"
    );
    expect(expectedFull).toBe("khaled_cozinha_nova_c_1_lat_esq");
    expect(buildIndustrialId(expectedFull)).toBe("kcnc1le");

    const code = resolveEtiquetaDisplayCodeV5(
      payload.items[0]!,
      { projectName: "Khaled Cozinha Nova", boxes, rules: defaultRulesConfig },
      new Map(),
      0
    );
    expect(code).toBe("kcnc1le");
    expect(code).not.toMatch(/-/);

    const doc = await buildNestingV3OfficialLabelsPdf({
      state,
      project,
      projectName: "Khaled Cozinha Nova",
    });
    expect(doc.getNumberOfPages()).toBeGreaterThan(0);

    const outDir = join(process.cwd(), "test-output");
    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, "passo-3.5-nesting-v3-etiquetas-oficial.pdf");
    writeFileSync(outPath, Buffer.from(doc.output("arraybuffer")));
    expect(outPath).toContain("passo-3.5-nesting-v3-etiquetas-oficial.pdf");
  });
});
