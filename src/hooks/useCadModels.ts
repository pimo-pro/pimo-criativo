import { listaInicialDeModelos, type CadModel } from "../core/cad/cadModels";
import { useStoredList } from "./useStoredList";

const STORAGE_KEY = "pimo_admin_cad_models";

export const useCadModels = () => {
  const { items, setItems, reload } = useStoredList<CadModel>({
    storageKey: STORAGE_KEY,
    defaultValue: listaInicialDeModelos,
  });

  return { models: items, setModels: setItems, reload };
};
