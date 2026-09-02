/**
 * DoorElement — porta simples para Room Builder: box (painel) + moldura.
 * Preparado para futura biblioteca de modelos (modelId).
 */

import * as THREE from "three";
import type { DoorWindowConfig } from "../types";
import { DEFAULT_DOOR_THICKNESS_MM, DEFAULT_ELEMENT_COLOR } from "../types";

const MM_TO_M = 1 / 1000;
const FRAME_WIDTH_MM = 50;

function disposeChildren(group: THREE.Group): void {
  group.children.forEach((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      const mat = child.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat.dispose();
    }
  });
  group.clear();
}

function tagRoomElement(mesh: THREE.Mesh): THREE.Mesh {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.isRoomElement = true;
  return mesh;
}

function buildDoorGeometry(group: THREE.Group, config: DoorWindowConfig): void {
  disposeChildren(group);
  const widthM = Math.max(0.01, config.widthMm * MM_TO_M);
  const heightM = Math.max(0.01, config.heightMm * MM_TO_M);
  const thicknessM = Math.max(0.01, (config.thicknessMm ?? DEFAULT_DOOR_THICKNESS_MM) * MM_TO_M);
  const frameM = FRAME_WIDTH_MM * MM_TO_M;
  const material = new THREE.MeshStandardMaterial({
    color: DEFAULT_ELEMENT_COLOR,
    roughness: 0.7,
    metalness: 0.05,
  });

  const leafCount = config.kind === "correr" ? 2 : 1;
  const leafWidth = Math.max(0.01, (widthM - frameM * 2) / leafCount);
  for (let i = 0; i < leafCount; i += 1) {
    const panelGeo = new THREE.BoxGeometry(
      leafWidth,
      Math.max(0.01, heightM - frameM * 2),
      thicknessM
    );
    const panel = tagRoomElement(new THREE.Mesh(panelGeo, material.clone()));
    const x = leafCount === 1 ? 0 : -leafWidth / 2 + i * leafWidth;
    panel.position.set(x, 0, config.kind === "correr" && i === 1 ? thicknessM * 0.45 : 0);
    group.add(panel);
  }

  const frames: THREE.Mesh[] = [];
  const top = tagRoomElement(new THREE.Mesh(new THREE.BoxGeometry(widthM, frameM, thicknessM), material.clone()));
  top.position.y = heightM / 2 - frameM / 2;
  frames.push(top);

  const bottom = tagRoomElement(new THREE.Mesh(new THREE.BoxGeometry(widthM, frameM, thicknessM), material.clone()));
  bottom.position.y = -heightM / 2 + frameM / 2;
  frames.push(bottom);

  const left = tagRoomElement(new THREE.Mesh(new THREE.BoxGeometry(frameM, heightM - frameM * 2, thicknessM), material.clone()));
  left.position.set(-widthM / 2 + frameM / 2, 0, 0);
  frames.push(left);

  const right = tagRoomElement(new THREE.Mesh(new THREE.BoxGeometry(frameM, heightM - frameM * 2, thicknessM), material.clone()));
  right.position.set(widthM / 2 - frameM / 2, 0, 0);
  frames.push(right);

  if (config.kind === "correr") {
    const rail = tagRoomElement(new THREE.Mesh(new THREE.BoxGeometry(widthM, frameM * 0.5, thicknessM * 1.5), material.clone()));
    rail.position.y = heightM / 2 + frameM * 0.35;
    frames.push(rail);
  }

  frames.forEach((f) => group.add(f));
  group.userData.frames = frames;
  group.userData.config = { ...config };
}

export class DoorElement {
  static readonly THICKNESS_MM = 40;

  static create(config: DoorWindowConfig, elementId: string): THREE.Group {
    const group = new THREE.Group();
    group.name = `door-${elementId}`;
    group.userData.isRoomElement = true;
    group.userData.elementId = elementId;
    group.userData.elementType = "door";
    buildDoorGeometry(group, config);
    return group;
  }

  static updateConfig(group: THREE.Group, config: DoorWindowConfig): void {
    buildDoorGeometry(group, config);
  }
}
