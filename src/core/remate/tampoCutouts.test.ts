import { describe, expect, it } from "vitest";
import {
  createTampoCutout,
  normalizeTampoCutout,
  serializeTampoCutoutsForCutlist,
  TAMPO_CUTOUT_DEFAULTS,
  TAMPO_CUTOUT_DEPTH_MM,
  TAMPO_CUTOUT_MIN,
  validateAllTampoCutouts,
  validateTampoCutout,
} from "./tampoCutouts";

const TAMPO_ENV = { width: 1200, height: 630 };

describe("TAMPO Fase 3 — recortes industriais", () => {
  it("cria fogão com defaults industriais", () => {
    const c = createTampoCutout("TAMPO_CUTOUT_FOGAO");
    expect(c.tipo).toBe("TAMPO_CUTOUT_FOGAO");
    expect(c.width).toBe(TAMPO_CUTOUT_DEFAULTS.TAMPO_CUTOUT_FOGAO.width);
    expect(c.height).toBe(TAMPO_CUTOUT_DEFAULTS.TAMPO_CUTOUT_FOGAO.height);
    expect(c.depth).toBe(TAMPO_CUTOUT_DEPTH_MM);
    expect(c.x).toBe(0);
    expect(c.y).toBe(0);
    expect(validateTampoCutout(c, TAMPO_ENV).ok).toBe(true);
  });

  it("cria pia com defaults industriais", () => {
    const c = createTampoCutout("TAMPO_CUTOUT_PIA");
    expect(c.width).toBe(500);
    expect(c.height).toBe(400);
    expect(validateTampoCutout(c, TAMPO_ENV).ok).toBe(true);
  });

  it("cria retangular genérico", () => {
    const c = createTampoCutout("TAMPO_CUTOUT_RETANGULAR", { width: 100, height: 80, x: 50, y: -20 });
    expect(c.width).toBe(100);
    expect(c.height).toBe(80);
    expect(validateTampoCutout(c, TAMPO_ENV).ok).toBe(true);
  });

  it("cria circular com diâmetro", () => {
    const c = createTampoCutout("TAMPO_CUTOUT_CIRCULAR");
    expect(c.diameter).toBe(180);
    expect(c.width).toBeUndefined();
    expect(validateTampoCutout(c, TAMPO_ENV).ok).toBe(true);
  });

  it("rejeita fogão abaixo do mínimo industrial", () => {
    const c = createTampoCutout("TAMPO_CUTOUT_FOGAO", {
      width: TAMPO_CUTOUT_MIN.TAMPO_CUTOUT_FOGAO.width - 1,
      height: 490,
    });
    const v = validateTampoCutout(c, TAMPO_ENV);
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.includes("mínima"))).toBe(true);
  });

  it("rejeita pia abaixo do mínimo industrial", () => {
    const c = createTampoCutout("TAMPO_CUTOUT_PIA", { width: 300, height: 300 });
    expect(validateTampoCutout(c, TAMPO_ENV).ok).toBe(false);
  });

  it("validação: recorte fora do envelope → erro", () => {
    const c = createTampoCutout("TAMPO_CUTOUT_RETANGULAR", {
      width: 200,
      height: 200,
      x: 600,
      y: 0,
    });
    const v = validateTampoCutout(c, TAMPO_ENV);
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.includes("comprimento"))).toBe(true);
  });

  it("validação: circular fora da largura → erro", () => {
    const c = createTampoCutout("TAMPO_CUTOUT_CIRCULAR", { diameter: 200, y: 300 });
    const v = validateTampoCutout(c, TAMPO_ENV);
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.includes("largura"))).toBe(true);
  });

  it("validateAllTampoCutouts agrega erros", () => {
    const ok = createTampoCutout("TAMPO_CUTOUT_CIRCULAR", { diameter: 100 });
    const bad = createTampoCutout("TAMPO_CUTOUT_RETANGULAR", { width: 10, height: 10 });
    const v = validateAllTampoCutouts([ok, bad], TAMPO_ENV);
    expect(v.ok).toBe(false);
  });

  it("serializeTampoCutoutsForCutlist shape", () => {
    const list = serializeTampoCutoutsForCutlist([
      createTampoCutout("TAMPO_CUTOUT_FOGAO", { x: 10, y: -5 }),
      createTampoCutout("TAMPO_CUTOUT_CIRCULAR", { diameter: 90 }),
    ]);
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({
      tipo: "TAMPO_CUTOUT_FOGAO",
      width: 560,
      height: 490,
      x: 10,
      y: -5,
    });
    expect(list[1]).toMatchObject({ tipo: "TAMPO_CUTOUT_CIRCULAR", diameter: 90, x: 0, y: 0 });
    expect(list[1]).not.toHaveProperty("width");
  });

  it("normalize força depth=30", () => {
    const c = normalizeTampoCutout({
      id: "x",
      tipo: "TAMPO_CUTOUT_RETANGULAR",
      width: 50,
      height: 50,
      x: 0,
      y: 0,
      depth: 10,
    });
    expect(c.depth).toBe(30);
  });
});

describe("TAMPO Fase 3 — cutlist metadata", () => {
  it("cutlist inclui cutouts sem peças separadas", async () => {
    const { buildRemateCutlistItems } = await import("./remateCutlist");
    const { createTampoCutout } = await import("./tampoCutouts");
    const remate = {
      id: "t1",
      productType: "TAMPO_COZINHA" as const,
      tipo: "TAMPO" as const,
      width: 1200,
      height: 630,
      depth: 30,
      materialPresetId: "mdb_laminado-30",
      position: { xMm: 0, yMm: 0, zMm: 0 },
      rotation: { xRad: 0, yRad: 0, zRad: 0 },
      followBox: false,
      name: "TAMPO",
      cutouts: [createTampoCutout("TAMPO_CUTOUT_FOGAO")],
    };
    const items = buildRemateCutlistItems([remate], []);
    expect(items).toHaveLength(1);
    expect(items[0]!.metadata?.cutouts).toHaveLength(1);
    expect(items[0]!.metadata?.cutoutOperations?.[0]?.kind).toBe("tampo_cutout");
    expect(items[0]!.tipo).toBe("remate");
  });
});
