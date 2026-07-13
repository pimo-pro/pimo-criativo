// @pimo-soon — funcionalidade incompleta, será expandida na próxima fase

import { useEffect, useRef } from "react";
import { useProject } from "../context/useProject";
import { validateAndRecordInvariants } from "../core/invariants/integration/invariantContract";
import { isIndustrialFileGenerationActive } from "../core/fabrication/industrialGenerationSuspend";

const DEBOUNCE_MS = 800;

/**
 * Bridge React: re-executa invariantes de viewer e drilling quando o projecto muda.
 * Não bloqueia o fluxo — apenas regista notificações persistentes.
 */
export function useProjectInvariants(): void {
  const { project } = useProject();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFingerprintRef = useRef<string>("");

  useEffect(() => {
    if (isIndustrialFileGenerationActive()) return;

    const fingerprint = JSON.stringify({
      boxes: project.workspaceBoxes.length,
      cutList: project.cutList?.length ?? 0,
      violations: project.ruleViolations?.length ?? 0,
      layout: project.layoutWarnings,
    });

    if (fingerprint === lastFingerprintRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      lastFingerprintRef.current = fingerprint;
      validateAndRecordInvariants({
        project,
        cutList: project.cutListComPreco ?? project.cutList,
        phase: "viewer",
      });
      validateAndRecordInvariants({
        project,
        cutList: project.cutListComPreco ?? project.cutList,
        phase: "drilling",
      });
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [project]);
}
