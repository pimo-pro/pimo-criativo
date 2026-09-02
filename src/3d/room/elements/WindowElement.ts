/**
 * WindowElement — janela simples para Room Builder: box (vidro) + moldura.
 * Preparado para futura biblioteca de modelos (modelId).
 */

import * as THREE from "three";
import type { DoorWindowConfig } from "../types";
import { DEFAULT_ELEMENT_COLOR } from "../types";

const MM_TO_M = 1 / 1000;
const FRAME_WIDTH_MM = 60;
const DEFAULT_DEPTH_MM = 40;

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

function buildWindowGeometry(group: THREE.Group, config: DoorWindowConfig): void {
  disposeChildren(group);
  const widthM = Math.max(0.01, config.widthMm * MM_TO_M);
  const heightM = Math.max(0.01, config.heightMm * MM_TO_M);
  const frameM = FRAME_WIDTH_MM * MM_TO_M;
  const depthM = Math.max(0.01, (config.thicknessMm ?? DEFAULT_DEPTH_MM) * MM_TO_M);

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: DEFAULT_ELEMENT_COLOR,
    roughness: 0.7,
    metalness: 0.05,
  });
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: 0xc8e0f0,
    roughness: 0.2,
    metalness: 0.02,
    transparent: true,
    opacity: 0.85,
  });

  const leafCount = config.kind === "correr" ? 2 : 1;
  const glassWidth = widthM / leafCount;
  for (let i = 0; i < leafCount; i += 1) {
    const panel = tagRoomElement(new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(0.01, glassWidth), Math.max(0.01, heightM), depthM * 0.6),
      glassMaterial.clone()
    ));
    const x = leafCount === 1 ? 0 : -glassWidth / 2 + i * glassWidth;
    panel.position.set(x, 0, config.kind === "correr" && i === 1 ? depthM * 0.45 : 0);
    group.add(panel);
  }

  const frames: THREE.Mesh[] = [];
  const top = tagRoomElement(new THREE.Mesh(new THREE.BoxGeometry(widthM + frameM * 2, frameM, depthM), frameMaterial.clone()));
  top.position.y = heightM / 2 + frameM / 2;
  frames.push(top);

  const bottom = tagRoomElement(new THREE.Mesh(new THREE.BoxGeometry(widthM + frameM * 2, frameM, depthM), frameMaterial.clone()));
  bottom.position.y = -heightM / 2 - frameM / 2;
  frames.push(bottom);

  const left = tagRoomElement(new THREE.Mesh(new THREE.BoxGeometry(frameM, heightM, depthM), frameMaterial.clone()));
  left.position.x = -widthM / 2 - frameM / 2;
  frames.push(left);

  const right = tagRoomElement(new THREE.Mesh(new THREE.BoxGeometry(frameM, heightM, depthM), frameMaterial.clone()));
  right.position.x = widthM / 2 + frameM / 2;
  frames.push(right);

  if (config.kind === "correr") {
    const centerRail = tagRoomElement(new THREE.Mesh(new THREE.BoxGeometry(frameM * 0.5, heightM, depthM * 1.2), frameMaterial.clone()));
    frames.push(centerRail);
  }

  frames.forEach((f) => group.add(f));
  group.userData.config = { ...config };
  group.userData.frames = frames;
}

export class WindowElement {
  static create(config: DoorWindowConfig, elementId: string): THREE.Group {
    const group = new THREE.Group();
    group.name = `window-${elementId}`;
    group.userData.isRoomElement = true;
    group.userData.elementId = elementId;
    group.userData.elementType = "window";
    buildWindowGeometry(group, config);
    return group;
  }

  static updateConfig(group: THREE.Group, config: DoorWindowConfig): void {
    buildWindowGeometry(group, config);
  }
}
