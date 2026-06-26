/**
 * SGPI — ponte externa para «Gerar arquivo completo».
 * NÃO modifica useGerarArquivoHandlers nem o pipeline interno do botão.
 */
import { getCurrentProjectUser } from "../../core/projects/currentUser";
import { industrialMesApiUrl } from "../../config/industrialApp";
import { devLogger } from "../../utils/devLogger";

export type SgpiPrepareResult = {
  mode: "CREATE" | "UPDATE";
  user: string;
  project: string;
  projectDisplayName: string;
  sourceProjectId: string | null;
  targetProject: string;
};

type IndustrialProjectSlice = {
  projectName?: string;
  currentProjectId?: string | null;
};

async function prepareIndustrialExport(project: IndustrialProjectSlice): Promise<SgpiPrepareResult | null> {
  const currentUser = getCurrentProjectUser();
  const res = await fetch(industrialMesApiUrl("/sgpi/prepare"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ownerName: currentUser.ownerName,
      ownerId: currentUser.ownerId,
      projectDisplayName: project.projectName ?? "Projeto",
      sourceProjectId: project.currentProjectId ?? null,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { prepared?: SgpiPrepareResult };
  return data.prepared ?? null;
}

async function finalizeIndustrialExport(
  prepared: SgpiPrepareResult,
  sourceProjectId?: string | null
): Promise<void> {
  await fetch(industrialMesApiUrl("/sgpi/register"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prepared,
      sourceProjectId: sourceProjectId ?? prepared.sourceProjectId,
    }),
  });
}

/**
 * Envolve o handler original do botão com SGPI (antes + depois).
 * O handler interno permanece intacto.
 */
export function wrapArquivoCompletoWithSgpi(
  project: IndustrialProjectSlice,
  onArquivoCompleto: () => void | Promise<void>
): () => Promise<void> {
  return async () => {
    let prepared: SgpiPrepareResult | null = null;
    try {
      prepared = await prepareIndustrialExport(project);
    } catch (err) {
      devLogger.warn("[SGPI] prepare falhou — export continua", err);
    }

    await onArquivoCompleto();

    if (!prepared) return;
    try {
      await finalizeIndustrialExport(prepared, project.currentProjectId);
    } catch (err) {
      devLogger.warn("[SGPI] register falhou", err);
    }
  };
}
