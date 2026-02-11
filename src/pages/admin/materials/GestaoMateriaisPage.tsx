/**
 * Página de Gestão de Materiais — Admin, módulo Materials.
 * FASE 3 Etapa 6: categorias, pesquisa, filtros, ordenação, drawer melhorado, export/import.
 */

import { useState, useEffect, useMemo } from "react";
import Panel from "../../../components/ui/Panel";
import { useToast } from "../../../context/ToastContext";
import {
  useMaterialsList,
  useSaveMaterial,
  useDeleteMaterial,
  getMaterialByIdOrLabel,
  migrateMaterialsFromLegacy,
  duplicateMaterial,
  exportMaterialsAsJson,
  importMaterialsFromJson,
} from "../../../core/materials";
import type { MaterialRecord, MaterialCategoryId, CreateMaterialData } from "../../../core/materials/types";
import { getAllPresets, getPresetById } from "../../../core/materials/presetService";
import { MATERIAIS_INDUSTRIAIS } from "../../../core/manufacturing/materials";

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--text-muted)",
  marginBottom: 2,
};

export const CATEGORIAS_MATERIAIS: { id: MaterialCategoryId; label: string }[] = [
  { id: "mdf", label: "MDF" },
  { id: "carvalho", label: "Carvalho" },
  { id: "lacado", label: "Lacado" },
  { id: "melamina", label: "Melamina" },
  { id: "contraplacado", label: "Contraplacado" },
  { id: "glass", label: "Vidro" },
  { id: "metal", label: "Metal" },
  { id: "industrial", label: "Industrial" },
  { id: "visual", label: "Visual" },
  { id: "outros", label: "Outros" },
];

type SortField = "label" | "precoPorM2" | "espessura" | "categoryId";
type SortDir = "asc" | "desc";
type FilterType = "all" | "industrial" | "visual" | "migrado";

function getCategoryLabel(id: string): string {
  return CATEGORIAS_MATERIAIS.find((c) => c.id === id)?.label ?? (id || "—");
}

function getMaterialType(m: MaterialRecord): "industrial" | "visual" | "migrado" | "outro" {
  if (m.categoryId === "industrial") return "migrado";
  if (m.industrialMaterialId) return "industrial";
  if (m.visualPresetId) return "visual";
  return "outro";
}

export default function GestaoMateriaisPage() {
  const { showToast } = useToast();
  const { materials, reload } = useMaterialsList();
  const { save } = useSaveMaterial();
  const { deleteMaterial: deleteMaterialFn } = useDeleteMaterial();

  useEffect(() => {
    const { migrated } = migrateMaterialsFromLegacy();
    if (migrated > 0) reload();
  }, [reload]);

  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<MaterialRecord>>({
    label: "",
    categoryId: "",
    color: "#ffffff",
    textureUrl: "",
    espessura: 18,
    precoPorM2: 0,
    industrialMaterialId: "",
    visualPresetId: "",
  });

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterPriceMin, setFilterPriceMin] = useState<string>("");
  const [filterPriceMax, setFilterPriceMax] = useState<string>("");
  const [filterEspessuraMin, setFilterEspessuraMin] = useState<string>("");
  const [filterEspessuraMax, setFilterEspessuraMax] = useState<string>("");
  const [sortField, setSortField] = useState<SortField>("label");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [importJson, setImportJson] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

  const filteredAndSorted = useMemo(() => {
    let list = [...materials];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (m) =>
          (m.label ?? "").toLowerCase().includes(q) ||
          String(m.espessura ?? "").includes(q) ||
          String(m.precoPorM2 ?? "").includes(q) ||
          (getCategoryLabel(m.categoryId ?? "").toLowerCase().includes(q))
      );
    }
    if (filterCategory) {
      list = list.filter((m) => (m.categoryId ?? "") === filterCategory);
    }
    if (filterType !== "all") {
      list = list.filter((m) => getMaterialType(m) === filterType);
    }
    const pMin = filterPriceMin !== "" ? Number(filterPriceMin) : null;
    const pMax = filterPriceMax !== "" ? Number(filterPriceMax) : null;
    if (pMin !== null && !Number.isNaN(pMin)) list = list.filter((m) => Number(m.precoPorM2 ?? 0) >= pMin);
    if (pMax !== null && !Number.isNaN(pMax)) list = list.filter((m) => Number(m.precoPorM2 ?? 0) <= pMax);
    const eMin = filterEspessuraMin !== "" ? Number(filterEspessuraMin) : null;
    const eMax = filterEspessuraMax !== "" ? Number(filterEspessuraMax) : null;
    if (eMin !== null && !Number.isNaN(eMin)) list = list.filter((m) => Number(m.espessura ?? 0) >= eMin);
    if (eMax !== null && !Number.isNaN(eMax)) list = list.filter((m) => Number(m.espessura ?? 0) <= eMax);
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === "label") {
        cmp = (a.label ?? "").localeCompare(b.label ?? "", undefined, { sensitivity: "base" });
      } else if (sortField === "precoPorM2") {
        cmp = Number(a.precoPorM2 ?? 0) - Number(b.precoPorM2 ?? 0);
      } else if (sortField === "espessura") {
        cmp = Number(a.espessura ?? 0) - Number(b.espessura ?? 0);
      } else {
        cmp = (getCategoryLabel(a.categoryId ?? "")).localeCompare(getCategoryLabel(b.categoryId ?? ""), undefined, { sensitivity: "base" });
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [
    materials,
    search,
    filterCategory,
    filterType,
    filterPriceMin,
    filterPriceMax,
    filterEspessuraMin,
    filterEspessuraMax,
    sortField,
    sortDir,
  ]);

  const openNew = () => {
    setEditingId(null);
    setForm({
      label: "",
      categoryId: "",
      color: "#ffffff",
      textureUrl: "",
      espessura: 18,
      precoPorM2: 0,
      industrialMaterialId: "",
      visualPresetId: "",
    });
    setPanelOpen(true);
  };

  const openEdit = (id: string) => {
    const m = getMaterialByIdOrLabel(id);
    setEditingId(id);
    if (m) {
      setForm({
        id: m.id,
        label: m.label,
        categoryId: m.categoryId,
        color: m.color ?? "#ffffff",
        textureUrl: m.textureUrl,
        espessura: m.espessura,
        precoPorM2: m.precoPorM2,
        industrialMaterialId: m.industrialMaterialId,
        visualPresetId: m.visualPresetId,
      });
    }
    setPanelOpen(true);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setEditingId(null);
  };

  const buildFormData = (): CreateMaterialData => ({
    label: String(form.label ?? "").trim(),
    categoryId: form.categoryId,
    color: form.color,
    textureUrl: form.textureUrl,
    espessura: Number(form.espessura) || 18,
    precoPorM2: Number(form.precoPorM2) ?? 0,
    industrialMaterialId: form.industrialMaterialId || undefined,
    visualPresetId: form.visualPresetId || undefined,
  });

  const handleSave = () => {
    const data = buildFormData();
    const result = save(data, editingId);
    if (result.success) {
      reload();
      closePanel();
      showToast(editingId ? "Material atualizado com sucesso." : "Material criado com sucesso.", "info");
    } else {
      showToast(result.error ?? "Erro ao guardar.", "error");
    }
  };

  const handleDelete = (id: string, label: string) => {
    if (!window.confirm(`Eliminar o material "${label}"?`)) return;
    const removed = deleteMaterialFn(id);
    if (removed) {
      reload();
      if (panelOpen && editingId === id) closePanel();
      showToast("Material eliminado.", "info");
    } else {
      showToast("Não foi possível eliminar o material.", "error");
    }
  };

  const handleDuplicate = (id: string) => {
    const result = duplicateMaterial(id);
    if (result.success) {
      reload();
      showToast("Material duplicado.", "info");
      openEdit(result.material.id);
    } else {
      showToast(result.error ?? "Erro ao duplicar.", "error");
    }
  };

  const handleExport = () => {
    const json = exportMaterialsAsJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pimo-materiais-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Exportação concluída.", "info");
  };

  const handleImport = () => {
    const { imported, errors } = importMaterialsFromJson(importJson, { merge: true });
    if (imported > 0) reload();
    if (errors.length > 0) {
      showToast(`${imported} importado(s). Erros: ${errors.slice(0, 3).join("; ")}`, "error");
    } else {
      showToast(`${imported} material(is) importado(s).`, "info");
    }
    setImportJson("");
    setShowImport(false);
  };

  const getTypeLabel = (m: MaterialRecord) => {
    const t = getMaterialType(m);
    return t === "industrial" ? "Industrial" : t === "visual" ? "Visual" : t === "migrado" ? "Migrado" : "Outro";
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setImportJson(text);
      setShowImport(true);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, minHeight: 0 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
          Gestão de Materiais
        </h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="button" onClick={openNew}>
            + Adicionar Material
          </button>
          <button type="button" className="button button-ghost" onClick={handleExport}>
            Exportar Materiais
          </button>
          <label className="button button-ghost" style={{ cursor: "pointer", margin: 0 }}>
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleImportFile}
              style={{ display: "none" }}
            />
            Importar Materiais
          </label>
          <button type="button" className="button button-ghost" onClick={() => setShowImport((v) => !v)}>
            {showImport ? "Fechar importação" : "Colar JSON"}
          </button>
        </div>
      </div>

      {showImport && (
        <Panel title="Importar materiais (JSON)">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
              Selecione um ficheiro JSON ou cole o conteúdo abaixo. A importação faz merge e evita duplicados por nome.
            </p>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <input type="file" accept=".json,application/json" onChange={handleImportFile} style={{ fontSize: 12 }} />
              Escolher ficheiro
            </label>
            <textarea
              className="input"
              placeholder='Cole aqui um JSON de materiais (array). Ex.: [{"label":"...","categoryId":"mdf","espessura":18,"precoPorM2":25}]'
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              rows={4}
              style={{ width: "100%", fontFamily: "monospace", fontSize: 12 }}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="button" onClick={handleImport}>
                Importar (merge: evita duplicados por nome)
              </button>
              <button type="button" className="button button-ghost" onClick={() => setShowImport(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </Panel>
      )}

      <Panel title="Pesquisa e filtros">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            <input
              className="input"
              type="text"
              placeholder="Pesquisar por nome, espessura, preço ou categoria..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ minWidth: 260, flex: 1, maxWidth: 420 }}
            />
            <select
              className="input"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={{ width: 150 }}
            >
              <option value="">Todas as categorias</option>
              {CATEGORIAS_MATERIAIS.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            <select
              className="input"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as FilterType)}
              style={{ width: 150 }}
            >
              <option value="all">Todos os tipos</option>
              <option value="industrial">Industrial</option>
              <option value="visual">Visual</option>
              <option value="migrado">Migrado</option>
            </select>
          </div>
          <div
            style={{
              height: 1,
              background: "rgba(255,255,255,0.08)",
              margin: "4px 0",
            }}
          />
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              alignItems: "center",
              fontSize: 12,
              color: "var(--text-muted)",
            }}
          >
            <span style={{ fontWeight: 500 }}>Preço (€/m²):</span>
            <input
              className="input"
              type="number"
              placeholder="Mín"
              value={filterPriceMin}
              onChange={(e) => setFilterPriceMin(e.target.value)}
              style={{ width: 80 }}
            />
            <span>—</span>
            <input
              className="input"
              type="number"
              placeholder="Máx"
              value={filterPriceMax}
              onChange={(e) => setFilterPriceMax(e.target.value)}
              style={{ width: 80 }}
            />
            <span style={{ marginLeft: 16, fontWeight: 500 }}>Espessura (mm):</span>
            <input
              className="input"
              type="number"
              placeholder="Mín"
              value={filterEspessuraMin}
              onChange={(e) => setFilterEspessuraMin(e.target.value)}
              style={{ width: 80 }}
            />
            <span>—</span>
            <input
              className="input"
              type="number"
              placeholder="Máx"
              value={filterEspessuraMax}
              onChange={(e) => setFilterEspessuraMax(e.target.value)}
              style={{ width: 80 }}
            />
          </div>
        </div>
      </Panel>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Ordenar por:</span>
        <select
          className="input"
          value={sortField}
          onChange={(e) => setSortField(e.target.value as SortField)}
          style={{ width: 140 }}
        >
          <option value="label">Nome</option>
          <option value="precoPorM2">Preço</option>
          <option value="espessura">Espessura</option>
          <option value="categoryId">Categoria</option>
        </select>
        <button
          type="button"
          className="button button-ghost"
          style={{ padding: "4px 10px" }}
          onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
        >
          {sortDir === "asc" ? "↑ Asc" : "↓ Desc"}
        </button>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {filteredAndSorted.length} de {materials.length} materiais
        </span>
      </div>

      <Panel title="Materiais existentes">
        {filteredAndSorted.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--text-muted)", padding: 16 }}>
            {materials.length === 0
              ? "Nenhum material registado. Use \"Adicionar Material\" para criar."
              : "Nenhum material corresponde aos filtros."}
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(292px, 1fr))",
              gap: 18,
            }}
          >
            {filteredAndSorted.map((m) => (
              <div
                key={m.id}
                onMouseEnter={() => setHoveredCardId(m.id)}
                onMouseLeave={() => setHoveredCardId(null)}
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  padding: 16,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                  gap: 12,
                  minHeight: 0,
                  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                }}
              >
                {hoveredCardId === m.id && (
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: 0,
                      padding: "10px 12px",
                      background: "rgba(15, 23, 42, 0.98)",
                      borderBottom: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "10px 10px 0 0",
                      fontSize: 11,
                      color: "var(--text-main)",
                      lineHeight: 1.5,
                      pointerEvents: "none",
                      zIndex: 1,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{m.label}</div>
                    <div style={{ color: "var(--text-muted)" }}>
                      Categoria: {getCategoryLabel(m.categoryId ?? "")} · Espessura: {m.espessura ?? "—"} mm · Preço: {m.precoPorM2 ?? "—"} €/m²
                    </div>
                    <div style={{ marginTop: 4, fontSize: 10, opacity: 0.9 }}>
                      Tipo: {getTypeLabel(m)}
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  {m.color && (
                    <span
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: m.color,
                        border: "1px solid rgba(255,255,255,0.25)",
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-main)", letterSpacing: "0.01em" }}>
                      {m.label}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                      {getCategoryLabel(m.categoryId ?? "")} · {m.espessura ?? "—"} mm · {m.precoPorM2 ?? "—"} €/m²
                    </div>
                    <span
                      style={{
                        display: "inline-block",
                        marginTop: 6,
                        padding: "2px 6px",
                        fontSize: 10,
                        fontWeight: 500,
                        borderRadius: 4,
                        background: "rgba(59, 130, 246, 0.15)",
                        color: "var(--text-muted)",
                      }}
                    >
                      {getTypeLabel(m)}
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="button button-ghost"
                    style={{ fontSize: 11, padding: "5px 10px" }}
                    onClick={() => openEdit(m.id)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="button button-ghost"
                    style={{ fontSize: 11, padding: "5px 10px" }}
                    onClick={() => handleDuplicate(m.id)}
                  >
                    Duplicar
                  </button>
                  <button
                    type="button"
                    className="button button-ghost"
                    style={{ fontSize: 11, padding: "5px 10px", color: "var(--red, #ef4444)" }}
                    onClick={() => handleDelete(m.id, m.label)}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {panelOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            width: 380,
            maxWidth: "100%",
            height: "100%",
            background: "color-mix(in srgb, var(--navy) 96%, black)",
            borderLeft: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "-8px 0 24px rgba(0,0,0,0.3)",
            zIndex: 100,
            padding: 20,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-main)" }}>
              {editingId ? "Editar material" : "Novo material"}
            </span>
            <button type="button" className="button button-ghost" style={{ padding: "4px 8px", fontSize: 12 }} onClick={closePanel}>
              Fechar
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div style={labelStyle}>Nome / Label</div>
              <input
                className="input"
                placeholder="Nome do material"
                value={form.label ?? ""}
                onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <div style={labelStyle}>Categoria</div>
              <select
                className="input"
                value={form.categoryId ?? ""}
                onChange={(e) => setForm((prev) => ({ ...prev, categoryId: e.target.value as MaterialCategoryId }))}
                style={{ width: "100%" }}
              >
                <option value="">— Selecionar —</option>
                {CATEGORIAS_MATERIAIS.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <div style={labelStyle}>Cor (ColorPicker)</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="color"
                  value={form.color ?? "#ffffff"}
                  onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
                  style={{
                    width: 40,
                    height: 32,
                    padding: 2,
                    border: "1px solid rgba(255,255,255,0.2)",
                    borderRadius: "var(--radius)",
                    cursor: "pointer",
                    background: "transparent",
                  }}
                />
                <input
                  className="input"
                  type="text"
                  value={form.color ?? "#ffffff"}
                  onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
                  style={{ flex: 1 }}
                />
              </div>
            </div>

            <div>
              <div style={labelStyle}>Textura (URL ou ficheiro futuro)</div>
              <input
                className="input"
                type="text"
                placeholder="URL ou caminho — upload em breve"
                value={form.textureUrl ?? ""}
                onChange={(e) => setForm((prev) => ({ ...prev, textureUrl: e.target.value }))}
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <div style={labelStyle}>Espessura (mm)</div>
              <input
                className="input"
                type="number"
                min={1}
                placeholder="18"
                value={form.espessura ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, espessura: e.target.value ? Number(e.target.value) : undefined }))
                }
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <div style={labelStyle}>Preço por m² (€) — preço final</div>
              <input
                className="input"
                type="number"
                step="0.01"
                min={0}
                placeholder="0"
                value={form.precoPorM2 ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, precoPorM2: e.target.value ? Number(e.target.value) : undefined }))
                }
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <div style={labelStyle}>Material industrial associado</div>
              <select
                className="input"
                value={form.industrialMaterialId ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, industrialMaterialId: e.target.value || undefined }))
                }
                style={{ width: "100%" }}
              >
                <option value="">— Nenhum —</option>
                {MATERIAIS_INDUSTRIAIS.map((ind) => (
                  <option key={ind.nome} value={ind.nome}>{ind.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <div style={labelStyle}>Preset visual associado (Material Presets Engine)</div>
              <select
                className="input"
                value={form.visualPresetId ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, visualPresetId: e.target.value || undefined }))
                }
                style={{ width: "100%" }}
              >
                <option value="">— Nenhum —</option>
                {getAllPresets().map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
                {form.visualPresetId && !getPresetById(form.visualPresetId) && (
                  <option value={form.visualPresetId}>— {form.visualPresetId} (legado)</option>
                )}
              </select>
              {(() => {
                const selectedPreset = form.visualPresetId ? getPresetById(form.visualPresetId) : null;
                if (!selectedPreset) return null;
                return (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginTop: 8,
                      padding: 10,
                      background: "rgba(255,255,255,0.04)",
                      borderRadius: "var(--radius)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <span
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: selectedPreset.color,
                        border: "1px solid rgba(255,255,255,0.2)",
                      }}
                    />
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      <div style={{ color: "var(--text-main)", fontWeight: 500 }}>{selectedPreset.name}</div>
                      <div>
                        Cor base · Roughness {selectedPreset.roughness ?? "—"} · Metallic {selectedPreset.metallic ?? "—"}
                      </div>
                      {(selectedPreset.textureUrl ?? selectedPreset.normalMapUrl) && (
                        <div style={{ marginTop: 2 }}>Textura / Normal map definidos</div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            <button
              type="button"
              className="button"
              style={{
                marginTop: 8,
                background: "rgba(34,197,94,0.2)",
                border: "1px solid rgba(34,197,94,0.4)",
              }}
              onClick={handleSave}
            >
              {editingId ? "Guardar alterações" : "Criar material"}
            </button>
          </div>

          {editingId && (
            <div style={{ fontSize: 10, color: "var(--text-muted)", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 8 }}>
              ID: {editingId}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
