import { useEffect, useMemo, useState } from "react";
import Panel from "../components/ui/Panel";
import { useProject } from "../context/useProject";
import {
  addStoredWeeklyTask,
  getStoredWeeklyTasks,
  getStatusOverrides,
  mergeWeeklyRoadmap,
  setTaskStatus,
  statusLabel,
  weeklyRoadmapInstructions,
  weeklyRoadmapWeeks,
} from "../core/docs/weeklyRoadmap";

export default function WeeklyRoadmap() {
  const { actions } = useProject();
  const [storedTasks, setStoredTasks] = useState(() => getStoredWeeklyTasks());
  const [statusOverrides, setStatusOverrides] = useState(() => getStatusOverrides());
  const [selectedWeek, setSelectedWeek] = useState(weeklyRoadmapWeeks[0]?.id ?? "Semana 1");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setStoredTasks(getStoredWeeklyTasks());
    setStatusOverrides(getStatusOverrides());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "pimo_weekly_roadmap_tasks") {
        setStoredTasks(getStoredWeeklyTasks());
      }
      if (event.key === "pimo_weekly_roadmap_status_overrides") {
        setStatusOverrides(getStatusOverrides());
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const mergedWeeks = useMemo(
    () => mergeWeeklyRoadmap(storedTasks, statusOverrides),
    [storedTasks, statusOverrides]
  );

  const handleAddTask = () => {
    const trimmedTitle = title.trim();
    const trimmedNotes = notes.trim();
    if (!trimmedTitle) return;
    const task = addStoredWeeklyTask({
      weekId: selectedWeek,
      title: trimmedTitle,
      description: trimmedNotes || "Tarefa adicionada via WeeklyRoadmap.",
      notes: trimmedNotes ? trimmedNotes : undefined,
      status: "todo",
    });
    setStoredTasks((prev) => [...prev, task]);
    actions.logChangelog(
      `Nova tarefa adicionada no WeeklyRoadmap: ${selectedWeek} — ${trimmedTitle}`
    );
    setTitle("");
    setNotes("");
  };

  const handleStatusChange = (taskId: string, nextStatus: "todo" | "in_progress" | "done") => {
    const nextStored = setTaskStatus(taskId, nextStatus, storedTasks);
    setStoredTasks(nextStored);
    setStatusOverrides(getStatusOverrides());
    actions.logChangelog(
      `Status atualizado no WeeklyRoadmap: ${taskId} → ${statusLabel[nextStatus]}`
    );
  };

  return (
    <main className="page-root">
      <Panel title="Plano Semanal do Projeto">
        <div className="muted-text">
          Esta página consolida o plano semanal do pimo.pro e guia as próximas
          interações com o Cursor.
        </div>
      </Panel>

      <Panel title="Adicionar tarefa ou nota">
        <div className="form-grid">
          <label className="stack-tight">
            <span className="muted-text">Semana</span>
            <select
              value={selectedWeek}
              onChange={(event) => setSelectedWeek(event.target.value)}
              className="select"
            >
              {weeklyRoadmapWeeks.map((week) => (
                <option key={week.id} value={week.id}>
                  {week.id}
                </option>
              ))}
            </select>
          </label>
          <label className="stack-tight">
            <span className="muted-text">Título</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="input"
              placeholder="Ex.: Ajustar HDRI principal"
            />
          </label>
        </div>
        <label className="stack-tight">
          <span className="muted-text">Notas / Descrição</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="textarea"
            placeholder="Detalhes, contexto ou observações"
          />
        </label>
        <button className="button button-primary" onClick={handleAddTask}>
          Adicionar
        </button>
      </Panel>

      <Panel title="Resumo das Semanas">
        <div className="list-vertical">
          {mergedWeeks.map((week) => (
            <div key={week.id} className="card">
              <div className="card-title">{week.id}</div>
              <div className="muted-text">{week.summary}</div>
            </div>
          ))}
        </div>
      </Panel>

      {mergedWeeks.map((week) => (
        <Panel key={week.id} title={week.id}>
          <div className="roadmap-summary">{week.summary}</div>
          <div className="roadmap-table">
            <div className="roadmap-row roadmap-header">
              <div>Status</div>
              <div>Tarefa</div>
              <div>Descrição</div>
            </div>
            {week.tasks.map((task, index) => (
              <div key={`${week.id}-${index}`} className="roadmap-row">
                <div className="roadmap-status">
                  <span className={`status-badge status-${task.status}`}>
                    {statusLabel[task.status]}
                  </span>
                  <select
                    value={task.status}
                    onChange={(event) =>
                      handleStatusChange(task.id, event.target.value as "todo" | "in_progress" | "done")
                    }
                    className="select select-xs"
                  >
                    <option value="todo">A Fazer</option>
                    <option value="in_progress">Em Progresso</option>
                    <option value="done">Concluído</option>
                  </select>
                </div>
                <div className="roadmap-cell">{task.title}</div>
                <div className="roadmap-cell muted-text">
                  {task.description}
                  {task.notes && task.notes !== task.description ? ` — ${task.notes}` : ""}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      ))}

      <Panel title="Instruções para o Cursor nesta semana">
        <div className="roadmap-instructions">
          {weeklyRoadmapInstructions.map((instruction) => (
            <p key={instruction}>{instruction}</p>
          ))}
        </div>
      </Panel>
    </main>
  );
}
