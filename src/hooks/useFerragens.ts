import { FERRAGENS_DEFAULT, type Ferragem } from "../core/ferragens/ferragens";
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
      ["parafuso", "cavilha", "dobradica", "corredica", "suporte", "prego", "acessorio"].includes(
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

  return { ferragens: items, setFerragens: setItems, reload };
};
