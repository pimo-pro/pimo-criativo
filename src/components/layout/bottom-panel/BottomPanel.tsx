import { useMemo } from "react";
import { useProject } from "../../../context/useProject";
import Panel from "../../ui/Panel";
import CutlistPanel from "../../panels/CutlistPanel";
import {
  cutlistComPrecoFromBoxes,
  ferragensFromBoxes,
} from "../../../core/manufacturing/cutlistFromBoxes";
import {
  calcularPrecoTotalPecas,
  calcularPrecoTotalProjeto,
} from "../../../core/pricing/pricing";
import {
  CHAPA_PADRAO_LARGURA,
  CHAPA_PADRAO_ALTURA,
  DENSIDADE_PADRAO,
} from "../../../core/manufacturing/materials";
import { useMaterials } from "../../../hooks/useMaterials";

export default function BottomPanel() {
  const { project } = useProject();
  const { materials } = useMaterials();
  const microTextStyle = { fontSize: 12, lineHeight: 1.4, color: "var(--text-muted)" };

  // Single Source of Truth: Resumo Financeiro 100% de project.boxes (não project.resultados/design)
  // boxes em useMemo para referência estável e evitar reexecução dos useMemo abaixo a cada render
  const boxes = useMemo(() => project.boxes ?? [], [project.boxes]);
  const cutlist = useMemo(() => cutlistComPrecoFromBoxes(boxes, project.rules), [boxes, project.rules]);
  const ferragens = useMemo(() => ferragensFromBoxes(boxes, project.rules), [boxes, project.rules]);
  const totalPecas = cutlist.reduce((sum, item) => sum + item.quantidade, 0);
  const totalFerragens = ferragens.reduce((sum, a) => sum + a.quantidade, 0);
  const totalItens = totalPecas + totalFerragens;
  const custoPecas = cutlist.length > 0 ? calcularPrecoTotalPecas(cutlist) : null;
  const custoFerragens =
    ferragens.length > 0 ? ferragens.reduce((s, a) => s + a.precoTotal, 0) : null;
  const custoMateriais =
    custoPecas != null && custoFerragens != null
      ? custoPecas + custoFerragens
      : custoPecas ?? custoFerragens ?? null;
  const precoTotal =
    custoPecas != null && custoFerragens != null
      ? calcularPrecoTotalProjeto(custoPecas + custoFerragens)
      : null;
  const precoPorPeca =
    precoTotal != null && totalPecas > 0 ? precoTotal / totalPecas : null;
  const custoMontagem =
    precoTotal != null && custoPecas != null && custoFerragens != null
      ? precoTotal - (custoPecas + custoFerragens)
      : null;
  const precoPorCaixa =
    precoTotal != null && boxes.length > 0 ? precoTotal / boxes.length : null;

  // ============================================
  // NOVOS CÁLCULOS: Área, Peso e Chapas
  // ============================================

  // 1) Área total de painéis (m²)
  // Soma de (largura × altura × quantidade) para cada peça, convertido de mm² para m²
  const areaTotalMm2 = useMemo(() => {
    return cutlist.reduce((sum, item) => {
      const largura = item.dimensoes?.largura ?? 0;
      const altura = item.dimensoes?.altura ?? 0;
      const qty = item.quantidade;
      return sum + largura * altura * qty;
    }, 0);
  }, [cutlist]);
  const areaTotalM2 = areaTotalMm2 / 1_000_000;

  // 2) Peso total aproximado (kg)
  // Usa (largura × altura × espessura × densidade × quantidade)
  // Densidade vem do material ou padrão
  const pesoTotalKg = useMemo(() => {
    return cutlist.reduce((sum, item) => {
      const largura = item.dimensoes?.largura ?? 0;
      const altura = item.dimensoes?.altura ?? 0;
      const espessura = item.espessura ?? item.dimensoes?.profundidade ?? 18;
      const qty = item.quantidade;
      // Encontrar densidade do material
      const mat = materials.find((m) => m.nome === item.material);
      const densidade = mat?.densidade ?? DENSIDADE_PADRAO;
      // Volume em m³
      const volumeM3 = (largura * altura * espessura * qty) / 1_000_000_000;
      return sum + volumeM3 * densidade;
    }, 0);
  }, [cutlist, materials]);

  // 3) Número de chapas utilizadas
  // Área chapa padrão: 2850 × 2100 mm = 5.985.000 mm²
  const areaChapaMm2 = CHAPA_PADRAO_LARGURA * CHAPA_PADRAO_ALTURA;
  const numeroChapas = areaTotalMm2 > 0 ? Math.ceil(areaTotalMm2 / areaChapaMm2) : 0;

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div
      className="bottom-panel-root"
      style={{
        position: "relative",
        width: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          gap: 16,
          width: "100%",
          flex: "1 1 auto",
          position: "relative",
          boxSizing: "border-box",
        }}
      >
        <div style={{ flex: "0 0 25%", minWidth: 0, padding: "8px 0", marginRight: 16 }}>
          <Panel title="Resumo Financeiro do Projeto">
          <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "4px 0" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main)", marginBottom: 2 }}>Quantidades</div>
            <div style={{ display: "flex", justifyContent: "space-between", ...microTextStyle }}>
              <span>Peças totais</span>
              <span style={{ color: "var(--text-main)" }}>{totalPecas}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", ...microTextStyle }}>
              <span>Ferragens totais</span>
              <span style={{ color: "var(--text-main)" }}>{totalFerragens}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", ...microTextStyle }}>
              <span>Total de itens</span>
              <span style={{ color: "var(--text-main)" }}>{totalItens}</span>
            </div>

            <div
              style={{
                height: 1,
                background: "rgba(255,255,255,0.08)",
                margin: "4px 0 2px 0",
              }}
            />

            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main)", marginBottom: 2 }}>Materiais</div>
            <div style={{ display: "flex", justifyContent: "space-between", ...microTextStyle }}>
              <span>Área total</span>
              <span style={{ color: "var(--text-main)" }}>{areaTotalM2.toFixed(3)} m²</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", ...microTextStyle }}>
              <span>Peso total</span>
              <span style={{ color: "var(--text-main)" }}>{pesoTotalKg.toFixed(2)} kg</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", ...microTextStyle }}>
              <span>Nº de chapas</span>
              <span style={{ color: "var(--text-main)" }}>{numeroChapas}</span>
            </div>

            <div
              style={{
                height: 1,
                background: "rgba(255,255,255,0.08)",
                margin: "4px 0 2px 0",
              }}
            />

            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main)", marginBottom: 2 }}>Custos</div>
            <div style={{ display: "flex", justifyContent: "space-between", ...microTextStyle }}>
              <span>Materiais</span>
            <span style={{ color: "var(--text-main)" }}>
              {custoMateriais !== null ? `${custoMateriais.toFixed(2)} €` : "--"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", ...microTextStyle }}>
            <span>Peças</span>
            <span style={{ color: "var(--text-main)" }}>
                {custoPecas !== null ? `${custoPecas.toFixed(2)} €` : "--"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", ...microTextStyle }}>
              <span>Ferragens</span>
            <span style={{ color: "var(--text-main)" }}>
              {custoFerragens !== null ? `${custoFerragens.toFixed(2)} €` : "--"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", ...microTextStyle }}>
            <span>Montagem</span>
            <span style={{ color: "var(--text-main)" }}>
                {custoMontagem !== null ? `${custoMontagem.toFixed(2)} €` : "--"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
              <span style={{ color: "var(--text-main)" }}>Total geral</span>
            <span style={{ color: "var(--blue-light)" }}>
              {precoTotal !== null ? `${precoTotal.toFixed(2)} €` : "--"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", ...microTextStyle }}>
            <span>Preço por peça</span>
            <span style={{ color: "var(--text-main)" }}>
                {precoPorPeca !== null ? `${precoPorPeca.toFixed(2)} €` : "--"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", ...microTextStyle }}>
              <span>Preço por caixa</span>
              <span style={{ color: "var(--text-main)" }}>
                {precoPorCaixa !== null ? `${precoPorCaixa.toFixed(2)} €` : "--"}
              </span>
            </div>
          </div>
        </Panel>
        </div>

        <div style={{ flex: "1 1 70%", minWidth: 0, padding: "8px 0" }}>
          <CutlistPanel />
        </div>

        <button
          type="button"
          onClick={scrollToTop}
          title="Voltar ao topo"
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: 28,
            height: 28,
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.06)",
            color: "var(--text-muted)",
            cursor: "pointer",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
