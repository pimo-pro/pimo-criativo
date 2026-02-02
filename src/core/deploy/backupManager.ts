/**
 * Gestão de backups antes de cada deploy.
 * A execução real (zip, upload) deve ser feita no servidor via script (ex.: deploy.sh).
 *
 * No servidor Hostinger, o script pode:
 * - Fazer zip da pasta dist: zip -r backup-{version}.zip dist/
 * - Guardar em /backups/backup-{version}.zip
 *
 * Estas funções são placeholders para uso em scripts Node ou chamadas de API futuras.
 */

/**
 * Cria backup da versão atual antes do deploy.
 * Comportamento no servidor: zip da pasta dist → /backups/backup-{version}.zip
 */
export async function createBackup(_version: string): Promise<void> {
  // TODO: Executar no servidor via deploy.sh
  // Ex.: zip -r backups/backup-${version}.zip dist/
}

/**
 * Lista backups disponíveis.
 * No servidor: ls backups/*.zip
 */
export async function listBackups(): Promise<string[]> {
  return [];
}

/**
 * Restaura um backup (implementação futura).
 */
export async function restoreBackup(_version: string): Promise<void> {
  // TODO: Implementar restauro
}
