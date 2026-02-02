/**
 * Versionamento para One-Click Deployment.
 * Formato: vYYYY.MM.DD-HHMM (ex.: v2025.02.03-2315)
 */

/** Formato ISO da data usada na label. */
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Gera uma label de versão com base na data/hora atual.
 * Formato: vYYYY.MM.DD-HHMM
 */
export function generateVersionLabel(): string {
  const d = new Date();
  return `v${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}`;
}

/**
 * Base da versão do dia (sem hora).
 * Ex.: v2025.02.03
 */
export function getTodayVersionBase(): string {
  const d = new Date();
  return `v${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`;
}

/**
 * Payload para version.json.
 * Usado por scripts/write-version.mjs para gerar public/version.json.
 */
export function getVersionPayload(version: string): { version: string; buildTime: string } {
  return {
    version,
    buildTime: new Date().toISOString(),
  };
}

/**
 * Retorna o conteúdo de version.json (para ser guardado em public/version.json).
 * O ficheiro deve ser escrito por um script Node (ex.: scripts/write-version.mjs) durante o build.
 */
export function attachVersionToBuild(version: string): string {
  const payload = getVersionPayload(version);
  return JSON.stringify(payload, null, 2);
}
