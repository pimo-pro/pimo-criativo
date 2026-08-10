import type { BoxModule } from "../types";
import { getMaterial } from "./materials";
import type { RulesConfig } from "../rules/rulesConfig";
import {
  getDefaultOfficialMaterial,
  resolveCostaMaterialForBox,
  resolveCostaThicknessMm,
  resolveSeparadorMaterialForBox,
} from "../materials/materials.api";
import { getMaterialForBox, getIndustrialMaterial } from "../materials/service";
import { getNumDobradicas } from "../rules/rulesConfig";
import { getPrecoPorMaterial } from "../pricing/pricing";
import { getCentralPricingCached } from "../pricing/centralPricingConfig";
import {
  loadPesPlasticoConfig,
  quantidadePesParaCaixa,
  PARAFUSO_3X30_ID,
  PARAFUSO_3X30_PRECO,
  PARAFUSOS_POR_PE,
} from "../ferragens/pesPlasticoConfig";
import {
  PARAFUSO_4X35_ID,
  PARAFUSO_4X35_PRECO,
  PARAFUSO_5X50_ID,
  PARAFUSO_5X50_PRECO,
  PUXA_8MM_ID,
  PUXA_8MM_PRECO,
  quantidadeParafuso4x35AlturaParaCaixa,
  quantidadeParafuso5x50ParaCaixa,
  quantidadePuxa8mmParaCaixa,
} from "../ferragens/freeagemParafusos";
import {
  CALCO_00_ID,
  CALCO_03_ID,
  countPortasFrenteFixa,
  loadCalcoConfig,
} from "../ferragens/calcoConfig";
import { computeBoxProfundidadeAlvoFromBoxLike } from "../box/boxDepthModel";
import { resolveCostaAtivaForBox } from "../box/backPanelFlags";
import { getProfundidadeInternaUtilMm } from "../box/boxDepthHelpers";
import { isPiBaseCabinetId } from "../../data/moveisUnificados/pi/models";
import { resolveDivisorDimensions, resolveSeparadorDimensions } from "../divSep/dimensions";
import { buildDivSepDrilling } from "../divSep/drilling";
import { countDivSepFerragens } from "../divSep/ferragens";
import {
  boxUsesDivShelfMode,
  countDivShelfPanels,
  resolvePrimaryDivShelfPlacementZone,
  resolveSepOnlyShelfPlacementZone,
  resolveShelfWidthForDivSide,
  resolveShelfWidthForSepOnly,
} from "../divSep/shelfDrilling";
import { gerarFerragensPi, gerarGavetasPi, gerarPaineisPi } from "../../data/moveisUnificados/pi/manufacturing";
import { isCornerFixedFrontModel, gerarPaineisCorner, computeCornerLayoutForBox, resolveCornerDoorGapSettings } from "../cornerCabinet";
import { gerarPaineisCaixaForno, isCaixaFornoBox, computeCaixaFornoLayout } from "../moveis/generators/caixaFornoGenerator";
import {
  assertBoxModuleDimensions,
  assertPanelDimensions,
  assertDoorDimensions,
  resolveIndustrialBoxId,
} from "../industrial/industrialValidation";
import { buildIndustrialPieceId, IndustrialError } from "../industrial/IndustrialError";
import { isIndustrialDoorPanelTipo } from "../doors/industrialDoorPanels";
import { resolveActiveGavetasCount } from "../drawers/drawerModeloAGate";
import { resolveCustoMontagemPorGavetaEur } from "../financeiro/drawerAssemblyCost";
import {
  boxUsesGavetaPortaSep,
  syncGavetaPortaSepBox,
} from "../productModes/gavetaPortaSepLayout";
import { resolveIndustrialPieceLabel } from "../industrialAdmin/industrialModelsRegistry";

type PainelIndustrial = {
  id: string;
  tipo: string;
  largura_mm: number;
  altura_mm: number;
  espessura_mm: number;
  material: string;
  orientacaoFibra: "horizontal" | "vertical" | "none";
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
/** Sem Math.round — preserva .5 mm (ex.: altura DIV com T ímpar, gap 0). */
const clampPositiveExact = (value: number) => Math.max(0, Number(value) || 0);

const buildId = (prefix: string, index: number) => `${prefix}-${index + 1}`;

/** ID estável para painel estrutural (cima, fundo, lateral_esquerda, lateral_direita, costa). */
function getStructuralPanelId(box: BoxModule, kind: "cima" | "fundo" | "lateral_esquerda" | "lateral_direita" | "costa"): string {
  const id = box.panelIds?.[kind];
  if (typeof id === "string") return id;
  const prefix = kind === "lateral_esquerda" ? "lateral-esquerda" : kind === "lateral_direita" ? "lateral-direita" : kind;
  return buildId(prefix, 0);
}

/** ID estável para prateleira/porta/gaveta/divisor/separador por índice. */
function getArrayPanelId(
  box: BoxModule,
  kind: "prateleiras" | "portas" | "gavetas" | "divisores" | "separadores",
  index: number
): string {
  const arr = box.panelIds?.[kind];
  if (Array.isArray(arr) && arr[index] != null) return arr[index];
  const prefix =
    kind === "prateleiras"
      ? "prateleira"
      : kind === "portas"
        ? "porta"
        : kind === "gavetas"
          ? "gaveta"
          : kind === "divisores"
            ? "divisorio"
            : "separador";
  return buildId(prefix, index);
}

/** Espessura do corpo: caixa → material industrial → último recurso sistema. */
const getEspessura = (box: BoxModule) => {
  const fromBox = Number(box.espessura);
  if (fromBox > 0) return fromBox;
  const mid = getMaterialForBox(box, undefined);
  const eMat = Number(getIndustrialMaterial(mid || "mdf_branco").espessuraPadrao);
  if (Number.isFinite(eMat) && eMat > 0) return eMat;
  return getDefaultOfficialMaterial().industrialDefaults!.espessuraPadrao;
};
/** Nome do material (CRUD ou legado) para painéis/custos. */
const getNomeMaterial = (box: BoxModule) =>
  getIndustrialMaterial(getMaterialForBox(box, undefined) || "mdf_branco").nome;
/** Nomes finais e fixos para exibição (UI, PDF). COSTA sem espessura ao lado do nome. Gavetas e prateleira: docs/matriz-faces-A-B-FINAL.md. */
export const PIECE_LABELS: Record<string, string> = {
  cima: "Cima",
  fundo: "Fundo",
  lateral_esquerda: "Lateral esquerda",
  lateral_direita: "Lateral direita",
  COSTA: "COSTA",
  prateleira: "Prateleira",
  divisorio: "Divisório",
  separador: "Separador",
  porta_inferior: "Porta inferior",
  porta_superior: "Porta superior",
  costa_superior: "Costa superior",
  gaveta_frente: "Gaveta frente",
  gaveta_lat_esq: "Gaveta lateral esquerda",
  gaveta_lat_dir: "Gaveta lateral direita",
  gaveta_fundo: "Gaveta fundo",
  gaveta_traseira: "Gaveta traseira",
  frente_fixa: "Frente fixa",
  cx_gav_lat_dir: "CX GAV lateral direita",
  cx_gav_lat_esq: "CX GAV lateral esquerda",
  cx_gav_fun: "CX GAV fundo",
  cx_gav_cima: "CX GAV cima",
  a1_cx_lat_dir: "A1 lateral direita",
  a1_cx_lat_esq: "A1 lateral esquerda",
  a1_cx_cima: "A1 cima",
  a1_cx_fundo: "A1 fundo",
  a1_cx_comp_40: "A1 compensador 40 mm",
};
export function getPieceLabel(tipo: string): string {
  return resolveIndustrialPieceLabel(tipo) ?? PIECE_LABELS[tipo] ?? tipo;
}

/** L/A internas inalteradas; P útil = modelo FASE 1 com `profundidadeExterna` (FASE 2). */
const getDimensoesInternas = (box: BoxModule, espessura: number, _rules: RulesConfig) => {
  const larguraInterna = clampPositive(Number(box.dimensoes.largura) - espessura * 2);
  const alturaInterna = clampPositive(Number(box.dimensoes.altura) - espessura * 2);
  const profundidadeExternaMm = Number(box.profundidadeExterna ?? box.dimensoes.profundidade) || 0;
  const espessuraCostaMm = resolveCostaThicknessMm(box);
  const profundidadeInterna = clampPositive(
    computeBoxProfundidadeAlvoFromBoxLike(
      {
        dimensoes: { profundidade: profundidadeExternaMm },
        espessura: box.espessura,
        portaTipo: box.portaTipo,
        doorsLayer: box.doorsLayer,
        drawersLayer: box.drawersLayer,
        gavetas: box.gavetas,
        costaAtiva: box.costaAtiva,
      },
      espessuraCostaMm
    ).profundidadeInternaUtilMm
  );
  return { larguraInterna, alturaInterna, profundidadeInterna };
};

export function gerarModeloIndustrial(box: BoxModule, rules: RulesConfig): ModeloIndustrial {
  const paineis = gerarPaineis(box, rules);
  const ferragens = gerarFerragens(box, rules);
  const portasRaw = gerarPortas(box, rules);
  const gavetas = gerarGavetas(box, rules);

  // Fase 1: material das portas de módulo em Painéis (1×). Linha Portas = €0 (divisão futura).
  // Fase 2: madeira de gaveta em Painéis (cutlist); custoTotalGavetas = N × montagem/gaveta.
  const paineisPorta = paineis.filter((painel) => isIndustrialDoorPanelTipo(painel.tipo));
  const portas = portasRaw.map((porta, index) => ({
    ...porta,
    custo: paineisPorta[index]?.custo ?? 0,
  }));
  const montagemPorGavetaEur = resolveCustoMontagemPorGavetaEur();
  const gavetasCount = Math.max(resolveActiveGavetasCount(box), gavetas.length);
  const gavetasPriced =
    gavetas.length > 0
      ? gavetas.map((gaveta) => ({ ...gaveta, custo: montagemPorGavetaEur }))
      : gavetas;
  const custoTotalPaineis = paineis.reduce((total, painel) => total + painel.custo, 0);
  const custoTotalFerragens = calcularCustoFerragens(ferragens);
  const custoTotalPortas = 0;
  const custoTotalGavetas = Math.round(gavetasCount * montagemPorGavetaEur * 100) / 100;
  return {
    dimensoes: box.dimensoes,
    espessura: getEspessura(box),
    paineis,
    ferragens,
    portas,
    gavetas: gavetasPriced,
    custoTotalPaineis,
    custoTotalFerragens,
    custoTotalPortas,
    custoTotalGavetas,
    custoTotal: custoTotalPaineis + custoTotalFerragens + custoTotalPortas + custoTotalGavetas,
    cutlist: gerarCutlist(box, rules),
    rules,
  };
}

export function gerarPaineis(boxInput: BoxModule, rules: RulesConfig): PainelIndustrial[] {
  if (isCaixaFornoBox(boxInput)) {
    const bodyMaterialId = getMaterialForBox(boxInput, undefined) || "mdf_branco";
    const materialInfo = getIndustrialMaterial(bodyMaterialId);
    const costaMaterial = resolveCostaMaterialForBox(boxInput, bodyMaterialId);
    const costaMaterialInfo = getIndustrialMaterial(costaMaterial.materialId);
    const separadorMaterial = resolveSeparadorMaterialForBox(boxInput, bodyMaterialId);
    const separadorMaterialInfo = getIndustrialMaterial(separadorMaterial.materialId);
    return gerarPaineisCaixaForno(boxInput).map((painel) => ({
      ...painel,
      custo:
        calcularCustoPainel(
          painel,
          painel.tipo === "costa_superior"
            ? costaMaterialInfo
            : painel.tipo === "separador"
              ? separadorMaterialInfo
              : materialInfo
        ) * painel.quantidade,
    }));
  }
  if (isCornerFixedFrontModel(boxInput.baseCabinetId)) {
    return gerarPaineisCorner(boxInput, rules);
  }
  if (isPiBaseCabinetId(boxInput.baseCabinetId)) {
    const materialInfo = getIndustrialMaterial(getMaterialForBox(boxInput, undefined) || "mdf_branco");
    return gerarPaineisPi(boxInput).map((painel) => ({
      ...painel,
      custo: calcularCustoPainel(painel, materialInfo) * painel.quantidade,
    }));
  }

  // Fase B: injecta SEP intermédio sem alterar o path clássico.
  const box = boxUsesGavetaPortaSep(boxInput) ? syncGavetaPortaSepBox(boxInput) : boxInput;

  assertBoxModuleDimensions(box);

  const largura = Number(box.dimensoes.largura) || 0;
  const altura = Number(box.dimensoes.altura) || 0;
  const profundidadeExterna = Number(box.profundidadeExterna ?? box.dimensoes.profundidade) || 0;
  const espessuraCostaMm = resolveCostaThicknessMm(box);
  const profundidadeInterna = clampPositive(
    getProfundidadeInternaUtilMm(
      {
        dimensoes: { profundidade: profundidadeExterna },
        espessura: box.espessura,
        portaTipo: box.portaTipo,
        doorsLayer: box.doorsLayer,
        drawersLayer: box.drawersLayer,
        gavetas: box.gavetas,
        costaAtiva: box.costaAtiva,
      },
      espessuraCostaMm
    )
  );
  const espessura = getEspessura(box);
  const folgaPorta = 3;

  const paineis: PainelIndustrial[] = [];
  const material = getNomeMaterial(box);
  const bodyMaterialId = getMaterialForBox(box, undefined) || "mdf_branco";
  const costaMaterial = resolveCostaMaterialForBox(box, bodyMaterialId);
  const separadorMaterial = resolveSeparadorMaterialForBox(box, bodyMaterialId);
  const alturaLateral = rules.madeira.calcularAlturaLaterais
    ? clampPositive(altura - espessura * 2)
    : clampPositive(altura);
  const larguraLateral = profundidadeInterna;
  /** P útil em profundidade: externa − costa (se ativa) − porta ou frente de gaveta. */
  const profundidadeUtil = profundidadeInterna;

  if (profundidadeInterna <= 0) {
    const boxId = resolveIndustrialBoxId(box);
    throw IndustrialError.invalidMeasure({
      boxId,
      pieceId: buildIndustrialPieceId(boxId, "PROFUNDIDADE"),
      detail: `Profundidade útil interna inválida (${profundidadeInterna} mm).`,
      costaApplicable: resolveCostaAtivaForBox(box),
    });
  }

  // 3.2 Cima e Fundo: largura total × profundidade útil (alinhada às laterais) × espessura do corpo
  const cimaId = getStructuralPanelId(box, "cima");
  assertPanelDimensions(box, cimaId, "cima", largura, profundidadeUtil, espessura);
  paineis.push({
    id: cimaId,
    tipo: "cima",
    largura_mm: clampPositive(largura),
    altura_mm: clampPositive(profundidadeUtil),
    espessura_mm: espessura,
    material,
    orientacaoFibra: "none",
    quantidade: 1,
    custo: 0,
  });

  paineis.push({
    id: getStructuralPanelId(box, "fundo"),
    tipo: "fundo",
    largura_mm: clampPositive(largura),
    altura_mm: clampPositive(profundidadeUtil),
    espessura_mm: espessura,
    material,
    orientacaoFibra: "none",
    quantidade: 1,
    custo: 0,
  });

  assertPanelDimensions(box, getStructuralPanelId(box, "lateral_esquerda"), "lateral_esquerda", larguraLateral, alturaLateral, espessura);

  paineis.push({
    id: getStructuralPanelId(box, "lateral_esquerda"),
    tipo: "lateral_esquerda",
    largura_mm: larguraLateral,
    altura_mm: alturaLateral,
    espessura_mm: espessura,
    material,
    orientacaoFibra: "none",
    quantidade: 1,
    custo: 0,
  });

  assertPanelDimensions(box, getStructuralPanelId(box, "lateral_direita"), "lateral_direita", larguraLateral, alturaLateral, espessura);

  paineis.push({
    id: getStructuralPanelId(box, "lateral_direita"),
    tipo: "lateral_direita",
    largura_mm: larguraLateral,
    altura_mm: alturaLateral,
    espessura_mm: espessura,
    material,
    orientacaoFibra: "none",
    quantidade: 1,
    custo: 0,
  });

  if (resolveCostaAtivaForBox(box)) {
    const costaId = getStructuralPanelId(box, "costa");
    assertPanelDimensions(box, costaId, "COSTA", largura, altura, costaMaterial.thicknessMm);
    paineis.push({
      id: costaId,
      tipo: "COSTA",
      largura_mm: clampPositive(largura),
      altura_mm: clampPositive(altura),
      espessura_mm: costaMaterial.thicknessMm,
      material: costaMaterial.label,
      orientacaoFibra: "vertical",
      quantidade: 1,
      custo: 0,
    });
  }

  // 3.4 Prateleiras: largura com folgas; profundidade = profundidade útil interna − 5 mm (folga frontal).
  if (box.prateleiras > 0) {
    const profundidadePrateleira = clampPositive(profundidadeInterna - 5);
    const nPrateleiras = Math.max(0, Math.floor(box.prateleiras));
    if (boxUsesDivShelfMode(box)) {
      const divisores = box.divisores ?? [];
      let shelfIndex = 0;
      if (divisores.length === 0) {
        const larguraPrateleira = clampPositive(resolveShelfWidthForSepOnly(box));
        if (resolveSepOnlyShelfPlacementZone(box) != null) {
          for (let i = 0; i < nPrateleiras; i++) {
            const prateleiraId = getArrayPanelId(box, "prateleiras", shelfIndex);
            assertPanelDimensions(box, prateleiraId, "prateleira", larguraPrateleira, profundidadePrateleira, espessura);
            paineis.push({
              id: prateleiraId,
              tipo: "prateleira",
              largura_mm: larguraPrateleira,
              altura_mm: profundidadePrateleira,
              espessura_mm: espessura,
              material,
              orientacaoFibra: "none",
              quantidade: 1,
              custo: 0,
            });
            shelfIndex += 1;
          }
        }
      } else {
        for (const div of divisores) {
          const larguraPrateleira = clampPositive(resolveShelfWidthForDivSide(box, div));
          // Exactamente N peças por DIV no compartimento LAT+DIV+SEP (nunca × zonas / acima do SEP).
          if (resolvePrimaryDivShelfPlacementZone(box, div) == null) continue;
          for (let i = 0; i < nPrateleiras; i++) {
            const prateleiraId = getArrayPanelId(box, "prateleiras", shelfIndex);
            assertPanelDimensions(box, prateleiraId, "prateleira", larguraPrateleira, profundidadePrateleira, espessura);
            paineis.push({
              id: prateleiraId,
              tipo: "prateleira",
              largura_mm: larguraPrateleira,
              altura_mm: profundidadePrateleira,
              espessura_mm: espessura,
              material,
              orientacaoFibra: "none",
              quantidade: 1,
              custo: 0,
            });
            shelfIndex += 1;
          }
        }
      }
    } else {
      const larguraPrateleira = clampPositive(largura - espessura * 2 - 2);
      for (let i = 0; i < nPrateleiras; i++) {
        const prateleiraId = getArrayPanelId(box, "prateleiras", i);
        assertPanelDimensions(box, prateleiraId, "prateleira", larguraPrateleira, profundidadePrateleira, espessura);
        paineis.push({
          id: prateleiraId,
          tipo: "prateleira",
          largura_mm: larguraPrateleira,
          altura_mm: profundidadePrateleira,
          espessura_mm: espessura,
          material,
          orientacaoFibra: "none",
          quantidade: 1,
          custo: 0,
        });
      }
    }
  }

  // Divisórios verticais (DIV)
  const divisores = box.divisores ?? [];
  for (let i = 0; i < divisores.length; i++) {
    const item = divisores[i]!;
    const dims = resolveDivisorDimensions(box, item);
    paineis.push({
      id: getArrayPanelId(box, "divisores", i),
      tipo: "divisorio",
      largura_mm: clampPositive(dims.profundidadeMm),
      // Altura exacta (rosto a rosto): não arredondar — T=19 → 1990.5, não 1991.
      altura_mm: clampPositiveExact(dims.alturaMm),
      espessura_mm: clampPositive(dims.larguraMm),
      material,
      orientacaoFibra: "vertical",
      quantidade: 1,
      custo: 0,
    });
  }

  // Separadores horizontais (SEP)
  const separadores = box.separadores ?? [];
  for (let i = 0; i < separadores.length; i++) {
    const item = separadores[i]!;
    const dims = resolveSeparadorDimensions(box, item);
    paineis.push({
      id: getArrayPanelId(box, "separadores", i),
      tipo: "separador",
      largura_mm: clampPositive(dims.larguraMm),
      altura_mm: clampPositive(dims.profundidadeMm),
      espessura_mm: clampPositive(dims.alturaMm),
      material: separadorMaterial.label,
      orientacaoFibra: "none",
      quantidade: 1,
      custo: 0,
    });
  }

  if (box.portaTipo !== "sem_porta") {
    const doorsLayer = box.doorsLayer ?? [];
    const hasCompleteDoorLayers =
      doorsLayer.length > 0 &&
      doorsLayer.every((door) => Number(door.width) > 0 && Number(door.height) > 0);
    if (hasCompleteDoorLayers) {
      doorsLayer.forEach((door, index) => {
        const tipoPainel =
          box.portaTipo === "porta_dupla"
            ? "porta_dupla"
            : box.portaTipo === "porta_correr"
              ? "porta_correr"
              : "porta_simples";
        const larguraPorta = clampPositive(Number(door.width) || 0);
        const alturaPorta = clampPositive(Number(door.height) || 0);
        const espessuraPorta = clampPositive(Number(door.thickness) || espessura);
        assertDoorDimensions(box, index, larguraPorta, alturaPorta, espessuraPorta);
        paineis.push({
          id: getArrayPanelId(box, "portas", index),
          tipo: tipoPainel,
          largura_mm: larguraPorta,
          altura_mm: alturaPorta,
          espessura_mm: espessuraPorta,
          material,
          orientacaoFibra: "vertical",
          quantidade: 1,
          custo: 0,
        });
      });
    } else {
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
  }

  // FASE 6: frentes de gaveta via drawersLayer + drawerCutlistAdapter (não gerar gaveta_frente legado).

  const materialInfo = getIndustrialMaterial(bodyMaterialId);
  const costaMaterialInfo = getIndustrialMaterial(costaMaterial.materialId);
  const separadorMaterialInfo = getIndustrialMaterial(separadorMaterial.materialId);
  return paineis.map((painel) => ({
    ...painel,
    custo:
      calcularCustoPainel(
        painel,
        painel.tipo === "COSTA"
          ? costaMaterialInfo
          : painel.tipo === "separador"
            ? separadorMaterialInfo
            : materialInfo
      ) * painel.quantidade,
  }));
}

export function gerarFerragens(box: BoxModule, rules: RulesConfig): FerragemIndustrial[] {
  const appendFreeagemPorCaixa = (list: FerragemIndustrial[]): FerragemIndustrial[] => {
    const out = [...list];
    const push = (tipo: string, quantidade: number, unit: number) => {
      if (quantidade <= 0) return;
      out.push({
        id: buildId(tipo, out.length),
        tipo,
        quantidade,
        custo: unit * quantidade,
      });
    };
    // Freeagem por caixa (altura 4×35; 5×50 + puxa). Juntas/remates = project-level.
    push(PARAFUSO_4X35_ID, quantidadeParafuso4x35AlturaParaCaixa(box), PARAFUSO_4X35_PRECO);
    const qty5 = quantidadeParafuso5x50ParaCaixa(box);
    push(PARAFUSO_5X50_ID, qty5, PARAFUSO_5X50_PRECO);
    push(PUXA_8MM_ID, quantidadePuxa8mmParaCaixa(box), PUXA_8MM_PRECO);
    return out;
  };

  if (isPiBaseCabinetId(box.baseCabinetId)) {
    const peCfg = loadPesPlasticoConfig();
    const peQty = quantidadePesParaCaixa(box, rules);
    let base = gerarFerragensPi(box, rules);
    if (peCfg.ativo && peQty > 0) {
      base = [
        ...base,
        {
          id: buildId("pe_plastico", base.length),
          tipo: "pe_plastico",
          quantidade: peQty,
          custo: peCfg.precoUnitario * peQty,
        },
      ];
      // Freeagem: Parafuso 3×30 = pés × 4 — só custo/BOM, sem furos/CNC.
      const parafQty = peQty * PARAFUSOS_POR_PE;
      base = [
        ...base,
        {
          id: buildId(PARAFUSO_3X30_ID, base.length),
          tipo: PARAFUSO_3X30_ID,
          quantidade: parafQty,
          custo: PARAFUSO_3X30_PRECO * parafQty,
        },
      ];
    }
    return appendFreeagemPorCaixa(base);
  }

  const ferragens: FerragemIndustrial[] = [];
  const peCfg = loadPesPlasticoConfig();
  const calcoCfg = loadCalcoConfig();
  const tabela = ferragensUnitPriceTable(peCfg.precoUnitario, calcoCfg);
  const addFerragem = (tipo: string, quantidade: number) => {
    if (quantidade <= 0) return;
    ferragens.push({
      id: buildId(tipo, ferragens.length),
      tipo,
      quantidade,
      custo: (tabela[tipo] ?? 0) * quantidade,
    });
  };

  if (isCaixaFornoBox(box)) {
    const doorsLayer = box.doorsLayer ?? [];
    const totalDobradicas = countDobradicasForBox(box, doorsLayer, rules);
    addFerragem("dobradicas", totalDobradicas);
    if (calcoCfg.refs["00"].ativo) {
      addFerragem(CALCO_00_ID, totalDobradicas);
    }
    if (calcoCfg.refs["03"].ativo) {
      addFerragem(CALCO_03_ID, countPortasFrenteFixa(box));
    }
    if (peCfg.ativo) {
      const peQty = quantidadePesParaCaixa(box, rules);
      addFerragem("pe_plastico", peQty);
      // Freeagem: Parafuso 3×30 = pés × 4 — só custo/BOM, sem furos/CNC.
      addFerragem(PARAFUSO_3X30_ID, peQty * PARAFUSOS_POR_PE);
    }
    return appendFreeagemPorCaixa(ferragens);
  }

  if (box.portaTipo !== "sem_porta") {
    const doorsLayer = box.doorsLayer ?? [];
    // Soft-close: porta dupla = 2 por folha (4 no total), nunca 8.
    const dobradicas = countDobradicasForBox(box, doorsLayer, rules);
    addFerragem("dobradicas", dobradicas);
    if (calcoCfg.refs["00"].ativo) {
      addFerragem(CALCO_00_ID, dobradicas);
    }
  }
  if (calcoCfg.refs["03"].ativo) {
    addFerragem(CALCO_03_ID, countPortasFrenteFixa(box));
  }

  // Corrediças só com gavetas reais (drawersLayer). Não usar box.gavetas sozinho.
  const drawerCount = box.drawersLayer?.length ?? 0;
  if (drawerCount > 0) {
    addFerragem("corredicas", drawerCount * 2);
  }

  if (box.prateleiras > 0) {
    const suportes = rules.prateleiras.suportesPorPrateleira;
    const shelfCount = boxUsesDivShelfMode(box)
      ? countDivShelfPanels(box)
      : Math.max(0, Math.floor(box.prateleiras));
    addFerragem("suportes_prateleira", shelfCount * suportes);
  }

  if ((box.divisores?.length ?? 0) > 0 || (box.separadores?.length ?? 0) > 0) {
    const divSepDrilling = buildDivSepDrilling(box, box.panelIds);
    const { cavilhas10, parafusos4x50 } = countDivSepFerragens(box, divSepDrilling);
    addFerragem("cavilha_10mm", cavilhas10);
    addFerragem("parafuso_4x50", parafusos4x50);
  }

  if (peCfg.ativo) {
    const peQty = quantidadePesParaCaixa(box, rules);
    addFerragem("pe_plastico", peQty);
    // Freeagem: Parafuso 3×30 = pés × 4 — só custo/BOM, sem furos/CNC.
    addFerragem(PARAFUSO_3X30_ID, peQty * PARAFUSOS_POR_PE);
  }

  return appendFreeagemPorCaixa(ferragens);
}

/**
 * Consumo = área real da peça × €/m² (pricing.json / central).
 * Costa ≤10 mm → MDF 10 mm (20 €/m²). Sem fallback de chapa inteira.
 */
export function calcularCustoPainel(painel: PainelIndustrial, material = getMaterial(painel.material)) {
  const area_m2 = (painel.largura_mm / 1000) * (painel.altura_mm / 1000);
  const esp =
    Number(painel.espessura_mm) ||
    Number(material?.espessuraPadrao) ||
    19;
  const key = material?.id || material?.nome || painel.material || "";
  return area_m2 * getPrecoPorMaterial(String(key), esp);
}

function ferragensUnitPriceTable(
  peUnit: number,
  calcoCfg: ReturnType<typeof loadCalcoConfig>
): Record<string, number> {
  const f = getCentralPricingCached().ferragens ?? {};
  const dob =
    typeof f.dobradica_soft_close === "number" && Number.isFinite(f.dobradica_soft_close)
      ? f.dobradica_soft_close
      : 2.5;
  const suporte =
    typeof f.suporte_prateleira === "number" && Number.isFinite(f.suporte_prateleira)
      ? f.suporte_prateleira
      : 0.15;
  const corredica =
    typeof f.corredica_soft_close === "number" && Number.isFinite(f.corredica_soft_close)
      ? f.corredica_soft_close
      : typeof f.corredica_telescopica === "number" && Number.isFinite(f.corredica_telescopica)
        ? f.corredica_telescopica
        : 7.5;
  return {
    // Soft-close: pricing.json; fallback 2.5 se ausente.
    dobradicas: dob > 0 ? dob : 2.5,
    // Par de corrediças = 2× unitário; tipo "corredicas" cobra por unidade (par=2).
    corredicas: corredica,
    suportes_prateleira: suporte,
    cavilha_10mm: 0.12,
    parafuso_4x50: typeof f.parafuso === "number" ? f.parafuso : 0.15,
    pe_plastico: peUnit,
    [PARAFUSO_3X30_ID]: PARAFUSO_3X30_PRECO,
    [PARAFUSO_4X35_ID]: PARAFUSO_4X35_PRECO,
    [PARAFUSO_5X50_ID]: PARAFUSO_5X50_PRECO,
    [PUXA_8MM_ID]: PUXA_8MM_PRECO,
    [CALCO_00_ID]: calcoCfg.refs["00"].precoUnitario,
    [CALCO_03_ID]: calcoCfg.refs["03"].precoUnitario,
  };
}

/** Porta dupla: máx. 2 dobradiças por folha (4 no total). */
function countDobradicasForBox(
  box: BoxModule,
  doorsLayer: { height?: number }[],
  rules: RulesConfig
): number {
  if (doorsLayer.length > 0) {
    return doorsLayer.reduce((sum, door) => {
      const n = getNumDobradicas(Math.max(0, Number(door.height) || 0), rules);
      if (box.portaTipo === "porta_dupla") return sum + Math.min(2, n);
      return sum + n;
    }, 0);
  }
  return box.portaTipo === "porta_dupla" ? 4 : 2;
}

export function calcularCustoFerragens(ferragens: FerragemIndustrial[]) {
  const peCfg = loadPesPlasticoConfig();
  const calcoCfg = loadCalcoConfig();
  const tabela = ferragensUnitPriceTable(peCfg.precoUnitario, calcoCfg);
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

  if (isCaixaFornoBox(box)) {
    const layout = computeCaixaFornoLayout(box);
    const espessura = getEspessura(box);
    const material = getIndustrialMaterial(getMaterialForBox(box, undefined) || "mdf_branco");
    const portasSpec = [
      { index: 0, altura_mm: layout.portaInferiorAlturaMm, largura_mm: layout.larguraUtilPortaMm },
      { index: 1, altura_mm: layout.portaSuperiorAlturaMm, largura_mm: layout.larguraUtilPortaMm },
    ];
    return portasSpec.map(({ index, altura_mm, largura_mm }) => ({
      id: getArrayPanelId(box, "portas", index),
      largura_mm,
      altura_mm,
      espessura_mm: espessura,
      tipo: "overlay" as const,
      dobradicas: getNumDobradicas(altura_mm, rules),
      custo: calcularCustoPainel(
        { largura_mm, altura_mm, material: material.nome } as PainelIndustrial,
        material
      ),
    }));
  }

  if (isCornerFixedFrontModel(box.baseCabinetId) && box.portaTipo === "porta_simples") {
    const layout = computeCornerLayoutForBox(box, resolveCornerDoorGapSettings());
    if (!layout) return [];
    const espessura = getEspessura(box);
    const material = getIndustrialMaterial(getMaterialForBox(box, undefined) || "mdf_branco");
    const altura_mm = clampPositive(layout.doorHeightMm);
    const largura_mm = clampPositive(layout.doorWidthMm);
    assertDoorDimensions(box, 0, largura_mm, altura_mm, espessura);
    return [
      {
        id: getArrayPanelId(box, "portas", 0),
        largura_mm,
        altura_mm,
        espessura_mm: espessura,
        tipo: "overlay" as const,
        dobradicas: getNumDobradicas(altura_mm, rules),
        custo: calcularCustoPainel(
          { largura_mm, altura_mm, material: material.nome } as PainelIndustrial,
          material
        ),
      },
    ];
  }

  const espessura = getEspessura(box);
  const folga = 2;
  const tipoPorta: PortaIndustrial["tipo"] = "overlay";
  const { larguraInterna, alturaInterna } = getDimensoesInternas(box, espessura, rules);
  const material = getIndustrialMaterial(getMaterialForBox(box, undefined) || "mdf_branco");
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
  assertDoorDimensions(box, 0, larguraPorta, alturaPorta, espessura);
  const dobradicas = getNumDobradicas(alturaPorta, rules);

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

/**
 * @deprecated FASE 6 — usar `drawersLayer` + `drawerCutlistAdapter`. Mantido apenas para módulos PI.
 * Caixas com pipeline moderno não devem depender deste resumo.
 */
export function gerarGavetas(box: BoxModule, _rules: RulesConfig): GavetaIndustrial[] {
  if (isPiBaseCabinetId(box.baseCabinetId)) {
    const material = getIndustrialMaterial(getMaterialForBox(box, undefined) || "mdf_branco");
    return gerarGavetasPi(box).map((gaveta) => ({
      ...gaveta,
      custo: calcularCustoPainel(
        {
          largura_mm: gaveta.largura_mm,
          altura_mm: gaveta.altura_mm,
          material: material.nome,
        } as PainelIndustrial,
        material
      ),
    }));
  }

  return [];
}

/** @deprecated FASE 6 — shim vazio; ver `gerarGavetas`. */
export function gerarGavetasLegado(_box: BoxModule, _rules: RulesConfig): GavetaIndustrial[] {
  return [];
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
