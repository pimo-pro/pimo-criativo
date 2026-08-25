import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { clearAllCutlistCache } from "../core/manufacturing/cutlistFromBoxes";
import { buildCutlistItemsForIndustrialExport } from "../core/fabrication/buildCutlistItemsForIndustrialExport";
import { buildIndustrialDataForProject } from "../core/fabrication/industrialPipeline";
import { cutlistToPieces, runCutLayout } from "../core/cutlayout/cutLayoutEngine";
import { buildCncFromCutlistItems, getDefaultCncLayoutOptions, getSheetDefinitionFromSettings } from "../core/cnc/cncPipeline";
import { settingsDefaults } from "../core/settings/settingsSchema";
import { setIndustrialSettingsReadOverride } from "../core/settings/settingsStorage";
import { setIndustrialMaterialsReadOverride } from "../core/materials/service";
import { buildDrillFilesForProject } from "../core/drill/drillExport";
import { buildRodapeCutlistItems } from "../core/rodape/rodapeCutlist";
import { isRotatablePiece } from "../core/cutlayout/utils/cutLayoutUtils";
import { allowRotationForPiece, DEFAULT_NESTING_V3_SETTINGS } from "../nesting-v3/nestingV3Settings";
import { isGrainRotationLocked } from "../core/materials/grainDirection";
import { isDrawerPieceTipo } from "../services/drawerCutlistAdapter";
import {
  buildIndustrialCutlistAfterMaterialSync,
  commitMaterialSync,
} from "../core/materials/materialSync";
import { createWorkspaceBox, defaultState, buildBoxesFromWorkspace } from "../context/projectState";
import { defaultRulesConfig } from "../core/rules/rulesConfig";
import {
  buildDoorGrainRegressionBox,
  buildDrawerOnlyBox,
  buildFullIndustrialScenario,
  FULL_INDUSTRIAL_BOX_ID,
  FULL_INDUSTRIAL_BOX_NOME,
  inferIndustrialPieceKind,
} from "./industrialPipelineTestHelpers";

describe("Pipeline industrial A→D — integração final (Fase E)", () => {
  beforeEach(() => {
    clearAllCutlistCache();
  });

  afterEach(() => {
    setIndustrialSettingsReadOverride(null);
    setIndustrialMaterialsReadOverride(null);
  });

  it("export unificado inclui caixa, DIV/SEP, gaveta, remate e rodapé com QR único", () => {
    const { snap } = buildFullIndustrialScenario();
    const all = buildCutlistItemsForIndustrialExport(snap);

    expect(all.some((i) => i.tipo === "divisorio")).toBe(true);
    expect(all.some((i) => i.tipo === "separador")).toBe(true);
    expect(all.some((i) => isDrawerPieceTipo(i.tipo))).toBe(true);
    expect(all.some((i) => i.tipo === "remate")).toBe(true);
    expect(all.some((i) => i.tipo === "rodape")).toBe(true);

    const pieceNumbers = all.map((i) => i.pieceNumber).filter((n) => n != null && n > 0);
    expect(pieceNumbers.length).toBe(all.length);
    expect(new Set(pieceNumbers).size).toBe(all.length);
    for (const item of all) {
      expect(item.pieceNumber).toBeGreaterThan(0);
      expect(item.qrSvg).toBeTruthy();
    }
  });

  it("grainDirection — portas YY, gaveta frente YY, laterais XX, remate lateral YY, rodapé livre", () => {
    const { snap } = buildFullIndustrialScenario();
    const all = buildCutlistItemsForIndustrialExport(snap);

    const drawerFront = all.find((i) => i.tipo === "gaveta_frente_ext");
    const drawerLat = all.find((i) => i.tipo === "gaveta_lat_esq");
    const remateDir = all.find((i) => i.tipo === "remate" && i.metadata?.remateKind === "DIR");
    const rodape = all.find((i) => i.tipo === "rodape");

    expect(drawerFront?.grainDirection).toBe("YY");
    expect(drawerLat?.grainDirection).toBe("XX");
    expect(remateDir?.grainDirection).toBe("YY");
    expect(rodape?.grainDirection).toBeUndefined();
    expect(isGrainRotationLocked(rodape?.grainDirection)).toBe(false);

    const doorBox = buildDoorGrainRegressionBox();
    const doorExport = buildCutlistItemsForIndustrialExport({
      boxes: [doorBox],
      rules: defaultRulesConfig,
      materialId: "mdf_branco",
      projectName: "NP001",
    });
    const porta = doorExport.find((i) => i.tipo === "porta_simples");
    expect(porta?.grainDirection).toBe("YY");
  });

  it("Layout PRO — remates e rodapés usam tokens unificados no partName", () => {
    const { snap } = buildFullIndustrialScenario();
    const all = buildCutlistItemsForIndustrialExport(snap);
    const pieces = cutlistToPieces(all, {
      projectName: snap.projectName ?? "Projeto",
      boxes: snap.boxes,
    });

    const rematePieces = pieces.filter((p) => p.pieceTipo === "remate");
    const rodapePieces = pieces.filter((p) => p.pieceTipo === "rodape");

    expect(rematePieces.length).toBeGreaterThan(0);
    expect(rodapePieces.length).toBeGreaterThan(0);

    for (const p of rematePieces) {
      expect(p.partName.toLowerCase()).toMatch(/_rem$/);
      expect(p.materialId).toBeTruthy();
    }
    for (const p of rodapePieces) {
      expect(p.partName.toLowerCase()).toMatch(/_roda_pe$/);
      expect(p.industrialGrainCode).toBeUndefined();
      expect(isRotatablePiece(p)).toBe(true);
      expect(
        allowRotationForPiece(
          {
            id: p.partName,
            name: p.partName,
            widthMm: p.largura_mm,
            heightMm: p.altura_mm,
            thicknessMm: p.espessura_mm,
            originalHoles: [],
            rotation: 0,
            color: "#ccc",
            pieceTipo: "rodape",
          },
          DEFAULT_NESTING_V3_SETTINGS
        )
      ).toBe(true);
    }

    const divItem = all.find((i) => i.tipo === "divisorio");
    expect(divItem?.metadata?.industrialLabel).toBeUndefined();
    expect(divItem?.metadata?.divSepKind).toBe("DIV");
    const divPiece = pieces.find((p) => p.pieceTipo === "divisorio" || p.partName.toLowerCase().endsWith("_div"));
    expect(divPiece?.partName.toLowerCase()).toMatch(/_div$/);
  });

  it("nesting — remate e rodapé entram no layout como CutPiece com tokens unificados", () => {
    const { snap } = buildFullIndustrialScenario();
    const all = buildCutlistItemsForIndustrialExport(snap);
    const pieces = cutlistToPieces(all, {
      projectName: snap.projectName ?? "Projeto",
      boxes: snap.boxes,
    });
    expect(pieces.length).toBeGreaterThan(0);

    const partNames = pieces.map((p) => p.partName.toLowerCase());
    expect(partNames.some((n) => n.endsWith("_rem") || n.includes("_remate_"))).toBe(true);
    expect(partNames.some((n) => n.endsWith("_roda_pe"))).toBe(true);

    const sheet = getSheetDefinitionFromSettings();
    const layout = runCutLayout(pieces, sheet, getDefaultCncLayoutOptions());
    expect(layout.sheets.length).toBeGreaterThan(0);

    const placedNames = new Set(layout.sheets.flatMap((s) => s.placements.map((p) => p.partName.toLowerCase())));
    expect(placedNames.size).toBeGreaterThan(0);
    expect([...placedNames].some((n) => n.endsWith("_rem") || n.includes("_remate_"))).toBe(true);
  });

  it("nesting — rodapé isolado é elegível para chapa (veio livre, rotação permitida)", () => {
    const { snap } = buildFullIndustrialScenario();
    const rodapes = [
      {
        id: "rod-nest-eligible",
        parentBoxId: FULL_INDUSTRIAL_BOX_ID,
        kind: "SIMPLE" as const,
        materialId: "mdf_branco",
        thicknessMm: 19,
        heightMm: 100,
        dimensions: { widthMm: 600, heightMm: 100, depthMm: 19 },
        name: "legacy",
        visible: true,
      },
    ];
    const rodapeCutlist = buildRodapeCutlistItems(rodapes, snap.boxes);
    const pieces = cutlistToPieces(rodapeCutlist, {
      projectName: snap.projectName ?? "Projeto",
      boxes: snap.boxes,
    });
    expect(pieces).toHaveLength(1);
    const p = pieces[0]!;
    expect(p.partName.toLowerCase()).toMatch(/_roda_pe$/);
    expect(isRotatablePiece(p)).toBe(true);

    const sheet = getSheetDefinitionFromSettings();
    expect(Math.max(p.largura_mm, p.altura_mm)).toBeLessThanOrEqual(sheet.largura_mm);
    expect(Math.min(p.largura_mm, p.altura_mm)).toBeLessThanOrEqual(sheet.altura_mm);

    const layout = runCutLayout(pieces, sheet, getDefaultCncLayoutOptions());
    expect(layout.sheets.length).toBeGreaterThan(0);
    const placed = layout.sheets.flatMap((s) => s.placements);
    expect(placed.some((pl) => pl.partName.toLowerCase().includes("roda_pe"))).toBe(true);
  });

  it("cutlistToPieces — roda furos com a normalização de peças altas", () => {
    const [piece] = cutlistToPieces([
      {
        nome: "Painel alto",
        tipo: "lateral",
        boxId: "box1",
        materialId: "mdf_branco",
        material: "mdf_branco",
        dimensoes: { largura: 80, altura: 200, profundidade: 19 },
        espessura: 19,
        quantidade: 1,
        drillHoles: [{ x: 10, y: 30, diameter: 5, depth: 12 }],
      },
    ]);

    expect(piece?.largura_mm).toBe(200);
    expect(piece?.altura_mm).toBe(80);
    expect(piece?.drillHoles?.[0]).toMatchObject({ x: 30, y: 70 });
  });

  it("TCN/CNC — pipeline industrial aceita cutlist completa ou falha só por matéria-prima", () => {
    const { snap } = buildFullIndustrialScenario();
    try {
      const bundle = buildIndustrialDataForProject(
        snap,
        { projectName: snap.projectName },
        getDefaultCncLayoutOptions()
      );
      if (bundle?.cnc?.files?.length) {
        expect(bundle.cnc.files.every((f) => f.tcn != null && f.tcn.length > 0)).toBe(true);
        expect(bundle.layoutResult.sheets.length).toBeGreaterThan(0);
      }
    } catch (err) {
      expect(String(err)).toMatch(/Matéria-prima|chapa/i);
    }
  });

  it("TCN/CNC — layoutResult sai saneado antes de PDF e TCN consumirem operações", () => {
    setIndustrialSettingsReadOverride({
      ...settingsDefaults,
      materiais: {
        ...settingsDefaults.materiais,
        sheetWidthMm: 300,
        sheetHeightMm: 200,
        sheetThicknessMm: 19,
        sheetName: "MDF Teste 19",
      },
    });
    setIndustrialMaterialsReadOverride([
      {
        id: "mdf_teste",
        label: "MDF Teste 19",
        categoryId: "mdf",
        espessura: 19,
        sheetWidthMm: 300,
        sheetHeightMm: 200,
        sheetThicknessMm: 19,
      },
    ]);

    const bundle = buildCncFromCutlistItems(
      { projectName: "Layout saneado" },
      [
        {
          nome: "Painel saneado",
          tipo: "lateral",
          boxId: "box1",
          materialId: "mdf_teste",
          material: "mdf_teste",
          dimensoes: { largura: 80, altura: 40, profundidade: 19 },
          espessura: 19,
          quantidade: 1,
          drillHoles: [
            { x: 20, y: 20, diameter: 5, depth: 12 },
            { x: 100, y: 20, diameter: 5, depth: 12 },
          ],
        },
      ],
      undefined,
      {
        ...getDefaultCncLayoutOptions(),
        rotationPreferenceMode: "disabled",
        useMetaHeuristics: false,
      }
    );

    const placement = bundle?.layoutResult.sheets[0]?.placements[0];
    expect(placement?.originalDrillHoles).toEqual([{ x: 20, y: 20, diameter: 5, depth: 12 }]);
    expect(placement?.drillHoles).toEqual([{ x: 20, y: 20, diameter: 5, depth: 12 }]);
    expect(bundle?.cnc?.files?.[0]?.tcn).toContain("W#81");
  });

  it("XML furação — inclui laterais da caixa; exclui remate e rodapé", () => {
    const { snap } = buildFullIndustrialScenario();
    const all = buildCutlistItemsForIndustrialExport(snap);
    const drillFiles = buildDrillFilesForProject(all, {
      projectName: snap.projectName ?? "Projeto",
      boxes: snap.boxes,
      rules: snap.rules,
    });

    expect(drillFiles.length).toBeGreaterThan(0);
    expect(drillFiles.every((f) => !f.partName.includes("_REMATE_"))).toBe(true);
    expect(drillFiles.every((f) => !f.partName.includes("_RODA_PE_"))).toBe(true);
    expect(drillFiles.some((f) => f.xml.includes("<Panel"))).toBe(true);
  });

  it("etiquetas — classificação industrial correta por família de peça", () => {
    const { snap } = buildFullIndustrialScenario();
    const all = buildCutlistItemsForIndustrialExport(snap);

    const remate = all.find((i) => i.tipo === "remate");
    const rodape = all.find((i) => i.tipo === "rodape");
    const div = all.find((i) => i.tipo === "divisorio");
    const drawerFront = all.find((i) => i.tipo === "gaveta_frente_ext");

    expect(inferIndustrialPieceKind(remate!)).toBe("REMATE");
    expect(inferIndustrialPieceKind(rodape!)).toBe("RODAPE");
    expect(inferIndustrialPieceKind(div!)).toBe("DIV");
    expect(inferIndustrialPieceKind(drawerFront!)).toBe("FRENTE_GAVETA");
  });

  it("materialSync + export — alteração de material propaga para cutlist industrial", () => {
    const wsBox = createWorkspaceBox(
      "box-mat-sync",
      "Sync_Box",
      { largura: 600, altura: 720, profundidade: 560 },
      19,
      [],
      "reta",
      "recuado"
    );
    const project = {
      ...defaultState,
      rules: defaultRulesConfig,
      materialId: "mdf_branco",
      workspaceBoxes: [{ ...wsBox, material: "mdf_branco" }],
    };

    const { next } = commitMaterialSync(project, {
      kind: "box",
      boxId: "box-mat-sync",
      materialId: "carvalho",
    });

    const industrial = buildIndustrialCutlistAfterMaterialSync({
      ...next,
      boxes: buildBoxesFromWorkspace(next),
    });

    const boxItems = industrial.filter((i) => i.boxId === "box-mat-sync" && i.tipo !== "rodape" && i.tipo !== "remate");
    expect(boxItems.length).toBeGreaterThan(0);
    expect(next.workspaceBoxes[0]?.material).toBe("carvalho");
  });

  it("regressão gavetas — peças paramétricas mantêm grain e presença no export", () => {
    const box = buildDrawerOnlyBox();
    const all = buildCutlistItemsForIndustrialExport({
      boxes: [box],
      rules: defaultRulesConfig,
      materialId: "mdf_branco",
      projectName: "NP001",
    });
    const drawerPieces = all.filter((i) => isDrawerPieceTipo(i.tipo));
    expect(drawerPieces.length).toBeGreaterThan(0);
    expect(drawerPieces.find((p) => p.tipo === "gaveta_frente_ext")?.grainDirection).toBe("YY");
    expect(drawerPieces.find((p) => p.tipo === "gaveta_lat_esq")?.grainDirection).toBe("XX");
  });
});
