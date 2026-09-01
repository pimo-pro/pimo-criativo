/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { useProject } from "../../../context/useProject";
import { usePimoViewerContext } from "../../../hooks/usePimoViewerContext";
import Panel from "../../ui/Panel";
import { useWallStore, wallStore } from "../../../stores/wallStore";
import { uiStore, useUiStore } from "../../../stores/uiStore";
import type {
  ProjectRoomConfig,
  ProjectRoomOpening,
  ProjectRoomUtility,
  ProjectRoomUtilityType,
  ProjectRoomWall,
  RoomOpeningKind,
} from "../../../3d/viewer-engine/room/roomEngineTypes";
import { ROOM_20_DEFAULTS, WALL_LABEL_TITLES } from "../../../3d/viewer-engine/room/RoomEngine";
import {
  AUTO_FILL_WALL_LABELS,
  EMPTY_ALLOW_UPPER,
  EMPTY_WALL_SELECTION,
} from "../../../core/autoRoomFill";
import { detectKitchenLayout } from "../../../core/autoRoomFill/layoutDetection";
import type {
  KitchenLayoutType,
  KitchenLayoutTypeOverride,
} from "../../../core/autoRoomFill/autoRoomFillTypes";
import type { RoomWallLabel } from "../../../3d/viewer-engine/room/roomEngineTypes";
import { ConversationalDesignerPanel } from "./ConversationalDesignerPanel";
import { ManufacturingPanel } from "./ManufacturingPanel";
import { CostEstimatorPanel } from "./CostEstimatorPanel";
import { RoomFloorModeSelect } from "../room/RoomFloorModeSelect";

const LAYOUT_OPTIONS: Array<{ id: KitchenLayoutTypeOverride; label: string }> = [
  { id: "auto", label: "Automático" },
  { id: "I", label: "I (uma parede)" },
  { id: "L", label: "L (duas paredes)" },
  { id: "U", label: "U (três paredes)" },
  { id: "island", label: "Ilha" },
];

/** Dimensões padrão da sala em centímetros */
const DEFAULT_ROOM_WIDTH_CM  = 400;  // 4 m
const DEFAULT_ROOM_DEPTH_CM  = 400;  // 4 m
const DEFAULT_ROOM_HEIGHT_CM = 260;  // 2.6 m

/** Limites em cm */
const MIN_WD_CM = 50;    // 0.5 m
const MAX_WD_CM = 5000;  // 50 m
const MIN_H_CM  = 50;    // 0.5 m
const MAX_H_CM  = 1000;  // 10 m

type RoomType = "closed" | "open";

const DEFAULT_OPENING_BY_TYPE = {
  door: { widthMm: 900, heightMm: 2100, thicknessMm: 40, floorOffsetMm: 0 },
  window: { widthMm: 1200, heightMm: 1200, thicknessMm: 40, floorOffsetMm: 900 },
} as const;

function numInput(
  label: string,
  value: number,
  onChange: (value: number) => void,
  min = 0,
  max = 20000,
  step = 10,
  unit = "mm"
) {
  return (
    <div className="panel-field-row">
      <label className="panel-label" style={{ minWidth: 110 }}>{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={Math.round(value)}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
        className="input input-sm"
        style={{ width: 92 }}
      />
      <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4 }}>{unit}</span>
    </div>
  );
}

function makeOpening(type: "door" | "window", kind: RoomOpeningKind, wall: ProjectRoomWall): ProjectRoomOpening {
  const defaults = DEFAULT_OPENING_BY_TYPE[type];
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

export function PainelSala() {
  const { viewerApi } = usePimoViewerContext();
  const { project, actions } = useProject();
  const mainWallIndex = useWallStore((state) => state.mainWallIndex);
  const setMainWallIndex = useWallStore((state) => state.setMainWallIndex);
  const selectedWallId = useWallStore((state) => state.selectedWallId);
  const selectedObject = useUiStore((state) => state.selectedObject);
  const room = project.room;

  const wallSelection = project.autoFill?.wallSelection ?? EMPTY_WALL_SELECTION;
  const allowUpperModules = project.autoFill?.allowUpperModules ?? EMPTY_ALLOW_UPPER;
  const layoutOverride = project.autoFill?.layoutTypeOverride ?? "auto";
  const detectedLayout = room ? detectKitchenLayout(room) : null;
  const displayLayoutType: KitchenLayoutType | "auto" =
    layoutOverride !== "auto" ? layoutOverride : detectedLayout?.detectedType ?? "I";

  const [autoFillMessage, setAutoFillMessage] = useState<string | null>(null);

  useEffect(() => {
    const text = project.autoFill?.detailedSummary ?? project.autoFill?.summary;
    if (text) setAutoFillMessage(text);
  }, [project.autoFill?.lastRunAt, project.autoFill?.summary, project.autoFill?.detailedSummary]);

  // Estado em centímetros — conversão para metros só nas chamadas ao viewer
  const [widthCm,  setWidthCm]  = useState(DEFAULT_ROOM_WIDTH_CM);
  const [depthCm,  setDepthCm]  = useState(DEFAULT_ROOM_DEPTH_CM);
  const [heightCm, setHeightCm] = useState(DEFAULT_ROOM_HEIGHT_CM);
  const [roomType, setRoomType] = useState<RoomType>("closed");
  const [roomVisibleState, setRoomVisibleState] = useState(true);

  const roomVisible = viewerApi?.getRoomVisible?.()  ?? roomVisibleState;
  const locked      = viewerApi?.getRoomLocked?.()   ?? false;
  const selectedRoomWall =
    selectedObject.type === "wall"
      ? room?.walls.find((wall) => wall.id === selectedObject.id)
      : selectedWallId
        ? room?.walls.find((wall) => wall.id === selectedWallId)
        : null;
  const selectedOpening =
    selectedObject.type === "roomElement"
      ? room?.openings.find((opening) => opening.id === selectedObject.id)
      : null;
  const selectedUtility =
    selectedObject.type === "roomUtility"
      ? room?.utilities.find((utility) => utility.id === selectedObject.id)
      : null;
  const selectedOpeningWall = selectedOpening
    ? room?.walls.find((wall) => wall.id === selectedOpening.wallId) ?? null
    : null;

  useEffect(() => {
    setRoomVisibleState(viewerApi?.getRoomVisible?.() ?? true);
  }, [viewerApi]);

  useEffect(() => {
    if (!room) return;
    setWidthCm(Math.round(room.widthMm / 10));
    setDepthCm(Math.round(room.depthMm / 10));
    setHeightCm(Math.round(room.heightMm / 10));
  }, [room]);

  // Clamp e conversão cm → metros
  const toMeters = (widthCm: number, depthCm: number, heightCm: number) => ({
    w: Math.max(MIN_WD_CM, Math.min(MAX_WD_CM, widthCm))  / 100,
    d: Math.max(MIN_WD_CM, Math.min(MAX_WD_CM, depthCm))  / 100,
    h: Math.max(MIN_H_CM,  Math.min(MAX_H_CM,  heightCm)) / 100,
  });

  const handleCreate = () => {
    const { w, d, h } = toMeters(widthCm, depthCm, heightCm);
    actions.updateProjectRoom({
      widthMm: Math.round(w * 1000),
      depthMm: Math.round(d * 1000),
      heightMm: Math.round(h * 1000),
      visible: true,
      locked: false,
    });
    setRoomVisibleState(true);
  };

  const handleRemove = () => {
    actions.removeProjectRoom();
    viewerApi?.removeRoom?.();
    setRoomVisibleState(false);
  };

  const handleDimensionsChange = () => {
    const { w, d, h } = toMeters(widthCm, depthCm, heightCm);
    actions.updateProjectRoom({
      widthMm: Math.round(w * 1000),
      depthMm: Math.round(d * 1000),
      heightMm: Math.round(h * 1000),
    });
  };

  const patchRoom = (patch: Partial<ProjectRoomConfig>) => {
    actions.updateProjectRoom(patch);
  };

  const patchWall = (wallId: string, patch: Partial<ProjectRoomWall>) => {
    if (!room) return;
    patchRoom({
      walls: room.walls.map((wall) =>
        wall.id === wallId
          ? {
              ...wall,
              ...patch,
              widthMm: patch.widthMm ?? patch.lengthMm ?? wall.widthMm,
              lengthMm: patch.widthMm ?? patch.lengthMm ?? wall.lengthMm,
            }
          : wall
      ),
    });
  };

  const patchOpening = (openingId: string, patch: Partial<ProjectRoomOpening>) => {
    if (!room) return;
    patchRoom({
      openings: room.openings.map((opening) => {
        if (opening.id !== openingId) return opening;
        const floorOffsetMm = patch.floorOffsetMm ?? patch.verticalOffsetMm ?? opening.floorOffsetMm;
        const xPosMm = patch.xPosMm ?? patch.horizontalOffsetMm ?? opening.xPosMm;
        return {
          ...opening,
          ...patch,
          xPosMm,
          horizontalOffsetMm: xPosMm,
          floorOffsetMm,
          verticalOffsetMm: floorOffsetMm,
        };
      }),
    });
  };

  const addWall = () => {
    const base = room;
    if (!base) return;
    const id = `room-wall-extra-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const wall: ProjectRoomWall = {
      id,
      label: "extra",
      widthMm: ROOM_20_DEFAULTS.widthMm,
      lengthMm: ROOM_20_DEFAULTS.widthMm,
      heightMm: base.heightMm,
      thicknessMm: base.wallThicknessMm,
      position: { x: 0, y: base.heightMm / 2, z: 0 },
      rotationDeg: 0,
    };
    patchRoom({ walls: [...base.walls, wall] });
    wallStore.getState().selectWall(id);
    uiStore.getState().setSelectedObject({ type: "wall", id });
  };

  const addOpening = (type: "door" | "window", kind: RoomOpeningKind) => {
    if (!room) return;
    const wall =
      selectedRoomWall ??
      (selectedOpeningWall ? selectedOpeningWall : null) ??
      room.walls.find((item) => item.id === selectedWallId) ??
      room.walls[0];
    if (!wall) return;
    const opening = makeOpening(type, kind, wall);
    patchRoom({ openings: [...room.openings, opening] });
    uiStore.getState().setSelectedObject({ type: "roomElement", id: opening.id });
  };

  const addUtility = (type: ProjectRoomUtilityType) => {
    if (!room) return;
    const wall =
      selectedRoomWall ??
      room.walls.find((item) => item.id === selectedWallId) ??
      room.walls[0];
    if (!wall) return;
    const defaults: Record<ProjectRoomUtilityType, number> = {
      ElectricalOutlet: 300,
      WaterPoint: 550,
      DrainPoint: 250,
    };
    const utility: ProjectRoomUtility = {
      id: `room-utility-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      wallId: wall.id,
      positionAlongWall: Math.max(0, (wall.lengthMm ?? wall.widthMm) / 2),
      heightMm: defaults[type],
    };
    patchRoom({ utilities: [...(room.utilities ?? []), utility] });
    uiStore.getState().setSelectedObject({ type: "roomUtility", id: utility.id });
  };

  const patchUtility = (utilityId: string, patch: Partial<ProjectRoomUtility>) => {
    if (!room) return;
    patchRoom({
      utilities: (room.utilities ?? []).map((utility) =>
        utility.id === utilityId ? { ...utility, ...patch } : utility
      ),
    });
  };

  return (
    <aside className="panel-content panel-content--side">
      <div className="design-panel-header">
        <div className="section-title">Sala</div>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }} className="design-panel-subtitle">
        Room 2.0 visual. Paredes, portas e janelas não entram em cutlist, CNC ou fabricação.
      </p>

      <Panel title="Dimensões da sala (cm)">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="panel-field-row">
            <label className="panel-label" style={{ minWidth: 80 }}>Largura</label>
            <input
              type="number"
              min={MIN_WD_CM}
              max={MAX_WD_CM}
              step={10}
              value={widthCm}
              onChange={(e) => setWidthCm(Number(e.target.value) || 0)}
              onBlur={room ? handleDimensionsChange : undefined}
              className="input input-sm"
              style={{ width: 90 }}
            />
            <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4 }}>cm</span>
          </div>
          <div className="panel-field-row">
            <label className="panel-label" style={{ minWidth: 80 }}>Profundidade</label>
            <input
              type="number"
              min={MIN_WD_CM}
              max={MAX_WD_CM}
              step={10}
              value={depthCm}
              onChange={(e) => setDepthCm(Number(e.target.value) || 0)}
              onBlur={room ? handleDimensionsChange : undefined}
              className="input input-sm"
              style={{ width: 90 }}
            />
            <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4 }}>cm</span>
          </div>
          <div className="panel-field-row">
            <label className="panel-label" style={{ minWidth: 80 }}>Altura</label>
            <input
              type="number"
              min={MIN_H_CM}
              max={MAX_H_CM}
              step={5}
              value={heightCm}
              onChange={(e) => setHeightCm(Number(e.target.value) || 0)}
              onBlur={room ? handleDimensionsChange : undefined}
              className="input input-sm"
              style={{ width: 90 }}
            />
            <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4 }}>cm</span>
          </div>
        </div>
      </Panel>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
        {!room ? (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
              <label style={{ fontSize: 12, color: "var(--text-main)" }}>Tipo de sala</label>
              <select
                className="input input-sm"
                value={roomType}
                onChange={(e) => setRoomType(e.target.value as RoomType)}
              >
                <option value="closed">Sala fechada (4 paredes)</option>
                <option value="open">Sala de estar (3 paredes, aberta)</option>
              </select>
            </div>
            <button
              type="button"
              onClick={handleCreate}
              className="button button-primary"
              style={{ width: "100%" }}
            >
              Criar Sala
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={handleRemove}
              className="button button-ghost"
              style={{ width: "100%" }}
            >
              Remover Sala
            </button>
            <button
              type="button"
              onClick={addWall}
              className="button button-ghost"
              style={{ width: "100%" }}
            >
              Adicionar Parede
            </button>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button type="button" onClick={() => addOpening("door", "normal")} className="button button-ghost">
                Porta normal
              </button>
              <button type="button" onClick={() => addOpening("door", "correr")} className="button button-ghost">
                Porta correr
              </button>
              <button type="button" onClick={() => addOpening("window", "normal")} className="button button-ghost">
                Janela normal
              </button>
              <button type="button" onClick={() => addOpening("window", "correr")} className="button button-ghost">
                Janela correr
              </button>
            </div>
            <Panel title="Chão, teto e paredes">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <RoomFloorModeSelect
                  value={room.floorMode}
                  onChange={(mode) => {
                    patchRoom({ floorMode: mode });
                    viewerApi?.setRoomFloorMode?.(mode);
                  }}
                />
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-main)" }}>
                  <input
                    type="checkbox"
                    checked={room.ceilingVisible !== false}
                    onChange={(e) => {
                      patchRoom({ ceilingVisible: e.target.checked });
                      viewerApi?.setRoomCeilingVisible?.(e.target.checked);
                    }}
                  />
                  Mostrar teto
                </label>
                {room.walls.map((wall) => (
                  <label key={wall.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={!(room.hiddenWalls ?? []).includes(wall.id)}
                      onChange={(e) => {
                        const current = new Set(room.hiddenWalls ?? []);
                        if (e.target.checked) current.delete(wall.id);
                        else current.add(wall.id);
                        patchRoom({ hiddenWalls: [...current] });
                      }}
                    />
                    Mostrar {WALL_LABEL_TITLES[wall.label] ?? wall.id}
                  </label>
                ))}
              </div>
            </Panel>
            <Panel title="Pontos técnicos">
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 6 }}>
                <button type="button" className="button button-ghost" onClick={() => addUtility("ElectricalOutlet")}>
                  Adicionar Tomada
                </button>
                <button type="button" className="button button-ghost" onClick={() => addUtility("WaterPoint")}>
                  Adicionar Água
                </button>
                <button type="button" className="button button-ghost" onClick={() => addUtility("DrainPoint")}>
                  Adicionar Dreno
                </button>
              </div>
            </Panel>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 2 }}>
              <label style={{ fontSize: 12, color: "var(--text-main)" }}>Parede principal</label>
              <select
                className="input input-sm"
                value={mainWallIndex}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (!Number.isFinite(next)) return;
                  setMainWallIndex(Math.max(0, Math.min(3, next)) as 0 | 1 | 2 | 3);
                }}
              >
                <option value={0}>Frontal</option>
                <option value={1}>Direita</option>
                <option value={2}>Traseira</option>
                <option value={3}>Esquerda</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => {
                if (roomVisible) {
                  viewerApi?.hideRoom?.();
                  setRoomVisibleState(false);
                } else {
                  viewerApi?.showRoom?.();
                  setRoomVisibleState(true);
                }
              }}
              className="button button-ghost"
              style={{ width: "100%" }}
            >
              {roomVisible ? "Ocultar Sala" : "Mostrar Sala"}
            </button>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-main)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={locked}
                onChange={(e) => {
                  patchRoom({ locked: e.target.checked });
                  viewerApi?.setRoomLocked?.(e.target.checked);
                }}
              />
              Lock Walls (paredes principais conectadas)
            </label>
            <Panel title="Layout Cozinha 3.0">
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
                Detetado: <strong>{detectedLayout?.detectedType ?? "—"}</strong>
                {detectedLayout && (
                  <>
                    {" "}
                    · Centro livre: {detectedLayout.centerFreeWidthMm}×
                    {detectedLayout.centerFreeDepthMm} mm
                    {detectedLayout.islandEligible ? " · Ilha OK" : ""}
                  </>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
                {LAYOUT_OPTIONS.map((opt) => (
                  <label
                    key={opt.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="kitchen-layout-override"
                      checked={layoutOverride === opt.id}
                      onChange={() => {
                        actions.setAutoFillWallSettings({ layoutTypeOverride: opt.id });
                      }}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
              <button
                type="button"
                className="button button-primary"
                style={{ width: "100%" }}
                onClick={() => {
                  if (!room) {
                    setAutoFillMessage("Crie uma sala antes de gerar o layout.");
                    return;
                  }
                  setAutoFillMessage(`A gerar layout ${displayLayoutType}…`);
                  actions.runKitchenLayout30();
                }}
              >
                Gerar Layout da Cozinha (3.0)
              </button>
            </Panel>
            <Panel title="Auto-Room-Fill — paredes">
              <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 8px" }}>
                Sem seleção, preenche só a parede mais longa.
              </p>
              {AUTO_FILL_WALL_LABELS.map((label) => (
                <div key={label} style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 6 }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 12,
                      color: "var(--text-main)",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={wallSelection[label]}
                      onChange={(e) => {
                        actions.setAutoFillWallSettings({
                          wallSelection: { [label]: e.target.checked } as Partial<
                            Record<RoomWallLabel, boolean>
                          >,
                        });
                      }}
                    />
                    {WALL_LABEL_TITLES[label] ?? label}
                  </label>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 11,
                      color: "var(--text-muted)",
                      cursor: wallSelection[label] ? "pointer" : "not-allowed",
                      marginLeft: 22,
                      opacity: wallSelection[label] ? 1 : 0.55,
                    }}
                  >
                    <input
                      type="checkbox"
                      disabled={!wallSelection[label]}
                      checked={allowUpperModules[label]}
                      onChange={(e) => {
                        actions.setAutoFillWallSettings({
                          allowUpperModules: { [label]: e.target.checked } as Partial<
                            Record<RoomWallLabel, boolean>
                          >,
                        });
                      }}
                    />
                    Colocar módulos superiores nesta parede
                  </label>
                </div>
              ))}
            </Panel>
            <button
              type="button"
              className="button button-primary"
              style={{ width: "100%", marginTop: 4 }}
              onClick={() => {
                if (!room) {
                  setAutoFillMessage("Crie uma sala antes de preencher a cozinha.");
                  return;
                }
                setAutoFillMessage("A gerar cozinha…");
                actions.runAutoRoomFill();
              }}
            >
              Preencher Cozinha Automaticamente
            </button>
            {(autoFillMessage || project.autoFill?.detailedSummary || project.autoFill?.summary) && (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.45,
                  padding: "8px 10px",
                  borderRadius: 6,
                  background: "var(--surface-elevated, rgba(255,255,255,0.04))",
                }}
              >
                {autoFillMessage ??
                  project.autoFill?.detailedSummary ??
                  project.autoFill?.summary}
                {project.autoFill?.lastRunAt && (
                  <>
                    {"\n\n"}
                    Última execução: {new Date(project.autoFill.lastRunAt).toLocaleString("pt-PT")}
                    {"\n"}
                    Módulos: {project.autoFill.createdBoxIds?.length ?? 0} · Remates:{" "}
                    {project.autoFill.createdRemateIds?.length ?? 0} · Remate módulo:{" "}
                    {project.autoFill.createdHematiIds?.length ?? 0} · Roda pé:{" "}
                    {project.autoFill.createdRodapeIds?.length ?? 0}
                    {(project.autoFill.trimAppliedMm ?? 0) > 0 &&
                      ` · Trim máx.: ${project.autoFill.trimAppliedMm} mm`}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {room && selectedRoomWall && (
        <Panel title={`Parede: ${WALL_LABEL_TITLES[selectedRoomWall.label] ?? selectedRoomWall.id}`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              wallId: {selectedRoomWall.id}
            </div>
            {numInput("Largura", selectedRoomWall.widthMm, (value) =>
              patchWall(selectedRoomWall.id, { widthMm: value, lengthMm: value }), 100)}
            {numInput("Altura", selectedRoomWall.heightMm, (value) =>
              patchWall(selectedRoomWall.id, { heightMm: value }), 100)}
            {numInput("Espessura", selectedRoomWall.thicknessMm, (value) =>
              patchWall(selectedRoomWall.id, { thicknessMm: value }), 50, 500)}
            {numInput("Posição X", selectedRoomWall.position.x, (value) =>
              patchWall(selectedRoomWall.id, { position: { ...selectedRoomWall.position, x: value } }), -20000)}
            {numInput("Posição Y", selectedRoomWall.position.y, (value) =>
              patchWall(selectedRoomWall.id, { position: { ...selectedRoomWall.position, y: value } }), 0)}
            {numInput("Posição Z", selectedRoomWall.position.z, (value) =>
              patchWall(selectedRoomWall.id, { position: { ...selectedRoomWall.position, z: value } }), -20000)}
            {numInput("Rotação", selectedRoomWall.rotationDeg, (value) =>
              patchWall(selectedRoomWall.id, { rotationDeg: value }), -360, 360, 1, "°")}
          </div>
        </Panel>
      )}

      {room && selectedOpening && (
        <Panel title={`${selectedOpening.type === "door" ? "Porta" : "Janela"} ${selectedOpening.kind}`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {selectedOpening.type === "door" ? "doorId" : "windowId"}: {selectedOpening.id}
            </div>
            <div className="panel-field-row">
              <label className="panel-label" style={{ minWidth: 110 }}>Parede</label>
              <select
                className="input input-sm"
                value={selectedOpening.wallId}
                onChange={(e) => patchOpening(selectedOpening.id, { wallId: e.target.value })}
              >
                {room.walls.map((wall) => (
                  <option key={wall.id} value={wall.id}>
                    {WALL_LABEL_TITLES[wall.label] ?? wall.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="panel-field-row">
              <label className="panel-label" style={{ minWidth: 110 }}>Tipo</label>
              <select
                className="input input-sm"
                value={selectedOpening.kind}
                onChange={(e) => patchOpening(selectedOpening.id, { kind: e.target.value as RoomOpeningKind })}
              >
                <option value="normal">Normal</option>
                <option value="correr">Correr</option>
              </select>
            </div>
            {numInput("Largura", selectedOpening.widthMm, (value) =>
              patchOpening(selectedOpening.id, { widthMm: value }), 100)}
            {numInput("Altura", selectedOpening.heightMm, (value) =>
              patchOpening(selectedOpening.id, { heightMm: value }), 100)}
            {numInput("Espessura", selectedOpening.thicknessMm, (value) =>
              patchOpening(selectedOpening.id, { thicknessMm: value }), 10, 500)}
            {numInput("Posição horiz.", selectedOpening.xPosMm, (value) =>
              patchOpening(selectedOpening.id, { xPosMm: value, horizontalOffsetMm: value }), 0)}
            {numInput("Dist. chão", selectedOpening.floorOffsetMm, (value) =>
              patchOpening(selectedOpening.id, { floorOffsetMm: value, verticalOffsetMm: value }), 0)}
          </div>
        </Panel>
      )}

      {room && <ConversationalDesignerPanel />}
      {room && <ManufacturingPanel />}
      {room && <CostEstimatorPanel />}

      {room && selectedUtility && (
        <Panel title={
          selectedUtility.type === "ElectricalOutlet"
            ? "Tomada"
            : selectedUtility.type === "WaterPoint"
              ? "Ponto de água"
              : "Dreno"
        }>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              utilityId: {selectedUtility.id}
            </div>
            <div className="panel-field-row">
              <label className="panel-label" style={{ minWidth: 110 }}>Parede</label>
              <select
                className="input input-sm"
                value={selectedUtility.wallId}
                onChange={(e) => patchUtility(selectedUtility.id, { wallId: e.target.value })}
              >
                {room.walls.map((wall) => (
                  <option key={wall.id} value={wall.id}>
                    {WALL_LABEL_TITLES[wall.label] ?? wall.id}
                  </option>
                ))}
              </select>
            </div>
            {numInput("Posição", selectedUtility.positionAlongWall, (value) =>
              patchUtility(selectedUtility.id, { positionAlongWall: value }), 0)}
            {numInput("Altura", selectedUtility.heightMm, (value) =>
              patchUtility(selectedUtility.id, { heightMm: value }), 0)}
          </div>
        </Panel>
      )}
    </aside>
  );
}
