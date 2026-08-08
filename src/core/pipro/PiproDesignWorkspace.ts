/**
 * Workspace de design pipro — aplica features A–D via Unified Industrial Box Engine.
 * Consome cutlist/DRILL/orla/CNC existentes em modo leitura (sem alterar esses módulos).
 */

import type { BoxModule, CutListItemComPreco } from "../types";
import { defaultRulesConfig } from "../rules/rulesConfig";
import { cutlistComPrecoFromBox } from "../manufacturing/cutlistFromBoxes";
import { resolveXmlMachineTarget } from "../drill/xmlMachineRouting";
import { resolveOrlaSidesForPieceTipo } from "../orla/orlaIndustrialRules";
import {
  resolveActiveFeaturesForBox,
  syncUnifiedIndustrialBox,
  runIndustrialCutlistAdapters,
  UNIFIED_INDUSTRIAL_BOX_ENGINE_ID,
} from "../unifiedIndustrialBox/UnifiedIndustrialBoxEngine";
import { INDUSTRIAL_FEATURES } from "../unifiedIndustrialBox/industrialFeatures";
import type { IndustrialFeatureId } from "../unifiedIndustrialBox/types";
import { calcularPrecoCutList } from "../pricing/pricing";
import { resolveIndustrialMaterialKey } from "../materials/service";
import {
  type PiproDimensionsMm,
  type PiproGapsMm,
  type PiproModelRecord,
  type PiproPieceKind,
  type PiproPieceSnapshot,
  PIPRO_MODEL_PREFIX,
} from "./piproDesignTypes";
import { savePiproModel, isPiproModelId } from "./piproModelsRegistry";

export type PiproDesignState = {
  nome: string;
  dimensions: PiproDimensionsMm;
  bodyMaterialId: string;
  gaps: PiproGapsMm;
  featureIds: IndustrialFeatureId[];
  extraPieceKinds: string[];
  /** Motor unificado activo (sync + adapters). */
  engineEnabled: boolean;
};

const DEFAULT_STATE: PiproDesignState = {
  nome: "Modelo pipro vazio",
  dimensions: { largura: 600, altura: 720, profundidade: 560, espessura: 19 },
  bodyMaterialId: "mdf_branco",
  gaps: { gavetaFrenteMm: 2, portaMm: 2 },
  featureIds: [],
  extraPieceKinds: [],
  engineEnabled: true,
};

export function buildPiproBaseCabinetId(featureIds: IndustrialFeatureId[]): string {
  const tokens = featureIds.length > 0 ? featureIds.join("__") : "base";
  return `pipro_unified_box__${tokens}`;
}

function toBoxModule(state: PiproDesignState): BoxModule {
  const ids = state.featureIds;
  const hasGps = ids.some((id) => String(id).includes("gaveta_porta_sep"));
  const hasA1 = ids.some((id) => String(id).includes("inner_cabinet_a1"));
  const hasWardrobe = ids.some((id) => String(id).includes("wardrobe_sep_parcial"));
  const hasGaveta = hasGps || hasA1 || hasWardrobe;
  const hasPorta = hasGps || state.extraPieceKinds.includes("porta");

  return {
    id: "pipro-design-box",
    nome: state.nome,
    dimensoes: {
      largura: state.dimensions.largura,
      altura: state.dimensions.altura,
      profundidade: state.dimensions.profundidade,
    },
    espessura: state.dimensions.espessura,
    tipoBorda: "reta",
    tipoFundo: "integrado",
    models: [],
    baseCabinetId: buildPiproBaseCabinetId(state.featureIds),
    portaTipo: hasPorta ? "porta_simples" : "sem_porta",
    gavetas: hasGaveta ? (hasA1 ? 2 : 1) : 0,
    alturaGaveta: hasA1 ? 400 : hasGps ? 180 : 0,
    prateleiras: hasGps ? 2 : 0,
    costaAtiva: true,
    doorsLayer: hasPorta
      ? [
          {
            id: "pipro-door-1",
            parentBoxId: "pipro-design-box",
            groupType: "simples",
            width: Math.max(80, state.dimensions.largura - 4),
            height: Math.max(120, state.dimensions.altura - 4),
            thickness: state.dimensions.espessura,
            materialId: state.bodyMaterialId,
            openDirection: "left",
            isOpen: false,
            hingeSide: "left",
            pivot: "left-edge",
            posX: 0,
            posY: 0,
            posZ: 0,
            rotY: 0,
          },
        ]
      : [],
    drawersLayer: [],
    divisores: [],
    separadores: [],
    cutList: [],
    cutListComPreco: [],
    ferragens: [],
    precoTotalPecas: 0,
    estrutura3D: null,
  } as BoxModule;
}

function mapTipoToKind(tipo: string): PiproPieceKind {
  const t = String(tipo).toLowerCase();
  if (t.includes("lat_dir") || t.includes("lateral_direita")) return "lat_dir";
  if (t.includes("lat_esq") || t.includes("lateral_esquerda")) return "lat_esq";
  if (t.includes("fundo") || t.endsWith("_fun") || t.includes("cx_gav_fun")) return "fun";
  if (t.includes("cima")) return "cima";
  if (t.includes("porta")) return "porta";
  if (t.includes("frente")) return "frente";
  if (t.includes("costa") || t.includes("traseira")) return "costa";
  if (t.includes("sep") || t.includes("separador")) return "sep";
  if (t.includes("div")) return "div";
  if (t.includes("gav")) return "gaveta";
  return "frente";
}

export class PiproDesignWorkspace {
  state: PiproDesignState = {
    ...DEFAULT_STATE,
    dimensions: { ...DEFAULT_STATE.dimensions },
    gaps: { ...DEFAULT_STATE.gaps },
    featureIds: [],
    extraPieceKinds: [],
  };
  cutlist: CutListItemComPreco[] = [];
  pieces: PiproPieceSnapshot[] = [];
  activeFeatureIds: IndustrialFeatureId[] = [];
  engineId = UNIFIED_INDUSTRIAL_BOX_ENGINE_ID;
  /** Id persistido ao editar um modelo existente (`pipro-model-…`). */
  modelId: string | null = null;
  createdAtIso: string | null = null;

  createBaseBox(partial?: Partial<PiproDesignState>): void {
    this.modelId = null;
    this.createdAtIso = null;
    this.state = {
      ...DEFAULT_STATE,
      ...partial,
      dimensions: { ...DEFAULT_STATE.dimensions, ...partial?.dimensions },
      gaps: { ...DEFAULT_STATE.gaps, ...partial?.gaps },
      featureIds: partial?.featureIds ? [...partial.featureIds] : [],
      extraPieceKinds: partial?.extraPieceKinds ? [...partial.extraPieceKinds] : [],
      engineEnabled: partial?.engineEnabled ?? true,
    };
    this.rebuild();
  }

  /** Carrega modelo guardado (edição no Workspace via `?id=`). */
  loadFromRecord(record: PiproModelRecord): void {
    this.modelId = record.id;
    this.createdAtIso = record.createdAt;
    this.state = {
      ...DEFAULT_STATE,
      nome: record.nome,
      dimensions: { ...record.dimensions },
      bodyMaterialId: record.materials.bodyMaterialId,
      gaps: { ...record.gaps },
      featureIds: [...record.featureIds],
      extraPieceKinds: [],
      engineEnabled: true,
    };
    this.rebuild();
  }

  setEngineEnabled(enabled: boolean): void {
    this.state.engineEnabled = enabled;
    this.rebuild();
  }

  setDimensions(d: Partial<PiproDimensionsMm>): void {
    this.state.dimensions = { ...this.state.dimensions, ...d };
    this.rebuild();
  }

  setMaterials(bodyMaterialId: string): void {
    this.state.bodyMaterialId = bodyMaterialId;
    this.rebuild();
  }

  setGaps(g: Partial<PiproGapsMm>): void {
    this.state.gaps = { ...this.state.gaps, ...g };
    this.rebuild();
  }

  setFeatures(featureIds: IndustrialFeatureId[]): void {
    const allowed = new Set(INDUSTRIAL_FEATURES.map((f) => f.id));
    this.state.featureIds = featureIds.filter((id) => allowed.has(id));
    this.rebuild();
  }

  addPiece(kind: string): void {
    if (!this.state.extraPieceKinds.includes(kind)) {
      this.state.extraPieceKinds = [...this.state.extraPieceKinds, kind];
    }
    this.rebuild();
  }

  rebuild(): void {
    let box = toBoxModule(this.state);
    this.activeFeatureIds = resolveActiveFeaturesForBox(box).map((f) => f.id);

    if (this.state.engineEnabled) {
      box = syncUnifiedIndustrialBox(box);
    }

    this.cutlist = cutlistComPrecoFromBox(box, defaultRulesConfig);

    if (this.state.engineEnabled) {
      runIndustrialCutlistAdapters({
        syncedBox: box,
        items: this.cutlist,
        baseItem: {},
        bodyMaterialKey: this.state.bodyMaterialId,
        material: this.state.bodyMaterialId,
        visualMaterial: undefined,
        boxName: this.state.nome,
        priceRaw: calcularPrecoCutList,
        resolveMaterialId: (id, fallback) => resolveIndustrialMaterialKey(id, fallback),
      });
    }

    this.pieces = this.cutlist.map((item) => ({
      id: item.id,
      kind: mapTipoToKind(String(item.tipo)),
      tipo: String(item.tipo),
      nome: item.nome,
      dimensoes: { ...item.dimensoes },
      espessura: item.espessura,
      materialId: item.materialId,
      drillHoles: item.drillHoles,
      orlaSides: resolveOrlaSidesForPieceTipo(String(item.tipo)),
      machineTarget: resolveXmlMachineTarget(item),
      industrialLabel:
        typeof item.metadata?.industrialLabel === "string"
          ? item.metadata.industrialLabel
          : undefined,
    }));
  }

  getRuleIds(): string[] {
    return resolveActiveFeaturesForBox(toBoxModule(this.state)).flatMap((f) => [...f.ruleIds]);
  }

  getIndustrialSummary() {
    return {
      engineId: this.engineId,
      engineEnabled: this.state.engineEnabled,
      activeFeatureIds: this.activeFeatureIds,
      ruleIds: this.getRuleIds(),
      cutlistCount: this.cutlist.length,
      pieceCount: this.pieces.length,
      drillPieceCount: this.pieces.filter((p) => p.machineTarget === "drill").length,
      cncPieceCount: this.pieces.filter((p) => p.machineTarget === "cnc").length,
      orlaPieceCount: this.pieces.filter((p) => (p.orlaSides?.length ?? 0) > 0).length,
      industrialLabels: this.pieces
        .map((p) => p.industrialLabel)
        .filter((x): x is string => Boolean(x)),
      holeCount: this.pieces.reduce((n, p) => n + (p.drillHoles?.length ?? 0), 0),
    };
  }

  /** Dados industriais completos para o painel direito do Workspace. */
  getIndustrialPanelData() {
    const summary = this.getIndustrialSummary();
    const model = this.toPiproModel();
    return {
      modelo: {
        nome: this.state.nome,
        engineEnabled: this.state.engineEnabled,
        engineId: this.engineId,
        baseCabinetId: model.metadata.baseCabinetId,
        featureIds: [...this.state.featureIds],
        dimensions: { ...this.state.dimensions },
        materials: { bodyMaterialId: this.state.bodyMaterialId },
        gaps: { ...this.state.gaps },
      },
      summary,
      cutlist: this.cutlist.map((i) => ({
        id: i.id,
        tipo: i.tipo,
        nome: i.nome,
        dimensoes: i.dimensoes,
        espessura: i.espessura,
        materialId: i.materialId,
        industrialLabel:
          typeof i.metadata?.industrialLabel === "string" ? i.metadata.industrialLabel : undefined,
        metadata: i.metadata ?? null,
      })),
      tecnico: this.pieces.map((p) => ({
        id: p.id,
        tipo: p.tipo,
        nome: p.nome,
        kind: p.kind,
        dims: `${Math.round(p.dimensoes.largura)}×${Math.round(p.dimensoes.altura)}×${Math.round(p.espessura)}`,
        label: p.industrialLabel ?? null,
      })),
      drill: this.pieces
        .filter((p) => p.machineTarget === "drill" || (p.drillHoles?.length ?? 0) > 0)
        .map((p) => ({
          id: p.id,
          tipo: p.tipo,
          holes: p.drillHoles ?? [],
        })),
      cnc: this.pieces
        .filter((p) => p.machineTarget === "cnc")
        .map((p) => ({ id: p.id, tipo: p.tipo, nome: p.nome })),
      orla: this.pieces
        .filter((p) => (p.orlaSides?.length ?? 0) > 0)
        .map((p) => ({ id: p.id, tipo: p.tipo, sides: p.orlaSides ?? [] })),
      pecasIndustriais: this.pieces,
      labelsIndustriais: summary.industrialLabels,
      metadata: model.metadata,
    };
  }

  toPiproModel(): PiproModelRecord {
    const now = new Date().toISOString();
    return {
      id:
        this.modelId && isPiproModelId(this.modelId)
          ? this.modelId
          : `${PIPRO_MODEL_PREFIX}${crypto.randomUUID()}`,
      nome: this.state.nome,
      createdAt: this.createdAtIso || now,
      updatedAt: now,
      dimensions: { ...this.state.dimensions },
      materials: { bodyMaterialId: this.state.bodyMaterialId },
      gaps: { ...this.state.gaps },
      featureIds: [...this.state.featureIds],
      ruleIds: this.getRuleIds(),
      pieces: this.pieces,
      cutlist: this.cutlist,
      metadata: {
        engine: "unified_industrial_box_engine",
        baseCabinetId: buildPiproBaseCabinetId(this.state.featureIds),
        industrialLabels: this.pieces
          .map((p) => p.industrialLabel)
          .filter((x): x is string => Boolean(x)),
      },
    };
  }

  save(): PiproModelRecord {
    const saved = savePiproModel(this.toPiproModel());
    this.modelId = saved.id;
    this.createdAtIso = saved.createdAt;
    return saved;
  }
}
