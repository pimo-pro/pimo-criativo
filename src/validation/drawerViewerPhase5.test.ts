import { describe, expect, it } from "vitest";
import {
  DRAWER_VERTICAL_BASE_OFFSET_MM,
  resolveDrawerVerticalPosition,
  resolveDrawerVerticalPositions,
} from "../core/drawers/drawerVerticalPosition";
import { canOpenDrawer } from "../core/drawers/DrawerCollisionService";
import type { DrawerLayerItem } from "../models/BoxLayers";

describe("Drawer vertical position (FASE 5)", () => {
  it("usa offset base de 0 mm (Diff 3 — B0 flush)", () => {
    expect(DRAWER_VERTICAL_BASE_OFFSET_MM).toBe(0);
  });

  it("alinha posições com fórmula unificada", () => {
    const heights = [200, 200, 200];
    const boxH = 720;
    const positions = resolveDrawerVerticalPositions(heights, boxH);
    expect(positions[0]).toBe(resolveDrawerVerticalPosition(0, heights, boxH));
    expect(positions[1]).toBe(resolveDrawerVerticalPosition(1, heights, boxH));
    expect(positions[0]).toBe(-boxH / 2 + DRAWER_VERTICAL_BASE_OFFSET_MM + 100);
  });
});

describe("DrawerCollisionService (FASE 5)", () => {
  const baseDrawer = (overrides: Partial<DrawerLayerItem> = {}): DrawerLayerItem => ({
    id: "d1",
    parentBoxId: "b1",
    width: 560,
    height: 200,
    depth: 530,
    frontThickness: 19,
    openDirection: "pull",
    isOpen: false,
    pullDistanceMm: 500,
    posX: 0,
    posY: 0,
    posZ: 0,
    rotY: 0,
    ...overrides,
  });

  it("não bloqueia abertura no Viewer (outra gaveta aberta)", () => {
    const result = canOpenDrawer(
      baseDrawer({ id: "d2" }),
      {
        dimensoes: { largura: 600, altura: 720, profundidade: 560 },
        drawersLayer: [baseDrawer({ id: "d1", isOpen: true }), baseDrawer({ id: "d2" })],
        doorsLayer: [],
        portaTipo: "sem_porta",
        prateleiras: 0,
        gavetas: 2,
      },
      { drawerIndex: 1 }
    );
    expect(result.canOpen).toBe(true);
  });

  it("permite fechar gaveta aberta", () => {
    const result = canOpenDrawer(
      baseDrawer({ id: "d1", isOpen: true }),
      {
        dimensoes: { largura: 600, altura: 720, profundidade: 560 },
        drawersLayer: [baseDrawer({ id: "d1", isOpen: true })],
        doorsLayer: [],
        portaTipo: "sem_porta",
        prateleiras: 0,
        gavetas: 1,
      },
      { drawerIndex: 0 }
    );
    expect(result.canOpen).toBe(true);
  });

  it("permite várias abertas em modo sequencial", () => {
    const result = canOpenDrawer(
      baseDrawer({ id: "d2" }),
      {
        dimensoes: { largura: 600, altura: 720, profundidade: 560 },
        drawersLayer: [baseDrawer({ id: "d1", isOpen: true }), baseDrawer({ id: "d2" })],
        doorsLayer: [],
        portaTipo: "sem_porta",
        prateleiras: 0,
        gavetas: 2,
      },
      { drawerIndex: 1, allowMultipleOpen: true }
    );
    expect(result.canOpen).toBe(true);
  });
});
