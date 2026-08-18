import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createTampoCutout } from "../../../core/remate/tampoCutouts";
import { buildTampoGeometryWithCutouts } from "../remate/TampoCutoutVisualizer";
import { createTampoPostformingGeometry } from "../remate/tampoPostformingGeometry";
import {
  createExternalEdgesGeometry,
  createSilhouetteEdgesGeometry,
  filterExternalEdges,
} from "./filterExternalEdges";

function segmentCount(geo: THREE.BufferGeometry): number {
  return (geo.attributes.position?.count ?? 0) / 2;
}

function hasEdgeInsideRect(
  geo: THREE.BufferGeometry,
  halfW: number,
  halfH: number
): boolean {
  const arr = geo.attributes.position.array as ArrayLike<number>;
  for (let i = 0; i + 5 < arr.length; i += 6) {
    const mx = (arr[i] + arr[i + 3]) / 2;
    const my = (arr[i + 1] + arr[i + 4]) / 2;
    if (Math.abs(mx) < halfW && Math.abs(my) < halfH) return true;
  }
  return false;
}

describe("filterExternalEdges", () => {
  it("caixa: mantém as 12 arestas externas", () => {
    const box = new THREE.BoxGeometry(0.6, 0.1, 0.019);
    const edges = createExternalEdgesGeometry(box, 1);
    expect(segmentCount(edges)).toBe(12);
    box.dispose();
    edges.dispose();
  });

  it("recorte fogão: silhueta sem o bordo do buraco", () => {
    const base = createTampoPostformingGeometry(1.2, 0.63, 0.03);
    const carved = buildTampoGeometryWithCutouts(base, [
      createTampoCutout("TAMPO_CUTOUT_FOGAO"),
    ]);
    const raw = new THREE.EdgesGeometry(carved, 1);
    const filtered = filterExternalEdges(raw, carved, 1);

    expect(segmentCount(filtered)).toBeGreaterThan(0);
    expect(segmentCount(filtered)).toBeLessThan(segmentCount(raw));
    expect(hasEdgeInsideRect(filtered, 0.30, 0.26)).toBe(false);

    const arr = filtered.attributes.position.array as ArrayLike<number>;
    let nearOuter = false;
    for (let i = 0; i + 5 < arr.length; i += 6) {
      const mx = (arr[i] + arr[i + 3]) / 2;
      const my = (arr[i + 1] + arr[i + 4]) / 2;
      if (Math.abs(mx) > 0.5 || Math.abs(my) > 0.28) nearOuter = true;
    }
    expect(nearOuter).toBe(true);

    if (carved !== base) carved.dispose();
    base.dispose();
    filtered.dispose();
  });

  it("createSilhouetteEdgesGeometry remove o recorte fogão", () => {
    const base = createTampoPostformingGeometry(1.2, 0.63, 0.03);
    const carved = buildTampoGeometryWithCutouts(base, [
      createTampoCutout("TAMPO_CUTOUT_FOGAO"),
    ]);
    const geo = createSilhouetteEdgesGeometry(carved, 1);
    expect(hasEdgeInsideRect(geo, 0.30, 0.26)).toBe(false);
    if (carved !== base) carved.dispose();
    base.dispose();
    geo.dispose();
  });
});
