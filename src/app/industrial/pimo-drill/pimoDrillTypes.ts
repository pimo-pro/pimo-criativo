export type PimoDrillViewMode = '2d' | '3d';

export type PimoDrillFeatureToolId =
  | 'hole'
  | 'slot'
  | 'rect'
  | 'circle'
  | 'arc'
  | 'path';

/** Ferramenta activa na toolbar (vista ou feature). */
export type PimoDrillToolId = PimoDrillViewMode | PimoDrillFeatureToolId;

export type PieceDimsMm = {
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
};

export type ToolFieldDef = {
  key: string;
  label: string;
};

export const PIMO_DRILL_VIEW_TOOLS: Array<{
  id: PimoDrillViewMode;
  label: string;
}> = [
  { id: '2d', label: 'Vista 2D' },
  { id: '3d', label: 'Vista 3D' },
];

export const PIMO_DRILL_FEATURE_TOOLS: Array<{
  id: PimoDrillFeatureToolId;
  label: string;
}> = [
  { id: 'hole', label: 'Buraco' },
  { id: 'slot', label: 'Entalhe' },
  { id: 'rect', label: 'Rect' },
  { id: 'circle', label: 'Círculo' },
  { id: 'arc', label: 'Arco' },
  { id: 'path', label: 'Caminho' },
];

/** @deprecated Preferir PIMO_DRILL_FEATURE_TOOLS */
export const PIMO_DRILL_TOOLS = PIMO_DRILL_FEATURE_TOOLS;

export const TOOL_UI_FIELDS: Record<PimoDrillToolId, ToolFieldDef[]> = {
  '2d': [],
  '3d': [],
  hole: [
    { key: 'diameter', label: 'Ø (mm)' },
    { key: 'depth', label: 'Profundidade (mm)' },
    { key: 'face', label: 'Face' },
    { key: 'x', label: 'X (mm)' },
    { key: 'y', label: 'Y (mm)' },
  ],
  slot: [
    { key: 'length', label: 'Comprimento (mm)' },
    { key: 'width', label: 'Largura (mm)' },
    { key: 'depth', label: 'Profundidade (mm)' },
    { key: 'angle', label: 'Ângulo (°)' },
    { key: 'face', label: 'Face' },
  ],
  rect: [
    { key: 'length', label: 'L (mm)' },
    { key: 'width', label: 'W (mm)' },
    { key: 'depth', label: 'Profundidade (mm)' },
    { key: 'face', label: 'Face' },
  ],
  circle: [
    { key: 'diameter', label: 'Ø (mm)' },
    { key: 'depth', label: 'Profundidade (mm)' },
    { key: 'face', label: 'Face' },
  ],
  arc: [
    { key: 'radius', label: 'R (mm)' },
    { key: 'startAngle', label: 'Ângulo início (°)' },
    { key: 'endAngle', label: 'Ângulo fim (°)' },
    { key: 'face', label: 'Face' },
  ],
  path: [{ key: 'note', label: 'Pontos (fase posterior)' }],
};

export type PieceModel = PieceDimsMm & {
  id: string;
};

export const DEFAULT_PIECE: PieceModel = {
  id: 'piece-main',
  lengthMm: 600,
  widthMm: 400,
  thicknessMm: 18,
};

export const DEFAULT_VIEW_MODE: PimoDrillViewMode = '3d';

export const DEFAULT_PIECE_DIMS: PieceDimsMm = {
  lengthMm: DEFAULT_PIECE.lengthMm,
  widthMm: DEFAULT_PIECE.widthMm,
  thicknessMm: DEFAULT_PIECE.thicknessMm,
};

export function isViewMode(tool: PimoDrillToolId): tool is PimoDrillViewMode {
  return tool === '2d' || tool === '3d';
}
