import type { HoleFaceKind } from '@/core/drill/holeCatalog';

export type ParsedKdtHole = {
  xMm: number;
  yMm: number;
  diameterMm: number;
  depthMm: number;
  face: HoleFaceKind;
};

/** Rasgo (TypeNo=3, "Vertical Line") — início/fim + largura, ver PimoDrillGroove. */
export type ParsedKdtGroove = {
  beginXMm: number;
  beginYMm: number;
  endXMm: number;
  endYMm: number;
  widthMm: number;
  depthMm: number;
  correctionMm?: number;
};

export type ParsedKdtPanel = {
  pieceDims: { lengthMm: number; widthMm: number; thicknessMm: number };
  holes: ParsedKdtHole[];
  grooves: ParsedKdtGroove[];
  /** Rasgos com TypeNo=3 encontrados mas cuja expressão não foi possível avaliar. */
  groovesSkipped: number;
};

function rawText(el: Element | null): string | null {
  const raw = el?.textContent?.trim();
  return raw ? raw : null;
}

function numText(el: Element | null): number {
  const n = Number(rawText(el));
  return Number.isFinite(n) ? n : 0;
}

const PLAIN_NUMBER_RE = /^[+-]?\d+\.?\d*$/;
const EXPR_TOKEN_RE = /([+-]?)(\d+\.?\d*|[LWT])/g;

/**
 * Avalia expressões algébricas simples do formato DRILL/KDT: soma/subtração de
 * L (comprimento), W (largura), T (espessura) do painel com constantes, com um
 * único nível opcional de parênteses à volta de um número (ex.: "L+10",
 * "W-26.1", "L-(0.0)", "W-(60)"). Nunca usa eval()/Function() sobre texto do
 * ficheiro — só tokeniza e soma. Lança erro se encontrar algo fora deste
 * padrão (operadores não suportados, variável desconhecida) em vez de assumir
 * 0 silenciosamente.
 */
export function evalDrillExpr(
  raw: string,
  vars: { L: number; W: number; T: number },
): number {
  const cleaned = raw.replace(/[()\s]/g, '');
  if (!cleaned) throw new Error('Expressão DRILL vazia.');

  let consumed = '';
  let total = 0;
  let matchedAny = false;
  EXPR_TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = EXPR_TOKEN_RE.exec(cleaned)) !== null) {
    matchedAny = true;
    consumed += match[0];
    const sign = match[1] === '-' ? -1 : 1;
    const term = match[2];
    const value =
      term === 'L' || term === 'W' || term === 'T' ? vars[term] : Number(term);
    total += sign * value;
  }
  if (!matchedAny || consumed !== cleaned) {
    throw new Error(`Expressão DRILL não suportada: "${raw}".`);
  }
  return total;
}

/** Número literal ou expressão algébrica (ver evalDrillExpr). */
function numOrExpr(el: Element | null, vars: { L: number; W: number; T: number }): number {
  const raw = rawText(el);
  if (raw === null) return 0;
  if (PLAIN_NUMBER_RE.test(raw)) return Number(raw);
  return evalDrillExpr(raw, vars);
}

/** <Enable>0</Enable> desliga o bloco CAD; ausência da tag = activo (como antes). */
function isEnabled(cad: Element): boolean {
  return rawText(cad.querySelector('Enable')) !== '0';
}

/**
 * Parser do formato XML DRILL/KDT (ver core/drill/drillExport.ts — gerador de referência,
 * não editado, só lido para conhecer o formato). TypeNo=1 (Vertical Hole) → face 'face';
 * TypeNo=2 (Horizontal Hole) → face 'espessura'; TypeNo=3 (Vertical Line/rasgo) →
 * ParsedKdtGroove (Begin/End/Width/Depth/Correction). X1/Y1/BeginX/BeginY/EndX/EndY podem
 * ser expressões algébricas L/W/T — ver evalDrillExpr. Blocos <Enable>0</Enable> são
 * ignorados por completo (furo ou rasgo).
 */
export function parseKdtXml(xmlText: string): ParsedKdtPanel {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('XML inválido — não foi possível interpretar o ficheiro.');
  }

  const panelEl = doc.querySelector('PANEL');
  const pieceDims = {
    lengthMm: numText(panelEl?.querySelector('PanelLength') ?? null),
    widthMm: numText(panelEl?.querySelector('PanelWidth') ?? null),
    thicknessMm: numText(panelEl?.querySelector('PanelThickness') ?? null),
  };
  const vars = { L: pieceDims.lengthMm, W: pieceDims.widthMm, T: pieceDims.thicknessMm };

  const holes: ParsedKdtHole[] = [];
  const grooves: ParsedKdtGroove[] = [];
  let groovesSkipped = 0;

  for (const cad of Array.from(doc.querySelectorAll('CAD'))) {
    if (!isEnabled(cad)) continue;

    const typeNo = numText(cad.querySelector('TypeNo'));

    if (typeNo === 3) {
      try {
        const correctionEl = cad.querySelector('Correction');
        grooves.push({
          beginXMm: numOrExpr(cad.querySelector('BeginX'), vars),
          beginYMm: numOrExpr(cad.querySelector('BeginY'), vars),
          endXMm: numOrExpr(cad.querySelector('EndX'), vars),
          endYMm: numOrExpr(cad.querySelector('EndY'), vars),
          widthMm: numText(cad.querySelector('Width')),
          depthMm: numText(cad.querySelector('Depth')),
          correctionMm: correctionEl ? numText(correctionEl) : undefined,
        });
      } catch {
        groovesSkipped += 1;
      }
      continue;
    }
    if (typeNo !== 1 && typeNo !== 2) continue;

    const diameterMm = numText(cad.querySelector('Diameter'));
    if (diameterMm <= 0) continue;

    holes.push({
      xMm: numOrExpr(cad.querySelector('X1'), vars),
      yMm: numOrExpr(cad.querySelector('Y1'), vars),
      diameterMm,
      depthMm: numText(cad.querySelector('Depth')),
      face: typeNo === 1 ? 'face' : 'espessura',
    });
  }

  return { pieceDims, holes, grooves, groovesSkipped };
}
