import { useMemo, useState } from "react";
import Panel from "../ui/Panel";
import ThreeViewer from "../three/ThreeViewer";
import type { CadModel } from "../../core/cad/cadModels";
import { useCadModels } from "../../hooks/useCadModels";

export default function CADModelsManager() {
  const { models, setModels } = useCadModels();

  const [form, setForm] = useState<CadModel>({
    id: "",
    nome: "",
    categoria: "",
    descricao: "",
    arquivo: "",
  });
  const [arquivoNome, setArquivoNome] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);

  const canSave = useMemo(
    () =>
      form.nome.trim().length > 0 &&
      form.categoria.trim().length > 0 &&
      form.descricao.trim().length > 0 &&
      form.arquivo.length > 0,
    [form]
  );

  const handleAdd = () => {
    setForm({ id: "", nome: "", categoria: "", descricao: "", arquivo: "" });
    setArquivoNome("");
    setUploadError(null);
  };

  const handleSave = () => {
    if (!canSave) return;
    const id = form.id || `cad-${Date.now()}`;
    const normalized: CadModel = {
      id,
      nome: form.nome.trim(),
      categoria: form.categoria.trim(),
      descricao: form.descricao.trim(),
      arquivo: form.arquivo,
    };
    setModels((prev) => [...prev, normalized]);
    setForm({ id: "", nome: "", categoria: "", descricao: "", arquivo: "" });
    setArquivoNome("");
  };

  const handleUpload = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".glb")) {
      setUploadError("Apenas ficheiros .glb são permitidos.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i += 1) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = "data:model/gltf-binary;base64," + btoa(binary);
      setForm((prev) => ({ ...prev, arquivo: base64 }));
      setArquivoNome(file.name);
      setUploadError(null);
    };
    reader.onerror = () => {
      setUploadError("Falha ao ler o ficheiro.");
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="stack">
      <Panel title="Modelos CAD existentes">
        <div className="list-vertical">
          {models.length === 0 ? (
            <div className="muted-text">
              Nenhum modelo registado.
            </div>
          ) : (
            models.map((model) => (
              <div
                key={model.id}
                className="card"
              >
                <div className="card-title">{model.nome}</div>
                <div className="muted-text">
                  {model.categoria} · {model.descricao}
                </div>
                <div className="muted-text">
                  Ficheiro: {model.arquivo ? "carregado" : "pendente"}
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>

      <Panel title="Adicionar Modelo 3D">
        <div className="stack-tight">
          <button className="button" onClick={handleAdd}>
            Adicionar Modelo 3D
          </button>
          <div className="form-grid">
            <input
              className="input"
              placeholder="Nome do modelo"
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
              placeholder="Descrição"
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
              Upload do ficheiro (.glb)
            </div>
            <label className="button" style={{ display: "inline-block" }}>
              Escolher ficheiro
              <input
                type="file"
                accept=".glb"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(file);
                }}
              />
            </label>
            {arquivoNome && (
              <div className="muted-text-xs" style={{ marginTop: 6 }}>
                Ficheiro: {arquivoNome}
              </div>
            )}
            {uploadError && (
              <div className="muted-text-xs" style={{ marginTop: 6, color: "#f87171" }}>
                {uploadError}
              </div>
            )}
          </div>

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
        {form.arquivo && (
          <div style={{ marginTop: 12 }}>
            <ThreeViewer
              modelUrl={form.arquivo}
              height={300}
              backgroundColor="#1e293b"
              showGrid={false}
              showFloor={false}
              colorize={true}
            />
          </div>
        )}
      </Panel>
    </div>
  );
}
