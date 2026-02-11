/**
 * FASE 3 — Materials System
 * Hooks React para listagem, detalhe, guardar e eliminar (CRUD real).
 */

import { useCallback, useState } from "react";
import type { MaterialRecord, CreateMaterialData, UpdateMaterialData } from "./types";
import {
  listMaterials,
  getMaterialByIdOrLabel,
  createMaterial,
  updateMaterial,
  deleteMaterial as deleteMaterialService,
} from "./service";
import type { MaterialsSystemState } from "./types";
import { getMaterialsState } from "./service";

/**
 * Lista de materiais com recarregamento. Consome o CRUD real (localStorage).
 * Após create/update/delete, chamar reload() para atualizar a UI.
 */
export function useMaterialsList(): {
  materials: MaterialRecord[];
  reload: () => void;
} {
  const [materials, setMaterials] = useState<MaterialRecord[]>(() => listMaterials());
  const reload = useCallback(() => {
    setMaterials(listMaterials());
  }, []);
  return { materials, reload };
}

/**
 * Obtém um material por id (leitura síncrona do serviço).
 * Reage a re-renders; após reload() da lista no parent, devolve dados atualizados.
 */
export function useMaterial(id: string | null): { material: MaterialRecord | null } {
  const material = id ? getMaterialByIdOrLabel(id) : null;
  return { material };
}

/**
 * Guardar material (criar ou atualizar). Retorna success/error; a UI deve chamar reload() após sucesso.
 */
export function useSaveMaterial(): {
  save: (
    data: CreateMaterialData | (UpdateMaterialData & { id?: string }),
    editingId: string | null
  ) => { success: true; material: MaterialRecord } | { success: false; error: string };
} {
  const save = useCallback(
    (
      data: CreateMaterialData | (UpdateMaterialData & { id?: string }),
      editingId: string | null
    ): { success: true; material: MaterialRecord } | { success: false; error: string } => {
      if (editingId) {
        const { id: _id, ...rest } = data as UpdateMaterialData & { id?: string };
        return updateMaterial(editingId, rest);
      }
      return createMaterial(data as CreateMaterialData);
    },
    []
  );
  return { save };
}

/**
 * Eliminar material por id. Retorna true se foi removido; a UI deve chamar reload() após sucesso.
 */
export function useDeleteMaterial(): {
  deleteMaterial: (id: string) => boolean;
} {
  const deleteMaterial = useCallback((id: string) => {
    return deleteMaterialService(id);
  }, []);
  return { deleteMaterial };
}

// --- Hooks existentes (mantidos para compatibilidade) ---

import { useMemo } from "react";

/**
 * Hook para estado e ações do sistema de materiais (assignments / presets).
 * @placeholder Retorno vazio/estático.
 */
export function useMaterialsSystem(): {
  state: MaterialsSystemState;
  setAssignment: (_partId: string, _presetId: string) => void;
  setCategoryPreset: (_categoryId: string, _presetId: string) => void;
  resetOverrides: () => void;
} {
  const state = useMemo(() => getMaterialsState(), []);
  const setAssignment = useCallback((_partId: string, _presetId: string) => {
    // FASE 3: implementar
  }, []);
  const setCategoryPreset = useCallback((_categoryId: string, _presetId: string) => {
    // FASE 3: implementar
  }, []);
  const resetOverrides = useCallback(() => {
    // FASE 3: implementar
  }, []);
  return { state, setAssignment, setCategoryPreset, resetOverrides };
}

/**
 * Hook para presets de uma categoria.
 * @placeholder Retorno vazio.
 */
export function useMaterialPresets(_categoryId: string | null): {
  presets: Array<{ id: string; label: string }>;
  loading: boolean;
} {
  return useMemo(() => ({ presets: [], loading: false }), []);
}
