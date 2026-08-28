import { FERRAGENS_DEFAULT, type Ferragem } from "../core/ferragens/ferragens";
import { sanitizeFerragensCatalog } from "../core/ferragens/ferragensCatalogSanitize";
import { useMemo } from "react";
import { useStorageList } from "./useStorageList";

const STORAGE_KEY = "pimo_ferragens";

function validateFerragens(value: unknown): value is Ferragem[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as Ferragem).id === "string" &&
      typeof (item as Ferragem).nome === "string" &&
      ((item as Ferragem).precoUnitario === undefined ||
        typeof (item as Ferragem).precoUnitario === "number") &&
      ["parafuso", "cavilha", "dobradica", "corredica", "suporte", "prego", "acessorio", "puxa"].includes(
        (item as Ferragem).categoria
      )
  );
}

export const useFerragens = () => {
  const { items, setItems, reload } = useStorageList<Ferragem>({
    storageKey: STORAGE_KEY,
    defaultValue: FERRAGENS_DEFAULT,
    validate: validateFerragens,
  });

  const ferragens = useMemo(() => sanitizeFerragensCatalog(items), [items]);

  return { ferragens, setFerragens: setItems, reload };
};
