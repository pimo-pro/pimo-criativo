export const roadmapStyles = `
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.roadmap-main {
  width: 100%;
  min-height: 100vh;
  background: linear-gradient(135deg, #0f172a 0%, #1a2a45 100%);
  color: #f8fafc;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  display: flex;
  flex-direction: column;
}

/* Page Header */
.page-header {
  background: rgba(30, 41, 59, 0.95);
  border-bottom: 2px solid rgba(59, 130, 246, 0.3);
  padding: 2rem 2.5rem;
}

.page-title {
  font-size: 2.5rem;
  font-weight: 800;
  margin: 0;
  background: linear-gradient(135deg, #3b82f6, #22c55e);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Stats Bar */
.roadmap-stats-bar {
  background: rgba(30, 41, 59, 0.8);
  border-bottom: 1px solid rgba(59, 130, 246, 0.15);
  padding: 2rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.stat-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  background: rgba(51, 65, 85, 0.5);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 12px;
  transition: all 0.3s;
}

.stat-box:hover {
  background: rgba(51, 65, 85, 0.7);
  border-color: rgba(59, 130, 246, 0.4);
  transform: translateY(-4px);
}

.stat-progress-circle {
  width: 120px;
  height: 120px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-progress-circle svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.progress-bg {
  fill: none;
  stroke: rgba(255, 255, 255, 0.1);
  stroke-width: 6;
}

.progress-ring {
  fill: none;
  stroke: url(#progressGradient);
  stroke-width: 6;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.6s ease;
}

.progress-text {
  font-size: 28px;
  font-weight: 800;
  fill: #3b82f6;
  text-anchor: middle;
  dy: 0.3em;
}

.stat-number {
  font-size: 3rem;
  font-weight: 900;
  color: #3b82f6;
  line-height: 1;
}

.stat-box-label {
  font-size: 0.9rem;
  color: #cbd5e1;
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-align: center;
}

/* Actions Bar */
.roadmap-actions-bar {
  background: rgba(30, 41, 59, 0.85);
  border-bottom: 1px solid rgba(59, 130, 246, 0.15);
  padding: 1.5rem 2rem;
}

.actions-grid {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  max-width: 1400px;
  margin: 0 auto;
}

.action-bar-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: rgba(59, 130, 246, 0.15);
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: #93c5fd;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 600;
  transition: all 0.2s;
  white-space: nowrap;
}

.action-bar-btn:hover {
  background: rgba(59, 130, 246, 0.25);
  border-color: rgba(59, 130, 246, 0.5);
}

.action-bar-btn.active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.action-bar-btn.primary {
  background: rgba(34, 197, 94, 0.2);
  border-color: rgba(34, 197, 94, 0.4);
  color: #86efac;
}

.action-bar-btn.primary:hover {
  background: rgba(34, 197, 94, 0.3);
  border-color: rgba(34, 197, 94, 0.6);
}

.action-bar-btn.danger {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.4);
  color: #fecaca;
}

.action-bar-btn.danger:hover {
  background: rgba(239, 68, 68, 0.3);
  border-color: rgba(239, 68, 68, 0.6);
}

.action-bar-btn.secondary {
  background: rgba(100, 116, 139, 0.2);
  border-color: rgba(100, 116, 139, 0.4);
  color: #cbd5e1;
}

.action-bar-btn.secondary:hover {
  background: rgba(100, 116, 139, 0.3);
}

.action-bar-btn.create {
  background: linear-gradient(135deg, #3b82f6, #22c55e);
  border: none;
  color: white;
  margin-left: auto;
}

.action-bar-btn.create:hover {
  filter: brightness(1.1);
}

.btn-icon {
  font-size: 1.1rem;
}

.selection-indicator {
  padding: 0.5rem 1rem;
  background: rgba(59, 130, 246, 0.15);
  border: 1px dashed rgba(59, 130, 246, 0.3);
  color: #93c5fd;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
}

.status-select-bar {
  padding: 0.75rem;
  background: rgba(30, 41, 59, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #f8fafc;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
}

/* Main Container */
.roadmap-container {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.roadmap-content-full {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  overflow-y: auto;
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

.roadmap-content-full::-webkit-scrollbar {
  width: 8px;
}

.roadmap-content-full::-webkit-scrollbar-track {
  background: rgba(51, 65, 85, 0.3);
  border-radius: 4px;
}

.roadmap-content-full::-webkit-scrollbar-thumb {
  background: rgba(59, 130, 246, 0.4);
  border-radius: 4px;
}

.roadmap-content-full::-webkit-scrollbar-thumb:hover {
  background: rgba(59, 130, 246, 0.6);
}

/* Phase Section */
.phase-section {
  background: rgba(30, 41, 59, 0.7);
  border: 1px solid rgba(59, 130, 246, 0.15);
  border-radius: 12px;
  padding: 1.5rem;
  overflow: hidden;
}

.phase-section:hover {
  border-color: rgba(59, 130, 246, 0.25);
  background: rgba(30, 41, 59, 0.8);
}

.phase-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.5rem;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(59, 130, 246, 0.1);
}

.phase-info {
  flex: 1;
}

.phase-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #f8fafc;
  margin-bottom: 0.5rem;
}

.phase-desc {
  font-size: 0.9rem;
  color: #cbd5e1;
  opacity: 0.85;
  line-height: 1.4;
}

.phase-stats {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-shrink: 0;
}

.status-badge {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.4rem 0.8rem;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.status-badge.todo {
  background: rgba(253, 230, 138, 0.15);
  color: #fde047;
}

.status-badge.in_progress {
  background: rgba(59, 130, 246, 0.15);
  color: #93c5fd;
}

.status-badge.done {
  background: rgba(34, 197, 94, 0.15);
  color: #86efac;
}

.progress-percent {
  font-size: 0.95rem;
  font-weight: 700;
  color: #3b82f6;
  min-width: 50px;
  text-align: right;
}

/* Progress Bar */
.progress-bar {
  width: 100%;
  height: 6px;
  background: rgba(51, 65, 85, 0.6);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 1rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #22c55e);
  transition: width 0.4s ease;
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.6);
}

/* Tasks Container */
.tasks-container {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.no-tasks {
  font-size: 0.9rem;
  color: #64748b;
  text-align: center;
  padding: 1.5rem;
  font-style: italic;
}

/* Task Item */
.task-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  background: rgba(51, 65, 85, 0.4);
  border: 1px solid rgba(59, 130, 246, 0.08);
  border-radius: 8px;
  transition: all 0.2s;
  cursor: default;
}

.task-item.selectable {
  cursor: pointer;
}

.task-item:hover {
  background: rgba(51, 65, 85, 0.6);
  border-color: rgba(59, 130, 246, 0.2);
}

.task-item.selected {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.4);
  box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.3);
}

.task-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
  flex-shrink: 0;
  accent-color: #3b82f6;
}

.task-content {
  flex: 1;
  min-width: 0;
}

.task-text {
  font-size: 1rem;
  color: #e2e8f0;
  font-weight: 500;
  line-height: 1.4;
  word-wrap: break-word;
}

.task-status-badge {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.35rem 0.65rem;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.task-status-badge.todo {
  background: rgba(253, 230, 138, 0.15);
  color: #fde047;
}

.task-status-badge.in_progress {
  background: rgba(59, 130, 246, 0.15);
  color: #93c5fd;
}

.task-status-badge.done {
  background: rgba(34, 197, 94, 0.15);
  color: #86efac;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-box {
  background: rgba(30, 41, 59, 0.95);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 12px;
  padding: 2.5rem;
  max-width: 450px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.modal-box h3 {
  font-size: 1.5rem;
  margin-bottom: 1.5rem;
  color: #f8fafc;
}

.modal-input {
  width: 100%;
  background: rgba(51, 65, 85, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #f8fafc;
  padding: 0.9rem;
  margin-bottom: 1rem;
  border-radius: 8px;
  font-size: 1rem;
}

.modal-input::placeholder {
  color: #94a3b8;
}

.modal-input:focus {
  outline: none;
  border-color: rgba(59, 130, 246, 0.5);
  background: rgba(51, 65, 85, 0.8);
}

.modal-actions {
  display: flex;
  gap: 1rem;
}

.modal-actions button {
  flex: 1;
  padding: 0.9rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
  font-size: 1rem;
}

.modal-actions button:first-child {
  background: rgba(100, 116, 139, 0.2);
  color: #cbd5e1;
}

.modal-actions button:first-child:hover {
  background: rgba(100, 116, 139, 0.3);
}

.modal-actions button.primary {
  background: linear-gradient(135deg, #3b82f6, #22c55e);
  color: white;
  border: none;
}

.modal-actions button.primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

/* Responsive */
@media (max-width: 1024px) {
  .page-header {
    padding: 1.5rem 2rem;
  }

  .page-title {
    font-size: 2rem;
  }

  .roadmap-stats-bar {
    padding: 1.5rem;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem;
  }

  .stat-progress-circle {
    width: 100px;
    height: 100px;
  }

  .stat-number {
    font-size: 2.5rem;
  }

  .roadmap-content-full {
    padding: 1.5rem;
  }
}

@media (max-width: 768px) {
  .page-header {
    padding: 1.25rem 1.5rem;
  }

  .page-title {
    font-size: 1.75rem;
  }

  .roadmap-stats-bar {
    padding: 1rem 1.5rem;
  }

  .stats-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .roadmap-actions-bar {
    padding: 1rem 1.5rem;
  }

  .actions-grid {
    gap: 0.75rem;
  }

  .action-bar-btn {
    padding: 0.6rem 1rem;
    font-size: 0.85rem;
  }

  .action-bar-btn.create {
    margin-left: auto;
    margin-top: 1rem;
    width: 100%;
  }

  .roadmap-content-full {
    padding: 1rem;
    gap: 1rem;
  }

  .phase-section {
    padding: 1rem;
  }

  .task-item {
    padding: 0.9rem 1rem;
    flex-direction: column;
    align-items: flex-start;
  }

  .task-status-badge {
    align-self: flex-end;
  }
}

@media (max-width: 480px) {
  .page-title {
    font-size: 1.5rem;
  }

  .stat-box {
    padding: 1rem;
    gap: 0.75rem;
  }

  .stat-progress-circle {
    width: 80px;
    height: 80px;
  }

  .stat-number {
    font-size: 2rem;
  }

  .actions-grid {
    flex-direction: column;
  }

  .action-bar-btn {
    width: 100%;
    justify-content: center;
  }

  .action-bar-btn.create {
    margin-left: 0;
  }

  .selection-indicator {
    width: 100%;
  }

  .status-select-bar {
    width: 100%;
  }
}
`;
