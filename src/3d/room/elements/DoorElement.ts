/**
 * DoorElement — porta simples para Room Builder.
 * Box 40 mm de espessura; cor cinza claro. Apenas visual.
 */

import * as THREE from "three";
import type { DoorWindowConfig } from "../types";
import { DEFAULT_DOOR_THICKNESS_MM, DEFAULT_ELEMENT_COLOR } from "../types";

const MM_TO_M = 1 / 1000;

export class DoorElement {
  static readonly THICKNESS_MM = 40;

  static create(config: DoorWindowConfig, elementId: string): THREE.Group {
    const group = new THREE.Group();
    group.name = `door-${elementId}`;
    group.userData.isRoomElement = true;
    group.userData.elementId = elementId;
    group.userData.elementType = "door";

    const widthM = Math.max(0.01, config.widthMm * MM_TO_M);
    const heightM = Math.max(0.01, config.heightMm * MM_TO_M);
    const thicknessM = DEFAULT_DOOR_THICKNESS_MM * MM_TO_M;

    const geometry = new THREE.BoxGeometry(widthM, heightM, thicknessM);
    const material = new THREE.MeshStandardMaterial({
      color: DEFAULT_ELEMENT_COLOR,
      roughness: 0.7,
      metalness: 0.05,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.isRoomElement = true;

    group.add(mesh);
    group.userData.config = { ...config };
    return group;
  }

  static updateConfig(group: THREE.Group, config: DoorWindowConfig): void {
    const mesh = group.children[0];
    if (!(mesh instanceof THREE.Mesh)) return;

    const widthM = Math.max(0.01, config.widthMm * MM_TO_M);
    const heightM = Math.max(0.01, config.heightMm * MM_TO_M);
    const thicknessM = DEFAULT_DOOR_THICKNESS_MM * MM_TO_M;

    mesh.geometry.dispose();
    mesh.geometry = new THREE.BoxGeometry(widthM, heightM, thicknessM);
    group.userData.config = { ...config };
  }
}
