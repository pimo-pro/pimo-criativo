/**
 * DoorElement — porta com dobradiça (swing), correr, animação e materiais pimo.
 *
 * Atribuição (MIT): ideia de folha pivotada na dobradiça adaptada de
 * Pascal Group Inc. / Aedifex Inc. (door leaf / hinge). Implementação WebGL própria.
 */

import * as THREE from "three";
import type { DoorWindowConfig } from "../types";
import { DEFAULT_DOOR_THICKNESS_MM } from "../types";
import { createOpeningMaterials } from "../openingMaterials";
import { animateOpeningLeaf, setOpeningOpenInstant } from "../openingAnimation";

const MM_TO_M = 1 / 1000;
const FRAME_WIDTH_MM = 50;
const OPEN_ANGLE = -Math.PI * 0.85;

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

function buildDoorGeometry(group: THREE.Group, config: DoorWindowConfig): void {
  const wasOpen = group.userData.isOpen === true;
  disposeChildren(group);
  const mats = createOpeningMaterials();
  const widthM = Math.max(0.01, config.widthMm * MM_TO_M);
  const heightM = Math.max(0.01, config.heightMm * MM_TO_M);
  const thicknessM = Math.max(0.01, (config.thicknessMm ?? DEFAULT_DOOR_THICKNESS_MM) * MM_TO_M);
  const frameM = FRAME_WIDTH_MM * MM_TO_M;
  const kind = config.kind ?? "normal";
  const hingeSide: "left" | "right" = "left";

  // Moldura fixa
  const frames: THREE.Mesh[] = [];
  const top = tagRoomElement(
    new THREE.Mesh(new THREE.BoxGeometry(widthM, frameM, thicknessM), mats.frame.clone())
  );
  top.position.y = heightM / 2 - frameM / 2;
  frames.push(top);
  const bottom = tagRoomElement(
    new THREE.Mesh(new THREE.BoxGeometry(widthM, frameM, thicknessM), mats.frame.clone())
  );
  bottom.position.y = -heightM / 2 + frameM / 2;
  frames.push(bottom);
  const left = tagRoomElement(
    new THREE.Mesh(
      new THREE.BoxGeometry(frameM, heightM - frameM * 2, thicknessM),
      mats.frame.clone()
    )
  );
  left.position.set(-widthM / 2 + frameM / 2, 0, 0);
  frames.push(left);
  const right = tagRoomElement(
    new THREE.Mesh(
      new THREE.BoxGeometry(frameM, heightM - frameM * 2, thicknessM),
      mats.frame.clone()
    )
  );
  right.position.set(widthM / 2 - frameM / 2, 0, 0);
  frames.push(right);
  frames.forEach((f) => group.add(f));

  const leafPivot = new THREE.Group();
  leafPivot.name = "doorLeafPivot";
  const leafInnerW = Math.max(0.01, widthM - frameM * 2);
  const leafH = Math.max(0.01, heightM - frameM * 2);
  const slideDist = leafInnerW * 0.55;

  if (kind === "correr") {
    leafPivot.position.set(0, 0, 0);
    const leafW = leafInnerW * 0.55;
    for (let i = 0; i < 2; i++) {
      const panel = tagRoomElement(
        new THREE.Mesh(new THREE.BoxGeometry(leafW, leafH, thicknessM * 0.9), mats.leaf.clone())
      );
      panel.position.set(-leafInnerW / 2 + leafW / 2 + i * (leafInnerW - leafW) * 0.15, 0, i * thicknessM * 0.35);
      leafPivot.add(panel);
    }
    const rail = tagRoomElement(
      new THREE.Mesh(new THREE.BoxGeometry(widthM, frameM * 0.5, thicknessM * 1.5), mats.hardware.clone())
    );
    rail.position.y = heightM / 2 + frameM * 0.35;
    group.add(rail);
    group.userData.animMode = "slide";
    group.userData.slideDistanceM = slideDist;
  } else {
    // Dobradiça no lado esquerdo da folha
    const hingeX = -leafInnerW / 2;
    leafPivot.position.set(hingeX, 0, 0);
    const panel = tagRoomElement(
      new THREE.Mesh(new THREE.BoxGeometry(leafInnerW, leafH, thicknessM), mats.leaf.clone())
    );
    panel.position.set(leafInnerW / 2, 0, 0);
    leafPivot.add(panel);
    // Dobradiças (hardware)
    for (const y of [-leafH * 0.35, 0, leafH * 0.35]) {
      const hinge = tagRoomElement(
        new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, thicknessM + 0.01), mats.hardware.clone())
      );
      hinge.position.set(0, y, 0);
      leafPivot.add(hinge);
    }
    group.userData.animMode = "swing";
    group.userData.openAngleRad = hingeSide === "left" ? OPEN_ANGLE : -OPEN_ANGLE;
  }

  group.add(leafPivot);
  group.userData.leafPivot = leafPivot;
  group.userData.frames = frames;
  group.userData.config = { ...config };
  group.userData.hingeSide = hingeSide;

  setOpeningOpenInstant(
    group,
    wasOpen,
    group.userData.animMode === "slide" ? "slide" : "swing",
    group.userData.openAngleRad ?? OPEN_ANGLE,
    group.userData.slideDistanceM ?? slideDist
  );
}

export class DoorElement {
  static readonly THICKNESS_MM = 40;

  static create(config: DoorWindowConfig, elementId: string): THREE.Group {
    const group = new THREE.Group();
    group.name = `door-${elementId}`;
    group.userData.isRoomElement = true;
    group.userData.elementId = elementId;
    group.userData.elementType = "door";
    group.userData.isOpen = false;
    buildDoorGeometry(group, config);
    return group;
  }

  static updateConfig(group: THREE.Group, config: DoorWindowConfig): void {
    buildDoorGeometry(group, config);
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
    DoorElement.setOpen(group, next, animate);
    return next;
  }
}
