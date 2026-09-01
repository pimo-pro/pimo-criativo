import { useCallback, useState } from "react";
import {
  loadPesPlasticoConfig,
  savePesPlasticoConfig,
  type PesPlasticoConfig,
  PES_PLASTICO_CONFIG_DEFAULT,
} from "../core/ferragens/pesPlasticoConfig";

export function usePesPlasticoConfig() {
  const [config, setConfigState] = useState<PesPlasticoConfig>(() => loadPesPlasticoConfig());

  const reload = useCallback(() => {
    setConfigState(loadPesPlasticoConfig());
  }, []);

  const setConfig = useCallback((next: PesPlasticoConfig | ((prev: PesPlasticoConfig) => PesPlasticoConfig)) => {
    setConfigState((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      savePesPlasticoConfig(resolved);
      return { ...resolved };
    });
  }, []);

  const resetToDefault = useCallback(() => {
    setConfig({ ...PES_PLASTICO_CONFIG_DEFAULT });
  }, [setConfig]);

  return { config, setConfig, reload, resetToDefault };
}
