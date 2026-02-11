import type { BoxModule } from "../types";
import { getMaterial } from "./materials";
import type { RulesConfig } from "../rules/rulesConfig";
import { getMaterialForBox, getIndustrialMaterial } from "../materials/service";
import { getNumDobradicas } from "../rules/rulesConfig";
import { SYSTEM_THICKNESS_MM, SYSTEM_BACK_MM } from "../baseCabinets";

type PainelIndustrial = {
  id: string;
  tipo: string;
  largura_mm: number;
  altura_mm: number;
  espessura_mm: number;
  material: string;
  orientacaoFibra: "horizontal" | "vertical";
  quantidade: number;
  custo: number;
};

type FerragemIndustrial = {
  id: string;
  tipo: string;
  quantidade: number;
  custo: number;
};

type PortaIndustrial = {
  id: string;
  largura_mm: number;
  altura_mm: number;
  espessura_mm: number;
  tipo: "overlay" | "inset";
  dobradicas: number;
  custo: number;
};

type GavetaIndustrial = {
  id: string;
  largura_mm: number;
  altura_mm: number;
  profundidade_mm: number;
  espessura_mm: number;
  corrediças: number;
  custo: number;
};

type CutlistItemIndustrial = {
  tipo: string;
  largura_mm: number;
  altura_mm: number;
  espessura_mm: number;
  quantidade: number;
  areaTotal_mm2: number;
};

type ModeloIndustrial = {
  dimensoes: BoxModule["dimensoes"];
  espessura: number;
  paineis: PainelIndustrial[];
  ferragens: FerragemIndustrial[];
  portas: PortaIndustrial[];
  gavetas: GavetaIndustrial[];
  custoTotalPaineis: number;
  custoTotalFerragens: number;
  custoTotalPortas: number;
  custoTotalGavetas: number;
  custoTotal: number;
  cutlist: {
    itens: CutlistItemIndustrial[];
    areaTotal_mm2: number;
  };
  rules: RulesConfig;
};

const clampPositive = (value: number) => Math.max(0, Math.round(value));

const buildId = (prefix: string, index: number) => `${prefix}-${index + 1}`;

/** ID estável para painel estrutural (cima, fundo, lateral_esquerda, lateral_direita, costa). */
function getStructuralPanelId(box: BoxModule, kind: "cima" | "fundo" | "lateral_esquerda" | "lateral_direita" | "costa"): string {
  const id = box.panelIds?.[kind];
  if (typeof id === "string") return id;
  const prefix = kind === "lateral_esquerda" ? "lateral-esquerda" : kind === "lateral_direita" ? "lateral-direita" : kind;
  return buildId(prefix, 0);
}

/** ID estável para prateleira/porta/gaveta por índice. */
function getArrayPanelId(box: BoxModule, kind: "prateleiras" | "portas" | "gavetas", index: number): string {
  const arr = box.panelIds?.[kind];
  if (Array.isArray(arr) && arr[index] != null) return arr[index];
  const prefix = kind === "prateleiras" ? "prateleira" : kind === "portas" ? "porta" : "gaveta";
  return buildId(prefix, index);
}

/** Espessura estrutural padrão 19 mm (spec). */
const getEspessura = (box: BoxModule) => (box.espessura > 0 ? box.espessura : SYSTEM_THICKNESS_MM);
/** Nome do material (CRUD ou legado) para painéis/custos. */
const getNomeMaterial = (box: BoxModule) =>
  getIndustrialMaterial(getMaterialForBox(box, undefined) || "MDF Branco").nome;
/** Profundidade útil (sem costa): profundidade_total - 10 mm. */
const PROFUNDIDADE_UTIL_MM = SYSTEM_BACK_MM;

/** Nomes finais e fixos para exibição (UI, PDF). COSTA sem espessura ao lado do nome. */
export const PIECE_LABELS: Record<string, string> = {
  cima: "Cima",
  fundo: "Fundo",
  lateral_esquerda: "Lateral esquerda",
  lateral_direita: "Lateral direita",
  COSTA: "COSTA",
};
export function getPieceLabel(tipo: string): string {
  return PIECE_LABELS[tipo] ?? tipo;
}

const getDimensoesInternas = (box: BoxModule, espessura: number) => {
  const larguraInterna = clampPositive(Number(box.dimensoes.largura) - espessura * 2);
  const alturaInterna = clampPositive(Number(box.dimensoes.altura) - espessura * 2);
  const profundidadeInterna = clampPositive(Number(box.dimensoes.profundidade) - espessura);
  return { larguraInterna, alturaInterna, profundidadeInterna };
};

export function gerarModeloIndustrial(box: BoxModule, rules: RulesConfig): ModeloIndustrial {
  const paineis = gerarPaineis(box, rules);
  const ferragens = gerarFerragens(box, rules);
  const portas = gerarPortas(box, rules);
  const gavetas = gerarGavetas(box, rules);
  const custoTotalPaineis = paineis.reduce((total, painel) => total + painel.custo, 0);
  const custoTotalFerragens = calcularCustoFerragens(ferragens);
  const custoTotalPortas = portas.reduce((total, porta) => total + porta.custo, 0);
  const custoTotalGavetas = gavetas.reduce((total, gaveta) => total + gaveta.custo, 0);
  return {
    dimensoes: box.dimensoes,
    espessura: getEspessura(box),
    paineis,
    ferragens,
    portas,
    gavetas,
    custoTotalPaineis,
    custoTotalFerragens,
    custoTotalPortas,
    custoTotalGavetas,
    custoTotal: custoTotalPaineis + custoTotalFerragens + custoTotalPortas + custoTotalGavetas,
    cutlist: gerarCutlist(box, rules),
    rules,
  };
}

export function gerarPaineis(box: BoxModule, rules: RulesConfig): PainelIndustrial[] {
  const largura = Number(box.dimensoes.largura) || 0;
  const altura = Number(box.dimensoes.altura) || 0;
  const profundidade = Number(box.dimensoes.profundidade) || 0;
  const espessura = getEspessura(box);
  const folgaPorta = 3;
  const recuoGaveta = 13;

  const paineis: PainelIndustrial[] = [];
  const material = getNomeMaterial(box);

  const espessuraCosta = rules.madeira.espessuraCosta;
  const alturaLateral = rules.madeira.calcularAlturaLaterais
    ? clampPositive(altura - espessura * 2)
    : clampPositive(altura);
  const larguraLateral = clampPositive(profundidade);

  // 3.2 Cima e Fundo: largura total × profundidade total × 19 mm
  paineis.push({
    id: getStructuralPanelId(box, "cima"),
    tipo: "cima",
    largura_mm: clampPositive(largura),
    altura_mm: clampPositive(profundidade),
    espessura_mm: espessura,
    material,
    orientacaoFibra: "horizontal",
    quantidade: 1,
    custo: 0,
  });

  paineis.push({
    id: getStructuralPanelId(box, "fundo"),
    tipo: "fundo",
    largura_mm: clampPositive(largura),
    altura_mm: clampPositive(profundidade),
    espessura_mm: espessura,
    material,
    orientacaoFibra: "horizontal",
    quantidade: 1,
    custo: 0,
  });

  paineis.push({
    id: getStructuralPanelId(box, "lateral_esquerda"),
    tipo: "lateral_esquerda",
    largura_mm: larguraLateral,
    altura_mm: alturaLateral,
    espessura_mm: espessura,
    material,
    orientacaoFibra: "vertical",
    quantidade: 1,
    custo: 0,
  });

  paineis.push({
    id: getStructuralPanelId(box, "lateral_direita"),
    tipo: "lateral_direita",
    largura_mm: larguraLateral,
    altura_mm: alturaLateral,
    espessura_mm: espessura,
    material,
    orientacaoFibra: "vertical",
    quantidade: 1,
    custo: 0,
  });

  paineis.push({
    id: getStructuralPanelId(box, "costa"),
    tipo: "COSTA",
    largura_mm: clampPositive(largura),
    altura_mm: clampPositive(altura),
    espessura_mm: espessuraCosta,
    material,
    orientacaoFibra: "vertical",
    quantidade: 1,
    custo: 0,
  });

  // 3.4 Prateleiras: DENTRO; largura = width − 2 mm, profundidade = depth − 10 mm, espessura 19 mm
  if (box.prateleiras > 0) {
    const larguraPrateleira = clampPositive(largura - 2);
    const profundidadePrateleira = clampPositive(profundidade - PROFUNDIDADE_UTIL_MM);
    const nPrateleiras = Math.max(0, Math.floor(box.prateleiras));
    for (let i = 0; i < nPrateleiras; i++) {
      paineis.push({
        id: getArrayPanelId(box, "prateleiras", i),
        tipo: "prateleira",
        largura_mm: larguraPrateleira,
        altura_mm: profundidadePrateleira,
        espessura_mm: espessura,
        material,
        orientacaoFibra: "horizontal",
        quantidade: 1,
        custo: 0,
      });
    }
  }

  if (box.portaTipo !== "sem_porta") {
    const alturaPorta = clampPositive(altura - folgaPorta);
    if (box.portaTipo === "porta_dupla") {
      const larguraPorta = clampPositive((largura - folgaPorta) / 2);
      for (let i = 0; i < 2; i++) {
        paineis.push({
          id: getArrayPanelId(box, "portas", i),
          tipo: "porta_dupla",
          largura_mm: larguraPorta,
          altura_mm: alturaPorta,
          espessura_mm: espessura,
          material,
          orientacaoFibra: "vertical",
          quantidade: 1,
          custo: 0,
        });
      }
    } else {
      const larguraPorta = clampPositive(largura - folgaPorta);
      paineis.push({
        id: getArrayPanelId(box, "portas", 0),
        tipo: box.portaTipo === "porta_correr" ? "porta_correr" : "porta_simples",
        largura_mm: larguraPorta,
        altura_mm: alturaPorta,
        espessura_mm: espessura,
        material,
        orientacaoFibra: "vertical",
        quantidade: 1,
        custo: 0,
      });
    }
  }

  if (box.gavetas > 0) {
    const larguraGaveta = clampPositive(largura - recuoGaveta * 2);
    const alturaGaveta = clampPositive(box.alturaGaveta);
    const nGavetas = Math.max(0, Math.floor(box.gavetas));
    for (let i = 0; i < nGavetas; i++) {
      paineis.push({
        id: getArrayPanelId(box, "gavetas", i),
        tipo: "gaveta_frente",
        largura_mm: larguraGaveta,
        altura_mm: alturaGaveta,
        espessura_mm: espessura,
        material,
        orientacaoFibra: "horizontal",
        quantidade: 1,
        custo: 0,
      });
    }
  }

  const materialInfo = getIndustrialMaterial(getMaterialForBox(box, undefined) || "MDF Branco");
  return paineis.map((painel) => ({
    ...painel,
    custo: calcularCustoPainel(painel, materialInfo) * painel.quantidade,
  }));
}

export function gerarFerragens(box: BoxModule, rules: RulesConfig): FerragemIndustrial[] {
  const ferragens: FerragemIndustrial[] = [];
  const tabela: Record<string, number> = {
    dobradicas: 2.5,
    corredicas: 19,
    suportes_prateleira: 0.9,
  };
  const addFerragem = (tipo: string, quantidade: number) => {
    if (quantidade <= 0) return;
    ferragens.push({
      id: buildId(tipo, ferragens.length),
      tipo,
      quantidade,
      custo: (tabela[tipo] ?? 0) * quantidade,
    });
  };

  if (box.portaTipo !== "sem_porta") {
    const dobradicas = box.portaTipo === "porta_dupla" ? 4 : 2;
    addFerragem("dobradicas", dobradicas);
  }

  if (box.gavetas > 0) {
    addFerragem("corredicas", Math.max(0, Math.floor(box.gavetas)) * 2);
  }

  if (box.prateleiras > 0) {
    const suportes = rules.prateleiras.suportesPorPrateleira;
    addFerragem("suportes_prateleira", Math.max(0, Math.floor(box.prateleiras)) * suportes);
  }

  return ferragens;
}

export function calcularCustoPainel(painel: PainelIndustrial, material = getMaterial(painel.material)) {
  const area_m2 = (painel.largura_mm / 1000) * (painel.altura_mm / 1000);
  return area_m2 * material.custo_m2;
}

export function calcularCustoFerragens(ferragens: FerragemIndustrial[]) {
  const tabela: Record<string, number> = {
    dobradicas: 2.5,
    corredicas: 19,
    suportes_prateleira: 0.9,
  };
  return ferragens.reduce((total, item) => {
    if (Number.isFinite(item.custo)) {
      return total + item.custo;
    }
    const custoUnitario = tabela[item.tipo] ?? 0;
    return total + custoUnitario * item.quantidade;
  }, 0);
}

export function gerarPortas(box: BoxModule, rules: RulesConfig): PortaIndustrial[] {
  if (box.portaTipo === "sem_porta") return [];
  const espessura = getEspessura(box);
  const folga = 2;
  const tipoPorta: PortaIndustrial["tipo"] = "overlay";
  const { larguraInterna, alturaInterna } = getDimensoesInternas(box, espessura);
  const material = getIndustrialMaterial(getMaterialForBox(box, undefined) || "MDF Branco");
  const larguraBase =
    tipoPorta === "overlay"
      ? larguraInterna + folga * 2
      : larguraInterna - folga * 2;
  const alturaBase =
    tipoPorta === "overlay"
      ? alturaInterna + folga * 2
      : alturaInterna - folga * 2;
  const alturaPorta = clampPositive(alturaBase);
  const larguraPorta = clampPositive(larguraBase);
  const alturaPortaCm = alturaPorta / 10;
  const dobradicas = getNumDobradicas(alturaPortaCm, rules);

  if (box.portaTipo === "porta_dupla") {
    const metade = clampPositive(larguraPorta / 2);
    return [
      {
        id: getArrayPanelId(box, "portas", 0),
        largura_mm: metade,
        altura_mm: alturaPorta,
        espessura_mm: espessura,
        tipo: tipoPorta,
        dobradicas,
        custo: calcularCustoPainel(
          { largura_mm: metade, altura_mm: alturaPorta, material: material.nome } as PainelIndustrial,
          material
        ),
      },
      {
        id: getArrayPanelId(box, "portas", 1),
        largura_mm: metade,
        altura_mm: alturaPorta,
        espessura_mm: espessura,
        tipo: tipoPorta,
        dobradicas,
        custo: calcularCustoPainel(
          { largura_mm: metade, altura_mm: alturaPorta, material: material.nome } as PainelIndustrial,
          material
        ),
      },
    ];
  }

  return [
    {
      id: getArrayPanelId(box, "portas", 0),
      largura_mm: larguraPorta,
      altura_mm: alturaPorta,
      espessura_mm: espessura,
      tipo: box.portaTipo === "porta_correr" ? "overlay" : tipoPorta,
      dobradicas,
      custo: calcularCustoPainel(
        { largura_mm: larguraPorta, altura_mm: alturaPorta, material: material.nome } as PainelIndustrial,
        material
      ),
    },
  ];
}

export function gerarGavetas(box: BoxModule, _rules: RulesConfig): GavetaIndustrial[] {
  if (box.gavetas <= 0) return [];
  const espessura = getEspessura(box);
  const recuoLateral = 13;
  const folga = 2;
  const tipoPorta: "overlay" | "inset" = "overlay";
  const { larguraInterna, alturaInterna } = getDimensoesInternas(box, espessura);
  const material = getIndustrialMaterial(getMaterialForBox(box, undefined) || "MDF Branco");
  const larguraGaveta = clampPositive(larguraInterna - recuoLateral * 2);
  const alturaGaveta = clampPositive(alturaInterna - 40);
  const profundidadeTotal = Number(box.dimensoes.profundidade) || 0;
  const profundidadeGaveta = clampPositive(profundidadeTotal - SYSTEM_BACK_MM);
  const alturaFrente =
    tipoPorta === "overlay"
      ? alturaInterna + folga * 2
      : alturaInterna - folga * 2;

  return Array.from({ length: Math.max(0, Math.floor(box.gavetas)) }).map((_, index) => ({
    id: getArrayPanelId(box, "gavetas", index),
    largura_mm: clampPositive(larguraGaveta),
    altura_mm: clampPositive(alturaGaveta || alturaFrente),
    profundidade_mm: clampPositive(profundidadeGaveta),
    espessura_mm: espessura,
    corrediças: 1,
    custo: calcularCustoPainel(
      {
        largura_mm: clampPositive(larguraGaveta),
        altura_mm: clampPositive(alturaGaveta || alturaFrente),
        material: material.nome,
      } as PainelIndustrial,
      material
    ),
  }));
}

export function gerarCutlist(box: BoxModule, rules: RulesConfig) {
  const paineis = gerarPaineis(box, rules);
  const agrupado = new Map<string, CutlistItemIndustrial>();

  paineis.forEach((painel) => {
    const existente = agrupado.get(painel.tipo);
    const area = painel.largura_mm * painel.altura_mm * painel.quantidade;
    if (existente) {
      existente.quantidade += painel.quantidade;
      existente.areaTotal_mm2 += area;
    } else {
      agrupado.set(painel.tipo, {
        tipo: painel.tipo,
        largura_mm: painel.largura_mm,
        altura_mm: painel.altura_mm,
        espessura_mm: painel.espessura_mm,
        quantidade: painel.quantidade,
        areaTotal_mm2: area,
      });
    }
  });

  const itens = Array.from(agrupado.values());
  const areaTotal_mm2 = itens.reduce((total, item) => total + item.areaTotal_mm2, 0);

  return { itens, areaTotal_mm2 };
}
