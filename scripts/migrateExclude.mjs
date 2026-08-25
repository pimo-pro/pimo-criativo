/**
 * Exclusão explícita de migrations por filename (Phase A Staging).
 * Default vazio = comportamento histórico (todas as migrations entram).
 * Ficheiros excluídos NÃO são aplicados nem registados em _pimo_schema_migrations.
 */

/**
 * @param {unknown} raw CSV de filenames (PIMO_MIGRATE_EXCLUDE)
 * @returns {string[]}
 */
export function parseMigrateExclude(raw) {
  if (raw == null) return [];
  const s = String(raw).trim();
  if (!s) return [];
  return s
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * Particiona lista já ordenada: exclusão por filename exacto.
 * @param {string[]} sortedFiles
 * @param {Iterable<string>} excludeList
 * @returns {{ included: string[], excluded: string[] }}
 */
export function partitionMigrations(sortedFiles, excludeList) {
  const exclude = new Set(
    [...excludeList].map((f) => String(f).trim()).filter(Boolean),
  );
  const included = [];
  const excluded = [];
  for (const file of sortedFiles) {
    if (exclude.has(file)) excluded.push(file);
    else included.push(file);
  }
  return { included, excluded };
}

/**
 * @param {Record<string, unknown> | null | undefined} env
 * @returns {{ included: string[], excluded: string[], excludeNames: string[] }}
 */
export function selectMigrations(sortedFiles, env) {
  const excludeNames = parseMigrateExclude(env?.PIMO_MIGRATE_EXCLUDE);
  const { included, excluded } = partitionMigrations(sortedFiles, excludeNames);
  return { included, excluded, excludeNames };
}
