import { describe, expect, it } from "vitest";

import type { SavedProjectRecord } from "../../core/projects/types";
import {
  buildProjetosFocusCatalog,
  buildProjetosFocusPath,
  resolveProjetosFocusFromSegments,
  toProjetosBoxSlug,
} from "./projetosFocusSlug";

function makeRecord(projectState: Record<string, unknown>, name = "antones"): SavedProjectRecord {
  return {
    id: "pimo-test",
    name,
    sequence: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ownerId: "guest",
    ownerName: "Test",
    thumbnailDataUrl: null,
    snapshot: { projectState, viewerSnapshot: {} },
  };
}

describe("projetosFocusSlug", () => {
  it("gera slug de caixa a partir do nome display", () => {
    expect(toProjetosBoxSlug("c2")).toBe("c2");
    expect(toProjetosBoxSlug("Caixa 1")).toBe("caixa_1");
  });

  it("constrói paths com nomes industriais limpos", () => {
    const record = makeRecord({
      projectName: "antones",
      workspaceBoxes: [
        {
          id: "box-internal",
          nome: "c2",
          dimensoes: { largura: 600, altura: 720, profundidade: 560 },
          espessura: 19,
          posicaoX_mm: 0,
          posicaoZ_mm: 0,
        },
      ],
      boxes: [
        {
          id: "box-internal",
          nome: "c2",
          cutList: [],
          cutListComPreco: [
            {
              id: "p-top",
              nome: "Cima",
              tipo: "cima",
              boxId: "box-internal",
              quantidade: 1,
              dimensoes: { largura: 600, altura: 19, profundidade: 560 },
              espessura: 19,
              material: "MDF",
              preco: 0,
              precoTotal: 0,
            },
          ],
        },
      ],
      remates: [
        {
          id: "rem-1",
          parentBoxId: "box-internal",
          tipo: "CIMA",
          width: 600,
          height: 19,
          depth: 19,
          materialPresetId: "mdf",
          position: { xMm: 0, yMm: 0, zMm: 0 },
          rotation: { xRad: 0, yRad: 0, zRad: 0 },
          followBox: true,
        },
      ],
      rodapes: [],
    });

    const catalog = buildProjetosFocusCatalog(record);
    expect(catalog).not.toBeNull();

    const boxRow = catalog!.rows.find((r) => r.id === "box-internal" && !r.pieceId);
    expect(boxRow?.boxSlug).toBe("c2");
    expect(buildProjetosFocusPath("antones", boxRow!)).toBe("/PROJETOS/antones/c2");

    const topRow = catalog!.rows.find((r) => r.pieceSlug === "top");
    expect(topRow).toBeDefined();
    expect(buildProjetosFocusPath("antones", topRow!)).toBe("/PROJETOS/antones/c2/top");

    const remateRow = catalog!.rows.find((r) => r.pieceSlug === "remate_cima");
    expect(buildProjetosFocusPath("antones", remateRow!)).toBe("/PROJETOS/antones/c2/remate_cima");
  });

  it("resolve segmentos URL para ids internos (com fallback legacy)", () => {
    const record = makeRecord({
      projectName: "NP262668",
      workspaceBoxes: [
        {
          id: "box-1",
          nome: "Caixa 1",
          dimensoes: { largura: 600, altura: 720, profundidade: 560 },
          espessura: 19,
          posicaoX_mm: 0,
          posicaoZ_mm: 0,
        },
      ],
      boxes: [{ id: "box-1", nome: "Caixa 1", cutList: [], cutListComPreco: [] }],
      remates: [],
      rodapes: [],
    }, "NP262668");

    const fromSlug = resolveProjetosFocusFromSegments(record, "caixa_1", undefined);
    expect(fromSlug.boxId).toBe("box-1");

    const fromLegacy = resolveProjetosFocusFromSegments(record, "box-1", undefined);
    expect(fromLegacy.boxId).toBe("box-1");
  });

  it("TAMPO standalone (sem parentBoxId) entra no catálogo avulso", () => {
    const record = makeRecord({
      projectName: "tampo-avulso",
      workspaceBoxes: [],
      boxes: [],
      remates: [
        {
          id: "tampo-1",
          parentBoxId: undefined,
          tipo: "TAMPO",
          productType: "TAMPO_COZINHA",
          name: "Tampo 1",
          width: 1995,
          height: 630,
          depth: 30,
          materialPresetId: "mdb_laminado-30",
          position: { xMm: 0, yMm: 0, zMm: 0 },
          rotation: { xRad: 0, yRad: 0, zRad: 0 },
          followBox: false,
        },
      ],
      rodapes: [],
    }, "tampo-avulso");

    const catalog = buildProjetosFocusCatalog(record);
    const row = catalog!.rows.find((r) => r.id === "tampo-1");
    expect(row).toBeDefined();
    expect(row!.boxId).toBeUndefined();
    expect(row!.boxSlug).toBe("avulso");
    expect(row!.pieceId).toBe("tampo-1");
  });
});
