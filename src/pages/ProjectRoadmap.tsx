import { useMemo, useState } from "react";
import { useProject } from "../context/useProject";
import type { Phase, PhaseTask } from "../core/docs/projectRoadmap";
import {
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
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(() => new Set());
  const [bulkStatus, setBulkStatus] = useState<PhaseTask["status"]>("done");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPhaseTitle, setNewPhaseTitle] = useState("");
  const [newPhaseDescription, setNewPhaseDescription] = useState("");

  const stats = useMemo(() => getRoadmapStats(phases), [phases]);

  const persist = (next: Phase[], message: string) => {
    setPhases(next);
    saveStoredPhases(next);
    actions.logChangelog(message);
  };

  const toggleSelectTask = (taskId: string) => {
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const clearSelection = () => setSelectedTasks(new Set());

  const applyStatusToSelected = (status: PhaseTask["status"]) => {
    const next = phases.map((phase) => ({
      ...phase,
      tasks: phase.tasks.map((task) =>
        selectedTasks.has(task.id) ? { ...task, status } : task
      ),
    }));
    persist(next, `Status aplicado: ${status}`);
    clearSelection();
    setSelectionMode(false);
  };

  const deleteSelected = () => {
    const selectedArray = Array.from(selectedTasks);
    const next = phases.map((phase) => ({
      ...phase,
      tasks: phase.tasks.filter((task) => !selectedArray.includes(task.id)),
    }));
    persist(next, "Tarefas removidas");
    clearSelection();
    setSelectionMode(false);
  };

  const createPhase = () => {
    if (!newPhaseTitle.trim() || !newPhaseDescription.trim()) return;
    const nextPhase: Phase = {
      id: `phase_${Date.now()}`,
      title: newPhaseTitle.trim(),
      description: newPhaseDescription.trim(),
      status: "todo",
      tasks: [],
    };
    persist([...phases, nextPhase], `Phase: ${newPhaseTitle}`);
    setNewPhaseTitle("");
    setNewPhaseDescription("");
    setShowCreateModal(false);
  };

  return (
    <main className="roadmap-main">
      <style dangerouslySetInnerHTML={{ __html: roadmapStyles }} />

      {/* Page Title */}
      <div className="page-header">
        <h1 className="page-title">Roadmap do Projeto</h1>
      </div>

      {/* Stats Bar */}
      <div className="roadmap-stats-bar">
        <div className="stats-grid">
          <div className="stat-box">
            <div className="stat-progress-circle">
              <svg viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" className="progress-bg" />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  className="progress-ring"
                  style={{
                    strokeDasharray: `${2 * Math.PI * 45}`,
                    strokeDashoffset: `${2 * Math.PI * 45 * (1 - stats.progress / 100)}`,
                  }}
                />
                <text x="50" y="60" className="progress-text">
                  {stats.progress}%
                </text>
              </svg>
            </div>
            <p className="stat-box-label">Progresso</p>
          </div>

          <div className="stat-box">
            <div className="stat-number">{stats.doneTasks}</div>
            <p className="stat-box-label">Concluídas</p>
          </div>

          <div className="stat-box">
            <div className="stat-number">{stats.pendingTasks}</div>
            <p className="stat-box-label">Pendentes</p>
          </div>

          <div className="stat-box">
            <div className="stat-number">{stats.totalTasks}</div>
            <p className="stat-box-label">Total</p>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="roadmap-actions-bar">
        <div className="actions-grid">
          <button
            className={`action-bar-btn ${selectionMode ? "active" : ""}`}
            onClick={() => {
              setSelectionMode(!selectionMode);
              if (!selectionMode) clearSelection();
            }}
          >
            <span className="btn-icon">☑️</span>
            <span>{selectionMode ? "Seleção Ativa" : "Selecionar"}</span>
          </button>

          {selectionMode && selectedTasks.size > 0 && (
            <>
              <div className="selection-indicator">
                {selectedTasks.size} selecionada(s)
              </div>

              <select
                className="status-select-bar"
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value as PhaseTask["status"])}
              >
                <option value="todo">A Fazer</option>
                <option value="in_progress">Em Progresso</option>
                <option value="done">Concluído</option>
              </select>

              <button
                className="action-bar-btn primary"
                onClick={() => applyStatusToSelected(bulkStatus)}
              >
                <span className="btn-icon">✓</span>
                <span>Aplicar</span>
              </button>

              <button
                className="action-bar-btn danger"
                onClick={deleteSelected}
              >
                <span className="btn-icon">🗑️</span>
                <span>Excluir</span>
              </button>

              <button
                className="action-bar-btn secondary"
                onClick={() => {
                  setSelectionMode(false);
                  clearSelection();
                }}
              >
                <span className="btn-icon">✕</span>
                <span>Cancelar</span>
              </button>
            </>
          )}

          <button
            className="action-bar-btn create"
            onClick={() => setShowCreateModal(true)}
          >
            <span className="btn-icon">➕</span>
            <span>Nova Phase</span>
          </button>
        </div>
      </div>

      <div className="roadmap-container">
        {/* Main Content - Phases and Tasks */}
        <div className="roadmap-content-full">
          {phases.map((phase) => (
            <div key={phase.id} className="phase-section">
              <div className="phase-header">
                <div className="phase-info">
                  <h2 className="phase-title">{phase.title}</h2>
                  <p className="phase-desc">{phase.description}</p>
                </div>
                <div className="phase-stats">
                  <span className={`status-badge ${statusColor[phase.status]}`}>
                    {statusLabel[phase.status]}
                  </span>
                  <span className="progress-percent">{getPhaseProgress(phase)}%</span>
                </div>
              </div>

              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${getPhaseProgress(phase)}%` }}
                />
              </div>

              <div className="tasks-container">
                {phase.tasks.length === 0 ? (
                  <div className="no-tasks">Sem tarefas</div>
                ) : (
                  phase.tasks.map((task) => (
                    <div
                      key={task.id}
                      className={`task-item ${
                        selectedTasks.has(task.id) ? "selected" : ""
                      } ${selectionMode ? "selectable" : ""}`}
                      onClick={() => {
                        if (selectionMode) toggleSelectTask(task.id);
                      }}
                    >
                      {selectionMode && (
                        <input
                          type="checkbox"
                          className="task-checkbox"
                          checked={selectedTasks.has(task.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleSelectTask(task.id);
                          }}
                        />
                      )}
                      <span className="task-content">
                        <span className="task-text">{task.title}</span>
                      </span>
                      <span className={`task-status-badge ${statusColor[task.status]}`}>
                        {statusLabel[task.status]}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal - Create Phase */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>Criar Nova Phase</h3>
            <input
              type="text"
              className="modal-input"
              placeholder="Título"
              value={newPhaseTitle}
              onChange={(e) => setNewPhaseTitle(e.target.value)}
            />
            <input
              type="text"
              className="modal-input"
              placeholder="Descrição"
              value={newPhaseDescription}
              onChange={(e) => setNewPhaseDescription(e.target.value)}
            />
            <div className="modal-actions">
              <button onClick={() => setShowCreateModal(false)}>Cancelar</button>
              <button onClick={createPhase} className="primary">
                Criar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
