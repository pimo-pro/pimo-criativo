/**
 * Tipos compartilhados pelos módulos do viewer-engine (BoxManager, loader, etc.).
 * Mantém a API externa do Viewer estável.
 */

import type * as THREE from "three";
import type { LoadedWoodMaterial } from "../../materials/WoodMaterial";
import type { ViewerDrillMarkersByPanel } from "../../../core/types";

/** Entrada de uma caixa no viewer (mapa interno do BoxManager). */
export interface ViewerBoxEntry {
  mesh: THREE.Object3D;
  width: number;
  height: number;
  /**
   * Profundidade da carcaça paramétrica (m), alinhada a `carcassDepthM` / painéis; pode ser menor que `depth` (layout externo).
   */
  carcassDepth?: number;
  depth: number;
  index: number;
  cadOnly?: boolean;
  manualPosition?: boolean;
  cabinetType?: "lower" | "upper";
  pe_cm?: number;
  feetHeight?: number;
  feetOffsetFront?: number;
  feetEnabled?: boolean;
  autoRotateEnabled?: boolean;
  /** Se true, a peça não pode ser movida nem transformada (apenas selecionável). */
  locked?: boolean;
  drillMarkersByPanel?: ViewerDrillMarkersByPanel;
  cadModels: Array<{
    id: string;
    object: THREE.Object3D;
    path: string;
  }>;
  material: LoadedWoodMaterial | null;
  /** Material aplicado (viewerMaterialId); usado ao reaplicar ao trocar de modo. */
  materialName?: string;
  /**
   * Material da frente fixa (viewer/canonical id). Persistido no entry para não
   * cair no corpo quando updateBox omite `frenteFixaMaterialId`.
   */
  frenteFixaMaterialId?: string;
  /** Id do modelo base (ex.: pi-base-*); furação lateral PI sempre aplicada no mesh. */
  baseCabinetId?: string;
  /** Sem costa traseira (cavidade interna alinhada ao fundo). */
  noBackPanel?: boolean;
  /**
   * Proxy de volume L×A×P de layout: layer 31; `visible: false` no render; só visível em janelas síncronas
   * (`runWithLayoutBoundsProxiesVisible`) para bbox de câmara. Excluído de raycast/reflow/colisão/régua.
   */
  layoutBoundsMesh?: THREE.Mesh;
  /**
   * Hitbox L×A×P dedicado a picking de caixa (layer 0, invisível). Fallback quando o clique
   * não acerta geometria real de painel/porta/frente. Não é painel industrial.
   */
  pickBoundsMesh?: THREE.Mesh;
}
