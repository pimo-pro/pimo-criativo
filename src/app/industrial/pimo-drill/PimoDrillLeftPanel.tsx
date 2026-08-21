import { useRef, useState } from 'react';

import { HOLE_CATALOG, type HoleFaceKind, type HoleTypeId } from '@/core/drill/holeCatalog';
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

  const [xMm, setXMm] = useState(() => piece.lengthMm / 2);
  const [yMm, setYMm] = useState(() => piece.widthMm / 2);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [persistMessage, setPersistMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const summary = design.importFromKdtXml(String(reader.result ?? ''));
        setImportMessage(
          `${summary.imported} furo(s) importado(s) (${summary.matched} do catálogo, ` +
            `${summary.customCreated} custom) · ${summary.groovesSkipped} rasgo(s) não ` +
            `suportado(s), ignorado(s).`,
        );
      } catch (err) {
        setImportMessage(err instanceof Error ? err.message : 'Falha ao importar XML.');
      }
    };
    reader.readAsText(file);
  };

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

      <section style={{ display: 'grid', gap: 8 }}>
        <h3 style={sectionTitleStyle}>Import / Guardar</h3>
        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted, #94a3b8)' }}>
          Import lê o XML uma única vez e substitui a peça/furos actuais — isolado do
          pipeline real (não escreve em ficheiros de produção).
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xml,text/xml"
          onChange={handleImportFile}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={{ ...toolBtnStyle(false), width: '100%', height: 32, fontSize: 12 }}
        >
          Importar XML (DRILL/KDT)
        </button>
        {importMessage && (
          <p style={{ margin: 0, fontSize: 11, color: '#93c5fd', lineHeight: 1.4 }}>
            {importMessage}
          </p>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => {
              design.saveState();
              setPersistMessage('Estado guardado.');
            }}
            style={{ ...toolBtnStyle(false), flex: 1, height: 32, fontSize: 12 }}
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={() => {
              const ok = design.loadState();
              setPersistMessage(ok ? 'Estado carregado.' : 'Sem estado guardado.');
            }}
            style={{ ...toolBtnStyle(false), flex: 1, height: 32, fontSize: 12 }}
          >
            Carregar
          </button>
        </div>
        {persistMessage && (
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted, #94a3b8)' }}>
            {persistMessage}
          </p>
        )}
      </section>

      <section style={{ display: 'grid', gap: 10 }}>
        <h3 style={sectionTitleStyle}>Parâmetros — {toolLabel}</h3>
        {design.selectedHoleId && design.selectedHoleSnapshot ? (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 11, color: '#22d3ee' }}>
                A editar furo (
                {design.selectedHoleSnapshot.kind === 'catalog' ? 'catálogo' : 'custom'})
              </span>
              <button
                type="button"
                onClick={() => design.selectHole(null)}
                style={{ ...toolBtnStyle(false), height: 26, fontSize: 11, padding: '0 8px' }}
              >
                Novo furo
              </button>
            </div>
            <label style={fieldLabelStyle}>
              X (mm)
              <input
                type="number"
                value={design.selectedHoleSnapshot.xMm}
                onChange={(e) =>
                  design.updateSelectedHole({ xMm: Number(e.target.value) || 0 })
                }
                style={fieldInputStyle}
              />
            </label>
            <label style={fieldLabelStyle}>
              Y (mm)
              <input
                type="number"
                value={design.selectedHoleSnapshot.yMm}
                onChange={(e) =>
                  design.updateSelectedHole({ yMm: Number(e.target.value) || 0 })
                }
                style={fieldInputStyle}
              />
            </label>
            <label style={fieldLabelStyle}>
              Ø (mm)
              <input
                type="number"
                value={design.selectedHoleSnapshot.diameterMm}
                onChange={(e) =>
                  design.updateSelectedHole({ diameterMm: Number(e.target.value) || 0 })
                }
                style={fieldInputStyle}
              />
            </label>
            <label style={fieldLabelStyle}>
              Profundidade (mm)
              <input
                type="number"
                value={design.selectedHoleSnapshot.depthMm}
                onChange={(e) =>
                  design.updateSelectedHole({ depthMm: Number(e.target.value) || 0 })
                }
                style={fieldInputStyle}
              />
            </label>
            <label style={fieldLabelStyle}>
              Face
              <select
                value={design.selectedHoleSnapshot.face}
                onChange={(e) =>
                  design.updateSelectedHole({ face: e.target.value as HoleFaceKind })
                }
                style={fieldInputStyle}
              >
                <option value="face">face</option>
                <option value="espessura">espessura</option>
              </select>
            </label>
          </>
        ) : dynamicFields.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
            Modo de vista · sem parâmetros de feature
          </p>
        ) : activeTool === 'hole' ? (
          dynamicFields.map((field) => {
            if (field.key === 'x' || field.key === 'y') {
              const value = field.key === 'x' ? xMm : yMm;
              const onChange = field.key === 'x' ? setXMm : setYMm;
              return (
                <label key={field.key} style={fieldLabelStyle}>
                  {field.label}
                  <input
                    type="number"
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value) || 0)}
                    style={fieldInputStyle}
                  />
                </label>
              );
            }
            const readOnlyValue =
              field.key === 'diameter'
                ? design.selectedHoleType?.diametroMm ?? ''
                : field.key === 'depth'
                  ? design.selectedHoleType?.profundidadeMm ?? ''
                  : field.key === 'face'
                    ? design.selectedHoleType?.face ?? ''
                    : '';
            return (
              <label key={field.key} style={fieldLabelStyle}>
                {field.label}
                <input
                  type="text"
                  disabled
                  readOnly
                  value={readOnlyValue}
                  placeholder="—"
                  style={fieldInputDisabledStyle}
                />
              </label>
            );
          })
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
          onClick={() => design.addHoleAt(xMm, yMm)}
          style={{
            ...toolBtnStyle(Boolean(design.selectedHoleTypeId)),
            width: '100%',
            height: 34,
            fontSize: 12,
            opacity: design.selectedHoleTypeId ? 1 : 0.45,
            cursor: design.selectedHoleTypeId ? 'pointer' : 'default',
          }}
        >
          Adicionar furo em X/Y
        </button>
      </section>

      <section style={{ display: 'grid', gap: 8 }}>
        <h3 style={sectionTitleStyle}>
          Furos ({design.holes.length + design.customHoles.length})
        </h3>
        {design.holes.length === 0 && design.customHoles.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
            Nenhum furo na peça.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
            {design.holes.map(({ panelId, hole }) => {
              const isSelected = design.selectedHoleId === hole.id;
              return (
                <li
                  key={hole.id}
                  onClick={() => design.selectHole(hole.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '6px 8px',
                    borderRadius: 6,
                    background: isSelected
                      ? 'rgba(34, 211, 238, 0.16)'
                      : 'rgba(255,255,255,0.04)',
                    outline: isSelected ? '1px solid #22d3ee' : 'none',
                    fontSize: 11,
                    color: '#e2e8f0',
                    cursor: 'pointer',
                  }}
                >
                  <span>{design.formatHoleLabel(hole)}</span>
                  <button
                    type="button"
                    title="Remover furo"
                    onClick={(e) => {
                      e.stopPropagation();
                      design.removeHole(panelId, hole.id);
                    }}
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
              );
            })}
            {design.customHoles.map((hole) => {
              const local = design.localCatalog.find((l) => l.id === hole.localHoleTypeId);
              const isSelected = design.selectedHoleId === hole.id;
              return (
                <li
                  key={hole.id}
                  onClick={() => design.selectHole(hole.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '6px 8px',
                    borderRadius: 6,
                    background: isSelected
                      ? 'rgba(34, 211, 238, 0.16)'
                      : 'rgba(249, 115, 22, 0.08)',
                    outline: isSelected ? '1px solid #22d3ee' : 'none',
                    fontSize: 11,
                    color: '#e2e8f0',
                    cursor: 'pointer',
                  }}
                >
                  <span>
                    Ø{local?.diametroMm ?? '?'}×{local?.profundidadeMm ?? '?'}mm (custom) @ (
                    {hole.xMm.toFixed(0)}, {hole.yMm.toFixed(0)}) mm
                  </span>
                  <button
                    type="button"
                    title="Remover furo custom"
                    onClick={(e) => {
                      e.stopPropagation();
                      design.removeCustomHole(hole.id);
                    }}
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
              );
            })}
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
