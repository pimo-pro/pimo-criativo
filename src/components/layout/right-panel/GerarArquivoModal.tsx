/**
 * Modal de exportação — Gerar Arquivo.
 * Opções: tipo (PDF, Excel), conteúdo (Lista Industrial, PDF Técnico, Ambos), método (Download, Email, WhatsApp).
 */

import { useState } from "react";

export type GerarArquivoConteudo = "cutlist" | "tecnico" | "ambos";
export type GerarArquivoMetodo = "download" | "email" | "whatsapp";

type Props = {
  onClose: () => void;
  onConfirm: (opcoes: {
    tipoPdf: boolean;
    tipoExcel: boolean;
    cutlist: boolean;
    pdfTecnico: boolean;
    download: boolean;
    email: boolean;
    whatsapp: boolean;
  }) => void;
  hasBoxes: boolean;
};

const labelStyle = { fontSize: 12, color: "var(--text-main)" };
const metaStyle = { fontSize: 11, color: "var(--text-muted)", marginTop: 2 };

export default function GerarArquivoModal({ onClose, onConfirm, hasBoxes }: Props) {
  const [tipoPdf, setTipoPdf] = useState(true);
  const [tipoExcel, setTipoExcel] = useState(false);
  const [cutlist, setCutlist] = useState(true);
  const [pdfTecnico, setPdfTecnico] = useState(false);
  const [download, setDownload] = useState(true);
  const [email, setEmail] = useState(false);
  const [whatsapp, setWhatsapp] = useState(false);

  const handleConfirm = () => {
    onConfirm({
      tipoPdf,
      tipoExcel,
      cutlist,
      pdfTecnico,
      download,
      email,
      whatsapp,
    });
    onClose();
  };

  const contentCount = (cutlist ? 1 : 0) + (pdfTecnico ? 1 : 0);
  const canConfirm = (tipoPdf || tipoExcel) && contentCount > 0 && (download || email || whatsapp);

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
              <div style={labelStyle}>Tipo de arquivo</div>
              <div style={metaStyle}>Selecione o formato de saída</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={tipoPdf} onChange={(e) => setTipoPdf(e.target.checked)} />
                <span>PDF</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={tipoExcel} onChange={(e) => setTipoExcel(e.target.checked)} />
                <span>Excel</span>
              </label>
            </div>
          </div>

          <div className="modal-list-item" style={{ padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="modal-list-info">
              <div style={labelStyle}>Conteúdo</div>
              <div style={metaStyle}>Selecione o que incluir no arquivo</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={cutlist}
                  onChange={(e) => setCutlist(e.target.checked)}
                  disabled={!hasBoxes}
                />
                <span>Lista Industrial (Cut List)</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={pdfTecnico} onChange={(e) => setPdfTecnico(e.target.checked)} />
                <span>PDF Técnico</span>
              </label>
              <label
                style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
                onClick={() => {
                  setCutlist(true);
                  setPdfTecnico(true);
                }}
              >
                <input type="checkbox" checked={cutlist && pdfTecnico} readOnly />
                <span>Ambos</span>
              </label>
            </div>
          </div>

          <div className="modal-list-item" style={{ padding: "12px 0" }}>
            <div className="modal-list-info">
              <div style={labelStyle}>Método de saída</div>
              <div style={metaStyle}>Como deseja obter o arquivo</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={download} onChange={(e) => setDownload(e.target.checked)} />
                <span>Download</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", opacity: 0.6 }}>
                <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} disabled />
                <span>Enviar por e-mail</span>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>(em breve)</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", opacity: 0.6 }}>
                <input type="checkbox" checked={whatsapp} onChange={(e) => setWhatsapp(e.target.checked)} disabled />
                <span>Enviar via WhatsApp</span>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>(em breve)</span>
              </label>
            </div>
          </div>

          <button
            type="button"
            className="modal-action"
            style={{ marginTop: 16, width: "100%" }}
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            Gerar
          </button>
        </div>
      </div>
    </div>
  );
}
