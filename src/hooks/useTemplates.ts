import { listaInicialDeTemplates, type TemplateItem } from "../core/templates/templates";
import { useStoredList } from "./useStoredList";

const STORAGE_KEY = "pimo_admin_templates";

export const useTemplates = () => {
  const { items, setItems, reload } = useStoredList<TemplateItem>({
    storageKey: STORAGE_KEY,
    defaultValue: listaInicialDeTemplates,
  });

  return { templates: items, setTemplates: setItems, reload };
};
