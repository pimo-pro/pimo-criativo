import { describe, expect, it } from "vitest";
import {
  CHAPAS_REAIS_ACTIVATION_STEPS,
  CHAPAS_REAIS_ACTIVATION_WARNING,
  ORCAMENTOS_MATERIAL_COST_MODE_DEFAULT,
} from "./chapasReaisActivation";

describe("chapasReaisActivation (auditoria preços)", () => {
  it("default de fábrica é por_chapas_reais", () => {
    expect(ORCAMENTOS_MATERIAL_COST_MODE_DEFAULT).toBe("por_chapas_reais");
  });

  it("procedimento documentado (passos + aviso)", () => {
    expect(CHAPAS_REAIS_ACTIVATION_STEPS.length).toBeGreaterThanOrEqual(4);
    expect(CHAPAS_REAIS_ACTIVATION_WARNING).toMatch(/fallback|Por peça|por peça/i);
    expect(CHAPAS_REAIS_ACTIVATION_STEPS.some((s) => /Admin/i.test(s))).toBe(true);
    expect(CHAPAS_REAIS_ACTIVATION_STEPS.some((s) => /nesting|Real|sheets/i.test(s))).toBe(
      true
    );
  });
});
