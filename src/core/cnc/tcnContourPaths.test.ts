import { describe, expect, it } from "vitest";
import {
  buildContourPathV1Style,
  buildInnerCirclePath,
  buildInnerContourPath,
  buildPolygonContourPath,
  INNER_CIRCLE_SEGMENTS,
  offsetPolygonOutward,
} from "./tcnContourPaths";

function hasObliqueEdge(points: Array<{ x: number; y: number }>): boolean {
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    if (Math.abs(a.x - b.x) > 0.5 && Math.abs(a.y - b.y) > 0.5) return true;
  }
  return false;
}

describe("tcnContourPaths — Fase E", () => {
  it("rectângulo exterior gera path idêntico ao V1", () => {
    const v1 = buildContourPathV1Style(10, 10, 800, 400, 6, 19, 10, 20);
    const poly = buildPolygonContourPath(
      [
        { x: 10, y: 10 },
        { x: 810, y: 10 },
        { x: 810, y: 410 },
        { x: 10, y: 410 },
      ],
      6,
      19,
      10,
      20
    );
    expect(poly).toEqual(v1);
  });

  it("trapézio milan → vértices CCW e aresta oblíqua após offset", () => {
    const trap = [
      { x: 0, y: 0 },
      { x: 2303, y: 0 },
      { x: 1995, y: 630 },
      { x: 0, y: 630 },
    ];
    const offset = offsetPolygonOutward(trap, 6);
    expect(offset).toHaveLength(4);
    expect(hasObliqueEdge(offset)).toBe(true);
    const path = buildPolygonContourPath(trap, 6, 30, 10, 20);
    const cutPts = path.path.filter((p) => p.z < 0);
    expect(hasObliqueEdge(cutPts)).toBe(true);
  });

  it("inner rect faz inset para dentro", () => {
    const inner = buildInnerContourPath(620, 70, 560, 490, -30, 10, 6);
    expect(inner).not.toBeNull();
    expect(inner!.path[0]).toEqual({ x: 626, y: 76, z: -30 });
  });

  it("círculo discretiza 32 segmentos com inset do raio", () => {
    const circle = buildInnerCirclePath(900, 315, 180, -30, 10, 6);
    expect(circle).not.toBeNull();
    const cut = circle!.path.filter((p) => p.z < 0);
    expect(cut.length).toBe(INNER_CIRCLE_SEGMENTS + 1);
    expect(Math.hypot(cut[0]!.x - 900, cut[0]!.y - 315)).toBeCloseTo(84, 5);
  });
});
