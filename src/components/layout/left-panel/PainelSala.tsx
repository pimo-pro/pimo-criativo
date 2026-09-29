/**
 * pimo-room v4 — painel de configurações da sala (Salão).
 * Controlos em mm; tokens de tema existentes; sem referências externas.
 */
import { useMemo, useRef, useState } from "react";
import { useProject } from "../../../context/useProject";
import Panel from "../../ui/Panel";
import { useUiStore, uiStore } from "../../../stores/uiStore";
import { wallStore, useWallStore } from "../../../stores/wallStore";
import { usePimoViewerContext } from "../../../hooks/usePimoViewerContext";
import {
  ROOM_20_DEFAULTS,
  WALL_LABEL_TITLES,
  createDefaultProjectRoom,
  applyProjectRoomDimensions,
  normalizeProjectRoom,
} from "../../../3d/viewer-engine/room/RoomEngine";
import type {
  ProjectRoomOpening,
  ProjectRoomWall,
  RoomOpeningKind,
} from "../../../3d/viewer-engine/room/roomEngineTypes";
import { Icon } from "../../icons/Icon";
import {
  alignOpeningHorizontal,
  alignOpeningVertical,
  refineOpeningPlacement,
  type OpeningHorizontalAlign,
  type OpeningVerticalAlign,
} from "../../../utils/openingConstraints";
import { applyWallLengthToRoom } from "../../../3d/room/roomAdvancedEdit";
import {
  computeZoneMetrics,
  createMainZoneFromRoom,
  ensureRoomZones,
} from "../../../3d/room/roomZones";
import { autoZonesFromClosedLoops } from "../../../3d/room/roomAutoZones";
import {
  AI_PRESETS,
  AboutRoomEngineModal,
  AiEngine,
  CATALOG_PRESETS,
  CatalogItemManager,
  GlbExporter,
  MATERIAL_PRESETS,
  PIMO_ALFA_VERSION,
  ROOM_ENGINE_VERSION,
  RoomBridge,
  RoomConverter,
  RoomEngineBoundary,
  RoomLevelManager,
  SlabEngine,
  animateApplyAiLayout,
  buildRoomReportMetadata,
  clearAiPreview,
  selectCatalogItem,
  showAiPreview,
  startWalkthrough,
  stopWalkthrough,
  syncCatalogItems,
  syncIfcPreviewFromRoomState,
  syncLevelGhosts,
  useRoomEngineStore,
  type AiPresetId,
} from "../../../pimo-room-v4";

const DEFAULT_OPENING = {
  door: { widthMm: 900, heightMm: 2100, thicknessMm: 40, floorOffsetMm: 0 },
  window: { widthMm: 1200, heightMm: 1200, thicknessMm: 40, floorOffsetMm: 900 },
} as const;

function numField(
  label: string,
  value: number,
  onChange: (_n: number) => void,
  opts?: { min?: number; step?: number; suffix?: string }
) {
  return (
    <div className="panel-field-row">
      <label className="panel-label" style={{ minWidth: 110 }}>
        {label}
      </label>
      <input
        className="input input-sm"
        type="number"
        min={opts?.min ?? 100}
        step={opts?.step ?? 10}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ flex: 1 }}
      />
      {opts?.suffix ? (
        <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 28 }}>{opts.suffix}</span>
      ) : null}
    </div>
  );
}

function makeOpening(
  type: "door" | "window",
  kind: RoomOpeningKind,
  wall: ProjectRoomWall
): ProjectRoomOpening {
  const defaults = DEFAULT_OPENING[type];
  const xPosMm = Math.max(0, ((wall.widthMm ?? wall.lengthMm) - defaults.widthMm) / 2);
  return {
    id: `room-opening-${type}-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    kind,
    wallId: wall.id,
    xPosMm,
    horizontalOffsetMm: xPosMm,
    widthMm: defaults.widthMm,
    heightMm: defaults.heightMm,
    thicknessMm: defaults.thicknessMm,
    floorOffsetMm: defaults.floorOffsetMm,
    verticalOffsetMm: defaults.floorOffsetMm,
  };
}

function roomDimsSyncKey(
  room: { widthMm: number; depthMm: number; heightMm: number; wallThicknessMm: number } | null | undefined
): string {
  if (!room) return "none";
  return `${room.widthMm}|${room.depthMm}|${room.heightMm}|${room.wallThicknessMm}`;
}

export function PainelSala() {
  const { project, actions } = useProject();
  const { viewerApi } = usePimoViewerContext();
  const room = project.room;
  const wallEditMode = project.viewerSettings.wallEditMode === true;
  const selectedObject = useUiStore((s) => s.selectedObject);
  const selectedWallId = useWallStore((s) => s.selectedWallId);
  const setRoomPanelOpen = useUiStore((s) => s.setRoomPanelOpen);
  const snapEnabled = useUiStore((s) => s.roomOpeningSnapEnabled);
  const setRoomOpeningSnapEnabled = useUiStore((s) => s.setRoomOpeningSnapEnabled);
  const importInputRef = useRef<HTMLInputElement>(null);
  const ifcInputRef = useRef<HTMLInputElement>(null);
  const glbRoomInputRef = useRef<HTMLInputElement>(null);
  const glbItemInputRef = useRef<HTMLInputElement>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const engineState = useRoomEngineStore((s) => s.roomState);
  const walkthroughActive = useRoomEngineStore((s) => s.walkthroughActive);
  const slabEditOpen = useRoomEngineStore((s) => s.slabEditOpen);
  const selectedItemId = useRoomEngineStore((s) => s.selectedItemId);
  const aiPreviewState = useRoomEngineStore((s) => s.aiPreviewState);
  const aiStyleId = useRoomEngineStore((s) => s.aiStyleId);
  const setWalkthroughActive = useRoomEngineStore((s) => s.setWalkthroughActive);
  const setSlabEditOpen = useRoomEngineStore((s) => s.setSlabEditOpen);
  const setRoomEngineState = useRoomEngineStore((s) => s.setRoomState);
  const patchRoomEngineState = useRoomEngineStore((s) => s.patchRoomState);
  const setSelectedItemId = useRoomEngineStore((s) => s.setSelectedItemId);
  const setAiPreview = useRoomEngineStore((s) => s.setAiPreview);
  const setAiStyleId = useRoomEngineStore((s) => s.setAiStyleId);
  const clearAiPreviewStore = useRoomEngineStore((s) => s.clearAiPreview);
  const [catalogPresetId, setCatalogPresetId] = useState(CATALOG_PRESETS[0]?.id ?? "chair-basic");
  const [aboutOpen, setAboutOpen] = useState(false);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const dimsKey = roomDimsSyncKey(room);
  const [widthMm, setWidthMm] = useState<number>(room?.widthMm ?? ROOM_20_DEFAULTS.widthMm);
  const [depthMm, setDepthMm] = useState<number>(room?.depthMm ?? ROOM_20_DEFAULTS.depthMm);
  const [heightMm, setHeightMm] = useState<number>(room?.heightMm ?? ROOM_20_DEFAULTS.heightMm);
  const [thicknessMm, setThicknessMm] = useState<number>(
    room?.wallThicknessMm ?? ROOM_20_DEFAULTS.wallThicknessMm
  );
  const [syncedDimsKey, setSyncedDimsKey] = useState(dimsKey);

  // Sincroniza rascunho local com `room` sem useEffect (padrão React: ajustar state no render).
  if (syncedDimsKey !== dimsKey) {
    setSyncedDimsKey(dimsKey);
    setWidthMm(room?.widthMm ?? ROOM_20_DEFAULTS.widthMm);
    setDepthMm(room?.depthMm ?? ROOM_20_DEFAULTS.depthMm);
    setHeightMm(room?.heightMm ?? ROOM_20_DEFAULTS.heightMm);
    setThicknessMm(room?.wallThicknessMm ?? ROOM_20_DEFAULTS.wallThicknessMm);
  }

  const activeWall = useMemo(() => {
    if (!room) return null;
    if (selectedObject.type === "wall") {
      return room.walls.find((w) => w.id === selectedObject.id) ?? null;
    }
    if (selectedWallId) {
      return room.walls.find((w) => w.id === selectedWallId) ?? null;
    }
    return room.walls[0] ?? null;
  }, [room, selectedObject, selectedWallId]);

  const selectedOpening =
    selectedObject.type === "roomElement"
      ? room?.openings.find((o) => o.id === selectedObject.id) ?? null
      : null;

  const patchRoom = (patch: Parameters<typeof actions.updateProjectRoom>[0]) => {
    actions.updateProjectRoom(patch);
  };

  const handleCreate = () => {
    const base = createDefaultProjectRoom();
    const next = applyProjectRoomDimensions(
      normalizeProjectRoom({
        ...base,
        widthMm,
        depthMm,
        heightMm,
        wallThicknessMm: thicknessMm,
      }) ?? base
    );
    actions.setProjectRoom(next);
    wallStore.getState().setOpen(true);
  };

  const handleApplyDimensions = () => {
    if (!room) {
      handleCreate();
      return;
    }
    const merged = applyProjectRoomDimensions(
      normalizeProjectRoom({
        ...room,
        widthMm: Math.max(500, widthMm),
        depthMm: Math.max(500, depthMm),
        heightMm: Math.max(500, heightMm),
        wallThicknessMm: Math.max(50, thicknessMm),
      }) ?? room
    );
    actions.setProjectRoom(merged);
  };

  const handleRemove = () => {
    actions.removeProjectRoom();
    wallStore.getState().clearRoom();
    uiStore.getState().clearSelection();
  };

  const closeIoMenus = () => {
    setImportMenuOpen(false);
    setExportMenuOpen(false);
  };

  const applyImportedRoom = (
    result: Awaited<ReturnType<typeof RoomBridge.importFile>>,
    label: string
  ) => {
    if (!result.ok || !result.projectRoom || !result.state) {
      setImportMessage(result.errors[0] ?? `Falha ao importar ${label}`);
      return;
    }
    const normalized = normalizeProjectRoom(result.projectRoom) ?? result.projectRoom;
    setRoomEngineState(result.state);
    syncLevelGhosts(result.state);
    void syncCatalogItems(result.state);
    syncIfcPreviewFromRoomState(result.state);
    actions.setProjectRoom(normalized);
    wallStore.getState().setOpen(true);
    const levelsN = result.state.levels.length;
    const itemsN = result.state.items.length;
    const warn =
      result.warnings.length > 0 ? ` (${result.warnings.length} aviso(s))` : "";
    setImportMessage(
      `${label}: ${Math.round(normalized.widthMm)}×${Math.round(normalized.depthMm)} mm · ${levelsN} nível(is) · ${itemsN} item(ns)${warn}`
    );
  };

  const handleImportJsonFile = async (file: File | null) => {
    if (!file) return;
    setImportBusy(true);
    setImportMessage(null);
    closeIoMenus();
    try {
      const result = await RoomBridge.importFile(file);
      applyImportedRoom(result, "Sala importada");
    } catch (e) {
      setImportMessage(e instanceof Error ? e.message : "Erro ao importar");
    } finally {
      setImportBusy(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  const handleImportIfcFile = async (file: File | null) => {
    if (!file) return;
    setImportBusy(true);
    setImportMessage(null);
    closeIoMenus();
    try {
      const result = await RoomBridge.importIfcFile(file);
      applyImportedRoom(result, "IFC importado");
    } catch (e) {
      setImportMessage(e instanceof Error ? e.message : "Erro ao importar IFC");
    } finally {
      setImportBusy(false);
      if (ifcInputRef.current) ifcInputRef.current.value = "";
    }
  };

  const handleImportGlbRoom = async (file: File | null) => {
    if (!file) return;
    setImportBusy(true);
    setImportMessage(null);
    closeIoMenus();
    try {
      const result = await RoomBridge.importGlbFile(file, "room");
      applyImportedRoom(result, "GLB sala importado");
    } catch (e) {
      setImportMessage(e instanceof Error ? e.message : "Erro ao importar GLB");
    } finally {
      setImportBusy(false);
      if (glbRoomInputRef.current) glbRoomInputRef.current.value = "";
    }
  };

  const handleImportGlbItem = async (file: File | null) => {
    if (!file) return;
    setImportBusy(true);
    setImportMessage(null);
    closeIoMenus();
    try {
      const base =
        engineState ??
        (room ? RoomConverter.fromProjectRoomConfig(room) : null);
      if (!base) {
        setImportMessage("Crie ou importe uma sala antes de importar um item GLB");
        return;
      }
      const result = await RoomBridge.importGlbFile(file, "item", base);
      if (!result.ok || !result.state) {
        setImportMessage(result.errors[0] ?? "Falha ao importar item GLB");
        return;
      }
      setRoomEngineState(result.state);
      void syncCatalogItems(result.state);
      syncActiveLevelToProject(result.state);
      setImportMessage(`Item GLB importado: ${file.name}`);
    } catch (e) {
      setImportMessage(e instanceof Error ? e.message : "Erro ao importar item GLB");
    } finally {
      setImportBusy(false);
      if (glbItemInputRef.current) glbItemInputRef.current.value = "";
    }
  };

  const resolveExportState = () =>
    engineState ?? (room ? RoomConverter.fromProjectRoomConfig(room) : null);

  const handleExportGlbRoom = async () => {
    const state = resolveExportState();
    if (!state) {
      setImportMessage("Crie ou importe uma sala antes de exportar");
      return;
    }
    closeIoMenus();
    setImportBusy(true);
    setImportMessage(null);
    try {
      const result = await GlbExporter.exportAndDownload(state);
      if (!result.ok) {
        setImportMessage(result.errors[0] ?? "Falha ao exportar GLB");
        return;
      }
      setImportMessage("GLB (sala) exportado");
    } catch (e) {
      setImportMessage(e instanceof Error ? e.message : "Erro ao exportar GLB");
    } finally {
      setImportBusy(false);
    }
  };

  const handleExportGlbItems = async () => {
    const state = resolveExportState();
    if (!state) {
      setImportMessage("Crie ou importe uma sala antes de exportar");
      return;
    }
    closeIoMenus();
    setImportBusy(true);
    setImportMessage(null);
    try {
      const result = await GlbExporter.exportItemsOnly(state);
      if (!result.ok || !result.buffer) {
        setImportMessage(result.errors[0] ?? "Falha ao exportar itens GLB");
        return;
      }
      GlbExporter.downloadBuffer(result.buffer, `pimo-items-${state.id}.glb`);
      setImportMessage("GLB (itens) exportado");
    } catch (e) {
      setImportMessage(e instanceof Error ? e.message : "Erro ao exportar itens");
    } finally {
      setImportBusy(false);
    }
  };

  const handleExportJsonMetadata = () => {
    const state = resolveExportState();
    if (!state) {
      setImportMessage("Crie ou importe uma sala antes de exportar");
      return;
    }
    closeIoMenus();
    GlbExporter.downloadJson(buildRoomReportMetadata(state), `pimo-room-meta-${state.id}.json`);
    setImportMessage("JSON (metadata) exportado");
  };

  const handleExportAiLayoutGlb = async () => {
    const state = resolveExportState();
    if (!state) {
      setImportMessage("Crie ou importe uma sala antes de exportar");
      return;
    }
    closeIoMenus();
    setImportBusy(true);
    setImportMessage(null);
    try {
      const result = await GlbExporter.exportAiLayout(state);
      if (!result.ok || !result.buffer) {
        setImportMessage(result.errors[0] ?? "Falha ao exportar AI layout GLB");
        return;
      }
      GlbExporter.downloadBuffer(result.buffer, `pimo-ai-layout-${state.id}.glb`);
      setImportMessage("AI layout GLB exportado");
    } catch (e) {
      setImportMessage(e instanceof Error ? e.message : "Erro ao exportar AI layout");
    } finally {
      setImportBusy(false);
    }
  };

  const syncActiveLevelToProject = (nextEngine: typeof engineState) => {
    if (!nextEngine) return;
    const projectRoom = RoomConverter.toProjectRoomConfig(nextEngine);
    const normalized = normalizeProjectRoom(projectRoom) ?? projectRoom;
    actions.setProjectRoom(normalized);
    wallStore.getState().setOpen(true);
  };

  const handleAddLevel = () => {
    const base =
      engineState ??
      (room ? RoomConverter.fromProjectRoomConfig(room) : null);
    if (!base) {
      setImportMessage("Crie ou importe uma sala antes de adicionar níveis");
      return;
    }
    const next = RoomLevelManager.addLevelAbove(base);
    setRoomEngineState(next);
    syncActiveLevelToProject(next);
    syncLevelGhosts(next);
    void syncCatalogItems(next);
    setImportMessage(`Nível adicionado: ${next.levels[next.levels.length - 1]?.name ?? ""}`);
  };

  const handleSelectLevel = (levelId: string) => {
    if (!engineState) return;
    const next = RoomLevelManager.setActiveLevel(engineState, levelId);
    setRoomEngineState(next);
    syncActiveLevelToProject(next);
    syncLevelGhosts(next);
    void syncCatalogItems(next);
  };

  const ensureEngineState = () => {
    if (engineState) return engineState;
    if (!room) return null;
    const fromRoom = RoomConverter.fromProjectRoomConfig(room);
    setRoomEngineState(fromRoom);
    return fromRoom;
  };

  const handleAddCatalogItem = () => {
    const base = ensureEngineState();
    if (!base) {
      setImportMessage("Crie ou importe uma sala antes de adicionar itens");
      return;
    }
    const next = CatalogItemManager.add(base, catalogPresetId, {
      positionMm: { x: 0, y: 0, z: 0 },
      levelId: base.activeLevelId,
    });
    const added = next.items[next.items.length - 1];
    setRoomEngineState(next);
    syncActiveLevelToProject(next);
    void syncCatalogItems(next);
    if (added) {
      setSelectedItemId(added.id);
      selectCatalogItem(added.id);
    }
    setImportMessage(`Item adicionado: ${added?.name ?? catalogPresetId}`);
  };

  const handleRemoveCatalogItem = () => {
    if (!engineState || !selectedItemId) {
      setImportMessage("Seleccione um item para remover");
      return;
    }
    const next = CatalogItemManager.remove(engineState, selectedItemId);
    setRoomEngineState(next);
    setSelectedItemId(null);
    selectCatalogItem(null);
    syncActiveLevelToProject(next);
    void syncCatalogItems(next);
    setImportMessage("Item removido");
  };

  const handleDuplicateCatalogItem = () => {
    if (!engineState || !selectedItemId) {
      setImportMessage("Seleccione um item para duplicar");
      return;
    }
    const next = CatalogItemManager.duplicate(engineState, selectedItemId);
    const added = next.items[next.items.length - 1];
    setRoomEngineState(next);
    syncActiveLevelToProject(next);
    void syncCatalogItems(next);
    if (added) {
      setSelectedItemId(added.id);
      selectCatalogItem(added.id);
    }
    setImportMessage("Item duplicado");
  };

  const ensureEngineForAi = () => {
    const base =
      engineState ??
      (room ? RoomConverter.fromProjectRoomConfig(room) : null);
    if (!base) {
      setImportMessage("Crie ou importe uma sala antes de usar a AI");
      return null;
    }
    if (!engineState) setRoomEngineState(base);
    return base;
  };

  const handleAiAutoArrange = () => {
    const base = ensureEngineForAi();
    if (!base) return;
    if (CatalogItemManager.list(base, base.activeLevelId).length === 0) {
      setImportMessage("Adicione itens ao catálogo antes do Auto-Arrange");
      return;
    }
    const result = AiEngine.previewArrange(base);
    if (!result.previewState) {
      setImportMessage(result.errors[0] ?? "Falha no Auto-Arrange");
      return;
    }
    setAiPreview(result.previewState, "arrange", result.affectedIds);
    showAiPreview(result.previewState, result.affectedIds);
    setImportMessage(
      `Preview Auto-Arrange — ${result.affectedIds.length} item(ns). Aplicar Layout para confirmar.`
    );
  };

  const handleAiAutoDesign = () => {
    const base = ensureEngineForAi();
    if (!base) return;
    const result = AiEngine.previewDesign(base, {
      presetId: aiStyleId,
      replaceItems: true,
    });
    if (!result.ok || !result.previewState) {
      setImportMessage(result.errors[0] ?? "Falha no Auto-Design");
      return;
    }
    setAiPreview(result.previewState, "design", result.affectedIds);
    showAiPreview(result.previewState, result.affectedIds);
    setImportMessage(
      `Preview Auto-Design (${aiStyleId}) — ${result.affectedIds.length} item(ns). Aplicar Layout para confirmar.`
    );
  };

  const handleAiApplyLayout = async () => {
    if (!aiPreviewState) {
      setImportMessage("Gere um preview AI antes de aplicar");
      return;
    }
    const base = ensureEngineForAi();
    if (!base) return;
    const applied = AiEngine.applyPreview(base, aiPreviewState);
    setRoomEngineState(applied);
    syncActiveLevelToProject(applied);
    clearAiPreview();
    clearAiPreviewStore();
    await animateApplyAiLayout(base, applied);
    setImportMessage(`Layout AI aplicado (${applied.aiPreset ?? aiStyleId})`);
  };

  const handleAiCancelPreview = () => {
    clearAiPreview();
    clearAiPreviewStore();
    if (engineState) void syncCatalogItems(engineState);
    setImportMessage("Preview AI cancelado");
  };

  const handleToggleWalkthrough = () => {
    if (walkthroughActive) {
      stopWalkthrough();
      setWalkthroughActive(false);
      return;
    }
    const state =
      engineState ??
      (room ? RoomConverter.fromProjectRoomConfig(room) : null);
    if (!state) {
      setImportMessage("Crie ou importe uma sala para o walkthrough");
      return;
    }
    if (!engineState) setRoomEngineState(state);
    const result = startWalkthrough(state);
    if (!result.ok) {
      setImportMessage(result.error ?? "Walkthrough indisponível");
      return;
    }
    void syncCatalogItems(state);
    setWalkthroughActive(true);
    setImportMessage("Walkthrough activo — clique no viewer, WASD + rato");
  };

  const handleToggleSlabEdit = () => {
    if (!slabEditOpen) {
      const base =
        engineState ??
        (room ? RoomConverter.fromProjectRoomConfig(room) : null);
      if (!base) {
        setImportMessage("Crie ou importe uma sala antes de editar a laje");
        return;
      }
      const withSlab = SlabEngine.ensureAdvancedSlab(base, base.activeLevelId, {
        thicknessMm: 200,
        material: { kind: "preset", presetId: "concrete" },
      });
      setRoomEngineState(withSlab);
    }
    setSlabEditOpen(!slabEditOpen);
  };

  const activeSlab = engineState ? SlabEngine.getActiveSlab(engineState) : null;
  const engineLevels = engineState ? RoomLevelManager.list(engineState) : [];
  const activeLevelItems = engineState
    ? CatalogItemManager.list(engineState, engineState.activeLevelId)
    : [];

  const addOpening = (type: "door" | "window", kind: RoomOpeningKind) => {
    if (!room || !activeWall) return;
    const opening = makeOpening(type, kind, activeWall);
    patchRoom({ openings: [...room.openings, opening] });
    uiStore.getState().setSelectedObject({ type: "roomElement", id: opening.id });
  };

  const patchOpening = (openingId: string, patch: Partial<ProjectRoomOpening>) => {
    if (!room) return;
    const host =
      room.walls.find((w) => w.id === (patch.wallId ?? room.openings.find((o) => o.id === openingId)?.wallId)) ??
      null;
    patchRoom({
      openings: room.openings.map((opening) => {
        if (opening.id !== openingId) return opening;
        const merged = { ...opening, ...patch };
        const floorOffsetMm = patch.floorOffsetMm ?? patch.verticalOffsetMm ?? merged.floorOffsetMm;
        const xPosMm = patch.xPosMm ?? patch.horizontalOffsetMm ?? merged.xPosMm;
        let next = {
          ...merged,
          floorOffsetMm,
          verticalOffsetMm: floorOffsetMm,
          xPosMm,
          horizontalOffsetMm: xPosMm,
        };
        if (host) {
          const refined = refineOpeningPlacement(
            {
              widthMm: next.widthMm,
              heightMm: next.heightMm,
              floorOffsetMm: next.floorOffsetMm,
              horizontalOffsetMm: next.horizontalOffsetMm,
            },
            host.widthMm || host.lengthMm,
            host.heightMm,
            {
              snap: snapEnabled,
              openingId,
              openings: room.openings,
            }
          );
          next = {
            ...next,
            horizontalOffsetMm: refined.horizontalOffsetMm,
            xPosMm: refined.horizontalOffsetMm,
            floorOffsetMm: refined.floorOffsetMm,
            verticalOffsetMm: refined.floorOffsetMm,
          };
        }
        return next;
      }),
    });
  };

  const alignSelectedOpeningH = (align: OpeningHorizontalAlign) => {
    if (!selectedOpening || !room) return;
    const host = room.walls.find((w) => w.id === selectedOpening.wallId);
    if (!host) return;
    const x = alignOpeningHorizontal(align, selectedOpening.widthMm, host.widthMm || host.lengthMm);
    patchOpening(selectedOpening.id, { horizontalOffsetMm: x, xPosMm: x });
  };

  const alignSelectedOpeningV = (align: OpeningVerticalAlign) => {
    if (!selectedOpening || !room) return;
    const host = room.walls.find((w) => w.id === selectedOpening.wallId);
    if (!host) return;
    const y = alignOpeningVertical(align, selectedOpening.heightMm, host.heightMm);
    patchOpening(selectedOpening.id, { floorOffsetMm: y, verticalOffsetMm: y });
  };

  const applyActiveWallLength = (lengthMm: number) => {
    if (!room || !activeWall) return;
    actions.setProjectRoom(applyWallLengthToRoom(room, activeWall.id, lengthMm));
  };

  const removeOpening = (openingId: string) => {
    if (!room) return;
    patchRoom({ openings: room.openings.filter((o) => o.id !== openingId) });
    if (selectedObject.type === "roomElement" && selectedObject.id === openingId) {
      uiStore.getState().clearSelection();
    }
  };

  const selectWall = (wallId: string) => {
    wallStore.getState().selectWall(wallId);
    uiStore.getState().setSelectedObject({ type: "wall", id: wallId });
  };

  return (
    <aside className="panel-content panel-content--side">
      <div className="design-panel-header" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon name="room" size={18} aria-hidden />
        <div className="section-title" style={{ flex: 1 }}>
          Salão
        </div>
        <span
          title="pimo-room-v4"
          style={{
            fontSize: 10,
            letterSpacing: "0.02em",
            padding: "2px 6px",
            border: "1px solid var(--border-color, rgba(255,255,255,0.15))",
            borderRadius: 4,
            color: "var(--text-muted)",
            whiteSpace: "nowrap",
          }}
        >
          RoomEngine v{ROOM_ENGINE_VERSION}
        </span>
        <button
          type="button"
          className="button button-ghost"
          aria-label="Sobre o RoomEngine"
          title="Sobre o RoomEngine"
          onClick={() => setAboutOpen(true)}
          style={{ padding: "4px 8px", fontSize: 12 }}
        >
          Sobre
        </button>
        <button
          type="button"
          className="button button-ghost"
          aria-label="Fechar painel Salão"
          onClick={() => setRoomPanelOpen(false)}
          style={{ padding: "4px 8px" }}
        >
          Fechar
        </button>
      </div>
      <p className="design-panel-subtitle" style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
        Define a divisão em milímetros. As paredes e aberturas sincronizam com o viewer.
      </p>

      <Panel title="Dimensões (mm)">
        {numField("Largura", widthMm, setWidthMm, { min: 500, suffix: "mm" })}
        {numField("Profundidade", depthMm, setDepthMm, { min: 500, suffix: "mm" })}
        {numField("Altura", heightMm, setHeightMm, { min: 500, suffix: "mm" })}
        {numField("Espessura parede", thicknessMm, setThicknessMm, { min: 50, suffix: "mm" })}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="button button-primary" onClick={handleApplyDimensions}>
            {room ? "Aplicar dimensões" : "Criar sala"}
          </button>
          {room ? (
            <button type="button" className="button button-ghost" onClick={handleRemove}>
              Remover sala
            </button>
          ) : null}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              className="button button-ghost"
              onClick={() => {
                setExportMenuOpen(false);
                setImportMenuOpen((v) => !v);
              }}
              disabled={importBusy}
              title="Importar JSON, IFC ou GLB"
            >
              {importBusy ? "A importar…" : "Importar"}
            </button>
            {importMenuOpen ? (
              <div
                style={{
                  position: "absolute",
                  zIndex: 20,
                  top: "100%",
                  left: 0,
                  marginTop: 4,
                  minWidth: 180,
                  background: "var(--panel-bg, var(--surface))",
                  border: "1px solid var(--border-color, var(--border))",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                  display: "flex",
                  flexDirection: "column",
                  padding: 4,
                }}
              >
                <button
                  type="button"
                  className="button button-ghost"
                  style={{ justifyContent: "flex-start" }}
                  onClick={() => {
                    setImportMessage(null);
                    importInputRef.current?.click();
                  }}
                >
                  JSON (sala)
                </button>
                <button
                  type="button"
                  className="button button-ghost"
                  style={{ justifyContent: "flex-start" }}
                  onClick={() => ifcInputRef.current?.click()}
                >
                  IFC
                </button>
                <button
                  type="button"
                  className="button button-ghost"
                  style={{ justifyContent: "flex-start" }}
                  onClick={() => glbRoomInputRef.current?.click()}
                >
                  GLB (sala)
                </button>
                <button
                  type="button"
                  className="button button-ghost"
                  style={{ justifyContent: "flex-start" }}
                  onClick={() => glbItemInputRef.current?.click()}
                >
                  GLB (item)
                </button>
              </div>
            ) : null}
          </div>
          <div style={{ position: "relative" }}>
            <button
              type="button"
              className="button button-ghost"
              onClick={() => {
                setImportMenuOpen(false);
                setExportMenuOpen((v) => !v);
              }}
              disabled={importBusy}
              title="Exportar GLB, JSON ou AI layout"
            >
              Exportar
            </button>
            {exportMenuOpen ? (
              <div
                style={{
                  position: "absolute",
                  zIndex: 20,
                  top: "100%",
                  left: 0,
                  marginTop: 4,
                  minWidth: 200,
                  background: "var(--panel-bg, var(--surface))",
                  border: "1px solid var(--border-color, var(--border))",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                  display: "flex",
                  flexDirection: "column",
                  padding: 4,
                }}
              >
                <button
                  type="button"
                  className="button button-ghost"
                  style={{ justifyContent: "flex-start" }}
                  onClick={() => void handleExportGlbRoom()}
                >
                  GLB (sala completa)
                </button>
                <button
                  type="button"
                  className="button button-ghost"
                  style={{ justifyContent: "flex-start" }}
                  onClick={() => void handleExportGlbItems()}
                >
                  GLB (itens)
                </button>
                <button
                  type="button"
                  className="button button-ghost"
                  style={{ justifyContent: "flex-start" }}
                  onClick={() => handleExportJsonMetadata()}
                >
                  JSON (metadata)
                </button>
                <button
                  type="button"
                  className="button button-ghost"
                  style={{ justifyContent: "flex-start" }}
                  onClick={() => void handleExportAiLayoutGlb()}
                >
                  AI layout GLB
                </button>
              </div>
            ) : null}
          </div>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            style={{ display: "none" }}
            onChange={(e) => void handleImportJsonFile(e.target.files?.[0] ?? null)}
          />
          <input
            ref={ifcInputRef}
            type="file"
            accept=".ifc,application/x-step,text/plain"
            style={{ display: "none" }}
            onChange={(e) => void handleImportIfcFile(e.target.files?.[0] ?? null)}
          />
          <input
            ref={glbRoomInputRef}
            type="file"
            accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
            style={{ display: "none" }}
            onChange={(e) => void handleImportGlbRoom(e.target.files?.[0] ?? null)}
          />
          <input
            ref={glbItemInputRef}
            type="file"
            accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
            style={{ display: "none" }}
            onChange={(e) => void handleImportGlbItem(e.target.files?.[0] ?? null)}
          />
        </div>
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
          Formatos suportados: JSON, IFC, GLB
        </p>
        {importMessage ? (
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{importMessage}</p>
        ) : null}
      </Panel>

      <Panel title="Níveis & Walkthrough">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <button
            type="button"
            className="button button-ghost"
            onClick={handleToggleWalkthrough}
            title="Navegação 1ª pessoa (WASD + rato)"
          >
            {walkthroughActive ? "Sair Walkthrough" : "Modo Walkthrough"}
          </button>
          <button type="button" className="button button-ghost" onClick={handleAddLevel}>
            Adicionar Nível
          </button>
          <button type="button" className="button button-ghost" onClick={handleToggleSlabEdit}>
            {slabEditOpen ? "Fechar Laje" : "Editar Laje"}
          </button>
        </div>
        {engineLevels.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
            {engineLevels.map((lvl) => {
              const active = engineState?.activeLevelId === lvl.id;
              return (
                <button
                  key={lvl.id}
                  type="button"
                  className="button button-ghost"
                  onClick={() => handleSelectLevel(lvl.id)}
                  style={{
                    justifyContent: "flex-start",
                    background: active ? "var(--toolbar-pressed-bg)" : "transparent",
                  }}
                >
                  {lvl.name} — {Math.round(lvl.storeyHeightMm)} mm
                  {active ? " (activo)" : ""}
                </button>
              );
            })}
          </div>
        ) : (
          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Importe ou crie uma sala para gerir níveis.
          </p>
        )}
        {slabEditOpen && activeSlab ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {numField(
              "Espessura laje",
              activeSlab.thicknessMm,
              (n) => {
                patchRoomEngineState((s) => SlabEngine.setThickness(s, activeSlab.id, n));
              },
              { min: 50, suffix: "mm" }
            )}
            <label className="panel-label" style={{ fontSize: 12 }}>
              Material
            </label>
            <select
              className="input input-sm"
              value={
                activeSlab.material?.kind === "preset" ? activeSlab.material.presetId : "concrete"
              }
              onChange={(e) => {
                const presetId = e.target.value;
                patchRoomEngineState((s) =>
                  SlabEngine.setMaterial(s, activeSlab.id, { kind: "preset", presetId })
                );
              }}
            >
              {Object.entries(MATERIAL_PRESETS).map(([id, p]) => (
                <option key={id} value={id}>
                  {p.label}
                </option>
              ))}
            </select>
            {numField(
              "Offset X",
              activeSlab.offsetMm?.x ?? 0,
              (n) => {
                patchRoomEngineState((s) =>
                  SlabEngine.setOffset(s, activeSlab.id, {
                    x: n,
                    z: activeSlab.offsetMm?.z ?? 0,
                  })
                );
              },
              { min: -5000, suffix: "mm" }
            )}
            {numField(
              "Offset Z",
              activeSlab.offsetMm?.z ?? 0,
              (n) => {
                patchRoomEngineState((s) =>
                  SlabEngine.setOffset(s, activeSlab.id, {
                    x: activeSlab.offsetMm?.x ?? 0,
                    z: n,
                  })
                );
              },
              { min: -5000, suffix: "mm" }
            )}
          </div>
        ) : null}
      </Panel>

      <Panel title="Catálogo">
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
          Itens 3D no nível activo. Viewer: arrastar · Q/E rodar · Delete remover.
        </p>
        <label className="panel-label" style={{ fontSize: 12 }}>
          Preset
        </label>
        <select
          className="input input-sm"
          value={catalogPresetId}
          onChange={(e) => setCatalogPresetId(e.target.value)}
          style={{ marginBottom: 8 }}
        >
          {CATALOG_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.type})
            </option>
          ))}
        </select>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <button type="button" className="button button-primary" onClick={handleAddCatalogItem}>
            Adicionar Item
          </button>
          <button
            type="button"
            className="button button-ghost"
            onClick={handleRemoveCatalogItem}
            disabled={!selectedItemId}
          >
            Remover Item
          </button>
          <button
            type="button"
            className="button button-ghost"
            onClick={handleDuplicateCatalogItem}
            disabled={!selectedItemId}
          >
            Duplicar Item
          </button>
        </div>
        {activeLevelItems.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {activeLevelItems.map((item) => {
              const active = selectedItemId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className="button button-ghost"
                  onClick={() => {
                    setSelectedItemId(item.id);
                    selectCatalogItem(item.id);
                  }}
                  style={{
                    justifyContent: "flex-start",
                    background: active ? "var(--toolbar-pressed-bg)" : "transparent",
                  }}
                >
                  {item.name} · {Math.round(item.rotationDeg)}°
                  {active ? " (sel.)" : ""}
                </button>
              );
            })}
          </div>
        ) : (
          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Nenhum item neste nível.
          </p>
        )}
      </Panel>

      <Panel title="AI">
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
          Auto-Arrange e Auto-Design sobre o catálogo do nível activo. Preview ghost no viewer.
        </p>
        <label className="panel-label" style={{ fontSize: 12 }}>
          Estilo AI
        </label>
        <select
          className="input input-sm"
          value={aiStyleId}
          onChange={(e) => setAiStyleId(e.target.value as AiPresetId)}
          style={{ marginBottom: 8 }}
        >
          {AI_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <button type="button" className="button button-ghost" onClick={handleAiAutoArrange}>
            Auto-Arrange
          </button>
          <button type="button" className="button button-ghost" onClick={handleAiAutoDesign}>
            Auto-Design
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={() => void handleAiApplyLayout()}
            disabled={!aiPreviewState}
          >
            Aplicar Layout
          </button>
          <button
            type="button"
            className="button button-ghost"
            onClick={handleAiCancelPreview}
            disabled={!aiPreviewState}
          >
            Cancelar Preview
          </button>
        </div>
        {aiPreviewState ? (
          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Preview activo — {aiPreviewState.items.filter((i) => i.levelId === aiPreviewState.activeLevelId).length}{" "}
            item(ns) no nível.
          </p>
        ) : null}
      </Panel>

      {room ? (
        <Panel title="Paredes">
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={wallEditMode}
              onChange={(e) => {
                const enabled = e.target.checked;
                actions.setViewerSettings({ wallEditMode: enabled });
                viewerApi?.setWallEditMode?.(enabled);
              }}
            />
            <Icon name="roomVertex" size={14} aria-hidden />
            Editar paredes no viewer (mover / rodar / vértices)
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {room.walls.map((wall) => {
              const active = activeWall?.id === wall.id;
              return (
                <button
                  key={wall.id}
                  type="button"
                  className="button button-ghost"
                  onClick={() => selectWall(wall.id)}
                  style={{
                    justifyContent: "flex-start",
                    background: active ? "var(--toolbar-pressed-bg)" : "transparent",
                  }}
                >
                  {WALL_LABEL_TITLES[wall.label] ?? wall.label} — {Math.round(wall.widthMm)}×
                  {Math.round(wall.heightMm)} mm
                </button>
              );
            })}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginTop: 8 }}>
            <input
              type="checkbox"
              checked={room.ceilingVisible}
              onChange={(e) => patchRoom({ ceilingVisible: e.target.checked })}
            />
            Tecto visível
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={room.visible !== false}
              onChange={(e) => patchRoom({ visible: e.target.checked })}
            />
            Sala visível
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={room.locked === true}
              onChange={(e) => patchRoom({ locked: e.target.checked })}
            />
            Bloquear sala
          </label>
        </Panel>
      ) : null}

      {room ? (
        <Panel title="Zonas">
          {!(room.zones && room.zones.length > 0) ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <button
                type="button"
                className="button button-ghost"
                onClick={() => patchRoom(ensureRoomZones(room))}
              >
                Activar zona da sala (polígono + área)
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={() => patchRoom({ zones: autoZonesFromClosedLoops(room) })}
              >
                Auto-zona por loops fechados
              </button>
            </div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              {room.zones.map((zone) => {
                const m = computeZoneMetrics(zone);
                return (
                  <li
                    key={zone.id}
                    style={{
                      fontSize: 12,
                      padding: "6px 8px",
                      background: "var(--toolbar-pressed-bg, rgba(0,0,0,0.04))",
                      borderRadius: 4,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{zone.name}</div>
                    <div style={{ color: "var(--text-muted)" }}>
                      Área {m.areaM2.toFixed(2)} m² · Perímetro {m.perimeterM.toFixed(2)} m
                    </div>
                    <div style={{ color: "var(--text-muted)" }}>{zone.polygonMm.length} vértices</div>
                  </li>
                );
              })}
              <button
                type="button"
                className="button button-ghost"
                onClick={() => {
                  const main = createMainZoneFromRoom(room);
                  const others = (room.zones ?? []).filter((z) => z.id !== main.id);
                  patchRoom({ zones: [main, ...others] });
                }}
              >
                Realinhar zona principal ao footprint
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={() => patchRoom({ zones: autoZonesFromClosedLoops(room) })}
              >
                Auto-zona por loops fechados
              </button>
            </ul>
          )}
        </Panel>
      ) : null}

      {room && activeWall ? (
        <Panel title={`Aberturas — ${WALL_LABEL_TITLES[activeWall.label] ?? activeWall.label}`}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button type="button" className="button button-ghost" onClick={() => addOpening("door", "normal")}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Icon name="roomDoor" size={14} aria-hidden /> Porta
              </span>
            </button>
            <button type="button" className="button button-ghost" onClick={() => addOpening("door", "correr")}>
              Porta correr
            </button>
            <button type="button" className="button button-ghost" onClick={() => addOpening("window", "normal")}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Icon name="roomWindow" size={14} aria-hidden /> Janela
              </span>
            </button>
            <button type="button" className="button button-ghost" onClick={() => addOpening("window", "correr")}>
              Janela correr
            </button>
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "flex", flexDirection: "column", gap: 4 }}>
            {room.openings
              .filter((o) => o.wallId === activeWall.id)
              .map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    className="button button-ghost"
                    onClick={() => uiStore.getState().setSelectedObject({ type: "roomElement", id: o.id })}
                    style={{
                      width: "100%",
                      justifyContent: "space-between",
                      background:
                        selectedOpening?.id === o.id ? "var(--toolbar-pressed-bg)" : "transparent",
                    }}
                  >
                    <span>
                      {o.type === "door" ? "Porta" : "Janela"} {o.kind} — {o.widthMm}×{o.heightMm} mm
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </Panel>
      ) : null}

      {room && activeWall ? (
        <Panel
          title="Edição de parede"
          titleHelpText="Ajusta o comprimento da parede seleccionada; paredes sul/norte definem a largura da sala e este/oeste a profundidade."
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Icon name="roomVertex" size={16} aria-hidden />
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {WALL_LABEL_TITLES[activeWall.label] ?? activeWall.label}
            </span>
          </div>
          {numField(
            "Comprimento",
            activeWall.widthMm || activeWall.lengthMm,
            applyActiveWallLength,
            { min: 500, suffix: "mm" }
          )}
        </Panel>
      ) : null}

      {selectedOpening ? (
        <Panel title="Editar abertura">
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={snapEnabled}
              onChange={(e) => setRoomOpeningSnapEnabled(e.target.checked)}
            />
            <Icon name="roomSnap" size={14} aria-hidden />
            Snap de aberturas (grelha 50 mm)
          </label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            <button type="button" className="button button-ghost" onClick={() => alignSelectedOpeningH("start")}>
              Início
            </button>
            <button type="button" className="button button-ghost" onClick={() => alignSelectedOpeningH("center")}>
              Centro
            </button>
            <button type="button" className="button button-ghost" onClick={() => alignSelectedOpeningH("end")}>
              Fim
            </button>
            <button type="button" className="button button-ghost" onClick={() => alignSelectedOpeningV("floor")}>
              Piso
            </button>
            <button type="button" className="button button-ghost" onClick={() => alignSelectedOpeningV("middle")}>
              Meio
            </button>
            <button type="button" className="button button-ghost" onClick={() => alignSelectedOpeningV("top")}>
              Topo
            </button>
            <button
              type="button"
              className="button button-primary"
              onClick={() => {
                RoomEngineBoundary.viewer
                  .getHost()
                  ?.roomBuilder?.toggleElementOpen?.(selectedOpening.id);
              }}
            >
              Abrir / fechar (swing)
            </button>
          </div>
          {numField("Largura", selectedOpening.widthMm, (n) => patchOpening(selectedOpening.id, { widthMm: n }), {
            min: 100,
            suffix: "mm",
          })}
          {numField("Altura", selectedOpening.heightMm, (n) => patchOpening(selectedOpening.id, { heightMm: n }), {
            min: 100,
            suffix: "mm",
          })}
          {numField(
            "Offset horizontal",
            selectedOpening.horizontalOffsetMm,
            (n) => patchOpening(selectedOpening.id, { horizontalOffsetMm: n, xPosMm: n }),
            { min: 0, suffix: "mm" }
          )}
          {numField(
            "Offset do piso",
            selectedOpening.floorOffsetMm,
            (n) => patchOpening(selectedOpening.id, { floorOffsetMm: n, verticalOffsetMm: n }),
            { min: 0, suffix: "mm" }
          )}
          <button
            type="button"
            className="button button-ghost"
            onClick={() => removeOpening(selectedOpening.id)}
          >
            Remover abertura
          </button>
        </Panel>
      ) : null}

      <p
        style={{
          fontSize: 10,
          color: "var(--text-muted)",
          marginTop: 16,
          paddingTop: 8,
          borderTop: "1px solid var(--border-color, rgba(255,255,255,0.08))",
        }}
      >
        PIMO-ALFA v{PIMO_ALFA_VERSION} · RoomEngine v{ROOM_ENGINE_VERSION}
      </p>
      <AboutRoomEngineModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </aside>
  );
}

export default PainelSala;
