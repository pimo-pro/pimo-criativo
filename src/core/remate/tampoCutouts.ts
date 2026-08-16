/**
 * TAMPO Fase 3 — recortes industriais (fogão, pia, retangular, circular).
 * Origem: centro do TAMPO. x = comprimento, y = largura (630). depth = 30 mm.
 */

export type TampoCutoutTipo =
  | "TAMPO_CUTOUT_FOGAO"
  | "TAMPO_CUTOUT_PIA"
  | "TAMPO_CUTOUT_RETANGULAR"
  | "TAMPO_CUTOUT_CIRCULAR";

export type TampoCutout = {
  id: string;
  tipo: TampoCutoutTipo;
  /** mm — retângulos / fogão / pia */
  width?: number;
  height?: number;
  /** mm — só circular */
  diameter?: number;
  /** Centro relativo ao centro do TAMPO (mm) */
  x: number;
  y: number;
  /** Sempre 30 nesta fase */
  depth: number;
};

export type TampoCutoutValidation = {
  ok: boolean;
  errors: string[];
};

export type TampoCutoutCutlistEntry = {
  tipo: TampoCutoutTipo;
  width?: number;
  height?: number;
  diameter?: number;
  x: number;
  y: number;
};

export const TAMPO_CUTOUT_DEPTH_MM = 30;

export const TAMPO_CUTOUT_DEFAULTS = {
  TAMPO_CUTOUT_FOGAO: { width: 560, height: 490 },
  TAMPO_CUTOUT_PIA: { width: 500, height: 400 },
  TAMPO_CUTOUT_RETANGULAR: { width: 200, height: 200 },
  TAMPO_CUTOUT_CIRCULAR: { diameter: 180 },
} as const;

export const TAMPO_CUTOUT_MIN = {
  TAMPO_CUTOUT_FOGAO: { width: 480, height: 480 },
  TAMPO_CUTOUT_PIA: { width: 400, height: 340 },
  TAMPO_CUTOUT_RETANGULAR: { width: 20, height: 20 },
  TAMPO_CUTOUT_CIRCULAR: { diameter: 20 },
} as const;

export const TAMPO_CUTOUT_TYPE_LABELS: Record<TampoCutoutTipo, string> = {
  TAMPO_CUTOUT_FOGAO: "Recorte Fogão",
  TAMPO_CUTOUT_PIA: "Recorte Pia",
  TAMPO_CUTOUT_RETANGULAR: "Recorte Retangular",
  TAMPO_CUTOUT_CIRCULAR: "Recorte Circular",
};

let cutoutSeq = 0;

export function createTampoCutoutId(prefix = "tampo-cutout"): string {
  cutoutSeq += 1;
  return `${prefix}-${Date.now()}-${cutoutSeq}`;
}

export function isCircularTampoCutout(tipo: TampoCutoutTipo): boolean {
  return tipo === "TAMPO_CUTOUT_CIRCULAR";
}

export function normalizeTampoCutout(cutout: TampoCutout): TampoCutout {
  const base: TampoCutout = {
    ...cutout,
    id: cutout.id || createTampoCutoutId(),
    depth: TAMPO_CUTOUT_DEPTH_MM,
    x: Number(cutout.x) || 0,
    y: Number(cutout.y) || 0,
  };
  if (isCircularTampoCutout(base.tipo)) {
    const diameter =
      Number(base.diameter) || TAMPO_CUTOUT_DEFAULTS.TAMPO_CUTOUT_CIRCULAR.diameter;
    return {
      ...base,
      diameter,
      width: undefined,
      height: undefined,
    };
  }
  const defaults = TAMPO_CUTOUT_DEFAULTS[base.tipo] as { width: number; height: number };
  return {
    ...base,
    width: Number(base.width) || defaults.width,
    height: Number(base.height) || defaults.height,
    diameter: undefined,
  };
}

export function createTampoCutout(
  tipo: TampoCutoutTipo,
  partial?: Partial<Omit<TampoCutout, "tipo" | "id">>
): TampoCutout {
  const defaults = TAMPO_CUTOUT_DEFAULTS[tipo];
  return normalizeTampoCutout({
    id: createTampoCutoutId(),
    tipo,
    x: 0,
    y: 0,
    depth: TAMPO_CUTOUT_DEPTH_MM,
    ...("diameter" in defaults ? { diameter: defaults.diameter } : { width: defaults.width, height: defaults.height }),
    ...partial,
  });
}

function rectHalfExtents(cutout: TampoCutout): { halfW: number; halfH: number } | null {
  if (isCircularTampoCutout(cutout.tipo)) {
    const d = Number(cutout.diameter) || 0;
    if (!(d > 0)) return null;
    const r = d / 2;
    return { halfW: r, halfH: r };
  }
  const w = Number(cutout.width) || 0;
  const h = Number(cutout.height) || 0;
  if (!(w > 0) || !(h > 0)) return null;
  return { halfW: w / 2, halfH: h / 2 };
}

export function validateTampoCutout(
  cutout: TampoCutout,
  tampo: { width: number; height: number }
): TampoCutoutValidation {
  const errors: string[] = [];
  const c = normalizeTampoCutout(cutout);
  const label = TAMPO_CUTOUT_TYPE_LABELS[c.tipo];
  const tampoW = Math.max(0, Number(tampo.width) || 0);
  const tampoH = Math.max(0, Number(tampo.height) || 0);

  if (isCircularTampoCutout(c.tipo)) {
    const diameter = Number(c.diameter) || 0;
    if (!(diameter > 0)) {
      errors.push(`${label}: diâmetro deve ser > 0.`);
    } else {
      const minD = TAMPO_CUTOUT_MIN.TAMPO_CUTOUT_CIRCULAR.diameter;
      if (diameter < minD) {
        errors.push(`${label}: diâmetro mínimo ${minD} mm (recebido ${diameter} mm).`);
      }
    }
  } else {
    const width = Number(c.width) || 0;
    const height = Number(c.height) || 0;
    if (!(width > 0) || !(height > 0)) {
      errors.push(`${label}: largura e altura devem ser > 0.`);
    } else {
      const min = TAMPO_CUTOUT_MIN[c.tipo] as { width: number; height: number };
      if (width < min.width) {
        errors.push(`${label}: largura mínima ${min.width} mm (recebido ${width} mm).`);
      }
      if (height < min.height) {
        errors.push(`${label}: altura mínima ${min.height} mm (recebido ${height} mm).`);
      }
    }
  }

  const half = rectHalfExtents(c);
  if (half) {
    const maxX = tampoW / 2;
    const maxY = tampoH / 2;
    if (Math.abs(c.x) + half.halfW > maxX + 1e-6) {
      errors.push(
        `${label}: recorte sai do comprimento do TAMPO (x=${c.x}, half=${half.halfW}, máx±${maxX}).`
      );
    }
    if (Math.abs(c.y) + half.halfH > maxY + 1e-6) {
      errors.push(
        `${label}: recorte sai da largura do TAMPO (y=${c.y}, half=${half.halfH}, máx±${maxY}).`
      );
    }
  }

  return { ok: errors.length === 0, errors };
}

export function validateAllTampoCutouts(
  cutouts: readonly TampoCutout[],
  tampo: { width: number; height: number }
): TampoCutoutValidation {
  const errors: string[] = [];
  for (const c of cutouts) {
    const v = validateTampoCutout(c, tampo);
    if (!v.ok) errors.push(...v.errors);
  }
  return { ok: errors.length === 0, errors };
}

export function serializeTampoCutoutsForCutlist(
  cutouts: readonly TampoCutout[] | undefined
): TampoCutoutCutlistEntry[] {
  if (!cutouts?.length) return [];
  return cutouts.map((raw) => {
    const c = normalizeTampoCutout(raw);
    if (isCircularTampoCutout(c.tipo)) {
      return { tipo: c.tipo, diameter: c.diameter, x: c.x, y: c.y };
    }
    return { tipo: c.tipo, width: c.width, height: c.height, x: c.x, y: c.y };
  });
}
