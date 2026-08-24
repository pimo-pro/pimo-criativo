/**
 * DrawerSystemReference
 *
 * Centro de documentação e mapeamento do sistema de gavetas (FASE 1 — Master Plan).
 * Apenas dados de referência — não altera comportamento industrial.
 *
 * Modelo A (atual): único sistema activo em runtime; código preservado e
 *   consumido por UI/cutlist/PDF/viewer.
 * Modelo B (europeu): referência histórica. A pasta ./european/ não existe
 *   neste repositório e não há opção activa de runtime associada.
 *
 * Pipeline oficial alvo:
 *   DrawerParametrics → DrawerGenerationService → DrawerGroup
 *   → drawerGroupToLayerItems → drawersLayer → drawerCutlistAdapter
 *   → cutlistFromBoxes → buildCutlistItemsForIndustrialExport
 */

import { settingsDefaults, type SettingsSchema } from "../settings/settingsSchema";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type DrawerRuleSourceStatus =
  | "official"
  | "duplicate"
  | "legacy"
  | "migrate"
  | "remove_future";

export type DrawerRuleEntry = {
  id: string;
  label: string;
  value: string;
  formula?: string;
  sourceFile: string;
  sourceLines?: string;
  status: DrawerRuleSourceStatus;
  notes?: string;
};

export type DrawerSystemDomain = {
  id: string;
  title: string;
  description: string;
  status: DrawerRuleSourceStatus;
  primaryFiles: string[];
  rules: DrawerRuleEntry[];
};

export type DrawerInconsistency = {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  modernSource?: string;
  legacySource?: string;
  resolveInPhase: 2 | 3 | 4 | 5 | 6;
};

export type DrawerPhaseProposal = {
  phase: number;
  title: string;
  actions: string[];
  files: string[];
  status?: "completed" | "pending";
};

export type DrawerSystemReferenceReport = {
  generatedAt: string;
  officialPipeline: string[];
  domains: DrawerSystemDomain[];
  inconsistencies: DrawerInconsistency[];
  phaseProposals: DrawerPhaseProposal[];
  settingsKeys: Array<{ key: keyof SettingsSchema["gavetas"]; label: string; defaultValue: string }>;
};

// ---------------------------------------------------------------------------
// Pipeline oficial (alvo de unificação)
// ---------------------------------------------------------------------------

export const DRAWER_OFFICIAL_PIPELINE: string[] = [
  "settings.gavetas (SettingsSchema + DrawerRulesAdminPage)",
  "DrawerParametrics.calculateDrawerSpecs",
  "DrawerGenerationService.generateDrawerGroup",
  "DrawerGroup.calculateDrawerHeights / calculateDrawerPositions",
  "drawerGroupToLayerItems → WorkspaceBox.drawersLayer",
  "DrawerFactory.buildDrawerSpecs + createDrawerObject (Viewer)",
  "drawerCutlistAdapter.extractDrawerCutlistFromLayerItems",
  "cutlistComPrecoFromBox (metadata.drawerRules + drawerHardware)",
  "buildCutlistItemsForIndustrialExport → CNC/TCN",
];

export const DRAWER_LEGACY_PIPELINE: string[] = [
  "boxManufacturing.gerarPaineis (só gaveta_frente)",
  "boxManufacturing.gerarGavetas (resumo industrial)",
  "boxManufacturing.gerarFerragens (corredicas × 2)",
  "useCutlistData → gerarModeloIndustrial",
  "gerarPdfTecnico → modelo.paineis",
  "buildFerragens (ferragens.ts, corrediça × gavetas)",
];

// ---------------------------------------------------------------------------
// Domínios de regras
// ---------------------------------------------------------------------------

const GAVETA_SETTINGS_RULES: DrawerRuleEntry[] = [
  {
    id: "folga-frente",
    label: "Folga frontal (mm)",
    value: String(settingsDefaults.gavetas.gavetaFolgaFrenteMm),
    formula: "frontWidth = boxInternalWidth - 2 × folga",
    sourceFile: "src/core/settings/settingsSchema.ts",
    sourceLines: "gavetaFolgaFrenteMm",
    status: "official",
    notes: "Consumido por DrawerParametrics via getSettings().gavetas",
  },
  {
    id: "folga-lateral",
    label: "Folga lateral / corrediça (mm)",
    value: String(settingsDefaults.gavetas.gavetaFolgaLateralMm),
    formula: "bodyWidth = boxInternalWidth - 2 × folgaLateral",
    sourceFile: "src/core/drawers/DrawerParametrics.ts",
    status: "official",
  },
  {
    id: "esp-frente",
    label: "Espessura frente (mm)",
    value: String(settingsDefaults.gavetas.gavetaEspessuraFrenteMm),
    sourceFile: "src/core/settings/settingsSchema.ts",
    status: "official",
  },
  {
    id: "esp-lateral",
    label: "Espessura lateral (mm)",
    value: String(settingsDefaults.gavetas.gavetaEspessuraLateralMm),
    sourceFile: "src/core/settings/settingsSchema.ts",
    status: "official",
  },
  {
    id: "esp-traseira",
    label: "Espessura traseira (mm)",
    value: String(settingsDefaults.gavetas.gavetaEspessuraTraseiraMm),
    sourceFile: "src/core/settings/settingsSchema.ts",
    status: "official",
  },
  {
    id: "esp-fundo",
    label: "Espessura fundo (mm)",
    value: String(settingsDefaults.gavetas.gavetaEspessuraFundoMm),
    sourceFile: "src/core/settings/settingsSchema.ts",
    status: "official",
  },
  {
    id: "recuo-corpo",
    label: "Recuo corpo vs frente (mm) — legado UI",
    value: String(settingsDefaults.gavetas.gavetaRecuoCorpoMm),
    formula: "Não usado em calculateDrawerSpecs — preferir percentuais de altura",
    sourceFile: "src/core/drawers/DrawerParametrics.ts",
    status: "legacy",
    notes: "Substituído por gavetaReducaoPercentual (factor único)",
  },
  {
    id: "reducao-laterais-percentual",
    label: "Redução das laterais (%)",
    value: String(settingsDefaults.gavetas.gavetaReducaoPercentual),
    formula:
      "f = 1 − %/100; sideH = frontH × f; backH = sideH × f; frontIntH = frontH × f",
    sourceFile: "src/core/drawers/drawerSolidWorksStackGeometry.ts",
    status: "official",
    notes: "Admin → Regras das Gavetas → Dimensões e Parametrização",
  },
  {
    id: "altura-min",
    label: "Altura mínima frente (mm)",
    value: String(settingsDefaults.gavetas.gavetaAlturaMinimaMm),
    sourceFile: "src/core/drawers/DrawerParametrics.ts",
    status: "official",
    notes: "Gera warning; não bloqueia geração",
  },
  {
    id: "altura-max",
    label: "Altura máxima frente (mm)",
    value: String(settingsDefaults.gavetas.gavetaAlturaMaximaMm),
    sourceFile: "src/core/drawers/DrawerParametrics.ts",
    status: "official",
  },
  {
    id: "profundidades",
    label: "Profundidades disponíveis (mm)",
    value: settingsDefaults.gavetas.gavetaProfundidadesDisponiveisMm.join(", "),
    formula: "nominalDepth = max(depth) ≤ boxInternalDepth",
    sourceFile: "src/core/drawers/DrawerParametrics.ts",
    status: "official",
  },
  {
    id: "runner-clearance",
    label: "Recuo profundidade corrediça (mm)",
    value: String(settingsDefaults.gavetas.gavetaRecuoProfundidadeCorredicaMm),
    formula: "legado UI — NÃO entra no bodyDepth; SSOT: sideDepth = bodyDepth − 10",
    sourceFile: "src/core/drawers/DrawerParametrics.ts",
    status: "legacy",
    notes:
      "P3.15: setting preservado no schema; profundidade industrial = sideDepth = bodyDepth − 10 (DRAWER_SIDE_DEPTH_SLIDE_CLEARANCE_MM).",
  },
  {
    id: "tipo-corredica",
    label: "Tipo de corrediça",
    value: settingsDefaults.gavetas.gavetaTipoCorredica,
    sourceFile: "src/components/admin/DrawerRulesAdminPage.tsx",
    status: "official",
  },
  {
    id: "soft-close",
    label: "Soft-close",
    value: String(settingsDefaults.gavetas.gavetaSoftClose),
    sourceFile: "src/core/drawers/DrawerParametrics.ts",
    status: "official",
  },
  {
    id: "caixa-metalica",
    label: "Caixa metálica",
    value: settingsDefaults.gavetas.gavetaTipoCaixaMetalica,
    sourceFile: "src/core/drawers/DrawerParametrics.ts",
    status: "official",
    notes: "Zera laterais/fundo/traseira na cutlist quando ativa",
  },
  {
    id: "modo-altura",
    label: "Modo altura padrão",
    value: settingsDefaults.gavetas.gavetaAlturaModoPadrao,
    sourceFile: "src/core/drawers/DrawerGroup.ts",
    status: "official",
  },
];

export const DRAWER_SYSTEM_DOMAINS: DrawerSystemDomain[] = [
  {
    id: "settings",
    title: "settings.gavetas — Regras industriais globais",
    description:
      "Fonte oficial de parâmetros. Editável em Admin → Regras das Gavetas e refletido aqui no Sistema Unificado.",
    status: "official",
    primaryFiles: [
      "src/core/settings/settingsSchema.ts",
      "src/core/settings/settingsValidation.ts",
      "src/components/admin/DrawerRulesAdminPage.tsx",
    ],
    rules: GAVETA_SETTINGS_RULES,
  },
  {
    id: "modern-parametrics",
    title: "Sistema moderno — DrawerParametrics + DrawerGroup",
    description: "Cálculo geométrico e distribuição vertical das gavetas.",
    status: "official",
    primaryFiles: [
      "src/core/drawers/DrawerParametrics.ts",
      "src/core/drawers/DrawerGroup.ts",
      "src/core/drawers/DrawerGenerationService.ts",
      "src/core/drawers/Drawer.ts",
    ],
    rules: [
      {
        id: "box-internal-width",
        label: "Largura interna caixa",
        value: "boxWidth - 2 × espessura",
        sourceFile: "src/core/drawers/DrawerGenerationService.ts",
        status: "official",
      },
      {
        id: "front-dims",
        label: "Dimensões frente",
        value: "largura/altura com folga frontal settings",
        formula: "frontWidth = internalW - 2×folgaFrente; frontHeight = drawerHeight - 2×folgaFrente",
        sourceFile: "src/core/drawers/DrawerParametrics.ts",
        status: "official",
      },
      {
        id: "height-equal",
        label: "Modo equal",
        value: "totalHeight / N",
        sourceFile: "src/core/drawers/DrawerGroup.ts",
        status: "official",
      },
      {
        id: "height-progressive-2",
        label: "Modo progressivo (2 gavetas)",
        value: "topo 40%, fundo 60%",
        sourceFile: "src/core/drawers/DrawerGroup.ts",
        status: "official",
      },
      {
        id: "height-progressive-3",
        label: "Modo progressivo (3+ gavetas)",
        value: "topo 20%, fundo 40%, meio dividido",
        sourceFile: "src/core/drawers/DrawerGroup.ts",
        status: "official",
      },
      {
        id: "position-z",
        label: "Posição Z frente",
        value: "boxDepth/2 + frontThickness/2",
        sourceFile: "src/core/drawers/DrawerGenerationService.ts",
        status: "official",
        notes: "Frente overlay fora da face frontal",
      },
      {
        id: "can-have-drawers",
        label: "Validação canBoxHaveDrawers",
        value: "min 50mm/gaveta, largura≥100, profundidade≥100",
        sourceFile: "src/core/drawers/DrawerGenerationService.ts",
        status: "migrate",
        notes: "Existe mas não é chamada em setGavetas (FASE 4)",
      },
    ],
  },
  {
    id: "layers-persist",
    title: "Persistência — drawersLayer (DrawerLayerItem)",
    description: "Fonte persistida no projeto; usada pelo Viewer e cutlist moderna.",
    status: "official",
    primaryFiles: [
      "src/models/BoxLayers.ts",
      "src/core/drawers/adapters/drawerGroupToLayerItems.ts",
      "src/services/boxLayersService.ts",
    ],
    rules: [
      {
        id: "regenerate",
        label: "Regeneração automática",
        value: "setGavetas → regenerateLayersForBox → generateDrawerGroup",
        sourceFile: "src/services/boxLayersService.ts",
        status: "official",
      },
      {
        id: "wardrobe-hj",
        label: "Roupeiros H/J",
        value: "gavetas zona inferior direita, heightMode equal forçado",
        sourceFile: "src/services/boxLayersService.ts",
        status: "official",
      },
      {
        id: "metadata",
        label: "metadata.drawerRules / drawerHardware",
        value: "Na frente da cutlist (slideType, metalBox, handle)",
        sourceFile: "src/services/drawerCutlistAdapter.ts",
        status: "official",
      },
    ],
  },
  {
    id: "legacy-manufacturing",
    title: "Sistema legado — boxManufacturing",
    description: "Ainda usado por CutlistPanel, PDF técnico e totais antigos. Migrar na FASE 2.",
    status: "legacy",
    primaryFiles: [
      "src/core/manufacturing/boxManufacturing.ts",
      "src/hooks/useCutlistData.ts",
      "src/core/pdf/gerarPdfTecnico.ts",
    ],
    rules: [
      {
        id: "leg-paineis-frente",
        label: "gerarPaineis — gavetas",
        value: "Só tipo gaveta_frente",
        formula: "larguraGaveta = largura - recuoGaveta×2; altura = box.alturaGaveta",
        sourceFile: "src/core/manufacturing/boxManufacturing.ts",
        sourceLines: "334-350",
        status: "legacy",
        notes: "Sem laterais, fundo, traseira",
      },
      {
        id: "leg-gerar-gavetas",
        label: "gerarGavetas",
        value: "recuoLateral 13mm, altura -40mm, corrediças: 1",
        sourceFile: "src/core/manufacturing/boxManufacturing.ts",
        sourceLines: "483-529",
        status: "legacy",
      },
      {
        id: "leg-ferragens",
        label: "gerarFerragens corrediças",
        value: "gavetas × 2",
        sourceFile: "src/core/manufacturing/boxManufacturing.ts",
        sourceLines: "386-388",
        status: "duplicate",
        notes: "Conflito com ferragens.ts e drawerCutlistAdapter",
      },
    ],
  },
  {
    id: "drilling",
    title: "Furação — unificada (FASE 3)",
    description:
      "Fonte única: DrawerDrillingRules.ts. Moderno (peças gaveta) + PI (laterais módulo) sincronizados via slideType/metalBoxType.",
    status: "official",
    primaryFiles: [
      "src/core/drawers/drilling/DrawerDrillingRules.ts",
      "src/core/drilling/drillingService.ts",
      "src/modules/drilling/drillingAdapter.ts",
      "src/data/moveisUnificados/pi/drilling.ts",
      "src/core/rules/rulesConfig.ts",
    ],
    rules: [
      {
        id: "drawer-drilling-rules",
        label: "getDrawerSlideDrillingRules",
        value: "settings.gavetas + rules.furos.tecnicos.corredica + metadata drawerRules",
        sourceFile: "src/core/drawers/drilling/DrawerDrillingRules.ts",
        status: "official",
        notes: "FASE 3 — API única",
      },
      {
        id: "calc-corredica",
        label: "calcCorredica (peças gaveta)",
        value: "1 linha Y; offsets de DrawerDrillingRules; caixa metálica → sem furos madeira",
        sourceFile: "src/core/drilling/drillingService.ts",
        status: "official",
        notes: "Delega a computeDrawerPieceCorredicaHoles",
      },
      {
        id: "pi-corredica",
        label: "PI — corrediça lateral",
        value: "drawersLayer>0: N linhas Y + offsets unificados; senão legado 3×37/69/293",
        sourceFile: "src/data/moveisUnificados/pi/drilling.ts",
        status: "official",
        notes: "drawersLayer.length = contagem oficial quando pipeline moderno ativo",
      },
      {
        id: "shelf-block",
        label: "Prateleiras vs gavetas",
        value: "hasDrawers desativa furos prateleira no módulo",
        sourceFile: "src/modules/drilling/drillingAdapter.ts",
        status: "official",
      },
    ],
  },
  {
    id: "hardware",
    title: "Ferragens / corrediças",
    description: "Três contagens diferentes hoje — unificar na FASE 2.",
    status: "duplicate",
    primaryFiles: [
      "src/services/drawerCutlistAdapter.ts",
      "src/core/ferragens/ferragens.ts",
      "src/core/manufacturing/boxManufacturing.ts",
      "src/core/drawers/DrawerBomService.ts",
    ],
    rules: [
      {
        id: "hw-cutlist",
        label: "drawerCutlistAdapter",
        value: "corrediça quantidade: 2 por gaveta",
        sourceFile: "src/services/drawerCutlistAdapter.ts",
        status: "official",
        notes: "Unificado FASE 2 (DRAWER_SLIDES_PER_DRAWER)",
      },
      {
        id: "hw-ferragens",
        label: "buildFerragens",
        value: "corrediça quantidade = gavetas × 2",
        sourceFile: "src/core/ferragens/ferragens.ts",
        status: "official",
        notes: "Unificado FASE 2",
      },
      {
        id: "hw-industrial",
        label: "gerarFerragens",
        value: "corredicas = gavetas × 2",
        sourceFile: "src/core/manufacturing/boxManufacturing.ts",
        status: "legacy",
      },
      {
        id: "hw-bom",
        label: "DrawerBomService",
        value: "extractDrawerBomFromLayerItems → drawerCutlistAdapter",
        sourceFile: "src/core/drawers/DrawerBomService.ts",
        status: "official",
        notes: "Integrado FASE 2 via extractDrawerIndustrialBomFromLayerItems",
      },
    ],
  },
  {
    id: "cutlist-export",
    title: "Cutlist + CNC/TCN",
    description: "Pipeline moderno via cutlistComPrecoFromBox; export industrial usa o mesmo merge.",
    status: "official",
    primaryFiles: [
      "src/core/manufacturing/cutlistFromBoxes.ts",
      "src/core/fabrication/buildCutlistItemsForIndustrialExport.ts",
      "src/core/cutlayout/cutLayoutProPieceNaming.ts",
    ],
    rules: [
      {
        id: "cutlist-merge",
        label: "Substituição frente legada",
        value: "Se drawersLayer.length > 0, ignora gaveta_frente de gerarPaineis",
        sourceFile: "src/core/manufacturing/cutlistFromBoxes.ts",
        status: "official",
      },
      {
        id: "cutlist-pieces",
        label: "Tipos de peça",
        value: "gaveta_frente, gaveta_lat_esq, gaveta_lat_dir, gaveta_fundo, gaveta_traseira",
        sourceFile: "src/services/drawerCutlistAdapter.ts",
        status: "official",
      },
      {
        id: "cnc-source",
        label: "Export CNC",
        value: "buildCutlistItemsForIndustrialExport → buildGlobalQrCutlistMerged",
        sourceFile: "src/core/fabrication/buildCutlistItemsForIndustrialExport.ts",
        status: "official",
      },
    ],
  },
  {
    id: "viewer",
    title: "Viewer 3D",
    description: "Renderização completa (frente + corpo + metálica opcional).",
    status: "official",
    primaryFiles: [
      "src/3d/objects/DrawerFactory.ts",
      "src/3d/objects/BoxAssembler.ts",
      "src/3d/objects/BoxUpdater.ts",
    ],
    rules: [
      {
        id: "viewer-parts",
        label: "Peças renderizadas",
        value: "front, left-side, right-side, bottom, back, metal-box, handle",
        sourceFile: "src/3d/objects/DrawerFactory.ts",
        status: "official",
      },
      {
        id: "viewer-motion",
        label: "Abertura",
        value: "Motion curves por slideType; duração industrial; sync isOpen via double-click",
        sourceFile: "src/3d/objects/DrawerFactory.ts",
        status: "official",
      },
      {
        id: "viewer-collisions",
        label: "Colisões",
        value: "DrawerCollisionService — portas, gavetas abertas, prateleiras, pés, limites internos",
        sourceFile: "src/core/drawers/DrawerCollisionService.ts",
        status: "official",
        notes: "FASE 5",
      },
    ],
  },
  {
    id: "ui",
    title: "Interface do utilizador",
    description: "Controlo de quantidade e edição por layer; modo altura sem UI dedicada.",
    status: "migrate",
    primaryFiles: [
      "src/components/layout/left-panel/HomeLeftPanelSelected.tsx",
      "src/components/layout/left-panel/BoxLayersPanel.tsx",
      "src/context/hooks/useLayerActions.ts",
    ],
    rules: [
      {
        id: "ui-count",
        label: "Quantidade gavetas",
        value: "0–4 (stepper)",
        sourceFile: "src/components/layout/left-panel/HomeLeftPanelSelected.tsx",
        status: "official",
      },
      {
        id: "ui-exclusivity",
        label: "Exclusividade porta/gaveta/prateleira",
        value: "gavetas>0 remove portas e prateleiras",
        sourceFile: "src/context/hooks/useLayerActions.ts",
        status: "official",
      },
      {
        id: "ui-height-mode",
        label: "drawerHeightMode",
        value: "API setDrawerHeightMode — sem UI",
        sourceFile: "src/context/hooks/useLayerActions.ts",
        status: "migrate",
        notes: "FASE 4",
      },
      {
        id: "ui-custom-y",
        label: "Posição Y custom",
        value: "altura - 10 offset (diferente de DrawerGroup)",
        sourceFile: "src/context/hooks/useLayerActions.ts",
        status: "duplicate",
      },
    ],
  },
  {
    id: "pdf",
    title: "PDF e etiquetas",
    description: "PDF técnico ainda no pipeline legado; etiquetas parcialmente mapeadas.",
    status: "legacy",
    primaryFiles: [
      "src/core/pdf/gerarPdfTecnico.ts",
      "src/core/pdf/pdfEtiquetas.ts",
      "src/hooks/useCutlistData.ts",
    ],
    rules: [
      {
        id: "pdf-tecnico",
        label: "gerarPdfTecnico",
        value: "cutlistComPrecoFromBox quando drawersLayer.length > 0",
        sourceFile: "src/core/pdf/gerarPdfTecnico.ts",
        status: "official",
        notes: "Unificado FASE 2; fallback legado sem drawersLayer",
      },
      {
        id: "pdf-etiquetas-fundo",
        label: "pdfEtiquetas inferPieceKind",
        value: "gaveta_fundo → GENERIC (sem FRENTE_GAVETA equivalente)",
        sourceFile: "src/core/pdf/pdfEtiquetas.ts",
        status: "migrate",
        notes: "FASE 2",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Inconsistências conhecidas
// ---------------------------------------------------------------------------

export const DRAWER_SYSTEM_INCONSISTENCIES: DrawerInconsistency[] = [
  {
    id: "dual-pipeline",
    severity: "medium",
    title: "CutlistPanel / PDF vs legado sem drawersLayer",
    description:
      "Com drawersLayer, CutlistPanel e PDF Técnico usam cutlistComPrecoFromBox (FASE 2). Caixas sem drawersLayer mantêm gerarModeloIndustrial.",
    modernSource: "useCutlistData.ts + gerarPdfTecnico.ts",
    legacySource: "boxManufacturing.ts (fallback)",
    resolveInPhase: 6,
  },
  {
    id: "corredica-count",
    severity: "low",
    title: "gerarFerragens legado vs pipeline moderno",
    description:
      "drawerCutlistAdapter e buildFerragens usam ×2 (FASE 2). boxManufacturing.gerarFerragens também ×2 — shim até FASE 6.",
    modernSource: "drawerCutlistAdapter.ts, ferragens.ts",
    legacySource: "boxManufacturing.gerarFerragens",
    resolveInPhase: 6,
  },
  {
    id: "legacy-dimensions",
    severity: "high",
    title: "Dimensões legado ≠ DrawerParametrics",
    description: "Legado usa recuoLateral 13mm e alturaInterna-40; moderno usa folga 7mm e recuoCorpo 70mm.",
    modernSource: "DrawerParametrics.ts",
    legacySource: "boxManufacturing.gerarGavetas",
    resolveInPhase: 2,
  },
  {
    id: "bom-not-wired",
    severity: "low",
    title: "DrawerBomService — domínio Drawer vs layers",
    description:
      "extractDrawerBomFromLayerItems integrado (FASE 2). Funções Drawer/DrawerGroup do BOM mantêm-se para uso direto do domínio 3D.",
    modernSource: "DrawerBomService.extractDrawerBomFromLayerItems",
    resolveInPhase: 6,
  },
  {
    id: "custom-height-y",
    severity: "low",
    title: "Posicionamento Y unificado",
    description:
      "FASE 5: resolveDrawerVerticalPosition usado em DrawerGroup, DrawerGenerationService e useLayerActions.",
    modernSource: "drawerVerticalPosition.ts",
    legacySource: "useLayerActions.ts (custom)",
    resolveInPhase: 5,
  },
  {
    id: "pi-drawer-count",
    severity: "low",
    title: "PI: numeroGavetas vs drawersLayer.length",
    description:
      "FASE 3: com drawersLayer.length>0, PI usa contagem oficial e regras unificadas; sem drawersLayer mantém 3 linhas fixas legado.",
    modernSource: "DrawerDrillingRules.resolvePiDrawerCountForDrilling",
    legacySource: "pi/drilling.ts addDrawerSlideHolesLegacy",
    resolveInPhase: 3,
  },
  {
    id: "runner-clearance-hardcoded",
    severity: "low",
    title: "gavetaRecuoProfundidadeCorredicaMm é legado UI (não reduz bodyDepth)",
    description:
      "P3.15: setting gavetaRecuoProfundidadeCorredicaMm (default 20) é legado UI. SSOT industrial: bodyDepth = nominalDepth; sideDepth = bodyDepth − 10. Não subtrair 20 do corpo.",
    modernSource: "drawerSlideDepth.ts resolveDrawerSideDepthMm",
    resolveInPhase: 6,
  },
  {
    id: "validation-not-enforced",
    severity: "low",
    title: "canBoxHaveDrawers na UI",
    description:
      "FASE 4: setGavetas invoca canBoxHaveDrawers e bloqueia contagens impossíveis; avisos em drawerConfigWarnings.",
    modernSource: "useLayerActions.setGavetas + drawerUiValidation.ts",
    resolveInPhase: 4,
  },
];

// ---------------------------------------------------------------------------
// Propostas por fase (referência — não executar agora)
// ---------------------------------------------------------------------------

export const DRAWER_PHASE_PROPOSALS: DrawerPhaseProposal[] = [
  {
    phase: 2,
    title: "Unificação Cutlist + CNC + PDF",
    actions: [
      "Migrar useCutlistData e gerarPdfTecnico para cutListComPreco / drawersLayer",
      "Unificar corrediças: 2 unidades por gaveta em todo o pipeline",
      "Integrar ou fundir DrawerBomService com drawerCutlistAdapter",
      "Deprecar gerarGavetas para caixas não-PI (manter shim temporário)",
      "Adicionar gaveta_fundo em pdfEtiquetas.inferPieceKind",
    ],
    files: [
      "src/hooks/useCutlistData.ts",
      "src/core/pdf/gerarPdfTecnico.ts",
      "src/services/drawerCutlistAdapter.ts",
      "src/core/ferragens/ferragens.ts",
      "src/core/drawers/DrawerBomService.ts",
    ],
  },
  {
    phase: 3,
    title: "Unificação furação",
    status: "completed",
    actions: [
      "Criado DrawerDrillingRules.ts com getDrawerSlideDrillingRules",
      "calcCorredica delega a regras unificadas",
      "PI: drawersLayer>0 usa N linhas + offsets unificados; legado preservado",
      "metalBoxType !== Nenhuma → sem furos corrediça em peças madeira gaveta",
      "softClose: +2mm vertical quando metadata.softClose === true",
    ],
    files: [
      "src/core/drawers/drilling/DrawerDrillingRules.ts",
      "src/core/drilling/drillingService.ts",
      "src/data/moveisUnificados/pi/drilling.ts",
      "src/core/manufacturing/cutlistFromBoxes.ts",
      "src/modules/drilling/drillingAdapter.ts",
    ],
  },
  {
    phase: 4,
    title: "UI completa das gavetas",
    status: "completed",
    actions: [
      "DrawerConfigPanel.tsx — configuração por gaveta (slideType, metalBox, softClose, handle, material, nominalDepth)",
      "BoxLayersPanel — modo de altura, tabela custom, badges, validações",
      "drawerUiValidation.ts + canBoxHaveDrawers em setGavetas",
      "metadata DrawerLayerMetadata em drawersLayer",
      "Preservação de overrides UI em regenerateLayersForBox",
    ],
    files: [
      "src/components/panels/DrawerConfigPanel.tsx",
      "src/components/layout/left-panel/BoxLayersPanel.tsx",
      "src/core/drawers/drawerUiValidation.ts",
      "src/core/drawers/drawerUiConstants.ts",
      "src/context/hooks/useLayerActions.ts",
      "src/services/boxLayersService.ts",
      "src/models/BoxLayers.ts",
    ],
  },
  {
    phase: 5,
    title: "Viewer + motion + colisões",
    status: "completed",
    actions: [
      "drawerVerticalPosition.ts — Y unificado (offset 10 mm)",
      "DrawerCollisionService.ts — colisões reais",
      "DrawerMotionCurves.ts — Tandem/Movento/Genérica",
      "Double-click gaveta no Viewer → setDrawerLayerItemOpen",
      "Metadata visual: metal box, rails genéricos, debug furação",
    ],
    files: [
      "src/core/drawers/drawerVerticalPosition.ts",
      "src/core/drawers/DrawerCollisionService.ts",
      "src/core/drawers/DrawerMotionCurves.ts",
      "src/3d/objects/DrawerFactory.ts",
      "src/components/layout/workspace/Workspace.tsx",
    ],
  },
  {
    phase: 6,
    title: "Limpeza legado",
    actions: [
      "Remover gerarGavetas/gaveta_frente duplicado de gerarPaineis",
      "Remover DrawerBomService se fundido",
      "Atualizar docs/drawers-system.md",
    ],
    files: ["src/core/manufacturing/boxManufacturing.ts"],
  },
];

// ---------------------------------------------------------------------------
// Chaves settings.gavetas para relatório
// ---------------------------------------------------------------------------

export const DRAWER_SETTINGS_KEYS: Array<{
  key: keyof SettingsSchema["gavetas"];
  label: string;
  defaultValue: string;
}> = (Object.keys(settingsDefaults.gavetas) as Array<keyof SettingsSchema["gavetas"]>).map((key) => {
  const val = settingsDefaults.gavetas[key];
  return {
    key,
    label: key,
    defaultValue: Array.isArray(val) ? val.join(", ") : String(val),
  };
});

// ---------------------------------------------------------------------------
// FASE 4 — UI das Gavetas
// ---------------------------------------------------------------------------

export const DRAWER_UI_PHASE4 = {
  before: {
    summary: "Stepper de quantidade; BoxLayersPanel com dimensões brutas; sem slideType/metalBox por gaveta; drawerHeightMode sem UI.",
    components: ["HomeLeftPanelSelected (stepper)", "BoxLayersPanel (dimensões)"],
  },
  after: {
    summary:
      "DrawerConfigPanel por gaveta; modo de altura; validações industriais; metadata espelhada; canBoxHaveDrawers em setGavetas.",
    components: [
      "DrawerConfigPanel.tsx",
      "DrawerCustomHeightsTable",
      "BoxLayersPanel (secção Gavetas)",
      "drawerUiValidation.ts",
    ],
  },
  editableFields: [
    "slideType",
    "metalBoxType",
    "softClose",
    "handleType",
    "handlePosition",
    "handleOffsetMm",
    "drawerType / type",
    "material / frontMaterial",
    "metadata.nominalDepth",
    "height (modo custom)",
    "drawerHeightMode (box)",
  ],
  validations: [
    "canBoxHaveDrawers — bloqueio em setGavetas",
    "altura min/max por gaveta — aviso",
    "soma alturas custom vs altura interna — aviso",
    "soft-close vs slideType — aviso",
    "caixa metálica vs altura/profundidade — aviso",
    "drawerWarnings do domínio — aviso",
  ],
  metadataFlow:
    "UI → updateDrawerLayerItem → DrawerLayerItem (+ metadata) → cutlist metadata.drawerRules / drawerHardware (FASE 2–3)",
} as const;

export const DRAWER_VIEWER_PHASE5 = {
  verticalPosition: {
    module: "drawerVerticalPosition.ts",
    baseOffsetMm: 10,
    consumers: ["DrawerGroup.calculateDrawerPositions", "DrawerGenerationService", "useLayerActions"],
  },
  collisions: {
    module: "DrawerCollisionService.ts",
    checks: [
      "outra gaveta aberta",
      "porta fechada",
      "prateleiras no módulo",
      "pés/rodapé vs gaveta inferior",
      "curso vs profundidade",
      "limites internos Y",
    ],
    integration: ["DrawerMotionService.canOpenDrawer", "useLayerActions.setDrawerLayerItemOpen"],
  },
  sync: {
    viewerToState: "double-click → setDrawerLayerItemOpen (isOpen + pullDistanceMm)",
    stateToViewer: "useCalculadoraSync fingerprint isOpen → rebuild/animate DrawerFactory",
  },
  motionCurves: ["tandemCurve", "moventoCurve", "genericSlideCurve", "softCloseTailCurve"],
  metadataVisual: {
    metalBoxType: "cor/estilo por tipo de caixa metálica",
    slideType: "corrediça invisível (Blum) ou rails visíveis (Genérica)",
    softClose: "curva composta mais lenta no final",
    handleType: "puxador/cava/perfil (existente, mantido)",
  },
  debugDrilling: {
    flag: "viewerSettings.showDrawerDrilling",
    renderer: "DrawerFactory — esferas vermelhas via DrawerDrillingRules",
  },
} as const;

// ---------------------------------------------------------------------------
// FASE 6 — Geometria industrial + overrides UI + remoção legado
// ---------------------------------------------------------------------------

export const DRAWER_GEOMETRY_PHASE6 = {
  nominalDepth: {
    source: "metadata.nominalDepth ou chooseNominalDepth automático",
    formula: "nominalDepth = override ?? max(depth ≤ boxInternalDepth)",
    consumer: "DrawerParametrics.calculateDrawerSpecs",
  },
  runnerClearance: {
    setting: "settings.gavetas.gavetaRecuoProfundidadeCorredicaMm",
    formula: "legado — não altera bodyDepth; SSOT: sideDepth = bodyDepth − 10",
    defaultMm: settingsDefaults.gavetas.gavetaRecuoProfundidadeCorredicaMm,
  },
  uiOverrides: {
    module: "drawerParametricOverrides.ts",
    fields: ["slideType", "metalBoxType", "softClose", "drawerType", "nominalDepth"],
    flow:
      "DrawerConfigPanel → drawersLayer.metadata → buildDrawerParametricOverridesList → generateDrawerGroup → calculateDrawerSpecs",
  },
  legacyRemoved: {
    gerarPaineisGavetaFrente: "bloco gaveta_frente removido de boxManufacturing.gerarPaineis",
    gerarGavetas: "shim vazio (não-PI); usar drawersLayer",
    gerarFerragensCorredicas: "omitido quando drawersLayer.length > 0",
    gerarGavetasLegado: "shim @deprecated vazio",
  },
  pipelineUnified:
    "settings.gavetas → DrawerParametrics (+ overrides UI) → DrawerGenerationService → drawersLayer → cutlist/furação/viewer",
  validations: [
    "profundidade nominal ≤ profundidade interna",
    "bodyDepth ≥ 50 mm",
    "profundidade compatível com caixa metálica (quando validação ativa)",
    "soft-close vs slideType",
  ],
} as const;

// ---------------------------------------------------------------------------
// Export para System Documentation (centro de ajuda — READ-ONLY)
// ---------------------------------------------------------------------------

export const DOCUMENTATION_EXPORT = {
  version: "1.0.0",
  lastUpdated: "2026-06-17",
  module: "drawers",
  exportedFields: [
    "DRAWER_OFFICIAL_PIPELINE",
    "DRAWER_LEGACY_PIPELINE",
    "DRAWER_SYSTEM_DOMAINS",
    "DRAWER_SYSTEM_INCONSISTENCIES",
    "DRAWER_PHASE_PROPOSALS",
    "DRAWER_UI_PHASE4",
    "DRAWER_VIEWER_PHASE5",
    "DRAWER_GEOMETRY_PHASE6",
    "DRAWER_SETTINGS_KEYS",
    "buildDrawerSystemReferenceReport",
    "countDrawerReferenceStats",
  ],
  markdownSources: ["src/core/drawers/DrawerIndustrialCertificationReport.md"],
  typescriptSources: ["src/core/drawers/DrawerSystemReference.ts"],
  testSuites: [
    "src/validation/drawerEuropeanSystem.test.ts",
    "src/validation/drawerGeometryPhase6.test.ts",
    "src/validation/drawerViewerPhase5.test.ts",
    "src/validation/drawerUiValidation.test.ts",
    "src/validation/drawerIndustrialRegression.test.ts",
    "src/validation/drawerStressTests.test.ts",
    "src/validation/drawerUiToIndustrialConsistency.test.ts",
    "src/validation/drawerCncCertification.test.ts",
    "src/validation/drawerPdfCertification.test.ts",
  ],
  uiEntry: "src/pages/HelpPage.tsx → System Documentation → Drawers System",
} as const;

// ---------------------------------------------------------------------------
// Relatório agregado
// ---------------------------------------------------------------------------

export function buildDrawerSystemReferenceReport(): DrawerSystemReferenceReport {
  return {
    generatedAt: new Date().toISOString(),
    officialPipeline: DRAWER_OFFICIAL_PIPELINE,
    domains: DRAWER_SYSTEM_DOMAINS,
    inconsistencies: DRAWER_SYSTEM_INCONSISTENCIES,
    phaseProposals: DRAWER_PHASE_PROPOSALS,
    settingsKeys: DRAWER_SETTINGS_KEYS,
  };
}

export function getDrawerRulesByStatus(status: DrawerRuleSourceStatus): DrawerRuleEntry[] {
  return DRAWER_SYSTEM_DOMAINS.flatMap((d) => d.rules.filter((r) => r.status === status));
}

export function countDrawerReferenceStats() {
  const allRules = DRAWER_SYSTEM_DOMAINS.flatMap((d) => d.rules);
  return {
    domains: DRAWER_SYSTEM_DOMAINS.length,
    rules: allRules.length,
    official: allRules.filter((r) => r.status === "official").length,
    legacy: allRules.filter((r) => r.status === "legacy").length,
    duplicate: allRules.filter((r) => r.status === "duplicate").length,
    migrate: allRules.filter((r) => r.status === "migrate").length,
    removeFuture: allRules.filter((r) => r.status === "remove_future").length,
    inconsistencies: DRAWER_SYSTEM_INCONSISTENCIES.length,
    highSeverity: DRAWER_SYSTEM_INCONSISTENCIES.filter((i) => i.severity === "high").length,
  };
}
