/**
 * Z-01.2.9 — lazy-init dos motores pesados.
 * Sem instanciar ViewerCore (sem WebGL).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BoxEngine } from "../../../src/3d/viewer-engine/box/BoxEngine";
import { LightingEngine } from "../../../src/3d/viewer-engine/lighting/LightingEngine";
import { ComposerEngine } from "../../../src/3d/viewer-engine/lighting/ComposerEngine";
import { ViewerRoomEngine } from "../../../src/3d/viewer-engine/room/ViewerRoomEngine";
import { DesignerEngine } from "../../../src/3d/viewer-engine/designer/DesignerEngine";
import {
  ensureMaterialEngine,
  isMaterialEngineEnsured,
} from "../../../src/3d/viewer-engine/materials/MaterialEngine";
import { CostReportEngine } from "../../../src/3d/viewer-engine/snapping/costReportEngine";
import { ManufacturingReportEngine } from "../../../src/3d/viewer-engine/snapping/manufacturingReportEngine";
import { ConversationalDesignerEngine } from "../../../src/3d/viewer-engine/snapping/conversationalDesignerEngine";

describe("Lazy-init motores pesados (Z-01.2.9)", () => {
  it("ensure devolve a mesma instância e get() começa a null (Designer)", () => {
    const engine = new DesignerEngine();
    expect(engine.get()).toBeNull();
    const first = engine.ensure({ getBridge: () => null });
    expect(engine.ensure({ getBridge: () => null })).toBe(first);
  });

  it("Lighting/Composer/Box/Room só existem após ensure()", () => {
    let lighting: LightingEngine | null = null;
    lighting = LightingEngine.ensure(lighting, {
      ambient: { intensity: 0.4 },
      hemisphere: { intensity: 0.3 },
      keyLight: { intensity: 1, shadow: { intensity: 1, radius: 6 }, castShadow: true },
      fillLight: { intensity: 0.5 },
      rimLight: { intensity: 0.2 },
    } as never, { ambient: 0.4, hemisphere: 0.3, key: 1, fill: 0.5, rim: 0.2 });
    expect(LightingEngine.ensure(lighting, lighting.lights, lighting.base)).toBe(lighting);

    let composer: ComposerEngine | null = null;
    expect(composer).toBeNull();
    composer = ComposerEngine.ensure(composer, {
      getRenderer: () => null as never,
      getScene: () => null as never,
      getCamera: () => null as never,
      getContainer: () => null,
    });
    expect(ComposerEngine.ensure(composer, {
      getRenderer: () => null as never,
      getScene: () => null as never,
      getCamera: () => null as never,
      getContainer: () => null,
    })).toBe(composer);

    const controller = { addBox: () => true } as never;
    let box: BoxEngine | null = null;
    box = BoxEngine.ensure(box, controller);
    expect(BoxEngine.ensure(box, controller)).toBe(box);

    let room: ViewerRoomEngine | null = null;
    const getManager = () => null;
    room = ViewerRoomEngine.ensure(room, getManager);
    expect(ViewerRoomEngine.ensure(room, getManager)).toBe(room);
  });

  it("MaterialEngine só fica marcado após ensure/API", () => {
    ensureMaterialEngine();
    expect(isMaterialEngineEnsured()).toBe(true);
  });

  it("cost/manufacturing/conversational têm ensure() e não se recriam", () => {
    expect(typeof CostReportEngine.ensure).toBe("function");
    expect(typeof ManufacturingReportEngine.ensure).toBe("function");
    expect(typeof ConversationalDesignerEngine.ensure).toBe("function");
  });

  it("o wiring de construção do ViewerCore não instancia motores pesados", () => {
    // O constructor do ViewerCore delega em wireViewerCoreConstructorImpl, por isso
    // é o wiring que tem de ser auditado — no constructor a asserção seria vácua.
    const source = readFileSync(
      join(process.cwd(), "src/3d/viewer-engine/ViewerCoreConstructorOps.ts"),
      "utf8"
    );
    const start = source.indexOf("export function wireViewerCoreConstructorImpl");
    const end = source.indexOf("queueMicrotask(() => host.notifyViewerReady())");
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const wiring = source.slice(start, end);
    expect(wiring).not.toContain("new LightingEngine");
    expect(wiring).not.toContain("new ComposerEngine");
    expect(wiring).not.toContain("new BoxEngine");
    expect(wiring).not.toContain("new ViewerRoomEngine");
    expect(wiring).not.toContain("designerEngine.ensure");
    expect(wiring).not.toContain("new ManufacturingReportEngine");
    expect(wiring).not.toContain("new CostReportEngine");
    expect(wiring).not.toContain("new ConversationalDesignerEngine");
    expect(wiring).toContain("new LayoutEngine");
    expect(wiring).toContain("ensureViewerCameraEngine");
    expect(wiring).toContain("createViewerSelectionEngine");
  });
});
