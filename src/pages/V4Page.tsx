import { useState } from "react";
import "../components/v4/v4.css";
import { V4Icon } from "../v4/icons/Icon";
import type { V4IconName } from "../v4/icons/types";
import V4Viewer, { type SceneItem } from "../components/v4/V4Viewer";
import V4CatalogPanel from "../components/v4/V4CatalogPanel";
import V4ItemPreview from "../components/v4/V4ItemPreview";
import type { CatalogItem } from "../catalog/catalogTypes";
import useV4Room from "../v4/state/useV4Room";
import V4RoomSettingsPanel from "../components/v4/V4RoomSettingsPanel";

type SectionId = "moveis" | "projeto" | "materiais" | "fabricacao" | "rastreio" | "sala" | "definicoes";

type Section = {
  id: SectionId;
  label: string;
  icon: V4IconName;
};

const SECTIONS: Section[] = [
  { id: "moveis",     label: "Móveis",     icon: "furniture"   },
  { id: "projeto",    label: "Projeto",    icon: "project"     },
  { id: "materiais",  label: "Materiais",  icon: "materials"   },
  { id: "fabricacao", label: "Fabricação", icon: "fabrication" },
  { id: "rastreio",   label: "Rastreio",   icon: "tracking"    },
  { id: "sala",       label: "Sala",       icon: "sala"        },
  { id: "definicoes", label: "Definições", icon: "settings"    },
];

export default function V4Page() {
  const { roomConfig, updateRoomConfig } = useV4Room();
  const [activeSection, setActiveSection] = useState<SectionId>("moveis");
  const [subpanelOpen, setSubpanelOpen] = useState(true);
  const [sceneItems, setSceneItems] = useState<SceneItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<CatalogItem | null>(null);

  function handleAddCatalogItem(item: CatalogItem) {
    const gapM = 0.02;
    const positionX = sceneItems.reduce(
      (acc, cur) => acc + cur.catalogItem.dimensoesDefault.largura_mm / 1000 + gapM,
      0
    );
    const newItem: SceneItem = {
      id: globalThis.crypto?.randomUUID?.() ?? Date.now().toString(),
      catalogItem: item,
      position: [positionX, 0, 0],
    };
    setSceneItems((prev) => [...prev, newItem]);
    setSelectedId(newItem.id);
  }

  function handleSectionClick(id: SectionId) {
    if (id === activeSection) {
      setSubpanelOpen((p) => !p);
    } else {
      setActiveSection(id);
      setSubpanelOpen(true);
    }
  }

  const active = SECTIONS.find((s) => s.id === activeSection)!;

  return (
    <div className="v4-root v4-shell">

      {/* ── Column 1: Icon sidebar ── */}
      <aside className="v4-sidebar">
        <div className="v4-sidebar__logo" title="Pimo v4">
          <V4Icon name="logo" size={18} color="#fff" aria-hidden={false} title="Pimo" />
        </div>
        <div className="v4-sidebar__divider" />

        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`v4-icon-btn${activeSection === s.id && subpanelOpen ? " v4-icon-btn--active" : ""}`}
            data-tip={s.label}
            title={s.label}
            onClick={() => handleSectionClick(s.id)}
          >
            <V4Icon name={s.icon} size={16} />
          </button>
        ))}

        <div className="v4-sidebar__spacer" />
      </aside>

      {/* ── Column 2: Sub-panel ── */}
      <aside className={`v4-subpanel${subpanelOpen ? "" : " v4-subpanel--hidden"}`}>
        <div className="v4-subpanel__header">
          <p className="v4-subpanel__label">{active.label}</p>
        </div>

        <div className="v4-subpanel__body">
          {activeSection === "moveis" ? (
            <V4CatalogPanel
              onAdd={handleAddCatalogItem}
              onPreview={(item) => setPreviewItem(item)}
              previewItemId={previewItem?.id}
            />
          ) : activeSection === "sala" ? (
            <V4RoomSettingsPanel config={roomConfig} onUpdate={updateRoomConfig} />
          ) : (
            <div style={{ padding: "12px 8px", display: "flex", flexDirection: "column", gap: 8 }}>
              <V4Icon name={active.icon} size={28} color="var(--v4-text-subtle)" />
              <p style={{ margin: 0, fontSize: 12, color: "var(--v4-text-muted)" }}>
                {active.label} — em construção
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* ── Column 3: Item preview panel ── */}
      <aside className={`v4-preview-panel${previewItem ? "" : " v4-preview-panel--hidden"}`}>
        {previewItem && (
          <V4ItemPreview
            item={previewItem}
            onAdd={(item) => {
              handleAddCatalogItem(item);
              setPreviewItem(null);
            }}
            onClose={() => setPreviewItem(null)}
          />
        )}
      </aside>

      {/* ── Column 4: Main canvas ── */}
      <main className="v4-main">
        <div className="v4-toolbar">
          <p className="v4-toolbar__title">Pimo</p>
          <div className="v4-toolbar__sep" />
          <span className="v4-badge v4-badge--accent" style={{ fontSize: 10 }}>v4</span>
          <div className="v4-toolbar__sep" />
          <span style={{ fontSize: 12, color: "var(--v4-text-muted)" }}>
            {sceneItems.length} {sceneItems.length === 1 ? "módulo" : "módulos"}
          </span>
          <div className="v4-toolbar__spacer" />

          <button type="button" className="v4-icon-btn" data-tip="Selecionar" title="Selecionar">
            <V4Icon name="select" size={15} />
          </button>
          <button type="button" className="v4-icon-btn" data-tip="Mover" title="Mover">
            <V4Icon name="move" size={15} />
          </button>
          <button type="button" className="v4-icon-btn" data-tip="Rodar" title="Rodar">
            <V4Icon name="rotate" size={15} />
          </button>
          <div className="v4-toolbar__sep" />
          <button type="button" className="v4-icon-btn" data-tip="Câmera" title="Câmera">
            <V4Icon name="camera" size={15} />
          </button>
          <button type="button" className="v4-icon-btn" data-tip="Medições" title="Medições">
            <V4Icon name="ruler" size={15} />
          </button>
        </div>

        <div className="v4-canvas-area">
          <V4Viewer
            style={{ width: "100%", height: "100%" }}
            sceneItems={sceneItems}
            selectedId={selectedId}
            roomConfig={roomConfig}
          />
        </div>
      </main>
    </div>
  );
}
