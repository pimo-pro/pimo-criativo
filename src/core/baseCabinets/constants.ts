/**
 * Regras estruturais aplicadas pelo sistema (não duplicadas dentro de cada modelo).
 * Espessura, costa, sistema 32mm, pés e tipos de montagem/portas/gavetas são
 * aplicados automaticamente pelo Viewer e Workspace.
 */

/** Espessura das peças (mm). */
export const SYSTEM_THICKNESS_MM = 19;

/** Costa/ fundo (mm). Opção de remover pelo utilizador. */
export const SYSTEM_BACK_MM = 10;

/** Sistema europeu de furos (mm). */
export const SYSTEM_32MM = 32;

/** Altura padrão dos pés para caixas inferiores (mm). Ajustável pelo utilizador. */
export const DEFAULT_FEET_HEIGHT_MM = 100;

/** Modelo de pés: vidaXL Pés Ajustáveis (referência). */
export const FEET_MODEL_REF = "vidaXL_Pes_Ajustaveis";

/** Tipos de montagem suportados pelo sistema. */
export type MountType = "minifix" | "dowel" | "screw" | "cam_lock";

/** Tipos de porta: normal e soft-close. */
export type DoorHingeType = "normal" | "soft_close";

/** Tipos de gaveta: Hettich normal e soft-close. */
export type DrawerRunnerType = "hettich_normal" | "hettich_soft_close";
