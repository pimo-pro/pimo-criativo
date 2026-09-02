/**
 * pimo-room v4 — painel de configurações da sala (Salão).
 * Controlos em mm; tokens de tema existentes; sem referências externas.
 */
import { useEffect, useMemo, useState } from "react";
import { useProject } from "../../../context/useProject";
import Panel from "../../ui/Panel";
import { useUiStore, uiStore } from "../../../stores/uiStore";
import { wallStore, useWallStore } from "../../../stores/wallStore";
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

export function PainelSala() {
  const { project, actions } = useProject();
  const room = project.room;
  const selectedObject = useUiStore((s) => s.selectedObject);
  const selectedWallId = useWallStore((s) => s.selectedWallId);
  const setRoomPanelOpen = useUiStore((s) => s.setRoomPanelOpen);

  const [widthMm, setWidthMm] = useState<number>(ROOM_20_DEFAULTS.widthMm);
  const [depthMm, setDepthMm] = useState<number>(ROOM_20_DEFAULTS.depthMm);
  const [heightMm, setHeightMm] = useState<number>(ROOM_20_DEFAULTS.heightMm);
  const [thicknessMm, setThicknessMm] = useState<number>(ROOM_20_DEFAULTS.wallThicknessMm);

  useEffect(() => {
    if (!room) return;
    setWidthMm(room.widthMm);
    setDepthMm(room.depthMm);
    setHeightMm(room.heightMm);
    setThicknessMm(room.wallThicknessMm);
  }, [room]);

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

  const addOpening = (type: "door" | "window", kind: RoomOpeningKind) => {
    if (!room || !activeWall) return;
    const opening = makeOpening(type, kind, activeWall);
    patchRoom({ openings: [...room.openings, opening] });
    uiStore.getState().setSelectedObject({ type: "roomElement", id: opening.id });
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
          floorOffsetMm,
          verticalOffsetMm: floorOffsetMm,
          xPosMm,
          horizontalOffsetMm: xPosMm,
        };
      }),
    });
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
        </div>
      </Panel>

      {room ? (
        <Panel title="Paredes">
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

      {room && activeWall ? (
        <Panel title={`Aberturas — ${WALL_LABEL_TITLES[activeWall.label] ?? activeWall.label}`}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button type="button" className="button button-ghost" onClick={() => addOpening("door", "normal")}>
              Porta
            </button>
            <button type="button" className="button button-ghost" onClick={() => addOpening("door", "correr")}>
              Porta correr
            </button>
            <button type="button" className="button button-ghost" onClick={() => addOpening("window", "normal")}>
              Janela
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

      {selectedOpening ? (
        <Panel title="Editar abertura">
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
    </aside>
  );
}

export default PainelSala;
