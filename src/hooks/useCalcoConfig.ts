import { useCallback, useState } from "react";
import {
  loadCalcoConfig,
  saveCalcoConfig,
  type CalcoConfig,
  CALCO_CONFIG_DEFAULT,
} from "../core/ferragens/calcoConfig";

export function useCalcoConfig() {
  const [config, setConfigState] = useState<CalcoConfig>(() => loadCalcoConfig());

  const reload = useCallback(() => {
    setConfigState(loadCalcoConfig());
  }, []);

  const setConfig = useCallback((next: CalcoConfig | ((prev: CalcoConfig) => CalcoConfig)) => {
    setConfigState((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      saveCalcoConfig(resolved);
      return structuredClone(resolved);
    });
  }, []);

  const resetToDefault = useCallback(() => {
    setConfig(structuredClone(CALCO_CONFIG_DEFAULT));
  }, [setConfig]);

  return { config, setConfig, reload, resetToDefault };
}
