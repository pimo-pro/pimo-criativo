/**
 * Exporta RoomState → GLB (níveis, slabs, itens, câmara).
 */
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import type { RoomState } from "../RoomState";
import { RoomLevelGeometry } from "../levels/RoomLevelGeometry";
import { toCatalogItemState } from "../catalog/CatalogItemManager";
import { getCatalogPreset } from "../catalog/CatalogPresets";
import { createPlaceholderMesh } from "../catalog/createPlaceholderMesh";
import { enhancePbrMaterials } from "./glbMaterials";

export type GlbExportResult = {
  ok: boolean;
  buffer: ArrayBuffer | null;
  errors: string[];
  warnings: string[];
};

function wallMesh(wall: RoomState["walls"][number], baseY: number): THREE.Mesh {
  const dx = (wall.endMm.x - wall.startMm.x) / 1000;
  const dz = (wall.endMm.z - wall.startMm.z) / 1000;
  const len = Math.hypot(dx, dz) || 0.1;
  const h = wall.heightMm / 1000;
  const t = wall.thicknessMm / 1000;
  const geo = new THREE.BoxGeometry(len, h, t);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xd9d4cc,
    roughness: 0.8,
    metalness: 0.02,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = wall.id;
  mesh.userData = { roomRole: "wall", wallId: wall.id, levelId: wall.levelId };
  mesh.position.set(
    (wall.startMm.x + wall.endMm.x) / 2000,
    baseY + h / 2,
    (wall.startMm.z + wall.endMm.z) / 2000
  );
  mesh.rotation.y = Math.atan2(dx, dz) - Math.PI / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function slabMesh(slab: RoomState["slabs"][number], baseY: number): THREE.Mesh {
  let w = 4;
  let d = 4;
  if (slab.polygonMm.length >= 2) {
    const xs = slab.polygonMm.map((p) => p.x);
    const zs = slab.polygonMm.map((p) => p.z);
    w = (Math.max(...xs) - Math.min(...xs)) / 1000 || 4;
    d = (Math.max(...zs) - Math.min(...zs)) / 1000 || 4;
  }
  const th = slab.thicknessMm / 1000;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, th, d),
    new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.9, metalness: 0.05 })
  );
  mesh.name = slab.id;
  mesh.userData = { roomRole: "slab", slabId: slab.id, levelId: slab.levelId };
  mesh.position.set(
    (slab.offsetMm?.x ?? 0) / 1000,
    baseY + slab.elevationMm / 1000 + th / 2,
    (slab.offsetMm?.z ?? 0) / 1000
  );
  return mesh;
}

/** Constrói cena THREE a partir do RoomState (sem side-effects no viewer). */
export function buildRoomExportScene(state: RoomState): THREE.Group {
  const root = new THREE.Group();
  root.name = "pimoRoomExport";
  root.userData = {
    roomRole: "room",
    roomId: state.id,
    version: state.version,
  };

  for (const level of state.levels) {
    const levelGroup = new THREE.Group();
    levelGroup.name = level.name || level.id;
    levelGroup.userData = {
      roomRole: "level",
      levelId: level.id,
      ordinal: level.ordinal,
      storeyHeightMm: level.storeyHeightMm,
    };
    const desc = RoomLevelGeometry.forLevel(state, level.id);
    const baseY = desc?.baseElevationM ?? 0;

    for (const wall of state.walls.filter((w) => w.levelId === level.id)) {
      levelGroup.add(wallMesh(wall, baseY));
    }
    for (const slab of state.slabs.filter((s) => s.levelId === level.id)) {
      levelGroup.add(slabMesh(slab, baseY));
    }
    for (const item of state.items.filter((i) => i.levelId === level.id)) {
      const c = toCatalogItemState(item);
      const preset = getCatalogPreset(c.catalogId);
      const meshRoot = preset
        ? createPlaceholderMesh(preset)
        : createPlaceholderMesh({
            id: c.catalogId,
            name: c.name,
            type: c.type,
            sizeMm: { width: 600, depth: 600, height: 600 },
            color: "#888888",
          });
      meshRoot.name = c.id;
      meshRoot.userData = {
        roomRole: "item",
        catalogId: c.catalogId,
        itemId: c.id,
        type: c.type,
      };
      meshRoot.position.set(
        c.positionMm.x / 1000,
        baseY + c.positionMm.y / 1000,
        c.positionMm.z / 1000
      );
      meshRoot.rotation.y = (c.rotationDeg * Math.PI) / 180;
      meshRoot.scale.set(c.scale.x, c.scale.y, c.scale.z);
      levelGroup.add(meshRoot);
    }
    root.add(levelGroup);
  }

  const cam = new THREE.Object3D();
  cam.name = "walkthroughCamera";
  cam.userData = { roomRole: "camera" };
  const spawn = state.walkthroughSpawn;
  if (spawn) {
    cam.position.set(
      spawn.positionMm.x / 1000,
      spawn.positionMm.y / 1000,
      spawn.positionMm.z / 1000
    );
    cam.rotation.y = (spawn.yawDeg * Math.PI) / 180;
  } else {
    cam.position.set(0, 1.6, 0);
  }
  root.add(cam);

  enhancePbrMaterials(root);
  return root;
}

function ensureFileReaderPolyfill(): void {
  if (typeof globalThis.FileReader === "function") return;

  class FileReaderPolyfill {
    result: string | ArrayBuffer | null = null;
    readyState = 0;
    onload: ((_ev: { target: FileReaderPolyfill }) => void) | null = null;
    onloadend: ((_ev: { target: FileReaderPolyfill }) => void) | null = null;
    onerror: ((_ev: { target: FileReaderPolyfill }) => void) | null = null;

    private done(): void {
      this.readyState = 2;
      const ev = { target: this };
      this.onload?.(ev);
      this.onloadend?.(ev);
    }

    readAsArrayBuffer(blob: Blob): void {
      this.readyState = 1;
      void blob
        .arrayBuffer()
        .then((buf) => {
          this.result = buf;
          this.done();
        })
        .catch(() => this.onerror?.({ target: this }));
    }

    readAsDataURL(blob: Blob): void {
      this.readyState = 1;
      void blob
        .arrayBuffer()
        .then((buf) => {
          const bytes = new Uint8Array(buf);
          let binary = "";
          const chunk = 0x8000;
          for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
          }
          const b64 = btoa(binary);
          const type = blob.type || "application/octet-stream";
          this.result = `data:${type};base64,${b64}`;
          this.done();
        })
        .catch(() => this.onerror?.({ target: this }));
    }
  }

  (globalThis as unknown as { FileReader: typeof FileReaderPolyfill }).FileReader =
    FileReaderPolyfill;
}

function exportSceneToBuffer(scene: THREE.Object3D): Promise<ArrayBuffer> {
  ensureFileReaderPolyfill();
  const exporter = new GLTFExporter();
  // Preferir GLB binário (browser + Node com polyfill).
  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => {
        if (result instanceof ArrayBuffer) resolve(result);
        else {
          const json = JSON.stringify(result);
          resolve(new TextEncoder().encode(json).buffer);
        }
      },
      (err) => reject(err),
      { binary: true }
    );
  });
}

export const GlbExporter = {
  async exportRoomState(state: RoomState): Promise<GlbExportResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    try {
      if (state.walls.length === 0) {
        errors.push("RoomState sem paredes para exportar");
        return { ok: false, buffer: null, errors, warnings };
      }
      const scene = buildRoomExportScene(state);
      const buffer = await exportSceneToBuffer(scene);
      return { ok: true, buffer, errors, warnings };
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
      return { ok: false, buffer: null, errors, warnings };
    }
  },

  /** Exporta apenas itens de catálogo (sem paredes/slabs). */
  async exportItemsOnly(state: RoomState): Promise<GlbExportResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    try {
      if (state.items.length === 0) {
        errors.push("RoomState sem itens para exportar");
        return { ok: false, buffer: null, errors, warnings };
      }
      const root = new THREE.Group();
      root.name = "pimoRoomItemsExport";
      root.userData = { roomRole: "items", roomId: state.id };
      for (const level of state.levels) {
        const levelGroup = new THREE.Group();
        levelGroup.name = level.name || level.id;
        const desc = RoomLevelGeometry.forLevel(state, level.id);
        const baseY = desc?.baseElevationM ?? 0;
        for (const item of state.items.filter((i) => i.levelId === level.id)) {
          const c = toCatalogItemState(item);
          const preset = getCatalogPreset(c.catalogId);
          const meshRoot = preset
            ? createPlaceholderMesh(preset)
            : createPlaceholderMesh({
                id: c.catalogId,
                name: c.name,
                type: c.type,
                sizeMm: { width: 600, depth: 600, height: 600 },
                color: "#888888",
              });
          meshRoot.name = c.id;
          meshRoot.userData = { roomRole: "item", itemId: c.id, catalogId: c.catalogId };
          meshRoot.position.set(
            c.positionMm.x / 1000,
            baseY + c.positionMm.y / 1000,
            c.positionMm.z / 1000
          );
          meshRoot.rotation.y = (c.rotationDeg * Math.PI) / 180;
          meshRoot.scale.set(c.scale.x, c.scale.y, c.scale.z);
          levelGroup.add(meshRoot);
        }
        root.add(levelGroup);
      }
      enhancePbrMaterials(root);
      const buffer = await exportSceneToBuffer(root);
      return { ok: true, buffer, errors, warnings };
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
      return { ok: false, buffer: null, errors, warnings };
    }
  },

  /** Exporta layout AI (cena completa anotada com aiPreset). */
  async exportAiLayout(state: RoomState): Promise<GlbExportResult> {
    const result = await GlbExporter.exportRoomState(state);
    if (!result.ok || !result.buffer) return result;
    if (!state.aiPreset) {
      result.warnings.push("Sala sem aiPreset — exportada como sala completa");
    }
    return result;
  },

  /** Dispara download no browser. */
  downloadBuffer(buffer: ArrayBuffer, fileName = "pimo-room.glb"): void {
    const blob = new Blob([buffer], { type: "model/gltf-binary" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  },

  downloadJson(data: unknown, fileName = "pimo-room-metadata.json"): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  },

  async exportAndDownload(state: RoomState, fileName?: string): Promise<GlbExportResult> {
    const result = await GlbExporter.exportRoomState(state);
    if (result.ok && result.buffer) {
      GlbExporter.downloadBuffer(result.buffer, fileName ?? `pimo-room-${state.id}.glb`);
    }
    return result;
  },
};
