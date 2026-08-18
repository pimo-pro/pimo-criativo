import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useProject } from "../../../context/useProject";
import { usePimoViewerContext } from "../../../hooks/usePimoViewerContext";
import { Icon } from "@/components/icons";
import { useUiStore } from "../../../stores/uiStore";
import {
  applyDisplayQualityPresetToViewer,
  buildDisplayQualitySettingsPatch,
  resolveDisplayQualityLevel,
  type DisplayQualityLevel,
} from "./displayQualityPresets";

const QUALITY_LEVELS: Array<{ level: DisplayQualityLevel; label: string; hint: string }> = [
  { level: "baixa", label: "Baixa", hint: "Luz simples, sem efeitos" },
  { level: "media", label: "Média", hint: "Bloom leve" },
  { level: "alta", label: "Alta", hint: "Bloom e reflexos moderados" },
];

export type DisplayMenuButtonProps = {
  triggerStyle?: CSSProperties;
};

export default function DisplayMenuButton({ triggerStyle }: DisplayMenuButtonProps) {
  const { actions, project } = useProject();
  const { viewerApi } = usePimoViewerContext();
  const photoModePanelOpen = useUiStore((s) => s.photoModePanelOpen);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const activeLevel = resolveDisplayQualityLevel(project.viewerSettings);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const applyLevel = (level: DisplayQualityLevel) => {
    actions.setViewerSettings(buildDisplayQualitySettingsPatch(level));
    if (!photoModePanelOpen) {
      applyDisplayQualityPresetToViewer(viewerApi, level);
    }
  };

  return (
    <div ref={menuRef} className="viewer-toolbar-popover-anchor">
      <button
        type="button"
        title="Configurações de Qualidade de Exibição"
        aria-label="Configurações de Qualidade de Exibição"
        aria-haspopup="dialog"
        aria-expanded={menuOpen}
        aria-pressed={menuOpen}
        onClick={() => setMenuOpen((prev) => !prev)}
        style={
          triggerStyle
            ? {
                ...triggerStyle,
                background: menuOpen ? "var(--toolbar-pressed-bg)" : "transparent",
              }
            : { fontSize: 12 }
        }
        onMouseEnter={
          triggerStyle
            ? (e) => {
                if (!menuOpen) e.currentTarget.style.background = "var(--viewer-toolbar-hover-bg)";
              }
            : undefined
        }
        onMouseLeave={
          triggerStyle
            ? (e) => {
                e.currentTarget.style.background = menuOpen ? "var(--toolbar-pressed-bg)" : "transparent";
              }
            : undefined
        }
      >
        {triggerStyle ? (
          <Icon name="displayMenu" size={24} aria-hidden />
        ) : (
          <span className="viewer-toolbar-icon" aria-hidden>
            <Icon name="displayMenu" size={24} aria-hidden />
          </span>
        )}
      </button>

      {menuOpen && (
        <div
          className="viewer-toolbar-popover-panel display-quality-panel"
          role="dialog"
          aria-label="Configurações de Qualidade de Exibição"
        >
          <div className="display-quality-container">
            <div className="display-quality-title">Qualidade de exibição</div>
            <p className="display-quality-hint">Três níveis para o trabalho diário. Ultra está no Photo Mode.</p>
            <div className="display-quality-preset-row" role="group" aria-label="Nível de qualidade">
              {QUALITY_LEVELS.map(({ level, label, hint }) => {
                const pressed = activeLevel === level;
                return (
                  <button
                    key={level}
                    type="button"
                    title={hint}
                    className={`button viewer-display-mode-button ${pressed ? "" : "button-ghost"}`}
                    onClick={() => applyLevel(level)}
                    disabled={project.estaCarregando}
                    aria-pressed={pressed}
                  >
                    <span className="display-quality-preset-label">{label}</span>
                    <span className="display-quality-preset-hint">{hint}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
