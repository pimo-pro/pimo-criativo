import { describe, expect, it } from "vitest";
import {
  MDB_LAMINADO_CANONICAL_ID,
  MDB_LAMINADO_MAX_PIECE_WIDTH_MM,
  MDB_LAMINADO_SHEET_HF_MM,
  MDB_LAMINADO_SHEET_LF_MM,
  resolveMaterial,
  validateMaterialPieceWidthMm,
  usesOfficialMdbLaminadoSheet,
} from "./materials.api";
import { INITIAL_MATERIAL_PRESETS } from "./presets";
import { MATERIAIS_PBR_OPCOES } from "../manufacturing/materials";

describe("MDB Laminado 30 mm — registo industrial", () => {
  it("resolve canonicalId com chapa 3660×630, esp. 30 e custo 30 €/m²", () => {
    const mat = resolveMaterial(MDB_LAMINADO_CANONICAL_ID);
    expect(mat).not.toBeNull();
    expect(mat!.canonicalId).toBe("mdb_laminado-30");
    expect(mat!.label).toBe("MDB Laminado 30");
    expect(mat!.industrial).toBe(true);
    expect(mat!.viewerMaterialId).toBe("mdb_laminado");
    expect(mat!.industrialDefaults).toEqual({
      espessuraPadrao: 30,
      custo_m2: 30,
      larguraChapa: MDB_LAMINADO_SHEET_LF_MM,
      alturaChapa: MDB_LAMINADO_SHEET_HF_MM,
      densidade: 750,
    });
    expect(mat!.industrialDefaults!.larguraChapa).toBe(3660);
    expect(mat!.industrialDefaults!.alturaChapa).toBe(630);
  });

  it("productMeta tampo_cozinha + laminadoFabrica + max 630", () => {
    const mat = resolveMaterial("MDB Laminado 30 mm");
    expect(mat!.productMeta).toEqual({
      productType: "tampo_cozinha",
      laminadoFabrica: true,
      maxPieceWidthMm: MDB_LAMINADO_MAX_PIECE_WIDTH_MM,
    });
  });

  it("valida largura máxima 630 mm (sem criar peça)", () => {
    expect(validateMaterialPieceWidthMm(MDB_LAMINADO_CANONICAL_ID, 630).ok).toBe(true);
    expect(validateMaterialPieceWidthMm(MDB_LAMINADO_CANONICAL_ID, 600).ok).toBe(true);
    const over = validateMaterialPieceWidthMm(MDB_LAMINADO_CANONICAL_ID, 631);
    expect(over.ok).toBe(false);
    expect(over.maxPieceWidthMm).toBe(630);
    expect(over.message).toMatch(/630/);
  });

  it("matérias sem maxPieceWidthMm passam na validação", () => {
    expect(validateMaterialPieceWidthMm("mdf_branco-19", 2000).ok).toBe(true);
  });

  it("preset visual e opção PBR registados", () => {
    expect(INITIAL_MATERIAL_PRESETS.some((p) => p.id === "mdb_laminado")).toBe(true);
    expect(MATERIAIS_PBR_OPCOES.some((o) => o.id === "mdb_laminado")).toBe(true);
  });

  it("usesOfficialMdbLaminadoSheet reconhece o TAMPO e rejeita MDF 19", () => {
    expect(usesOfficialMdbLaminadoSheet("mdb_laminado-30")).toBe(true);
    expect(usesOfficialMdbLaminadoSheet("MDB Laminado 30")).toBe(true);
    expect(usesOfficialMdbLaminadoSheet("mdf_branco-19")).toBe(false);
  });
});
