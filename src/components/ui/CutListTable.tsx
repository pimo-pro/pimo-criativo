import { useMemo } from "react";
import { useProject } from "../../context/useProject";
import { cutlistComPrecoFromBox } from "../../core/manufacturing/cutlistFromBoxes";

export default function CutListTable() {
  const { project } = useProject();
  const cutList = useMemo(() => {
    const boxes = project.boxes ?? [];
    const parametric = boxes.flatMap((box) => cutlistComPrecoFromBox(box));
    const extracted = boxes.flatMap((box) =>
      Object.values(project.extractedPartsByBoxId?.[box.id] ?? {}).flat()
    );
    return [...parametric, ...extracted];
  }, [project.boxes, project.extractedPartsByBoxId]);

  if (!cutList || cutList.length === 0) {
    return <p>Nenhuma peça. Adicione caixas e/ou modelos GLB.</p>;
  }

  const origemLabel = (item: (typeof cutList)[0]) =>
    item.sourceType === "glb_importado" ? "GLB" : "Param.";

  return (
    <div style={{ marginTop: "20px" }}>
      <h2>Lista de Cortes (Cut List)</h2>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "var(--surface)" }}>
            <th>Peça</th>
            <th>Origem</th>
            <th>Largura</th>
            <th>Altura</th>
            <th>Espessura</th>
            <th>Qtd</th>
            <th>Material</th>
            <th>Preço Unit.</th>
            <th>Preço Total</th>
          </tr>
        </thead>

        <tbody>
          {cutList.map((item) => (
            <tr key={item.id}>
              <td>{item.nome}</td>
              <td>
                <span
                  style={{
                    fontSize: 11,
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: item.sourceType === "glb_importado" ? "rgba(34,197,94,0.2)" : "rgba(59,130,246,0.2)",
                    color: "var(--text-main)",
                  }}
                >
                  {origemLabel(item)}
                </span>
              </td>
              <td>{item.dimensoes.largura} mm</td>
              <td>{item.dimensoes.altura} mm</td>
              <td>{item.espessura} mm</td>
              <td>{item.quantidade}</td>
              <td>{item.material}</td>
              <td>{item.precoUnitario} €</td>
              <td>{item.precoTotal} €</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}