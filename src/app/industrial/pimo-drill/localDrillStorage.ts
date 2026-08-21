import type { IndustrialDesignBox } from '@/core/industrialDesigner';

import type {
  LocalHoleType,
  PieceModel,
  PimoDrillCustomHole,
  PimoDrillGroove,
} from './pimoDrillTypes';

const STORAGE_KEY = 'pimo_drill_state_v1';

export type PimoDrillSavedState = {
  piece: PieceModel;
  designBox: IndustrialDesignBox;
  customHoles: PimoDrillCustomHole[];
  localCatalog: LocalHoleType[];
  customGrooves: PimoDrillGroove[];
};

/**
 * Persistência isolada do simulador pimo-drill — chave própria, sem qualquer
 * ligação a core/projects (projetos reais) nem a ProjectState.
 */
export function readDrillState(): PimoDrillSavedState | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PimoDrillSavedState;
  } catch {
    return null;
  }
}

export function writeDrillState(state: PimoDrillSavedState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('[pimo-drill] Falha ao guardar estado local (storage cheio?):', err);
  }
}
