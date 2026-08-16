import type { FinishTransform } from "../kitchenFinish/finishTypes";
import type { TampoCutout } from "./tampoCutouts";
import type { TampoUnion } from "./tampoUnion";

export type RemateProductType =
  | "AVISTA"
  | "COMPLETO"
  | "L"
  | "RODAPE"
  | "RODAPE_L"
  | "TAMPO_COZINHA";

export type RematePartRole = "MAIN" | "TOP" | "BOTTOM";

/** Regras de cálculo automático de dimensões para Remate Completo. */
export type RemateCompletoRules = {
  /** +Xmm de largura se há porta (encostar à porta). */
  doorFlushEnabled: boolean;
  doorFlushMm: number;
  /** Extensão extra para a traseira do módulo (mm). */
  backExtraMm: number;
  /** Extensão extra para o topo (alinhamento com remate cima) (mm). */
  topExtraMm: number;
  /** Extensão extra para o fundo (paralelo com porta/gaveta/remate lat) (mm). */
  bottomExtraMm: number;
  /** Adiciona altura extra quando o módulo está próximo do chão (+pés) (mm). */
  floorProxEnabled: boolean;
  floorProxMm: number;
  /** Limite máximo de excesso em relação ao módulo (mm). */
  maxOverBoxMm: number;
};

export type RemateProductOptions = {
  avistaWidthMm?: number;
  avistaFlushDepthMm?: number;
  avistaFlushToDoor?: boolean;
  coverageExtraMm?: number;
  includeTopBottomRemates?: boolean;
  asPuxador?: boolean;
  lGapMaxMm?: number;
  /** Regras de dimensão automática para tipo COMPLETO. */
  completoRules?: RemateCompletoRules;
};

export type RematePieceTipo =
  | "FRENTE"
  | "DIR"
  | "ESQ"
  | "CIMA"
  | "BAIXO"
  | "L"
  | "RODAPE"
  | "RODAPE_L"
  | "TAMPO";

export type RemateMountSlot = "FRENTE" | "TRAS" | "DIR" | "ESQ" | "CIMA" | "FUNDO";

export type RematePlacementMode = "SNAPPED" | "FREE";

export type RemateFaceOffsets = {
  offsetAlongNormalMm: number;
  offsetTangentUMm: number;
  offsetTangentVMm: number;
  rotationSnapIndex?: 0 | 1 | 2 | 3;
};

export type RematePiecePosition = {
  xMm: number;
  yMm: number;
  zMm: number;
};

export type RematePieceRotation = {
  xRad: number;
  yRad: number;
  zRad: number;
};

/** Remate 2.0 — peça independente manipulável no viewer e na produção. */
export type RematePiece = {
  id: string;
  parentBoxId?: string;
  productType?: RemateProductType;
  productOptions?: RemateProductOptions;
  partRole?: RematePartRole;
  tipo: RematePieceTipo;
  /** Slot de montagem; derivado de `tipo` se omitido. */
  mountSlot?: RemateMountSlot;
  /** SNAPPED = regra de montagem; FREE = editado pelo gizmo. */
  placementMode?: RematePlacementMode;
  /** Offsets relativos à face (normal + tangentes). */
  faceOffsets?: RemateFaceOffsets;
  /** true = apenas na criação; sync/load/design usam transform guardado. */
  isInitialPlacement?: boolean;
  /** Transform absoluto local à caixa (mm + rad) — espelho de position/rotation. */
  transform?: FinishTransform;
  width: number;
  height: number;
  depth: number;
  materialPresetId: string;
  position: RematePiecePosition;
  rotation: RematePieceRotation;
  /** Acompanha transform do módulo preservando offsets à face. */
  followBox: boolean;
  name: string;
  /** Nome editável pelo utilizador; substitui o rótulo industrial na UI e cutlist. */
  nomePersonalizado?: string;
  /** Agrupa peças L / RODAPE_L / Completo multi-peça. */
  parentGroupId?: string;
  partIndex?: 1 | 2;
  /** false = veio fixo no nesting; true = permite rodar mesmo com material de madeira. */
  allowPieceRotation?: boolean;
  /** true = manter veio da madeira (proibir rotação no nesting). Auto em material de madeira. */
  lockWoodGrain?: boolean;
  /** true = medidas editadas manualmente; nunca sobrescrever por recalc/resnap/migração. */
  userDimensionsLocked?: boolean;
  /**
   * false = oculto na UI e excluído da cutlist/custos (como rodapes.visible).
   * undefined / true = incluído.
   */
  visible?: boolean;
  /** Recortes do TAMPO (fogão/pia/retangular/circular). Só relevante para TAMPO_COZINHA. */
  cutouts?: TampoCutout[];
  /** União: este tampo (A) recebe encaixe do targetTampoId (B). null = sem união. */
  union?: TampoUnion | null;
};

export type CreateRematePieceInput = {
  productType: RemateProductType;
  mountSlot?: RemateMountSlot;
  productOptions?: RemateProductOptions;
  /** @deprecated — inferido de productType + mountSlot */
  tipo?: RematePieceTipo;
  parentBoxId?: string;
  materialPresetId?: string;
  width?: number;
  height?: number;
  depth?: number;
  followBox?: boolean;
  /** Posição workspace absoluta (mm) quando standalone. */
  workspacePosition?: RematePiecePosition;
};

export type UpdateRematePieceInput = Partial<
  Pick<
    RematePiece,
    | "productType"
    | "productOptions"
    | "partRole"
    | "tipo"
    | "parentBoxId"
    | "mountSlot"
    | "placementMode"
    | "faceOffsets"
    | "width"
    | "height"
    | "depth"
    | "materialPresetId"
    | "position"
    | "rotation"
    | "followBox"
    | "name"
    | "nomePersonalizado"
    | "allowPieceRotation"
    | "lockWoodGrain"
    | "userDimensionsLocked"
    | "isInitialPlacement"
    | "transform"
    | "visible"
    | "cutouts"
    | "union"
  >
>;

export const REMATE_PRODUCT_TYPE_LABELS: Record<RemateProductType, string> = {
  AVISTA: "Remate Avista (10 cm)",
  COMPLETO: "Remate Completo (coplito)",
  L: "Remate L",
  RODAPE: "Rodapé",
  RODAPE_L: "Rodapé L",
  TAMPO_COZINHA: "Tampo / Remate Especial",
};

export const REMATE_MOUNT_SLOT_LABELS: Record<RemateMountSlot, string> = {
  FRENTE: "Face frontal",
  TRAS: "Face traseira",
  DIR: "Lateral direita",
  ESQ: "Lateral esquerda",
  CIMA: "Cima",
  FUNDO: "Fundo",
};

export const REMATE_PIECE_TIPO_LABELS: Record<RematePieceTipo, string> = {
  FRENTE: "Remate Frontal",
  DIR: "Remate Direito",
  ESQ: "Remate Esquerdo",
  CIMA: "Remate Cima",
  BAIXO: "Remate Baixo",
  L: "Remate L",
  RODAPE: "Rodapé",
  RODAPE_L: "Rodapé L",
  TAMPO: "Tampo Cozinha",
};

export function isMultiPartRemateProduct(productType: RemateProductType): boolean {
  return productType === "L" || productType === "RODAPE_L";
}

/** @deprecated Preferir isMultiPartRemateProduct */
export function isMultiPartRemateTipo(tipo: RematePieceTipo): boolean {
  return tipo === "L" || tipo === "RODAPE_L";
}
