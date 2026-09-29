import { describe, expect, it } from "vitest";

import {
  buildProjetosPagePath,
  isInternalProjectId,
  looksLikeWorkOrderUuid,
  normalizeProjetosPageSlug,
  normalizeProjectName,
  projectNameFromPageSlug,
  PROJECT_DISPLAY_FALLBACK,
  resolveProjectDisplayNameSafe,
  toProjetosPageSlug,
} from "./projectIdentity";

describe("projectIdentity", () => {
  it("é o contrato canónico dos slugs PROJETOS", () => {
    expect(toProjetosPageSlug("Antunes Novo Cozinha")).toBe(
      "Antunes_Novo_Cozinha"
    );
    expect(normalizeProjetosPageSlug("Antunes%20Novo%20Cozinha")).toBe(
      "Antunes_Novo_Cozinha"
    );
    expect(projectNameFromPageSlug("Antunes_Novo_Cozinha")).toBe(
      "Antunes Novo Cozinha"
    );
    expect(buildProjetosPagePath({ name: "Antunes Novo Cozinha" })).toBe(
      "/PROJETOS/Antunes_Novo_Cozinha"
    );
  });

  it("normalizeProjectName ? Antunes_Novo_Cozinha", () => {
    expect(normalizeProjectName("Antunes Novo Cozinha")).toBe("Antunes_Novo_Cozinha");
  });

  it("detecta IDs internos", () => {
    expect(isInternalProjectId("pimo-00f1f73d1f0424ed")).toBe(true);
    expect(isInternalProjectId("local-123-abc")).toBe(true);
    expect(isInternalProjectId("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isInternalProjectId("Antunes_Novo_Cozinha")).toBe(false);
  });

  it("looksLikeWorkOrderUuid", () => {
    expect(looksLikeWorkOrderUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(looksLikeWorkOrderUuid("Antunes_Novo_Cozinha")).toBe(false);
  });

  it("resolveProjectDisplayNameSafe nunca devolve pimo-* sem offline", () => {
    const name = resolveProjectDisplayNameSafe("pimo-00f1f73d1f0424ed");
    expect(name).toBe(PROJECT_DISPLAY_FALLBACK);
    expect(name.startsWith("pimo")).toBe(false);
  });
});
