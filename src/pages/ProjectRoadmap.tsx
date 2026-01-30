import { useMemo, useState } from "react";
import Panel from "../components/ui/Panel";
import { useProject } from "../context/useProject";
import type { Phase, PhaseTask, RoadmapStats } from "../core/docs/projectRoadmap";
import {
  getCurrentPhase,
  getPhaseProgress,
  getRoadmap,
  getRoadmapStats,
  saveStoredPhases,
  statusLabel,
  statusColor,
} from "../core/docs/projectRoadmap";

export default function ProjectRoadmap() {
  const { actions } = useProject();
  const [phases, setPhases] = useState<Phase[]>(() => getRoadmap());
  const [newPhaseTitle, setNewPhaseTitle] = useState("");
  const [newPhaseDescription, setNewPhaseDescription] = useState("");
  const [newPhaseNotes, setNewPhaseNotes] = useState("");

  const stats = useMemo<RoadmapStats>(() => getRoadmapStats(phases), [phases]);
  const currentPhase = useMemo(() => getCurrentPhase(phases), [phases]);

  const persist = (next: Phase[], message: string) => {
    setPhases(next);
    saveStoredPhases(next);
    actions.logChangelog(message);
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
      <style dangerouslySetInnerHTML={{ __html: roadmapStyles }} />
      <div className="roadmap-container">
        {/* Left Sidebar - Fixed Stats Panel */}
        <aside className="sidebar-esquerda">
          <Panel title="Estatísticas Rápidas">
            <div className="stats-container">
              <div className="stat-item">
                <div className="stat-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
                    <path d="M2 17L12 22L22 17"/>
                    <path d="M2 12L12 17L22 12"/>
                  </svg>
                </div>
                <div className="stat-content">
                  <div className="stat-value">{stats.totalPhases}</div>
                  <div className="stat-label">Fases Concluídas</div>
                </div>
              </div>

              <div className="stat-item">
                <div className="stat-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
                    <path d="M2 17L12 22L22 17"/>
                    <path d="M2 12L12 17L22 12"/>
                  </svg>
                </div>
                <div className="stat-content">
                  <div className="stat-value">{stats.progress}%</div>
                  <div className="stat-label">Progresso Global</div>
                </div>
              </div>

              <div className="stat-item">
                <div className="stat-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
                    <path d="M2 17L12 22L22 17"/>
                    <path d="M2 12L12 17L22 12"/>
                  </svg>
                </div>
                <div className="stat-content">
                  <div className="stat-value">{stats.pendingTasks}</div>
                  <div className="stat-label">Tarefas Pendentes</div>
                </div>
              </div>

              <div className="stat-item">
                <div className="stat-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
                    <path d="M2 17L12 22L22 17"/>
                    <path d="M2 12L12 17L22 12"/>
                  </svg>
                </div>
                <div className="stat-content">
                  <div className="stat-value">{stats.totalTasks}</div>
                  <div className="stat-label">Total de Tarefas</div>
                </div>
              </div>

              <div className="stat-item">
                <div className="stat-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
                    <path d="M2 17L12 22L22 17"/>
                    <path d="M2 12L12 17L22 12"/>
                  </svg>
                </div>
                <div className="stat-content">
                  <div className="stat-value">{stats.doneTasks}</div>
                  <div className="stat-label">Tarefas Concluídas</div>
                </div>
              </div>
            </div>
          </Panel>
        </aside>

        {/* Center Column - Main Timeline */}
        <main className="coluna-central">
          <Panel title="Timeline das Phases">
            <div className="timeline">
              {phases.map((phase) => (
                <div key={phase.id} className="timeline-item">
                  <div className="timeline-header">
                    <div className="timeline-title">{phase.title}</div>
                    <div className="timeline-status">
                      <span className={`status-badge ${statusColor[phase.status]}`}>
                        {statusLabel[phase.status]}
                      </span>
                    </div>
                  </div>
                  <div className="timeline-description">{phase.description}</div>
                  <div className="timeline-progress">
                    <div className="progress-track">
                      <div
                        className="progress-bar"
                        style={{ width: `${getPhaseProgress(phase)}%` }}
                      />
                    </div>
                    <div className="muted-text">
                      Progresso: {getPhaseProgress(phase)}%
                    </div>
                  </div>
                  <div className="timeline-tasks">
                    {phase.tasks.map((task) => (
                      <div key={task.id} className="task-item">
                        <div className="task-status">
                          <span className={`status-badge ${statusColor[task.status]}`}>
                            {statusLabel[task.status]}
                          </span>
                        </div>
                        <div className="task-title">{task.title}</div>
                        <div className="task-actions">
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
                </div>
              ))}
            </div>
          </Panel>
        </main>

        {/* Right Column - Phase Details */}
        <section className="coluna-direita">
          <Panel title="Phase Atual">
            {currentPhase ? (
              <div className="phase-details">
                <div className="phase-title">{currentPhase.title}</div>
                <div className="phase-description">{currentPhase.description}</div>
                <div className="phase-progress">
                  <div className="progress-track">
                    <div
                      className="progress-bar"
                      style={{ width: `${getPhaseProgress(currentPhase)}%` }}
                    />
                  </div>
                  <div className="muted-text">
                    Progresso: {getPhaseProgress(currentPhase)}%
                  </div>
                </div>
                <div className="phase-actions">
                  <button className="button button-primary" onClick={() => handleAddTask(currentPhase.id)}>
                    Adicionar Tarefa
                  </button>
                  <button className="button button-secondary" onClick={() => handleSavePhase(currentPhase.id)}>
                    Guardar Phase
                  </button>
                </div>
              </div>
            ) : (
              <div className="phase-details">
                <div className="muted-text">Nenhuma phase disponível. Crie uma nova phase.</div>
              </div>
            )}
          </Panel>

          <Panel title="Criar Nova Phase">
            <div className="new-phase-form">
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
                Criar Phase
              </button>
            </div>
          </Panel>
        </section>
      </div>
    </main>
  );
}

export const roadmapInstructions = [
  "As alterações devem ser feitas diretamente no ProjectRoadmap.",
  "Cada edição/adição/exclusão é registada automaticamente no Painel de Referência.",
];

const roadmapStyles = `
.roadmap-container {
  display: flex;
  height: 100vh;
}

.sidebar-esquerda {
  width: 220px;
  flex-shrink: 0;
  background: #0f172a;
  border-right: 1px solid #1e293b;
}

.coluna-central {
  flex: 1;
  max-width: 50%;
  overflow-y: auto;
  padding: 2rem;
}

.coluna-direita {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
  border-left: 1px solid #1e293b;
}

.stats-container {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.stat-item {
  flex: 1;
  min-width: 150px;
  background: #1e293b;
  padding: 1rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.stat-icon {
  width: 24px;
  height: 24px;
  color: #64748b;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #f1f5f9;
}

.stat-label {
  font-size: 0.875rem;
  color: #94a3b8;
  margin-top: 2px;
}

.timeline {
  margin-top: 1rem;
}

.timeline-item {
  background: #1e293b;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1rem;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.timeline-title {
  font-weight: 600;
  color: #f1f5f9;
}

.timeline-status {
  margin-left: 1rem;
}

.timeline-description {
  color: #94a3b8;
  margin-bottom: 1rem;
}

.timeline-progress {
  margin-bottom: 1rem;
}

.progress-track {
  background: #334155;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar {
  background: #3b82f6;
  height: 100%;
  transition: width 0.3s ease;
}

.muted-text {
  color: #64748b;
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

.task-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background: #334155;
  border-radius: 6px;
  margin-bottom: 0.5rem;
}

.task-status {
  flex-shrink: 0;
}

.task-title {
  flex: 1;
  color: #f1f5f9;
}

.task-actions {
  display: flex;
  gap: 0.5rem;
}

.phase-details {
  background: #1e293b;
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.phase-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #f1f5f9;
  margin-bottom: 0.5rem;
}

.phase-description {
  color: #94a3b8;
  margin-bottom: 1rem;
}

.phase-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
}

.new-phase-form {
  background: #1e293b;
  padding: 1.5rem;
  border-radius: 8px;
}

.new-phase-form input,
.new-phase-form textarea {
  display: block;
  width: 100%;
  background: #334155;
  border: 1px solid #475569;
  border-radius: 6px;
  padding: 0.75rem;
  color: #f1f5f9;
  margin-bottom: 1rem;
  font-family: inherit;
}

.new-phase-form input:focus,
.new-phase-form textarea:focus {
  outline: none;
  border-color: #3b82f6;
}

.new-phase-form button {
  width: 100%;
}
`;