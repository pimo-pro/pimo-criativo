import { useMemo, useState } from "react";
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
import { roadmapStyles } from "./ProjectRoadmapStyles";

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
    updater: (_task: PhaseTask) => PhaseTask
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
        {/* Header Section */}
        <header className="roadmap-header">
          <div className="header-content">
            <h1 className="page-title">Roadmap do Projeto</h1>
            <p className="page-subtitle">Visão geral do progresso e planejamento do desenvolvimento</p>
          </div>
        </header>

        {/* Statistics Section */}
        <section className="stats-section">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
                  <path d="M2 17L12 22L22 17"/>
                  <path d="M2 12L12 17L22 12"/>
                </svg>
              </div>
              <div className="stat-info">
                <div className="stat-value">{stats.totalPhases}</div>
                <div className="stat-label">Fases Concluídas</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                </svg>
              </div>
              <div className="stat-info">
                <div className="stat-value">{stats.progress}%</div>
                <div className="stat-label">Progresso Global</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 8v4l3 3"/>
                </svg>
              </div>
              <div className="stat-info">
                <div className="stat-value">{stats.pendingTasks}</div>
                <div className="stat-label">Tarefas Pendentes</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                </svg>
              </div>
              <div className="stat-info">
                <div className="stat-value">{stats.totalTasks}</div>
                <div className="stat-label">Total de Tarefas</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              </div>
              <div className="stat-info">
                <div className="stat-value">{stats.doneTasks}</div>
                <div className="stat-label">Tarefas Concluídas</div>
              </div>
            </div>
          </div>
        </section>

        {/* Main Content Area */}
        <div className="main-content">
          {/* Timeline Section */}
          <main className="timeline-section">
            <div className="section-header">
              <h2 className="section-title">Fases do Projeto</h2>
              <p className="section-subtitle">Visão detalhada de cada fase e seu progresso</p>
            </div>
            
            <div className="timeline-list">
              {phases.map((phase) => (
                <div key={phase.id} className="phase-card">
                  <div className="phase-header">
                    <div className="phase-main">
                      <h3 className="phase-title">{phase.title}</h3>
                      <p className="phase-description">{phase.description}</p>
                    </div>
                    <div className="phase-meta">
                      <span className={`status-badge ${statusColor[phase.status]}`}>
                        {statusLabel[phase.status]}
                      </span>
                      <span className="phase-progress-text">
                        {getPhaseProgress(phase)}%
                      </span>
                    </div>
                  </div>
                  
                  <div className="phase-progress">
                    <div className="progress-info">
                      <span className="progress-label">Progresso da Fase</span>
                      <span className="progress-value">{getPhaseProgress(phase)}%</span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${getPhaseProgress(phase)}%` }}
                      />
                    </div>
                  </div>

                  <div className="phase-tasks">
                    <div className="tasks-header">
                      <h4 className="tasks-title">Tarefas</h4>
                      <div className="tasks-actions">
                        <button 
                          className="add-task-btn"
                          onClick={() => handleAddTask(phase.id)}
                        >
                          + Adicionar Tarefa
                        </button>
                      </div>
                    </div>
                    
                    <div className="tasks-list">
                      {phase.tasks.map((task) => (
                        <div key={task.id} className="task-row">
                          <input
                            type="checkbox"
                            className="task-checkbox"
                            checked={false}
                            onChange={() => {}}
                          />
                          <span className={`task-status ${statusColor[task.status]}`}>
                            {statusLabel[task.status]}
                          </span>
                          <span className="task-title">{task.title}</span>
                          <div className="task-actions">
                            <select
                              className="task-select"
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
                              className="task-delete-btn"
                              onClick={() => handleDeleteTask(phase.id, task.id)}
                              title="Excluir tarefa"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </main>

          {/* Sidebar */}
          <aside className="sidebar-section">
            {/* Current Phase */}
            <div className="sidebar-card">
              <div className="card-header">
                <h3 className="card-title">Phase Atual</h3>
              </div>
              <div className="card-content">
                {currentPhase ? (
                  <div className="current-phase">
                    <h4 className="current-phase-title">{currentPhase.title}</h4>
                    <p className="current-phase-desc">{currentPhase.description}</p>
                    <div className="current-phase-progress">
                      <div className="progress-info">
                        <span className="progress-label">Progresso</span>
                        <span className="progress-value">{getPhaseProgress(currentPhase)}%</span>
                      </div>
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${getPhaseProgress(currentPhase)}%` }}
                        />
                      </div>
                    </div>
                    <div className="phase-actions">
                      <button className="action-btn primary" onClick={() => handleAddTask(currentPhase.id)}>
                        + Adicionar Tarefa
                      </button>
                      <button className="action-btn secondary" onClick={() => handleSavePhase(currentPhase.id)}>
                        Guardar Alterações
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">📋</div>
                    <div className="empty-text">Nenhuma phase disponível</div>
                    <div className="empty-subtext">Crie uma nova phase para começar a organizar seu projeto</div>
                  </div>
                )}
              </div>
            </div>

            {/* Task Actions */}
            <div className="sidebar-card">
              <div className="card-header">
                <h3 className="card-title">Ações de Tarefa</h3>
              </div>
              <div className="card-content">
                <div className="task-actions-panel">
                  <div className="action-group">
                    <button className="action-btn danger" onClick={() => {}}>
                      🗑️ Excluir Selecionada
                    </button>
                    <button className="action-btn secondary" onClick={() => {}}>
                      ✏️ Editar Estado
                    </button>
                  </div>
                  <div className="action-info">
                    <div className="info-text">Selecione uma tarefa para realizar ações</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Create New Phase */}
            <div className="sidebar-card">
              <div className="card-header">
                <h3 className="card-title">Criar Nova Phase</h3>
              </div>
              <div className="card-content">
                <div className="new-phase-form">
                  <div className="form-group">
                    <label className="form-label">Título da Phase</label>
                    <input
                      className="form-input"
                      placeholder="Ex: Desenvolvimento Frontend"
                      value={newPhaseTitle}
                      onChange={(event) => setNewPhaseTitle(event.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Descrição</label>
                    <input
                      className="form-input"
                      placeholder="Descreva o objetivo desta phase"
                      value={newPhaseDescription}
                      onChange={(event) => setNewPhaseDescription(event.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Notas (opcional)</label>
                    <textarea
                      className="form-textarea"
                      placeholder="Detalhes adicionais sobre esta phase"
                      value={newPhaseNotes}
                      onChange={(event) => setNewPhaseNotes(event.target.value)}
                    />
                  </div>
                  <button className="create-phase-btn" onClick={handleAddPhase}>
                    🚀 Criar Nova Phase
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}