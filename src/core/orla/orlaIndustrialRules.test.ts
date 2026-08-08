import { describe, it, expect } from "vitest";
import {
  buildPieceOrlaConfigForTipo,
  formatOrlaRefForPdf,
  isCostaPieceTipo,
  MIN_ORLA_PANEL_THICKNESS_MM,
  pieceAllowsOrlaByThickness,
  resolveOrlaSidesForPieceTipo,
  stripMaterialThicknessLabel,
} from "./orlaIndustrialRules";

describe("orlaIndustrialRules", () => {
  it("costa do módulo nunca recebe orla; gav_costa recebe só topo", () => {
    expect(isCostaPieceTipo("costa")).toBe(true);
    expect(isCostaPieceTipo("COSTA")).toBe(true);
    expect(resolveOrlaSidesForPieceTipo("costa")).toEqual([]);
    expect(isCostaPieceTipo("gav_costa")).toBe(false);
    expect(isCostaPieceTipo("gaveta_traseira")).toBe(false);
    expect(resolveOrlaSidesForPieceTipo("gav_costa")).toEqual(["front"]);
    expect(resolveOrlaSidesForPieceTipo("gaveta_traseira")).toEqual(["front"]);
  });

  it("regras oficiais: todas as bordas / frente-trás / só topo", () => {
    expect(resolveOrlaSidesForPieceTipo("cima")).toEqual(["front", "back", "left", "right"]);
    expect(resolveOrlaSidesForPieceTipo("fundo")).toEqual(["front", "back", "left", "right"]);
    expect(resolveOrlaSidesForPieceTipo("prateleira")).toEqual(["front", "back", "left", "right"]);
    expect(resolveOrlaSidesForPieceTipo("gaveta_frente")).toEqual(["front", "back", "left", "right"]);
    expect(resolveOrlaSidesForPieceTipo("remate")).toEqual(["front", "back", "left", "right"]);
    expect(resolveOrlaSidesForPieceTipo("rodape")).toEqual(["front", "back", "left", "right"]);

    expect(resolveOrlaSidesForPieceTipo("lateral_esquerda")).toEqual(["front", "back"]);
    expect(resolveOrlaSidesForPieceTipo("lateral_direita")).toEqual(["front", "back"]);
    expect(resolveOrlaSidesForPieceTipo("separador")).toEqual(["front", "back"]);
    expect(resolveOrlaSidesForPieceTipo("div")).toEqual(["front", "back"]);
    expect(resolveOrlaSidesForPieceTipo("divisorio")).toEqual(["front", "back"]);

    expect(resolveOrlaSidesForPieceTipo("gav_frent_int")).toEqual(["front"]);
    expect(resolveOrlaSidesForPieceTipo("gav_lat_dir")).toEqual(["front"]);
    expect(resolveOrlaSidesForPieceTipo("gav_lat_esq")).toEqual(["front"]);
    expect(resolveOrlaSidesForPieceTipo("gaveta_fundo")).toEqual([]);
  });

  it("cx_gav: laterais só topo, cima 4 lados, fun sem orla", () => {
    expect(resolveOrlaSidesForPieceTipo("cx_gav_lat_dir")).toEqual(["front"]);
    expect(resolveOrlaSidesForPieceTipo("cx_gav_lat_esq")).toEqual(["front"]);
    expect(resolveOrlaSidesForPieceTipo("cx_gav_cima")).toEqual([
      "front",
      "back",
      "left",
      "right",
    ]);
    expect(resolveOrlaSidesForPieceTipo("cx_gav_fun")).toEqual([]);
  });

  it("a_1: laterais só topo, cima 4 lados, fundo sem orla, comp front/back", () => {
    expect(resolveOrlaSidesForPieceTipo("a1_cx_lat_dir")).toEqual(["front"]);
    expect(resolveOrlaSidesForPieceTipo("a1_cx_lat_esq")).toEqual(["front"]);
    expect(resolveOrlaSidesForPieceTipo("a1_cx_cima")).toEqual([
      "front",
      "back",
      "left",
      "right",
    ]);
    expect(resolveOrlaSidesForPieceTipo("a1_cx_fundo")).toEqual([]);
    expect(resolveOrlaSidesForPieceTipo("a1_cx_comp_40")).toEqual(["front", "back"]);
  });

  it("porta simples: 4 lados", () => {
    expect(resolveOrlaSidesForPieceTipo("porta_simples")).toEqual([
      "front",
      "back",
      "left",
      "right",
    ]);
  });

  it("porta dupla: sem aresta de encontro (ESQ sem right, DIR sem left)", () => {
    expect(resolveOrlaSidesForPieceTipo("porta_dupla", { hingeSide: "left" })).toEqual([
      "front",
      "back",
      "left",
    ]);
    expect(resolveOrlaSidesForPieceTipo("porta_dupla", { hingeSide: "right" })).toEqual([
      "front",
      "back",
      "right",
    ]);
    expect(resolveOrlaSidesForPieceTipo("porta_dupla", { doorsLayerIndex: 0 })).toEqual([
      "front",
      "back",
      "left",
    ]);
    expect(resolveOrlaSidesForPieceTipo("porta", { nome: "PORT_ESQ" })).toEqual([
      "front",
      "back",
      "left",
    ]);
    expect(resolveOrlaSidesForPieceTipo("porta", { nome: "PORT_DIR" })).toEqual([
      "front",
      "back",
      "right",
    ]);
  });

  it("espessura < 16 mm nao permite orla; costa sempre bloqueada", () => {
    expect(MIN_ORLA_PANEL_THICKNESS_MM).toBe(16);
    expect(pieceAllowsOrlaByThickness(10)).toBe(false);
    expect(pieceAllowsOrlaByThickness(16)).toBe(true);
    expect(buildPieceOrlaConfigForTipo("porta_simples", "p1", undefined, 10)).toBeNull();
    expect(buildPieceOrlaConfigForTipo("costa", "p1", undefined, 19)).toBeNull();
    expect(buildPieceOrlaConfigForTipo("prateleira", "p1", undefined, 19)?.sides.front.enabled).toBe(
      true
    );
  });

  it("buildPieceOrlaConfigForTipo e helpers PDF", () => {
    expect(buildPieceOrlaConfigForTipo("costa", "p1")).toBeNull();
    const cfg = buildPieceOrlaConfigForTipo("porta_simples", "branco_pvc_08_23mm", undefined, 19);
    expect(cfg?.sides.front.enabled).toBe(true);
    expect(stripMaterialThicknessLabel("MDF Branco 19mm")).toBe("MDF Branco");
    expect(stripMaterialThicknessLabel("MDF Branco 19")).toBe("MDF Branco");
    expect(formatOrlaRefForPdf("Branco PVC", 0.8, 23)).toBe("Branco PVC 0.8mm");
    expect(formatOrlaRefForPdf("Branco PVC 0.8\u00d723 mm", 0.8, 23)).toBe("Branco PVC 0.8mm");
  });
});
