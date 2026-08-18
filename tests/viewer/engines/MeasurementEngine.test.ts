import { describe, expect, it } from "vitest";
import { metersToMm01 } from "../../../src/3d/viewer-engine/measurement/unifiedMeasurementTypes";
import { MeasurementEngine } from "../../../src/3d/viewer-engine/measurement/MeasurementEngine";

describe("MeasurementEngine (Z-01.2.8 B)", () => {
  it("a conversão da régua unificada é em mm (1 m = 1000 mm)", () => {
    expect(metersToMm01(0.6)).toBe(600);
    expect(metersToMm01(0.36)).toBe(360);
    expect(MeasurementEngine).toBeTypeOf("function");
  });
});
