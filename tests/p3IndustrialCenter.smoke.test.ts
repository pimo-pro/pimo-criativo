/**
 * Smoke P3 — IndustrialCenter Opção A.
 * Fora de src/ para nao entrar no bundle Vite (node:fs/path).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { ProjectState } from "@/context/projectTypes";
import {
  IndustrialCenter,
  getCncItems,
  getCutlist,
  getUeeItems,
  renderPdf,
  publishLiveState,
  clearLiveState,
  getLiveState,
} from "@/core/industrial/IndustrialCenter";
import {
  INDUSTRIAL_ONLINE_ANALYSIS_DOC_IDS,
  type IndustrialOnlineAnalysisDocId,
} from "@/core/industrial/onlineAnalysis/industrialOnlineAnalysisDocs";
import {
  INDUSTRIAL_CLASSIC_PRESENTATION_DOC_IDS,
  mustUseClassicIndustrialPdf,
  shouldUseShellIndustrialPdfForDoc,
} from "@/core/industrial/onlineAnalysis/industrialPdfPolicy";
import { resolveIndustrialZipPdf } from "@/core/industrial/onlineAnalysis/resolveIndustrialZipPdf";
import { buildClassicIndustrialPdf } from "@/core/industrial/onlineAnalysis/buildClassicIndustrialPdf";
import { buildResumoFinanceiroPdfRows } from "@/core/industrial/industrialBottomSectionData";
import { listIndustrialMaterialsSnapshot } from "@/core/materials/service";
import { convertProjectToV3Pieces } from "@/nesting-v3/utils/convertProjectToV3Pieces";
import { buildFullIndustrialScenario } from "@/validation/industrialPipelineTestHelpers";
import {
  applyOverrideWithHistory,
  mergeDocOverride,
} from "@/core/industrial/onlineAnalysis/persistIndustrialDocumentOverrides";
import { getDocumentaryOverrideDocId } from "@/core/industrial/onlineAnalysis/industrialDocumentarySsot";
import { emptyIndustrialDocumentOverride } from "@/core/industrial/onlineAnalysis/industrialDocumentOverridesTypes";
import { defaultRulesConfig } from "@/core/rules/rulesConfig";

function projectFromScenario(edits?: ProjectState["industrialPieceEdits"]): ProjectState {
  const { snap, box, wsBox } = buildFullIndustrialScenario();
  const boxes = snap.boxes?.length ? snap.boxes : [box];
  return {
    projectName: snap.projectName ?? "P3-Smoke",
    boxes,
    workspaceBoxes: [wsBox],
    rules: snap.rules ?? defaultRulesConfig,
    materialId: snap.materialId,
    remates: [...(snap.remates ?? [])],
    rodapes: [...(snap.rodapes ?? [])],
    extractedPartsByBoxId: snap.extractedPartsByBoxId ?? {},
    industrialPieceEdits: edits ?? {},
    industrialDocumentOverrides: {},
  } as ProjectState;
}

function assertPdfDoc(doc: { output: (t: string) => ArrayBuffer | Uint8Array; save?: (n: string) => void }) {
  expect(typeof doc.output).toBe("function");
  expect(typeof doc.save).toBe("function");
  const out = doc.output("arraybuffer");
  const bytes =
    out instanceof ArrayBuffer ? new Uint8Array(out) : new Uint8Array(out.buffer, out.byteOffset, out.byteLength);
  expect(bytes.byteLength).toBeGreaterThan(500);
  expect(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])).toBe("%PDF");
}

describe("P3 Smoke — IndustrialCenter", () => {
  beforeEach(() => {
    clearLiveState();
  });
  afterEach(() => {
    clearLiveState();
  });

  it("classic-first: lista = 9 docs industriais", () => {
    expect([...INDUSTRIAL_CLASSIC_PRESENTATION_DOC_IDS]).toEqual([
      ...INDUSTRIAL_ONLINE_ANALYSIS_DOC_IDS,
    ]);
    for (const id of INDUSTRIAL_ONLINE_ANALYSIS_DOC_IDS) {
      expect(mustUseClassicIndustrialPdf(id)).toBe(true);
    }
  });

  it("gera os 9 PDFs industriais via IndustrialCenter.renderPdf (com override noutro doc)", async () => {
    const project = projectFromScenario();
    project.industrialDocumentOverrides = {
      cutlist: {
        ...emptyIndustrialDocumentOverride(),
        rowPatches: {
          "c:cutlist:dummy": {
            fields: { material: "HDF" },
            updatedAt: new Date().toISOString(),
            updatedBy: { userId: "u", userName: "smoke" },
            source: "manual",
          },
        },
      },
    };

    for (const docId of INDUSTRIAL_ONLINE_ANALYSIS_DOC_IDS) {
      expect(shouldUseShellIndustrialPdfForDoc(project, docId)).toBe(false);
      const doc = await renderPdf(project, docId, { showPrices: false });
      assertPdfDoc(doc);
    }
  }, 120_000);

  it("cutlist unica: financeiro hub rows === getCutlist / getCncItems", () => {
    const project = projectFromScenario();
    const materials = listIndustrialMaterialsSnapshot();
    const viaCenter = getCutlist(project, "withPieceEdits");
    const viaCnc = getCncItems(project);
    const { pecas, summary } = buildResumoFinanceiroPdfRows(project, materials, false);

    expect(viaCenter.length).toBeGreaterThan(0);
    expect(viaCnc).toEqual(viaCenter);
    expect(pecas.length).toBe(viaCenter.length);

    const qtyCenter = viaCenter.reduce((s, i) => s + i.quantidade, 0);
    const qtyFromPecasRows = pecas.reduce((s, r) => s + Number(r[3] ?? 0), 0);
    expect(qtyFromPecasRows).toBe(qtyCenter);
    const pecasRow = summary.find((r) => /peças/i.test(String(r[0] ?? "")));
    expect(pecasRow).toBeTruthy();
    expect(Number(pecasRow![1])).toBe(qtyCenter);
  });

  it("armazem via resolve ? classic (nao shell) mesmo com overrides", async () => {
    const project = projectFromScenario();
    project.industrialDocumentOverrides = {
      pecas_totais: {
        ...emptyIndustrialDocumentOverride(),
        rowPatches: {
          x: {
            fields: { qtd: "9" },
            updatedAt: new Date().toISOString(),
            updatedBy: { userId: "u", userName: "smoke" },
            source: "manual",
          },
        },
      },
    };

    let classicCalls = 0;
    const doc = await resolveIndustrialZipPdf(project, "industrial_armazem", async () => {
      classicCalls += 1;
      return buildClassicIndustrialPdf(project, "industrial_armazem");
    });
    expect(classicCalls).toBe(1);
    assertPdfDoc(doc);
  });

  it("Nesting V3 convertProjectToV3Pieces usa getCncItems + pieceEdits", () => {
    const base = projectFromScenario();
    const items = getCncItems(base);
    expect(items.length).toBeGreaterThan(0);
    const target = items[0];
    expect(target.id).toBeTruthy();

    const withEdits = projectFromScenario({
      [target.id]: {
        largura: 333,
        altura: 222,
        espessura: 18,
      },
    });

    const without = convertProjectToV3Pieces(base);
    const withPieces = convertProjectToV3Pieces(withEdits);
    expect(withPieces.length).toBe(without.length);
    expect(withPieces.length).toBeGreaterThan(0);

    const cncEdited = getCncItems(withEdits);
    const editedItem = cncEdited.find((i) => i.id === target.id);
    expect(editedItem?.dimensoes.largura).toBe(333);
    expect(editedItem?.dimensoes.altura).toBe(222);

    const dimsMatch = withPieces.some(
      (p) => Math.round(p.widthMm) === 333 || Math.round(p.heightMm) === 333
    );
    expect(dimsMatch).toBe(true);
  });

  it("getUeeItems aplica whitelist; getCncItems nao muda com override documental", () => {
    const project = projectFromScenario();
    const cncBefore = getCncItems(project);

    project.industrialDocumentOverrides = {
      cutlist: {
        ...emptyIndustrialDocumentOverride(),
        rowPatches: {},
        addedRows: [],
        deletedRowIds: [],
      },
    };
    const cncAfter = getCncItems(project);
    expect(cncAfter.map((i) => i.id)).toEqual(cncBefore.map((i) => i.id));
    expect(cncAfter.map((i) => `${i.dimensoes.largura}x${i.dimensoes.altura}`)).toEqual(
      cncBefore.map((i) => `${i.dimensoes.largura}x${i.dimensoes.altura}`)
    );

    const uee = getUeeItems(project);
    expect(uee).not.toBe(cncAfter);
    expect(Array.isArray(uee)).toBe(true);
  });

  it("patchDocumentRow SSOT: tecnico ? cutlist via mergeDocOverride / applyOverrideWithHistory", () => {
    expect(getDocumentaryOverrideDocId("tecnico")).toBe("cutlist");

    const prev = projectFromScenario();
    const override = {
      ...emptyIndustrialDocumentOverride(),
      rowPatches: {
        "c:cutlist:row1": {
          fields: { material: "HDF_SSOT" },
          updatedAt: new Date().toISOString(),
          updatedBy: { userId: "u", userName: "smoke" },
          source: "manual" as const,
        },
      },
    };

    const merged = mergeDocOverride(prev.industrialDocumentOverrides, "tecnico", override);
    expect(merged.cutlist).toBeDefined();
    expect(merged.tecnico).toBeUndefined();
    expect(merged.cutlist?.rowPatches["c:cutlist:row1"]?.fields.material).toBe("HDF_SSOT");

    const applied = applyOverrideWithHistory(prev, "tecnico", override, {
      userId: "u",
      userName: "smoke",
    });
    expect(applied.industrialDocumentOverrides?.cutlist).toBeDefined();
    expect(applied.industrialDocumentOverrides?.tecnico).toBeUndefined();
  });

  it("live store: publish / clear nao quebra (Providers partilham o mesmo SSOT)", () => {
    const project = projectFromScenario();
    expect(getLiveState()).toBeNull();
    publishLiveState(project);
    expect(getLiveState()?.projectName).toBe(project.projectName);
    expect(IndustrialCenter.getLiveState()?.boxes?.length).toBe(project.boxes.length);
    clearLiveState();
    expect(getLiveState()).toBeNull();
  });

  it("pipelines mortos removidos / deprecados (static scan)", () => {
    const root = join(process.cwd(), "src");
    const deletedGenerate = join(
      root,
      "core/industrial/onlineAnalysis/generateIndustrialOnlineAnalysisPdf.ts"
    );
    const deletedConsumo = join(root, "core/pdf/pdfConsumoMateriais.ts");
    expect(() => readFileSync(deletedGenerate)).toThrow();
    expect(() => readFileSync(deletedConsumo)).toThrow();

    const center = readFileSync(join(root, "core/industrial/IndustrialCenter.ts"), "utf8");
    expect(center).toContain("getCncItems");
    expect(center).toContain("renderPdf");

    const convert = readFileSync(join(root, "nesting-v3/utils/convertProjectToV3Pieces.ts"), "utf8");
    expect(convert).toContain("getCncItems");
    expect(convert).not.toContain("buildCutlistItemsForIndustrialExport");

    const multi = readFileSync(join(root, "core/fabrication/multiProjectFabrication.ts"), "utf8");
    expect(multi).toMatch(/@deprecated[\s\S]*IndustrialCenter/);

    const policy = readFileSync(
      join(root, "core/industrial/onlineAnalysis/industrialPdfPolicy.ts"),
      "utf8"
    );
    expect(policy).toContain("INDUSTRIAL_ONLINE_ANALYSIS_DOC_IDS");

    for (const id of INDUSTRIAL_ONLINE_ANALYSIS_DOC_IDS as readonly IndustrialOnlineAnalysisDocId[]) {
      expect(mustUseClassicIndustrialPdf(id)).toBe(true);
    }
  });

  it("4 ProjectProviders: App(3) + NestingV3RoutePage(1) — hydratam live, nao crasham contrato", () => {
    const appSrc = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");
    const nestingRoute = readFileSync(
      join(process.cwd(), "src/app/nesting-v3/NestingV3RoutePage.tsx"),
      "utf8"
    );
    const appMounts = (appSrc.match(/<ProjectProvider>/g) ?? []).length;
    const nestingMounts = (nestingRoute.match(/<ProjectProvider>/g) ?? []).length;
    expect(appMounts).toBe(3);
    expect(nestingMounts).toBe(1);
    expect(appMounts + nestingMounts).toBe(4);

    const provider = readFileSync(join(process.cwd(), "src/context/ProjectProvider.tsx"), "utf8");
    expect(provider).toContain("getIndustrialLiveProject");
    expect(provider).toContain("publishIndustrialLiveProject");

    const io = readFileSync(join(process.cwd(), "src/context/hooks/useProjectIoActions.ts"), "utf8");
    expect(io).toContain("clearIndustrialLiveProject");
  });
});
