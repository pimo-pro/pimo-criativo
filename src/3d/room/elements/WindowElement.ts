/**
 * WindowElement — janela com moldura e abertura para Room Builder.
 * Moldura em volta; centro vazio. Apenas visual.
 */

import * as THREE from "three";
import type { DoorWindowConfig } from "../types";
import { DEFAULT_ELEMENT_COLOR } from "../types";

const MM_TO_M = 1 / 1000;
const FRAME_WIDTH_MM = 60;

export class WindowElement {
  static create(config: DoorWindowConfig, elementId: string): THREE.Group {
    const group = new THREE.Group();
    group.name = `window-${elementId}`;
    group.userData.isRoomElement = true;
    group.userData.elementId = elementId;
    group.userData.elementType = "window";

    const widthM = Math.max(0.01, config.widthMm * MM_TO_M);
    const heightM = Math.max(0.01, config.heightMm * MM_TO_M);
    const frameM = FRAME_WIDTH_MM * MM_TO_M;
    const depthM = 0.04;

    const material = new THREE.MeshStandardMaterial({
      color: DEFAULT_ELEMENT_COLOR,
      roughness: 0.7,
      metalness: 0.05,
    });

    const frames: THREE.Mesh[] = [];

    const topGeo = new THREE.BoxGeometry(widthM + frameM * 2, frameM, depthM);
    const top = new THREE.Mesh(topGeo, material);
    top.position.y = heightM / 2 + frameM / 2;
    top.castShadow = true;
    top.receiveShadow = true;
    top.userData.isRoomElement = true;
    frames.push(top);

    const bottomGeo = new THREE.BoxGeometry(widthM + frameM * 2, frameM, depthM);
    const bottom = new THREE.Mesh(bottomGeo, material);
    bottom.position.y = -heightM / 2 - frameM / 2;
    bottom.castShadow = true;
    bottom.receiveShadow = true;
    bottom.userData.isRoomElement = true;
    frames.push(bottom);

    const leftGeo = new THREE.BoxGeometry(frameM, heightM, depthM);
    const left = new THREE.Mesh(leftGeo, material);
    left.position.x = -widthM / 2 - frameM / 2;
    left.castShadow = true;
    left.receiveShadow = true;
    left.userData.isRoomElement = true;
    frames.push(left);

    const rightGeo = new THREE.BoxGeometry(frameM, heightM, depthM);
    const right = new THREE.Mesh(rightGeo, material);
    right.position.x = widthM / 2 + frameM / 2;
    right.castShadow = true;
    right.receiveShadow = true;
    right.userData.isRoomElement = true;
    frames.push(right);

    frames.forEach((f) => group.add(f));
    group.userData.config = { ...config };
    group.userData.frames = frames;
    return group;
  }

  static updateConfig(group: THREE.Group, config: DoorWindowConfig): void {
    const frames = group.userData.frames as THREE.Mesh[] | undefined;
    if (!Array.isArray(frames) || frames.length < 4) return;

    const widthM = Math.max(0.01, config.widthMm * MM_TO_M);
    const heightM = Math.max(0.01, config.heightMm * MM_TO_M);
    const frameM = FRAME_WIDTH_MM * MM_TO_M;

    const [top, bottom, left, right] = frames;

    top.geometry.dispose();
    top.geometry = new THREE.BoxGeometry(widthM + frameM * 2, frameM, 0.04);
    top.position.y = heightM / 2 + frameM / 2;

    bottom.geometry.dispose();
    bottom.geometry = new THREE.BoxGeometry(widthM + frameM * 2, frameM, 0.04);
    bottom.position.y = -heightM / 2 - frameM / 2;

    left.geometry.dispose();
    left.geometry = new THREE.BoxGeometry(frameM, heightM, 0.04);
    left.position.x = -widthM / 2 - frameM / 2;

    right.geometry.dispose();
    right.geometry = new THREE.BoxGeometry(frameM, heightM, 0.04);
    right.position.x = widthM / 2 + frameM / 2;

    group.userData.config = { ...config };
  }
}
