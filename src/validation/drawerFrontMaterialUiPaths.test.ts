/**
 * Contrato de sincronização viewer ↔ material da frente da gaveta.
 *
 * Caminhos UI auditados (todos devem chegar a ViewerCore.updateDrawerMaterial):
 * 1. DrawerConfigPanel → onFrontMaterialChange → BoxLayersPanel → viewerApi.updateDrawerMaterial
 * 2. SelecionarMaterialSection → setDrawerMaterial → syncDrawerFrontMaterialToViewer
 *    + onDrawerMaterialChange (HomeLeftPanelSelected / Workspace)
 * 3. ContextMenu (gaveta única) → onDrawerMaterialChange → setDrawerMaterial + updateDrawerMaterial
 * 4. ContextMenu (multi-seleção) → updateDrawerMaterial por drawer + setSelectedObjectsMaterial
 * 5. useCalculadoraSync → syncDrawerFrontMaterialToViewer (fallback sem rebuild)
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import * as THREE from "three";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  applyDrawerFrontMaterialToMesh,
  buildDrawerSpecs,
  createDrawerObject,
  resolveDrawerFrontFaceMaterialIndex,
} from "../3d/objects/DrawerFactory";
import { generateDrawerGroup, drawerGroupToLayerItems } from "../core/drawers";
import { settingsDefaults } from "../core/settings/settingsSchema";
import { syncDrawerFrontMaterialToViewer } from "../core/viewer/viewerIntegration";

vi.mock("../3d/objects/BoxMaterialApplier", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../3d/objects/BoxMaterialApplier")>();
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0xb8a898 });
  return {
    ...actual,
    getEdgeMaterial: () => edgeMat,
  };
});

const SRC = resolve(__dirname, "..");

function readSrc(relativePath: string): string {
  return readFileSync(resolve(SRC, relativePath), "utf8");
}

function buildDrawerFrontMesh(): THREE.Mesh {
  const group = generateDrawerGroup({
    boxWidth: 600,
    boxHeight: 280,
    boxDepth: 560,
    boxThickness: 19,
    boxId: "ui-paths",
    drawerCount: 1,
    drawerType: "normal",
    heightMode: "equal",
    availableDepths: settingsDefaults.gavetas.gavetaProfundidadesDisponiveisMm,
    drawerSettings: settingsDefaults.gavetas,
    espessuraCostaMm: 10,
    costaAtiva: true,
  });
  const [layer] = drawerGroupToLayerItems(group);
  const [spec] = buildDrawerSpecs([layer]);
  const front = new THREE.MeshStandardMaterial({ color: 0xcccccc });
  const body = new THREE.MeshStandardMaterial({ color: 0x666666 });
  const drawerLayer = createDrawerObject(spec, { front, body });
  let mesh: THREE.Mesh | undefined;
  drawerLayer.traverse((child) => {
    if (mesh) return;
    if (
      child instanceof THREE.Mesh &&
      child.userData?.drawerPart === "front" &&
      child.name.includes("drawer-front-ext")
    ) {
      mesh = child;
    }
  });
  if (!mesh) throw new Error("frente não encontrada");
  return mesh;
}

describe("drawer front material — caminhos UI e contrato viewer", () => {
  describe("auditoria estática dos ficheiros UI", () => {
    it("DrawerConfigPanel dispara onFrontMaterialChange no select de material", () => {
      const src = readSrc("components/panels/DrawerConfigPanel.tsx");
      expect(src).toContain("onFrontMaterialChange?.(materialId)");
      expect(src).toContain("metadata: { frontMaterial: materialId }");
    });

    it("BoxLayersPanel liga onFrontMaterialChange a updateDrawerMaterial", () => {
      const src = readSrc("components/layout/left-panel/BoxLayersPanel.tsx");
      expect(src).toContain("onFrontMaterialChange=");
      expect(src).toContain("updateDrawerMaterial");
    });

    it("SelecionarMaterialSection chama setDrawerMaterial e onDrawerMaterialChange", () => {
      const src = readSrc("components/settings/material/SelecionarMaterialSection.tsx");
      expect(src).toContain("actions.setDrawerMaterial");
      expect(src).toContain("onDrawerMaterialChange?.(");
    });

    it("setDrawerMaterial sincroniza viewer via syncDrawerFrontMaterialToViewer", () => {
      const src = readSrc("context/hooks/useLayerActions.ts");
      expect(src).toContain("syncDrawerFrontMaterialToViewer(boxId, drawerLayerId, material)");
    });

    it("ContextMenu multi-seleção chama updateDrawerMaterial para gavetas", () => {
      const src = readSrc("components/layout/workspace/ContextMenu.tsx");
      expect(src).toContain('decoded.kind === "drawer"');
      expect(src).toContain("updateDrawerMaterial");
    });

    it("ViewerCore.updateDrawerMaterial usa applyDrawerFrontMaterialToMesh e requestRender", () => {
      const src = readSrc("3d/viewer-engine/ViewerCore.ts");
      expect(src).toContain("applyDrawerFrontMaterialToMesh(child, drawerMat)");
      expect(src).toMatch(/updateDrawerMaterial[\s\S]*?this\.requestRender\(\)/);
    });
  });

  describe("applyDrawerFrontMaterialToMesh — face larga vs orla", () => {
    it("grupos 4/5 recebem faceMaterial; índice 0 permanece edge", () => {
      const mesh = buildDrawerFrontMesh();
      const geometryUuid = mesh.geometry.uuid;
      const edgeBefore = (mesh.material as THREE.Material[])[0];

      const faceIndex = resolveDrawerFrontFaceMaterialIndex(mesh);
      expect(faceIndex).toBe(1);

      const groups = (mesh.geometry as THREE.BufferGeometry).groups;
      expect(groups[4]?.materialIndex).toBe(1);
      expect(groups[5]?.materialIndex).toBe(1);
      expect(groups[0]?.materialIndex).toBe(0);

      applyDrawerFrontMaterialToMesh(mesh, new THREE.MeshStandardMaterial({ color: 0x113355 }));

      expect(mesh.geometry.uuid).toBe(geometryUuid);
      const materials = mesh.material as THREE.Material[];
      expect(materials[0]).toBe(edgeBefore);
      expect((materials[0] as THREE.MeshStandardMaterial).color.getHex()).toBe(0xb8a898);
      expect((materials[faceIndex] as THREE.MeshStandardMaterial).color.getHex()).toBe(0x113355);
    });
  });

  describe("syncDrawerFrontMaterialToViewer", () => {
    const updateDrawerMaterial = vi.fn();

    beforeEach(() => {
      updateDrawerMaterial.mockClear();
      vi.stubGlobal("window", { viewerCore: { updateDrawerMaterial } });
      vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("delega a viewerCore.updateDrawerMaterial com id canónico", () => {
      syncDrawerFrontMaterialToViewer("box-1", "drawer-1", "mdf_branco");
      expect(updateDrawerMaterial).toHaveBeenCalledWith("box-1", "drawer-1", "mdf_branco");
    });
  });
});
