import { COMPONENT_TYPES_DEFAULT, type ComponentType } from "../components/componentTypes";
import { FERRAGENS_DEFAULT, type Ferragem } from "../ferragens/ferragens";
import { buildCutlistItemsForIndustrialExport } from "../fabrication/buildCutlistItemsForIndustrialExport";
import { gerarModeloIndustrial } from "../manufacturing/boxManufacturing";
import type { BoxModule, CutListItemComPreco } from "../types";
import type { RulesConfig } from "../rules/rulesConfig";
import type { PieceObservacoesStore } from "../observacoes/observacoesTypes";
import {
  formatObservacoesForPdf,
  resolveObservacoesForCutListItem,
} from "../observacoes/ObservacoesService";
import {
  resolveFullIndustrialNameForDocument,
  resolveIndustrialIdForDocument,
  sanitizeIndustrialSegment,
} from "../etiquetas/industrialDisplayName";
import { safeGetItem } from "../../utils/storage";
import {
  CAVILHA_10x40_FERRAGEM_ID,
  countCavilha10x40FromEdgeHoles,
} from "../drill/cavilha10x40Rule";
import { sanitizeFerragensCatalog } from "../ferragens/ferragensCatalogSanitize";
import {
  pieceTemParafusoPuxador,
  resolveCanonicalFerragemId,
  resolveFerragemCommercialName,
} from "../ferragens/ferragensCountRules";

const TIPO_TO_COMPONENT_ID: Record<string, string> = {
  cima: "cima",
  fundo: "fundo",
  lateral_esquerda: "lateral_esquerda",
  lateral_direita: "lateral_direita",
  COSTA: "costa",
  prateleira: "prateleira",
  porta_dupla: "porta",
  porta_simples: "porta",
  porta_correr: "porta",
  gaveta_frente: "gaveta_frente",
  gaveta_frente_ext: "gaveta_frente",
  gaveta_lat_esq: "gaveta_lat_esq",
  gaveta_lat_dir: "gaveta_lat_dir",
  gaveta_fundo: "gaveta_fundo",
  gaveta_traseira: "gaveta_traseira",
  frente_fixa: "frente_fixa",
};

/**
 * Ferragens de junta estrutura: contadas uma vez (cima/fundo).
 * Laterais repetem as mesmas juntas fisicas — nao somar de novo.
 * Cavilhas de junta vêm só dos furos (CAVILHA_10x40 / nome comercial Cavilha 10mm).
 */
const JOINT_FERRAGEM_IDS = new Set(["parafuso_4x50"]);
const JOINT_COUNT_PIECE_TIPOS = new Set(["cima", "fundo"]);

/**
 * Tipos vindos de gerarModeloIndustrial que ja existem em ferragens_default por peca.
 * Somar os dois duplica quantidades no PDF ferragens_totais.
 */
const MODELO_TIPOS_COBERTOS_POR_PECA = new Set([
  "suportes_prateleira",
  "dobradicas",
  "corredicas",
]);

function dedupeBoxesById(boxes: BoxModule[]): BoxModule[] {
  const seen = new Set<string>();
  const out: BoxModule[] = [];
  for (const box of boxes ?? []) {
    const id = String(box?.id ?? "").trim();
    if (!id) {
      out.push(box);
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(box);
  }
  return out;
}

export type IndustrialFerragemPdfRow = {
  /** Nome da caixa — preenchido sobretudo em linhas box-level; nas de peça o nome completo já inclui a caixa. */
  caixa: string;
  peca: string;
  ferragem: string;
  qtd: number;
  material: string;
  /** ID industrial curto (`buildIndustrialId`) — igual à etiqueta / No ETQ. */
  nQr: string;
  observacoes: string;
};

export type ProjectIndustrialFerragens = {
  projectName: string;
  projectCode: string;
  generatedAt: string;
  rows: IndustrialFerragemPdfRow[];
};

export type IndustrialFerragensProjectInput = {
  projectName?: string;
  boxes: BoxModule[];
  rules: RulesConfig;
  materialId?: string;
  extractedPartsByBoxId?: Record<string, Record<string, CutListItemComPreco[]>>;
  remates?: import("../remate/rematePieceTypes").RematePiece[];
  rodapes?: import("../rodape/rodapeTypes").ProjectRodape[];
  pieceObservacoes?: PieceObservacoesStore;
};

function loadComponentTypes(): ComponentType[] {
  const raw = safeGetItem("pimo_component_types");
  if (!raw) return COMPONENT_TYPES_DEFAULT;
  try {
    const parsed = JSON.parse(raw) as ComponentType[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : COMPONENT_TYPES_DEFAULT;
  } catch {
    return COMPONENT_TYPES_DEFAULT;
  }
}

function loadFerragens(): Ferragem[] {
  const raw = safeGetItem("pimo_ferragens");
  if (!raw) return FERRAGENS_DEFAULT;
  try {
    const parsed = JSON.parse(raw) as Ferragem[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : FERRAGENS_DEFAULT;
  } catch {
    return FERRAGENS_DEFAULT;
  }
}

function ferragemLabel(ferragemId: string, catalog: Map<string, Ferragem>): string {
  return resolveFerragemCommercialName(ferragemId, catalog);
}

function pushPieceFerragens(
  rows: IndustrialFerragemPdfRow[],
  item: CutListItemComPreco,
  boxNome: string,
  projectName: string,
  ctById: Record<string, ComponentType>,
  ferragemById: Map<string, Ferragem>,
  pieceObservacoes?: PieceObservacoesStore,
  box?: BoxModule
): void {
  const componentId = TIPO_TO_COMPONENT_ID[item.tipo] ?? item.tipo;
  const ct = ctById[componentId];
  const peca = resolveFullIndustrialNameForDocument(item, projectName, boxNome);
  const nQr = resolveIndustrialIdForDocument(item, projectName, boxNome);
  const material = String(item.material ?? item.materialId ?? "—").trim() || "—";
  const observacoes = formatObservacoesForPdf(
    resolveObservacoesForCutListItem(item, { pieceObservacoes })
  );

  const defs = ct?.ferragens_default ?? [];
  if (defs.length === 0) return;

  const pieceTipo = String(item.tipo ?? "");
  const qtyMult = Math.max(1, item.quantidade ?? 1);

  for (const def of defs) {
    if (def.ferragem_id === "parafuso_puxador" && !pieceTemParafusoPuxador(item, box)) {
      continue;
    }
    if (def.ferragem_id === "prego_costa") {
      continue;
    }
    if (
      JOINT_FERRAGEM_IDS.has(def.ferragem_id) &&
      !JOINT_COUNT_PIECE_TIPOS.has(pieceTipo)
    ) {
      continue;
    }
    const qtdBase =
      def.quantidade_fixa ??
      (def.quantidade_por_lado != null
        ? def.quantidade_por_lado * Math.max(1, def.aplicar_em?.length ?? 1)
        : 1);
    rows.push({
      caixa: "",
      peca,
      ferragem: ferragemLabel(def.ferragem_id, ferragemById),
      qtd: qtdBase * qtyMult,
      material,
      nQr,
      observacoes,
    });
  }
}

export function buildIndustrialFerragensForProject(
  project: IndustrialFerragensProjectInput
): ProjectIndustrialFerragens {
  const projectName = project.projectName?.trim() || "Projeto";
  const componentTypes = loadComponentTypes();
  const ferragens = sanitizeFerragensCatalog(loadFerragens());
  const ctById = Object.fromEntries(componentTypes.map((ct) => [ct.id, ct]));
  const ferragemById = new Map(ferragens.map((f) => [f.id, f]));
  const rows: IndustrialFerragemPdfRow[] = [];
  const boxes = dedupeBoxesById(project.boxes ?? []);

  const items = buildCutlistItemsForIndustrialExport({
    boxes,
    rules: project.rules,
    materialId: project.materialId,
    projectName,
    remates: project.remates ?? [],
    rodapes: project.rodapes ?? [],
    extractedPartsByBoxId: project.extractedPartsByBoxId,
  });

  const boxNomeById = Object.fromEntries(
    boxes.map((b) => [b.id, b.nome?.trim() || b.id])
  );

  for (const item of items) {
    const box = boxes.find((b) => b.id === item.boxId);
    const boxNome = boxNomeById[item.boxId ?? ""] ?? item.boxId ?? "—";
    pushPieceFerragens(
      rows,
      item,
      boxNome,
      projectName,
      ctById,
      ferragemById,
      project.pieceObservacoes,
      box
    );

    // CAVILHA_10x40 — 1 por cada furo 10×30 (par obrigatório com 10×13 na peça oposta)
    const cavilha40 = countCavilha10x40FromEdgeHoles(item.drillHoles ?? []);
    if (cavilha40 > 0) {
      const peca = resolveFullIndustrialNameForDocument(item, projectName, boxNome);
      rows.push({
        caixa: "",
        peca,
        ferragem: ferragemLabel(CAVILHA_10x40_FERRAGEM_ID, ferragemById),
        qtd: cavilha40 * Math.max(1, item.quantidade ?? 1),
        material: String(item.material ?? item.materialId ?? "—").trim() || "—",
        nQr: resolveIndustrialIdForDocument(item, projectName, boxNome),
        observacoes: formatObservacoesForPdf(
          resolveObservacoesForCutListItem(item, { pieceObservacoes: project.pieceObservacoes })
        ),
      });
    }
  }

  // Complemento box-level (pes, calcos, div/sep). Sem peça industrial — caixa vai na coluna Peça.
  for (const box of boxes) {
    const boxNome = box.nome?.trim() || box.id;
    const modelo = gerarModeloIndustrial(box, project.rules);
    for (const f of modelo.ferragens) {
      if (MODELO_TIPOS_COBERTOS_POR_PECA.has(f.tipo)) continue;
      rows.push({
        caixa: boxNome,
        peca: boxNome,
        ferragem: ferragemLabel(resolveCanonicalFerragemId(f.tipo), ferragemById),
        qtd: f.quantidade,
        material: "—",
        nQr: "—",
        observacoes: "",
      });
    }
  }

  return {
    projectName,
    projectCode: (sanitizeIndustrialSegment(projectName) || "PROJETO").toUpperCase(),
    generatedAt: new Date().toISOString(),
    rows,
  };
}
