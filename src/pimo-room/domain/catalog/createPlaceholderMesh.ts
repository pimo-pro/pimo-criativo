/**
 * Meshes placeholder para presets sem GLB disponível.
 */
import * as THREE from "three";
import type { CatalogItem } from "./CatalogItem";

export function createPlaceholderMesh(preset: CatalogItem): THREE.Group {
  const group = new THREE.Group();
  group.name = `catalog-placeholder-${preset.id}`;
  const w = preset.sizeMm.width / 1000;
  const d = preset.sizeMm.depth / 1000;
  const h = preset.sizeMm.height / 1000;
  const mat = new THREE.MeshStandardMaterial({
    color: preset.color,
    roughness: 0.75,
    metalness: 0.05,
  });

  switch (preset.type) {
    case "chair": {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.12, d * 0.7), mat);
      seat.position.y = h * 0.45;
      const back = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.45, d * 0.08), mat.clone());
      back.position.set(0, h * 0.7, -d * 0.28);
      const legGeo = new THREE.BoxGeometry(w * 0.08, h * 0.42, d * 0.08);
      const offsets: Array<[number, number]> = [
        [-w * 0.35, -d * 0.25],
        [w * 0.35, -d * 0.25],
        [-w * 0.35, d * 0.25],
        [w * 0.35, d * 0.25],
      ];
      for (const [lx, lz] of offsets) {
        const leg = new THREE.Mesh(legGeo, mat.clone());
        leg.position.set(lx, h * 0.21, lz);
        group.add(leg);
      }
      group.add(seat, back);
      break;
    }
    case "table": {
      const top = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.08, d), mat);
      top.position.y = h * 0.92;
      const legGeo = new THREE.CylinderGeometry(w * 0.03, w * 0.03, h * 0.85, 8);
      for (const [lx, lz] of [
        [-w * 0.4, -d * 0.35],
        [w * 0.4, -d * 0.35],
        [-w * 0.4, d * 0.35],
        [w * 0.4, d * 0.35],
      ] as Array<[number, number]>) {
        const leg = new THREE.Mesh(legGeo, mat.clone());
        leg.position.set(lx, h * 0.42, lz);
        group.add(leg);
      }
      group.add(top);
      break;
    }
    case "sofa": {
      const base = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.35, d), mat);
      base.position.y = h * 0.25;
      const back = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.45, d * 0.2), mat.clone());
      back.position.set(0, h * 0.55, -d * 0.35);
      const armL = new THREE.Mesh(new THREE.BoxGeometry(w * 0.1, h * 0.35, d * 0.9), mat.clone());
      armL.position.set(-w * 0.45, h * 0.4, 0);
      const armR = armL.clone();
      armR.position.x = w * 0.45;
      group.add(base, back, armL, armR);
      break;
    }
    case "lamp": {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(w * 0.04, w * 0.05, h * 0.75, 10),
        mat
      );
      pole.position.y = h * 0.4;
      const shade = new THREE.Mesh(
        new THREE.ConeGeometry(w * 0.35, h * 0.25, 16, 1, true),
        new THREE.MeshStandardMaterial({
          color: "#f0e6d2",
          roughness: 0.6,
          side: THREE.DoubleSide,
        })
      );
      shade.position.y = h * 0.85;
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(w * 0.25, w * 0.28, h * 0.05, 16),
        mat.clone()
      );
      base.position.y = h * 0.025;
      group.add(base, pole, shade);
      break;
    }
    default: {
      const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      box.position.y = h / 2;
      group.add(box);
    }
  }

  group.traverse((c) => {
    if (c instanceof THREE.Mesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });
  return group;
}
