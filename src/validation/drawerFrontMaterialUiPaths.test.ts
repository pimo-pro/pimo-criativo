/**
 * Contrato de sincronização viewer ↔ material da frente da gaveta.
 *
 * Caminhos UI auditados (todos devem chegar a ViewerCore.updateDrawerMaterial):
 * 1. DrawerConfigPanel → onFrontMaterialChange → GavetasPopoverPanel → viewerApi.updateDrawerMaterial
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
} from "../3d/objects/DrawerFactory";
import { generateDrawerGroup, drawerGroupToLayerItems } from "../core/drawers";
import { settingsDefaults } from "../core/settings/settingsSchema";
import { syncDrawerFrontMaterialToViewer } from "../industrial/viewerIntegration";
import { setActiveViewerCore } from "../core/viewer/pimoViewerRuntime";

vi.mock("../3d/objects/BoxMaterialApplier", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../3d/objects/BoxMaterialApplier")>();
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0xb8a898 });
  const faceMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, name: "MOCK_FRONT" });
  return {
    ...actual,
    getEdgeMaterial: () => edgeMat,
    getMaterialForOfficialId: () => faceMat,
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

    it("GavetasPopoverPanel liga onFrontMaterialChange a setDrawerMaterial e updateDrawerMaterial", () => {
      const src = readSrc("components/layout/left-panel/GavetasPopoverPanel.tsx");
      expect(src).toContain("onFrontMaterialChange=");
      expect(src).toContain("actions.setDrawerMaterial");
      expect(src).toContain("updateDrawerMaterial");
    });

    it("HomeLeftPanelSelected embute GavetasPopoverPanel no botão Gavetas", () => {
      const src = readSrc("components/layout/left-panel/HomeLeftPanelSelected.tsx");
      expect(src).toContain("GavetasPopoverPanel");
      expect(src).toContain("onCountChange={(v) => actions.setGavetas(v)}");
    });

    it("BoxLayersPanel (Opções do box) não contém configuração de gavetas", () => {
      const src = readSrc("components/layout/left-panel/BoxLayersPanel.tsx");
      expect(src).not.toContain("DrawerConfigPanel");
      expect(src).not.toContain("setDrawerMaterial");
    });

    it("SelecionarMaterialSection chama setDrawerMaterial e onDrawerMaterialChange", () => {
      const src = readSrc("components/settings/material/SelecionarMaterialSection.tsx");
      expect(src).toContain("actions.setDrawerMaterial");
      expect(src).toContain("onDrawerMaterialChange?.(");
    });

    it("setDrawerMaterial sincroniza viewer via syncDrawerFrontMaterialToViewer", () => {
      const src = readSrc("context/hooks/useLayerActions.ts");
      expect(src).toContain("syncDrawerFrontMaterialToViewer");
      expect(src).toContain("setDrawerMaterial:");
    });

    it("ContextMenu multi-seleção chama updateDrawerMaterial para gavetas", () => {
      const src = readSrc("components/layout/workspace/ContextMenu.tsx");
      expect(src).toContain('decoded.kind === "drawer"');
      expect(src).toContain("updateDrawerMaterial");
    });

    it("updateDrawerMaterial reconstrói a gaveta como updateDoorMaterial", () => {
      const src = readSrc("3d/viewer-engine/ViewerCoreMaterialOps.ts");
      expect(src).toContain("createDrawerObject(spec,");
      expect(src).toContain("getDrawerSpecFromGroup");
      expect(src).toMatch(/updateDrawerMaterial[\s\S]*?createDrawerObject[\s\S]*?deps\.requestRender\(\)/);
    });

    it("HomeLeftPanelSelected liga onDrawerMaterialChange a updateDrawerMaterial", () => {
      const src = readSrc("components/layout/left-panel/HomeLeftPanelSelected.tsx");
      expect(src).toContain("onDrawerMaterialChange={(boxId, drawerLayerId, materialName)");
      expect(src).toContain("viewerApi?.updateDrawerMaterial?.(");
      expect(src).toContain("nextItems");
    });
  });

  describe("applyDrawerFrontMaterialToMesh — peça completa", () => {
    it("createDrawerObject usa singleMaterial; apply cobre +Z/−Z/orlas", () => {
      const mesh = buildDrawerFrontMesh();
      expect(Array.isArray(mesh.material)).toBe(false);

      applyDrawerFrontMaterialToMesh(mesh, "carvalho");
      expect(Array.isArray(mesh.material)).toBe(false);
      expect(mesh.material).toBeInstanceOf(THREE.Material);
    });
  });

  describe("syncDrawerFrontMaterialToViewer", () => {
    const updateDrawerMaterial = vi.fn();

    beforeEach(() => {
      updateDrawerMaterial.mockClear();
      setActiveViewerCore({ updateDrawerMaterial } as never);
      vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      });
    });

    afterEach(() => {
      setActiveViewerCore(null);
      vi.unstubAllGlobals();
    });

    it("delega a PimoViewerApi.updateDrawerMaterial com id canónico", () => {
      syncDrawerFrontMaterialToViewer("box-1", "drawer-1", "mdf_branco");
      expect(updateDrawerMaterial).toHaveBeenCalledWith(
        "box-1",
        "drawer-1",
        "mdf_branco",
        undefined
      );
    });
  });
});
