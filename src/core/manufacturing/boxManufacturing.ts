import type { BoxModule } from "../types";
import { getMaterial } from "./materials";
import type { RulesConfig } from "../rules/rulesConfig";
import { getNumDobradicas } from "../rules/rulesConfig";

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

const getEspessura = (box: BoxModule) => (box.espessura > 0 ? box.espessura : 18);
const getNomeMaterial = (box: BoxModule) => box.material ?? "MDF Branco";

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
  const folgaPrateleira = 2;
  const folgaPorta = 3;
  const recuoGaveta = 13;

  const paineis: PainelIndustrial[] = [];
  const material = getNomeMaterial(box);

  const espessuraCosta = rules.madeira.espessuraCosta;
  const larguraCimaFundo = clampPositive(largura - espessura * 2);
  const alturaLateral = rules.madeira.calcularAlturaLaterais
    ? clampPositive(altura - espessura * 2)
    : clampPositive(altura);
  const larguraLateral = clampPositive(profundidade);

  paineis.push({
    id: buildId("cima", paineis.length),
    tipo: "cima",
    largura_mm: larguraCimaFundo,
    altura_mm: clampPositive(profundidade),
    espessura_mm: espessura,
    material,
    orientacaoFibra: "horizontal",
    quantidade: 1,
    custo: 0,
  });

  paineis.push({
    id: buildId("fundo", paineis.length),
    tipo: "fundo",
    largura_mm: larguraCimaFundo,
    altura_mm: clampPositive(profundidade),
    espessura_mm: espessura,
    material,
    orientacaoFibra: "horizontal",
    quantidade: 1,
    custo: 0,
  });

  paineis.push({
    id: buildId("lateral-esquerda", paineis.length),
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
    id: buildId("lateral-direita", paineis.length),
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
    id: buildId("costa", paineis.length),
    tipo: "COSTA",
    largura_mm: clampPositive(largura),
    altura_mm: clampPositive(altura),
    espessura_mm: espessuraCosta,
    material,
    orientacaoFibra: "vertical",
    quantidade: 1,
    custo: 0,
  });

  if (box.prateleiras > 0) {
    const larguraPrateleira = clampPositive(largura - espessura * 2 - folgaPrateleira);
    const alturaPrateleira = clampPositive(profundidade - folgaPrateleira);
    paineis.push({
      id: buildId("prateleira", paineis.length),
      tipo: "prateleira",
      largura_mm: larguraPrateleira,
      altura_mm: alturaPrateleira,
      espessura_mm: espessura,
      material,
      orientacaoFibra: "horizontal",
      quantidade: Math.max(0, Math.floor(box.prateleiras)),
      custo: 0,
    });
  }

  if (box.portaTipo !== "sem_porta") {
    const alturaPorta = clampPositive(altura - folgaPorta);
    if (box.portaTipo === "porta_dupla") {
      const larguraPorta = clampPositive((largura - folgaPorta) / 2);
      paineis.push({
        id: buildId("porta", paineis.length),
        tipo: "porta_dupla",
        largura_mm: larguraPorta,
        altura_mm: alturaPorta,
        espessura_mm: espessura,
        material,
        orientacaoFibra: "vertical",
        quantidade: 2,
        custo: 0,
      });
    } else {
      const larguraPorta = clampPositive(largura - folgaPorta);
      paineis.push({
        id: buildId("porta", paineis.length),
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
    paineis.push({
      id: buildId("gaveta-frente", paineis.length),
      tipo: "gaveta_frente",
      largura_mm: larguraGaveta,
      altura_mm: alturaGaveta,
      espessura_mm: espessura,
      material,
      orientacaoFibra: "horizontal",
      quantidade: Math.max(0, Math.floor(box.gavetas)),
      custo: 0,
    });
  }

  const materialInfo = getMaterial(material);
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
  const material = getMaterial(getNomeMaterial(box));
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
        id: buildId("porta", 0),
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
        id: buildId("porta", 1),
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
      id: buildId("porta", 0),
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
  const { larguraInterna, alturaInterna, profundidadeInterna } = getDimensoesInternas(
    box,
    espessura
  );
  const material = getMaterial(getNomeMaterial(box));
  const larguraGaveta = clampPositive(larguraInterna - recuoLateral * 2);
  const alturaGaveta = clampPositive(alturaInterna - 40);
  const profundidadeGaveta = clampPositive(profundidadeInterna - 20);
  const alturaFrente =
    tipoPorta === "overlay"
      ? alturaInterna + folga * 2
      : alturaInterna - folga * 2;

  return Array.from({ length: Math.max(0, Math.floor(box.gavetas)) }).map((_, index) => ({
    id: buildId("gaveta", index),
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
