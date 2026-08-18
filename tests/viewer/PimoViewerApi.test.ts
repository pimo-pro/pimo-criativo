/**
 * Z-01.2.8 — contrato público PimoViewerApi + runtime canónico.
 * Sem instanciar o ViewerCore (sem WebGL).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getPimoViewerStubApi } from "../../src/context/pimoViewerStubApi";
import {
  getActivePimoViewerApi,
  getActiveViewerCore,
  setActivePimoViewerApi,
  setActiveViewerCore,
  type ViewerCoreRuntime,
} from "../../src/core/viewer/pimoViewerRuntime";
import { isViewerApiReady, isViewerCoreReady } from "../../src/core/viewer/viewerReadiness";
import { ProjectLoader } from "../../src/core/viewer/formats/ProjectLoader";
import type { ProjectState } from "../../src/context/projectTypes";
import type { PimoViewerApi } from "../../src/context/PimoViewerContextCore";

const SRC_ROOT = join(process.cwd(), "src");
const WINDOW_VIEWER_CORE_ALLOWLIST = new Set([
  "src/components/layout/workspace/Workspace.tsx",
  "src/hooks/viewer/viewerCoreWindow.d.ts",
  "src/core/viewer/pimoViewerRuntime.ts",
  "src/core/viewer/viewerReadiness.ts",
  "src/3d/viewer-engine/ViewerCore.ts",
  "src/3d/viewer-engine/core/ViewerCoreAudit.ts",
]);

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) return listSourceFiles(path);
    if (!/\.(ts|tsx)$/.test(entry)) return [];
    return [path];
  });
}

function posixRelative(file: string): string {
  return relative(process.cwd(), file).split(sep).join("/");
}

afterEach(() => {
  setActiveViewerCore(null);
  setActivePimoViewerApi(null);
});

describe("PimoViewerApi (Z-01.2.8)", () => {
  it("o stub é sempre válido, viewerReady false, addBox e setMeasurementMode existem", () => {
    const api = getPimoViewerStubApi();
    expect(api.viewerReady).toBe(false);
    expect(isViewerApiReady(api)).toBe(false);
    expect(typeof api.addBox).toBe("function");
    expect(typeof api.setMeasurementMode).toBe("function");
    expect(typeof api.getMeasurementMode).toBe("function");
    expect(api.addBox("box-1")).toBe(false);
    api.setMeasurementMode?.(true);
    expect(api.getMeasurementMode?.()).toBe(false);
  });

  it("getActiveViewerCore e getActivePimoViewerApi expõem a instância pronta", () => {
    const dispose = vi.fn();
    const addBox = vi.fn(() => true);
    const setMeasurementMode = vi.fn();
    const core = {
      viewerReady: true,
      addBox,
      setMeasurementMode,
      getMeasurementMode: () => true,
      dispose,
    } as unknown as ViewerCoreRuntime;
    const api = {
      ...getPimoViewerStubApi(),
      viewerReady: true,
      addBox,
      setMeasurementMode,
      getMeasurementMode: () => true,
    } as PimoViewerApi;

    setActiveViewerCore(core);
    setActivePimoViewerApi(api);

    expect(getActiveViewerCore()).toBe(core);
    expect(getActivePimoViewerApi()).toBe(api);
    expect(isViewerCoreReady(getActiveViewerCore())).toBe(true);
    expect(isViewerApiReady(getActivePimoViewerApi())).toBe(true);
    expect(getActivePimoViewerApi()?.addBox("box-facade")).toBe(true);
    getActivePimoViewerApi()?.setMeasurementMode?.(true);
    expect(setMeasurementMode).toHaveBeenCalledWith(true);

    dispose();
    setActiveViewerCore(null);
    setActivePimoViewerApi(null);
    expect(getActiveViewerCore()).toBeNull();
    expect(getActivePimoViewerApi()).toBeNull();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("load pimo-project mínimo mantém posições e dimensões em mm", () => {
    const state = {
      projectName: "Fachada Z-01.2.8",
      workspaceBoxes: [
        {
          id: "box-1",
          posicaoX_mm: 600,
          posicaoY_mm: 360,
          posicaoZ_mm: 300,
          dimensoes: { largura: 600, altura: 720, profundidade: 560 },
          models: [],
        },
      ],
    } as unknown as ProjectState;

    const result = new ProjectLoader().load({ json: state });
    expect(result.format).toBe("pimo-project");
    expect(result.validation.ok).toBe(true);
    expect(result.normalized?.units).toBe("mm");
    expect(result.normalized?.workspaceBoxes[0]?.posicaoX_mm).toBe(600);
    expect(result.normalized?.workspaceBoxes[0]?.dimensoes.largura).toBe(600);
    expect(result.normalized?.pimoProjectRef).toBe(state);
  });

  it("nenhum consumidor de produto chama window.viewerCore (só a ponte Workspace)", () => {
    const offenders = listSourceFiles(SRC_ROOT)
      .map((file) => posixRelative(file))
      .filter((file) => !WINDOW_VIEWER_CORE_ALLOWLIST.has(file))
      .filter((file) => !file.includes(".test."))
      .filter((file) => {
        const source = readFileSync(join(process.cwd(), file), "utf8");
        return source.includes("window.viewerCore");
      });

    expect(offenders).toEqual([]);
  });
});
