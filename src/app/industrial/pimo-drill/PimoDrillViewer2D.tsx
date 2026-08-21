import { sanitizePiece } from './geometry/pieceGeometry';
import { axesOverlayStyle, viewerShellStyle } from './pimoDrillStyles';
import type { DrillHoleViewModel, PieceModel } from './pimoDrillTypes';

type Props = {
  piece: PieceModel;
  holes: DrillHoleViewModel[];
};

const VIEW_W = 480;
const VIEW_H = 320;
const PAD = 52;

function AxesOverlay() {
  return (
    <div style={axesOverlayStyle} aria-hidden>
      <svg width="56" height="56" viewBox="0 0 56 56">
        <line x1="28" y1="28" x2="48" y2="28" stroke="#ef4444" strokeWidth="2" />
        <polygon points="48,28 42,24 42,32" fill="#ef4444" />
        <text x="50" y="26" fill="#ef4444" fontSize="9">
          X+
        </text>
        <line x1="28" y1="28" x2="28" y2="8" stroke="#3b82f6" strokeWidth="2" />
        <polygon points="28,8 24,14 32,14" fill="#3b82f6" />
        <text x="30" y="10" fill="#3b82f6" fontSize="9">
          Y+
        </text>
      </svg>
    </div>
  );
}

export default function PimoDrillViewer2D({ piece, holes }: Props) {
  const p = sanitizePiece(piece);
  const usableW = VIEW_W - PAD * 2;
  const usableH = VIEW_H - PAD * 2;
  const scale = Math.min(usableW / p.lengthMm, usableH / p.widthMm);
  const pieceW = p.lengthMm * scale;
  const pieceH = p.widthMm * scale;
  const originX = PAD;
  const originY = VIEW_H - PAD;
  const cx = originX + pieceW / 2;
  const cy = originY - pieceH / 2;
  const cross = 8;

  return (
    <div aria-label="Viewer 2D" style={viewerShellStyle}>
      <AxesOverlay />
      <svg width="100%" height="100%" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img">
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
          <line x1={cx - cross} y1={cy} x2={cx + cross} y2={cy} stroke="#cbd5e1" strokeWidth={1} />
          <line x1={cx} y1={cy - cross} x2={cx} y2={cy + cross} stroke="#cbd5e1" strokeWidth={1} />
          <circle cx={cx} cy={cy} r={2} fill="#e2e8f0" />
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
            const hx = originX + hole.xMm * scale;
            const hy = originY - hole.yMm * scale;
            const hr = Math.max(1, (hole.diameterMm / 2) * scale);
            return (
              <circle
                key={hole.id}
                cx={hx}
                cy={hy}
                r={hr}
                fill="rgba(15, 23, 42, 0.85)"
                stroke="#f97316"
                strokeWidth={1.5}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}
