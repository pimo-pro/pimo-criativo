/**
 * Registo de deploys para histórico no Admin.
 * Armazena em LocalStorage (chave: pimo-deploy-log-v1).
 */

const DEPLOY_LOG_KEY = "pimo-deploy-log-v1";

export type DeploymentEntry = {
  version: string;
  date: string;
  notes?: string;
};

function getLog(): DeploymentEntry[] {
  try {
    const raw = localStorage.getItem(DEPLOY_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLog(entries: DeploymentEntry[]): void {
  try {
    localStorage.setItem(DEPLOY_LOG_KEY, JSON.stringify(entries));
  } catch (e) {
    console.error("Erro ao guardar log de deploy:", e);
  }
}

/**
 * Regista um deployment.
 */
export function logDeployment(entry: { version: string; date: string; notes?: string }): void {
  const log = getLog();
  log.unshift({
    version: entry.version,
    date: entry.date,
    notes: entry.notes,
  });
  saveLog(log.slice(0, 100)); // Manter últimas 100 entradas
}

/**
 * Obtém o histórico de deploys.
 */
export function getDeploymentHistory(): DeploymentEntry[] {
  return getLog();
}
