import { useSettings } from "../../../context/SettingsContext";

export default function RightPanel() {
  useSettings();

  return (
    <aside className="panel-content panel-content--side">
      <div className="design-panel-header">
        <div className="section-title">Ações</div>
        <p className="design-panel-subtitle">Exportação e operações do projeto atual.</p>
      </div>
      <div className="stack-tight" />
    </aside>
  );
}
