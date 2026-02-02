/** Estilos CSS inline usados pela página ProjectRoadmap. */

export const roadmapStyles = `
/* Reset e variáveis de design */
:root {
  /* Cores base */
  --bg-primary: #0f172a;
  --bg-secondary: #1e293b;
  --bg-tertiary: #334155;
  --bg-quaternary: #475569;
  
  /* Textos */
  --text-main: #f8fafc;
  --text-secondary: #e2e8f0;
  --text-muted: #94a3b8;
  --text-accent: #cbd5e1;
  
  /* Borda e divisórias */
  --border-color: rgba(255, 255, 255, 0.08);
  --divider-color: rgba(255, 255, 255, 0.06);
  
  /* Cores de destaque */
  --accent-primary: #3b82f6;
  --accent-secondary: #22c55e;
  --accent-warning: #f59e0b;
  --accent-danger: #ef4444;
  --accent-purple: #8b5cf6;
  
  /* Sombra */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.6);
  
  /* Transições */
  --transition-fast: 0.15s ease;
  --transition-normal: 0.3s ease;
  --transition-slow: 0.5s ease;
  
  /* Espaçamentos */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
  --spacing-2xl: 3rem;
  
  /* Tipografia */
  --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;
  --font-size-3xl: 1.875rem;
  --font-size-4xl: 2.25rem;
  
  /* Borda radius */
  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
}

/* Estilos globais */
* {
  box-sizing: border-box;
}

/* Container principal */
.roadmap-container {
  min-height: 100vh;
  background: linear-gradient(180deg, #0b1220 0%, #0f172a 100%);
  color: var(--text-main);
  font-family: var(--font-family);
  padding: var(--spacing-xl);
}

/* Header da página */
.roadmap-header {
  margin-bottom: var(--spacing-xl);
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
}

.page-title {
  font-size: var(--font-size-4xl);
  font-weight: 800;
  margin: 0 0 var(--spacing-xs 0;
  background: linear-gradient(135deg, var(--text-main), var(--text-secondary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.page-subtitle {
  font-size: var(--font-size-lg);
  color: var(--text-muted);
  margin: 0;
  font-weight: 400;
}

/* Seção de estatísticas */
.stats-section {
  margin-bottom: var(--spacing-xl);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--spacing-md);
  max-width: 1200px;
  margin: 0 auto;
}

.stat-card {
  background: linear-gradient(180deg, rgba(59, 130, 246, 0.1), rgba(34, 197, 94, 0.1));
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  backdrop-filter: blur(10px);
  transition: var(--transition-normal);
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(circle at top right, rgba(59, 130, 246, 0.2), transparent 70%);
  pointer-events: none;
}

.stat-card:hover {
  transform: translateY(-4px);
  border-color: rgba(59, 130, 246, 0.4);
  box-shadow: var(--shadow-lg);
  background: linear-gradient(180deg, rgba(59, 130, 246, 0.15), rgba(34, 197, 94, 0.15));
}

.stat-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-md);
  flex-shrink: 0;
  color: var(--text-secondary);
  transition: var(--transition-fast);
}

.stat-card:hover .stat-icon {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-main);
  transform: scale(1.05);
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: var(--font-size-3xl);
  font-weight: 800;
  color: var(--text-main);
  margin: 0 0 var(--spacing-xs) 0;
  line-height: 1.1;
}

.stat-label {
  font-size: var(--font-size-sm);
  color: var(--text-muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
}

/* Conteúdo principal */
.main-content {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: var(--spacing-xl);
  max-width: 1200px;
  margin: 0 auto;
}

/* Seção timeline */
.timeline-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.section-header {
  margin-bottom: var(--spacing-md);
}

.section-title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  margin: 0 0 var(--spacing-xs) 0;
  color: var(--text-main);
}

.section-subtitle {
  font-size: var(--font-size-base);
  color: var(--text-muted);
  margin: 0;
  font-weight: 400;
}

.timeline-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

/* Cards de fase */
.phase-card {
  background: linear-gradient(180deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9));
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  transition: var(--transition-normal);
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(10px);
}

.phase-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
  opacity: 0.8;
}

.phase-card:hover {
  transform: translateY(-2px);
  border-color: rgba(59, 130, 246, 0.3);
  box-shadow: var(--shadow-xl);
  background: linear-gradient(180deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95));
}

.phase-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.phase-main {
  flex: 1;
}

.phase-title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--text-main);
  margin: 0 0 var(--spacing-sm) 0;
  line-height: 1.3;
}

.phase-description {
  font-size: var(--font-size-base);
  color: var(--text-accent);
  margin: 0;
  line-height: 1.6;
}

.phase-meta {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  flex-shrink: 0;
  align-items: flex-end;
}

.status-badge {
  font-size: var(--font-size-sm);
  font-weight: 700;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-secondary);
}

.status-badge.todo {
  background: rgba(253, 230, 138, 0.1);
  border-color: rgba(253, 230, 138, 0.3);
  color: #fde047;
}

.status-badge.in_progress {
  background: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.3);
  color: #93c5fd;
}

.status-badge.done {
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.3);
  color: #86efac;
}

.phase-progress-text {
  font-size: var(--font-size-lg);
  font-weight: 800;
  color: var(--text-main);
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: 999px;
  display: inline-block;
}

/* Progresso da fase */
.phase-progress {
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-md);
  background: rgba(51, 65, 85, 0.3);
  border: 1px solid var(--divider-color);
  border-radius: var(--radius-md);
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-sm);
}

.progress-label {
  font-size: var(--font-size-sm);
  color: var(--text-muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.progress-value {
  font-size: var(--font-size-base);
  font-weight: 700;
  color: var(--text-main);
}

.progress-bar {
  background: rgba(51, 65, 85, 0.6);
  border: 1px solid var(--border-color);
  height: 16px;
  border-radius: 999px;
  overflow: hidden;
  position: relative;
}

.progress-fill {
  background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
  height: 100%;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
}

.progress-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  animation: shimmer 3s infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* Tarefas da fase */
.phase-tasks {
  border-top: 1px solid var(--divider-color);
  padding-top: var(--spacing-lg);
}

.tasks-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.tasks-title {
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--text-main);
  margin: 0;
}

.tasks-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.add-task-btn {
  background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
  color: white;
  border: none;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  font-weight: 700;
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: var(--transition-fast);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  box-shadow: var(--shadow-md);
}

.add-task-btn:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-lg);
}

.tasks-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.task-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm);
  background: rgba(51, 65, 85, 0.3);
  border: 1px solid var(--divider-color);
  border-radius: var(--radius-md);
  transition: var(--transition-fast);
}

.task-row:hover {
  background: rgba(51, 65, 85, 0.5);
  border-color: rgba(59, 130, 246, 0.3);
  transform: translateX(2px);
}

.task-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--accent-primary);
  flex-shrink: 0;
}

.task-status {
  font-size: var(--font-size-xs);
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-secondary);
  flex-shrink: 0;
  min-width: 50px;
  text-align: center;
}

.task-title {
  color: var(--text-main);
  font-size: var(--font-size-base);
  font-weight: 500;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.task-select {
  background: rgba(30, 41, 59, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-main);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: var(--transition-fast);
}

.task-select:hover {
  border-color: rgba(59, 130, 246, 0.5);
  background: rgba(30, 41, 59, 0.9);
}

.task-delete-btn {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fecaca;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-base);
  transition: var(--transition-fast);
}

.task-delete-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.5);
  transform: scale(1.05);
}

/* Sidebar */
.sidebar-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.sidebar-card {
  background: linear-gradient(180deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9));
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  overflow: hidden;
  backdrop-filter: blur(10px);
  transition: var(--transition-normal);
}

.sidebar-card:hover {
  border-color: rgba(59, 130, 246, 0.3);
  transform: translateY(-2px);
  box-shadow: var(--shadow-xl);
}

.card-header {
  background: rgba(59, 130, 246, 0.1);
  border-bottom: 1px solid var(--border-color);
  padding: var(--spacing-md);
}

.card-title {
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--text-main);
  margin: 0;
}

.card-content {
  padding: var(--spacing-lg);
}

/* Current Phase */
.current-phase {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.current-phase-title {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--text-main);
  margin: 0 0 var(--spacing-xs) 0;
  line-height: 1.3;
}

.current-phase-desc {
  color: var(--text-accent);
  line-height: 1.6;
  margin: 0 0 var(--spacing-md) 0;
  font-size: var(--font-size-base);
}

.current-phase-progress {
  margin-bottom: var(--spacing-md);
}

.phase-actions {
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-md);
}

.action-btn {
  flex: 1;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  font-weight: 700;
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: var(--transition-fast);
  border: 1px solid rgba(255, 255, 255, 0.1);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  box-shadow: var(--shadow-sm);
}

.action-btn.primary {
  background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
  color: white;
  border: none;
}

.action-btn.primary:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.action-btn.secondary {
  background: rgba(30, 41, 59, 0.8);
  color: var(--text-main);
  border-color: rgba(255, 255, 255, 0.2);
}

.action-btn.secondary:hover {
  background: rgba(30, 41, 59, 0.95);
  border-color: rgba(59, 130, 246, 0.5);
}

.action-btn.danger {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fecaca;
  font-weight: 700;
}

.action-btn.danger:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.5);
  transform: translateY(-2px);
}

/* Task Actions */
.task-actions-panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.action-group {
  display: flex;
  gap: var(--spacing-sm);
}

.action-info {
  background: rgba(51, 65, 85, 0.4);
  border: 1px solid var(--divider-color);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
}

.info-text {
  font-size: var(--font-size-sm);
  color: var(--text-muted);
  text-align: center;
}

/* New Phase Form */
.new-phase-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.form-label {
  font-size: var(--font-size-sm);
  color: var(--text-muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
}

.form-input, .form-textarea {
  width: 100%;
  background: rgba(51, 65, 85, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-main);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm);
  font-size: var(--font-size-base);
  font-family: inherit;
  transition: var(--transition-fast);
  box-sizing: border-box;
}

.form-input::placeholder, .form-textarea::placeholder {
  color: var(--text-muted);
  opacity: 0.8;
}

.form-input:focus, .form-textarea:focus {
  outline: none;
  border-color: rgba(59, 130, 246, 0.5);
  background: rgba(51, 65, 85, 0.8);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-textarea {
  min-height: 100px;
  resize: vertical;
}

.create-phase-btn {
  width: 100%;
  background: linear-gradient(135deg, #10b981, #06b6d4);
  color: white;
  border: none;
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  font-weight: 800;
  font-size: var(--font-size-base);
  cursor: pointer;
  transition: var(--transition-normal);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  box-shadow: var(--shadow-md);
}

.create-phase-btn:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
  filter: brightness(1.05);
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: var(--spacing-lg);
  color: var(--text-muted);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: var(--spacing-sm);
  opacity: 0.6;
  display: block;
}

.empty-text {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--text-main);
  margin-bottom: var(--spacing-xs);
}

.empty-subtext {
  font-size: var(--font-size-base);
  line-height: 1.6;
  color: var(--text-accent);
}

/* Responsividade */
@media (max-width: 1200px) {
  .main-content {
    grid-template-columns: 1fr;
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .roadmap-container {
    padding: var(--spacing-lg);
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .phase-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-md);
  }
  
  .phase-meta {
    align-self: flex-start;
  }
  
  .phase-title {
    font-size: var(--font-size-xl);
  }
  
  .action-group {
    flex-direction: column;
  }
  
  .phase-actions {
    flex-direction: column;
  }
}

@media (max-width: 480px) {
  .roadmap-container {
    padding: var(--spacing-md);
  }
  
  .page-title {
    font-size: var(--font-size-3xl);
  }
  
  .stat-card {
    padding: var(--spacing-md);
  }
  
  .stat-value {
    font-size: var(--font-size-2xl);
  }
  
  .phase-card {
    padding: var(--spacing-md);
  }
  
  .phase-title {
    font-size: var(--font-size-lg);
  }
  
  .sidebar-card, .current-phase, .task-actions, .new-phase-form {
    padding: var(--spacing-md);
  }
  
  .create-phase-btn {
    padding: var(--spacing-sm);
  }
}
`;