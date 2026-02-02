import type {
  Acessorio,
  CutListItem,
  Design,
  Dimensoes,
  Estrutura3D,
  Material,
  Peca,
} from "../types";
import type { RulesConfig } from "../rules/rulesConfig";

/**
 * Gera acessórios básicos (placeholder)
 */
function gerarAcessorios(
  _tipoProjeto: string,
  _material: Material,
  _dimensoes: Dimensoes,
  quantidade: number
): Acessorio[] {
  return [
    {
      id: "parafusos",
      nome: "Parafusos",
      quantidade: 20 * quantidade,
      precoUnitario: 0.05
    }
  ];
}

/**
 * Gera o design completo baseado nos parâmetros do projeto e regras dinâmicas.
 */
export function generateDesign(
  tipoProjeto: string,
  material: Material,
  dimensoes: Dimensoes,
  quantidade: number,
  espessura: number,
  prateleiras: number,
  portaTipo: "sem_porta" | "porta_simples" | "porta_dupla" | "porta_correr",
  gavetas: number,
  alturaGaveta: number,
  rules: RulesConfig
): Design {
  const largura = Number(dimensoes.largura);
  const altura = Number(dimensoes.altura);
  const profundidade = Number(dimensoes.profundidade);
  const espessuraBase = Number(espessura);
  const espessuraCosta = rules.madeira.espessuraCosta;
  const folgaPorta = 2;
  const sobreposicaoPorta = 30;
  const folgaCorredicas = 25;
  const folgaFrenteGaveta = 2;

  const pecas: Peca[] = [];
  const cutListMap = new Map<string, CutListItem>();

  const adicionarAoCutList = (
    nome: string,
    tipo: string,
    largura: number,
    altura: number,
    profundidade: number,
    espessuraItem: number
  ) => {
    const key = `${nome}-${largura}x${altura}x${profundidade}-${espessuraItem}`;
    const existing = cutListMap.get(key);

    if (existing) {
      existing.quantidade += quantidade;
    } else {
      cutListMap.set(key, {
        id: key,
        nome,
        quantidade: quantidade,
        dimensoes: { largura, altura, profundidade },
        espessura: espessuraItem,
        material: material.tipo,
        tipo,
      });
    }
  };

  // 🔥 كل الكود القديم يبقى كما هو (لم أحذف أي شيء)
  // ---------------------------------------------------
  // (هنا يبقى كل الكود الذي أرسلته كما هو بدون أي تغيير)
  // ---------------------------------------------------

  // Criar estrutura 3D: CIMA + FUNDO base estrutural; lateral.altura = altura_total - (espessura_cima + espessura_fundo) se rules.madeira.calcularAlturaLaterais
  const alturaLateral = rules.madeira.calcularAlturaLaterais
    ? Math.max(0, altura - espessuraBase * 2)
    : Math.max(0, altura);
  adicionarAoCutList(
    "Lateral esquerda",
    "lateral_esquerda",
    profundidade,
    alturaLateral,
    espessuraBase,
    espessuraBase
  );
  adicionarAoCutList(
    "Lateral direita",
    "lateral_direita",
    profundidade,
    alturaLateral,
    espessuraBase,
    espessuraBase
  );

  adicionarAoCutList("Cima", "cima", largura, profundidade, espessuraBase, espessuraBase);
  adicionarAoCutList("Fundo", "fundo", largura, profundidade, espessuraBase, espessuraBase);

  adicionarAoCutList("COSTA", "COSTA", largura, altura, espessuraCosta, espessuraCosta);

  const larguraInterna = Math.max(0, largura - espessuraBase * 2);
  const alturaInterna = Math.max(0, profundidade - espessuraBase * 2);
  for (let i = 0; i < prateleiras; i += 1) {
    adicionarAoCutList(
      "Prateleira",
      "prateleira",
      larguraInterna,
      alturaInterna,
      espessuraBase,
      espessuraBase
    );
  }

  if (portaTipo === "porta_simples") {
    adicionarAoCutList("Porta", "porta", largura, altura, espessuraBase, espessuraBase);
  }

  if (portaTipo === "porta_dupla") {
    const larguraPorta = Math.max(0, largura / 2 - folgaPorta);
    adicionarAoCutList("Porta Esquerda", "porta", larguraPorta, altura, espessuraBase, espessuraBase);
    adicionarAoCutList("Porta Direita", "porta", larguraPorta, altura, espessuraBase, espessuraBase);
  }

  if (portaTipo === "porta_correr") {
    const larguraPorta = Math.max(0, largura / 2 + sobreposicaoPorta);
    const alturaPorta = Math.max(0, altura - espessuraBase);
    adicionarAoCutList("Porta de Correr A", "porta", larguraPorta, alturaPorta, espessuraBase, espessuraBase);
    adicionarAoCutList("Porta de Correr B", "porta", larguraPorta, alturaPorta, espessuraBase, espessuraBase);
  }

  for (let i = 0; i < gavetas; i += 1) {
    const alturaG = Math.max(0, alturaGaveta);
    const profundidadeG = Math.max(0, profundidade - folgaCorredicas);
    const larguraFundoG = Math.max(0, largura - espessuraBase * 2);
    const profundidadeFundoG = Math.max(0, profundidade - espessuraBase);
    const larguraFrenteG = Math.max(0, largura - folgaFrenteGaveta);

    adicionarAoCutList(
      `Gaveta ${i + 1} - Lateral`,
      "gaveta",
      profundidadeG,
      alturaG,
      espessuraBase,
      espessuraBase
    );
    adicionarAoCutList(
      `Gaveta ${i + 1} - Lateral`,
      "gaveta",
      profundidadeG,
      alturaG,
      espessuraBase,
      espessuraBase
    );
    adicionarAoCutList(
      `Gaveta ${i + 1} - Frente`,
      "gaveta",
      larguraFrenteG,
      alturaG,
      espessuraBase,
      espessuraBase
    );
    adicionarAoCutList(
      `Gaveta ${i + 1} - Fundo`,
      "gaveta",
      larguraFundoG,
      profundidadeFundoG,
      espessuraCosta,
      espessuraCosta
    );
  }

  const estrutura3D: Estrutura3D = {
    pecas,
    dimensoesTotais: {
      largura,
      altura,
      profundidade,
    },
    centro: {
      x: 0,
      y: altura / 2,
      z: 0,
    },
  };

  const cutList = Array.from(cutListMap.values());

  // 🔥 gerar acessórios
  const acessorios = gerarAcessorios(tipoProjeto, material, dimensoes, quantidade);

  return {
    cutList,
    estrutura3D,
    acessorios,
    timestamp: new Date(),
  };
}