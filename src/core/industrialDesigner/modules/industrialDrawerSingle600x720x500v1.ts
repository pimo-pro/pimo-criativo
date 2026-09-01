/**
 * Módulo industrial built-in: Gaveta Simples 600×720×500 mm.
 */

import type { RulesConfig } from "../../rules/rulesConfig";
import { defaultRulesConfig } from "../../rules/rulesConfig";
import {
  buildCutListComPrecoFromDesignBox,
  buildDrillFilesFromDesignBox,
  type DesignDrillExportProjectContext,
} from "../designToCutlist";
import { buildViewerDrillMarkersFromDesign } from "../designToViewer";
import { getBlockingIssues, validateIndustrialDesignBox } from "../geometryValidation";
import type { CustomIndustrialModelRecord } from "../industrialCatalogTypes";
import {
  getBuiltinIndustrialModel,
  registerBuiltinIndustrialModel,
} from "../staticIndustrialRegistry";
import type { IndustrialDesignBox } from "../types";
import { applyAllIndustrialDrawerSingleDrillingRules } from "./industrialDrawerDrilling";
import {
  buildIndustrialDrawerSingleDesignBox,
  type DrawerIndustrialOuter,
} from "./industrialDrawerGeometry";
import {
  INDUSTRIAL_DRAWER_SINGLE_600_MODULE_ID,
  INDUSTRIAL_DRAWER_SINGLE_600_MODULE_NOME,
} from "./industrialDrawerSingleConstants";

const OUTER: DrawerIndustrialOuter = { widthMm: 600, heightMm: 720, depthMm: 500 };
const MATERIAL = "mdf_branco";

export type BuildIndustrialDrawerSingle600Options = {
  includeHandle?: boolean;
};

export function buildIndustrialDrawerSingle600x720x500DesignBox(
  _options: BuildIndustrialDrawerSingle600Options = {}
): IndustrialDesignBox {
  const { box, layout } = buildIndustrialDrawerSingleDesignBox(
    INDUSTRIAL_DRAWER_SINGLE_600_MODULE_ID,
    INDUSTRIAL_DRAWER_SINGLE_600_MODULE_NOME,
    OUTER,
    MATERIAL
  );

  const designBox = applyAllIndustrialDrawerSingleDrillingRules(box, layout);

  const blocking = getBlockingIssues(validateIndustrialDesignBox(designBox));
  if (blocking.length > 0) {
    throw new Error(
      `Módulo gaveta industrial inválido: ${blocking.map((i) => i.message).join("; ")}`
    );
  }

  return designBox;
}

export function buildIndustrialDrawerSingle600ModelRecord(
  project?: DesignDrillExportProjectContext,
  rules?: RulesConfig
): CustomIndustrialModelRecord {
  const designBox = buildIndustrialDrawerSingle600x720x500DesignBox();
  const projectCtx: DesignDrillExportProjectContext = project ?? {
    projectName: "MODULO_INDUSTRIAL_GAVETA_SIMPLES",
    boxes: [],
    rules: rules ?? defaultRulesConfig,
  };

  const cutlistComPreco = buildCutListComPrecoFromDesignBox(designBox);
  const cutlist = cutlistComPreco.map(({ precoUnitario: _pu, precoTotal: _pt, ...item }) => item);
  const viewerMarkers = buildViewerDrillMarkersFromDesign(designBox);
  const drillExportFiles = buildDrillFilesFromDesignBox(designBox, projectCtx);
  const holeCount = designBox.panels.reduce((sum, p) => sum + p.drillHoles.length, 0);

  return {
    id: INDUSTRIAL_DRAWER_SINGLE_600_MODULE_ID,
    nome: INDUSTRIAL_DRAWER_SINGLE_600_MODULE_NOME,
    tipo: "industrial-designer",
    designWorkspace: false,
    widthMm: OUTER.widthMm,
    heightMm: OUTER.heightMm,
    depthMm: OUTER.depthMm,
    designBox: structuredClone(designBox),
    cutlist,
    cutlistComPreco,
    drillExportFiles,
    viewerMarkers,
    metadata: {
      designWorkspace: false,
      tipo: "industrial-designer",
      sourceBoxId: designBox.id,
      panelCount: designBox.panels.length,
      holeCount,
      espessuraMm: designBox.espessuraMm,
      materialId: MATERIAL,
      createdAt: new Date().toISOString(),
      cutlistItemCount: cutlist.length,
      txmlFileCount: drillExportFiles.length,
      moduleKind: "industrial-drawer-single-600x720x500",
      categoriaCatalogo: "gavetas",
      drawerCount: 1,
    },
  };
}

export function registerIndustrialDrawerSingle600x720x500Module(): CustomIndustrialModelRecord {
  const existing = getBuiltinIndustrialModel(INDUSTRIAL_DRAWER_SINGLE_600_MODULE_ID);
  if (existing) return existing;

  const record = buildIndustrialDrawerSingle600ModelRecord();
  registerBuiltinIndustrialModel(record);
  return record;
}
