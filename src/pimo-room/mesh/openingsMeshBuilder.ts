/**
 * openingsMeshBuilder — fachada de aberturas (portas/janelas) vNext.
 * Delega nos elementos WebGL existentes (paridade visual).
 * M10: inline quando DoorElement/WindowElement saírem de src/3d/room.
 */
import type { DoorWindowConfig } from "../../3d/room/types";
import { DoorElement } from "../../3d/room/elements/DoorElement";
import { WindowElement } from "../../3d/room/elements/WindowElement";
import type * as THREE from "three";

export type OpeningMeshKind = "door" | "window";

export type OpeningMeshResult = {
  kind: OpeningMeshKind;
  group: THREE.Group;
  elementId: string;
};

function resolveElementId(elementId: string | undefined, kind: OpeningMeshKind): string {
  return elementId ?? `${kind}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Constrói mesh de porta na parede (group Three.js). */
export function buildDoorOpeningMesh(
  config: DoorWindowConfig,
  elementId?: string
): OpeningMeshResult {
  const id = resolveElementId(elementId, "door");
  return {
    kind: "door",
    group: DoorElement.create(config, id),
    elementId: id,
  };
}

/** Constrói mesh de janela na parede. */
export function buildWindowOpeningMesh(
  config: DoorWindowConfig,
  elementId?: string
): OpeningMeshResult {
  const id = resolveElementId(elementId, "window");
  return {
    kind: "window",
    group: WindowElement.create(config, id),
    elementId: id,
  };
}

/**
 * Factory unificada: tipo → mesh de abertura.
 */
export function openingsMeshBuilder(
  type: OpeningMeshKind,
  config: DoorWindowConfig,
  elementId?: string
): OpeningMeshResult {
  return type === "door"
    ? buildDoorOpeningMesh(config, elementId)
    : buildWindowOpeningMesh(config, elementId);
}

export { DoorElement, WindowElement };
