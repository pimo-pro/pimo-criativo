/**
 * WindowElement — janela com folha (swing / correr), animação e materiais pimo.
 */

import * as THREE from "three";
import type { DoorWindowConfig } from "../types";
import { createOpeningMaterials } from "../openingMaterials";
import { animateOpeningLeaf, setOpeningOpenInstant } from "../openingAnimation";

const MM_TO_M = 1 / 1000;
const FRAME_WIDTH_MM = 60;
const DEFAULT_DEPTH_MM = 40;
const OPEN_ANGLE = -Math.PI * 0.55;

function disposeChildren(group: THREE.Group): void {
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose();
      const mat = child.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
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
  const wasOpen = group.userData.isOpen === true;
  disposeChildren(group);
  const mats = createOpeningMaterials();
  const widthM = Math.max(0.01, config.widthMm * MM_TO_M);
  const heightM = Math.max(0.01, config.heightMm * MM_TO_M);
  const frameM = FRAME_WIDTH_MM * MM_TO_M;
  const depthM = Math.max(0.01, (config.thicknessMm ?? DEFAULT_DEPTH_MM) * MM_TO_M);
  const kind = config.kind ?? "normal";

  const frames: THREE.Mesh[] = [];
  const top = tagRoomElement(
    new THREE.Mesh(
      new THREE.BoxGeometry(widthM + frameM * 2, frameM, depthM),
      mats.frame.clone()
    )
  );
  top.position.y = heightM / 2 + frameM / 2;
  frames.push(top);
  const bottom = tagRoomElement(
    new THREE.Mesh(
      new THREE.BoxGeometry(widthM + frameM * 2, frameM, depthM),
      mats.frame.clone()
    )
  );
  bottom.position.y = -heightM / 2 - frameM / 2;
  frames.push(bottom);
  const left = tagRoomElement(
    new THREE.Mesh(new THREE.BoxGeometry(frameM, heightM, depthM), mats.frame.clone())
  );
  left.position.x = -widthM / 2 - frameM / 2;
  frames.push(left);
  const right = tagRoomElement(
    new THREE.Mesh(new THREE.BoxGeometry(frameM, heightM, depthM), mats.frame.clone())
  );
  right.position.x = widthM / 2 + frameM / 2;
  frames.push(right);
  frames.forEach((f) => group.add(f));

  const leafPivot = new THREE.Group();
  leafPivot.name = "windowLeafPivot";
  const slideDist = widthM * 0.45;

  if (kind === "correr") {
    const leafW = widthM * 0.55;
    for (let i = 0; i < 2; i++) {
      const glass = tagRoomElement(
        new THREE.Mesh(
          new THREE.BoxGeometry(Math.max(0.01, leafW), heightM, depthM * 0.5),
          mats.glass.clone()
        )
      );
      glass.position.set(-widthM / 2 + leafW / 2 + i * widthM * 0.1, 0, i * depthM * 0.3);
      const sash = tagRoomElement(
        new THREE.Mesh(
          new THREE.BoxGeometry(Math.max(0.01, leafW), heightM, depthM * 0.15),
          mats.frame.clone()
        )
      );
      sash.position.copy(glass.position);
      sash.position.z += depthM * 0.2;
      leafPivot.add(glass, sash);
    }
    group.userData.animMode = "slide";
    group.userData.slideDistanceM = slideDist;
  } else {
    leafPivot.position.set(-widthM / 2, 0, 0);
    const glass = tagRoomElement(
      new THREE.Mesh(
        new THREE.BoxGeometry(widthM, heightM, depthM * 0.5),
        mats.glass.clone()
      )
    );
    glass.position.set(widthM / 2, 0, 0);
    const sash = tagRoomElement(
      new THREE.Mesh(
        new THREE.BoxGeometry(widthM, heightM, depthM * 0.12),
        mats.frame.clone()
      )
    );
    sash.position.set(widthM / 2, 0, depthM * 0.15);
    leafPivot.add(glass, sash);
    group.userData.animMode = "swing";
    group.userData.openAngleRad = OPEN_ANGLE;
  }

  group.add(leafPivot);
  group.userData.leafPivot = leafPivot;
  group.userData.frames = frames;
  group.userData.config = { ...config };

  setOpeningOpenInstant(
    group,
    wasOpen,
    group.userData.animMode === "slide" ? "slide" : "swing",
    group.userData.openAngleRad ?? OPEN_ANGLE,
    group.userData.slideDistanceM ?? slideDist
  );
}

export class WindowElement {
  static create(config: DoorWindowConfig, elementId: string): THREE.Group {
    const group = new THREE.Group();
    group.name = `window-${elementId}`;
    group.userData.isRoomElement = true;
    group.userData.elementId = elementId;
    group.userData.elementType = "window";
    group.userData.isOpen = false;
    buildWindowGeometry(group, config);
    return group;
  }

  static updateConfig(group: THREE.Group, config: DoorWindowConfig): void {
    buildWindowGeometry(group, config);
  }

  static setOpen(group: THREE.Group, open: boolean, animate = true): void {
    const mode = (group.userData.animMode as "swing" | "slide") ?? "swing";
    if (animate) {
      animateOpeningLeaf(group, {
        mode,
        open,
        openAngleRad: group.userData.openAngleRad ?? OPEN_ANGLE,
        slideDistanceM: group.userData.slideDistanceM ?? 0.4,
      });
    } else {
      setOpeningOpenInstant(
        group,
        open,
        mode,
        group.userData.openAngleRad ?? OPEN_ANGLE,
        group.userData.slideDistanceM ?? 0.4
      );
    }
  }

  static toggleOpen(group: THREE.Group, animate = true): boolean {
    const next = !(group.userData.isOpen === true);
    WindowElement.setOpen(group, next, animate);
    return next;
  }
}
