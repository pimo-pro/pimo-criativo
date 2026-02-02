import { safeGetItem, safeParseJson, safeSetItem } from "../../utils/storage";

export type TaskStatus = "todo" | "in_progress" | "done";

export type PhaseTask = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  notes?: string;
  date?: string;
};

export type Phase = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  notes?: string;
  date?: string;
  tasks: PhaseTask[];
};

export type RoadmapStats = {
  totalPhases: number;
  totalTasks: number;
  doneTasks: number;
  pendingTasks: number;
  progress: number;
  lastUpdated: string | null;
};

export const ROADMAP_STORAGE_KEY = "pimo_project_roadmap";
export const ROADMAP_UPDATED_AT_KEY = "pimo_project_roadmap_updated_at";

export const statusLabel: Record<TaskStatus, string> = {
  todo: "A Fazer",
  in_progress: "Em Progresso",
  done: "Concluído",
};

export const statusColor: Record<TaskStatus, string> = {
  todo: "status-todo",
  in_progress: "status-in_progress",
  done: "status-done",
};

const basePhases: Phase[] = [
  {
    id: "phase_1_core_layout",
    title: "Phase 1: Core Layout & Painéis",
    description: "Estrutura base de layout, painéis e fluxo principal.",
    status: "done",
    tasks: [
      {
        id: "phase1_task_layout",
        title: "Padronizar layout principal",
        description: "Flex, alturas mínimas e comportamento responsivo dos painéis.",
        status: "done",
      },
      {
        id: "phase1_task_panels",
        title: "Refinar comportamento dos painéis",
        description: "Remover scroll/resize indevido e unificar padrões visuais.",
        status: "done",
      },
    ],
  },
  {
    id: "phase_2_3d_foundation",
    title: "Phase 2: 3D Foundation",
    description: "Base técnica 3D com normalização e visualização consistente.",
    status: "in_progress",
    tasks: [
      {
        id: "phase2_task_fix",
        title: "Full Model Fix",
        description: "Escala, centralização e alinhamento do modelo 3D.",
        status: "done",
      },
      {
        id: "phase2_task_lights",
        title: "Iluminação base e sombras",
        description: "Luzes iniciais e preparação para realismo.",
        status: "in_progress",
      },
    ],
  },
  {
    id: "phase_3_3d_realism",
    title: "Phase 3: Realismo 3D",
    description: "HDRI, sombras suaves e materiais PBR realistas.",
    status: "in_progress",
    tasks: [
      {
        id: "phase3_task_hdri",
        title: "HDRI real e exposição",
        description: "Ambiente realista e controle de tone mapping.",
        status: "in_progress",
      },
      {
        id: "phase3_task_pbr",
        title: "Texturas PBR reais",
        description: "Mapas completos para madeira, metal e vidro.",
        status: "in_progress",
      },
      {
        id: "phase3_task_shadows",
        title: "Sombras suaves refinadas",
        description: "PCFSoft com bias/blur ajustados.",
        status: "in_progress",
      },
    ],
  },
  {
    id: "phase_3b_glb_integration",
    title: "Integração GLB → Sistema Multi-Box",
    description: "Pipeline unificado: carregar modelos GLB no viewer, extrair peças (meshes), integrar à Lista de Peças e ao Calculator.",
    status: "in_progress",
    tasks: [
      {
        id: "phase3b_extract_parts",
        title: "Extração de peças a partir de GLB",
        description: "extractPartsFromGLB(gltfScene), bounding box, posição, rotação e material hint em mm.",
        status: "done",
      },
      {
        id: "phase3b_cutlist_adapter",
        title: "Adaptador peças GLB → CutListItem",
        description: "glbPartsToCutListItems integrado ao sistema de lista de peças e preços.",
        status: "done",
      },
      {
        id: "phase3b_viewer_callback",
        title: "Callback onModelLoaded no Viewer",
        description: "Viewer notifica quando GLB é carregado; app extrai peças e atualiza estado.",
        status: "done",
      },
      {
        id: "phase3b_merge_calculator",
        title: "Merge na Lista de Peças e Calculator",
        description: "Peças paramétricas + peças extraídas de GLB; preço total atualizado automaticamente.",
        status: "done",
      },
    ],
  },
  {
    id: "phase_3c_multi_model",
    title: "Multi-Model & Multi-Box Expansion",
    description: "Múltiplos modelos GLB por caixa, categorias CAD, gestão completa (add/remove/rename/material/categoria), lista de peças e preço por modelo.",
    status: "in_progress",
    tasks: [
      {
        id: "phase3c_models_array",
        title: "Array models[] por caixa",
        description: "WorkspaceBox e BoxModule com models: BoxModelInstance[]; extractedPartsByBoxId aninhado por modelInstanceId.",
        status: "done",
      },
      {
        id: "phase3c_cad_categories",
        title: "Categorias de modelos CAD",
        description: "Sistema de categorias: portas, gavetas, acessórios, estrutura, decoração; filtro na UI.",
        status: "done",
      },
      {
        id: "phase3c_ui_models",
        title: "UI gestão de modelos por caixa",
        description: "Listar, adicionar, remover, renomear, material e categoria por instância; sync com viewer.",
        status: "done",
      },
      {
        id: "phase3c_cutlist_origin",
        title: "Lista de peças: paramétrico vs GLB",
        description: "sourceType e modelInstanceId em CutListItem; coluna Origem e totais com múltiplos modelos.",
        status: "done",
      },
    ],
  },
  {
    id: "phase_3d_multibox",
    title: "Phase 3d: MultiBoxManager & Arquitetura Viewer",
    description: "Interface multi-box no Viewer, módulo core/multibox, integração ao Workspace e documentação.",
    status: "done",
    tasks: [
      {
        id: "phase3d_interface_multibox",
        title: "Interface multi-box no Viewer",
        description: "Implementação completa: addBox, removeBox, updateBox, setBoxIndex, setBoxGap, addModelToBox, selectBox.",
        status: "done",
      },
      {
        id: "phase3d_modulo_multibox",
        title: "Módulo src/core/multibox/",
        description: "Tipos (MultiBoxViewerApi, MultiBoxManagerApi), multiBoxManager.ts, index.ts com re-exports.",
        status: "done",
      },
      {
        id: "phase3d_integracao_workspace",
        title: "Integração MultiBoxManager ao Workspace",
        description: "Workspace inicializa useMultiBoxManager; sincronização via useCalculadoraSync e useCadModelsSync.",
        status: "done",
      },
      {
        id: "phase3d_docs_multibox",
        title: "Documentação multibox-architecture.md",
        description: "docs/multibox-architecture.md com visão geral, diagrama, convenções e checklist.",
        status: "done",
      },
      {
        id: "phase3d_build_estavel",
        title: "Build estável e funcionalidades existentes",
        description: "Garantia de build estável e manutenção das funcionalidades existentes.",
        status: "done",
      },
      {
        id: "phase3d_painel_referencia",
        title: "Página dedicada Painel de Referência",
        description: "PainelReferencia.tsx em /painel-referencia com secções modulares.",
        status: "done",
      },
    ],
  },
  {
    id: "phase_4_material_system",
    title: "Phase 4: Sistema de Materiais Profissional",
    description: "Gestão avançada de materiais e presets reutilizáveis.",
    status: "in_progress",
    tasks: [
      {
        id: "phase4_task_presets",
        title: "Presets de materiais",
        description: "Catálogo com variações de madeira/metal/vidro.",
        status: "in_progress",
      },
      {
        id: "phase4_task_manager",
        title: "Editor de materiais",
        description: "Ferramenta para ajustar PBR em tempo real.",
        status: "todo",
      },
    ],
  },
  {
    id: "phase_4b_dynamic_rules",
    title: "Fase 4: Dynamic Rules & Smart Behaviors",
    description: "Regras dinâmicas por modelo GLB, auto-positioning, constraints e UI de gestão de regras.",
    status: "in_progress",
    tasks: [
      {
        id: "phase4b_rules_module",
        title: "Módulo core/rules (tipos, validação, regras por modelo)",
        description: "Estrutura para regras de dimensão, material, compatibilidade e comportamento; validação e armazenamento.",
        status: "done",
      },
      {
        id: "phase4b_auto_positioning",
        title: "Auto-positioning e snapping",
        description: "Posicionamento automático, evitar sobreposição, snapping e alinhamento inteligente.",
        status: "done",
      },
      {
        id: "phase4b_smart_constraints",
        title: "Smart constraints e validação em tempo real",
        description: "Impedir combinações inválidas; validar posições e dimensões; integrar com estado.",
        status: "done",
      },
      {
        id: "phase4b_ui_rules",
        title: "UI para gestão de regras e avisos de violação",
        description: "Painel de regras (Admin), avisos no LeftPanel e ativar/desativar regras.",
        status: "done",
      },
      {
        id: "phase4b_docs",
        title: "Documentação e referência Fase 4",
        description: "docs/dynamic-rules-reference.md, Roadmap e Painel de Referência.",
        status: "done",
      },
    ],
  },
  {
    id: "phase_5_smart_layout",
    title: "Fase 5: Smart Layout Engine & Auto-Placement",
    description: "Auto-positioning no viewer, deteção de colisões e limites, Smart Arrangement e UI de controlo de layout (painel Modelos).",
    status: "in_progress",
    tasks: [
      {
        id: "phase5_layout_viewer",
        title: "Auto-positioning e API de layout no Viewer",
        description: "getBoxDimensions, getModelPosition, getModelBoundingBoxSize, setModelPosition; aplicar posição ao adicionar modelo.",
        status: "done",
      },
      {
        id: "phase5_layout_collisions",
        title: "Deteção de colisões e limites",
        description: "computeLayoutWarnings, layoutWarnings no estado; LayoutWarningsAlert no painel Modelos.",
        status: "done",
      },
      {
        id: "phase5_layout_ui",
        title: "Sidebar Modelos e LeftPanel por tab",
        description: "Ícone Modelos na sidebar; painel Modelos com lista de modelos, regras, layout (Auto-Organizar, Snap, Reset).",
        status: "done",
      },
      {
        id: "phase5_layout_docs",
        title: "Documentação Fase 5",
        description: "docs/smart-layout-reference.md, Painel de Referência (página dedicada).",
        status: "done",
      },
    ],
  },
  {
    id: "phase_5_ui_ux",
    title: "Phase 5b: UI/UX Avançado",
    description: "Melhorias visuais e fluxo de interação. Parcialmente concluída.",
    status: "in_progress",
    tasks: [
      {
        id: "phase5_task_painel_referencia",
        title: "Página dedicada Painel de Referência",
        description: "PainelReferencia.tsx em /painel-referencia; secções modulares em painelReferenciaSections.ts; botão no Header redireciona.",
        status: "done",
      },
      {
        id: "phase5_task_consistency",
        title: "Consistência visual total",
        description: "Inputs, botões e painéis com padrão único.",
        status: "todo",
      },
      {
        id: "phase5_task_accessibility",
        title: "Acessibilidade e feedback",
        description: "Estados visuais, atalhos e mensagens claras.",
        status: "todo",
      },
      {
        id: "phase5_task_viewer_stubs",
        title: "Expansão viewer: snapshot, 2D e renderização",
        description: "Implementar stubs documentados no viewerApiAdapter (snapshot, vistas 2D, render).",
        status: "in_progress",
      },
    ],
  },
  {
    id: "phase_6_configurador",
    title: "Phase 6: Integração Completa do Configurador 3D",
    description:
      "Integração do configurador 3D com MultiBoxManager, UI multi-box, PIMO Calculator e unificação de padrões. " +
      "Depende de Phase 3d (MultiBoxManager) e Phase 5 (Smart Layout) concluídas. " +
      "Fases 7–11 (Performance, Export, AI, Marketplace, Launch) dependem da conclusão desta phase para integração total do configurador.",
    status: "todo",
    tasks: [
      {
        id: "phase6_config_integracao",
        title: "Integração configurador 3D com MultiBoxManager",
        description: "Preparar e integrar o configurador 3D com o MultiBoxManager.",
        status: "todo",
      },
      {
        id: "phase6_config_ui_multibox",
        title: "UI para manipulação de múltiplos boxes",
        description: "Seleção, reorder e propriedades de múltiplos boxes na interface.",
        status: "todo",
      },
      {
        id: "phase6_config_calculator",
        title: "Integrar MultiBoxManager ao PIMO Calculator",
        description: "Conexão entre MultiBoxManager e módulo de cálculo/precificação.",
        status: "todo",
      },
      {
        id: "phase6_config_unificar",
        title: "Unificar padrões de viewer e sincronização",
        description: "Padrões consistentes em Workspace, DevActions e demais módulos.",
        status: "todo",
      },
    ],
  },
  {
    id: "phase_7_performance",
    title: "Phase 7: Performance & Otimização",
    description: "Otimização de renderização e uso de memória.",
    status: "todo",
    tasks: [
      {
        id: "phase7_task_3d",
        title: "Otimização 3D",
        description: "LOD, instancing e caching de assets.",
        status: "todo",
      },
      {
        id: "phase7_task_ui",
        title: "Otimização UI",
        description: "Re-render controlado e redução de cálculos.",
        status: "todo",
      },
    ],
  },
  {
    id: "phase_8_export",
    title: "Phase 8: Exportação (Imagem, PDF, JSON)",
    description: "Exportações profissionais e integradas.",
    status: "todo",
    tasks: [
      {
        id: "phase8_task_image",
        title: "Exportação de imagem",
        description: "Snapshot com qualidade e configurações.",
        status: "todo",
      },
      {
        id: "phase8_task_json",
        title: "Exportação JSON",
        description: "Formato estruturado do projeto.",
        status: "todo",
      },
    ],
  },
  {
    id: "phase_9_ai",
    title: "Phase 9: Integração com AI",
    description: "Sugestões automáticas e assistência inteligente.",
    status: "todo",
    tasks: [
      {
        id: "phase9_task_prompt",
        title: "Prompting e recomendações",
        description: "Base de dados para sugestões inteligentes.",
        status: "todo",
      },
      {
        id: "phase9_task_autodesign",
        title: "Auto-design assistido",
        description: "Geração de propostas com AI.",
        status: "todo",
      },
    ],
  },
  {
    id: "phase_10_marketplace",
    title: "Phase 10: Marketplace de Módulos",
    description: "Biblioteca e partilha de módulos.",
    status: "todo",
    tasks: [
      {
        id: "phase10_task_catalog",
        title: "Catálogo de módulos",
        description: "Upload e gestão de módulos.",
        status: "todo",
      },
      {
        id: "phase10_task_distribution",
        title: "Distribuição e licenças",
        description: "Planos e permissões.",
        status: "todo",
      },
    ],
  },
  {
    id: "phase_11_launch",
    title: "Phase 11: Lançamento Global",
    description: "Preparação final e go‑to‑market.",
    status: "todo",
    tasks: [
      {
        id: "phase11_task_polish",
        title: "Polimento final",
        description: "Correções finais e qualidade.",
        status: "todo",
      },
      {
        id: "phase11_task_release",
        title: "Release global",
        description: "Deploy e comunicação.",
        status: "todo",
      },
    ],
  },
];

const isTaskStatus = (value: unknown): value is TaskStatus =>
  value === "todo" || value === "in_progress" || value === "done";

const isPhaseTask = (value: unknown): value is PhaseTask => {
  if (!value || typeof value !== "object") return false;
  const task = value as Partial<PhaseTask>;
  return (
    typeof task.id === "string" &&
    typeof task.title === "string" &&
    typeof task.description === "string" &&
    isTaskStatus(task.status)
  );
};

const computePhaseStatus = (tasks: PhaseTask[]): TaskStatus => {
  if (tasks.length === 0) return "todo";
  if (tasks.every((task) => task.status === "done")) return "done";
  if (tasks.some((task) => task.status === "in_progress")) return "in_progress";
  return "todo";
};

const normalizePhase = (phase: Phase): Phase => {
  const status = isTaskStatus(phase.status) ? phase.status : computePhaseStatus(phase.tasks);
  return { ...phase, status };
};

const isPhase = (value: unknown): value is Phase => {
  if (!value || typeof value !== "object") return false;
  const phase = value as Partial<Phase>;
  return (
    typeof phase.id === "string" &&
    typeof phase.title === "string" &&
    typeof phase.description === "string" &&
    Array.isArray(phase.tasks) &&
    phase.tasks.every(isPhaseTask)
  );
};

export const getStoredPhases = (): Phase[] => {
  const raw = safeGetItem(ROADMAP_STORAGE_KEY);
  const parsed = safeParseJson<unknown>(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isPhase).map(normalizePhase);
};

export const saveStoredPhases = (phases: Phase[]) => {
  safeSetItem(ROADMAP_STORAGE_KEY, JSON.stringify(phases));
  safeSetItem(ROADMAP_UPDATED_AT_KEY, new Date().toISOString());
};

export const mergePhases = (storedPhases: Phase[]) => {
  if (storedPhases.length === 0) return basePhases;
  const storedMap = new Map(storedPhases.map((phase) => [phase.id, normalizePhase(phase)]));
  const merged = basePhases.map((phase) => storedMap.get(phase.id) ?? phase);
  const custom = storedPhases
    .filter((phase) => !basePhases.find((b) => b.id === phase.id))
    .map(normalizePhase);
  return [...merged, ...custom];
};

export const getRoadmap = () => mergePhases(getStoredPhases());

export const getPhaseProgress = (phase: Phase): number => {
  if (phase.tasks.length === 0) return 0;
  const done = phase.tasks.filter((task) => task.status === "done").length;
  return Math.round((done / phase.tasks.length) * 100);
};

export const getGlobalProgress = (phases: Phase[]) => {
  const total = phases.reduce((sum, phase) => sum + phase.tasks.length, 0);
  const done = phases.reduce(
    (sum, phase) => sum + phase.tasks.filter((task) => task.status === "done").length,
    0
  );
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
};

export const getCurrentPhase = (phases: Phase[]) => {
  return phases.find((phase) => phase.tasks.some((task) => task.status !== "done")) ?? phases[0];
};

export const getRoadmapStats = (phases: Phase[]): RoadmapStats => {
  const totalTasks = phases.reduce((sum, phase) => sum + phase.tasks.length, 0);
  const doneTasks = phases.reduce(
    (sum, phase) => sum + phase.tasks.filter((task) => task.status === "done").length,
    0
  );
  const pendingTasks = totalTasks - doneTasks;
  const lastUpdated = safeGetItem(ROADMAP_UPDATED_AT_KEY);
  return {
    totalPhases: phases.length,
    totalTasks,
    doneTasks,
    pendingTasks,
    progress: getGlobalProgress(phases),
    lastUpdated,
  };
};

/**
 * Dependências entre fases. Todas as fases devem constar.
 * Sem pré-requisitos: []. Com dependências: ["phase_X", "phase_Y"].
 * Formato: { phase_id: ["phase_X", ...] }
 */
export const PHASE_DEPENDENCIES: Record<string, string[]> = {
  phase_1_core_layout: [],
  phase_2_3d_foundation: [],
  phase_3_3d_realism: [],
  phase_3b_glb_integration: [],
  phase_3c_multi_model: [],
  phase_3d_multibox: [],
  phase_4_material_system: [],
  phase_4b_dynamic_rules: [],
  phase_5_smart_layout: [],
  phase_5_ui_ux: [],
  phase_6_configurador: ["phase_3d_multibox", "phase_5_smart_layout"],
  phase_7_performance: ["phase_6_configurador"],
  phase_8_export: ["phase_6_configurador"],
  phase_9_ai: ["phase_6_configurador"],
  phase_10_marketplace: ["phase_6_configurador"],
  phase_11_launch: ["phase_6_configurador", "phase_7_performance", "phase_8_export"],
};

export const roadmapInstructions = [
  "As alterações devem ser feitas diretamente no ProjectRoadmap.",
  "Cada edição/adição/exclusão é registada automaticamente no Painel de Referência.",
  "Resumo de progresso em core/docs/progressoResumo.ts.",
  "Índice de arquitetura (módulos, fluxos, docs) em core/docs/architectureIndex.ts.",
  "Phase 6 depende de Phase 3d e Phase 5; Phases 7–11 dependem de Phase 6. Ver PHASE_DEPENDENCIES.",
  "OBRIGATÓRIO: Novas fases devem declarar dependências em PHASE_DEPENDENCIES: { phase_id: [\"phase_X\", ...] }.",
  "Fases sem dependências: usar array vazio []; fases dependentes: listar IDs exatos das fases pré-requisito.",
];
