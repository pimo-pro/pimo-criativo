/**
 * DoorElement — porta simples para Room Builder: box (painel) + moldura.
 * Preparado para futura biblioteca de modelos (modelId).
 */

import * as THREE from "three";
import type { DoorWindowConfig } from "../types";
import { DEFAULT_DOOR_THICKNESS_MM, DEFAULT_ELEMENT_COLOR } from "../types";

const MM_TO_M = 1 / 1000;
const FRAME_WIDTH_MM = 50;

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
    const frameM = FRAME_WIDTH_MM * MM_TO_M;

    const material = new THREE.MeshStandardMaterial({
      color: DEFAULT_ELEMENT_COLOR,
      roughness: 0.7,
      metalness: 0.05,
    });

    const panelGeo = new THREE.BoxGeometry(
      Math.max(0.01, widthM - frameM * 2),
      Math.max(0.01, heightM - frameM * 2),
      thicknessM
    );
    const panel = new THREE.Mesh(panelGeo, material);
    panel.castShadow = true;
    panel.receiveShadow = true;
    panel.userData.isRoomElement = true;
    group.add(panel);

    const frames: THREE.Mesh[] = [];
    const topGeo = new THREE.BoxGeometry(widthM, frameM, thicknessM);
    const top = new THREE.Mesh(topGeo, material);
    top.position.y = heightM / 2 - frameM / 2;
    top.castShadow = true;
    top.receiveShadow = true;
    top.userData.isRoomElement = true;
    frames.push(top);

    const bottomGeo = new THREE.BoxGeometry(widthM, frameM, thicknessM);
    const bottom = new THREE.Mesh(bottomGeo, material);
    bottom.position.y = -heightM / 2 + frameM / 2;
    bottom.castShadow = true;
    bottom.receiveShadow = true;
    bottom.userData.isRoomElement = true;
    frames.push(bottom);

    const leftGeo = new THREE.BoxGeometry(frameM, heightM - frameM * 2, thicknessM);
    const left = new THREE.Mesh(leftGeo, material);
    left.position.set(-widthM / 2 + frameM / 2, 0, 0);
    left.castShadow = true;
    left.receiveShadow = true;
    left.userData.isRoomElement = true;
    frames.push(left);

    const rightGeo = new THREE.BoxGeometry(frameM, heightM - frameM * 2, thicknessM);
    const right = new THREE.Mesh(rightGeo, material);
    right.position.set(widthM / 2 - frameM / 2, 0, 0);
    right.castShadow = true;
    right.receiveShadow = true;
    right.userData.isRoomElement = true;
    frames.push(right);

    frames.forEach((f) => group.add(f));
    group.userData.frames = frames;
    group.userData.config = { ...config };
    return group;
  }

  static updateConfig(group: THREE.Group, config: DoorWindowConfig): void {
    const widthM = Math.max(0.01, config.widthMm * MM_TO_M);
    const heightM = Math.max(0.01, config.heightMm * MM_TO_M);
    const thicknessM = DEFAULT_DOOR_THICKNESS_MM * MM_TO_M;
    const frameM = FRAME_WIDTH_MM * MM_TO_M;

    const panel = group.children[0];
    if (panel instanceof THREE.Mesh) {
      panel.geometry.dispose();
      panel.geometry = new THREE.BoxGeometry(
        Math.max(0.01, widthM - frameM * 2),
        Math.max(0.01, heightM - frameM * 2),
        thicknessM
      );
    }

    const frames = group.userData.frames as THREE.Mesh[] | undefined;
    if (Array.isArray(frames) && frames.length >= 4) {
      const [top, bottom, left, right] = frames;
      top.geometry.dispose();
      top.geometry = new THREE.BoxGeometry(widthM, frameM, thicknessM);
      top.position.y = heightM / 2 - frameM / 2;
      bottom.geometry.dispose();
      bottom.geometry = new THREE.BoxGeometry(widthM, frameM, thicknessM);
      bottom.position.y = -heightM / 2 + frameM / 2;
      left.geometry.dispose();
      left.geometry = new THREE.BoxGeometry(frameM, heightM - frameM * 2, thicknessM);
      left.position.set(-widthM / 2 + frameM / 2, 0, 0);
      right.geometry.dispose();
      right.geometry = new THREE.BoxGeometry(frameM, heightM - frameM * 2, thicknessM);
      right.position.set(widthM / 2 - frameM / 2, 0, 0);
    }

    group.userData.config = { ...config };
  }
}
