/**
 * Schema e valores por defeito das configurações globais.
 */

import { PANEL_DEFAULTS } from "../panel/panelConstants";
import {
  PI_MODEL_DEFAULT_SETTINGS,
  type PiSistemaGaveta,
  type PiTipoFrente,
} from "../../data/moveisUnificados/pi/settings";
import type { DrawerHeightMode } from "../drawers/drawerHeightModeTypes";
import { type OrcamentosSettings } from "../orcamentos";
import {
  defaultFinanceiroAdminSettings,
  type FinanceiroAdminSettings,
} from "../financeiro/financeiroAdminRules";
import { FINANCEIRO_IVA_DEFAULT_PCT } from "../financeiro/financeiroUnificadoTypes";
import { orcamentosDefaultsFromCentral } from "../pricing/centralPricingConfig";

export const SETTINGS_STORAGE_KEY = "pimo_system_settings_v1";
export const SETTINGS_SCHEMA_VERSION = 2;

export type DrawerSlideType =
  | "Blum Tandem"
  | "Blum Movento"
  | "Hettich InnoTech"
  | "Hettich ArciTech"
  | "Hettich Quadro V6 You M Silent System"
  | "Hafele Matrix"
  | "Genérica";

export type DrawerMetalBoxType =
  | "Nenhuma"
  | "Blum Legrabox"
  | "Blum Antaro"
  | "Blum Metabox"
  | "Hettich InnoTech"
  | "Hettich ArciTech"
  | "Hettich AvanTech"
  | "Grass Nova Pro"
  | "Grass Vionaro"
  | "Hafele Alto"
  | "Genérica";

export type DrawerHandleType = "Nenhum" | "Puxador" | "Cava" | "Perfil Alumínio";
export type DrawerHandlePosition = "Centro" | "Topo" | "Inferior" | "Percentual";

export interface SettingsSchema {
  schemaVersion: number;
  geral: {
    locale: string;
    theme: "dark" | "light" | "system";
    autosaveEnabled: boolean;
    debugMode: boolean;
  };
  fabrica: {
    toleranciaCorteMm: number;
  };
  precos: {
    margemPercentual: number;
    multiplicadorBase: number;
    valorHoraMaquina: number;
  };
  /**
   * P3.9 — Orçamentos (tarifas Admin).
   * Fase 1: persistido; sem ligação a cálculos financeiros.
   */
  orcamentos: OrcamentosSettings;
  /**
   * P3.6 — ADM / Montagem / Portes (SSOT syncável via user settings + pricing.json).
   */
  financeiroAdmin: FinanceiroAdminSettings;
  /** IVA % default (override por projeto em financeiroOverrides.ivaPct). */
  ivaPctDefault: number;
  materiais: {
    categoriaPadraoId: string;
    presetVisualPadraoId: string;
    materialIndustrialPadraoId: string;
    sheetWidthMm: number;
    sheetHeightMm: number;
    sheetThicknessMm: number;
    sheetName: string;
  };
  cnc: {
    profundidadeCortePadraoMm: number;
    offsetFerramentaPadraoMm: number;
    toleranciaPosicionamentoMm: number;
    /** Diâmetro da fresa para compensação geométrica no TCN (contorno já compensado no CAM; 0 = usar Kerf padrão ou 12 mm). */
    diametroFresaContornoMm: number;
    tcnMetodo: "nesting_mo" | "v2_new";
    zSafetyMm: number;
    minSpacingMm: number;
    contourEntryMode: "corner" | "midside";
    contourCloseExplicit: boolean;
    toolFeedRate: number;
    toolRpm: number;
    drillFeedRate: number;
    drillRpm: number;
    sheetMarginMm: number;
    rampDistanceMm: number;
    /** Compensação de ferramenta: "fora" = offset exterior completo (toolRadiusMm); "dentro" = sem offset (0). Default "dentro". */
    compensacaoFerramenta: "fora" | "dentro";
  };
  nesting: {
    kerfPadraoMm: number;
    permitirRotacaoGlobal: boolean;
    prioridadeAproveitamento: "area" | "chapas" | "balanceado";
    /** Etapa 2: Auto-layout V3 via runCutLayout (desactivar = motor nesting3 legacy). */
    enableV3IndustrialAutoLayout: boolean;
  };
  portas: {
    portaGapVerticalMm: number;
    portaGapHorizontalMm: number;
    portaGapDuplaMm: number;
    portaPosZOffsetMm: number;
  };
  gavetas: {
    gavetaFolgaFrenteMm: number;
    gavetaFolgaLateralMm: number;
    gavetaEspessuraFrenteMm: number;
    gavetaEspessuraLateralMm: number;
    gavetaEspessuraTraseiraMm: number;
    gavetaEspessuraFundoMm: number;
    gavetaRecuoCorpoMm: number;
    /**
     * Redução das laterais face à frente (% inteiro, ex. 25).
     * factor = 1 − valor/100 → laterais = frente × factor; costa = laterais × factor.
     */
    gavetaReducaoPercentual: number;
    /** Recuo de profundidade para corrediça traseira (mm). Usado pelo domínio paramétrico quando ligado (FASE 2+). */
    gavetaRecuoProfundidadeCorredicaMm: number;
    gavetaProfundidadesDisponiveisMm: number[];
    gavetaAlturaMinimaMm: number;
    gavetaAlturaMaximaMm: number;
    gavetaTipoCorredica: DrawerSlideType;
    gavetaSoftClose: boolean;
    gavetaCursoTotalMm: number;
    gavetaCapacidadeCargaKg: 30 | 40 | 50 | 70;
    gavetaTipoCaixaMetalica: DrawerMetalBoxType;
    gavetaAlturaCaixaMetalicaMm: number;
    gavetaProfundidadesCompativeisMm: number[];
    gavetaTipoHandle: DrawerHandleType;
    gavetaPosicaoHandle: DrawerHandlePosition;
    gavetaOffsetHandleMm: number;
    gavetaValidarAlturasCustom: boolean;
    gavetaValidarProfundidadeCompativel: boolean;
    gavetaValidarCargaMaxima: boolean;
    gavetaValidarSoftCloseCompativel: boolean;
    gavetaAlturaModoPadrao: DrawerHeightMode;
  };
  modeloPI: {
    espessuraMadeiraMm: number;
    ativarFuracaoPrateleiras: boolean;
    ativarFuracaoDobradicas: boolean;
    ativarFuracaoGavetas: boolean;
    sistemaGavetas: PiSistemaGaveta;
    comprimentoCorredicaMm: number;
    numeroGavetas: number;
    tipoFrente: PiTipoFrente;
  };
  ferragens: {
    cavilha: {
      diametro: number;
      profundidade: number;
      distanciaBorda: number;
      ativo: boolean;
    };
    parafuso: {
      diametro: number;
      comprimento: number;
      ativo: boolean;
    };
    corredica: {
      tipo: string;
      folga: number;
      ativo: boolean;
    };
  };
  viewer: {
    qualidade: "baixa" | "media" | "alta";
    luzIntensidade: number;
    mostrarGrid: boolean;
  };
  furação: {
    /** Distâncias de furação parafuso (mm). Aplicadas globalmente a todos os projetos. */
    parafuso: {
      /** Distância da frente ao eixo do parafuso (mm). Padrão industrial 90. */
      frontDistance: number;
      /** Distância do fundo ao eixo do parafuso (mm). Padrão industrial 90. */
      backDistance: number;
      /** Offset da borda (linha de furação), mm. */
      offsetDaBorda: number;
      /** Distância do centro do furo à borda lateral em cima/fundo (mm). Se omitido, usa metade da espessura do painel. */
      sideOffset?: number;
    };
    /** Distâncias de furação cavilha (mm). Aplicadas globalmente a todos os projetos. */
    cavilha: {
      /** Distância da frente ao eixo da cavilha (mm). Padrão industrial 60. */
      frontDistance: number;
      /** Distância do fundo ao eixo da cavilha (mm). Padrão industrial 60. */
      backDistance: number;
      /** Distância do centro do furo aos bordos esquerdo/direito em cima/fundo (mm). Se omitido, usa metade da espessura do painel. */
      sideOffset?: number;
    };
    prateleira: {
      margemTop: number;
      margemBottom: number;
      minFuros: number;
      maxFuros: number;
      espacamentoVertical: number;
      /** Offset horizontal dos furos (linha frente e fundo), mm. */
      distanciaDaBorda: number;
    };
    dobradica: {
      distanciaCentroDaBorda: number;
      /** Distância da dobradiça ao topo (mm). */
      distanciaDobradiçaTopo: number;
      /** Distância da dobradiça ao fundo (mm). */
      distanciaDobradiçaFundo: number;
      /** Número de dobradiças por porta. */
      numeroPorPorta: number;
      /** Se true, distribui Y automaticamente (distTopo/distFundo/proporcional); se false, usa offsetsVerticaisMm quando definido. */
      distribuicaoAutomatica: boolean;
    };
    /** Regras de fixação da dobradiça na lateral: 2 furos calço + 1 parafuso união. */
    dobradicaFixacao: {
      /** Distância da borda ao eixo dos 2 furos do calço (mm). */
      distanciaDaBordaCalco: number;
      /** Distância da borda ao eixo do furo de parafuso de união (mm). */
      distanciaDaBordaParafusoUniao: number;
      /** Distância entre os 2 furos do calço (mm). */
      distanciaEntreFurosCalco: number;
      profundidadeFuro: number;
      diametro: number;
      diametroParafusoUniao: number;
      profundidadeParafusoUniao: number;
    };
  };
  etiquetasQr: {
    /** Ativar QR com logo integrado */
    logoAtivado: boolean;
    /** Data URL da imagem do logo (PNG com fundo transparente) */
    logoDataUrl?: string;
    /** Tamanho do logo em percentual (10-30%) */
    logoTamanhoPorcento: number;
  };
  /** Regras visuais de ORLA por tipo de peça (viewer only). */
  orlaRules: Partial<Record<string, ("top" | "bottom" | "left" | "right" | "front" | "back")[]>>;
}

export const settingsDefaults: SettingsSchema = {
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  geral: {
    locale: "pt-PT",
    theme: "dark",
    autosaveEnabled: true,
    debugMode: false,
  },
  fabrica: {
    toleranciaCorteMm: 0.2,
  },
  precos: {
    margemPercentual: 20,
    multiplicadorBase: 1,
    valorHoraMaquina: 35,
  },
  /** Boot: tarifas + flags industriais a partir de pricing.json (não day-1 off). */
  orcamentos: orcamentosDefaultsFromCentral(),
  financeiroAdmin: defaultFinanceiroAdminSettings(),
  ivaPctDefault: FINANCEIRO_IVA_DEFAULT_PCT,
  materiais: {
    categoriaPadraoId: "mdf",
    presetVisualPadraoId: "mdf_branco",
    materialIndustrialPadraoId: "mdf_branco-19",
    sheetWidthMm: PANEL_DEFAULTS.largura_mm,
    sheetHeightMm: PANEL_DEFAULTS.altura_mm,
    sheetThicknessMm: 19,
    sheetName: "MDF Branco 19",
  },
  cnc: {
    profundidadeCortePadraoMm: 18,
    offsetFerramentaPadraoMm: 0,
    toleranciaPosicionamentoMm: 0.1,
    diametroFresaContornoMm: 0,
    tcnMetodo: "nesting_mo",
    zSafetyMm: 10,
    minSpacingMm: 3,
    contourEntryMode: "corner",
    contourCloseExplicit: false,
    toolFeedRate: 8,
    toolRpm: 21000,
    drillFeedRate: 1000,
    drillRpm: 18000,
    sheetMarginMm: 10,
    rampDistanceMm: 20,
    compensacaoFerramenta: "dentro",
  },
  nesting: {
    kerfPadraoMm: 3,
    permitirRotacaoGlobal: true,
    prioridadeAproveitamento: "balanceado",
    enableV3IndustrialAutoLayout: true,
  },
  portas: {
    portaGapVerticalMm: 2,
    portaGapHorizontalMm: 2,
    portaGapDuplaMm: 2,
    portaPosZOffsetMm: 9,
  },
  gavetas: {
    gavetaFolgaFrenteMm: 2,
    gavetaFolgaLateralMm: 7,
    gavetaEspessuraFrenteMm: 19,
    gavetaEspessuraLateralMm: 16,
    gavetaEspessuraTraseiraMm: 16,
    gavetaEspessuraFundoMm: 10,
    gavetaRecuoCorpoMm: 70,
    gavetaReducaoPercentual: 25,
    gavetaRecuoProfundidadeCorredicaMm: 20,
    gavetaProfundidadesDisponiveisMm: [350, 400, 450, 500, 550, 600],
    gavetaAlturaMinimaMm: 80,
    gavetaAlturaMaximaMm: 350,
    // Único sistema ativo; restantes = "EM BREVE" (ver drawerUiConstants.ts).
    gavetaTipoCorredica: "Hettich Quadro V6 You M Silent System",
    gavetaSoftClose: true,
    gavetaCursoTotalMm: 0,
    gavetaCapacidadeCargaKg: 40,
    // Único sistema ativo (com "Nenhuma") é "Hettich AvanTech"; restantes = "EM BREVE".
    gavetaTipoCaixaMetalica: "Nenhuma",
    gavetaAlturaCaixaMetalicaMm: 0,
    gavetaProfundidadesCompativeisMm: [350, 400, 450, 500, 550, 600],
    gavetaTipoHandle: "Nenhum",
    gavetaPosicaoHandle: "Centro",
    gavetaOffsetHandleMm: 0,
    gavetaValidarAlturasCustom: true,
    gavetaValidarProfundidadeCompativel: true,
    gavetaValidarCargaMaxima: true,
    gavetaValidarSoftCloseCompativel: true,
    gavetaAlturaModoPadrao: "equal",
  },
  modeloPI: {
    ...PI_MODEL_DEFAULT_SETTINGS,
  },
  ferragens: {
    cavilha: {
      diametro: 10,
      profundidade: 30,
      distanciaBorda: 37,
      ativo: true,
    },
    parafuso: {
      diametro: 5,
      comprimento: 30,
      ativo: true,
    },
    corredica: {
      tipo: "telescopica",
      folga: 7,
      ativo: true,
    },
  },
  viewer: {
    qualidade: "alta",
    luzIntensidade: 1,
    mostrarGrid: true,
  },
  furação: {
    parafuso: {
      frontDistance: 90,
      backDistance: 90,
      offsetDaBorda: 9,
    },
    cavilha: {
      frontDistance: 60,
      backDistance: 60,
    },
    prateleira: {
      margemTop: 200,
      margemBottom: 200,
      minFuros: 6,
      maxFuros: 40,
      espacamentoVertical: 32,
      distanciaDaBorda: 60,
    },
    dobradica: {
      distanciaCentroDaBorda: 22.5,
      distanciaDobradiçaTopo: 100,
      distanciaDobradiçaFundo: 100,
      numeroPorPorta: 2,
      distribuicaoAutomatica: true,
    },
    dobradicaFixacao: {
      distanciaDaBordaCalco: 37,
      distanciaDaBordaParafusoUniao: 53,
      distanciaEntreFurosCalco: 32,
      profundidadeFuro: 12,
      diametro: 5,
      diametroParafusoUniao: 5,
      /** Terceiro furo: apenas marcation (0.5 mm). Não estrutural. */
      profundidadeParafusoUniao: 0.5,
    },
  },
  etiquetasQr: {
    logoAtivado: false,
    logoDataUrl: undefined,
    logoTamanhoPorcento: 20,
  },
  orlaRules: {},
};
