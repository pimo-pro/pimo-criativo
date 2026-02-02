/**
 * Carregador de documentação técnica para a página Info.
 * Estrutura base para futura integração com ficheiros .md.
 */

export type TechnicalDocSection =
  | "overview"
  | "rules-engine"
  | "profiles-system"
  | "manufacturing"
  | "design-3d"
  | "cutlist"
  | "pdf-export"
  | "api-interna";

export type TechnicalDocsMap = Partial<Record<TechnicalDocSection, string>>;

/** Secções disponíveis (para tabs futuras). */
export const TECHNICAL_SECTIONS: TechnicalDocSection[] = [
  "overview",
  "rules-engine",
  "profiles-system",
  "manufacturing",
  "design-3d",
  "cutlist",
  "pdf-export",
  "api-interna",
];

/**
 * Carrega toda a documentação técnica.
 * Por agora retorna objetos vazios; será preenchido futuramente.
 */
export function loadTechnicalDocs(): TechnicalDocsMap {
  return {};
}

/**
 * Retorna o conteúdo de uma secção da documentação técnica.
 * Por agora retorna placeholder; será carregado dos .md no futuro.
 */
export function getDoc(_section: TechnicalDocSection): string {
  return "";
}
