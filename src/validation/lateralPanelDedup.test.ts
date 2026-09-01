import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildBoxGroup, updateBoxGroup } from "../3d/objects/BoxBuilder";

const THICKNESS_M = 0.019;

function lateralPositions(width: number, _height: number) {
  return {
    leftX: -width / 2 + THICKNESS_M / 2,
    rightX: width / 2 - THICKNESS_M / 2,
    y: 0,
    z: 0,
  };
}

function countStructuralLaterals(group: THREE.Group): { left: number; right: number } {
  const left = group.children.filter((c) => c instanceof THREE.Mesh && c.name === "left").length;
  const right = group.children.filter((c) => c instanceof THREE.Mesh && c.name === "right").length;
  return { left, right };
}

describe("Lateral panel deduplication", () => {
  it("keeps exactly one left and one right after build and incremental updates", () => {
    const group = buildBoxGroup({ width: 0.6, height: 0.72, depth: 0.56, shelves: 2 });
    expect(countStructuralLaterals(group)).toEqual({ left: 1, right: 1 });

    updateBoxGroup(group, { width: 0.6, height: 0.72, depth: 0.56, shelves: 2 });
    expect(countStructuralLaterals(group)).toEqual({ left: 1, right: 1 });

    updateBoxGroup(group, { width: 0.65, height: 0.72, depth: 0.56, shelves: 2 });
    expect(countStructuralLaterals(group)).toEqual({ left: 1, right: 1 });
  });

  it("removes duplicate lateral meshes and syncs position with getPanelSpecs", () => {
    const width = 0.6;
    const height = 0.72;
    const depth = 0.56;
    const group = buildBoxGroup({ width, height, depth });
    const mat = (group.children[0] as THREE.Mesh).material;
    const specs = lateralPositions(width, height);

    const duplicateLeft = new THREE.Mesh(new THREE.BoxGeometry(0.019, 0.5, 0.5), mat as THREE.Material);
    duplicateLeft.name = "left";
    group.add(duplicateLeft);

    const duplicateRight = new THREE.Mesh(new THREE.BoxGeometry(0.019, 0.5, 0.5), mat as THREE.Material);
    duplicateRight.name = "right";
    group.add(duplicateRight);

    expect(countStructuralLaterals(group)).toEqual({ left: 2, right: 2 });

    updateBoxGroup(group, { width, height, depth, shelves: 1 });

    expect(countStructuralLaterals(group)).toEqual({ left: 1, right: 1 });

    const left = group.children.find((c) => c.name === "left") as THREE.Mesh;
    const right = group.children.find((c) => c.name === "right") as THREE.Mesh;
    expect(left.position.x).toBeCloseTo(specs.leftX);
    expect(left.position.z).toBeCloseTo(specs.z);
    expect(right.position.x).toBeCloseTo(specs.rightX);
    expect(right.position.z).toBeCloseTo(specs.z);
    expect(right.rotation.y).toBeCloseTo(Math.PI);
  });
});
