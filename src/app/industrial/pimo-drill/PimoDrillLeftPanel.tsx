import { HOLE_CATALOG, type HoleTypeId } from '@/core/drill/holeCatalog';
import type { DesignValidationIssue } from '@/core/industrialDesigner';

import {
  drillAnchorBtnStyle,
  fieldInputDisabledStyle,
  fieldInputStyle,
  fieldLabelStyle,
  panelStyle,
  sectionTitleStyle,
  toolBtnStyle,
} from './pimoDrillStyles';
import {
  PIMO_DRILL_FEATURE_TOOLS,
  TOOL_UI_FIELDS,
  type PieceModel,
  type PimoDrillToolId,
} from './pimoDrillTypes';
import type { UseDrillDesignWorkspaceResult } from './design-industrial/hooks/useDrillDesignWorkspace';

type Props = {
  activeTool: PimoDrillToolId;
  piece: PieceModel;
  onChangePiece: (next: PieceModel) => void;
  design: UseDrillDesignWorkspaceResult;
};

export default function PimoDrillLeftPanel({
  activeTool,
  piece,
  onChangePiece,
  design,
}: Props) {
  const toolLabel =
    activeTool === '2d'
      ? 'Vista 2D'
      : activeTool === '3d'
        ? 'Vista 3D'
        : PIMO_DRILL_FEATURE_TOOLS.find((t) => t.id === activeTool)?.label ?? activeTool;
  const dynamicFields = TOOL_UI_FIELDS[activeTool];

  const errorCount = design.validationIssues.filter((i) => i.severity === 'error').length;
  const warnCount = design.validationIssues.filter((i) => i.severity === 'warning').length;

  return (
    <aside
      style={{
        ...panelStyle,
        display: 'grid',
        gap: 16,
        alignContent: 'start',
        maxHeight: 'calc(100vh - 220px)',
        overflow: 'auto',
      }}
    >
      <button type="button" style={drillAnchorBtnStyle(true)} aria-pressed>
        DRILL
      </button>

      <section style={{ display: 'grid', gap: 10 }}>
        <h3 style={sectionTitleStyle}>Peça</h3>
        <label style={fieldLabelStyle}>
          Comprimento L (mm)
          <input
            type="number"
            min={1}
            value={piece.lengthMm}
            onChange={(e) =>
              onChangePiece({ ...piece, lengthMm: Number(e.target.value) || 0 })
            }
            style={fieldInputStyle}
          />
        </label>
        <label style={fieldLabelStyle}>
          Largura W (mm)
          <input
            type="number"
            min={1}
            value={piece.widthMm}
            onChange={(e) =>
              onChangePiece({ ...piece, widthMm: Number(e.target.value) || 0 })
            }
            style={fieldInputStyle}
          />
        </label>
        <label style={fieldLabelStyle}>
          Espessura T (mm)
          <input
            type="number"
            min={1}
            value={piece.thicknessMm}
            onChange={(e) =>
              onChangePiece({ ...piece, thicknessMm: Number(e.target.value) || 0 })
            }
            style={fieldInputStyle}
          />
        </label>
      </section>

      <section style={{ display: 'grid', gap: 10 }}>
        <h3 style={sectionTitleStyle}>Parâmetros — {toolLabel}</h3>
        {dynamicFields.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
            Modo de vista · sem parâmetros de feature
          </p>
        ) : (
          dynamicFields.map((field) => (
            <label key={field.key} style={fieldLabelStyle}>
              {field.label}
              <input
                type="text"
                disabled
                readOnly
                placeholder="—"
                style={fieldInputDisabledStyle}
              />
            </label>
          ))
        )}
      </section>

      <section style={{ display: 'grid', gap: 10 }}>
        <h3 style={sectionTitleStyle}>Design Industrial</h3>
        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted, #94a3b8)' }}>
          Catálogo de furos (domínio industrialDesigner). Clique 3D — Fase M2.
        </p>
        <label style={fieldLabelStyle}>
          Tipo de furo
          <select
            value={design.selectedHoleTypeId ?? ''}
            onChange={(e) =>
              design.setSelectedHoleTypeId(
                (e.target.value || null) as HoleTypeId | null,
              )
            }
            style={fieldInputStyle}
          >
            <option value="">— seleccionar —</option>
            {HOLE_CATALOG.map((hole) => (
              <option key={hole.id} value={hole.id}>
                {hole.nome}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!design.selectedHoleTypeId}
          onClick={() => design.addHoleAtCenter()}
          style={{
            ...toolBtnStyle(Boolean(design.selectedHoleTypeId)),
            width: '100%',
            height: 34,
            fontSize: 12,
            opacity: design.selectedHoleTypeId ? 1 : 0.45,
            cursor: design.selectedHoleTypeId ? 'pointer' : 'default',
          }}
        >
          Adicionar furo no centro
        </button>
      </section>

      <section style={{ display: 'grid', gap: 8 }}>
        <h3 style={sectionTitleStyle}>
          Furos ({design.holes.length})
        </h3>
        {design.holes.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
            Nenhum furo na peça.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
            {design.holes.map(({ panelId, hole }) => (
              <li
                key={hole.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 6,
                  background: 'rgba(255,255,255,0.04)',
                  fontSize: 11,
                  color: '#e2e8f0',
                }}
              >
                <span>{design.formatHoleLabel(hole)}</span>
                <button
                  type="button"
                  title="Remover furo"
                  onClick={() => design.removeHole(panelId, hole.id)}
                  style={{
                    ...toolBtnStyle(false),
                    width: 28,
                    height: 28,
                    fontSize: 11,
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ display: 'grid', gap: 6 }}>
        <h3 style={sectionTitleStyle}>Validação</h3>
        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted, #94a3b8)' }}>
          {errorCount} erro(s) · {warnCount} aviso(s)
        </p>
        {design.validationIssues.slice(0, 6).map((issue: DesignValidationIssue) => (
          <div
            key={`${issue.code}-${issue.panelId ?? 'box'}-${issue.message}`}
            style={{
              fontSize: 11,
              color: issue.severity === 'error' ? '#fca5a5' : '#fde68a',
              lineHeight: 1.4,
            }}
          >
            [{issue.severity}] {issue.message}
          </div>
        ))}
      </section>
    </aside>
  );
}
