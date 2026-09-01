import { useEffect, useRef, useState } from "react";
import {
  applyMateriaisSsotFromPublicUrl,
  type MateriaisSsotApplyResult,
} from "../../core/catalog/materiaisSsotApply";

/**
 * Carrega e aplica o Excel SSOT (`/config/materiais-ssot.xlsx`) uma vez por sessão.
 * Apenas UI (CRUD / ferragens / orla / agrupamento) — sem pipeline industrial.
 */
export function useMateriaisSsotBootstrap(enabled = true): {
  status: "idle" | "loading" | "ok" | "error";
  result: MateriaisSsotApplyResult | null;
} {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">(() =>
    enabled ? "loading" : "idle",
  );
  const [result, setResult] = useState<MateriaisSsotApplyResult | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!enabled || started.current) return;
    started.current = true;
    void applyMateriaisSsotFromPublicUrl()
      .then((res) => {
        setResult(res);
        setStatus(res.ok ? "ok" : "error");
      })
      .catch((err) => {
        setResult({
          ok: false,
          chapasResolved: 0,
          chapasComIndustrial: 0,
          materialsUpdated: 0,
          materialsCreated: 0,
          freeagensUpdated: 0,
          orlaUpdated: 0,
          error: err instanceof Error ? err.message : String(err),
        });
        setStatus("error");
      });
  }, [enabled]);

  return { status, result };
}
