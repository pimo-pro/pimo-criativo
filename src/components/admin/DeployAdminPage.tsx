/**
 * Página Admin: Deploy Diário (One-Click Deployment).
 * Mostra última versão, histórico e botão para publicar.
 */

import { useMemo, useState } from "react";
import { generateVersionLabel } from "../../core/deploy/versioning";
import { getDeploymentHistory, logDeployment } from "../../core/deploy/deployLog";
import Panel from "../ui/Panel";

export default function DeployAdminPage() {
  const [isDeploying, setIsDeploying] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);

  const history = useMemo(() => getDeploymentHistory(), [lastAction]);
  const lastDeploy = history[0];

  const handlePublish = async () => {
    setIsDeploying(true);
    setLastAction(null);

    try {
      const version = generateVersionLabel();

      // TODO: Chamar endpoint /api/deploy?version=... quando o backend existir
      // Por agora: simular processo e registar no log local
      await new Promise((r) => setTimeout(r, 800));

      logDeployment({
        version,
        date: new Date().toISOString(),
        notes: "Deploy manual (simulado)",
      });

      setLastAction(`Versão ${version} registada.`);
    } catch (err) {
      setLastAction(`Erro: ${err instanceof Error ? err.message : "Desconhecido"}`);
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div style={{ padding: 24, overflowY: "auto", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Deploy Diário</h1>
      </div>

      <div style={{ maxWidth: 600, display: "flex", flexDirection: "column", gap: 20 }}>
        <Panel
          title="Publicar versão do dia"
          description="Gera uma nova versão, faz backup da atual, build e deploy para a Hostinger."
        >
          <button
            type="button"
            onClick={handlePublish}
            disabled={isDeploying}
            className="button button-primary"
            style={{ width: "100%", padding: 12 }}
          >
            {isDeploying ? "A publicar…" : "Publicar versão do dia"}
          </button>
          {lastAction && (
            <p style={{ marginTop: 12, fontSize: 12, color: "var(--text-muted)" }}>{lastAction}</p>
          )}
        </Panel>

        <Panel
          title="Última versão publicada"
          description={lastDeploy ? undefined : "Ainda não há deploys registados."}
        >
          {lastDeploy ? (
            <div style={{ fontSize: 14, color: "var(--text-main)" }}>
              <div>
                <strong>{lastDeploy.version}</strong>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                {new Date(lastDeploy.date).toLocaleString("pt-PT")}
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>—</p>
          )}
        </Panel>

        <Panel title="Histórico de versões" description="Últimas publicações.">
          {history.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>Nenhum deploy.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.8 }}>
              {history.slice(0, 10).map((entry, i) => (
                <li key={i}>
                  {entry.version} — {new Date(entry.date).toLocaleString("pt-PT")}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
