import { TOOL_ICONS } from './icons/toolIcons';
import {
  panelStyle,
  sectionTitleStyle,
  toolBtnStyle,
  toolbarDividerStyle,
} from './pimoDrillStyles';
import {
  PIMO_DRILL_FEATURE_TOOLS,
  PIMO_DRILL_VIEW_TOOLS,
  type PimoDrillFeatureToolId,
  type PimoDrillToolId,
  type PimoDrillViewMode,
} from './pimoDrillTypes';

type Props = {
  viewMode: PimoDrillViewMode;
  activeTool: PimoDrillToolId;
  onSelectView: (mode: PimoDrillViewMode) => void;
  onSelectFeature: (tool: PimoDrillFeatureToolId) => void;
};

export default function PimoDrillToolbar({
  viewMode,
  activeTool,
  onSelectView,
  onSelectFeature,
}: Props) {
  return (
    <div style={{ ...panelStyle, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ ...sectionTitleStyle, marginRight: 4 }}>Vista</h2>
        {PIMO_DRILL_VIEW_TOOLS.map((tool) => {
          const Icon = TOOL_ICONS[tool.id];
          const active = viewMode === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              title={tool.label}
              aria-label={tool.label}
              aria-pressed={active}
              onClick={() => onSelectView(tool.id)}
              style={toolBtnStyle(active)}
            >
              <Icon size={18} />
            </button>
          );
        })}

        <div style={toolbarDividerStyle} aria-hidden />

        <h2 style={{ ...sectionTitleStyle, marginRight: 4 }}>Ferramentas</h2>
        {PIMO_DRILL_FEATURE_TOOLS.map((tool) => {
          const Icon = TOOL_ICONS[tool.id];
          const active = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              title={tool.label}
              aria-label={tool.label}
              aria-pressed={active}
              onClick={() => onSelectFeature(tool.id)}
              style={toolBtnStyle(active)}
            >
              <Icon size={18} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
