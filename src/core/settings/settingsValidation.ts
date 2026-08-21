/**
 * Validação e normalização de configurações globais.
 */

import { PI_MODEL_DEFAULT_SETTINGS, clampPiNumeroGavetas } from "../../data/moveisUnificados/pi/settings";
import { sanitizeOrlaRulesInput } from "../../3d/viewer-engine/orla/orlaVisualRules";
import { SETTINGS_SCHEMA_VERSION, settingsDefaults, type SettingsSchema } from "./settingsSchema";
import { clamp, deepMergeSettings, normalizeDepths, toNumber, type ValidationResult } from "./settingsMerge";
import { isOrcamentosDay1IndustrialStub, normalizeOrcamentosSettings } from "../orcamentos";
import { normalizeFinanceiroAdminSettings } from "../financeiro/financeiroAdminRules";
import { FINANCEIRO_IVA_DEFAULT_PCT } from "../financeiro/financeiroUnificadoTypes";
import { orcamentosDefaultsFromCentral } from "../pricing/centralPricingConfig";

/**
 * Restrição industrial temporária: apenas estes tipos são aceites na
 * normalização de settings globais — qualquer outro valor (legado ou "EM BREVE")
 * é silenciosamente substituído pelo default via pickOption (sem erro/crash).
 * Ver drawerUiConstants.ts para a mesma restrição espelhada na UI.
 */
const DRAWER_SLIDE_TYPES = [
  "Hettich Quadro V6 You M Silent System",
] as const;
const DRAWER_METAL_BOX_TYPES = [
  "Nenhuma",
  "Hettich AvanTech",
] as const;
const DRAWER_HANDLE_TYPES = ["Nenhum", "Puxador", "Cava", "Perfil Alumínio"] as const;
const DRAWER_HANDLE_POSITIONS = ["Centro", "Topo", "Inferior", "Percentual"] as const;
const DRAWER_HEIGHT_MODE_VALUES = [
  "equal",
  "top_small_mid_medium_bottom_large",
  "custom",
  "ergonomic",
  "kitchen_zones",
  "auto",
] as const;
const DRAWER_LOAD_CAPACITIES = [30, 40, 50, 70] as const;

function pickOption<T extends readonly string[]>(
  value: unknown,
  options: T,
  /** Aceita string alargada (ex.: DrawerSlideType) — o cast garante T[number] no retorno. */
  fallback: string
): T[number] {
  return options.includes(value as T[number]) ? (value as T[number]) : (fallback as T[number]);
}

/**
 * % inteiro Admin; migra factor legado `gavetaPercentualReducaoLaterais` (ex. 0,75 → 25).
 */
function resolveGavetaReducaoPercentual(gavetas: Record<string, unknown>): number {
  const direct = Number(gavetas.gavetaReducaoPercentual);
  if (Number.isFinite(direct)) return direct;
  const oldFactor = Number(gavetas.gavetaPercentualReducaoLaterais);
  if (Number.isFinite(oldFactor) && oldFactor > 0 && oldFactor < 1) {
    return (1 - oldFactor) * 100;
  }
  return settingsDefaults.gavetas.gavetaReducaoPercentual;
}

function pickDrawerCapacity(value: unknown): 30 | 40 | 50 | 70 {
  const numeric = Number(value);
  return DRAWER_LOAD_CAPACITIES.includes(numeric as 30 | 40 | 50 | 70)
    ? (numeric as 30 | 40 | 50 | 70)
    : settingsDefaults.gavetas.gavetaCapacidadeCargaKg;
}

/** sideOffset > 0 = override manual; ausente ou ≤0 = automático (espessura/2 no motor). */
function optionalFuraçãoSideOffset(raw: unknown): { sideOffset?: number } {
  if (raw === undefined || raw === null) return {};
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return {};
  return { sideOffset: clamp(n, 3, 50) };
}

export function validateSettings(input: Partial<SettingsSchema> | SettingsSchema): ValidationResult {
  const merged = deepMergeSettings(settingsDefaults, input);
  const errors: string[] = [];

  const normalized: SettingsSchema = {
    ...merged,
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    geral: {
      locale: typeof merged.geral.locale === "string" && merged.geral.locale.trim() ? merged.geral.locale.trim() : settingsDefaults.geral.locale,
      theme: merged.geral.theme === "light" || merged.geral.theme === "system" ? merged.geral.theme : "dark",
      autosaveEnabled: Boolean(merged.geral.autosaveEnabled),
      debugMode: Boolean(merged.geral.debugMode),
    },
    fabrica: {
      toleranciaCorteMm: clamp(toNumber(merged.fabrica.toleranciaCorteMm, settingsDefaults.fabrica.toleranciaCorteMm), 0, 10),
    },
    precos: {
      margemPercentual: clamp(toNumber(merged.precos.margemPercentual, settingsDefaults.precos.margemPercentual), 0, 500),
      multiplicadorBase: clamp(toNumber(merged.precos.multiplicadorBase, settingsDefaults.precos.multiplicadorBase), 0.1, 100),
      valorHoraMaquina: clamp(toNumber(merged.precos.valorHoraMaquina, settingsDefaults.precos.valorHoraMaquina), 0, 10000),
    },
    orcamentos: (() => {
      let n = normalizeOrcamentosSettings(merged.orcamentos);
      // Soft-migrate: stub day-1 → SSOT central (flags + tarifas).
      if (isOrcamentosDay1IndustrialStub(n)) {
        n = orcamentosDefaultsFromCentral();
      }
      // Financeiro Industrial v3: madeira = chapas reais; ferragens unificadas (Secção 4).
      // Garante o live mesmo com blob local legado em por_peca / unificação off.
      n = {
        ...n,
        custosIndustriais: {
          ...n.custosIndustriais,
          materialCostMode: "por_chapas_reais",
        },
        ferragens: {
          ...n.ferragens,
          enableUnificacao: true,
        },
      };
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("pimo_financeiro_industrial_v3_migrated", "1");
        }
      } catch {
        /* ignore */
      }
      // MO financeira = EUR manual: flag on sem valor → desligar (não forçar 35 €/h).
      if (n.custosIndustriais.enableMaoDeObra && !(n.custosIndustriais.valorHoraMaquina > 0)) {
        return {
          ...n,
          custosIndustriais: {
            ...n.custosIndustriais,
            enableMaoDeObra: false,
            valorHoraMaquina: 0,
          },
        };
      }
      return n;
    })(),
    financeiroAdmin: normalizeFinanceiroAdminSettings(
      (merged as SettingsSchema).financeiroAdmin ?? settingsDefaults.financeiroAdmin
    ),
    ivaPctDefault: clamp(
      toNumber((merged as SettingsSchema).ivaPctDefault, settingsDefaults.ivaPctDefault ?? FINANCEIRO_IVA_DEFAULT_PCT),
      0,
      100
    ),
    materiais: {
      categoriaPadraoId: typeof merged.materiais.categoriaPadraoId === "string" && merged.materiais.categoriaPadraoId.trim()
        ? merged.materiais.categoriaPadraoId.trim()
        : settingsDefaults.materiais.categoriaPadraoId,
      presetVisualPadraoId: typeof merged.materiais.presetVisualPadraoId === "string" && merged.materiais.presetVisualPadraoId.trim()
        ? merged.materiais.presetVisualPadraoId.trim()
        : settingsDefaults.materiais.presetVisualPadraoId,
      materialIndustrialPadraoId: typeof merged.materiais.materialIndustrialPadraoId === "string" && merged.materiais.materialIndustrialPadraoId.trim()
        ? merged.materiais.materialIndustrialPadraoId.trim()
        : settingsDefaults.materiais.materialIndustrialPadraoId,
      sheetWidthMm: clamp(
        toNumber(merged.materiais.sheetWidthMm, settingsDefaults.materiais.sheetWidthMm),
        500,
        10000
      ),
      sheetHeightMm: clamp(
        toNumber(merged.materiais.sheetHeightMm, settingsDefaults.materiais.sheetHeightMm),
        500,
        10000
      ),
      sheetThicknessMm: clamp(
        toNumber(merged.materiais.sheetThicknessMm, settingsDefaults.materiais.sheetThicknessMm),
        1,
        120
      ),
      sheetName:
        typeof merged.materiais.sheetName === "string" && merged.materiais.sheetName.trim()
          ? merged.materiais.sheetName.trim()
          : settingsDefaults.materiais.sheetName,
    },
    cnc: {
      profundidadeCortePadraoMm: clamp(toNumber(merged.cnc.profundidadeCortePadraoMm, settingsDefaults.cnc.profundidadeCortePadraoMm), 0, 200),
      offsetFerramentaPadraoMm: clamp(toNumber(merged.cnc.offsetFerramentaPadraoMm, settingsDefaults.cnc.offsetFerramentaPadraoMm), -50, 50),
      toleranciaPosicionamentoMm: clamp(toNumber(merged.cnc.toleranciaPosicionamentoMm, settingsDefaults.cnc.toleranciaPosicionamentoMm), 0, 10),
      diametroFresaContornoMm: clamp(toNumber(merged.cnc.diametroFresaContornoMm, settingsDefaults.cnc.diametroFresaContornoMm), 0, 30),
      tcnMetodo:
        merged.cnc.tcnMetodo === "nesting_mo" ||
        merged.cnc.tcnMetodo === "v2_ramp" ||
        merged.cnc.tcnMetodo === "v3_ramp_noflip" ||
        merged.cnc.tcnMetodo === "v4_corner_noflip" ||
        merged.cnc.tcnMetodo === "v5_ramp_noanchor" ||
        merged.cnc.tcnMetodo === "v6_ramp" ||
        merged.cnc.tcnMetodo === "v2_new" ||
        merged.cnc.tcnMetodo === "v3_new"
          ? merged.cnc.tcnMetodo
          : "nesting_mo",
      zSafetyMm: clamp(toNumber(merged.cnc.zSafetyMm, settingsDefaults.cnc.zSafetyMm), 0, 100),
      minSpacingMm: clamp(toNumber(merged.cnc.minSpacingMm, settingsDefaults.cnc.minSpacingMm), 0, 200),
      contourEntryMode: merged.cnc.contourEntryMode === "midside" ? "midside" : "corner",
      contourCloseExplicit: Boolean(merged.cnc.contourCloseExplicit),
      toolFeedRate: clamp(toNumber(merged.cnc.toolFeedRate, settingsDefaults.cnc.toolFeedRate), 1, 20000),
      toolRpm: clamp(toNumber(merged.cnc.toolRpm, settingsDefaults.cnc.toolRpm), 1000, 50000),
      drillFeedRate: clamp(toNumber(merged.cnc.drillFeedRate, settingsDefaults.cnc.drillFeedRate), 1, 20000),
      drillRpm: clamp(toNumber(merged.cnc.drillRpm, settingsDefaults.cnc.drillRpm), 1000, 50000),
      sheetMarginMm: clamp(toNumber(merged.cnc.sheetMarginMm, settingsDefaults.cnc.sheetMarginMm), 0, 100),
      rampDistanceMm: clamp(toNumber(merged.cnc.rampDistanceMm, settingsDefaults.cnc.rampDistanceMm), 5, 100),
      compensacaoFerramenta: merged.cnc.compensacaoFerramenta === "dentro" ? "dentro" : "fora",
    },
    nesting: {
      kerfPadraoMm: clamp(toNumber(merged.nesting.kerfPadraoMm, settingsDefaults.nesting.kerfPadraoMm), 0, 20),
      permitirRotacaoGlobal: Boolean(merged.nesting.permitirRotacaoGlobal),
      prioridadeAproveitamento:
        merged.nesting.prioridadeAproveitamento === "area" || merged.nesting.prioridadeAproveitamento === "chapas"
          ? merged.nesting.prioridadeAproveitamento
          : "balanceado",
      enableV3IndustrialAutoLayout: merged.nesting.enableV3IndustrialAutoLayout !== false,
    },
    portas: {
      portaGapVerticalMm: clamp(toNumber(merged.portas.portaGapVerticalMm, settingsDefaults.portas.portaGapVerticalMm), 0, 20),
      portaGapHorizontalMm: clamp(toNumber(merged.portas.portaGapHorizontalMm, settingsDefaults.portas.portaGapHorizontalMm), 0, 20),
      portaGapDuplaMm: clamp(toNumber(merged.portas.portaGapDuplaMm, settingsDefaults.portas.portaGapDuplaMm), 0, 50),
      portaPosZOffsetMm: clamp(toNumber(merged.portas.portaPosZOffsetMm, settingsDefaults.portas.portaPosZOffsetMm), 0, 50),
    },
    gavetas: {
      gavetaFolgaFrenteMm: clamp(
        toNumber(merged.gavetas.gavetaFolgaFrenteMm, settingsDefaults.gavetas.gavetaFolgaFrenteMm),
        0,
        20
      ),
      gavetaFolgaLateralMm: clamp(
        toNumber(merged.gavetas.gavetaFolgaLateralMm, settingsDefaults.gavetas.gavetaFolgaLateralMm),
        0,
        30
      ),
      gavetaEspessuraFrenteMm: clamp(
        toNumber(merged.gavetas.gavetaEspessuraFrenteMm, settingsDefaults.gavetas.gavetaEspessuraFrenteMm),
        5,
        50
      ),
      gavetaEspessuraLateralMm: clamp(
        toNumber(merged.gavetas.gavetaEspessuraLateralMm, settingsDefaults.gavetas.gavetaEspessuraLateralMm),
        5,
        50
      ),
      gavetaEspessuraTraseiraMm: clamp(
        toNumber(merged.gavetas.gavetaEspessuraTraseiraMm, settingsDefaults.gavetas.gavetaEspessuraTraseiraMm),
        5,
        50
      ),
      gavetaEspessuraFundoMm: clamp(
        toNumber(merged.gavetas.gavetaEspessuraFundoMm, settingsDefaults.gavetas.gavetaEspessuraFundoMm),
        3,
        30
      ),
      gavetaRecuoCorpoMm: clamp(
        toNumber(merged.gavetas.gavetaRecuoCorpoMm, settingsDefaults.gavetas.gavetaRecuoCorpoMm),
        0,
        200
      ),
      gavetaReducaoPercentual: clamp(
        Math.round(resolveGavetaReducaoPercentual(merged.gavetas as Record<string, unknown>)),
        5,
        60
      ),
      gavetaRecuoProfundidadeCorredicaMm: clamp(
        toNumber(
          merged.gavetas.gavetaRecuoProfundidadeCorredicaMm,
          settingsDefaults.gavetas.gavetaRecuoProfundidadeCorredicaMm
        ),
        0,
        80
      ),
      gavetaProfundidadesDisponiveisMm: normalizeDepths(
        merged.gavetas.gavetaProfundidadesDisponiveisMm,
        settingsDefaults.gavetas.gavetaProfundidadesDisponiveisMm
      ),
      gavetaAlturaMinimaMm: clamp(
        toNumber(merged.gavetas.gavetaAlturaMinimaMm, settingsDefaults.gavetas.gavetaAlturaMinimaMm),
        40,
        500
      ),
      gavetaAlturaMaximaMm: clamp(
        toNumber(merged.gavetas.gavetaAlturaMaximaMm, settingsDefaults.gavetas.gavetaAlturaMaximaMm),
        80,
        1000
      ),
      gavetaTipoCorredica: pickOption(
        merged.gavetas.gavetaTipoCorredica,
        DRAWER_SLIDE_TYPES,
        settingsDefaults.gavetas.gavetaTipoCorredica
      ),
      gavetaSoftClose: Boolean(merged.gavetas.gavetaSoftClose),
      gavetaCursoTotalMm: clamp(
        toNumber(merged.gavetas.gavetaCursoTotalMm, settingsDefaults.gavetas.gavetaCursoTotalMm),
        0,
        1000
      ),
      gavetaCapacidadeCargaKg: pickDrawerCapacity(merged.gavetas.gavetaCapacidadeCargaKg),
      gavetaTipoCaixaMetalica: pickOption(
        merged.gavetas.gavetaTipoCaixaMetalica,
        DRAWER_METAL_BOX_TYPES,
        settingsDefaults.gavetas.gavetaTipoCaixaMetalica
      ),
      gavetaAlturaCaixaMetalicaMm: clamp(
        toNumber(merged.gavetas.gavetaAlturaCaixaMetalicaMm, settingsDefaults.gavetas.gavetaAlturaCaixaMetalicaMm),
        0,
        400
      ),
      gavetaProfundidadesCompativeisMm: normalizeDepths(
        merged.gavetas.gavetaProfundidadesCompativeisMm,
        settingsDefaults.gavetas.gavetaProfundidadesCompativeisMm
      ),
      gavetaTipoHandle: pickOption(
        merged.gavetas.gavetaTipoHandle,
        DRAWER_HANDLE_TYPES,
        settingsDefaults.gavetas.gavetaTipoHandle
      ),
      gavetaPosicaoHandle: pickOption(
        merged.gavetas.gavetaPosicaoHandle,
        DRAWER_HANDLE_POSITIONS,
        settingsDefaults.gavetas.gavetaPosicaoHandle
      ),
      gavetaOffsetHandleMm: clamp(
        toNumber(merged.gavetas.gavetaOffsetHandleMm, settingsDefaults.gavetas.gavetaOffsetHandleMm),
        -500,
        500
      ),
      gavetaValidarAlturasCustom: Boolean(merged.gavetas.gavetaValidarAlturasCustom),
      gavetaValidarProfundidadeCompativel: Boolean(merged.gavetas.gavetaValidarProfundidadeCompativel),
      gavetaValidarCargaMaxima: Boolean(merged.gavetas.gavetaValidarCargaMaxima),
      gavetaValidarSoftCloseCompativel: Boolean(merged.gavetas.gavetaValidarSoftCloseCompativel),
      gavetaAlturaModoPadrao: pickOption(
        merged.gavetas.gavetaAlturaModoPadrao,
        DRAWER_HEIGHT_MODE_VALUES,
        settingsDefaults.gavetas.gavetaAlturaModoPadrao
      ),
    },
    modeloPI: {
      espessuraMadeiraMm: clamp(
        toNumber(merged.modeloPI?.espessuraMadeiraMm, PI_MODEL_DEFAULT_SETTINGS.espessuraMadeiraMm),
        10,
        40
      ),
      ativarFuracaoPrateleiras: Boolean(
        merged.modeloPI?.ativarFuracaoPrateleiras ?? PI_MODEL_DEFAULT_SETTINGS.ativarFuracaoPrateleiras
      ),
      ativarFuracaoDobradicas: Boolean(
        merged.modeloPI?.ativarFuracaoDobradicas ?? PI_MODEL_DEFAULT_SETTINGS.ativarFuracaoDobradicas
      ),
      ativarFuracaoGavetas: Boolean(
        merged.modeloPI?.ativarFuracaoGavetas ?? PI_MODEL_DEFAULT_SETTINGS.ativarFuracaoGavetas
      ),
      sistemaGavetas:
        merged.modeloPI?.sistemaGavetas === "AvanTech YOU XL" || merged.modeloPI?.sistemaGavetas === "AvanTech YOU M"
          ? merged.modeloPI.sistemaGavetas
          : "AvanTech YOU L",
      comprimentoCorredicaMm: clamp(
        toNumber(merged.modeloPI?.comprimentoCorredicaMm, PI_MODEL_DEFAULT_SETTINGS.comprimentoCorredicaMm),
        250,
        650
      ),
      numeroGavetas: clampPiNumeroGavetas(
        toNumber(merged.modeloPI?.numeroGavetas, PI_MODEL_DEFAULT_SETTINGS.numeroGavetas)
      ),
      tipoFrente:
        merged.modeloPI?.tipoFrente === "inset" || merged.modeloPI?.tipoFrente === "overlay"
          ? merged.modeloPI.tipoFrente
          : "full_overlay",
    },
    ferragens: {
      cavilha: {
        diametro: clamp(
          toNumber(merged.ferragens.cavilha.diametro, settingsDefaults.ferragens.cavilha.diametro),
          1,
          50
        ),
        profundidade: clamp(
          toNumber(merged.ferragens.cavilha.profundidade, settingsDefaults.ferragens.cavilha.profundidade),
          1,
          100
        ),
        distanciaBorda: clamp(
          toNumber(merged.ferragens.cavilha.distanciaBorda, settingsDefaults.ferragens.cavilha.distanciaBorda),
          0,
          200
        ),
        ativo: Boolean(merged.ferragens.cavilha.ativo),
      },
      parafuso: {
        diametro: clamp(
          toNumber(merged.ferragens.parafuso.diametro, settingsDefaults.ferragens.parafuso.diametro),
          1,
          20
        ),
        comprimento: clamp(
          toNumber(merged.ferragens.parafuso.comprimento, settingsDefaults.ferragens.parafuso.comprimento),
          1,
          200
        ),
        ativo: Boolean(merged.ferragens.parafuso.ativo),
      },
      corredica: {
        tipo:
          typeof merged.ferragens.corredica.tipo === "string" && merged.ferragens.corredica.tipo.trim()
            ? merged.ferragens.corredica.tipo.trim()
            : settingsDefaults.ferragens.corredica.tipo,
        folga: clamp(
          toNumber(merged.ferragens.corredica.folga, settingsDefaults.ferragens.corredica.folga),
          0,
          50
        ),
        ativo: Boolean(merged.ferragens.corredica.ativo),
      },
    },
    viewer: {
      qualidade: merged.viewer.qualidade === "baixa" || merged.viewer.qualidade === "media" ? merged.viewer.qualidade : "alta",
      luzIntensidade: clamp(toNumber(merged.viewer.luzIntensidade, settingsDefaults.viewer.luzIntensidade), 0, 4),
      mostrarGrid: Boolean(merged.viewer.mostrarGrid),
    },
    furação: {
      parafuso: {
        frontDistance: clamp(
          toNumber(
            merged.furação?.parafuso?.frontDistance ??
              (merged.furação?.parafuso as Record<string, unknown> | undefined)?.distanciaFrenteParafuso,
            settingsDefaults.furação.parafuso.frontDistance
          ),
          5,
          500
        ),
        backDistance: clamp(
          toNumber(
            merged.furação?.parafuso?.backDistance ??
              (merged.furação?.parafuso as Record<string, unknown> | undefined)?.distanciaFrenteParafuso,
            settingsDefaults.furação.parafuso.backDistance
          ),
          5,
          500
        ),
        offsetDaBorda: clamp(
          toNumber(merged.furação?.parafuso?.offsetDaBorda, settingsDefaults.furação.parafuso.offsetDaBorda),
          3,
          50
        ),
        ...optionalFuraçãoSideOffset(merged.furação?.parafuso?.sideOffset),
      },
      cavilha: {
        frontDistance: clamp(
          toNumber(
            merged.furação?.cavilha?.frontDistance ??
              (merged.furação?.parafuso as Record<string, unknown> | undefined)?.distanciaFrenteCavilha,
            settingsDefaults.furação.cavilha.frontDistance
          ),
          5,
          500
        ),
        backDistance: clamp(
          toNumber(
            merged.furação?.cavilha?.backDistance ??
              (merged.furação?.parafuso as Record<string, unknown> | undefined)?.distanciaFrenteCavilha,
            settingsDefaults.furação.cavilha.backDistance
          ),
          5,
          500
        ),
        ...optionalFuraçãoSideOffset(merged.furação?.cavilha?.sideOffset),
      },
      prateleira: {
        margemTop: clamp(toNumber(merged.furação?.prateleira?.margemTop, settingsDefaults.furação.prateleira.margemTop), 0, 500),
        margemBottom: clamp(toNumber(merged.furação?.prateleira?.margemBottom, settingsDefaults.furação.prateleira.margemBottom), 0, 500),
        minFuros: clamp(toNumber(merged.furação?.prateleira?.minFuros, settingsDefaults.furação.prateleira.minFuros), 2, 100),
        maxFuros: clamp(toNumber(merged.furação?.prateleira?.maxFuros, settingsDefaults.furação.prateleira.maxFuros), 2, 100),
        espacamentoVertical: clamp(
          toNumber(merged.furação?.prateleira?.espacamentoVertical, settingsDefaults.furação.prateleira.espacamentoVertical),
          16,
          64
        ),
        distanciaDaBorda: clamp(
          toNumber(merged.furação?.prateleira?.distanciaDaBorda, settingsDefaults.furação.prateleira.distanciaDaBorda),
          5,
          80
        ),
      },
      dobradica: {
        distanciaCentroDaBorda: clamp(
          toNumber(merged.furação?.dobradica?.distanciaCentroDaBorda, settingsDefaults.furação.dobradica.distanciaCentroDaBorda),
          15,
          35
        ),
        distanciaDobradiçaTopo: clamp(
          toNumber(merged.furação?.dobradica?.distanciaDobradiçaTopo, settingsDefaults.furação.dobradica.distanciaDobradiçaTopo),
          20,
          300
        ),
        distanciaDobradiçaFundo: clamp(
          toNumber(merged.furação?.dobradica?.distanciaDobradiçaFundo, settingsDefaults.furação.dobradica.distanciaDobradiçaFundo),
          20,
          300
        ),
        numeroPorPorta: clamp(
          toNumber(merged.furação?.dobradica?.numeroPorPorta, settingsDefaults.furação.dobradica.numeroPorPorta),
          1,
          6
        ),
        distribuicaoAutomatica: Boolean(merged.furação?.dobradica?.distribuicaoAutomatica ?? settingsDefaults.furação.dobradica.distribuicaoAutomatica),
      },
      dobradicaFixacao: {
        distanciaDaBordaCalco: clamp(
          toNumber(
            (merged.furação?.dobradicaFixacao as Record<string, unknown> | undefined)?.distanciaDaBordaCalco ??
              (merged.furação?.dobradicaFixacao as Record<string, unknown> | undefined)?.distanciaDaBorda,
            settingsDefaults.furação.dobradicaFixacao.distanciaDaBordaCalco
          ),
          5,
          80
        ),
        distanciaDaBordaParafusoUniao: clamp(
          toNumber(merged.furação?.dobradicaFixacao?.distanciaDaBordaParafusoUniao, settingsDefaults.furação.dobradicaFixacao.distanciaDaBordaParafusoUniao),
          10,
          100
        ),
        distanciaEntreFurosCalco: clamp(
          toNumber(
            (merged.furação?.dobradicaFixacao as Record<string, unknown> | undefined)?.distanciaEntreFurosCalco ??
              (merged.furação?.dobradicaFixacao as Record<string, unknown> | undefined)?.distanciaEntreFuros,
            settingsDefaults.furação.dobradicaFixacao.distanciaEntreFurosCalco
          ),
          10,
          80
        ),
        profundidadeFuro: clamp(
          toNumber(merged.furação?.dobradicaFixacao?.profundidadeFuro, settingsDefaults.furação.dobradicaFixacao.profundidadeFuro),
          5,
          25
        ),
        diametro: clamp(toNumber(merged.furação?.dobradicaFixacao?.diametro, settingsDefaults.furação.dobradicaFixacao.diametro), 3, 10),
        diametroParafusoUniao: clamp(toNumber(merged.furação?.dobradicaFixacao?.diametroParafusoUniao, settingsDefaults.furação.dobradicaFixacao.diametroParafusoUniao), 3, 10),
        profundidadeParafusoUniao: clamp(toNumber(merged.furação?.dobradicaFixacao?.profundidadeParafusoUniao, settingsDefaults.furação.dobradicaFixacao.profundidadeParafusoUniao), 0.5, 25),
      },
    },
    etiquetasQr: {
      logoAtivado: Boolean(merged.etiquetasQr?.logoAtivado ?? settingsDefaults.etiquetasQr.logoAtivado),
      logoDataUrl: typeof merged.etiquetasQr?.logoDataUrl === "string" ? merged.etiquetasQr.logoDataUrl : undefined,
      logoTamanhoPorcento: clamp(
        toNumber(merged.etiquetasQr?.logoTamanhoPorcento, settingsDefaults.etiquetasQr.logoTamanhoPorcento),
        10,
        30
      ),
    },
    orlaRules: sanitizeOrlaRulesInput(merged.orlaRules),
  };

  if (normalized.materiais.sheetThicknessMm > normalized.materiais.sheetWidthMm) {
    errors.push("Espessura padrão da fábrica parece inválida para a largura de chapa.");
  }

  return { valid: errors.length === 0, errors, normalized };
}
