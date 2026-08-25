/**
 * Nesting V3 — Página de Layout Manual de Corte
 *
 * Funcionalidades:
 * - Canvas SVG 2D com zoom/pan
 * - Drag & drop com ghost
 * - Rotação de peças (0/90/180/270°)
 * - Painel de propriedades da peça selecionada
 * - Lista lateral com todas as peças
 * - Formulário para adicionar peças manualmente
 * - Auto-layout (shelf-packing)
 * - Exportar: PDF técnico + TCN + etiquetas oficiais (UEE)
 *
 * NÃO toca no motor industrial.
 */

import {
  useCallback, useRef, useState, useMemo,
  useEffect, type PointerEvent, type WheelEvent
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useNestingV3 } from "./useNestingV3";
import { calcSheetUtilization, rotateHoles } from "./nestingV3Engine";
import { downloadNestingV3Tcn, getV3ExportStats } from "./nestingV3Export";
import { downloadNestingV3Pdf } from "./nestingV3Pdf";
import { downloadNestingV3OfficialLabels } from "./nestingV3OfficialLabels";
import {
  beginIndustrialFileGeneration,
  endIndustrialFileGeneration,
} from "../core/fabrication/industrialGenerationSuspend";
import type { V3Piece, V3Placement } from "./nestingV3Types";
import type { CutPiece } from "../core/cutlayout/cutLayoutTypes";
import { Icon } from "../components/icons/Icon";
import { useProject } from "../context/useProject";
import { convertProjectToV3Pieces } from "./utils/convertProjectToV3Pieces";
import { IndustrialThreeColumnLayout } from "@/industrial/ui/layouts/IndustrialThreeColumnLayout";
import NestingV3StationSidebar from "./components/NestingV3StationSidebar";
import NestingV3SettingsPanel from "./components/NestingV3SettingsPanel";
import type { V3Sheet } from "./nestingV3Types";

// ── Props ─────────────────────────────────────────────────────────────────────

interface NestingV3PageProps {
  initialCutPieces?: CutPiece[];
  initialPieces?: V3Piece[];
  projectName?: string;
  projectId?: string;
  onClose?: () => void;
  /** "station" = rota dedicada com shell industrial PIMO */
  layout?: "standalone" | "station";
}

// ── Layout constants ──────────────────────────────────────────────────────────

const SIDEBAR_W    = 248;
const PROPS_W      = 220;
const TOOLBAR_H    = 44;
const SHEET_TABS_H = 34;
const STATUS_H     = 26;
const HOLE_RADIUS_MIN = 2.5;
const ZOOM_MIN = 0.05;
const ZOOM_MAX = 4;
/** 1 unidade SVG = 1 mm (evita SVG gigante e drag incoerente). */
const CANVAS_SCALE = 1;

// ── Theme colours (CSS vars with fallback) ────────────────────────────────────

const C = {
  bg:      "var(--navy,#0f172a)",
  surface: "var(--blue-dark,#1e293b)",
  surface2:"var(--black,#050816)",
  border:  "var(--border,rgba(255,255,255,0.1))",
  text:    "var(--text-main,#e2e8f0)",
  muted:   "var(--text-muted,#94a3b8)",
  accent:  "var(--blue-light,#3b82f6)",
  green:   "var(--status-done-color,#34d399)",
  amber:   "#fbbf24",
  danger:  "#f85149",
  sheetBg: "#e8e4dd",
  sheetBd: "#c0bab2",
};

const font = "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";

// ── Utils ─────────────────────────────────────────────────────────────────────

function effectiveDims(piece: V3Piece) {
  const rotated = piece.rotation === 90 || piece.rotation === 270;
  return rotated ? { w: piece.heightMm, h: piece.widthMm } : { w: piece.widthMm, h: piece.heightMm };
}

function darken(hex: string, amt = 40): string {
  try {
    const n = parseInt(hex.replace("#",""), 16);
    const r = Math.max(0, (n >> 16) - amt);
    const g = Math.max(0, ((n >> 8) & 0xff) - amt);
    const b = Math.max(0, (n & 0xff) - amt);
    return `#${r.toString(16).padStart(2,"0")}${g.toString(16).padStart(2,"0")}${b.toString(16).padStart(2,"0")}`;
  } catch { return hex; }
}

// ── Properties panel ──────────────────────────────────────────────────────────

function PropertiesPanel({ piece, placement, onRotate, onReturn, onMoveSheet, sheetCount }:{
  piece: V3Piece; placement?: V3Placement;
  onRotate: () => void; onReturn: () => void;
  onMoveSheet: (n: number) => void; sheetCount: number;
}) {
  const { w, h } = effectiveDims(piece);
  const holes = rotateHoles(piece.originalHoles, piece.rotation, piece.widthMm, piece.heightMm);
  const [targetSheet, setTargetSheet] = useState(placement ? placement.sheetIndex + 1 : 1);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "12px 12px 8px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 700, color: C.text, fontFamily: font, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {piece.name}
        </p>
        <p style={{ margin: 0, fontSize: 11, color: C.muted, fontFamily: font }}>
          {w} × {h} × {piece.thicknessMm} mm · {piece.rotation}°
        </p>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
        {/* Colour preview */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 6, background: piece.color, border: `2px solid ${darken(piece.color)}`, flexShrink: 0 }} />
          <div>
            <p style={{ margin: 0, fontSize: 11, color: C.text, fontFamily: font }}>{piece.materialName ?? "Material"}</p>
            <p style={{ margin: 0, fontSize: 10, color: C.muted, fontFamily: font }}>{piece.thicknessMm} mm</p>
          </div>
        </div>

        {/* Dimensions */}
        <SectionLabel>Dimensões efectivas</SectionLabel>
        <PropRow label="Largura"   value={`${w} mm`} />
        <PropRow label="Altura"    value={`${h} mm`} />
        <PropRow label="Espessura" value={`${piece.thicknessMm} mm`} />
        <PropRow label="Rotação"   value={`${piece.rotation}°`} />

        {/* Position */}
        {placement && (
          <>
            <SectionLabel>Posição na folha {placement.sheetIndex + 1}</SectionLabel>
            <PropRow label="X" value={`${Math.round(placement.xMm)} mm`} />
            <PropRow label="Y" value={`${Math.round(placement.yMm)} mm`} />
          </>
        )}

        {/* Holes */}
        <SectionLabel>{holes.length} furos</SectionLabel>
        {holes.length === 0 && <p style={{ fontSize: 11, color: C.muted, fontFamily: font }}>Sem furos definidos.</p>}
        {holes.map((h, i) => (
          <div key={i} style={{ padding: "4px 8px", marginBottom: 3, background: "rgba(255,255,255,0.025)", borderRadius: 5, fontSize: 10, color: C.muted, fontFamily: font }}>
            <strong style={{ color: C.text }}>{i + 1}.</strong> X={Math.round(h.x)} Y={Math.round(h.y)} Ø{h.diameter}×{h.depth}mm {h.holeType ? `· ${h.holeType}` : ""}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ padding: "10px 12px", borderTop: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
        <button type="button" onClick={onRotate}
          style={btnStyle(C.accent)}>↻ Rodar 90°</button>
        <button type="button" onClick={onReturn}
          style={btnStyle(C.danger)}>← Devolver à lista</button>
        {sheetCount > 1 && placement && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="number" min={1} max={sheetCount} value={targetSheet}
              onChange={(e) => setTargetSheet(+e.target.value)}
              className="input input-sm" style={{ width: 52, textAlign: "center" }} />
            <button type="button" onClick={() => onMoveSheet(targetSheet - 1)}
              style={{ ...btnStyle(C.muted), flex: 1 }}>Mover para folha</button>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: C.muted, margin: "10px 0 5px", fontFamily: font }}>
      {children}
    </div>
  );
}

function PropRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 11, fontFamily: font }}>
      <span style={{ color: C.muted }}>{label}</span>
      <span style={{ color: C.text, fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

function btnStyle(col: string): React.CSSProperties {
  return {
    width: "100%", padding: "7px 10px", borderRadius: 7,
    border: `1px solid ${col}44`, background: `${col}18`,
    color: col, fontSize: 12, fontWeight: 600, cursor: "pointer",
    fontFamily: font, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
  };
}

// ── Sidebar: piece list ───────────────────────────────────────────────────────

function PieceSidebar({ unplacedIds, pieces, sheets, placements, selectedId, onSelect, onDragStart, onRemove, onRotate, onFocus, onSelectSheet }:{
  unplacedIds: string[]; pieces: V3Piece[]; sheets: V3Sheet[];
  placements: V3Placement[]; selectedId: string | null;
  onSelect: (id: string) => void;
  onDragStart: (e: PointerEvent<HTMLDivElement>, id: string) => void;
  onRemove: (id: string) => void;
  onRotate: (id: string) => void;
  onFocus: (id: string) => void;
  onSelectSheet: (index: number) => void;
}) {
  const unplaced = pieces.filter((p) => unplacedIds.includes(p.id));

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
      <div style={{ padding: "10px 10px 6px", fontSize: 9, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: C.muted, flexShrink: 0, fontFamily: font }}>
        Por colocar ({unplaced.length})
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 6px 6px", minHeight: 0 }}>
        {unplaced.length === 0 && (
          <p style={{ fontSize: 11, color: C.muted, padding: "8px 4px", fontFamily: font }}>Todas colocadas ✓</p>
        )}
        {unplaced.map((piece) => (
          <PieceListItem key={piece.id} piece={piece} selected={selectedId === piece.id}
            onSelect={() => onSelect(piece.id)}
            onDragStart={(e) => onDragStart(e, piece.id)}
            onRotate={() => onRotate(piece.id)}
            onRemove={() => onRemove(piece.id)} />
        ))}

        {sheets.map((_sheet, si) => {
          const onSheet = placements
            .filter((p) => p.sheetIndex === si)
            .map((p) => pieces.find((pc) => pc.id === p.pieceId))
            .filter((p): p is V3Piece => p != null);
          if (onSheet.length === 0) return null;
          return (
            <div key={si} style={{ marginTop: 8 }}>
              <button
                type="button"
                onClick={() => onSelectSheet(si)}
                style={{ width: "100%", textAlign: "left", padding: "6px 4px 4px", fontSize: 9, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: C.muted, fontFamily: font, background: "transparent", border: "none", cursor: "pointer" }}
              >
                Folha {si + 1} ({onSheet.length})
              </button>
              {onSheet.map((piece) => (
                <div key={piece.id}
                  onClick={() => { onSelect(piece.id); onFocus(piece.id); }}
                  style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 7px", marginBottom: 2, borderRadius: 6, cursor: "pointer", background: selectedId === piece.id ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.02)", border: `1px solid ${selectedId === piece.id ? "rgba(59,130,246,0.3)" : "transparent"}` }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: piece.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 11, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: font }}>{piece.name}</p>
                    <p style={{ margin: 0, fontSize: 9, color: C.muted, fontFamily: font }}>{piece.widthMm}×{piece.heightMm} mm</p>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PieceListItem({ piece, selected, onSelect, onDragStart, onRotate, onRemove }: {
  piece: V3Piece; selected: boolean;
  onSelect: () => void; onDragStart: (e: PointerEvent<HTMLDivElement>) => void;
  onRotate: () => void; onRemove: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      onPointerDown={onDragStart}
      style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 7px", marginBottom: 2, background: selected ? "rgba(59,130,246,0.12)" : C.surface, border: `1px solid ${selected ? "rgba(59,130,246,0.35)" : C.border}`, borderRadius: 7, cursor: "grab" }}
    >
      <div style={{ width: 18, height: 18, borderRadius: 4, background: piece.color, border: `1px solid ${darken(piece.color)}`, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: font }}>{piece.name}</p>
        <p style={{ margin: 0, fontSize: 9, color: C.muted, fontFamily: font }}>{piece.widthMm}×{piece.heightMm}×{piece.thicknessMm}</p>
      </div>
      <div style={{ display: "flex", gap: 2, flexShrink: 0 }} onPointerDown={(e) => e.stopPropagation()}>
        <Btn onClick={onRotate} title="Rodar" c={C.muted}>↻</Btn>
        <Btn onClick={onRemove} title="Remover" c={C.danger}>×</Btn>
      </div>
    </div>
  );
}

function Btn({ onClick, title, c, children }: { onClick: () => void; title: string; c: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} title={title}
      style={{ width: 20, height: 20, borderRadius: 4, border: `1px solid ${c}44`, background: `${c}18`, color: c, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontFamily: font }}>
      {children}
    </button>
  );
}

// ── Add piece form ────────────────────────────────────────────────────────────

function AddPieceForm({ onAdd }: { onAdd: (n: string, w: number, h: number, t: number) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [w, setW] = useState(600);
  const [h, setH] = useState(400);
  const [t, setT] = useState(19);

  const handle = () => {
    if (w > 0 && h > 0 && t > 0) { onAdd(name, w, h, t); setName(""); setW(600); setH(400); }
  };

  return (
    <div style={{ borderTop: `1px solid ${C.border}`, padding: "8px 8px 6px", flexShrink: 0 }}>
      <button type="button" onClick={() => setOpen((v) => !v)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", borderRadius: 7, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: font }}>
        + Peça manual <span style={{ fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ marginTop: 7, display: "flex", flexDirection: "column", gap: 5 }}>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome"
            className="input input-sm" style={{ boxSizing: "border-box", width: "100%" }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
            {(
              [
                { label: "L", val: w, set: setW },
                { label: "A", val: h, set: setH },
                { label: "E", val: t, set: setT },
              ] as const
            ).map(({ label, val, set }) => (
              <div key={label}>
                <div style={{ fontSize: 9, color: C.muted, marginBottom: 2 }}>{label} (mm)</div>
                <input type="number" min={1} value={val} onChange={(e) => set(+e.target.value)}
                  className="input input-sm" style={{ width: "100%", boxSizing: "border-box" }} />
              </div>
            ))}
          </div>
          <button type="button" onClick={handle} className="button button-primary" style={{ width: "100%", fontSize: 11 }}>
            Adicionar
          </button>
        </div>
      )}
    </div>
  );
}

// ── Sheet SVG Canvas ──────────────────────────────────────────────────────────

interface SheetCanvasProps {
  sheet: { widthMm: number; heightMm: number };
  sheetIndex: number;
  pieces: V3Piece[];
  placements: V3Placement[];
  kerfMm: number;
  marginMm?: number;
  scale: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onPiecePointerDown: (e: PointerEvent<SVGGElement>, id: string, pl: V3Placement) => void;
  onRotate: (id: string) => void;
  onReturn: (id: string) => void;
  onMoveToSheet: (id: string, si: number) => void;
  sheetCount: number;
}

function SheetCanvas({ sheet, sheetIndex, pieces, placements, kerfMm: _kerfMm, marginMm = 0, scale, selectedId, onSelect, onPiecePointerDown, onRotate, onReturn, onMoveToSheet, sheetCount }: SheetCanvasProps) {
  const W = sheet.widthMm * scale;
  const H = sheet.heightMm * scale;
  const myPlacements = placements.filter((p) => p.sheetIndex === sheetIndex);
  const m = marginMm * scale;

  return (
    <svg width={W} height={H} style={{ display: "block", userSelect: "none" }}
      onClick={(e) => { if (e.target === e.currentTarget) onSelect(null); }}>
      {/* Sheet */}
      <rect width={W} height={H} fill={C.sheetBg} stroke={C.sheetBd} strokeWidth={1} />
      {marginMm > 0 && (
        <rect x={m} y={m} width={W - m * 2} height={H - m * 2}
          fill="none" stroke="rgba(59,130,246,0.25)" strokeWidth={0.8} strokeDasharray="4 3" />
      )}
      {/* Grid dots */}
      {scale > 0.06 && Array.from({ length: Math.floor(sheet.widthMm / 100) + 1 }).map((_, i) =>
        Array.from({ length: Math.floor(sheet.heightMm / 100) + 1 }).map((_, j) => (
          <circle key={`${i}-${j}`} cx={i * 100 * scale} cy={j * 100 * scale} r={0.8} fill="rgba(0,0,0,0.08)" />
        ))
      )}

      {myPlacements.map((pl) => {
        const piece = pieces.find((p) => p.id === pl.pieceId);
        if (!piece) return null;
        const { w, h } = effectiveDims(piece);
        const px = pl.xMm * scale, py = pl.yMm * scale;
        const pw = w * scale, ph = h * scale;
        const isSel = selectedId === piece.id;
        const holes = rotateHoles(piece.originalHoles, piece.rotation, piece.widthMm, piece.heightMm);

        return (
          <g key={piece.id}
            onPointerDown={(e) => onPiecePointerDown(e, piece.id, pl)}
            onClick={(e) => { e.stopPropagation(); onSelect(piece.id); }}
            style={{ cursor: "grab" }}>
            {/* Drop shadow on select */}
            {isSel && <rect x={px+2} y={py+2} width={pw} height={ph} fill="rgba(0,0,0,0.2)" rx={2}/>}
            {/* Body */}
            <rect x={px} y={py} width={pw} height={ph} fill={piece.color}
              stroke={isSel ? C.accent : darken(piece.color, 30)} strokeWidth={isSel ? 2 : 0.8} rx={1.5}/>
            {/* Grain hint */}
            <line x1={px+pw*0.05} y1={py+ph*0.5} x2={px+pw*0.95} y2={py+ph*0.5}
              stroke={darken(piece.color, 70)} strokeWidth={0.7} strokeDasharray="3 2" opacity={0.4}/>
            {/* Holes */}
            {holes.map((h, hi) => (
              <circle key={hi} cx={px+h.x*scale} cy={py+h.y*scale}
                r={Math.max(HOLE_RADIUS_MIN, h.diameter*scale*0.45)}
                fill="rgba(15,15,15,0.85)" />
            ))}
            {/* Name */}
            {pw > 28 && ph > 14 && (
              <text x={px+pw/2} y={py+ph/2} textAnchor="middle" dominantBaseline="middle"
                fontSize={Math.min(10, pw/9, ph/3.5)} fill={darken(piece.color,110)} opacity={0.8}
                style={{ pointerEvents:"none", userSelect:"none" }}>
                {piece.name}
              </text>
            )}
            {/* Dimensions on select */}
            {isSel && pw > 40 && (
              <>
                <text x={px+pw/2} y={py-3} textAnchor="middle" fontSize={7} fill={C.accent} style={{ pointerEvents:"none" }}>
                  {Math.round(w)}mm
                </text>
                <text x={px+pw+3} y={py+ph/2} dominantBaseline="middle" fontSize={7} fill={C.accent} style={{ pointerEvents:"none" }}>
                  {Math.round(h)}mm
                </text>
              </>
            )}
            {/* Rotation badge */}
            {piece.rotation !== 0 && (
              <text x={px+pw-2} y={py+3} textAnchor="end" dominantBaseline="hanging"
                fontSize={7} fill={darken(piece.color,80)} opacity={0.65} style={{ pointerEvents:"none" }}>
                {piece.rotation}°
              </text>
            )}
            {/* Hover/select action buttons */}
            {isSel && (
              <g>
                <circle cx={px+pw-10} cy={py+10} r={8} fill={C.accent} opacity={0.92}
                  onClick={(e)=>{ e.stopPropagation(); onRotate(piece.id); }} style={{ cursor:"pointer" }}/>
                <text x={px+pw-10} y={py+10} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill="#fff" style={{ pointerEvents:"none" }}>↻</text>
                <circle cx={px+10} cy={py+10} r={8} fill={C.danger} opacity={0.92}
                  onClick={(e)=>{ e.stopPropagation(); onReturn(piece.id); }} style={{ cursor:"pointer" }}/>
                <text x={px+10} y={py+10} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill="#fff" style={{ pointerEvents:"none" }}>×</text>
                {sheetCount > 1 && (
                  <>
                    <circle cx={px+pw-10} cy={py+ph-10} r={8} fill="#a78bfa" opacity={0.92}
                      onClick={(e)=>{ e.stopPropagation(); onMoveToSheet(piece.id,(sheetIndex+1)%sheetCount); }} style={{ cursor:"pointer" }}/>
                    <text x={px+pw-10} y={py+ph-10} textAnchor="middle" dominantBaseline="middle" fontSize={8} fill="#fff" style={{ pointerEvents:"none" }}>►</text>
                  </>
                )}
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type NestingV3LocationState = {
  openNestingV3?: boolean;
  pieces?: V3Piece[];
  projectId?: string;
  projectName?: string;
};

type CanvasViewMode = "single" | "overview";

export default function NestingV3Page({
  initialCutPieces = [],
  initialPieces,
  projectName = "Projeto",
  projectId,
  onClose,
  layout = "standalone",
}: NestingV3PageProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { project } = useProject();
  const locationState = (location.state ?? null) as NestingV3LocationState | null;
  const resolvedPieces = useMemo(() => {
    const fromPayload = initialPieces ?? locationState?.pieces ?? [];
    if (fromPayload.length > 0) return fromPayload;
    if (project.boxes?.length) return convertProjectToV3Pieces(project);
    return [];
  }, [initialPieces, locationState?.pieces, project]);
  const resolvedProjectId = projectId ?? locationState?.projectId;
  const resolvedProjectName = locationState?.projectName ?? projectName;
  const {
    state, dragState, setDragState,
    loadPieces,
    runAutoLayout, movePiece, returnToSidebar, rotatePiece,
    movePieceToSheet, addManualPiece, removePiece,
    addSheet, removeSheet, setActiveSheet, setKerfMm, updateSettings, updateSheet,
    clearAll, focusPiece,
  } = useNestingV3(initialCutPieces);

  const canvasRef     = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId]     = useState<string | null>(null);
  const [canvasView, setCanvasView]     = useState<CanvasViewMode>("single");
  const [zoom, setZoom]                 = useState(0.14);
  const [pan, setPan]                   = useState({ x: 20, y: 20 });
  const [isPanning, setIsPanning]       = useState(false);
  const panStartRef   = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const [ghostPos, setGhostPos]         = useState<{ x: number; y: number } | null>(null);
  const [generating, setGenerating]     = useState(false);
  const hasAutoLaidOutRef = useRef(false);

  useEffect(() => {
    if (resolvedPieces.length === 0) return;
    hasAutoLaidOutRef.current = false;
    loadPieces(resolvedPieces);
  }, [resolvedPieces, loadPieces]);

  const activeSheet = state.sheets[state.activeSheetIndex] ?? state.sheets[0];
  const stats       = getV3ExportStats(state);
  const selectedPiece = state.pieces.find((p) => p.id === selectedId) ?? null;
  const selectedPlacement = state.placements.find((p) => p.pieceId === selectedId);

  const utilization = useMemo(() =>
    calcSheetUtilization(state.activeSheetIndex, activeSheet, state.placements, state.pieces),
    [state, activeSheet]
  );

  useEffect(() => {
    if (hasAutoLaidOutRef.current) return;
    if (state.pieces.length === 0) return;
    hasAutoLaidOutRef.current = true;
    runAutoLayout();
    setSelectedId(state.pieces[0]?.id ?? null);
  }, [runAutoLayout, state.pieces]);

  // Zoom with wheel
  const handleWheel = useCallback((e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1.12 : 0.9;
    setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z * delta)));
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Escape")     { setSelectedId(null); setDragState(null); }
      if (e.key === "r" || e.key === "R") if (selectedId) rotatePiece(selectedId);
      if (e.key === "Delete" || e.key === "Backspace") if (selectedId) removePiece(selectedId);
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(ZOOM_MAX, z * 1.15));
      if (e.key === "-")          setZoom((z) => Math.max(ZOOM_MIN, z * 0.87));
      if (e.key === "0")          { setZoom(0.14); setPan({ x: 20, y: 20 }); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [selectedId, rotatePiece, removePiece, setDragState]);

  // ── Drag from sidebar ────────────────────────────────────────────────────

  const handleSidebarDragStart = useCallback((e: PointerEvent<HTMLDivElement>, id: string) => {
    setDragState({ pieceId: id, offsetX: 10, offsetY: 10, cursorX: e.clientX, cursorY: e.clientY, source: "sidebar" });
    setGhostPos({ x: e.clientX, y: e.clientY });
  }, [setDragState]);

  // ── Drag on sheet ────────────────────────────────────────────────────────

  const handlePiecePointerDown = useCallback((e: PointerEvent<SVGGElement>, id: string, pl: V3Placement) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const canvasX = (e.clientX - rect.left - pan.x) / zoom;
    const canvasY = (e.clientY - rect.top  - pan.y) / zoom;
    const xMm = canvasX / CANVAS_SCALE;
    const yMm = canvasY / CANVAS_SCALE;
    setDragState({
      pieceId: id,
      offsetX: (xMm - pl.xMm) * zoom * CANVAS_SCALE,
      offsetY: (yMm - pl.yMm) * zoom * CANVAS_SCALE,
      cursorX: e.clientX, cursorY: e.clientY,
      source: "sheet", sourcePlacement: pl,
    });
    setGhostPos({ x: e.clientX, y: e.clientY });
    setSelectedId(id);
  }, [pan, zoom, setDragState]);

  // ── Middle-button pan ────────────────────────────────────────────────────

  const handleCanvasPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button === 1 || e.altKey) {
      e.preventDefault();
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    }
  }, [pan]);

  // ── Global pointer move & up ─────────────────────────────────────────────

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (isPanning) {
      setPan({
        x: panStartRef.current.px + e.clientX - panStartRef.current.x,
        y: panStartRef.current.py + e.clientY - panStartRef.current.y,
      });
      return;
    }
    if (!dragState) return;
    setGhostPos({ x: e.clientX, y: e.clientY });
  }, [isPanning, dragState]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (isPanning) { setIsPanning(false); return; }
    if (!dragState) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) { setDragState(null); setGhostPos(null); return; }

    const rawX = (e.clientX - rect.left - pan.x) / zoom;
    const rawY = (e.clientY - rect.top  - pan.y) / zoom;

    const offXmm = dragState.source === "sidebar" ? 0 : dragState.offsetX / zoom / CANVAS_SCALE;
    const offYmm = dragState.source === "sidebar" ? 0 : dragState.offsetY / zoom / CANVAS_SCALE;
    const xMm = rawX / CANVAS_SCALE - offXmm;
    const yMm = rawY / CANVAS_SCALE - offYmm;

    const targetSheetIndex = dragState.source === "sheet"
      ? (dragState.sourcePlacement?.sheetIndex ?? state.activeSheetIndex)
      : state.activeSheetIndex;

    const placed = movePiece(dragState.pieceId, targetSheetIndex, xMm, yMm);
    if (placed) {
      setActiveSheet(targetSheetIndex);
      setSelectedId(dragState.pieceId);
    } else if (dragState.source === "sheet") {
      returnToSidebar(dragState.pieceId);
      setSelectedId(null);
    }

    setDragState(null);
    setGhostPos(null);
  }, [isPanning, dragState, pan, zoom, state, movePiece, returnToSidebar, setDragState, setActiveSheet]);

  // ── Generate all ─────────────────────────────────────────────────────────

  const handleDownloadOfficialLabels = useCallback(async () => {
    beginIndustrialFileGeneration();
    try {
      await downloadNestingV3OfficialLabels({
        state,
        project,
        projectName: resolvedProjectName,
      });
    } finally {
      endIndustrialFileGeneration();
    }
  }, [state, project, resolvedProjectName]);

  const handleGenerateAll = useCallback(async () => {
    setGenerating(true);
    beginIndustrialFileGeneration();
    try {
      await new Promise((r) => setTimeout(r, 20));
      await downloadNestingV3Pdf(state, resolvedProjectName);
      await new Promise((r) => setTimeout(r, 100));
      downloadNestingV3Tcn(state, resolvedProjectName);
      await new Promise((r) => setTimeout(r, 100));
      await downloadNestingV3OfficialLabels({
        state,
        project,
        projectName: resolvedProjectName,
      });
    } finally {
      endIndustrialFileGeneration();
      setGenerating(false);
    }
  }, [state, project, resolvedProjectName]);

  const handleDownloadPdf = useCallback(async () => {
    beginIndustrialFileGeneration();
    try {
      await downloadNestingV3Pdf(state, resolvedProjectName);
    } finally {
      endIndustrialFileGeneration();
    }
  }, [state, resolvedProjectName]);

  const handleDownloadTcn = useCallback(() => {
    beginIndustrialFileGeneration();
    try {
      downloadNestingV3Tcn(state, resolvedProjectName);
    } finally {
      endIndustrialFileGeneration();
    }
  }, [state, resolvedProjectName]);

  const ghostPiece = dragState ? state.pieces.find((p) => p.id === dragState.pieceId) : null;

  const leftPanel = (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", background: C.surface }}>
      <NestingV3SettingsPanel
        settings={state.settings}
        activeSheet={activeSheet}
        onUpdateSettings={updateSettings}
        onUpdateActiveSheet={(patch) => updateSheet(state.activeSheetIndex, patch)}
      />
      <PieceSidebar
        unplacedIds={state.unplacedPieceIds} pieces={state.pieces}
        sheets={state.sheets} placements={state.placements}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onDragStart={handleSidebarDragStart}
        onRemove={removePiece} onRotate={rotatePiece}
        onFocus={(id) => { focusPiece(id); setSelectedId(id); }}
        onSelectSheet={setActiveSheet}
      />
      <AddPieceForm onAdd={addManualPiece}/>
    </div>
  );

  const workspace = (
    <div
      style={{ width:"100%", height: layout === "station" ? "calc(100vh - 280px)" : "100%", display:"flex", flexDirection:"column", background:C.bg, color:C.text, fontFamily:font, overflow:"hidden", borderRadius: layout === "station" ? 8 : 0, border: layout === "station" ? `1px solid ${C.border}` : "none" }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div style={{ height:TOOLBAR_H, display:"flex", alignItems:"center", gap:6, padding:"0 12px", background:C.surface, borderBottom:`1px solid ${C.border}`, flexShrink:0, zIndex:10 }}>
        {(layout === "station" || onClose || resolvedProjectId) && (
          <button
            type="button"
            onClick={() => {
              if (resolvedProjectId) navigate(`/projects/viewer?ids=${encodeURIComponent(resolvedProjectId)}`);
              else if (layout === "station") navigate("/");
              else onClose?.();
            }}
            style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 9px", borderRadius:7, border:`1px solid ${C.border}`, background:"transparent", color:C.muted, cursor:"pointer", fontSize:11, fontFamily:font }}>
            <Icon name="chevronRight" size={12} color={C.muted}/>Voltar ao Projeto
          </button>
        )}
        <div style={{ width:1, height:18, background:C.border }}/>
        <span style={{ fontSize:13, fontWeight:700, color:C.text }}>Nesting V3</span>
        <span style={{ fontSize:10, padding:"2px 8px", borderRadius:999, background:"rgba(59,130,246,0.14)", color:C.accent, border:"1px solid rgba(59,130,246,0.3)" }}>{resolvedProjectName}</span>
        <div style={{ flex:1 }}/>

        {/* Kerf */}
        <label style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:C.muted, fontFamily:font }}>
          Kerf
          <input type="number" min={0} max={20} step={0.5} value={state.kerfMm}
            onChange={(e) => setKerfMm(+e.target.value)}
            className="input input-sm" style={{ width:48, textAlign:"center" }}/>
          <span style={{ fontSize:10 }}>mm</span>
        </label>

        <div style={{ width:1, height:18, background:C.border }}/>

        {/* Zoom */}
        <label style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:C.muted, fontFamily:font }}>
          Zoom
          <input type="range" min={5} max={400} step={5} value={Math.round(zoom*100)}
            onChange={(e) => setZoom(+e.target.value/100)}
            style={{ width:70, cursor:"pointer" }}/>
          <span style={{ fontSize:10, minWidth:34 }}>{Math.round(zoom*100)}%</span>
        </label>

        <div style={{ width:1, height:18, background:C.border }}/>

        <button type="button" onClick={() => setCanvasView((v) => v === "single" ? "overview" : "single")}
          style={toolBtn(canvasView === "overview" ? C.accent : C.muted)}>
          {canvasView === "overview" ? "Vista folha" : "Vista chão"}
        </button>

        <button type="button" onClick={runAutoLayout}
          style={{ ...toolBtn(C.accent), fontSize:11, display:"flex", alignItems:"center", gap:5 }}>
          <Icon name="grid" size={13}/> Auto Layout
        </button>
        <button type="button" onClick={clearAll} style={toolBtn(C.muted)}>Limpar</button>

        <div style={{ width:1, height:18, background:C.border }}/>

        {/* Export individual */}
        <button type="button" onClick={() => { void handleDownloadPdf(); }}
          style={toolBtn(C.muted)} title="Exportar Layout PRO (PDF industrial)">PDF</button>
        <button type="button" onClick={handleDownloadTcn}
          style={toolBtn(C.muted)} title="Exportar TCN">TCN</button>
        <button type="button" onClick={() => { void handleDownloadOfficialLabels(); }}
          style={toolBtn(C.muted)} title="Exportar etiquetas oficiais (UEE / LabelSystemV5)">Etiquetas</button>

        {/* Generate all */}
        <button type="button" onClick={handleGenerateAll} disabled={generating || stats.placedPieces === 0}
          style={{ ...toolBtn(C.accent), fontWeight:700, display:"flex", alignItems:"center", gap:6, opacity: generating || stats.placedPieces === 0 ? 0.5 : 1 }}>
          <Icon name="send" size={13}/>{generating ? "A gerar…" : "Gerar Tudo"}
        </button>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div style={{ flex:1, display:"flex", minHeight:0 }}>

        {layout === "standalone" && (
          <aside style={{ width:SIDEBAR_W, flexShrink:0, display:"flex", flexDirection:"column", background:C.surface, borderRight:`1px solid ${C.border}`, overflow:"hidden" }}>
            <NestingV3SettingsPanel
              settings={state.settings}
              activeSheet={activeSheet}
              onUpdateSettings={updateSettings}
              onUpdateActiveSheet={(patch) => updateSheet(state.activeSheetIndex, patch)}
            />
            <PieceSidebar
              unplacedIds={state.unplacedPieceIds} pieces={state.pieces}
              sheets={state.sheets} placements={state.placements}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onDragStart={handleSidebarDragStart}
              onRemove={removePiece} onRotate={rotatePiece}
              onFocus={(id) => { focusPiece(id); setSelectedId(id); }}
              onSelectSheet={setActiveSheet}
            />
            <AddPieceForm onAdd={addManualPiece}/>
          </aside>
        )}

        {/* Canvas area */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0 }}>

          {/* Sheet tabs */}
          <div style={{ height:SHEET_TABS_H, display:"flex", alignItems:"center", gap:3, padding:"0 10px", background:"rgba(0,0,0,0.14)", borderBottom:`1px solid ${C.border}`, flexShrink:0, overflowX:"auto" }}>
            {state.sheets.map((sheet, si) => {
              const util = calcSheetUtilization(si, sheet, state.placements, state.pieces);
              const active = si === state.activeSheetIndex;
              return (
                <button key={si} type="button" onClick={() => setActiveSheet(si)}
                  style={{ display:"flex", alignItems:"center", gap:5, padding:"3px 9px", borderRadius:6, border:`1px solid ${active ? C.accent : C.border}`, background: active ? "rgba(59,130,246,0.12)" : "transparent", color: active ? C.accent : C.muted, fontSize:10, fontWeight: active ? 600 : 400, cursor:"pointer", whiteSpace:"nowrap", fontFamily:font }}>
                  Folha {si+1}
                  <span style={{ fontSize:9, color: util>70 ? C.green : C.amber }}>{Math.round(util)}%</span>
                  {state.sheets.length > 1 && (
                    <span onClick={(e)=>{ e.stopPropagation(); removeSheet(si); }} style={{ fontSize:11, color:C.danger, cursor:"pointer", marginLeft:2 }}>×</span>
                  )}
                </button>
              );
            })}
            <button type="button" onClick={addSheet}
              style={{ padding:"3px 9px", borderRadius:6, border:`1px solid ${C.border}`, background:"transparent", color:C.muted, fontSize:10, cursor:"pointer", fontFamily:font }}>+ Folha</button>
          </div>

          {/* Scrollable canvas */}
          <div ref={canvasRef}
            style={{ flex:1, overflow:"hidden", position:"relative", background:C.surface2, cursor: isPanning ? "grabbing" : "default" }}
            onWheel={handleWheel}
            onPointerDown={handleCanvasPointerDown}
          >
            <div style={{ position:"absolute", transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`, transformOrigin:"0 0" }}>
              {canvasView === "overview" ? (
                <div style={{ display:"flex", flexWrap:"wrap", gap: 24, padding: 16 }}>
                  {state.sheets.map((sheet, si) => (
                    <div key={si} style={{ cursor: "pointer" }} onClick={() => { setActiveSheet(si); setCanvasView("single"); }}>
                      <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, fontFamily: font }}>
                        Folha {si + 1} — {sheet.widthMm}×{sheet.heightMm} mm
                      </div>
                      <SheetCanvas
                        sheet={sheet} sheetIndex={si}
                        pieces={state.pieces} placements={state.placements}
                        kerfMm={state.kerfMm} marginMm={state.settings.marginMm}
                        scale={CANVAS_SCALE * 0.35}
                        selectedId={selectedId} onSelect={setSelectedId}
                        onPiecePointerDown={handlePiecePointerDown}
                        onRotate={rotatePiece} onReturn={returnToSidebar}
                        onMoveToSheet={movePieceToSheet} sheetCount={state.sheets.length}
                      />
                    </div>
                  ))}
                </div>
              ) : activeSheet ? (
                <SheetCanvas
                  sheet={activeSheet} sheetIndex={state.activeSheetIndex}
                  pieces={state.pieces} placements={state.placements}
                  kerfMm={state.kerfMm} marginMm={state.settings.marginMm}
                  scale={CANVAS_SCALE}
                  selectedId={selectedId} onSelect={setSelectedId}
                  onPiecePointerDown={handlePiecePointerDown}
                  onRotate={rotatePiece} onReturn={returnToSidebar}
                  onMoveToSheet={movePieceToSheet} sheetCount={state.sheets.length}
                />
              ) : null}
            </div>

            {/* Zoom/pan hint */}
            <div style={{ position:"absolute", bottom:8, left:8, fontSize:9, color:C.muted, background:"rgba(0,0,0,0.4)", borderRadius:4, padding:"2px 7px", pointerEvents:"none", fontFamily:font }}>
              Scroll=zoom · Alt+drag=pan · R=rodar · 0=reset · Del=remover
            </div>
          </div>

          {/* Status bar */}
          <div style={{ height:STATUS_H, padding:"0 12px", background:"rgba(0,0,0,0.1)", borderTop:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:20, fontSize:10, color:C.muted, flexShrink:0, fontFamily:font }}>
            {activeSheet && (
              <>
                <span>Folha {state.activeSheetIndex+1}: {activeSheet.widthMm}×{activeSheet.heightMm}×{activeSheet.thicknessMm}mm</span>
                <span style={{ color: utilization>70 ? C.green : C.amber }}>Util: {Math.round(utilization)}%</span>
                <span>{state.placements.filter((p)=>p.sheetIndex===state.activeSheetIndex).length} peças</span>
                <span>Zoom: {Math.round(zoom*100)}%</span>
                <span style={{ marginLeft:"auto" }}>
                  {stats.placedPieces}/{stats.totalPieces} peças · {stats.sheetsUsed} folha(s) usada(s)
                </span>
              </>
            )}
          </div>
        </div>

        {/* Properties panel — only when piece selected */}
        {selectedPiece && (
          <aside style={{ width:PROPS_W, flexShrink:0, background:C.surface, borderLeft:`1px solid ${C.border}`, overflow:"hidden", display:"flex", flexDirection:"column" }}>
            <div style={{ padding:"10px 12px 0", fontSize:9, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:C.muted, fontFamily:font }}>
              Propriedades
            </div>
            <PropertiesPanel
              piece={selectedPiece}
              placement={selectedPlacement}
              onRotate={() => rotatePiece(selectedPiece.id)}
              onReturn={() => { returnToSidebar(selectedPiece.id); setSelectedId(null); }}
              onMoveSheet={(si) => movePieceToSheet(selectedPiece.id, si)}
              sheetCount={state.sheets.length}
            />
          </aside>
        )}
      </div>

      {/* Drag ghost */}
      {dragState && ghostPos && ghostPiece && (() => {
        const { w, h } = effectiveDims(ghostPiece);
        return (
          <div style={{
            position:"fixed", left:ghostPos.x - dragState.offsetX, top:ghostPos.y - dragState.offsetY,
            width: w * zoom * CANVAS_SCALE, height: h * zoom * CANVAS_SCALE,
            background: ghostPiece.color, border:`2px solid ${C.accent}`,
            borderRadius:4, opacity:0.65, pointerEvents:"none", zIndex:9999,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:10, color:darken(ghostPiece.color, 80), fontFamily:font,
          }}>
            {ghostPiece.name}
          </div>
        );
      })()}
    </div>
  );

  if (layout === "station") {
    return (
      <IndustrialThreeColumnLayout
        title="Layout de Corte MANUAL"
        description={`Nesting V3 — ${resolvedProjectName}`}
        sidebarOpen={false}
        leftLeft={<NestingV3StationSidebar />}
        left={leftPanel}
        right={workspace}
      />
    );
  }

  return workspace;
}

function toolBtn(c: string): React.CSSProperties {
  return {
    padding:"5px 10px", borderRadius:7, border:`1px solid ${c}44`,
    background:`${c}14`, color:c, fontSize:11, cursor:"pointer", fontFamily:font,
  };
}
