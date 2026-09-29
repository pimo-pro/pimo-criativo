/**
 * Fachada compatível das rotas PROJETOS.
 * O contrato canónico de identidade e slug pertence a core/projects.
 */
export {
  buildProjetosPagePath,
  decodeProjetosPageSlug,
  normalizeProjetosPageSlug,
  projectNameFromPageSlug,
  projetosPageSlugFromRecord,
  snapshotMatchesProjetosPageSlug,
  toProjetosPageSlug,
} from "@/core/projects/projectIdentity";
