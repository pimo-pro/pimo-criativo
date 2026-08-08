/**
 * Estrutura de settings para futura página ADMIN.
 * Defaults = constantes já em produção (A–D). Feature flags default true (comportamento actual).
 */

import { DRAWER_FRONT_LATERAL_GAP_MM } from "../drawers/drawerGeometryConstants";
import {
  GAVETA_PORTA_SEP_DEFAULT_DRAWER_HEIGHT_MM,
  GAVETA_PORTA_SEP_DOOR_GAP_MM,
} from "../productModes/gavetaPortaSepLayout";
import { HINGE_COMPENSATION_MM } from "../innerCabinet/hingeCompensation40";
import {
  INNER_CABINET_A1_DEFAULT_DRAWER_COUNT,
  INNER_CABINET_A1_DEFAULT_HEIGHT_MM,
} from "../innerCabinet/a1Geometry";
import { CX_GAV_CIMA_DEPTH_MM } from "../cxGav/cxGavGeometry";
import type { IndustrialModeId } from "./industrialModelsRegistry";
import { INDUSTRIAL_MODE_IDS } from "./industrialModelsRegistry";

export type IndustrialModeToggle = Record<IndustrialModeId, boolean>;

export type IndustrialAdminSettings = {
  /** Activar/desactivar cada modo (default: todos true). */
  modesEnabled: IndustrialModeToggle;
  alturasPadraoMm: {
    gavetaPortaSepDrawerMm: number;
    a1HeightMm: number;
    a1DefaultDrawerCount: number;
    cxGavCimaDepthMm: number;
  };
  folgasMm: {
    gavetaFrenteMm: number;
    portaMm: number;
  };
  compensacoesMm: {
    hingeSideMm: number;
  };
  materiais: {
    /** Chave material industrial por omissão (null = herda caixa). */
    bodyMaterialKeyDefault: string | null;
  };
  orla: {
    /** Se false, tipos industriais usam só regras clássicas (não usado ainda). */
    useIndustrialOrlaRegistry: boolean;
  };
  furacao: {
    /** Se false, routing industrial cai nas heurísticas clássicas (não usado ainda). */
    useIndustrialDrillRegistry: boolean;
  };
};

function buildDefaultModesEnabled(): IndustrialModeToggle {
  return Object.fromEntries(INDUSTRIAL_MODE_IDS.map((id) => [id, true])) as IndustrialModeToggle;
}

export const DEFAULT_INDUSTRIAL_ADMIN_SETTINGS: IndustrialAdminSettings = {
  modesEnabled: buildDefaultModesEnabled(),
  alturasPadraoMm: {
    gavetaPortaSepDrawerMm: GAVETA_PORTA_SEP_DEFAULT_DRAWER_HEIGHT_MM,
    a1HeightMm: INNER_CABINET_A1_DEFAULT_HEIGHT_MM,
    a1DefaultDrawerCount: INNER_CABINET_A1_DEFAULT_DRAWER_COUNT,
    cxGavCimaDepthMm: CX_GAV_CIMA_DEPTH_MM,
  },
  folgasMm: {
    gavetaFrenteMm: DRAWER_FRONT_LATERAL_GAP_MM,
    portaMm: GAVETA_PORTA_SEP_DOOR_GAP_MM,
  },
  compensacoesMm: {
    hingeSideMm: HINGE_COMPENSATION_MM,
  },
  materiais: {
    bodyMaterialKeyDefault: null,
  },
  orla: {
    useIndustrialOrlaRegistry: true,
  },
  furacao: {
    useIndustrialDrillRegistry: true,
  },
};

/** Settings em memória (futura persistência ADMIN). Não altera runtime das Fases A–D nesta fase. */
let _settings: IndustrialAdminSettings = {
  ...DEFAULT_INDUSTRIAL_ADMIN_SETTINGS,
  modesEnabled: buildDefaultModesEnabled(),
};

export function getIndustrialAdminSettings(): IndustrialAdminSettings {
  return _settings;
}

export function setIndustrialAdminSettings(next: Partial<IndustrialAdminSettings>): void {
  _settings = {
    ..._settings,
    ...next,
    modesEnabled: { ..._settings.modesEnabled, ...(next.modesEnabled ?? {}) },
    alturasPadraoMm: { ..._settings.alturasPadraoMm, ...(next.alturasPadraoMm ?? {}) },
    folgasMm: { ..._settings.folgasMm, ...(next.folgasMm ?? {}) },
    compensacoesMm: { ..._settings.compensacoesMm, ...(next.compensacoesMm ?? {}) },
    materiais: { ..._settings.materiais, ...(next.materiais ?? {}) },
    orla: { ..._settings.orla, ...(next.orla ?? {}) },
    furacao: { ..._settings.furacao, ...(next.furacao ?? {}) },
  };
}

export function resetIndustrialAdminSettings(): void {
  _settings = {
    ...DEFAULT_INDUSTRIAL_ADMIN_SETTINGS,
    modesEnabled: buildDefaultModesEnabled(),
  };
}

/**
 * Nesta fase: flags não desligam runtime (só estrutura ADMIN).
 * Sempre true para preservar comportamento A–D.
 */
export function isIndustrialModeRuntimeEnabled(_id: IndustrialModeId): boolean {
  return true;
}
