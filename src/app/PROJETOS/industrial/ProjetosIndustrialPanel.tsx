import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";

import Button from "@/components/ui/Button";
import type { ProjetosFocusLevel } from "../ProjetosShowroomPanel";
import type { SavedProjectRecord } from "@/core/projects/types";
import {
  fetchProjetosIndustrialSummary,
  fetchProjetosPieceIndustrialState,
  recordProjetosPieceOperation,
  type ProjetosIndustrialSummary,
} from "@/industrial/api/projetosIndustrialActions";
import { iniciarProducaoHandler } from "@/industrial/api/iniciarProducaoHandler";
import { resolveProjetosIndustrialRef } from "@/industrial/integration/projetos/resolveProjetosIndustrialRef";
import QrScannerPanel from "@/app/industrial/work-orders/components/QrScannerPanel";
import { projectCodeFromName } from "@/industrial/work-orders/resolveWorkOrderPiece";
import { PROJETOS_PIECE_OPERATIONS } from "@/industrial/integration/projetos/types";
import { useAuth } from "@/auth/useAuth";
import { applyResultados } from "@/context/projectState";
import { reviveState } from "@/context/projectPersistence";
import { buildIndustrialFerragensForProject } from "@/core/industriais/buildIndustrialFerragensForProject";
import { buildFerragensIndustriaisPdf } from "@/core/pdf/pdfFerragensIndustriais";
import { buildFerragensIndustriaisXlsxBuffer } from "@/core/xlsx/xlsxFerragensIndustriais";
import {
  INDUSTRIAL_PROJECT_ARTIFACTS,
  industrialFerragensPdfFileName,
  industrialFerragensXlsxFileName,
} from "@/core/fabrication/industrialProjectArtifacts";
import { buildBottomSectionPdfs } from "@/core/fabrication/industrialBottomSectionExports";
import { listIndustrialMaterialsSnapshot } from "@/core/materials/service";
import { COMPONENT_TYPES_DEFAULT, type ComponentType } from "@/core/components/componentTypes";
import { FERRAGENS_DEFAULT, type Ferragem } from "@/core/ferragens/ferragens";
import { safeGetItem } from "@/utils/storage";

type Props = {
  snapshot: SavedProjectRecord | null;
  focusLevel: ProjetosFocusLevel;
  pageSlug?: string;
  boxSegment?: string;
  pieceSegment?: string;
};

const STATUS_LABEL: Record<ProjetosIndustrialSummary["status"], string> = {
  pending: "Pendente",
  in_progress: "Em produção",
  completed: "Concluído",
  mixed: "Misto",
};

export default function ProjetosIndustrialPanel({
  snapshot,
  focusLevel,
  pageSlug,
  boxSegment,
  pieceSegment,
}: Props) {
  const { user } = useAuth();
  const ref = resolveProjetosIndustrialRef(snapshot, pageSlug, boxSegment, pieceSegment);
  const [summary, setSummary] = useState<ProjetosIndustrialSummary | null>(null);
  const [pieceState, setPieceState] = useState<Awaited<ReturnType<typeof fetchProjetosPieceIndustrialState>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadingFerragens, setDownloadingFerragens] = useState(false);
  const [downloadingFerragensXlsx, setDownloadingFerragensXlsx] = useState(false);
  const [downloadingSecoes, setDownloadingSecoes] = useState(false);

  const loadComponentTypes = (): ComponentType[] => {
    const raw = safeGetItem("pimo_component_types");
    if (!raw) return COMPONENT_TYPES_DEFAULT;
    try {
      const parsed = JSON.parse(raw) as ComponentType[];
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : COMPONENT_TYPES_DEFAULT;
    } catch {
      return COMPONENT_TYPES_DEFAULT;
    }
  };

  const loadFerragens = (): Ferragem[] => {
    const raw = safeGetItem("pimo_ferragens");
    if (!raw) return FERRAGENS_DEFAULT;
    try {
      const parsed = JSON.parse(raw) as Ferragem[];
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : FERRAGENS_DEFAULT;
    } catch {
      return FERRAGENS_DEFAULT;
    }
  };

  const reload = async () => {
    if (!ref?.projectId) return;
    setLoading(true);
    setError(null);
    try {
      const nextSummary = await fetchProjetosIndustrialSummary(ref.projectId);
      setSummary(nextSummary);
      if (ref.pieceId) {
        setPieceState(await fetchProjetosPieceIndustrialState(ref.pieceId));
      } else {
        setPieceState(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar estado industrial");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    const timer = window.setInterval(() => void reload(), 15000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref?.projectId, ref?.pieceId]);

  const handleCreateWorkOrders = async () => {
    if (!snapshot) return;
    setCreating(true);
    setError(null);
    setMessage(null);
    try {
      const result = await iniciarProducaoHandler(snapshot, user?.id);
      setMessage(`Criadas ${result.orders.length} ordens para "${result.projectName}".`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar ordens de trabalho");
    } finally {
      setCreating(false);
    }
  };

  const handlePieceOp = async (operationId: (typeof PROJETOS_PIECE_OPERATIONS)[number]["id"]) => {
    if (!ref?.pieceId) return;
    setError(null);
    try {
      await recordProjetosPieceOperation(ref.pieceId, operationId, "start", user?.id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao registar operação");
    }
  };

  const handleDownloadFerragensPdf = async () => {
    if (!snapshot) return;
    setDownloadingFerragens(true);
    setError(null);
    try {
      const revived = reviveState(snapshot.snapshot?.projectState);
      if (!revived) throw new Error("Snapshot do projeto indisponível.");
      const state = applyResultados(revived);
      const boxes = state.boxes ?? [];
      if (boxes.length === 0) throw new Error("Projeto sem caixas para exportar ferragens.");
      const projectName = state.projectName?.trim() || ref.projectName || "Projeto";
      const data = buildIndustrialFerragensForProject({
        projectName,
        boxes,
        rules: state.rules,
        materialId: state.materialId,
        extractedPartsByBoxId: state.extractedPartsByBoxId,
        remates: state.remates ?? [],
        rodapes: state.rodapes ?? [],
        pieceObservacoes: state.pieceObservacoes ?? {},
      });
      const doc = buildFerragensIndustriaisPdf(data);
      doc.save(industrialFerragensPdfFileName(projectName));
      setMessage("PDF de ferragens industriais descarregado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao gerar PDF de ferragens");
    } finally {
      setDownloadingFerragens(false);
    }
  };

  const handleDownloadFerragensXlsx = async () => {
    if (!snapshot) return;
    setDownloadingFerragensXlsx(true);
    setError(null);
    try {
      const revived = reviveState(snapshot.snapshot?.projectState);
      if (!revived) throw new Error("Snapshot do projeto indisponível.");
      const state = applyResultados(revived);
      const boxes = state.boxes ?? [];
      if (boxes.length === 0) throw new Error("Projeto sem caixas para exportar ferragens.");
      const projectName = state.projectName?.trim() || ref.projectName || "Projeto";
      const data = buildIndustrialFerragensForProject({
        projectName,
        boxes,
        rules: state.rules,
        materialId: state.materialId,
        extractedPartsByBoxId: state.extractedPartsByBoxId,
        remates: state.remates ?? [],
        rodapes: state.rodapes ?? [],
        pieceObservacoes: state.pieceObservacoes ?? {},
      });
      const buffer = await buildFerragensIndustriaisXlsxBuffer(data);
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = industrialFerragensXlsxFileName(projectName);
      a.click();
      URL.revokeObjectURL(url);
      setMessage("XLSX de ferragens industriais descarregado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao gerar XLSX de ferragens");
    } finally {
      setDownloadingFerragensXlsx(false);
    }
  };

  const handleDownloadSecoesIndustriais = async () => {
    if (!snapshot) return;
    setDownloadingSecoes(true);
    setError(null);
    try {
      const revived = reviveState(snapshot.snapshot?.projectState);
      if (!revived) throw new Error("Snapshot do projeto indisponível.");
      const state = applyResultados(revived);
      const boxes = state.boxes ?? [];
      if (boxes.length === 0) throw new Error("Projeto sem caixas para exportar secções industriais.");
      const projectName = state.projectName?.trim() || ref.projectName || "Projeto";
      const bottomPdfs = await buildBottomSectionPdfs({
        project: {
          projectName,
          boxes,
          rules: state.rules,
          materialId: state.materialId,
          extractedPartsByBoxId: state.extractedPartsByBoxId,
          remates: state.remates ?? [],
          rodapes: state.rodapes ?? [],
          pieceObservacoes: state.pieceObservacoes ?? {},
          industrialPieceEdits: state.industrialPieceEdits,
          ferragemOrla: state.ferragemOrla,
          orlaPresets: state.orlaPresets,
          // Campos financeiros/orla opcionais (tipos Partial — sem lógica nova)
          financeiroOverrides: state.financeiroOverrides,
          financeiroAdminSettings: state.financeiroAdminSettings,
          orlaPieces: state.orlaPieces,
        },
        materials: listIndustrialMaterialsSnapshot(),
        componentTypes: loadComponentTypes(),
        ferragens: loadFerragens(),
        showPrices: false,
      });
      const entries = [
        [bottomPdfs.fileNames.resumoFinanceiro, bottomPdfs.resumoFinanceiro],
        [bottomPdfs.fileNames.pecasTotais, bottomPdfs.pecasTotais],
        [bottomPdfs.fileNames.ferragensTotais, bottomPdfs.ferragensTotais],
        [bottomPdfs.fileNames.totaisProjeto, bottomPdfs.totaisProjeto],
      ] as const;
      for (const [fileName, doc] of entries) {
        doc.save(fileName);
      }
      setMessage("PDFs das secções industriais descarregados.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao gerar PDFs das secções");
    } finally {
      setDownloadingSecoes(false);
    }
  };

  if (!ref) return null;

  return (
    <aside
      className="ui-projetos-hub__industrial"
      style={{
        width: 300,
        minWidth: 260,
        maxWidth: 340,
        borderLeft: "1px solid #e4e4e7",
        background: "#fafafa",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "12px 14px", borderBottom: "1px solid #e4e4e7" }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#18181b" }}>PIMO‑TRAK</h2>
        <p style={{ margin: "4px 0 0", fontSize: 11, color: "#71717a" }}>
          Estado industrial · {focusLevel === "project" ? "projecto" : focusLevel === "box" ? "caixa" : "peça"}
        </p>
      </div>

      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", flex: 1 }}>
        <QrScannerPanel />
        {focusLevel === "project" ? (
          <Button
            variant="primary"
            disabled={creating || !snapshot}
            onClick={() => void handleCreateWorkOrders()}
            style={{ width: "100%", fontSize: 13 }}
          >
            {creating ? "A criar…" : "Iniciar Produção"}
          </Button>
        ) : null}

        {loading ? <p style={{ margin: 0, fontSize: 12, color: "#71717a" }}>A sincronizar…</p> : null}
        {message ? <p style={{ margin: 0, fontSize: 12, color: "#16a34a" }}>{message}</p> : null}
        {error ? <p style={{ margin: 0, fontSize: 12, color: "#dc2626" }}>{error}</p> : null}

        {summary ? (
          <section style={cardStyle}>
            <h3 style={titleStyle}>Work Orders</h3>
            <p style={rowStyle}>
              Estado: <strong>{STATUS_LABEL[summary.status]}</strong>
            </p>
            <p style={rowStyle}>Progresso: {summary.progressPct}%</p>
            <p style={rowStyle}>
              Ordens: {summary.orders.length} · Tarefas: {summary.completedTasks}/{summary.totalTasks}
            </p>
            <Link
              to={`/industrial/work-orders?project=${encodeURIComponent(projectCodeFromName(ref.projectName))}`}
              style={linkStyle}
            >
              Abrir Work Orders
            </Link>
            <Link to={`/industrial/supervisor?project=${encodeURIComponent(ref.projectId)}`} style={linkStyle}>
              Abrir Supervisor
            </Link>
          </section>
        ) : null}

        {focusLevel === "project" ? (
          <section style={cardStyle}>
            <h3 style={titleStyle}>Arquivos industriais</h3>
            <p style={rowStyle}>Incluídos no arquivo completo ou exportação manual.</p>
            <ul style={{ margin: "6px 0 0", paddingLeft: 16, fontSize: 11, color: "#52525b" }}>
              {INDUSTRIAL_PROJECT_ARTIFACTS.map((file) => (
                <li key={file.id} style={{ marginBottom: 4 }}>
                  <strong>{file.label}</strong> — <code>{file.filename}</code>
                  {file.description ? ` · ${file.description}` : ""}
                </li>
              ))}
            </ul>
            <Button
              variant="secondary"
              disabled={!snapshot || downloadingSecoes}
              onClick={() => void handleDownloadSecoesIndustriais()}
              style={{ width: "100%", marginTop: 8, fontSize: 12 }}
            >
              {downloadingSecoes ? "A gerar…" : "Descarregar secções industriais (4 PDFs)"}
            </Button>
            <Button
              variant="secondary"
              disabled={!snapshot || downloadingFerragens}
              onClick={() => void handleDownloadFerragensPdf()}
              style={{ width: "100%", marginTop: 10, fontSize: 12 }}
            >
              {downloadingFerragens ? "A gerar…" : "Descarregar ferragens (PDF)"}
            </Button>
            <Button
              variant="secondary"
              disabled={!snapshot || downloadingFerragensXlsx}
              onClick={() => void handleDownloadFerragensXlsx()}
              style={{ width: "100%", marginTop: 8, fontSize: 12 }}
            >
              {downloadingFerragensXlsx ? "A gerar…" : "Descarregar ferragens (XLSX)"}
            </Button>
          </section>
        ) : null}

        {ref.etiquetaCode ? (
          <section style={cardStyle}>
            <h3 style={titleStyle}>Etiqueta industrial</h3>
            <p style={{ ...rowStyle, fontFamily: "monospace", fontWeight: 600 }}>{ref.etiquetaCode}</p>
            {ref.qrPayload ? <p style={{ ...rowStyle, fontSize: 10, wordBreak: "break-all" }}>{ref.qrPayload}</p> : null}
            {ref.pieceId ? (
              <Link to={`/industrial/piece/${encodeURIComponent(ref.pieceId)}`} style={linkStyle}>
                Ficha industrial da peça
              </Link>
            ) : null}
          </section>
        ) : null}

        {focusLevel === "piece" && pieceState ? (
          <section style={cardStyle}>
            <h3 style={titleStyle}>Operações da peça</h3>
            <p style={rowStyle}>
              Tracking: {pieceState.tracking?.status ?? "—"} ({Math.round(pieceState.tracking?.progress ?? 0)}%)
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {PROJETOS_PIECE_OPERATIONS.map((op) => (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => void handlePieceOp(op.id)}
                  style={{
                    fontSize: 10,
                    padding: "4px 8px",
                    borderRadius: 4,
                    border: "1px solid #d4d4d8",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  {op.label}
                </button>
              ))}
            </div>
            <ul style={{ margin: "8px 0 0", paddingLeft: 16, fontSize: 11, color: "#52525b" }}>
              {pieceState.tasks.slice(0, 8).map((task) => (
                <li key={task.id}>
                  {task.operationType}: {task.status}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </aside>
  );
}

const cardStyle: CSSProperties = {
  padding: 10,
  borderRadius: 8,
  border: "1px solid #e4e4e7",
  background: "#fff",
};

const titleStyle: CSSProperties = {
  margin: "0 0 6px",
  fontSize: 12,
  fontWeight: 700,
  color: "#3f3f46",
};

const rowStyle: CSSProperties = {
  margin: "0 0 4px",
  fontSize: 11,
  color: "#52525b",
};

const linkStyle: CSSProperties = {
  display: "block",
  marginTop: 6,
  fontSize: 11,
  color: "#2563eb",
  textDecoration: "none",
};
