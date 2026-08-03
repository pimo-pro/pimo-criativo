import type { CutListItemComPreco, PanelDrillHole } from "../types";
import type { BoxModule } from "../types";
import type { RulesConfig } from "../rules/rulesConfig";
import { resolveIndustrialPieceRef } from "../cutlayout/cutLayoutProPieceNaming";
import {
  buildIndustrialListPiecesPerSheet,
} from "../pdf/industrialListQr";
import { resolveAuthoritativeLabelNumber } from "../qrcode/panelLabelNumber";
import { resolveUnifiedEtiquetaQrCode } from "../etiquetas/qr/etiquetaQr";
import { isLateralPanel } from "./lateralDowels";
import { getDrillBackDistance, getDrillFrontDistance } from "./drillConfig";
import { isDrawerPieceTipo } from "../../services/drawerCutlistAdapter";
import { assertIndustrialOutputAuthorized } from "../industrial/industrialOutputGuard";
import {
  resolveXmlMachineTarget,
  type XmlMachineTarget,
} from "./xmlMachineRouting";
import { DRAWER_LAT_GROOVE_OVERCUT_MM } from "../drawers/drawerGeometryConstants";

export type { XmlMachineTarget } from "./xmlMachineRouting";
export {
  resolveXmlMachineTarget,
  pieceShouldHaveDrillLabel,
  isDrillStationXmlPiece,
  isCncStationXmlPiece,
} from "./xmlMachineRouting";

const fmt = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : "0.00");

/** Sangria default (frente inset / legado); laterais usam DRAWER_LAT_GROOVE_OVERCUT_MM. */
const GROOVE_OVERCUT_MM = 10;
const PANEL_EDGE_EPS_MM = 0.5;

function resolveHorizontalHoleQuadrant(x: number, panelLength: number): 1 | 2 {
  if (Math.abs(x) <= PANEL_EDGE_EPS_MM) return 2;
  if (Math.abs(x - panelLength) <= PANEL_EDGE_EPS_MM) return 1;
  return 1;
}

function sanitizeFilenamePart(value: string): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\p{L}\p{N}_-]/gu, "")
    .slice(0, 64) || "PECA";
}

function sanitizeFilename(code: string): string {
  return sanitizeFilenamePart(code);
}

function readPieceQrCodeFromMetadata(item: CutListItemComPreco): string | null {
  const meta = item.metadata as { qrCode?: unknown; QrCode?: unknown } | undefined;
  const raw = meta?.qrCode ?? meta?.QrCode;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return null;
}

/** True se a peça tem etiqueta/QR atribuído (metadados, N.º QR ou pieceNumber). */
export function pieceHasEtiquetaQr(item: CutListItemComPreco): boolean {
  if (readPieceQrCodeFromMetadata(item)) return true;
  if (resolveAuthoritativeLabelNumber(item) != null) return true;
  const pn = Number(item.pieceNumber ?? 0);
  return Number.isFinite(pn) && pn > 0;
}

/** QR canónico v5 — igual à coluna N.º QR do unificado.pdf / etiquetas. */
export function resolvePieceQrCode(
  item: CutListItemComPreco,
  project: ProjectContext,
  piecesPerSheet: Map<string, number>,
  index0: number
): string | null {
  const fromMeta = readPieceQrCodeFromMetadata(item);
  if (fromMeta) return fromMeta;
  if (!pieceHasEtiquetaQr(item)) return null;
  return resolveUnifiedEtiquetaQrCode(
    item,
    {
      projectName: project.projectName,
      boxes: project.boxes,
      rules: project.rules,
    },
    piecesPerSheet,
    index0
  );
}

/** Nome completo quando a peça não tem QR: PROJETO_CAIXA_PECA */
export function buildDrillXmlFallbackFileName(
  item: CutListItemComPreco,
  project: Pick<ProjectContext, "projectName" | "boxes">
): string {
  const projectName = String(project.projectName ?? "PROJETO").trim() || "PROJETO";
  const boxNome =
    project.boxes.find((b) => b.id === item.boxId)?.nome?.trim() ||
    String(item.boxId ?? "BOX").trim() ||
    "BOX";
  const pieceName = resolveIndustrialPieceRef(item, boxNome, projectName);
  return [projectName, boxNome, pieceName].map(sanitizeFilenamePart).join("_");
}

/**
 * Nome base do ficheiro XML industrial (.xml).
 * Com etiqueta: valor do QR (v5 / metadata.qrCode). Sem etiqueta: PROJETO_CAIXA_PECA.
 */
export function panelFileNameFromPiece(
  item: CutListItemComPreco,
  project: ProjectContext,
  piecesPerSheet: Map<string, number>,
  index0: number
): string {
  const qrCode = resolvePieceQrCode(item, project, piecesPerSheet, index0);
  if (qrCode) return sanitizeFilename(qrCode);
  return sanitizeFilename(buildDrillXmlFallbackFileName(item, project));
}

/**
 * Gera XML KDTPanelFormat para uma peça lateral.
 * Sistema de coordenadas da máquina:
 *   - Origem = canto superior direito
 *   - X+ = vai para a esquerda (ao longo do comprimento PanelLength)
 *   - Y+ = vai para baixo (ao longo da largura PanelWidth)
 *   - TypeNo=1 = Vertical Hole (perfura de cima para baixo)
 *   - X1 = posição ao longo do comprimento
 *   - Y1 = edge "top" → espessura/2 | edge "bottom" → PanelWidth - espessura/2
 */
function buildXmlForLateral(
  panelLength: number,
  panelWidth: number,
  panelThickness: number,
  frontDist: number,
  backDist: number
): string {
  const z1 = fmt(panelThickness / 2);
  const y1Front = frontDist;
  const y1Back = panelWidth - backDist;
  const lines: string[] = [];

  lines.push(" <PANEL>");
  lines.push(`  <PanelLength>${fmt(panelLength)}</PanelLength>`);
  lines.push(`  <PanelWidth>${fmt(panelWidth)}</PanelWidth>`);
  lines.push(`  <PanelThickness>${fmt(panelThickness)}</PanelThickness>`);
  lines.push(" </PANEL>");

  // Quadrant 2 — borda esquerda (X1=0), 2 furos: frente e fundo
  for (const y1 of [y1Front, y1Back]) {
    lines.push(" <CAD>");
    lines.push("  <TypeNo>2</TypeNo>");
    lines.push("  <TypeName>Horizontal Hole</TypeName>");
    lines.push("  <X1>0.00</X1>");
    lines.push(`  <Y1>${fmt(y1)}</Y1>`);
    lines.push(`  <Z1>${z1}</Z1>`);
    lines.push("  <Quadrant>2</Quadrant>");
    lines.push("  <Depth>30.00</Depth>");
    lines.push("  <Diameter>10.00</Diameter>");
    lines.push("  <Enable>1</Enable>");
    lines.push(" </CAD>");
  }

  // Quadrant 1 — borda direita (X1=L), 2 furos: frente e fundo
  for (const y1 of [y1Front, y1Back]) {
    lines.push(" <CAD>");
    lines.push("  <TypeNo>2</TypeNo>");
    lines.push("  <TypeName>Horizontal Hole</TypeName>");
    lines.push(`  <X1>${fmt(panelLength)}</X1>`);
    lines.push(`  <Y1>${fmt(y1)}</Y1>`);
    lines.push(`  <Z1>${z1}</Z1>`);
    lines.push("  <Quadrant>1</Quadrant>");
    lines.push("  <Depth>30.00</Depth>");
    lines.push("  <Diameter>10.00</Diameter>");
    lines.push("  <Enable>1</Enable>");
    lines.push(" </CAD>");
  }

  const body = lines.join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<KDTPanelFormat>\n${body}\n</KDTPanelFormat>`;
}

function buildXmlFromDrillHoles(
  panelLength: number,
  panelWidth: number,
  panelThickness: number,
  holes: PanelDrillHole[]
): string {
  const lines: string[] = [];
  lines.push(" <PANEL>");
  lines.push(`  <PanelLength>${fmt(panelLength)}</PanelLength>`);
  lines.push(`  <PanelWidth>${fmt(panelWidth)}</PanelWidth>`);
  lines.push(`  <PanelThickness>${fmt(panelThickness)}</PanelThickness>`);
  lines.push(" </PANEL>");

  for (const hole of holes) {
    // TypeNo=3 — Vertical Line (rasgo de encaixe, schema KDT industrial)
    if (hole.holeSubtype === "groove") {
      const beginY = hole.y;
      if (!Number.isFinite(beginY) || beginY < -PANEL_EDGE_EPS_MM || beginY > panelWidth + PANEL_EDGE_EPS_MM) {
        continue;
      }
      const grooveLen = hole.grooveLength;
      const startX = hole.x;
      /** Laterais gaveta: sempre BeginX=L+10 … EndX=−10 (LAT_ESQ.xml). */
      const fullOvercut = hole.grooveFullPanelOvercut === true;
      const overcutMm = fullOvercut ? DRAWER_LAT_GROOVE_OVERCUT_MM : GROOVE_OVERCUT_MM;
      const useInset =
        !fullOvercut &&
        Number.isFinite(startX) &&
        startX >= 0 &&
        grooveLen != null &&
        Number.isFinite(grooveLen) &&
        grooveLen > 0 &&
        startX + grooveLen <= panelLength + PANEL_EDGE_EPS_MM &&
        (startX > PANEL_EDGE_EPS_MM || startX + grooveLen < panelLength - PANEL_EDGE_EPS_MM);
      const beginX = useInset ? startX : panelLength + overcutMm;
      const endX = useInset ? startX + (grooveLen as number) : -overcutMm;
      const correction =
        hole.grooveCorrection != null && Number.isFinite(hole.grooveCorrection)
          ? Math.round(hole.grooveCorrection)
          : 0;
      lines.push(" <CAD>");
      lines.push("  <TypeNo>3</TypeNo>");
      lines.push("  <TypeName>Vertical Line</TypeName>");
      if (hole.grooveToolName) {
        lines.push(`  <ToolName>${hole.grooveToolName}</ToolName>`);
      }
      lines.push(`  <BeginX>${fmt(beginX)}</BeginX>`);
      lines.push(`  <BeginY>${fmt(beginY)}</BeginY>`);
      lines.push(`  <EndX>${fmt(endX)}</EndX>`);
      lines.push(`  <EndY>${fmt(beginY)}</EndY>`);
      lines.push(`  <Width>${fmt(hole.grooveWidth ?? 0)}</Width>`);
      lines.push(`  <Correction>${correction}</Correction>`);
      lines.push("  <CorrectionExtra>0</CorrectionExtra>");
      lines.push("  <Z>0.00</Z>");
      lines.push(`  <Depth>${fmt(hole.depth)}</Depth>`);
      lines.push("  <EntryZ>0</EntryZ>");
      lines.push("  <EntryL>0</EntryL>");
      lines.push("  <Enable>1</Enable>");
      lines.push("  <UseSaw>0</UseSaw>");
      lines.push("  <UseDZ>0</UseDZ>");
      lines.push("  <BeginZ>0.00</BeginZ>");
      lines.push("  <EndZ>0.00</EndZ>");
      lines.push(" </CAD>");
      continue;
    }

    // Rejeitar furos fora da placa (evita fantasma vs painel da máquina).
    if (
      !Number.isFinite(hole.x) ||
      !Number.isFinite(hole.y) ||
      hole.x < -PANEL_EDGE_EPS_MM ||
      hole.x > panelLength + PANEL_EDGE_EPS_MM ||
      hole.y < -PANEL_EDGE_EPS_MM ||
      hole.y > panelWidth + PANEL_EDGE_EPS_MM
    ) {
      continue;
    }

    const isVertical =
      hole.topDrillable !== false &&
      (hole.topDrillable === true ||
        hole.holeType === "corredica" ||
        hole.holeType === "parafuso" ||
        hole.holeType === "puxador" ||
        hole.holeType === "fixacao_metalica");
    if (isVertical) {
      lines.push(" <CAD>");
      lines.push("  <TypeNo>1</TypeNo>");
      lines.push("  <TypeName>Vertical Hole</TypeName>");
      lines.push(`  <X1>${fmt(hole.x)}</X1>`);
      lines.push(`  <Y1>${fmt(hole.y)}</Y1>`);
      lines.push("  <Z1>0.00</Z1>");
      lines.push(`  <Depth>${fmt(hole.depth)}</Depth>`);
      lines.push(`  <Diameter>${fmt(hole.diameter)}</Diameter>`);
      lines.push("  <Enable>1</Enable>");
      lines.push(" </CAD>");
      continue;
    }

    lines.push(" <CAD>");
    lines.push("  <TypeNo>2</TypeNo>");
    lines.push("  <TypeName>Horizontal Hole</TypeName>");
    lines.push(`  <X1>${fmt(hole.x)}</X1>`);
    lines.push(`  <Y1>${fmt(hole.y)}</Y1>`);
    lines.push(`  <Z1>${fmt(panelThickness / 2)}</Z1>`);
    lines.push(`  <Quadrant>${resolveHorizontalHoleQuadrant(hole.x, panelLength)}</Quadrant>`);
    lines.push(`  <Depth>${fmt(hole.depth)}</Depth>`);
    lines.push(`  <Diameter>${fmt(hole.diameter)}</Diameter>`);
    lines.push("  <Enable>1</Enable>");
    lines.push(" </CAD>");
  }

  const body = lines.join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<KDTPanelFormat>\n${body}\n</KDTPanelFormat>`;
}

function resolveDrawerPanelDimensions(item: CutListItemComPreco): {
  panelLength: number;
  panelWidth: number;
} | null {
  const largura = Number(item.dimensoes?.largura ?? 0);
  const altura = Number(item.dimensoes?.altura ?? 0);
  if (largura <= 0 || altura <= 0) return null;

  // KDT industrial: L = PanelLength (profundidade / largura), W = PanelWidth (altura).
  return { panelLength: largura, panelWidth: altura };
}

/**
 * gav_lat_esq / gav_lat_dir — SSOT transversal `cx gav lat`.
 * Cutlist: largura=profundidade, altura=altura_gaveta.
 * XML: PanelLength=L=altura, PanelWidth=W=largura; furos já no referencial L×W.
 */
function resolveGavetaLateralXmlHoles(item: CutListItemComPreco): {
  panelLength: number;
  panelWidth: number;
  holes: PanelDrillHole[];
} | null {
  const largura = Number(item.dimensoes?.largura ?? 0);
  const altura = Number(item.dimensoes?.altura ?? 0);
  if (largura <= 0 || altura <= 0 || !item.drillHoles?.length) return null;
  const holes = item.drillHoles.map((h) => ({
    ...h,
    x: h.x,
    y: h.y,
  }));
  return { panelLength: altura, panelWidth: largura, holes };
}

function isGavetaLateralTipo(tipo: string): boolean {
  return tipo === "gaveta_lat_esq" || tipo === "gaveta_lat_dir";
}

function resolveFlatPanelDimensions(item: CutListItemComPreco): {
  panelLength: number;
  panelWidth: number;
} | null {
  return resolveDrawerPanelDimensions(item);
}

function isTopBottomPanel(item: CutListItemComPreco): boolean {
  return item.tipo === "cima" || item.tipo === "fundo";
}

function isFixedFrontPanel(item: CutListItemComPreco): boolean {
  return item.tipo === "frente_fixa";
}

/** Painéis planos CNC (cima/fundo/frentes/portas/costa de módulo/prateleira). */
function isFlatCncExportPanel(item: CutListItemComPreco): boolean {
  return (
    isTopBottomPanel(item) ||
    isFixedFrontPanel(item) ||
    item.tipo === "prateleira" ||
    item.tipo === "porta" ||
    item.tipo === "porta_simples" ||
    item.tipo === "porta_dupla" ||
    item.tipo === "porta_correr" ||
    item.tipo === "COSTA" ||
    item.tipo === "costa"
  );
}

/** Painéis planos DRILL (sep/div). */
function isFlatDrillStationPanel(item: CutListItemComPreco): boolean {
  return item.tipo === "divisorio" || item.tipo === "separador";
}

export type DrillExportFile = {
  filenameBase: string;
  partName: string;
  thicknessMm: number;
  xml: string;
  /** Estação industrial do ficheiro. */
  machineTarget: XmlMachineTarget;
  /** Caminho relativo no ZIP (ex.: cnc/XML/… ou drill/XML/…). */
  zipPath: string;
};

type ProjectContext = {
  projectName: string;
  boxes: BoxModule[];
  rules: RulesConfig;
};

function appendDrillSuffix(filenameBase: string): string {
  if (/_DRILL$/i.test(filenameBase)) return filenameBase;
  return `${filenameBase}_DRILL`;
}

function appendCompletoSuffix(filenameBase: string): string {
  if (/_COMPLETO$/i.test(filenameBase)) return filenameBase;
  return `${filenameBase}_COMPLETO`;
}

/** Metadata PIMO no XML (comentário — ignorado pela KDT). Inclui stackRole da gaveta. */
function appendDrawerStackRoleMeta(xml: string, item: CutListItemComPreco): string {
  const rules = item.metadata?.drawerRules as { stackRole?: string } | undefined;
  const stackRole = rules?.stackRole;
  if (!stackRole) return xml;
  const meta = ` <!-- pimo:stackRole=${stackRole} -->`;
  if (xml.includes("</PANEL>")) {
    return xml.replace("</PANEL>", `</PANEL>\n${meta}`);
  }
  return `${xml}\n${meta}`;
}

/**
 * Constrói o XML KDT da peça (geometria SSOT).
 * Independente do destino CNC/DRILL — a decisão de pasta/sufixo é feita no export.
 */
function buildXmlForItem(
  item: CutListItemComPreco,
  frontDist: number,
  backDist: number
): { panelLength: number; panelWidth: number; xml: string } | null {
  const panelThickness = Number(item.espessura) || 19;

  if (isLateralPanel(item)) {
    const dims = resolveDrawerPanelDimensions(item);
    if (!dims) return null;
    const { panelLength, panelWidth } = dims;
    const xml = item.drillHoles?.length
      ? buildXmlFromDrillHoles(panelLength, panelWidth, panelThickness, item.drillHoles)
      : buildXmlForLateral(panelLength, panelWidth, panelThickness, frontDist, backDist);
    return { panelLength, panelWidth, xml };
  }

  if (isGavetaLateralTipo(item.tipo) && (item.drillHoles?.length ?? 0) > 0) {
    const mapped = resolveGavetaLateralXmlHoles(item);
    if (!mapped) return null;
    return {
      panelLength: mapped.panelLength,
      panelWidth: mapped.panelWidth,
      xml: appendDrawerStackRoleMeta(
        buildXmlFromDrillHoles(
          mapped.panelLength,
          mapped.panelWidth,
          panelThickness,
          mapped.holes
        ),
        item
      ),
    };
  }

  if (
    isDrawerPieceTipo(item.tipo) &&
    (item.tipo === "gaveta_frente" ||
      item.tipo === "gaveta_frente_int" ||
      item.tipo === "gaveta_frente_ext" ||
      item.tipo === "gaveta_traseira") &&
    (item.drillHoles?.length ?? 0) > 0
  ) {
    const dims = resolveDrawerPanelDimensions(item);
    if (!dims) return null;
    return {
      ...dims,
      xml: appendDrawerStackRoleMeta(
        buildXmlFromDrillHoles(dims.panelLength, dims.panelWidth, panelThickness, item.drillHoles!),
        item
      ),
    };
  }

  if (isDrawerPieceTipo(item.tipo) && (item.drillHoles?.length ?? 0) > 0) {
    const dims = resolveDrawerPanelDimensions(item);
    if (!dims) return null;
    return {
      ...dims,
      xml: appendDrawerStackRoleMeta(
        buildXmlFromDrillHoles(dims.panelLength, dims.panelWidth, panelThickness, item.drillHoles!),
        item
      ),
    };
  }

  if (isFlatDrillStationPanel(item) && (item.drillHoles?.length ?? 0) > 0) {
    const dims = resolveFlatPanelDimensions(item);
    if (!dims) return null;
    return {
      ...dims,
      xml: buildXmlFromDrillHoles(dims.panelLength, dims.panelWidth, panelThickness, item.drillHoles!),
    };
  }

  if (isFlatCncExportPanel(item) && (item.drillHoles?.length ?? 0) > 0) {
    const dims = resolveFlatPanelDimensions(item);
    if (!dims) return null;
    return {
      ...dims,
      xml: buildXmlFromDrillHoles(dims.panelLength, dims.panelWidth, panelThickness, item.drillHoles!),
    };
  }

  return null;
}

function pushExportFile(
  out: DrillExportFile[],
  usedNames: Set<string>,
  args: {
    code: string;
    suffix: "none" | "drill" | "completo";
    partName: string;
    thicknessMm: number;
    xml: string;
    machineTarget: XmlMachineTarget;
    folder: "cnc/XML" | "drill/XML";
  }
): void {
  let filenameBase =
    args.suffix === "drill"
      ? appendDrillSuffix(args.code)
      : args.suffix === "completo"
        ? appendCompletoSuffix(args.code)
        : args.code;
  let dedupe = 2;
  while (usedNames.has(filenameBase)) {
    const stamped =
      args.suffix === "drill"
        ? `${args.code}_${dedupe}_DRILL`
        : args.suffix === "completo"
          ? `${args.code}_${dedupe}_COMPLETO`
          : `${args.code}_${dedupe}`;
    filenameBase = sanitizeFilename(stamped);
    dedupe += 1;
  }
  usedNames.add(filenameBase);
  out.push({
    filenameBase,
    partName: args.partName,
    thicknessMm: args.thicknessMm,
    xml: args.xml,
    machineTarget: args.machineTarget,
    zipPath: `${args.folder}/${filenameBase}.xml`,
  });
}

/**
 * Gera ficheiros XML por peça:
 * - CNC → `cnc/XML/{qr}.xml` (peças da estação CNC)
 * - DRILL → `drill/XML/{qr}_DRILL.xml` (apenas peças da máquina DRILL)
 * - COMPLETO → `drill/XML/{qr}_COMPLETO.xml` (auditoria: todas as peças com XML)
 *
 * Etiquetas: só `_DRILL` activa etiqueta DRILL; `_COMPLETO` não altera etiquetas.
 */
export function buildDrillFilesForProject(
  items: CutListItemComPreco[],
  project: ProjectContext,
  options?: { machineTarget?: XmlMachineTarget | "all" }
): DrillExportFile[] {
  assertIndustrialOutputAuthorized("txml");
  const filter = options?.machineTarget ?? "all";
  const out: DrillExportFile[] = [];
  const frontDist = getDrillFrontDistance();
  const backDist = getDrillBackDistance();
  const usedNames = new Set<string>();
  const piecesPerSheet = buildIndustrialListPiecesPerSheet(items);

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx]!;
    const target = resolveXmlMachineTarget(item);
    if (!target) continue;

    const built = buildXmlForItem(item, frontDist, backDist);
    if (!built) continue;

    const code = panelFileNameFromPiece(item, project, piecesPerSheet, idx);
    const thicknessMm = Number(item.espessura) || 19;

    // Auditoria: todas as peças com XML → drill/XML/{qr}_COMPLETO.xml
    if (filter === "all" || filter === "completo") {
      pushExportFile(out, usedNames, {
        code,
        suffix: "completo",
        partName: item.nome,
        thicknessMm,
        xml: built.xml,
        machineTarget: "completo",
        folder: "drill/XML",
      });
    }

    // Máquina DRILL
    if (target === "drill" && (filter === "all" || filter === "drill")) {
      pushExportFile(out, usedNames, {
        code,
        suffix: "drill",
        partName: item.nome,
        thicknessMm,
        xml: built.xml,
        machineTarget: "drill",
        folder: "drill/XML",
      });
    }

    // Máquina CNC
    if (target === "cnc" && (filter === "all" || filter === "cnc")) {
      pushExportFile(out, usedNames, {
        code,
        suffix: "none",
        partName: item.nome,
        thicknessMm,
        xml: built.xml,
        machineTarget: "cnc",
        folder: "cnc/XML",
      });
    }
  }

  return out;
}

/** Apenas XML da estação CNC. */
export function buildCncXmlFilesForProject(
  items: CutListItemComPreco[],
  project: ProjectContext
): DrillExportFile[] {
  return buildDrillFilesForProject(items, project, { machineTarget: "cnc" });
}

/** Apenas XML da estação DRILL (`*_DRILL.xml`). */
export function buildDrillStationXmlFilesForProject(
  items: CutListItemComPreco[],
  project: ProjectContext
): DrillExportFile[] {
  return buildDrillFilesForProject(items, project, { machineTarget: "drill" });
}

/** Apenas XML de auditoria (`*_COMPLETO.xml` em drill/XML). */
export function buildDrillCompletoXmlFilesForProject(
  items: CutListItemComPreco[],
  project: ProjectContext
): DrillExportFile[] {
  return buildDrillFilesForProject(items, project, { machineTarget: "completo" });
}