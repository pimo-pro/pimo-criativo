/**
 * RoomBuilder — cria sala com paredes independentes e aberturas.
 * Cada parede é um mesh com position/rotation próprios; aberturas são filhos da parede.
 * Sem layout automático: position e rotation vêm sempre do config.
 */

import * as THREE from "three";
import type { RoomConfig, WallConfig, DoorWindowConfig, OpeningConfig } from "./types";
import { DoorElement } from "./elements/DoorElement";
import { WindowElement } from "./elements/WindowElement";

const WALL_COLOR = 0xd1d5db;
const WALL_MM_TO_M = 1 / 1000;
const OUTLINE_COLOR = 0x3b82f6;

export type RoomElementEntry = {
  type: "door" | "window";
  wallId: number;
  wallUuid: string;
  elementId: string;
  config: DoorWindowConfig;
};

export class RoomBuilder {
  private readonly group = new THREE.Group();
  private readonly walls: THREE.Mesh[] = [];
  private readonly elements: RoomElementEntry[] = [];

  constructor() {
    this.group.name = "room";
    this.group.userData.isRoom = true;
  }

  getGroup(): THREE.Group {
    return this.group;
  }

  getWalls(): THREE.Mesh[] {
    return [...this.walls];
  }

  getElements(): RoomElementEntry[] {
    return [...this.elements];
  }

  /** Retorna o grupo (THREE.Group) da abertura pelo elementId, ou null. */
  getElementById(elementId: string): THREE.Group | null {
    for (const wall of this.walls) {
      for (const child of wall.children) {
        if (child.userData.elementId === elementId && child instanceof THREE.Group) {
          return child;
        }
      }
    }
    return null;
  }

  getWallByUuid(wallUuid: string): THREE.Mesh | null {
    return this.walls.find((w) => w.userData.wallUuid === wallUuid) ?? null;
  }

  private createOutline(mesh: THREE.Mesh, isSelected: boolean): THREE.LineSegments {
    const edges = new THREE.EdgesGeometry(mesh.geometry);
    const material = new THREE.LineDashedMaterial({
      color: OUTLINE_COLOR,
      dashSize: 0.08,
      gapSize: 0.04,
    });
    const lines = new THREE.LineSegments(edges, material);
    lines.computeLineDistances();
    lines.visible = isSelected;
    lines.userData.isWallOutline = true;
    return lines;
  }

  private createWallMesh(wall: WallConfig, isSelected: boolean): THREE.Mesh {
    const lengthM = Math.max(0.01, wall.lengthMm * WALL_MM_TO_M);
    const heightM = Math.max(0.01, wall.heightMm * WALL_MM_TO_M);
    const thicknessM = Math.max(0.01, wall.thicknessMm * WALL_MM_TO_M);

    const geometry = new THREE.BoxGeometry(lengthM, heightM, thicknessM);
    const hexColor = wall.color != null ? parseInt(wall.color.replace("#", ""), 16) : WALL_COLOR;
    const material = new THREE.MeshStandardMaterial({
      color: hexColor,
      roughness: 0.75,
      metalness: 0.05,
      transparent: true,
      opacity: 0.8,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.isRoomWall = true;
    mesh.userData.wallLengthMm = wall.lengthMm;
    mesh.userData.wallHeightMm = wall.heightMm;
    mesh.userData.wallThicknessM = thicknessM;
    const outline = this.createOutline(mesh, isSelected);
    mesh.add(outline);
    return mesh;
  }

  private placeOpeningOnWall(
    element: THREE.Group,
    config: DoorWindowConfig,
    wall: THREE.Mesh
  ): void {
    const wallLenM = (wall.userData.wallLengthMm as number) * WALL_MM_TO_M;
    const thicknessM = (wall.userData.wallThicknessM as number) ?? 0.12;

    const xLocal =
      -wallLenM / 2 + (config.horizontalOffsetMm + config.widthMm / 2) * WALL_MM_TO_M;
    const yLocal = (config.floorOffsetMm + config.heightMm / 2) * WALL_MM_TO_M;
    const zLocal = 0;

    element.position.set(xLocal, yLocal, zLocal);
    element.rotation.set(0, 0, 0);
    wall.add(element);
  }

  private openingConfigToDoorWindowConfig(o: OpeningConfig): DoorWindowConfig {
    return {
      widthMm: o.widthMm,
      heightMm: o.heightMm,
      floorOffsetMm: o.floorOffsetMm,
      horizontalOffsetMm: o.horizontalOffsetMm,
    };
  }

  createRoom(config: RoomConfig): THREE.Group {
    this.clearRoom(true);

    const walls = config.walls.slice(0, config.numWalls);
    const selectedWallId = config.selectedWallId ?? null;

    for (let i = 0; i < walls.length; i++) {
      const wallConfig = walls[i];
      const isSelected = selectedWallId === wallConfig.id;

      const mesh = this.createWallMesh(wallConfig, isSelected);

      mesh.userData.wallId = i;
      mesh.userData.wallUuid = wallConfig.id;

      mesh.position.set(
        wallConfig.position.x,
        wallConfig.heightMm * WALL_MM_TO_M * 0.5,
        wallConfig.position.z
      );
      mesh.rotation.y = (wallConfig.rotation * Math.PI) / 180;

      this.group.add(mesh);
      this.walls.push(mesh);

      for (const opening of wallConfig.openings) {
        const dwConfig = this.openingConfigToDoorWindowConfig(opening);
        const element =
          opening.type === "door"
            ? DoorElement.create(dwConfig, opening.id)
            : WindowElement.create(dwConfig, opening.id);
        element.userData.config = { ...dwConfig };
        this.placeOpeningOnWall(element, dwConfig, mesh);
        this.elements.push({
          type: opening.type,
          wallId: i,
          wallUuid: wallConfig.id,
          elementId: opening.id,
          config: { ...dwConfig },
        });
      }
    }

    return this.group;
  }

  setWallOutlineVisible(wallUuid: string, visible: boolean): void {
    const wall = this.getWallByUuid(wallUuid);
    if (!wall) return;
    wall.traverse((child) => {
      if (child.userData.isWallOutline === true) {
        (child as THREE.LineSegments).visible = visible;
      }
    });
  }

  updateRoom(config: RoomConfig): void {
    const walls = config.walls.slice(0, config.numWalls);
    const selectedWallId = config.selectedWallId ?? null;

    for (let i = 0; i < this.walls.length; i++) {
      const mesh = this.walls[i];
      const wallUuid = mesh.userData.wallUuid as string;
      const wallConfig = walls.find((w) => w.id === wallUuid);
      if (!wallConfig) continue;

      const isSelected = selectedWallId === wallUuid;
      mesh.traverse((child) => {
        if (child.userData.isWallOutline === true) {
          (child as THREE.LineSegments).visible = isSelected;
        }
      });

      mesh.position.set(
        wallConfig.position.x,
        wallConfig.heightMm * WALL_MM_TO_M * 0.5,
        wallConfig.position.z
      );
      mesh.rotation.y = (wallConfig.rotation * Math.PI) / 180;

      if (
        (mesh.userData.wallLengthMm as number) !== wallConfig.lengthMm ||
        (mesh.userData.wallHeightMm as number) !== wallConfig.heightMm ||
        (mesh as THREE.Mesh).geometry instanceof THREE.BoxGeometry === false
      ) {
        mesh.userData.wallLengthMm = wallConfig.lengthMm;
        mesh.userData.wallHeightMm = wallConfig.heightMm;
        mesh.userData.wallThicknessM = wallConfig.thicknessMm * WALL_MM_TO_M;
        const lengthM = Math.max(0.01, wallConfig.lengthMm * WALL_MM_TO_M);
        const heightM = Math.max(0.01, wallConfig.heightMm * WALL_MM_TO_M);
        const thicknessM = Math.max(0.01, wallConfig.thicknessMm * WALL_MM_TO_M);
        ;(mesh as THREE.Mesh).geometry.dispose();
        (mesh as THREE.Mesh).geometry = new THREE.BoxGeometry(lengthM, heightM, thicknessM);
        const outline = mesh.children.find((c) => c.userData.isWallOutline) as THREE.LineSegments | undefined;
        if (outline) {
          outline.geometry.dispose();
          outline.geometry = new THREE.EdgesGeometry((mesh as THREE.Mesh).geometry);
          outline.computeLineDistances();
        }
        const mat = (mesh as THREE.Mesh).material;
        if (mat && !Array.isArray(mat)) {
          const hex = wallConfig.color != null ? parseInt(wallConfig.color.replace("#", ""), 16) : WALL_COLOR;
          mat.color.setHex(hex);
        }
      }
    }
  }

  addDoorByIndex(wallIndex: number, config: DoorWindowConfig): string {
    const wall = this.walls[wallIndex];
    if (!wall) return "";
    const wallUuid = wall.userData.wallUuid as string;
    return this.addDoor(wallUuid, config);
  }

  addDoor(wallUuid: string, config: DoorWindowConfig): string {
    const wall = this.getWallByUuid(wallUuid);
    if (!wall) return "";
    const wallId = wall.userData.wallId as number;
    const id = `door-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const element = DoorElement.create(config, id);
    this.placeOpeningOnWall(element, config, wall);
    this.elements.push({
      type: "door",
      wallId,
      wallUuid,
      elementId: id,
      config: { ...config },
    });
    return id;
  }

  addWindowByIndex(wallIndex: number, config: DoorWindowConfig): string {
    const wall = this.walls[wallIndex];
    if (!wall) return "";
    const wallUuid = wall.userData.wallUuid as string;
    return this.addWindow(wallUuid, config);
  }

  addWindow(wallUuid: string, config: DoorWindowConfig): string {
    const wall = this.getWallByUuid(wallUuid);
    if (!wall) return "";
    const wallId = wall.userData.wallId as number;
    const id = `window-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const element = WindowElement.create(config, id);
    this.placeOpeningOnWall(element, config, wall);
    this.elements.push({
      type: "window",
      wallId,
      wallUuid,
      elementId: id,
      config: { ...config },
    });
    return id;
  }

  updateElementConfig(elementId: string, config: DoorWindowConfig): boolean {
    const entry = this.elements.find((e) => e.elementId === elementId);
    if (!entry) return false;
    entry.config = { ...config };
    const wall = this.walls[entry.wallId];
    if (!wall) return false;
    const child = wall.children.find(
      (c) => (c.userData.elementId as string) === elementId
    );
    if (!(child instanceof THREE.Group)) return false;
    if (entry.type === "door") {
      DoorElement.updateConfig(child, config);
    } else {
      WindowElement.updateConfig(child, config);
    }
    this.placeOpeningOnWall(child, config, wall);
    return true;
  }

  clearRoom(clearElements = true): void {
    for (const wall of this.walls) {
      wall.traverse((child) => {
        if (child instanceof THREE.Mesh && child !== wall) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            (child.material as THREE.Material).dispose();
          }
        } else if (child instanceof THREE.LineSegments) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      });
      this.group.remove(wall);
      (wall as THREE.Mesh).geometry.dispose();
      const mat = (wall as THREE.Mesh).material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat.dispose();
    }
    this.walls.length = 0;
    if (clearElements) {
      this.elements.length = 0;
    }
  }
}
