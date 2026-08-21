import type { HoleFaceKind } from '@/core/drill/holeCatalog';

export type ParsedKdtHole = {
  xMm: number;
  yMm: number;
  diameterMm: number;
  depthMm: number;
  face: HoleFaceKind;
};

export type ParsedKdtPanel = {
  pieceDims: { lengthMm: number; widthMm: number; thicknessMm: number };
  holes: ParsedKdtHole[];
  groovesSkipped: number;
};

function numText(el: Element | null): number {
  const raw = el?.textContent?.trim();
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Parser do formato XML DRILL/KDT (ver core/drill/drillExport.ts — gerador de referência,
 * não editado, só lido para conhecer o formato). TypeNo=1 (Vertical Hole) → face 'face';
 * TypeNo=2 (Horizontal Hole) → face 'espessura'; TypeNo=3 (Vertical Line/rasgo) não tem
 * equivalente no modelo de furos do simulador — contado à parte, não importado.
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

  const holes: ParsedKdtHole[] = [];
  let groovesSkipped = 0;

  for (const cad of Array.from(doc.querySelectorAll('CAD'))) {
    const typeNo = numText(cad.querySelector('TypeNo'));
    if (typeNo === 3) {
      groovesSkipped += 1;
      continue;
    }
    if (typeNo !== 1 && typeNo !== 2) continue;

    const diameterMm = numText(cad.querySelector('Diameter'));
    if (diameterMm <= 0) continue;

    holes.push({
      xMm: numText(cad.querySelector('X1')),
      yMm: numText(cad.querySelector('Y1')),
      diameterMm,
      depthMm: numText(cad.querySelector('Depth')),
      face: typeNo === 1 ? 'face' : 'espessura',
    });
  }

  return { pieceDims, holes, groovesSkipped };
}
