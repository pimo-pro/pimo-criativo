import Panel from "./Panel";
import { useProject } from "../../context/useProject";

type CutListRow = {
  id: string;
  nome: string;
  largura: number;
  altura: number;
  profundidade: number;
  espessura: number;
  quantidade: number;
  precoUnitario?: number;
  precoTotal?: number;
};

export default function CutListView() {
  const { project, actions } = useProject();
  const microTextStyle = { fontSize: 12, lineHeight: 1.4, color: "var(--text-muted)" };
  const doorLabels: Record<string, string> = {
    sem_porta: "Sem porta",
    porta_simples: "Porta simples",
    porta_dupla: "Porta dupla",
    porta_correr: "Porta de correr",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
      {project.boxes.map((box, index) => {
        const isSelected = box.id === project.selectedBoxId;
        const rows: CutListRow[] =
          box.cutListComPreco.length > 0
            ? box.cutListComPreco.map((item) => ({
                id: item.id,
                nome: item.nome,
                largura: item.dimensoes.largura,
                altura: item.dimensoes.altura,
                profundidade: item.dimensoes.profundidade,
                espessura: item.espessura,
                quantidade: item.quantidade,
                precoUnitario: item.precoUnitario,
                precoTotal: item.precoTotal,
              }))
            : box.cutList.map((item) => ({
                id: item.id,
                nome: item.nome,
                largura: item.dimensoes.largura,
                altura: item.dimensoes.altura,
                profundidade: item.dimensoes.profundidade,
                espessura: item.espessura,
                quantidade: item.quantidade,
              }));
        const totalPecas = rows.reduce((sum, item) => sum + item.quantidade, 0);

        const title = box.nome || `Caixa ${index + 1}`;

        return (
          <Panel key={box.id} title={title}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => actions.selectBox(box.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  actions.selectBox(box.id);
                }
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                cursor: "pointer",
                padding: "8px",
                borderRadius: "var(--radius)",
                border: isSelected
                  ? "1px solid rgba(59,130,246,0.45)"
                  : "1px solid rgba(255,255,255,0.06)",
                background: isSelected ? "rgba(59,130,246,0.08)" : "transparent",
                outline: "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {doorLabels[box.portaTipo] ?? "Sem porta"} · {box.prateleiras} prateleiras ·{" "}
                  {box.gavetas} gavetas
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      actions.selectBox(box.id);
                      setTimeout(() => actions.duplicateBox(), 0);
                    }}
                    style={{
                      width: 28,
                      height: 24,
                      borderRadius: 6,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(255,255,255,0.05)",
                      color: "var(--text-main)",
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                    aria-label="Duplicar caixote"
                    title="Duplicar"
                  >
                    📄
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      actions.selectBox(box.id);
                      setTimeout(() => actions.removeBox(), 0);
                    }}
                    style={{
                      width: 28,
                      height: 24,
                      borderRadius: 6,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(255,255,255,0.05)",
                      color: "var(--text-main)",
                      cursor: project.boxes.length <= 1 ? "not-allowed" : "pointer",
                      opacity: project.boxes.length <= 1 ? 0.5 : 1,
                      fontSize: 12,
                    }}
                    aria-label="Remover caixote"
                    title="Remover"
                    disabled={project.boxes.length <= 1}
                  >
                    🗑
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: 8,
                }}
              >
                <div>
                  <div style={microTextStyle}>Dimensões</div>
                  <div style={{ fontSize: 12, color: "var(--text-main)" }}>
                    {box.dimensoes.largura}×{box.dimensoes.altura}×{box.dimensoes.profundidade} mm
                  </div>
                </div>
                <div>
                  <div style={microTextStyle}>Total de peças</div>
                  <div style={{ fontSize: 12, color: "var(--text-main)" }}>
                    {totalPecas > 0 ? totalPecas : "--"}
                  </div>
                </div>
                <div>
                  <div style={microTextStyle}>Preço estimado</div>
                  <div style={{ fontSize: 12, color: "var(--text-main)" }}>
                    {box.precoTotalPecas > 0 ? `${box.precoTotalPecas.toFixed(2)} €` : "--"}
                  </div>
                </div>
              </div>
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
