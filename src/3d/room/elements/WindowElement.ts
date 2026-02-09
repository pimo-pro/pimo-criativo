/**
 * WindowElement — janela simples para Room Builder: box (vidro) + moldura.
 * Preparado para futura biblioteca de modelos (modelId).
 */

import * as THREE from "three";
import type { DoorWindowConfig } from "../types";
import { DEFAULT_ELEMENT_COLOR } from "../types";

const MM_TO_M = 1 / 1000;
const FRAME_WIDTH_MM = 60;
const DEPTH_M = 0.04;

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

    const panelGeo = new THREE.BoxGeometry(
      Math.max(0.01, widthM),
      Math.max(0.01, heightM),
      DEPTH_M * 0.6
    );
    const panel = new THREE.Mesh(panelGeo, glassMaterial);
    panel.castShadow = true;
    panel.receiveShadow = true;
    panel.userData.isRoomElement = true;
    group.add(panel);

    const frames: THREE.Mesh[] = [];
    const topGeo = new THREE.BoxGeometry(widthM + frameM * 2, frameM, DEPTH_M);
    const top = new THREE.Mesh(topGeo, frameMaterial);
    top.position.y = heightM / 2 + frameM / 2;
    top.castShadow = true;
    top.receiveShadow = true;
    top.userData.isRoomElement = true;
    frames.push(top);

    const bottomGeo = new THREE.BoxGeometry(widthM + frameM * 2, frameM, DEPTH_M);
    const bottom = new THREE.Mesh(bottomGeo, frameMaterial);
    bottom.position.y = -heightM / 2 - frameM / 2;
    bottom.castShadow = true;
    bottom.receiveShadow = true;
    bottom.userData.isRoomElement = true;
    frames.push(bottom);

    const leftGeo = new THREE.BoxGeometry(frameM, heightM, DEPTH_M);
    const left = new THREE.Mesh(leftGeo, frameMaterial);
    left.position.x = -widthM / 2 - frameM / 2;
    left.castShadow = true;
    left.receiveShadow = true;
    left.userData.isRoomElement = true;
    frames.push(left);

    const rightGeo = new THREE.BoxGeometry(frameM, heightM, DEPTH_M);
    const right = new THREE.Mesh(rightGeo, frameMaterial);
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

    const panel = group.children[0];
    if (panel instanceof THREE.Mesh) {
      panel.geometry.dispose();
      panel.geometry = new THREE.BoxGeometry(widthM, heightM, DEPTH_M * 0.6);
    }

    const [top, bottom, left, right] = frames;
    top.geometry.dispose();
    top.geometry = new THREE.BoxGeometry(widthM + frameM * 2, frameM, DEPTH_M);
    top.position.y = heightM / 2 + frameM / 2;
    bottom.geometry.dispose();
    bottom.geometry = new THREE.BoxGeometry(widthM + frameM * 2, frameM, DEPTH_M);
    bottom.position.y = -heightM / 2 - frameM / 2;
    left.geometry.dispose();
    left.geometry = new THREE.BoxGeometry(frameM, heightM, DEPTH_M);
    left.position.x = -widthM / 2 - frameM / 2;
    right.geometry.dispose();
    right.geometry = new THREE.BoxGeometry(frameM, heightM, DEPTH_M);
    right.position.x = widthM / 2 + frameM / 2;

    group.userData.config = { ...config };
  }
}
