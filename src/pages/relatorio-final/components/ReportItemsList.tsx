import { useState } from "react";
import Button from "@/components/ui/Button";
import { makeReportId, type ReportTextoItem } from "@/core/projectReport";
import { reportInput, reportLabel } from "../reportStyles";
import { R } from "../uiLabels";
import EditableModal from "./EditableModal";

type Props = {
  label: string;
  items: ReportTextoItem[];
  onChange: (next: ReportTextoItem[]) => void;
};

export default function ReportItemsList({ label, items, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [texto, setTexto] = useState("");

  const openAdd = () => {
    setEditId(null);
    setTexto("");
    setOpen(true);
  };

  const openEdit = (item: ReportTextoItem) => {
    setEditId(item.id);
    setTexto(item.texto);
    setOpen(true);
  };

  const save = () => {
    const t = texto.trim();
    if (!t) return;
    if (editId) {
      onChange(items.map((i) => (i.id === editId ? { ...i, texto: t } : i)));
    } else {
      onChange([...items, { id: makeReportId("it"), texto: t }]);
    }
    setOpen(false);
    setTexto("");
    setEditId(null);
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={reportLabel}>{label}</span>
        <Button type="button" variant="secondary" onClick={openAdd}>
          + {R.adicionar}
        </Button>
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{R.semItens}</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {items.map((item) => (
            <div
              key={item.id}
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
              <div style={{ fontSize: 13, flex: 1, whiteSpace: "pre-wrap" }}>{item.texto}</div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <Button type="button" variant="ghost" onClick={() => openEdit(item)}>
                  {R.editar}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onChange(items.filter((i) => i.id !== item.id))}
                >
                  {R.excluir}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <EditableModal
        open={open}
        title={editId ? R.editarItem : R.novoItem}
        onClose={() => setOpen(false)}
      >
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
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
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
