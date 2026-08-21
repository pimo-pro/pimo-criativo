import { sanitizePiece } from './geometry/pieceGeometry';
import { axesOverlayStyle, viewerShellStyle } from './pimoDrillStyles';
import type { DrillHoleViewModel, PieceModel, PimoDrillToolId } from './pimoDrillTypes';

type Props = {
  piece: PieceModel;
  holes: DrillHoleViewModel[];
  activeTool: PimoDrillToolId;
  selectedHoleId: string | null;
  onSelectHole: (id: string | null) => void;
  onPlaceHole: (xMm: number, yMm: number) => void;
};

const VIEW_W = 480;
const VIEW_H = 320;
const PAD = 52;
const MIN_HIT_RADIUS_PX = 8;

function AxesOverlay() {
  return (
    <div style={axesOverlayStyle} aria-hidden>
      <svg width="56" height="56" viewBox="0 0 56 56">
        <line x1="28" y1="28" x2="8" y2="28" stroke="#ef4444" strokeWidth="2" />
        <polygon points="8,28 14,24 14,32" fill="#ef4444" />
        <text x="6" y="26" fill="#ef4444" fontSize="9">
          X+
        </text>
        <line x1="28" y1="28" x2="28" y2="48" stroke="#3b82f6" strokeWidth="2" />
        <polygon points="28,48 24,42 32,42" fill="#3b82f6" />
        <text x="30" y="46" fill="#3b82f6" fontSize="9">
          Y+
        </text>
      </svg>
    </div>
  );
}

export default function PimoDrillViewer2D({
  piece,
  holes,
  activeTool,
  selectedHoleId,
  onSelectHole,
  onPlaceHole,
}: Props) {
  const p = sanitizePiece(piece);
  const usableW = VIEW_W - PAD * 2;
  const usableH = VIEW_H - PAD * 2;
  const scale = Math.min(usableW / p.lengthMm, usableH / p.widthMm);
  const pieceW = p.lengthMm * scale;
  const pieceH = p.widthMm * scale;
  const originX = PAD;
  const originY = VIEW_H - PAD;
  // Origem lógica da peça (xMm=0, yMm=0) no canto superior-direito do
  // retângulo desenhado — convenção real do DRILL: X+ cresce para a
  // esquerda, Y+ cresce para baixo (ver AxesOverlay).
  const pieceOriginX = originX + pieceW;
  const pieceOriginY = originY - pieceH;

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = VIEW_W / rect.width;
    const scaleY = VIEW_H / rect.height;
    const svgX = (e.clientX - rect.left) * scaleX;
    const svgY = (e.clientY - rect.top) * scaleY;

    // Hit-test furos existentes — clicar num furo sempre selecciona, independente
    // da ferramenta activa.
    let hit: DrillHoleViewModel | null = null;
    let hitDist = Infinity;
    for (const hole of holes) {
      const hx = pieceOriginX - hole.xMm * scale;
      const hy = pieceOriginY + hole.yMm * scale;
      const hr = Math.max(MIN_HIT_RADIUS_PX, (hole.diameterMm / 2) * scale);
      const dist = Math.hypot(svgX - hx, svgY - hy);
      if (dist <= hr && dist < hitDist) {
        hit = hole;
        hitDist = dist;
      }
    }
    if (hit) {
      onSelectHole(hit.id);
      return;
    }

    if (activeTool !== 'hole') return;
    if (
      svgX < originX ||
      svgX > originX + pieceW ||
      svgY < originY - pieceH ||
      svgY > originY
    ) {
      return;
    }
    const xMm = (pieceOriginX - svgX) / scale;
    const yMm = (svgY - pieceOriginY) / scale;
    onPlaceHole(xMm, yMm);
  };

  return (
    <div aria-label="Viewer 2D" style={viewerShellStyle}>
      <AxesOverlay />
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        role="img"
        onClick={handleSvgClick}
        style={{ cursor: activeTool === 'hole' ? 'crosshair' : 'default' }}
      >
        <title>
          Peça 2D {p.lengthMm}×{p.widthMm} mm · T={p.thicknessMm} mm
        </title>

        <g id="layer-bg">
          <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill="#0b1220" />
        </g>
        <g id="layer-grid" aria-hidden />
        <g id="layer-piece">
          <rect
            x={originX}
            y={originY - pieceH}
            width={pieceW}
            height={pieceH}
            fill="rgba(148, 163, 184, 0.22)"
            stroke="#94a3b8"
            strokeWidth={2}
          />
        </g>
        <g id="layer-guides">
          <text
            x={originX + pieceW / 2}
            y={originY + 16}
            textAnchor="middle"
            fill="#94a3b8"
            fontSize={11}
          >
            L = {p.lengthMm} mm
          </text>
          <text
            x={originX - 10}
            y={originY - pieceH / 2}
            textAnchor="middle"
            fill="#94a3b8"
            fontSize={11}
            transform={`rotate(-90 ${originX - 10} ${originY - pieceH / 2})`}
          >
            W = {p.widthMm} mm
          </text>
          <text x={PAD} y={20} fill="#64748b" fontSize={11}>
            T = {p.thicknessMm} mm
          </text>
        </g>
        <g id="layer-features">
          {holes.map((hole) => {
            const hx = pieceOriginX - hole.xMm * scale;
            const hy = pieceOriginY + hole.yMm * scale;
            const hr = Math.max(1, (hole.diameterMm / 2) * scale);
            const isSelected = hole.id === selectedHoleId;
            return (
              <g key={hole.id}>
                <circle
                  cx={hx}
                  cy={hy}
                  r={hr}
                  fill="rgba(15, 23, 42, 0.85)"
                  stroke={isSelected ? '#22d3ee' : '#f97316'}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                />
                <text
                  x={hx}
                  y={hy - hr - 4}
                  textAnchor="middle"
                  fill={isSelected ? '#22d3ee' : '#cbd5e1'}
                  fontSize={9}
                >
                  Ø{hole.diameterMm}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
