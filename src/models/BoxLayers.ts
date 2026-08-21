export type LayerOpenDirection = "left" | "right" | "up" | "down" | "pull";
import type { DrawerHandlePosition, DrawerHandleType, DrawerMetalBoxType, DrawerSlideType } from "../core/settings/settingsSchema";

/**
 * Modelo unificado de porta (fonte de verdade para estado e UI).
 * Usado por: ProjectProvider (estado), Configuração de Regras → Regras da Porta, painéis de layers.
 * A camada de visualização (BoxBuilder) converte para DoorSpec (metros) para o Three.js.
 */
export interface DoorLayerItem {
  id: string;
  parentBoxId: string;
  groupType?: "simples" | "dupla";
  width: number;
  height: number;
  thickness: number;
  materialId?: string;
  /** ID canónico do material oficial (mesmo do módulo). Ex.: "mdf_branco", "carvalho". Valor padrão: getDefaultOfficialMaterial().canonicalId. */
  material?: string;
  openDirection: Exclude<LayerOpenDirection, "pull">;
  isOpen: boolean;
  hingeSide: "left" | "right" | "top" | "bottom";
  pivot: "left-edge" | "right-edge" | "top-edge" | "bottom-edge";
  posX: number;
  posY: number;
  posZ: number;
  rotY: number;
  /** Dimensões editadas manualmente na UI — preservadas na regeneração de camadas. */
  manualDimensions?: boolean;
  /** Origem do ajuste vertical (+/− mm na altura): topo ou base fixos. */
  verticalAdjustOrigin?: "top" | "bottom";
  /** false = veio fixo no nesting; true = permite rodar mesmo com material de madeira. */
  allowPieceRotation?: boolean;
  /** true = manter veio da madeira (proibir rotação no nesting). Auto em material de madeira. */
  lockWoodGrain?: boolean;
  /** Viewer: animação outward do Canto — Direita (Inferior) v2. */
  cornerDireitaV2Viewer?: boolean;
  /** Orientação canto v2 — sincronizada com WorkspaceBox.orientation. */
  cornerOrientation?: "direita" | "esquerda";
  /** Pivot animação na linha FF + folga (mm). Só canto v2. */
  viewerHingePivotXMm?: number;
}

export type DrawerLayerMetadata = {
  nominalDepth?: number;
  frontMaterial?: string;
  slideType?: DrawerSlideType;
  metalBoxType?: DrawerMetalBoxType;
  softClose?: boolean;
  handleType?: DrawerHandleType;
  handlePosition?: DrawerHandlePosition;
  handleOffsetMm?: number;
  drawerType?: "normal" | "pro";
  /** Altura só da frente (mm). Vazio = altura do corpo (drawerHeight). */
  frontHeightMm?: number;
  /** Nome industrial / cutlist da frente externa (substitui label automático). */
  frontPieceName?: string;
  /** Nome industrial da frente interna estrutural. */
  frontIntPieceName?: string;
  /** Nome industrial da frente externa decorativa. */
  frontExtPieceName?: string;
  /** Nome do grupo da gaveta (prefixo industrial + viewer). */
  drawerGroupName?: string;
  /** Perfil de puxador do catálogo (override do tipo). */
  handleProfileId?: string;
  /** Centro-centro dos furos do puxador (mm). */
  handleCenterDistanceMm?: number;
  /** Offset horizontal do puxador (mm, + = direita). */
  handleOffsetXMm?: number;
  /** Offset vertical do puxador (mm, + = para baixo). */
  handleOffsetYMm?: number;
  /** Posição percentual da altura (0–100, só com handlePosition Percentual). */
  handlePositionPercent?: number;
  /** Perfil de caixa metálica (catálogo). */
  metalBoxProfileId?: string;
  /** Altura nominal da caixa metálica (mm, lista do catálogo). */
  metalBoxHeightMm?: number;
  /** Profundidade externa do módulo (mm) — referência flush da frente no 3D. */
  profundidadeUtilMm?: number;
  /** Modelo B: id do sistema europeu. */
  europeanSystemId?: string;
  /** Modelo B: marca o layer como gerado pelo Sistema Europeu. */
  modeloB?: boolean;
  /**
   * Origem das ferragens: `global` após aplicar Ferragens globais;
   * `individual` após edição manual (prioridade até novo apply global).
   */
  hardwareSource?: "global" | "individual";
  /** Elevação da base dos laterais acima da base do módulo (mm). */
  sideBaseElevationMm?: number;
  /** Modo de altura do stack (ex.: Progressivas) — usado nas guias do módulo. */
  heightMode?: string;
  /** Product mode GPS (gaveta + porta + SEP). */
  gavetaPortaSep?: boolean;
  /** GPS embutido: base da frente relativa ao floorTop (mm; tipicamente +folga na zona). */
  drawerFrontBottomFromFloorTopMm?: number;
};

export interface DrawerLayerItem {
  id: string;
  parentBoxId: string;
  type?: "normal" | "pro";
  drawerType?: "normal" | "pro";
  sideMaterial?: "wood" | "aluminum";
  handleType?: DrawerHandleType;
  handlePosition?: DrawerHandlePosition;
  handleOffsetMm?: number;
  slideType?: DrawerSlideType;
  metalBoxType?: DrawerMetalBoxType;
  softClose?: boolean;
  capacityKg?: 30 | 40 | 50 | 70;
  drawerWarnings?: string[];
  bottomThickness?: number;
  sideThickness?: number;
  backThickness?: number;
  // Dimensões da FRENTE (cobre toda a abertura do box)
  width: number;
  height: number;
  depth: number;
  frontThickness: number;
  frontIntWidth?: number;
  frontIntHeight?: number;
  frontIntThickness?: number;
  // Dimensões do CORPO (interno, com folgas para corrediças)
  bodyWidth?: number;
  bodyHeight?: number;
  bodyDepth?: number;
  /** Centro vertical do corpo (laterais/costa) relativamente à frente. */
  bodyCenterOffsetY?: number;
  // Dimensões das peças individuais (calculadas automaticamente)
  leftSideWidth?: number;
  leftSideHeight?: number;
  leftSideDepth?: number;
  rightSideWidth?: number;
  rightSideHeight?: number;
  rightSideDepth?: number;
  backWidth?: number;
  backHeight?: number;
  bottomWidth?: number;
  bottomDepth?: number;
  // Posicoes locais das pecas (mm)
  frontPosX?: number;
  frontPosY?: number;
  frontPosZ?: number;
  leftSidePosX?: number;
  leftSidePosY?: number;
  leftSidePosZ?: number;
  rightSidePosX?: number;
  rightSidePosY?: number;
  rightSidePosZ?: number;
  bottomPosX?: number;
  bottomPosY?: number;
  bottomPosZ?: number;
  backPosX?: number;
  backPosY?: number;
  backPosZ?: number;
  materialId?: string;
  /** ID canónico do material oficial (mesmo do módulo). Ex.: "mdf_branco", "carvalho". Valor padrão: getDefaultOfficialMaterial().canonicalId. */
  material?: string;
  openDirection: "pull";
  isOpen: boolean;
  pullDistanceMm: number;
  posX: number;
  posY: number;
  posZ: number;
  rotY: number;
  /** Configuração UI por gaveta (FASE 4) — espelha campos editáveis sem alterar geometria. */
  metadata?: DrawerLayerMetadata;
  /** false = veio fixo no nesting; true = permite rodar mesmo com material de madeira. */
  allowPieceRotation?: boolean;
  /** true = manter veio da madeira (proibir rotação no nesting). Auto em material de madeira. */
  lockWoodGrain?: boolean;
}
