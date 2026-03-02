import { useState, type ChangeEvent } from "react";
import { useProject } from "../../../context/useProject";
import Panel from "../../ui/Panel";

type BoxLayersPanelProps = {
  embedded?: boolean;
};

export default function BoxLayersPanel({ embedded = false }: BoxLayersPanelProps) {
  const { project, actions } = useProject();
  const [expandedDoorIds, setExpandedDoorIds] = useState<Record<string, boolean>>({});
  const selectedBox =
    project.workspaceBoxes.find((box) => box.id === project.selectedWorkspaceBoxId) ??
    project.workspaceBoxes[0];

  if (!selectedBox) {
    if (embedded) {
      return (
        <p className="muted-text" style={{ margin: 0 }}>
          Nenhuma caixa selecionada.
        </p>
      );
    }
    return (
      <Panel title="Portas e Gavetas" description="Selecione uma caixa para configurar as camadas.">
        <p className="muted-text" style={{ margin: 0 }}>
          Nenhuma caixa selecionada.
        </p>
      </Panel>
    );
  }

  const doors = selectedBox.doorsLayer ?? [];
  const drawers = selectedBox.drawersLayer ?? [];

  const onNumberDoor =
    (id: string, field: "width" | "height" | "thickness") =>
    (event: ChangeEvent<HTMLInputElement>) => {
      actions.updateDoorLayerItem(id, { [field]: Number(event.target.value) || 1 });
    };

  const onNumberDrawer =
    (id: string, field: "width" | "height" | "depth" | "frontThickness" | "pullDistanceMm") =>
    (event: ChangeEvent<HTMLInputElement>) => {
      actions.updateDrawerLayerItem(id, { [field]: Number(event.target.value) || 1 });
    };

  const content = (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button
          type="button"
          className="button button-primary"
          style={{ width: "100%" }}
          onClick={() => actions.regenerateBoxLayersForSelectedBox()}
        >
          Regenerar Camadas
        </button>

        {doors.map((item, index) => (
          <button
            key={`door-toggle-${item.id}`}
            type="button"
            className="button button-primary"
            style={{ width: "100%" }}
            onClick={() => actions.setDoorLayerItemOpen(item.id, !item.isOpen)}
          >
            Porta {index + 1}: {item.isOpen ? "Fechar" : "Abrir"}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <strong style={{ fontSize: 12 }}>Portas</strong>
        {doors.length === 0 ? (
          <div className="muted-text">Sem portas.</div>
        ) : (
          doors.map((item) => (
            <div key={item.id} style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: 10 }}>
              <button
                type="button"
                onClick={() =>
                  setExpandedDoorIds((prev) => ({
                    ...prev,
                    [item.id]: !prev[item.id],
                  }))
                }
                style={{
                  width: "100%",
                  border: "none",
                  background: "transparent",
                  color: "inherit",
                  display: "flex",
                  alignItems: "center",
                  textAlign: "left",
                  cursor: "pointer",
                  padding: 0,
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600 }}>
                  {Math.round(item.width)}×{Math.round(item.height)}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {item.openDirection === "left"
                    ? "Abertura: para a esquerda"
                    : item.openDirection === "right"
                      ? "Abertura: para a direita"
                      : item.openDirection === "up"
                        ? "Abertura: para cima"
                        : "Abertura: para baixo"}
                </span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>
                  {expandedDoorIds[item.id] ? "Ocultar" : "Detalhes"}
                </span>
              </button>

              {expandedDoorIds[item.id] && (
                <>
                  <div className="form-grid" style={{ marginTop: 8 }}>
                    <input className="input input-xs" type="number" value={item.width} onChange={onNumberDoor(item.id, "width")} placeholder="Largura" />
                    <input className="input input-xs" type="number" value={item.height} onChange={onNumberDoor(item.id, "height")} placeholder="Altura" />
                    <input className="input input-xs" type="number" value={item.thickness} onChange={onNumberDoor(item.id, "thickness")} placeholder="Espessura" />
                    <input className="input input-xs" value={item.materialId ?? ""} onChange={(e) => actions.setDoorLayerItemMaterial(item.id, e.target.value)} placeholder="Material ID" />
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <select
                      className="select select-xs"
                      value={item.openDirection}
                      onChange={(e) => actions.setDoorLayerItemDirection(item.id, e.target.value as "left" | "right" | "up" | "down")}
                      title="Lado da porta / abertura para cima"
                    >
                      <option value="left">Lado: esquerda</option>
                      <option value="right">Lado: direita</option>
                      <option value="up">Abertura: para cima</option>
                      <option value="down">Abertura: para baixo</option>
                    </select>
                    <button type="button" className="button button-ghost" onClick={() => actions.removeDoorLayerItem(item.id)}>
                      Excluir
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}

        <strong style={{ fontSize: 12, marginTop: 4 }}>Gavetas</strong>
        {drawers.length === 0 ? (
          <div className="muted-text">Sem gavetas.</div>
        ) : (
          drawers.map((item) => {
            const drawerType = item.type ?? item.drawerType ?? "normal";
            return (
              <div key={item.id} style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: 10 }}>
                <div className="form-grid">
                  <input className="input input-xs" type="number" value={item.width} onChange={onNumberDrawer(item.id, "width")} placeholder="Largura" />
                  <input className="input input-xs" type="number" value={item.height} onChange={onNumberDrawer(item.id, "height")} placeholder="Altura" />
                  <input className="input input-xs" type="number" value={item.depth} onChange={onNumberDrawer(item.id, "depth")} placeholder="Profundidade" />
                  <input className="input input-xs" type="number" value={item.frontThickness} onChange={onNumberDrawer(item.id, "frontThickness")} placeholder="Frente" />
                  <input className="input input-xs" type="number" value={item.pullDistanceMm} onChange={onNumberDrawer(item.id, "pullDistanceMm")} placeholder="Curso (mm)" />
                  <input className="input input-xs" value={item.materialId ?? ""} onChange={(e) => actions.setDrawerLayerItemMaterial(item.id, e.target.value)} placeholder="Material ID" />
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <select
                    className="select select-xs"
                    value={drawerType}
                    onChange={(e) => actions.updateDrawerLayerItem(item.id, { type: e.target.value as "normal" | "pro" })}
                    title="Tipo de puxador"
                  >
                    <option value="normal">Puxador normal</option>
                    <option value="pro">Puxador PRO</option>
                  </select>
                  <button type="button" className="button button-ghost" onClick={() => actions.setDrawerLayerItemOpen(item.id, !item.isOpen)}>
                    {item.isOpen ? "Fechar" : "Abrir"}
                  </button>
                  <button type="button" className="button button-ghost" onClick={() => actions.removeDrawerLayerItem(item.id)}>
                    Excluir
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );

  if (embedded) return content;

  return (
    <Panel title="Portas e Gavetas" description="Camadas independentes com pivôs próprios e materiais.">
      {content}
    </Panel>
  );
}
