import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { makeReportId, type ReportTextoItem } from "@/core/projectReport";
import { reportInput, reportLabel } from "../reportStyles";
import { R } from "../uiLabels";
import EditableModal from "./EditableModal";

export type FeedbackKind = "erro" | "solucao" | "melhoriaProposta" | "melhoriaImpl";

export type FeedbackBucket = {
  kind: FeedbackKind;
  label: string;
  items: ReportTextoItem[];
  onChange: (next: ReportTextoItem[]) => void;
};

type Props = {
  buckets: FeedbackBucket[];
};

type FlatItem = ReportTextoItem & { kind: FeedbackKind; label: string };

const KIND_COLOR: Record<FeedbackKind, string> = {
  erro: "#dc2626",
  solucao: "#ea580c",
  melhoriaProposta: "#2563eb",
  melhoriaImpl: "#16a34a",
};

export default function ReportFeedbackPanel({ buckets }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [activeKind, setActiveKind] = useState<FeedbackKind | null>(null);
  const [texto, setTexto] = useState("");
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const flat: FlatItem[] = buckets.flatMap((b) =>
    b.items.map((item) => ({ ...item, kind: b.kind, label: b.label }))
  );

  const openAdd = (kind: FeedbackKind) => {
    setMenuOpen(false);
    setEditId(null);
    setActiveKind(kind);
    setTexto("");
    setModalOpen(true);
  };

  const openEdit = (item: FlatItem) => {
    setEditId(item.id);
    setActiveKind(item.kind);
    setTexto(item.texto);
    setModalOpen(true);
  };

  const bucketOf = (kind: FeedbackKind | null) => buckets.find((b) => b.kind === kind) ?? null;

  const save = () => {
    const t = texto.trim();
    const bucket = bucketOf(activeKind);
    if (!t || !bucket) return;
    if (editId) {
      bucket.onChange(bucket.items.map((i) => (i.id === editId ? { ...i, texto: t } : i)));
    } else {
      bucket.onChange([...bucket.items, { id: makeReportId("it"), texto: t }]);
    }
    setModalOpen(false);
    setTexto("");
    setEditId(null);
    setActiveKind(null);
  };

  const remove = (item: FlatItem) => {
    const bucket = bucketOf(item.kind);
    if (!bucket) return;
    bucket.onChange(bucket.items.filter((i) => i.id !== item.id));
  };

  const modalTitle = (() => {
    if (editId) return R.editarItem;
    const b = bucketOf(activeKind);
    return b ? `${R.adicionar}: ${b.label}` : R.novoItem;
  })();

  return (
    <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span style={{ ...reportLabel, marginBottom: 0 }}>{R.registoFeedback}</span>
        <div ref={menuRef} style={{ position: "relative" }}>
          <Button type="button" variant="secondary" onClick={() => setMenuOpen((v) => !v)}>
            + {R.adicionar}
          </Button>
          {menuOpen ? (
            <div
              role="menu"
              style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 6px)",
                zIndex: 20,
                minWidth: 220,
                background: "var(--card-bg, var(--ui-color-surface, #fff))",
                border: "1px solid var(--border, rgba(127,127,127,0.25))",
                borderRadius: 10,
                boxShadow: "0 10px 28px rgba(0,0,0,0.12)",
                padding: 6,
                display: "grid",
                gap: 2,
              }}
            >
              {buckets.map((b) => (
                <button
                  key={b.kind}
                  type="button"
                  role="menuitem"
                  onClick={() => openAdd(b.kind)}
                  style={{
                    textAlign: "left",
                    border: "none",
                    background: "transparent",
                    borderRadius: 8,
                    padding: "9px 10px",
                    cursor: "pointer",
                    fontSize: 13,
                    color: "var(--text-main)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 99,
                      background: KIND_COLOR[b.kind],
                      flexShrink: 0,
                    }}
                  />
                  {b.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {flat.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{R.semItens}</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {flat.map((item) => (
            <div
              key={`${item.kind}-${item.id}`}
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 8,
                border: "1px solid var(--border, rgba(127,127,127,0.25))",
                borderRadius: 8,
                padding: "10px 12px",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: "inline-block",
                    fontSize: 11,
                    fontWeight: 700,
                    color: KIND_COLOR[item.kind],
                    background: `${KIND_COLOR[item.kind]}14`,
                    borderRadius: 999,
                    padding: "2px 8px",
                    marginBottom: 6,
                  }}
                >
                  {item.label}
                </span>
                <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{item.texto}</div>
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <Button type="button" variant="ghost" onClick={() => openEdit(item)}>
                  {R.editar}
                </Button>
                <Button type="button" variant="ghost" onClick={() => remove(item)}>
                  {R.excluir}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <EditableModal open={modalOpen} title={modalTitle} onClose={() => setModalOpen(false)}>
        <div style={{ display: "grid", gap: 10 }}>
          <label>
            <span style={reportLabel}>{R.texto}</span>
            <textarea
              style={{ ...reportInput, minHeight: 90, resize: "vertical" }}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              autoFocus
            />
          </label>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              {R.cancelar}
            </Button>
            <Button type="button" variant="primary" onClick={save} disabled={!texto.trim()}>
              {R.guardarNota}
            </Button>
          </div>
        </div>
      </EditableModal>
    </div>
  );
}
