/**
 * Copia furos da cutlist sem reordenar eixos nem aplicar rotação implícita.
 * Coordenadas permanecem no referencial local [0..largura] × [0..altura] da peça.
 */
export function copyDrillHolesLocalUnmodified(
  holes: DrillHole[] | undefined
): DrillHole[] | undefined {
  if (!holes?.length) return undefined;
  const out: DrillHole[] = [];
  const seen = new Set<string>();
  for (const h of holes) {
    if (h.holeType === "cavilha" && h.topDrillable === false) continue;
    const x = Number(h.x);
    const y = Number(h.y);
    const diameter = Number(h.diameter);
    const depth = Number(h.depth);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !(diameter > 0) || !(depth > 0)) continue;
    const key = `${x.toFixed(3)}_${y.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      x,
      y,
      diameter,
      depth,
      holeType: h.holeType,
      topDrillable: h.topDrillable,
      rotation: h.rotation,
      rotacao: h.rotacao,
      angle: h.angle,
    });
  }
  return out.length > 0 ? out : undefined;
}

/**
 * Verifica se furos permanecem dentro dos limites locais da peça (anti-regressão).
 */
export function assertHolesWithinLocalPieceBounds(
  holes: Array<{ x: number; y: number; diameter?: number }>,
  larguraMm: number,
  alturaMm: number
): void {
  for (const h of holes) {
    const r = Number.isFinite(h.diameter) && (h.diameter ?? 0) > 0 ? (h.diameter ?? 0) / 2 : 0;
    if (h.x < r - EPS || h.y < r - EPS) {
      throw new Error(`Furo fora da peça (x=${h.x}, y=${h.y}, largura=${larguraMm})`);
    }
    if (h.x > larguraMm - r + EPS || h.y > alturaMm - r + EPS) {
      throw new Error(`Furo fora da peça (x=${h.x}, y=${h.y}, altura=${alturaMm})`);
    }
  }
}

/**
 * Posição relativa normalizada dos furos (0..1) para comparação antes/depois do pipeline.
 */
export function holeRelativePositions(
  holes: Array<{ x: number; y: number }>,
  larguraMm: number,
  alturaMm: number
): Array<{ rx: number; ry: number }> {
  const w = Math.max(1, larguraMm);
  const h = Math.max(1, alturaMm);
  return holes.map((hole) => ({ rx: hole.x / w, ry: hole.y / h }));
}

/**
 * Rotação geométrica real para o motor de nesting.
 *
 * Convenção: 90° CCW, alinhada a layoutCoordinateSystem.holeLocalToSheetOffsetMm:
 *   sx = hy, sy = H − hx  (H = altura da peça no referencial do furo)
 *
 * Após rotação de uma peça de (origW × origH) para (origH × origW):
 *   ponto (hx, hy) → (hy, origW − hx)
 */

type DrillHole = {
  x: number;
  y: number;
  diameter: number;
  depth: number;
  holeType?: string;
  topDrillable?: boolean;
  rotation?: number;
  rotacao?: number;
  angle?: number;
};

type InnerContour = {
  x_mm: number;
  y_mm: number;
  largura_mm: number;
  altura_mm: number;
};

type PlacementLike = {
  x_mm: number;
  y_mm: number;
  rotacao: number;
  largura_mm: number;
  altura_mm: number;
  drillHoles?: DrillHole[];
  holes?: DrillHole[];
  originalDrillHoles?: DrillHole[];
  innerContours?: InnerContour[];
  originalInnerContours?: InnerContour[];
};

type SheetLike = {
  sheet?: {
    largura_mm: number;
    altura_mm: number;
  };
  placements: PlacementLike[];
};

const EPS = 0.001;

function normalizeRotation(rotacao: number): 0 | 90 | 180 | 270 {
  const r = ((Math.round(rotacao) % 360) + 360) % 360;
  if (r === 90 || r === 180 || r === 270) return r;
  return 0;
}

function addRotation<T extends DrillHole>(op: T, angle: 0 | 90 | 180 | 270): T {
  if (angle === 0) return op;
  const next = { ...op };
  if (typeof next.rotation === "number") next.rotation = (next.rotation + angle) % 360;
  if (typeof next.rotacao === "number") next.rotacao = (next.rotacao + angle) % 360;
  if (typeof next.angle === "number") next.angle = (next.angle + angle) % 360;
  return next;
}

function isFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function within(min: number, value: number, max: number): boolean {
  return value >= min - EPS && value <= max + EPS;
}

function originalDimensions(p: PlacementLike, rotation: 0 | 90 | 180 | 270): { w: number; h: number } {
  const swapsDims = rotation === 90 || rotation === 270;
  return {
    w: swapsDims ? p.altura_mm : p.largura_mm,
    h: swapsDims ? p.largura_mm : p.altura_mm,
  };
}

function holeFinalOffset(
  h: DrillHole,
  rotation: 0 | 90 | 180 | 270,
  origW: number,
  origH: number
): { x: number; y: number } {
  if (rotation === 90) return { x: h.y, y: origW - h.x };
  if (rotation === 180) return { x: origW - h.x, y: origH - h.y };
  if (rotation === 270) return { x: origH - h.y, y: h.x };
  return { x: h.x, y: h.y };
}

function contourFinalRect(
  c: InnerContour,
  rotation: 0 | 90 | 180 | 270,
  origW: number,
  origH: number
): InnerContour {
  if (rotation === 90) {
    return {
      x_mm: c.y_mm,
      y_mm: origW - c.x_mm - c.largura_mm,
      largura_mm: c.altura_mm,
      altura_mm: c.largura_mm,
    };
  }
  if (rotation === 180) {
    return {
      x_mm: origW - c.x_mm - c.largura_mm,
      y_mm: origH - c.y_mm - c.altura_mm,
      largura_mm: c.largura_mm,
      altura_mm: c.altura_mm,
    };
  }
  if (rotation === 270) {
    return {
      x_mm: origH - c.y_mm - c.altura_mm,
      y_mm: c.x_mm,
      largura_mm: c.altura_mm,
      altura_mm: c.largura_mm,
    };
  }
  return { ...c };
}

function isHoleInsidePlacementAndSheet(
  p: PlacementLike,
  h: DrillHole,
  rotation: 0 | 90 | 180 | 270,
  origW: number,
  origH: number,
  sheet?: SheetLike["sheet"]
): boolean {
  if (!Number.isFinite(h.x) || !Number.isFinite(h.y)) return false;
  const r = Number.isFinite(h.diameter) && h.diameter > 0 ? h.diameter / 2 : 0;
  const off = holeFinalOffset(h, rotation, origW, origH);
  if (!within(r, off.x, p.largura_mm - r) || !within(r, off.y, p.altura_mm - r)) return false;
  if (!sheet) return true;
  const absX = p.x_mm + off.x;
  const absY = p.y_mm + off.y;
  return within(r, absX, sheet.largura_mm - r) && within(r, absY, sheet.altura_mm - r);
}

function isContourInsidePlacementAndSheet(p: PlacementLike, rect: InnerContour, sheet?: SheetLike["sheet"]): boolean {
  if (
    !Number.isFinite(rect.x_mm) ||
    !Number.isFinite(rect.y_mm) ||
    !isFinitePositive(rect.largura_mm) ||
    !isFinitePositive(rect.altura_mm)
  ) {
    return false;
  }

  const insidePlacement =
    rect.x_mm >= -EPS &&
    rect.y_mm >= -EPS &&
    rect.x_mm + rect.largura_mm <= p.largura_mm + EPS &&
    rect.y_mm + rect.altura_mm <= p.altura_mm + EPS;
  if (!insidePlacement) return false;

  if (!sheet) return true;
  return (
    p.x_mm + rect.x_mm >= -EPS &&
    p.y_mm + rect.y_mm >= -EPS &&
    p.x_mm + rect.x_mm + rect.largura_mm <= sheet.largura_mm + EPS &&
    p.y_mm + rect.y_mm + rect.altura_mm <= sheet.altura_mm + EPS
  );
}

/**
 * Coordenadas que os geradores atuais esperam receber:
 * - rot=90: furos continuam no referencial original, porque o gerador aplica rotacao.
 * - rot=180/270: geradores tratam como offset direto; enviamos já no espaço colocado.
 */
function toConsumerHole(
  h: DrillHole,
  rotation: 0 | 90 | 180 | 270,
  origW: number,
  origH: number
): DrillHole {
  const withAngle = addRotation({ ...h }, rotation);
  if (rotation === 0 || rotation === 90) return withAngle;
  const off = holeFinalOffset(h, rotation, origW, origH);
  return { ...withAngle, x: off.x, y: off.y };
}

function toConsumerContour(
  c: InnerContour,
  rotation: 0 | 90 | 180 | 270,
  origW: number,
  origH: number
): InnerContour {
  if (rotation === 90) {
    return {
      // O gerador calcula sy = placedHeight - x_mm; usar a aresta direita original.
      x_mm: c.x_mm + c.largura_mm,
      y_mm: c.y_mm,
      largura_mm: c.largura_mm,
      altura_mm: c.altura_mm,
    };
  }
  return contourFinalRect(c, rotation, origW, origH);
}

/**
 * Roda um array de furos 90° CCW dado o largura original da peça.
 *   novo_x = hy
 *   novo_y = origW − hx
 */
export function rotateDrillHoles90CCW(holes: DrillHole[], origW: number): DrillHole[] {
  return rotateDrillHoles(holes, 90, origW, 0);
}

export function rotateDrillHoles(
  holes: DrillHole[],
  angle: 0 | 90 | 180 | 270,
  origW: number,
  origH: number
): DrillHole[] {
  if (angle === 0) return holes.map((h) => ({ ...h }));
  return holes.map((h) => {
    if (angle === 90) return addRotation({ ...h, x: h.y, y: origW - h.x }, angle);
    if (angle === 180) return addRotation({ ...h, x: origW - h.x, y: origH - h.y }, angle);
    return addRotation({ ...h, x: origH - h.y, y: h.x }, angle);
  });
}

/**
 * Roda um array de innerContours 90° CCW dado o largura original da peça.
 *   x_new     = y_mm
 *   y_new     = origW − x_mm − largura_mm
 *   largura_new = altura_mm
 *   altura_new  = largura_mm
 */
export function rotateInnerContours90CCW(contours: InnerContour[], origW: number): InnerContour[] {
  return rotateInnerContours(contours, 90, origW, 0);
}

export function rotateInnerContours(
  contours: InnerContour[],
  angle: 0 | 90 | 180 | 270,
  origW: number,
  origH: number
): InnerContour[] {
  if (angle === 0) return contours.map((c) => ({ ...c }));
  return contours.map((c) => {
    if (angle === 90) {
      return {
        x_mm: c.y_mm,
        y_mm: origW - c.x_mm - c.largura_mm,
        largura_mm: c.altura_mm,
        altura_mm: c.largura_mm,
      };
    }
    if (angle === 180) {
      return {
        x_mm: origW - c.x_mm - c.largura_mm,
        y_mm: origH - c.y_mm - c.altura_mm,
        largura_mm: c.largura_mm,
        altura_mm: c.altura_mm,
      };
    }
    return {
      x_mm: origH - c.y_mm - c.altura_mm,
      y_mm: c.x_mm,
      largura_mm: c.altura_mm,
      altura_mm: c.largura_mm,
    };
  });
}

/**
 * Verifica se a geometria da peça permite rotação automática pelo nesting.
 * Retorna false se:
 *  - a peça tem grainDirection (tecido/veio com orientação fixa)
 *  - tem furos com topDrillable=false (operações de face lateral — direcionais)
 */
export function canRotatePieceGeometry(piece: {
  grainDirection?: string;
  drillHoles?: DrillHole[];
  holes?: DrillHole[];
}): boolean {
  if (piece.grainDirection) return false;
  const holes = piece.drillHoles ?? piece.holes ?? [];
  if (holes.some((h) => h.topDrillable === false)) return false;
  return true;
}

/**
 * Pós-processamento geométrico de todas as chapas após o layout final.
 *
 * Para cada placement:
 *  1. Garante backups das coords originais.
 *  2. Calcula a geometria absoluta final implícita (placement + rotação).
 *  3. Remove operações que ficariam fora da peça ou fora da chapa.
 *  4. Devolve coords compatíveis com os consumidores atuais sem alterar geradores.
 *
 * Seguro chamar múltiplas vezes: a fonte é sempre originalDrillHoles/originalInnerContours.
 */
export function applyRotationGeometryToSheets(sheets: SheetLike[]): void {
  for (const s of sheets) {
    for (const p of s.placements) {
      const rawHoles = p.drillHoles ?? p.holes;

      // Garante backup das coords originais antes de qualquer transformação
      if (!p.originalDrillHoles && rawHoles && rawHoles.length > 0) {
        p.originalDrillHoles = rawHoles.map((h) => ({ ...h }));
      }

      if (!p.originalInnerContours && p.innerContours && p.innerContours.length > 0) {
        p.originalInnerContours = p.innerContours.map((c) => ({ ...c }));
      }

      const rotation = normalizeRotation(p.rotacao);
      const { w: origW, h: origH } = originalDimensions(p, rotation);

      const origHoles = p.originalDrillHoles ?? rawHoles;
      if (origHoles && origHoles.length > 0) {
        const validOriginalHoles = origHoles.filter((h) =>
          isHoleInsidePlacementAndSheet(p, h, rotation, origW, origH, s.sheet)
        );
        const validHoles = validOriginalHoles.map((h) => toConsumerHole(h, rotation, origW, origH));
        p.originalDrillHoles = validOriginalHoles.length > 0 ? validOriginalHoles.map((h) => ({ ...h })) : undefined;
        p.drillHoles = validHoles.length > 0 ? validHoles : undefined;
        if (p.holes !== undefined) p.holes = validHoles.length > 0 ? validHoles : undefined;
      }

      const origContours = p.originalInnerContours ?? p.innerContours;
      if (origContours && origContours.length > 0) {
        const validContours = origContours
          .map((c) => ({ original: c, final: contourFinalRect(c, rotation, origW, origH) }))
          .filter(({ final }) => isContourInsidePlacementAndSheet(p, final, s.sheet))
          .map(({ original }) => toConsumerContour(original, rotation, origW, origH));
        p.innerContours = validContours.length > 0 ? validContours : undefined;
      }
    }
  }
}
