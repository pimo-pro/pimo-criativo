import Panel from "../ui/Panel";
import { useProject } from "../../context/useProject";
import { gerarModeloIndustrial } from "../../core/manufacturing/boxManufacturing";

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 12,
} as const;

const headerCellStyle = {
  padding: "6px 6px",
  textAlign: "left" as const,
  color: "var(--text-muted)",
  fontWeight: 600,
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const bodyCellStyle = {
  padding: "6px 6px",
  color: "var(--text-main)",
  borderBottom: "1px solid rgba(255,255,255,0.05)",
};

const costCellStyle = {
  ...bodyCellStyle,
  textAlign: "right" as const,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
};

const totalValueStyle = {
  color: "rgba(74, 222, 128, 0.9)",
  textAlign: "right" as const,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
};

const sectionTitleStyle = {
  fontSize: 13,
  fontWeight: 700,
  color: "var(--text-main)",
  marginBottom: 8,
};

export default function CutlistPanel() {
  const { project } = useProject();
  const selectedBox =
    project.boxes.find((box) => box.id === project.selectedBoxId) ?? project.boxes[0];

  if (!selectedBox) {
    return (
      <Panel title="Cutlist Industrial">
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Gere o design para visualizar a cutlist industrial.
        </div>
      </Panel>
    );
  }

  const modeloIndustrial = gerarModeloIndustrial(selectedBox);
  const totalAreaMm2 = modeloIndustrial.cutlist.areaTotal_mm2;
  const totalAreaM2 = totalAreaMm2 / 1_000_000;
  const totalPaineis = modeloIndustrial.paineis.reduce(
    (sum, item) => sum + item.quantidade,
    0
  );
  const totalPortas = modeloIndustrial.portas.length;
  const totalGavetas = modeloIndustrial.gavetas.length;
  const totalPecas = totalPaineis + totalPortas + totalGavetas;
  const totalFerragens = modeloIndustrial.ferragens.reduce(
    (sum, item) => sum + item.quantidade,
    0
  );

  const aplicacaoFerragens: Record<string, string> = {
    dobradicas: "Portas",
    corredicas: "Gavetas",
    suportes_prateleira: "Prateleiras",
  };

  return (
    <Panel title="Cutlist Industrial">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div style={sectionTitleStyle}>Painéis</div>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={headerCellStyle}>Tipo</th>
                <th style={headerCellStyle}>Largura (mm)</th>
                <th style={headerCellStyle}>Altura (mm)</th>
                <th style={headerCellStyle}>Espessura (mm)</th>
                <th style={headerCellStyle}>Orientação</th>
                <th style={{ ...headerCellStyle, textAlign: "center" }}>Qtd</th>
                <th style={{ ...headerCellStyle, textAlign: "right" }}>Custo (€)</th>
              </tr>
            </thead>
            <tbody>
              {modeloIndustrial.paineis.map((painel) => (
                <tr key={painel.id}>
                  <td style={bodyCellStyle}>{painel.tipo}</td>
                  <td style={bodyCellStyle}>{painel.largura_mm}</td>
                  <td style={bodyCellStyle}>{painel.altura_mm}</td>
                  <td style={bodyCellStyle}>{painel.espessura_mm}</td>
                  <td style={bodyCellStyle}>{painel.orientacaoFibra}</td>
                  <td style={{ ...bodyCellStyle, textAlign: "center" }}>
                    {painel.quantidade}
                  </td>
                  <td style={costCellStyle}>{painel.custo.toFixed(2)} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {modeloIndustrial.portas.length > 0 && (
          <div>
            <div style={sectionTitleStyle}>Portas</div>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={headerCellStyle}>Tipo</th>
                  <th style={headerCellStyle}>Largura (mm)</th>
                  <th style={headerCellStyle}>Altura (mm)</th>
                  <th style={headerCellStyle}>Espessura (mm)</th>
                  <th style={{ ...headerCellStyle, textAlign: "center" }}>Nº dobradiças</th>
                  <th style={{ ...headerCellStyle, textAlign: "right" }}>Custo (€)</th>
                </tr>
              </thead>
              <tbody>
                {modeloIndustrial.portas.map((porta) => (
                  <tr key={porta.id}>
                    <td style={bodyCellStyle}>{porta.tipo}</td>
                    <td style={bodyCellStyle}>{porta.largura_mm}</td>
                    <td style={bodyCellStyle}>{porta.altura_mm}</td>
                    <td style={bodyCellStyle}>{porta.espessura_mm}</td>
                    <td style={{ ...bodyCellStyle, textAlign: "center" }}>{porta.dobradicas}</td>
                    <td style={costCellStyle}>{porta.custo.toFixed(2)} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {modeloIndustrial.gavetas.length > 0 && (
          <div>
            <div style={sectionTitleStyle}>Gavetas</div>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={headerCellStyle}>Largura (mm)</th>
                  <th style={headerCellStyle}>Altura (mm)</th>
                  <th style={headerCellStyle}>Profundidade (mm)</th>
                  <th style={headerCellStyle}>Espessura (mm)</th>
                  <th style={{ ...headerCellStyle, textAlign: "center" }}>Corrediças</th>
                  <th style={{ ...headerCellStyle, textAlign: "right" }}>Custo (€)</th>
                </tr>
              </thead>
              <tbody>
                {modeloIndustrial.gavetas.map((gaveta) => (
                  <tr key={gaveta.id}>
                    <td style={bodyCellStyle}>{gaveta.largura_mm}</td>
                    <td style={bodyCellStyle}>{gaveta.altura_mm}</td>
                    <td style={bodyCellStyle}>{gaveta.profundidade_mm}</td>
                    <td style={bodyCellStyle}>{gaveta.espessura_mm}</td>
                    <td style={{ ...bodyCellStyle, textAlign: "center" }}>{gaveta.corrediças}</td>
                    <td style={costCellStyle}>{gaveta.custo.toFixed(2)} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div>
          <div style={sectionTitleStyle}>Ferragens Industriais</div>
          {modeloIndustrial.ferragens.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Sem ferragens para este caixote.
            </div>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={headerCellStyle}>Ferragem</th>
                  <th style={{ ...headerCellStyle, textAlign: "center" }}>Quantidade</th>
                  <th style={headerCellStyle}>Medidas</th>
                  <th style={headerCellStyle}>Aplicação</th>
                  <th style={{ ...headerCellStyle, textAlign: "right" }}>Custo (€)</th>
                </tr>
              </thead>
              <tbody>
                {modeloIndustrial.ferragens.map((ferragem) => (
                  <tr key={ferragem.id}>
                    <td style={bodyCellStyle}>{ferragem.tipo}</td>
                    <td style={{ ...bodyCellStyle, textAlign: "center" }}>
                      {ferragem.quantidade}
                    </td>
                    <td style={bodyCellStyle}>--</td>
                    <td style={bodyCellStyle}>
                      {aplicacaoFerragens[ferragem.tipo] ?? "Geral"}
                    </td>
                    <td style={costCellStyle}>{ferragem.custo.toFixed(2)} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.08)",
            paddingTop: 10,
            fontSize: 12,
            color: "var(--text-main)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div>Área total de painéis: {totalAreaM2.toFixed(3)} m²</div>
          <div>Quantidade total de peças: {totalPecas}</div>
          <div>Quantidade total de ferragens: {totalFerragens}</div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Custo total de painéis:</span>
            <span style={totalValueStyle}>
              {modeloIndustrial.custoTotalPaineis.toFixed(2)} €
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Custo total de portas:</span>
            <span style={totalValueStyle}>
              {modeloIndustrial.custoTotalPortas.toFixed(2)} €
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Custo total de gavetas:</span>
            <span style={totalValueStyle}>
              {modeloIndustrial.custoTotalGavetas.toFixed(2)} €
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Custo total de ferragens:</span>
            <span style={totalValueStyle}>
              {modeloIndustrial.custoTotalFerragens.toFixed(2)} €
            </span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontWeight: 700,
            }}
          >
            <span>Custo total do módulo:</span>
            <span style={totalValueStyle}>{modeloIndustrial.custoTotal.toFixed(2)} €</span>
          </div>
        </div>
      </div>
    </Panel>
  );
}
