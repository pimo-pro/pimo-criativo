/**
 * Modal «Sobre o RoomEngine» — estilo pimo-alfa.
 */
import { PIMO_ALFA_EDITION, PIMO_ALFA_VERSION, PIMO_ROOM_CAPABILITIES, ROOM_ENGINE_PHASE, ROOM_ENGINE_VERSION } from "../version";

type AboutRoomEngineModalProps = {
  open: boolean;
  onClose: () => void;
};

export function AboutRoomEngineModal({ open, onClose }: AboutRoomEngineModalProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-room-engine-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.45)",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="panel-content"
        style={{
          maxWidth: 420,
          width: "100%",
          padding: 16,
          background: "var(--panel-bg, var(--bg-elevated, #1a1a1a))",
          border: "1px solid var(--border-color, rgba(255,255,255,0.12))",
          borderRadius: 8,
          boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <h2 id="about-room-engine-title" className="section-title" style={{ flex: 1, margin: 0, fontSize: 16 }}>
            Sobre o RoomEngine
          </h2>
          <button type="button" className="button button-ghost" onClick={onClose} aria-label="Fechar">
            Fechar
          </button>
        </div>

        <p style={{ fontSize: 13, margin: "0 0 8px", color: "var(--text-main)" }}>
          PIMO-ALFA v{PIMO_ALFA_VERSION} — {PIMO_ALFA_EDITION}
        </p>
        <p style={{ fontSize: 12, margin: "0 0 12px", color: "var(--text-muted)" }}>
          RoomEngine v{ROOM_ENGINE_VERSION} · fase {ROOM_ENGINE_PHASE} · pacote{" "}
          <code style={{ fontSize: 11 }}>pimo-room-v4</code>
        </p>

        <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Capacidades</p>
        <ul style={{ margin: "0 0 12px", paddingLeft: 18, fontSize: 12, color: "var(--text-muted)" }}>
          {PIMO_ROOM_CAPABILITIES.map((c) => (
            <li key={c} style={{ marginBottom: 2 }}>
              {c}
            </li>
          ))}
        </ul>

        <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Documentação</p>
        <ul style={{ margin: "0 0 12px", paddingLeft: 18, fontSize: 12 }}>
          <li>
            <code style={{ fontSize: 11 }}>docs/PIMO_ROOM_V4_RELEASE_NOTES.md</code>
          </li>
          <li>
            <code style={{ fontSize: 11 }}>docs/PIMO_ROOM_V4_FINAL.md</code>
          </li>
        </ul>

        <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>API pública</p>
        <p
          style={{
            fontSize: 11,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            color: "var(--text-muted)",
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          PimoRoom · loadRoom · importIfc · importGlb · exportGlb
          <br />
          applyAiPreset · autoArrange · autoDesign · get/setRoomState
          <br />
          RoomBridge · RoomIndustrialAdapter
        </p>
      </div>
    </div>
  );
}
