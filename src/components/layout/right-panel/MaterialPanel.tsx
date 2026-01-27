import { useState } from "react";
import Panel from "../../ui/Panel";
import { useProject } from "../../../context/useProject";
import type { ModelPart } from "../../../context/materialContext";
import type { MaterialCategory } from "../../../core/materials/materialPresets";
import {
  materialCategoryOptions,
  modelPartOptions,
  useMaterialSystem,
} from "../../../context/materialContext";
import { getPresetById, getPresetsByCategory } from "../../../core/materials/materialPresets";

export default function MaterialPanel() {
  const { actions } = useProject();
  const { state, setAssignment, setCategoryOverrides, setCategoryPreset } = useMaterialSystem();
  const [activeCategory, setActiveCategory] = useState(materialCategoryOptions[0].id);
  const currentConfig = state.categories[activeCategory];
  const presets = getPresetsByCategory(activeCategory);
  const activePreset = getPresetById(currentConfig.presetId) ?? presets[0];

  return (
    <Panel title="Materiais">
      <div className="stack">
        <div className="form-grid">
          <label className="stack-tight">
            <span className="muted-text">Tipo de material</span>
            <select
              value={activeCategory}
              onChange={(event) => {
                const next = event.target.value as typeof activeCategory;
                setActiveCategory(next);
                actions.logChangelog(`Material ativo: ${next}`);
              }}
              className="select"
            >
              {materialCategoryOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="stack-tight">
            <span className="muted-text">Preset</span>
            <select
              value={currentConfig.presetId}
              onChange={(event) => {
                setCategoryPreset(activeCategory, event.target.value);
                actions.logChangelog(`Preset aplicado: ${event.target.value}`);
              }}
              className="select"
            >
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="texture-preview">
          <div
            className="texture-preview-image"
            style={{
              backgroundImage: `url(${activePreset?.maps.map})`,
            }}
          />
          <div className="muted-text-xs">Preview do mapa base</div>
        </div>

        <div className="form-grid">
          <label className="stack-tight">
            <span className="muted-text">Roughness</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={currentConfig.roughness}
              onChange={(event) =>
                setCategoryOverrides(activeCategory, {
                  roughness: Number(event.target.value),
                })
              }
            />
          </label>
          <label className="stack-tight">
            <span className="muted-text">Metalness</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={currentConfig.metalness}
              onChange={(event) =>
                setCategoryOverrides(activeCategory, {
                  metalness: Number(event.target.value),
                })
              }
            />
          </label>
        </div>

        <div className="form-grid">
          <label className="stack-tight">
            <span className="muted-text">Intensidade</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={currentConfig.envMapIntensity}
              onChange={(event) =>
                setCategoryOverrides(activeCategory, {
                  envMapIntensity: Number(event.target.value),
                })
              }
            />
          </label>
          <label className="stack-tight">
            <span className="muted-text">Cor</span>
            <input
              type="color"
              value={currentConfig.color}
              onChange={(event) =>
                setCategoryOverrides(activeCategory, {
                  color: event.target.value,
                })
              }
            />
          </label>
        </div>

        <div className="panel-divider" />

        <div className="stack-tight">
          <div className="section-title">Aplicar em partes</div>
          {modelPartOptions.map((part) => {
            const partId = part.id as ModelPart;
            return (
            <label key={part.id} className="panel-field-row">
              <span className="panel-label">{part.label}</span>
              <select
                className="select select-xs"
                value={state.assignments[partId]}
                onChange={(event) => {
                  setAssignment(partId, event.target.value as MaterialCategory);
                  actions.logChangelog(`Material aplicado: ${part.label}`);
                }}
              >
                {materialCategoryOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          );
          })}
        </div>
      </div>
    </Panel>
  );
}
