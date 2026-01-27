import { useCallback, useEffect, useState } from "react";
import { safeGetItem, safeParseJson, safeSetItem } from "../utils/storage";

type StoredListOptions<T> = {
  storageKey: string;
  defaultValue: T[];
  validate?: (value: unknown) => value is T[];
};

const defaultValidate = <T,>(value: unknown): value is T[] => Array.isArray(value);

export const useStoredList = <T,>({
  storageKey,
  defaultValue,
  validate = defaultValidate,
}: StoredListOptions<T>) => {
  const readList = useCallback((): T[] => {
    const raw = safeGetItem(storageKey);
    const parsed = safeParseJson<unknown>(raw);
    if (validate(parsed)) return parsed;
    return defaultValue;
  }, [defaultValue, storageKey, validate]);

  const [items, setItems] = useState<T[]>(() => readList());

  const reload = useCallback(() => {
    setItems(readList());
  }, [readList]);

  useEffect(() => {
    safeSetItem(storageKey, JSON.stringify(items));
  }, [items, storageKey]);

  return { items, setItems, reload };
};
