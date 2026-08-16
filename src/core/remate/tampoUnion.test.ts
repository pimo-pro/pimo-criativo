import { describe, expect, it } from "vitest";
import {
  createTampoUnion,
  normalizeTampoUnion,
  serializeTampoUnionForCutlist,
  TAMPO_UNION_OVERLAP_DEFAULT_MM,
  TAMPO_UNION_OVERLAP_MAX_MM,
  TAMPO_UNION_OVERLAP_MIN_MM,
  validateTampoUnion,
} from "./tampoUnion";

const host = { id: "tampo-a", productType: "TAMPO_COZINHA" as const, tipo: "TAMPO" as const };
const target = { id: "tampo-b", productType: "TAMPO_COZINHA" as const, tipo: "TAMPO" as const };

describe("TAMPO Fase 4 — união industrial", () => {
  it("união 8 mm (default) → ok", () => {
    const u = createTampoUnion({ targetTampoId: target.id, direction: "LEFT" });
    expect(u.overlapMm).toBe(TAMPO_UNION_OVERLAP_DEFAULT_MM);
    expect(validateTampoUnion(u, host, target).ok).toBe(true);
  });

  it("união 5 mm → ok", () => {
    const u = createTampoUnion({
      targetTampoId: target.id,
      direction: "RIGHT",
      overlapMm: TAMPO_UNION_OVERLAP_MIN_MM,
    });
    expect(validateTampoUnion(u, host, target).ok).toBe(true);
  });

  it("união 10 mm → ok", () => {
    const u = createTampoUnion({
      targetTampoId: target.id,
      direction: "FRONT",
      overlapMm: TAMPO_UNION_OVERLAP_MAX_MM,
    });
    expect(validateTampoUnion(u, host, target).ok).toBe(true);
  });

  it("união fora dos limites → erro", () => {
    expect(
      validateTampoUnion(
        createTampoUnion({ targetTampoId: target.id, direction: "LEFT", overlapMm: 4 }),
        host,
        target
      ).ok
    ).toBe(false);
    expect(
      validateTampoUnion(
        createTampoUnion({ targetTampoId: target.id, direction: "LEFT", overlapMm: 11 }),
        host,
        target
      ).ok
    ).toBe(false);
  });

  it("tampo alvo inexistente → erro", () => {
    const u = createTampoUnion({ targetTampoId: "missing", direction: "BACK" });
    const v = validateTampoUnion(u, host, null);
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.includes("inexistente"))).toBe(true);
  });

  it("alvo não-TAMPO → erro", () => {
    const u = createTampoUnion({ targetTampoId: "r1", direction: "LEFT" });
    const v = validateTampoUnion(u, host, {
      id: "r1",
      productType: "AVISTA",
      tipo: "FRENTE",
    });
    expect(v.ok).toBe(false);
  });

  it("self-target → erro", () => {
    const u = createTampoUnion({ targetTampoId: host.id, direction: "LEFT" });
    const v = validateTampoUnion(u, host, host);
    expect(v.ok).toBe(false);
  });

  it("host não-TAMPO → erro", () => {
    const u = createTampoUnion({ targetTampoId: target.id, direction: "LEFT" });
    const v = validateTampoUnion(u, { id: "x", productType: "AVISTA", tipo: "FRENTE" }, target);
    expect(v.ok).toBe(false);
  });

  it("union null → ok (sem união)", () => {
    expect(validateTampoUnion(null, host, target).ok).toBe(true);
  });

  it("serializeTampoUnionForCutlist shape", () => {
    const u = normalizeTampoUnion(
      createTampoUnion({ targetTampoId: "tampo-b", direction: "FRONT", overlapMm: 8 })
    );
    expect(serializeTampoUnionForCutlist(u)).toEqual({
      overlapMm: 8,
      direction: "FRONT",
      target: "tampo-b",
    });
    expect(serializeTampoUnionForCutlist(null)).toBeUndefined();
  });
});
