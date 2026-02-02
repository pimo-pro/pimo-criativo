import { useMemo } from "react";
import Panel from "../ui/Panel";
import { useProject } from "../../context/useProject";
import { gerarModeloIndustrial } from "../../core/manufacturing/boxManufacturing";
import type { FerragemIndustrial } from "../../core/industriais/ferragensIndustriais";
import { gerarFerragensIndustriais, agruparPorComponente } from "../../core/industriais/ferragensIndustriais";
import { useComponentTypes } from "../../hooks/useComponentTypes";
import { useFerragens } from "../../hooks/useFerragens";

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

const aplicacaoFerragens: Record<string, string> = {
  dobradicas: "Portas",
  corredicas: "Gavetas",
  suportes_prateleira: "Prateleiras",
};

export default function CutlistPanel() {
  const { project } = useProject();
  const { componentTypes } = useComponentTypes();
  const { ferragens } = useFerragens();
  // Single Source of Truth: TODAS as caixas de project.boxes (não apenas a selecionada)
  const boxes = project.boxes ?? [];

  const ferragensIndustriaisDetalhado = useMemo(
    () => gerarFerragensIndustriais(componentTypes, ferragens),
    [componentTypes, ferragens]
  );
  const ferragensPorComponente = useMemo(
    () => agruparPorComponente(ferragensIndustriaisDetalhado),
    [ferragensIndustriaisDetalhado]
  );

  if (boxes.length === 0) {
    return (
      <Panel title="Cutlist Industrial">
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Adicione caixas no painel direito para visualizar a cutlist industrial.
        </div>
      </Panel>
    );
  }

  // Totais agregados de TODAS as caixas (project.boxes)
  let totalAreaMm2 = 0;
  let totalPaineisQty = 0;
  let totalPortasQty = 0;
  let totalGavetasQty = 0;
  let totalFerragensQty = 0;
  let custoTotalPaineis = 0;
  let custoTotalPortas = 0;
  let custoTotalGavetas = 0;
  let custoTotalFerragens = 0;
  const allPaineis: Array<{ key: string; boxNome: string; tipo: string; largura_mm: number; altura_mm: number; espessura_mm: number; orientacaoFibra: string; quantidade: number; custo: number }> = [];
  const allPortas: Array<{ key: string; boxNome: string; tipo: string; largura_mm: number; altura_mm: number; espessura_mm: number; dobradicas: number; custo: number }> = [];
  const allGavetas: Array<{ key: string; boxNome: string; largura_mm: number; altura_mm: number; profundidade_mm: number; espessura_mm: number; corrediças: number; custo: number }> = [];
  const allFerragens: Array<{ key: string; boxNome: string; tipo: string; quantidade: number; custo: number }> = [];

  boxes.forEach((box) => {
    const modelo = gerarModeloIndustrial(box, project.rules);
    const boxNome = box.nome || box.id;
    totalAreaMm2 += modelo.cutlist.areaTotal_mm2;
    modelo.paineis.forEach((p) => {
      totalPaineisQty += p.quantidade;
      custoTotalPaineis += p.custo;
      allPaineis.push({ ...p, key: `${box.id}-${p.id}`, boxNome });
    });
    modelo.portas.forEach((p) => {
      totalPortasQty += 1;
      custoTotalPortas += p.custo;
      allPortas.push({ ...p, key: `${box.id}-${p.id}`, boxNome });
    });
    modelo.gavetas.forEach((p) => {
      totalGavetasQty += 1;
      custoTotalGavetas += p.custo;
      allGavetas.push({ ...p, key: `${box.id}-${p.id}`, boxNome });
    });
    modelo.ferragens.forEach((f) => {
      totalFerragensQty += f.quantidade;
      custoTotalFerragens += f.custo;
      allFerragens.push({ ...f, key: `${box.id}-${f.id}`, boxNome });
    });
  });

  const totalPecas = totalPaineisQty + totalPortasQty + totalGavetasQty;
  const totalAreaM2 = totalAreaMm2 / 1_000_000;
  const custoTotal =
    custoTotalPaineis + custoTotalPortas + custoTotalGavetas + custoTotalFerragens;

  return (
    <Panel title="Cutlist Industrial">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div style={sectionTitleStyle}>Painéis (todas as caixas)</div>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={headerCellStyle}>Caixa</th>
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
              {allPaineis.map((painel) => (
                <tr key={painel.key}>
                  <td style={bodyCellStyle}>{painel.boxNome}</td>
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

        {allPortas.length > 0 && (
          <div>
            <div style={sectionTitleStyle}>Portas (todas as caixas)</div>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={headerCellStyle}>Caixa</th>
                  <th style={headerCellStyle}>Tipo</th>
                  <th style={headerCellStyle}>Largura (mm)</th>
                  <th style={headerCellStyle}>Altura (mm)</th>
                  <th style={headerCellStyle}>Espessura (mm)</th>
                  <th style={{ ...headerCellStyle, textAlign: "center" }}>Nº dobradiças</th>
                  <th style={{ ...headerCellStyle, textAlign: "right" }}>Custo (€)</th>
                </tr>
              </thead>
              <tbody>
                {allPortas.map((porta) => (
                  <tr key={porta.key}>
                    <td style={bodyCellStyle}>{porta.boxNome}</td>
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

        {allGavetas.length > 0 && (
          <div>
            <div style={sectionTitleStyle}>Gavetas (todas as caixas)</div>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={headerCellStyle}>Caixa</th>
                  <th style={headerCellStyle}>Largura (mm)</th>
                  <th style={headerCellStyle}>Altura (mm)</th>
                  <th style={headerCellStyle}>Profundidade (mm)</th>
                  <th style={headerCellStyle}>Espessura (mm)</th>
                  <th style={{ ...headerCellStyle, textAlign: "center" }}>Corrediças</th>
                  <th style={{ ...headerCellStyle, textAlign: "right" }}>Custo (€)</th>
                </tr>
              </thead>
              <tbody>
                {allGavetas.map((gaveta) => (
                  <tr key={gaveta.key}>
                    <td style={bodyCellStyle}>{gaveta.boxNome}</td>
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
          <div style={sectionTitleStyle}>Ferragens Industriais (todas as caixas)</div>
          {allFerragens.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Sem ferragens.
            </div>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={headerCellStyle}>Caixa</th>
                  <th style={headerCellStyle}>Ferragem</th>
                  <th style={{ ...headerCellStyle, textAlign: "center" }}>Quantidade</th>
                  <th style={headerCellStyle}>Aplicação</th>
                  <th style={{ ...headerCellStyle, textAlign: "right" }}>Custo (€)</th>
                </tr>
              </thead>
              <tbody>
                {allFerragens.map((ferragem) => (
                  <tr key={ferragem.key}>
                    <td style={bodyCellStyle}>{ferragem.boxNome}</td>
                    <td style={bodyCellStyle}>{ferragem.tipo}</td>
                    <td style={{ ...bodyCellStyle, textAlign: "center" }}>
                      {ferragem.quantidade}
                    </td>
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

        <div>
          <div style={sectionTitleStyle}>Ferragens Industriais (detalhado)</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
            Por tipo de componente — ferragens e furos (Component Types + regras de furação).
          </div>
          {ferragensIndustriaisDetalhado.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Nenhuma ferragem industrial configurada.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(Array.from(ferragensPorComponente.entries()) as [string, FerragemIndustrial[]][]).map(
                ([componenteId, itens]) => (
                  <div
                    key={componenteId}
                    style={{
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: "var(--radius)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        padding: "6px 10px",
                        background: "rgba(255,255,255,0.04)",
                        fontWeight: 600,
                        fontSize: 12,
                      }}
                    >
                      {componenteId}
                    </div>
                    <table style={tableStyle}>
                      <thead>
                        <tr>
                          <th style={headerCellStyle}>ferragem_id</th>
                          <th style={{ ...headerCellStyle, textAlign: "center" }}>Quantidade</th>
                          <th style={headerCellStyle}>aplicar_em</th>
                          <th style={headerCellStyle}>tipo_furo</th>
                          <th style={headerCellStyle}>profundidade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itens.map((item, idx) => (
                          <tr key={`${componenteId}-${idx}`}>
                            <td style={bodyCellStyle}>{item.ferragem_id}</td>
                            <td style={{ ...bodyCellStyle, textAlign: "center" }}>
                              {item.quantidade}
                            </td>
                            <td style={bodyCellStyle}>
                              {item.aplicar_em.length > 0 ? item.aplicar_em.join(", ") : "—"}
                            </td>
                            <td style={bodyCellStyle}>{item.tipo_furo ?? "—"}</td>
                            <td style={bodyCellStyle}>
                              {item.profundidade != null ? `${item.profundidade} mm` : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>
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
          <div style={{ ...sectionTitleStyle, marginBottom: 4 }}>Totais do Projeto (project.boxes)</div>
          <div>Área total de painéis: {totalAreaM2.toFixed(3)} m²</div>
          <div>Quantidade total de peças: {totalPecas}</div>
          <div>Quantidade total de ferragens: {totalFerragensQty}</div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Custo total de painéis:</span>
            <span style={totalValueStyle}>{custoTotalPaineis.toFixed(2)} €</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Custo total de portas:</span>
            <span style={totalValueStyle}>{custoTotalPortas.toFixed(2)} €</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Custo total de gavetas:</span>
            <span style={totalValueStyle}>{custoTotalGavetas.toFixed(2)} €</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Custo total de ferragens:</span>
            <span style={totalValueStyle}>{custoTotalFerragens.toFixed(2)} €</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontWeight: 700,
            }}
          >
            <span>Custo total do projeto:</span>
            <span style={totalValueStyle}>{custoTotal.toFixed(2)} €</span>
          </div>
        </div>
      </div>
    </Panel>
  );
}
