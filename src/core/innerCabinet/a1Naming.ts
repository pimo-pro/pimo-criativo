/** Naming industrial a_1 — labels de display/QR (tipo cutlist estável em a1_* / gaveta_*). */

export const A1_CABINET_PREFIX = "a_1";

export type A1CarcassToken =
  | "cx_lat_dir"
  | "cx_lat_esq"
  | "cx_cima"
  | "cx_fundo"
  | "cx_comp_40";

export type A1DrawerPieceToken = "fren" | "lat_dir" | "lat_esq" | "fun" | "costa";

function sanitizeBoxName(boxName: string): string {
  return (
    String(boxName || "BOX")
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_\-]/g, "")
      .slice(0, 32) || "BOX"
  );
}

export function buildA1CarcassIndustrialLabel(
  boxName: string,
  token: A1CarcassToken
): string {
  return `${sanitizeBoxName(boxName)}_${A1_CABINET_PREFIX}_${token}`;
}

/** Ex.: BOX_a_1_cx_gav_1_fren */
export function buildA1DrawerIndustrialLabel(
  boxName: string,
  drawerIndex1Based: number,
  token: A1DrawerPieceToken
): string {
  const n = Math.max(1, drawerIndex1Based);
  return `${sanitizeBoxName(boxName)}_${A1_CABINET_PREFIX}_cx_gav_${n}_${token}`;
}

export const A1_DRAWER_TIPO_TO_TOKEN: Record<string, A1DrawerPieceToken> = {
  gaveta_frente_ext: "fren",
  gaveta_frente: "fren",
  gaveta_frente_int: "fren",
  gaveta_lat_dir: "lat_dir",
  gaveta_lat_esq: "lat_esq",
  gaveta_fundo: "fun",
  gaveta_traseira: "costa",
};
