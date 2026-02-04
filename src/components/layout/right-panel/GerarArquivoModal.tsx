/**
 * Modal Gerar Arquivo — conteúdo (Cutlist / PDF Técnico / Ambos), método de saída e ações rápidas de exportação.
 */

import { useState } from "react";

export type GerarArquivoConteudo = "cutlist" | "tecnico" | "ambos";

type Props = {
  onClose: () => void;
  onConfirm: (opcoes: { conteudo: GerarArquivoConteudo; download: boolean }) => void;
  hasBoxes: boolean;
  onPdfTecnico: () => void;
  onCutlist: () => void;
  onAmbos: () => void;
  onLayoutCorte: () => void;
  onExportarCnc: () => void;
};

const labelStyle = { fontSize: 12, color: "var(--text-main)" };
const metaStyle = { fontSize: 11, color: "var(--text-muted)", marginTop: 2 };

export default function GerarArquivoModal({
  onClose,
  onConfirm,
  hasBoxes,
  onPdfTecnico,
  onCutlist,
  onAmbos,
  onLayoutCorte,
  onExportarCnc,
}: Props) {
  const [conteudo, setConteudo] = useState<GerarArquivoConteudo>("cutlist");
  const [download, setDownload] = useState(true);

  const handleConfirm = () => {
    onConfirm({ conteudo, download });
    onClose();
  };

  const canConfirm = download;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Gerar Arquivo</div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="modal-list" style={{ padding: "0 16px 16px" }}>
          <div className="modal-list-item" style={{ padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="modal-list-info">
              <div style={labelStyle}>Conteúdo</div>
              <div style={metaStyle}>Selecione o que gerar ao clicar em Gerar</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="conteudo"
                  checked={conteudo === "cutlist"}
                  onChange={() => setConteudo("cutlist")}
                  disabled={!hasBoxes}
                />
                <span>Lista Industrial (Cut List)</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="conteudo"
                  checked={conteudo === "tecnico"}
                  onChange={() => setConteudo("tecnico")}
                  disabled={!hasBoxes}
                />
                <span>PDF Técnico</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="conteudo"
                  checked={conteudo === "ambos"}
                  onChange={() => setConteudo("ambos")}
                  disabled={!hasBoxes}
                />
                <span>Ambos (Cutlist + PDF Técnico + Arquivo Unificado)</span>
              </label>
            </div>
          </div>

          <div className="modal-list-item" style={{ padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="modal-list-info">
              <div style={labelStyle}>Método de saída</div>
              <div style={metaStyle}>Download (e-mail/WhatsApp em breve)</div>
            </div>
            <div style={{ marginTop: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={download} onChange={(e) => setDownload(e.target.checked)} />
                <span>Download</span>
              </label>
            </div>
          </div>

          <button
            type="button"
            className="modal-action"
            style={{ marginTop: 12, width: "100%" }}
            onClick={handleConfirm}
            disabled={!canConfirm || !hasBoxes}
          >
            Gerar
          </button>

          <div style={{ marginTop: 20, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ ...labelStyle, marginBottom: 10 }}>Exportação rápida</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button type="button" className="modal-action" style={{ width: "100%", fontSize: 12 }} onClick={() => { onPdfTecnico(); onClose(); }}>
                PDF Técnico
              </button>
              <button type="button" className="modal-action" style={{ width: "100%", fontSize: 12 }} onClick={() => { onCutlist(); onClose(); }}>
                Cutlist Industrial
              </button>
              <button type="button" className="modal-action" style={{ width: "100%", fontSize: 12, fontWeight: 600 }} onClick={() => { onAmbos(); onClose(); }}>
                Ambos (Unificado)
              </button>
              <button type="button" className="modal-action" style={{ width: "100%", fontSize: 12, opacity: 0.9 }} onClick={() => { onLayoutCorte(); onClose(); }}>
                Layout de Corte PRO
              </button>
              <button type="button" className="modal-action" style={{ width: "100%", fontSize: 12, fontWeight: 600 }} onClick={() => { onExportarCnc(); onClose(); }}>
                Exportar CNC (TCN + KDT)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
