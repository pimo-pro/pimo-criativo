import { MATERIAIS_INDUSTRIAIS, type MaterialIndustrial } from "../core/manufacturing/materials";
import { useStoredList } from "./useStoredList";

const STORAGE_KEY = "pimo_admin_materials";

export const useMaterials = () => {
  const { items, setItems, reload } = useStoredList<MaterialIndustrial>({
    storageKey: STORAGE_KEY,
    defaultValue: MATERIAIS_INDUSTRIAIS,
    validate: (value): value is MaterialIndustrial[] =>
      Array.isArray(value) && value.length > 0,
  });

  return { materials: items, setMaterials: setItems, reload };
};
