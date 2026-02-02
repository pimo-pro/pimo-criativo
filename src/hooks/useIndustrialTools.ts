import { FERRAMENTAS_INDUSTRIAIS_PADRAO, type IndustrialTool } from "../core/manufacturing/materials";
import { useStorageList } from "./useStorageList";

const STORAGE_KEY = "pimo_admin_industrial_tools";

export const useIndustrialTools = () => {
  const { items, setItems, reload } = useStorageList<IndustrialTool>({
    storageKey: STORAGE_KEY,
    defaultValue: FERRAMENTAS_INDUSTRIAIS_PADRAO,
    validate: (value): value is IndustrialTool[] =>
      Array.isArray(value) && value.length >= 0,
  });

  return { tools: items, setTools: setItems, reload };
};
