import { useMemo, useState } from "react";
import Panel from "../components/ui/Panel";
import { useProject } from "../context/useProject";
import type { Phase, PhaseTask, RoadmapStats } from "../core/docs/projectRoadmap";
import {
  getCurrentPhase,
  getGlobalProgress,
  getPhaseProgress,
  getRoadmap,
  getRoadmapStats,
  saveStoredPhases,
  statusLabel,
  statusColor,
} from "../core/docs/projectRoadmap";

const formatDate = (value?: string | null) => {
  if (!value) return "Sem data definida";
  try {
    return new Date(value).toLocaleDateString("pt-PT");
  } catch {
    return value;
  }
};

export default function ProjectRoadmap() {
  const { actions } = useProject();
  const [phases, setPhases] = useState<Phase[]>(() => getRoadmap());
  const [newPhaseTitle, setNewPhaseTitle] = useState("");
  const [newPhaseDescription, setNewPhaseDescription] = useState("");
  const [newPhaseNotes, setNewPhaseNotes] = useState("");

  const stats = useMemo<RoadmapStats>(() => getRoadmapStats(phases), [phases]);
  const currentPhase = useMemo(() => getCurrentPhase(phases), [phases]);
  const globalProgress = useMemo(() => getGlobalProgress(phases), [phases]);

  const persist = (next: Phase[], message: string) => {
    setPhases(next);
    saveStoredPhases(next);
    actions.logChangelog(message);
  };

  const updatePhase = (phaseId: string, updater: (phase: Phase) => Phase) => {
    setPhases((prev) => prev.map((phase) => (phase.id === phaseId ? updater(phase) : phase)));
  };

  const updateTask = (
    phaseId: string,
    taskId: string,
    updater: (task: PhaseTask) => PhaseTask
  ) => {
    setPhases((prev) =>
      prev.map((phase) =>
        phase.id === phaseId
          ? {
              ...phase,
              tasks: phase.tasks.map((task) =>
                task.id === taskId ? updater(task) : task
              ),
            }
          : phase
      )
    );
  };

  const handleSavePhase = (phaseId: string) => {
    persist(phases, `Phase atualizada: ${phaseId}`);
  };

  const handlePhaseStatusChange = (phaseId: string, status: Phase["status"]) => {
    const next = phases.map((phase) =>
      phase.id === phaseId ? { ...phase, status } : phase
    );
    persist(next, `Status da phase atualizado: ${phaseId} → ${statusLabel[status]}`);
  };

  const handleSaveTask = (taskId: string) => {
    persist(phases, `Tarefa atualizada: ${taskId}`);
  };

  const handleAddPhase = () => {
    const title = newPhaseTitle.trim();
    const description = newPhaseDescription.trim();
    if (!title || !description) return;
    const nextPhase: Phase = {
      id: `phase_${Date.now()}`,
      title,
      description,
      notes: newPhaseNotes.trim() || undefined,
      status: "todo",
      tasks: [],
    };
    const next = [...phases, nextPhase];
    persist(next, `Nova Phase criada: ${title}`);
    setNewPhaseTitle("");
    setNewPhaseDescription("");
    setNewPhaseNotes("");
  };

  const handleDeletePhase = (phaseId: string) => {
    const next = phases.filter((phase) => phase.id !== phaseId);
    persist(next, `Phase removida: ${phaseId}`);
  };

  const handleMovePhase = (index: number, direction: "up" | "down") => {
    const next = [...phases];
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= next.length) return;
    const temp = next[index];
    next[index] = next[target];
    next[target] = temp;
    persist(next, `Phase reordenada: ${temp.id}`);
  };

  const handleAddTask = (phaseId: string) => {
    const task: PhaseTask = {
      id: `task_${Date.now()}`,
      title: "Nova tarefa",
      description: "Descreva a tarefa",
      status: "todo",
    };
    const next = phases.map((phase) =>
      phase.id === phaseId ? { ...phase, tasks: [...phase.tasks, task] } : phase
    );
    persist(next, `Tarefa criada em ${phaseId}`);
  };

  const handleDeleteTask = (phaseId: string, taskId: string) => {
    const next = phases.map((phase) =>
      phase.id === phaseId
        ? { ...phase, tasks: phase.tasks.filter((task) => task.id !== taskId) }
        : phase
    );
    persist(next, `Tarefa removida: ${taskId}`);
  };

  const handleMoveTask = (fromPhaseId: string, toPhaseId: string, taskId: string) => {
    if (fromPhaseId === toPhaseId) return;
    let moved: PhaseTask | null = null;
    const next = phases.map((phase) => {
      if (phase.id === fromPhaseId) {
        const remaining = phase.tasks.filter((task) => {
          if (task.id === taskId) {
            moved = task;
            return false;
          }
          return true;
        });
        return { ...phase, tasks: remaining };
      }
      return phase;
    });
    if (!moved) return;
    const final = next.map((phase) =>
      phase.id === toPhaseId ? { ...phase, tasks: [...phase.tasks, moved as PhaseTask] } : phase
    );
    persist(final, `Tarefa movida: ${taskId} → ${toPhaseId}`);
  };

  const handleStatusChange = (phaseId: string, taskId: string, status: PhaseTask["status"]) => {
    updateTask(phaseId, taskId, (task) => ({ ...task, status }));
    persist(
      phases.map((phase) =>
        phase.id === phaseId
          ? {
              ...phase,
              tasks: phase.tasks.map((task) =>
                task.id === taskId ? { ...task, status } : task
              ),
            }
          : phase
      ),
      `Status atualizado: ${taskId} → ${statusLabel[status]}`
    );
  };

  return (
    <main className="page-root">
      <Panel title="Project Roadmap (Phases)">
        <div className="muted-text">
          Roadmap sequencial e expansível com Phases. Alterações são persistidas e registradas.
        </div>
      </Panel>

      <Panel title="Estatísticas do Projeto">
        <div className="roadmap-stats">
          <div className="stat-card">
            <div className="muted-text">Total de Phases</div>
            <div className="stat-value">{stats.totalPhases}</div>
          </div>
          <div className="stat-card">
            <div className="muted-text">Total de tarefas</div>
            <div className="stat-value">{stats.totalTasks}</div>
          </div>
          <div className="stat-card">
            <div className="muted-text">Concluídas</div>
            <div className="stat-value">{stats.doneTasks}</div>
          </div>
          <div className="stat-card">
            <div className="muted-text">Pendentes</div>
            <div className="stat-value">{stats.pendingTasks}</div>
          </div>
          <div className="stat-card">
            <div className="muted-text">Progresso global</div>
            <div className="stat-value">{stats.progress}%</div>
          </div>
          <div className="stat-card">
            <div className="muted-text">Última atualização</div>
            <div className="stat-value">{formatDate(stats.lastUpdated)}</div>
          </div>
        </div>
      </Panel>

      <Panel title="Progresso Global">
        <div className="progress-track">
          <div className="progress-bar" style={{ width: `${globalProgress}%` }} />
        </div>
        <div className="muted-text">Progresso total do projeto: {globalProgress}%</div>
      </Panel>

      <Panel title="Phase Atual">
        <div className="phase-current">
          <div className="card-title">{currentPhase.title}</div>
          <div className="muted-text">{currentPhase.description}</div>
          <div className="progress-track">
            <div
              className="progress-bar"
              style={{ width: `${getPhaseProgress(currentPhase)}%` }}
            />
          </div>
          <div className="muted-text">
            Progresso da phase atual: {getPhaseProgress(currentPhase)}%
          </div>
        </div>
      </Panel>

      <Panel title="Criar nova Phase">
        <div className="stack">
          <input
            className="input"
            placeholder="Título da Phase"
            value={newPhaseTitle}
            onChange={(event) => setNewPhaseTitle(event.target.value)}
          />
          <input
            className="input"
            placeholder="Descrição da Phase"
            value={newPhaseDescription}
            onChange={(event) => setNewPhaseDescription(event.target.value)}
          />
          <textarea
            className="textarea"
            placeholder="Notas (opcional)"
            value={newPhaseNotes}
            onChange={(event) => setNewPhaseNotes(event.target.value)}
          />
          <button className="button button-primary" onClick={handleAddPhase}>
            Adicionar Phase
          </button>
        </div>
      </Panel>

      <Panel title="Timeline das Phases">
        <div className="timeline">
          {phases.map((phase) => (
            <div key={phase.id} className="timeline-item">
              <div className="timeline-title">{phase.title}</div>
              <div className="muted-text">{formatDate(phase.date)}</div>
              <div className="progress-track">
                <div
                  className="progress-bar"
                  style={{ width: `${getPhaseProgress(phase)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {phases.map((phase, index) => (
        <Panel key={phase.id} title={phase.title}>
          <div className="phase-header">
            <div className="phase-meta">
              <div className="task-status">
                <span className={`status-badge ${statusColor[phase.status]}`}>
                  {statusLabel[phase.status]}
                </span>
                <select
                  className="select select-xs"
                  value={phase.status}
                  onChange={(event) =>
                    handlePhaseStatusChange(phase.id, event.target.value as Phase["status"])
                  }
                >
                  <option value="todo">A Fazer</option>
                  <option value="in_progress">Em Progresso</option>
                  <option value="done">Concluído</option>
                </select>
              </div>
              <input
                className="input"
                value={phase.title}
                onChange={(event) =>
                  updatePhase(phase.id, (item) => ({ ...item, title: event.target.value }))
                }
              />
              <input
                className="input"
                value={phase.description}
                onChange={(event) =>
                  updatePhase(phase.id, (item) => ({
                    ...item,
                    description: event.target.value,
                  }))
                }
              />
              <textarea
                className="textarea"
                placeholder="Notas da phase"
                value={phase.notes ?? ""}
                onChange={(event) =>
                  updatePhase(phase.id, (item) => ({ ...item, notes: event.target.value }))
                }
              />
              <input
                type="date"
                className="input"
                value={phase.date ?? ""}
                onChange={(event) =>
                  updatePhase(phase.id, (item) => ({ ...item, date: event.target.value }))
                }
              />
            </div>
            <div className="phase-actions">
              <button className="button button-ghost" onClick={() => handleMovePhase(index, "up")}>
                ↑
              </button>
              <button
                className="button button-ghost"
                onClick={() => handleMovePhase(index, "down")}
              >
                ↓
              </button>
              <button className="button button-primary" onClick={() => handleSavePhase(phase.id)}>
                Guardar
              </button>
              <button className="button button-ghost" onClick={() => handleAddTask(phase.id)}>
                Adicionar tarefa
              </button>
              <button className="button button-ghost" onClick={() => handleDeletePhase(phase.id)}>
                Excluir
              </button>
            </div>
          </div>

          <div className="progress-track">
            <div
              className="progress-bar"
              style={{ width: `${getPhaseProgress(phase)}%` }}
            />
          </div>
          <div className="muted-text">
            Progresso da phase: {getPhaseProgress(phase)}%
          </div>

          <div className="phase-tasks">
            {phase.tasks.map((task) => (
              <div key={task.id} className="task-row">
                <div className="task-status">
                  <span className={`status-badge ${statusColor[task.status]}`}>
                    {statusLabel[task.status]}
                  </span>
                  <select
                    className="select select-xs"
                    value={task.status}
                    onChange={(event) =>
                      handleStatusChange(
                        phase.id,
                        task.id,
                        event.target.value as PhaseTask["status"]
                      )
                    }
                  >
                    <option value="todo">A Fazer</option>
                    <option value="in_progress">Em Progresso</option>
                    <option value="done">Concluído</option>
                  </select>
                </div>
                <input
                  className="input"
                  value={task.title}
                  onChange={(event) =>
                    updateTask(phase.id, task.id, (item) => ({
                      ...item,
                      title: event.target.value,
                    }))
                  }
                />
                <input
                  className="input"
                  value={task.description}
                  onChange={(event) =>
                    updateTask(phase.id, task.id, (item) => ({
                      ...item,
                      description: event.target.value,
                    }))
                  }
                />
                <textarea
                  className="textarea"
                  placeholder="Notas"
                  value={task.notes ?? ""}
                  onChange={(event) =>
                    updateTask(phase.id, task.id, (item) => ({
                      ...item,
                      notes: event.target.value,
                    }))
                  }
                />
                <div className="task-actions">
                  <select
                    className="select select-xs"
                    value={phase.id}
                    onChange={(event) =>
                      handleMoveTask(phase.id, event.target.value, task.id)
                    }
                  >
                    {phases.map((phaseOption) => (
                      <option key={phaseOption.id} value={phaseOption.id}>
                        {phaseOption.title}
                      </option>
                    ))}
                  </select>
                  <button className="button button-primary" onClick={() => handleSaveTask(task.id)}>
                    Guardar
                  </button>
                  <button
                    className="button button-ghost"
                    onClick={() => handleDeleteTask(phase.id, task.id)}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      ))}
    </main>
  );
}
