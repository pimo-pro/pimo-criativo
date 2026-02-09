import type { BoxPanelIds } from "../types";

/** Gera um ID único estável (UUID-like). */
export function createStableId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Cria BoxPanelIds com IDs únicos para a estrutura fixa e arrays com tamanho suficiente
 * para prateleiras, portas e gavetas. Só gera novos IDs para slots que ainda não existem.
 */
export function ensureBoxPanelIds(
  current: Partial<BoxPanelIds> | null | undefined,
  options: {
    prateleiras: number;
    portaTipo: "sem_porta" | "porta_simples" | "porta_dupla" | "porta_correr";
    gavetas: number;
  }
): BoxPanelIds {
  const numPortas = options.portaTipo === "sem_porta" ? 0 : options.portaTipo === "porta_dupla" ? 2 : 1;
  const nPrateleiras = Math.max(0, Math.floor(options.prateleiras));
  const nGavetas = Math.max(0, Math.floor(options.gavetas));

  const prateleiras = [...(current?.prateleiras ?? [])];
  while (prateleiras.length < nPrateleiras) prateleiras.push(createStableId());

  const portas = [...(current?.portas ?? [])];
  while (portas.length < numPortas) portas.push(createStableId());

  const gavetas = [...(current?.gavetas ?? [])];
  while (gavetas.length < nGavetas) gavetas.push(createStableId());

  return {
    cima: current?.cima ?? createStableId(),
    fundo: current?.fundo ?? createStableId(),
    lateral_esquerda: current?.lateral_esquerda ?? createStableId(),
    lateral_direita: current?.lateral_direita ?? createStableId(),
    costa: current?.costa ?? createStableId(),
    prateleiras: prateleiras.slice(0, nPrateleiras),
    portas: portas.slice(0, numPortas),
    gavetas: gavetas.slice(0, nGavetas),
  };
}
