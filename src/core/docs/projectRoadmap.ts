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
    id: "phase_5_ui_ux",
    title: "Phase 5: UI/UX Avançado",
    description: "Melhorias visuais e fluxo de interação.",
    status: "todo",
    tasks: [
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
    ],
  },
  {
    id: "phase_6_performance",
    title: "Phase 6: Performance & Otimização",
    description: "Otimização de renderização e uso de memória.",
    status: "todo",
    tasks: [
      {
        id: "phase6_task_3d",
        title: "Otimização 3D",
        description: "LOD, instancing e caching de assets.",
        status: "todo",
      },
      {
        id: "phase6_task_ui",
        title: "Otimização UI",
        description: "Re-render controlado e redução de cálculos.",
        status: "todo",
      },
    ],
  },
  {
    id: "phase_7_export",
    title: "Phase 7: Exportação (Imagem, PDF, JSON)",
    description: "Exportações profissionais e integradas.",
    status: "todo",
    tasks: [
      {
        id: "phase7_task_image",
        title: "Exportação de imagem",
        description: "Snapshot com qualidade e configurações.",
        status: "todo",
      },
      {
        id: "phase7_task_json",
        title: "Exportação JSON",
        description: "Formato estruturado do projeto.",
        status: "todo",
      },
    ],
  },
  {
    id: "phase_8_ai",
    title: "Phase 8: Integração com AI",
    description: "Sugestões automáticas e assistência inteligente.",
    status: "todo",
    tasks: [
      {
        id: "phase8_task_prompt",
        title: "Prompting e recomendações",
        description: "Base de dados para sugestões inteligentes.",
        status: "todo",
      },
      {
        id: "phase8_task_autodesign",
        title: "Auto-design assistido",
        description: "Geração de propostas com AI.",
        status: "todo",
      },
    ],
  },
  {
    id: "phase_9_marketplace",
    title: "Phase 9: Marketplace de Módulos",
    description: "Biblioteca e partilha de módulos.",
    status: "todo",
    tasks: [
      {
        id: "phase9_task_catalog",
        title: "Catálogo de módulos",
        description: "Upload e gestão de módulos.",
        status: "todo",
      },
      {
        id: "phase9_task_distribution",
        title: "Distribuição e licenças",
        description: "Planos e permissões.",
        status: "todo",
      },
    ],
  },
  {
    id: "phase_10_launch",
    title: "Phase 10: Lançamento Global",
    description: "Preparação final e go‑to‑market.",
    status: "todo",
    tasks: [
      {
        id: "phase10_task_polish",
        title: "Polimento final",
        description: "Correções finais e qualidade.",
        status: "todo",
      },
      {
        id: "phase10_task_release",
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

export const roadmapInstructions = [
  "As alterações devem ser feitas diretamente no ProjectRoadmap.",
  "Cada edição/adição/exclusão é registada automaticamente no Painel de Referência.",
];
