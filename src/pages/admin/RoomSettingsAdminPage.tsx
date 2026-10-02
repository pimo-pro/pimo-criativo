/**
 * ADMIN — Configurações da Sala (pimo-room v4).
 * Rota: /admin/room-settings
 * Estilo pimo-alfa. Não altera cutlist/CNC.
 */
import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Panel from "../../components/ui/Panel";
import {
  AI_PRESETS,
  CATALOG_PRESETS,
  PimoRoom,
  PIMO_ALFA_EDITION,
  PIMO_ALFA_VERSION,
  ROOM_ENGINE_PHASE,
  ROOM_ENGINE_VERSION,
  RoomBridge,
  RoomIndustrialAdapter,
  AboutRoomEngineModal,
  GlbExporter,
  applyAiPreset,
  autoArrange,
  autoDesign,
  buildRectangularRoomState,
  buildRoomReportMetadata,
  exportGlb,
  getRoomState,
  setRoomState,
  type AiPresetId,
  type RoomState,
} from "../../pimo-room/domain";

export default function RoomSettingsAdminPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [styleId, setStyleId] = useState<AiPresetId>("moderno");
  const [tick, setTick] = useState(0);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const ifcRef = useRef<HTMLInputElement>(null);
  const glbRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);

  const state = useMemo(() => getRoomState(), [tick]);
  const meta = state ? buildRoomReportMetadata(state) : null;

  const refresh = () => setTick((t) => t + 1);

  const ensureDemoRoom = (): RoomState => {
    const cur = getRoomState();
    if (cur) return cur;
    const demo = buildRectangularRoomState({
      widthMm: 4000,
      depthMm: 4000,
      heightMm: 2600,
      wallThicknessMm: 200,
    });
    setRoomState(demo);
    refresh();
    return demo;
  };

  const handleImportJson = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    setImportMenuOpen(false);
    try {
      const text = await file.text();
      const raw = JSON.parse(text) as unknown;
      const result = RoomBridge.importJson(raw);
      if (!result.ok || !result.state) {
        setMessage(result.errors[0] ?? "Falha JSON");
        return;
      }
      setRoomState(result.state);
      refresh();
      setMessage(`JSON: ${result.state.walls.length} parede(s)`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erro JSON");
    } finally {
      setBusy(false);
      if (jsonRef.current) jsonRef.current.value = "";
    }
  };

  const handleImportIfc = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    setImportMenuOpen(false);
    try {
      const result = await RoomBridge.importIfcFile(file);
      if (!result.ok || !result.state) {
        setMessage(result.errors[0] ?? "Falha IFC");
        return;
      }
      setRoomState(result.state);
      refresh();
      setMessage(`IFC: ${result.state.levels.length} nível(is), ${result.state.walls.length} parede(s)`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erro IFC");
    } finally {
      setBusy(false);
      if (ifcRef.current) ifcRef.current.value = "";
    }
  };

  const handleImportGlb = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    setImportMenuOpen(false);
    try {
      const result = await RoomBridge.importGlbFile(file, "room");
      if (!result.ok || !result.state) {
        setMessage(result.errors[0] ?? "Falha GLB");
        return;
      }
      setRoomState(result.state);
      refresh();
      setMessage(`GLB: ${result.state.walls.length} parede(s)`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erro GLB");
    } finally {
      setBusy(false);
      if (glbRef.current) glbRef.current.value = "";
    }
  };

  const handleExportGlb = async () => {
    const s = ensureDemoRoom();
    setExportMenuOpen(false);
    setBusy(true);
    try {
      const result = await exportGlb(s);
      if (!result.ok || !result.buffer) {
        setMessage(result.errors[0] ?? "Falha export GLB");
        return;
      }
      GlbExporter.downloadBuffer(result.buffer, `pimo-room-${s.id}.glb`);
      setMessage("GLB (sala) exportado");
    } finally {
      setBusy(false);
    }
  };

  const handleExportItems = async () => {
    const s = ensureDemoRoom();
    setExportMenuOpen(false);
    setBusy(true);
    try {
      const result = await GlbExporter.exportItemsOnly(s);
      if (!result.ok || !result.buffer) {
        setMessage(result.errors[0] ?? "Falha export itens");
        return;
      }
      GlbExporter.downloadBuffer(result.buffer, `pimo-items-${s.id}.glb`);
      setMessage("GLB (itens) exportado");
    } finally {
      setBusy(false);
    }
  };

  const handleExportMeta = () => {
    const s = ensureDemoRoom();
    setExportMenuOpen(false);
    GlbExporter.downloadJson(buildRoomReportMetadata(s), `pimo-room-meta-${s.id}.json`);
    setMessage("JSON (metadata) exportado");
  };

  const handleExportAi = async () => {
    const s = ensureDemoRoom();
    setExportMenuOpen(false);
    setBusy(true);
    try {
      const result = await GlbExporter.exportAiLayout(s);
      if (!result.ok || !result.buffer) {
        setMessage(result.errors[0] ?? "Falha AI layout");
        return;
      }
      GlbExporter.downloadBuffer(result.buffer, `pimo-ai-layout-${s.id}.glb`);
      setMessage("AI layout GLB exportado");
    } finally {
      setBusy(false);
    }
  };

  const handleAutoArrange = () => {
    const s = ensureDemoRoom();
    const result = autoArrange(s);
    if (!result) return;
    setRoomState(result.state);
    refresh();
    setMessage(`Auto-Arrange: ${result.movedIds.length} item(ns)`);
  };

  const handleAutoDesign = () => {
    const s = ensureDemoRoom();
    const result = autoDesign(styleId, s);
    if (!result) return;
    setRoomState(result.state);
    refresh();
    setMessage(`Auto-Design (${styleId}): ${result.addedIds.length} item(ns)`);
  };

  const handleApplyPreset = () => {
    const s = ensureDemoRoom();
    const result = applyAiPreset(styleId, s);
    if (result.state) {
      setRoomState(result.state);
      refresh();
      setMessage(`Preset ${styleId} aplicado`);
    } else {
      setMessage(result.errors[0] ?? "Falha preset");
    }
  };

  const industrialOk = state
    ? RoomIndustrialAdapter.assertIndustrialIsolation(RoomIndustrialAdapter.sync(state))
    : true;

  return (
    <div className="page" style={{ padding: 16, maxWidth: 960, margin: "0 auto" }}>
      <div style={{ marginBottom: 12 }}>
        <Link to="/admin/global-settings" style={{ fontSize: 13, color: "var(--text-muted)" }}>
          ← Admin
        </Link>
      </div>
      <h1 className="section-title" style={{ marginBottom: 4 }}>
        Configurações da Sala
      </h1>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
        PIMO-ALFA v{PIMO_ALFA_VERSION} — {PIMO_ALFA_EDITION}
      </p>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
        RoomEngine v{ROOM_ENGINE_VERSION} · fase {ROOM_ENGINE_PHASE} · isolamento industrial:{" "}
        {industrialOk ? "OK" : "FALHA"}
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16, fontSize: 13 }}>
        <button type="button" className="button button-ghost" onClick={() => setAboutOpen(true)}>
          Sobre o RoomEngine
        </button>
        <a
          href="/docs/PIMO_ROOM_V4_RELEASE_NOTES.md"
          style={{ color: "var(--text-muted)" }}
          onClick={(e) => {
            e.preventDefault();
            setMessage("Release Notes: docs/PIMO_ROOM_V4_RELEASE_NOTES.md (repositório local)");
          }}
        >
          Release Notes →
        </a>
      </div>

      <Panel title="Estado">
        {meta ? (
          <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 4 }}>
            <div>
              Níveis: {meta.levels.map((l) => l.name).join(", ") || "—"}
            </div>
            <div>
              Footprint: {Math.round(meta.footprint.widthMm)}×{Math.round(meta.footprint.depthMm)}×
              {Math.round(meta.footprint.heightMm)} mm
            </div>
            <div>
              Slabs: {meta.slabs.length} · Itens: {meta.items.length} · AI: {meta.aiPreset ?? "—"}
            </div>
            <div>Catálogo presets: {CATALOG_PRESETS.length}</div>
          </div>
        ) : (
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Nenhuma sala no store. Importe IFC/GLB ou use Auto-Design (cria sala demo).
          </p>
        )}
      </Panel>

      <Panel title="Importar / Exportar">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ position: "relative" }}>
            <button
              type="button"
              className="button button-ghost"
              disabled={busy}
              onClick={() => {
                setExportMenuOpen(false);
                setImportMenuOpen((v) => !v);
              }}
            >
              Importar
            </button>
            {importMenuOpen ? (
              <div
                style={{
                  position: "absolute",
                  zIndex: 20,
                  top: "100%",
                  left: 0,
                  marginTop: 4,
                  minWidth: 160,
                  background: "var(--panel-bg, var(--surface))",
                  border: "1px solid var(--border-color, var(--border))",
                  display: "flex",
                  flexDirection: "column",
                  padding: 4,
                }}
              >
                <button type="button" className="button button-ghost" style={{ justifyContent: "flex-start" }} onClick={() => jsonRef.current?.click()}>
                  JSON (sala)
                </button>
                <button type="button" className="button button-ghost" style={{ justifyContent: "flex-start" }} onClick={() => ifcRef.current?.click()}>
                  IFC
                </button>
                <button type="button" className="button button-ghost" style={{ justifyContent: "flex-start" }} onClick={() => glbRef.current?.click()}>
                  GLB (sala)
                </button>
              </div>
            ) : null}
          </div>
          <div style={{ position: "relative" }}>
            <button
              type="button"
              className="button button-ghost"
              disabled={busy}
              onClick={() => {
                setImportMenuOpen(false);
                setExportMenuOpen((v) => !v);
              }}
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
                  minWidth: 180,
                  background: "var(--panel-bg, var(--surface))",
                  border: "1px solid var(--border-color, var(--border))",
                  display: "flex",
                  flexDirection: "column",
                  padding: 4,
                }}
              >
                <button type="button" className="button button-ghost" style={{ justifyContent: "flex-start" }} onClick={() => void handleExportGlb()}>
                  GLB (sala completa)
                </button>
                <button type="button" className="button button-ghost" style={{ justifyContent: "flex-start" }} onClick={() => void handleExportItems()}>
                  GLB (itens)
                </button>
                <button type="button" className="button button-ghost" style={{ justifyContent: "flex-start" }} onClick={() => handleExportMeta()}>
                  JSON (metadata)
                </button>
                <button type="button" className="button button-ghost" style={{ justifyContent: "flex-start" }} onClick={() => void handleExportAi()}>
                  AI layout GLB
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
          Formatos suportados: JSON, IFC, GLB
        </p>
        <input
          ref={jsonRef}
          type="file"
          accept=".json,application/json"
          style={{ display: "none" }}
          onChange={(e) => void handleImportJson(e.target.files?.[0] ?? null)}
        />
        <input
          ref={ifcRef}
          type="file"
          accept=".ifc"
          style={{ display: "none" }}
          onChange={(e) => void handleImportIfc(e.target.files?.[0] ?? null)}
        />
        <input
          ref={glbRef}
          type="file"
          accept=".glb,.gltf"
          style={{ display: "none" }}
          onChange={(e) => void handleImportGlb(e.target.files?.[0] ?? null)}
        />
      </Panel>

      <Panel title="AI / Catálogo">
        <label className="panel-label" style={{ fontSize: 12 }}>
          Preset AI
        </label>
        <select
          className="input input-sm"
          value={styleId}
          onChange={(e) => setStyleId(e.target.value as AiPresetId)}
          style={{ marginBottom: 8 }}
        >
          {AI_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="button button-ghost" onClick={handleAutoArrange}>
            Auto-Arrange
          </button>
          <button type="button" className="button button-ghost" onClick={handleAutoDesign}>
            Auto-Design
          </button>
          <button type="button" className="button button-primary" onClick={handleApplyPreset}>
            Aplicar Preset
          </button>
        </div>
      </Panel>

      <Panel title="API">
        <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "ui-monospace, monospace" }}>
          PimoRoom.version = {PimoRoom.version}
          <br />
          loadRoom · importIfc · importGlb · exportGlb · applyAiPreset · autoArrange · autoDesign
        </p>
      </Panel>

      {message ? (
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>{message}</p>
      ) : null}
      <AboutRoomEngineModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  );
}
