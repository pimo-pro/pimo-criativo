import { COMPONENT_TYPES_DEFAULT, type ComponentType } from "../core/components/componentTypes";
import { useStorageList } from "./useStorageList";

const STORAGE_KEY = "pimo_component_types";

function validateComponentTypes(value: unknown): value is ComponentType[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as ComponentType).id === "string" &&
      typeof (item as ComponentType).nome === "string" &&
      ["estrutura", "porta", "gaveta", "acabamento"].includes((item as ComponentType).categoria) &&
      typeof (item as ComponentType).possui_lados === "boolean" &&
      Array.isArray((item as ComponentType).lados) &&
      typeof (item as ComponentType).recebe_furos === "boolean" &&
      typeof (item as ComponentType).aparece_no_cutlist === "boolean" &&
      typeof (item as ComponentType).aparece_no_pdf === "boolean"
  );
}

export const useComponentTypes = () => {
  const { items, setItems, reload } = useStorageList<ComponentType>({
    storageKey: STORAGE_KEY,
    defaultValue: COMPONENT_TYPES_DEFAULT,
    validate: validateComponentTypes,
  });

  return { componentTypes: items, setComponentTypes: setItems, reload };
};
