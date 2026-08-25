import { describe, expect, it } from "vitest";
import { defaultRulesConfig } from "../rules/rulesConfig";
import type { BoxModule, CutListItemComPreco } from "../types";
import { attachLabelNumbersToCutlist } from "../qrcode/qrcodeService";
import { resolveIndustrialListNqr, buildIndustrialListPiecesPerSheet } from "../pdf/industrialListQr";
import {
  buildDrillFilesForProject,
  buildDrillXmlFallbackFileName,
  panelFileNameFromPiece,
  pieceHasEtiquetaQr,
} from "./drillExport";

function lateralItem(overrides: Partial<CutListItemComPreco> = {}): CutListItemComPreco {
  return {
    id: "lat-esq",
    nome: "Lateral esquerda",
    tipo: "lateral_esquerda",
    quantidade: 1,
    dimensoes: { largura: 560, altura: 720, profundidade: 19 },
    espessura: 19,
    material: "mdf_branco",
    boxId: "box-1",
    precoUnitario: 0,
    precoTotal: 0,
    ...overrides,
  };
}

describe("drillExport — nomes XML alinhados ao sistema de etiquetas", () => {
  const boxes: BoxModule[] = [
    {
      id: "box-1",
      nome: "CC1",
      dimensoes: { largura: 600, altura: 720, profundidade: 560 },
      espessura: 19,
      tipoBorda: "reta",
      tipoFundo: "integrado",
      models: [],
      prateleiras: 0,
      portaTipo: "sem_porta",
      gavetas: 0,
      alturaGaveta: 0,
      doorsLayer: [],
      drawersLayer: [],
      cutList: [],
      cutListComPreco: [],
      ferragens: [],
      precoTotalPecas: 0,
      estrutura3D: null,
    },
  ];

  const project = {
    projectName: "ANTONIO_NOVO_5",
    boxes,
    rules: defaultRulesConfig,
  };

  it("com etiqueta — filename = buildIndustrialId (No ETQ / etiqueta)", () => {
    const raw = [lateralItem()];
    const items = attachLabelNumbersToCutlist(raw, project);
    const item = items[0]!;
    const piecesPerSheet = new Map<string, number>();

    expect(pieceHasEtiquetaQr(item)).toBe(true);
    expect(item.pieceNumber).toBeGreaterThan(0);
    expect(item.qrSvg).toBeTruthy();

    const filename = panelFileNameFromPiece(item, project, piecesPerSheet, 0);
    const nQr = resolveIndustrialListNqr(item, project, piecesPerSheet, 0);

    expect(filename).toBe(nQr);
    expect(filename).not.toMatch(/-/);
    expect(filename).toBe("an5cle");
  });

  it("com metadata.qrCode — usa exactamente esse valor", () => {
    const item = lateralItem({
      metadata: { qrCode: "C1_LAT_DIR_03" },
      pieceNumber: 3,
    });
    const filename = panelFileNameFromPiece(item, project, new Map(), 0);
    expect(filename).toBe("C1_LAT_DIR_03");
  });

  it("sem etiqueta — nome completo industrial (sem inversão L/R)", () => {
    const item = lateralItem({ pieceNumber: undefined });
    expect(pieceHasEtiquetaQr(item)).toBe(false);
    expect(buildDrillXmlFallbackFileName(item, project)).toBe("antonio_novo_5_cc1_lat_esq");
    expect(panelFileNameFromPiece(item, project, new Map(), 0)).toBe("antonio_novo_5_cc1_lat_esq");
  });

  it("buildDrillFilesForProject — DRILL + PRINCIPAL alinhados ao QR das listas", () => {
    const items = attachLabelNumbersToCutlist([lateralItem()], project);
    const piecesPerSheet = buildIndustrialListPiecesPerSheet(items);
    const files = buildDrillFilesForProject(items, project);
    const nqr = resolveIndustrialListNqr(items[0]!, project, piecesPerSheet, 0);
    expect(files).toHaveLength(2);
    const drill = files.find((f) => f.machineTarget === "drill")!;
    const principal = files.find((f) => f.machineTarget === "completo")!;
    expect(drill.filenameBase).toBe(`${nqr}_DRILL`);
    expect(drill.zipPath).toBe(`drill/XML/${drill.filenameBase}.xml`);
    expect(principal.filenameBase).toBe(nqr);
    expect(principal.zipPath).toBe(`drill/${nqr}.xml`);
  });
});
