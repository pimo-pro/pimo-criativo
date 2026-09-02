/**
 * pimo-room v4 — overlay visual de zonas (polígonos no piso + cotas).
 * Adicionado ao grupo do RoomManager — sem alterar ViewerCore.ts.
 */
import * as THREE from "three";
import type { ProjectRoomZone } from "../viewer-engine/room/roomEngineTypes";
import { polygonCentroidMm } from "./roomZones";
import { createZoneDimensionSprite } from "./zoneDimensionLabels";

const ZONE_COLORS = [0x3b82f6, 0x10b981, 0xf59e0b, 0x8b5cf6, 0xec4899];

function disposeObject3D(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Line || child instanceof THREE.Sprite) {
      const geom = (child as THREE.Mesh).geometry;
      geom?.dispose();
      const mat = (child as THREE.Mesh | THREE.Sprite).material;
      if (Array.isArray(mat)) {
        mat.forEach((m) => {
          if (m.map) m.map.dispose();
          m.dispose();
        });
      } else if (mat) {
        if ((mat as THREE.SpriteMaterial).map) (mat as THREE.SpriteMaterial).map!.dispose();
        (mat as THREE.Material).dispose();
      }
    }
  });
}

/** Constrói / actualiza um grupo de overlays a partir das zonas (mm → m). */
export function rebuildZoneOverlayGroup(
  existing: THREE.Group | null,
  zones: ProjectRoomZone[] | null | undefined
): THREE.Group {
  const group = existing ?? new THREE.Group();
  group.name = "pimoRoomZones";
  while (group.children.length) {
    const child = group.children[0];
    group.remove(child);
    disposeObject3D(child);
  }
  if (!zones?.length) return group;

  zones.forEach((zone, index) => {
    if (zone.polygonMm.length < 3) return;
    const shape = new THREE.Shape();
    zone.polygonMm.forEach((p, i) => {
      const x = p.x / 1000;
      const z = p.z / 1000;
      if (i === 0) shape.moveTo(x, z);
      else shape.lineTo(x, z);
    });
    shape.closePath();
    const geom = new THREE.ShapeGeometry(shape);
    geom.rotateX(-Math.PI / 2);
    const color = ZONE_COLORS[index % ZONE_COLORS.length];
    const mat = new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
      roughness: 0.9,
      metalness: 0,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.y = 0.005;
    mesh.name = `zone:${zone.id}`;
    mesh.userData.isRoomZone = true;
    mesh.userData.zoneId = zone.id;
    mesh.renderOrder = 2;
    group.add(mesh);

    const outlinePts = zone.polygonMm.map((p) => new THREE.Vector3(p.x / 1000, 0.008, p.z / 1000));
    outlinePts.push(outlinePts[0].clone());
    const lineGeom = new THREE.BufferGeometry().setFromPoints(outlinePts);
    const lineMat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.65,
    });
    const line = new THREE.Line(lineGeom, lineMat);
    line.name = `zone-outline:${zone.id}`;
    line.userData.isRoomZone = true;
    group.add(line);

    const c = polygonCentroidMm(zone.polygonMm);
    const marker = new THREE.Mesh(
      new THREE.CircleGeometry(0.08, 16),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false })
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(c.x / 1000, 0.01, c.z / 1000);
    marker.name = `zone-centroid:${zone.id}`;
    marker.userData.isRoomZone = true;
    group.add(marker);

    // Cota área / perímetro (billboard)
    if (typeof document !== "undefined") {
      group.add(createZoneDimensionSprite(zone));
    }
  });

  return group;
}
