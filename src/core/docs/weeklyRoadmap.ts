import { safeGetItem, safeParseJson, safeSetItem } from "../../utils/storage";

export type TaskStatus = "todo" | "in_progress" | "done";

export type WeeklyTask = {
  id: string;
  status: TaskStatus;
  title: string;
  description: string;
  notes?: string;
};

export type StoredWeeklyTask = WeeklyTask & {
  weekId: string;
  createdAt: string;
};

export type WeekPlan = {
  id: string;
  summary: string;
  tasks: WeeklyTask[];
};

export const statusLabel: Record<TaskStatus, string> = {
  todo: "A Fazer",
  in_progress: "Em Progresso",
  done: "Concluído",
};

const STORAGE_KEY = "pimo_weekly_roadmap_tasks";
const STORAGE_STATUS_KEY = "pimo_weekly_roadmap_status_overrides";

const isTaskStatus = (value: unknown): value is TaskStatus =>
  value === "todo" || value === "in_progress" || value === "done";

export const weeklyRoadmapWeeks: WeekPlan[] = [
  {
    id: "Semana 1",
    summary: "Full Model Fix 3D concluída e correções de resize/scroll finalizadas.",
    tasks: [
      {
        id: "base_s1_full_model_fix",
        status: "done",
        title: "Full Model Fix 3D",
        description: "Escala, centralização e alinhamento do modelo 3D.",
      },
      {
        id: "base_s1_resize_scroll_fix",
        status: "done",
        title: "Correção de resize vertical e scroll global",
        description: "Remover handles verticais e restaurar rolagem global.",
      },
    ],
  },
  {
    id: "Semana 2",
    summary: "Realismo 3D em andamento.",
    tasks: [
      {
        id: "base_s2_lighting_hdr",
        status: "in_progress",
        title: "Iluminação realista (HDRI + luz ambiente + direcional)",
        description: "Base de iluminação física para realismo.",
      },
      {
        id: "base_s2_pbr_base",
        status: "todo",
        title: "Materiais PBR básicos",
        description: "Aplicar MeshStandardMaterial com parâmetros iniciais.",
      },
      {
        id: "base_s2_soft_shadows",
        status: "todo",
        title: "Sombras suaves e contato com o piso",
        description: "Sombras realistas com suavização e contato.",
      },
    ],
  },
  {
    id: "Semana 3",
    summary: "Planejamento futuro.",
    tasks: [
      {
        id: "base_s3_define_focus",
        status: "todo",
        title: "Definir foco da semana",
        description: "Adicionar tarefas conforme o progresso do projeto.",
      },
    ],
  },
  {
    id: "Semana 4",
    summary: "Planejamento futuro.",
    tasks: [
      {
        id: "base_s4_define_focus",
        status: "todo",
        title: "Definir foco da semana",
        description: "Adicionar tarefas conforme o progresso do projeto.",
      },
    ],
  },
  {
    id: "Semana 5",
    summary: "Planejamento futuro.",
    tasks: [
      {
        id: "base_s5_define_focus",
        status: "todo",
        title: "Definir foco da semana",
        description: "Adicionar tarefas conforme o progresso do projeto.",
      },
    ],
  },
];

export const currentWeekId = "Semana 2";

export const weeklyRoadmapInstructions = [
  "As próximas interações com o Cursor devem seguir este plano semanal.",
  "Cada tarefa concluída deve ser marcada como concluída no WeeklyRoadmap e documentada no Painel de Referência e na Documentação do Sistema.",
];

export const getCurrentWeek = () =>
  weeklyRoadmapWeeks.find((week) => week.id === currentWeekId) ?? weeklyRoadmapWeeks[0];

export const getStoredWeeklyTasks = (): StoredWeeklyTask[] => {
  const raw = safeGetItem(STORAGE_KEY);
  const parsed = safeParseJson<unknown>(raw);
  if (!Array.isArray(parsed)) return [];
  const items: StoredWeeklyTask[] = [];
  parsed.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const task = item as Partial<StoredWeeklyTask>;
    if (
      typeof task.id !== "string" ||
      typeof task.weekId !== "string" ||
      typeof task.title !== "string" ||
      typeof task.description !== "string" ||
      typeof task.createdAt !== "string" ||
      !isTaskStatus(task.status)
    ) {
      return;
    }
    items.push({
      id: task.id,
      weekId: task.weekId,
      title: task.title,
      description: task.description,
      status: task.status,
      createdAt: task.createdAt,
      notes: typeof task.notes === "string" ? task.notes : undefined,
    });
  });
  return items;
};

export const saveStoredWeeklyTasks = (tasks: StoredWeeklyTask[]) => {
  safeSetItem(STORAGE_KEY, JSON.stringify(tasks));
};

export const addStoredWeeklyTask = (
  task: Omit<StoredWeeklyTask, "id" | "createdAt">
) => {
  const tasks = getStoredWeeklyTasks();
  const nextTask: StoredWeeklyTask = {
    ...task,
    id: `user_${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  const next = [...tasks, nextTask];
  saveStoredWeeklyTasks(next);
  return nextTask;
};

export const getStatusOverrides = (): Record<string, TaskStatus> => {
  const raw = safeGetItem(STORAGE_STATUS_KEY);
  const parsed = safeParseJson<unknown>(raw);
  if (!parsed || typeof parsed !== "object") return {};
  return Object.entries(parsed as Record<string, unknown>).reduce(
    (acc, [key, value]) => {
      if (isTaskStatus(value)) {
        acc[key] = value;
      }
      return acc;
    },
    {} as Record<string, TaskStatus>
  );
};

export const saveStatusOverrides = (overrides: Record<string, TaskStatus>) => {
  safeSetItem(STORAGE_STATUS_KEY, JSON.stringify(overrides));
};

export const setTaskStatus = (
  taskId: string,
  status: TaskStatus,
  storedTasks: StoredWeeklyTask[]
): StoredWeeklyTask[] => {
  const storedIndex = storedTasks.findIndex((task) => task.id === taskId);
  if (storedIndex >= 0) {
    const next = storedTasks.map((task) =>
      task.id === taskId ? { ...task, status } : task
    );
    saveStoredWeeklyTasks(next);
    return next;
  }
  const overrides = getStatusOverrides();
  const nextOverrides = { ...overrides, [taskId]: status };
  saveStatusOverrides(nextOverrides);
  return storedTasks;
};

export const mergeWeeklyRoadmap = (
  storedTasks: StoredWeeklyTask[],
  statusOverrides: Record<string, TaskStatus>
) =>
  weeklyRoadmapWeeks.map((week) => ({
    ...week,
    tasks: [
      ...week.tasks.map((task) => ({
        ...task,
        status: statusOverrides[task.id] ?? task.status,
      })),
      ...storedTasks.filter((task) => task.weekId === week.id),
    ],
  }));

export const getCurrentWeekWithStoredTasks = (
  storedTasks: StoredWeeklyTask[],
  statusOverrides: Record<string, TaskStatus>
) => {
  const merged = mergeWeeklyRoadmap(storedTasks, statusOverrides);
  return merged.find((week) => week.id === currentWeekId) ?? merged[0];
};
