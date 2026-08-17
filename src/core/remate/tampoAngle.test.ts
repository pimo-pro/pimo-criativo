import { describe, expect, it } from "vitest";
import {
  computeTampoAngleDegFromLengths,
  createDefaultTampoAngleConfig,
  normalizeTampoAngleConfig,
  resolveTampoAngleEnvelopeMm,
  serializeTampoAngleForCutlist,
  validateTampoAngleConfig,
} from "./tampoAngle";

const BASE = { widthMm: 1995, heightMm: 630 };

describe("TAMPO Fase 5 — ângulo industrial", () => {
  it("default retangular → normalize null", () => {
    const cfg = createDefaultTampoAngleConfig(1200);
    expect(cfg.frontLengthMm).toBe(1200);
    expect(cfg.backLengthMm).toBe(1200);
    expect(cfg.angleDeg).toBe(0);
    expect(normalizeTampoAngleConfig(cfg)).toBeNull();
  });

  it("tampo1: frente 1995, trás 2303 → ângulo coerente", () => {
    const angle = computeTampoAngleDegFromLengths(1995, 2303, 630);
    expect(angle).toBeCloseTo(26.1, 1);
    const cfg = { frontLengthMm: 1995, backLengthMm: 2303, angleDeg: angle };
    expect(validateTampoAngleConfig(cfg, BASE).ok).toBe(true);
    const n = normalizeTampoAngleConfig(cfg);
    expect(n).not.toBeNull();
    expect(n!.frontLengthMm).toBe(1995);
    expect(n!.backLengthMm).toBe(2303);
    expect(n!.angleDeg).toBeCloseTo(angle, 5);
  });

  it("tampo2: frente 1633, trás 1818 → válido", () => {
    const angle = computeTampoAngleDegFromLengths(1633, 1818, 630);
    const cfg = { frontLengthMm: 1633, backLengthMm: 1818, angleDeg: angle };
    expect(validateTampoAngleConfig(cfg, { widthMm: 1633, heightMm: 630 }).ok).toBe(true);
  });

  it("aceita frente > trás (ângulo negativo)", () => {
    const angle = computeTampoAngleDegFromLengths(2303, 1995, 630);
    expect(angle).toBeLessThan(0);
    expect(
      validateTampoAngleConfig(
        { frontLengthMm: 2303, backLengthMm: 1995, angleDeg: angle },
        { widthMm: 2303, heightMm: 630 }
      ).ok
    ).toBe(true);
  });

  it("rejeita comprimentos ≤ 0", () => {
    expect(
      validateTampoAngleConfig(
        { frontLengthMm: 0, backLengthMm: 1000, angleDeg: 0 },
        BASE
      ).ok
    ).toBe(false);
  });

  it("rejeita comprimento > 3660", () => {
    const v = validateTampoAngleConfig(
      { frontLengthMm: 4000, backLengthMm: 4000, angleDeg: 0 },
      BASE
    );
    expect(v.ok).toBe(false);
  });

  it("rejeita ângulo fora de [-60, 60] após sync incoerente", () => {
    const v = validateTampoAngleConfig(
      { frontLengthMm: 1000, backLengthMm: 1000, angleDeg: 90 },
      BASE
    );
    expect(v.ok).toBe(false);
  });

  it("envelope = max(front, back) × 630", () => {
    const env = resolveTampoAngleEnvelopeMm(
      { frontLengthMm: 1995, backLengthMm: 2303, angleDeg: 14 },
      1995,
      630
    );
    expect(env.lengthMm).toBe(2303);
    expect(env.widthMm).toBe(630);
  });

  it("serializeTampoAngleForCutlist", () => {
    const angle = computeTampoAngleDegFromLengths(1995, 2303, 630);
    expect(
      serializeTampoAngleForCutlist({
        frontLengthMm: 1995,
        backLengthMm: 2303,
        angleDeg: angle,
      })
    ).toMatchObject({
      frontLengthMm: 1995,
      backLengthMm: 2303,
    });
    expect(serializeTampoAngleForCutlist(null)).toBeUndefined();
  });
});
