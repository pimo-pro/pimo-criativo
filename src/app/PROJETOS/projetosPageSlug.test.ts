import { describe, expect, it } from "vitest";
import {
  buildProjetosPagePath,
  normalizeProjetosPageSlug,
  projectNameFromPageSlug,
  snapshotMatchesProjetosPageSlug,
  toProjetosPageSlug,
} from "./projetosPageSlug";
import type { SavedProjectRecord } from "@/core/projects/types";

describe("projetosPageSlug — fachada compatível", () => {
  it("usa o nome do projecto como slug", () => {
    expect(toProjetosPageSlug("NP2625622")).toBe("NP2625622");
    expect(buildProjetosPagePath({ name: "NP2625622" })).toBe("/PROJETOS/NP2625622");
  });

  it("substitui espacos por underscore", () => {
    expect(toProjetosPageSlug("Antunes Novo Cozinha")).toBe("Antunes_Novo_Cozinha");
    expect(buildProjetosPagePath({ name: "Antunes Novo Cozinha" })).toBe(
      "/PROJETOS/Antunes_Novo_Cozinha"
    );
  });

  it("normaliza URLs antigas com %20 e novas com _", () => {
    expect(normalizeProjetosPageSlug("Antunes%20Novo%20Cozinha")).toBe("Antunes_Novo_Cozinha");
    expect(normalizeProjetosPageSlug("Antunes_Novo_Cozinha")).toBe("Antunes_Novo_Cozinha");
    expect(normalizeProjetosPageSlug("Antunes Novo Cozinha")).toBe("Antunes_Novo_Cozinha");
  });

  it("recupera nome legivel a partir do slug", () => {
    expect(projectNameFromPageSlug("Antunes_Novo_Cozinha")).toBe("Antunes Novo Cozinha");
    expect(projectNameFromPageSlug("Antunes%20Novo%20Cozinha")).toBe("Antunes Novo Cozinha");
  });

  it("faz match por nome e nao por id interno", () => {
    const record = {
      id: "pimo-abc123",
      name: "Antunes Novo Cozinha",
    } as SavedProjectRecord;
    expect(snapshotMatchesProjetosPageSlug(record, "Antunes_Novo_Cozinha")).toBe(true);
    expect(snapshotMatchesProjetosPageSlug(record, "Antunes%20Novo%20Cozinha")).toBe(true);
    expect(snapshotMatchesProjetosPageSlug(record, "pimo-abc123")).toBe(false);
  });

  it("reutiliza o mesmo path ao actualizar o mesmo nome", () => {
    const pathA = buildProjetosPagePath({ name: "NP2625622" });
    const pathB = buildProjetosPagePath({ name: "NP2625622" });
    expect(pathA).toBe(pathB);
  });
});
