import { useMemo, useState } from "react";
import Panel from "../ui/Panel";
import type { TemplateItem } from "../../core/templates/templates";
import { useTemplates } from "../../hooks/useTemplates";

const toTemplate = (form: TemplateItem): TemplateItem => ({
  id: form.id,
  nome: form.nome.trim(),
  categoria: form.categoria.trim(),
  descricao: form.descricao.trim(),
  dados: form.dados,
});

export default function TemplatesManager() {
  const { templates, setTemplates } = useTemplates();

  const [form, setForm] = useState<TemplateItem>({
    id: "",
    nome: "",
    categoria: "",
    descricao: "",
    dados: {},
  });

  const [dadosTexto, setDadosTexto] = useState("{}");
  const [importError, setImportError] = useState<string | null>(null);

  const canSave = useMemo(
    () =>
      form.nome.trim().length > 0 &&
      form.categoria.trim().length > 0 &&
      form.descricao.trim().length > 0 &&
      Object.keys(form.dados).length > 0,
    [form]
  );

  const handleAdd = () => {
    setForm({ id: "", nome: "", categoria: "", descricao: "", dados: {} });
    setDadosTexto("{}");
    setImportError(null);
  };

  const handleSave = () => {
    if (!canSave) return;
    const id = form.id || `template-${Date.now()}`;
    const normalized = toTemplate({ ...form, id });
    setTemplates((prev) => [...prev, normalized]);
    setForm({ id: "", nome: "", categoria: "", descricao: "", dados: {} });
    setDadosTexto("{}");
  };

  const handleImportJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || "");
        const parsed = JSON.parse(text) as Record<string, unknown>;
        if (!parsed || typeof parsed !== "object") {
          throw new Error("JSON inválido");
        }
        setForm((prev) => ({ ...prev, dados: parsed }));
        setDadosTexto(JSON.stringify(parsed, null, 2));
        setImportError(null);
      } catch (error) {
        setImportError(error instanceof Error ? error.message : "Erro ao importar JSON");
      }
    };
    reader.readAsText(file);
  };

  const handleDadosChange = (value: string) => {
    setDadosTexto(value);
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object") {
        setForm((prev) => ({ ...prev, dados: parsed as Record<string, unknown> }));
        setImportError(null);
      }
    } catch {
      setImportError("JSON inválido");
    }
  };

  return (
    <div className="stack">
      <Panel title="Templates existentes">
        <div className="list-vertical">
          {templates.length === 0 ? (
            <div className="muted-text">
              Nenhum template registado.
            </div>
          ) : (
            templates.map((template) => (
              <div
                key={template.id}
                className="card"
              >
                <div className="card-title">{template.nome}</div>
                <div className="muted-text">
                  {template.categoria} · {template.descricao}
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>

      <Panel title="Adicionar Template">
        <div className="stack-tight">
          <button className="button" onClick={handleAdd}>
            Adicionar Template
          </button>
          <div className="form-grid">
            <input
              className="input"
              placeholder="Nome do template"
              value={form.nome}
              onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
            />
            <input
              className="input"
              placeholder="Categoria"
              value={form.categoria}
              onChange={(e) => setForm((prev) => ({ ...prev, categoria: e.target.value }))}
            />
            <input
              className="input"
              placeholder="Descrição curta"
              value={form.descricao}
              onChange={(e) => setForm((prev) => ({ ...prev, descricao: e.target.value }))}
            />
            <input
              className="input"
              placeholder="ID (opcional)"
              value={form.id}
              onChange={(e) => setForm((prev) => ({ ...prev, id: e.target.value }))}
            />
          </div>

          <div>
            <div className="muted-text" style={{ marginBottom: 6 }}>
              Dados do template (JSON)
            </div>
            <textarea
              className="input textarea"
              value={dadosTexto}
              onChange={(e) => handleDadosChange(e.target.value)}
            />
            {importError && (
              <div className="muted-text-xs" style={{ color: "#f87171", marginTop: 6 }}>
                {importError}
              </div>
            )}
          </div>

          <div className="row row-gap-md">
            <label className="button" style={{ display: "inline-block" }}>
              Importar Template (JSON)
              <input
                type="file"
                accept="application/json"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImportJson(file);
                }}
              />
            </label>
            <button
              className="button"
              style={{
                background: canSave ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.08)",
                border: canSave
                  ? "1px solid rgba(34,197,94,0.4)"
                  : "1px solid rgba(255,255,255,0.12)",
                cursor: canSave ? "pointer" : "not-allowed",
                opacity: canSave ? 1 : 0.6,
              }}
              onClick={handleSave}
              disabled={!canSave}
            >
              Guardar
            </button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
