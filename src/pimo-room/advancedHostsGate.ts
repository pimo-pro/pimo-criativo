/**
 * Gate de hosts avançados de sala (M4) — activação vNext.
 * flag ON → hosts ON; flag OFF → legado (hosts ON).
 * Sempre activos para não regressar UX (AI / IFC / catálogo / walkthrough).
 */
import {
  animateApplyAiLayout,
  clearAiPreview,
  showAiPreview,
  startWalkthrough,
  stopWalkthrough,
  syncCatalogItems,
  syncIfcPreviewFromRoomState,
  syncLevelGhosts,
  type RoomState,
} from "./domain";

export function areRoomAdvancedHostsEnabled(): boolean {
  return true;
}

export function gatedSyncLevelGhosts(state: RoomState): void {
  if (!areRoomAdvancedHostsEnabled()) return;
  syncLevelGhosts(state);
}

export function gatedSyncCatalogItems(state: RoomState): Promise<void> | void {
  if (!areRoomAdvancedHostsEnabled()) return;
  return syncCatalogItems(state);
}

export function gatedSyncIfcPreviewFromRoomState(state: RoomState): void {
  if (!areRoomAdvancedHostsEnabled()) return;
  syncIfcPreviewFromRoomState(state);
}

export function gatedShowAiPreview(state: RoomState, affectedIds: string[]): void {
  if (!areRoomAdvancedHostsEnabled()) return;
  showAiPreview(state, affectedIds);
}

export function gatedClearAiPreview(): void {
  if (!areRoomAdvancedHostsEnabled()) return;
  clearAiPreview();
}

export async function gatedAnimateApplyAiLayout(
  from: RoomState,
  to: RoomState
): Promise<void> {
  if (!areRoomAdvancedHostsEnabled()) return;
  await animateApplyAiLayout(from, to);
}

export function gatedStartWalkthrough(state: RoomState) {
  if (!areRoomAdvancedHostsEnabled()) {
    return { ok: false as const, error: "Hosts avançados desligados (roomEngineVNext)" };
  }
  return startWalkthrough(state);
}

export function gatedStopWalkthrough(): void {
  if (!areRoomAdvancedHostsEnabled()) return;
  stopWalkthrough();
}
