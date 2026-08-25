import type { ProjectRodape } from "./rodapeTypes";

/** Nome exibido na UI/cutlist: personalizado ou «Rodapé». */
export function resolveRodapePieceDisplayName(
  rodape: ProjectRodape,
  autoDisplayLabel: string
): string {
  const custom = rodape.nomePersonalizado?.trim();
  if (custom) return custom;
  return autoDisplayLabel;
}

export function resolveRodapePieceNomeForRodape(
  rodape: ProjectRodape,
  _boxNameById?: ReadonlyMap<string, string> | Record<string, string>
): string {
  void _boxNameById;
  return resolveRodapePieceDisplayName(rodape, "Rodapé");
}
