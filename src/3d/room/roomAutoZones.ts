/**
 * pimo-room v4 — auto-zona por loops fechados de paredes.
 *
 * Detecta ciclos mínimos no grafo de eixos de parede e gera
 * `ProjectRoomZone` (opt-in). Não altera salas sem activação explícita.
 *
 * Atribuição (MIT): ideia de faces/loops a partir de paredes adaptada de
 * Pascal Group Inc. / Aedifex Inc. (zone from wall network) — só lógica.
 */

import type { ProjectRoomConfig, ProjectRoomZone, ProjectRoomZonePoint } from "../viewer-engine/room/roomEngineTypes";
import { projectRoomToPimoRoomGraph } from "./pimoRoomSchema";
import { polygonAreaMm2, createMainZoneFromRoom } from "./roomZones";

type Pt = { x: number; z: number };

const DEFAULT_TOL_M = 0.12;

function keyOf(p: Pt, snap: number): string {
  return `${Math.round(p.x * snap)},${Math.round(p.z * snap)}`;
}

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function snapPoint(p: Pt, nodes: Map<string, Pt>, snap: number, tol: number): string {
  for (const [k, q] of nodes) {
    if (dist(p, q) <= tol) return k;
  }
  const k = keyOf(p, snap);
  nodes.set(k, { x: p.x, z: p.z });
  return k;
}

type DirEdge = {
  id: string;
  from: string;
  to: string;
  angle: number;
};

/**
 * Extrai loops fechados (faces) a partir de segmentos de parede (metros).
 * Usa caminhada por meia-aresta (viragem mais à esquerda em cada vértice).
 */
export function detectClosedWallLoopsMeters(
  segments: Array<{ start: Pt; end: Pt }>,
  toleranceM = DEFAULT_TOL_M
): Pt[][] {
  if (segments.length < 3) return [];
  const snap = 1 / Math.max(0.01, toleranceM);
  const nodes = new Map<string, Pt>();
  const undirected = new Map<string, { a: string; b: string }>();

  for (const seg of segments) {
    if (dist(seg.start, seg.end) < 1e-4) continue;
    const a = snapPoint(seg.start, nodes, snap, toleranceM);
    const b = snapPoint(seg.end, nodes, snap, toleranceM);
    if (a === b) continue;
    const uid = a < b ? `${a}|${b}` : `${b}|${a}`;
    undirected.set(uid, { a, b });
  }

  const directed: DirEdge[] = [];
  for (const [uid, { a, b }] of undirected) {
    const pa = nodes.get(a)!;
    const pb = nodes.get(b)!;
    directed.push({
      id: `${uid}>`,
      from: a,
      to: b,
      angle: Math.atan2(pb.z - pa.z, pb.x - pa.x),
    });
    directed.push({
      id: `${uid}<`,
      from: b,
      to: a,
      angle: Math.atan2(pa.z - pb.z, pa.x - pb.x),
    });
  }

  const outByNode = new Map<string, DirEdge[]>();
  for (const e of directed) {
    const list = outByNode.get(e.from) ?? [];
    list.push(e);
    outByNode.set(e.from, list);
  }
  for (const list of outByNode.values()) {
    list.sort((u, v) => u.angle - v.angle);
  }

  const twinOf = (e: DirEdge): DirEdge | null => {
    const list = outByNode.get(e.to) ?? [];
    return list.find((x) => x.to === e.from) ?? null;
  };

  /** Próxima aresta: viragem mais à esquerda no destino (CCW). */
  const nextLeft = (e: DirEdge): DirEdge | null => {
    const outs = outByNode.get(e.to);
    if (!outs?.length) return null;
    // Índice da gémea (voltar atrás), depois escolhe a anterior na ordem angular (= esquerda).
    const twinIdx = outs.findIndex((x) => x.to === e.from);
    if (twinIdx < 0) return outs[0];
    const leftIdx = (twinIdx - 1 + outs.length) % outs.length;
    return outs[leftIdx];
  };

  const used = new Set<string>();
  const loops: Pt[][] = [];

  for (const start of directed) {
    if (used.has(start.id)) continue;
    const path: DirEdge[] = [];
    let cur: DirEdge | null = start;
    const guard = directed.length + 2;
    for (let i = 0; i < guard && cur; i++) {
      if (used.has(cur.id)) break;
      path.push(cur);
      used.add(cur.id);
      const nxt = nextLeft(cur);
      if (!nxt) break;
      if (nxt.id === start.id) {
        // Fechou
        if (path.length >= 3) {
          const pts = path.map((e) => nodes.get(e.from)!);
          // Área positiva (não colinear)
          let area = 0;
          for (let k = 0; k < pts.length; k++) {
            const a = pts[k];
            const b = pts[(k + 1) % pts.length];
            area += a.x * b.z - b.x * a.z;
          }
          if (Math.abs(area) > 1e-4) {
            // Normaliza orientação CCW
            if (area < 0) pts.reverse();
            loops.push(pts);
          }
        }
        break;
      }
      cur = nxt;
      if (path.some((p) => p.id === cur!.id)) break;
    }
    // Marca gémea da face exterior se não fechou utilmente — evita reuso parcial
    void twinOf;
  }

  // Remove o loop exterior (maior área) se houver ≥2 faces — tipicamente a face infinita
  // no grafo planar embutido; para salas fechadas com um único ciclo, mantém-se.
  if (loops.length >= 2) {
    const withArea = loops.map((poly) => {
      let a = 0;
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i];
        const q = poly[(i + 1) % poly.length];
        a += p.x * q.z - q.x * p.z;
      }
      return { poly, area: Math.abs(a) / 2 };
    });
    withArea.sort((u, v) => v.area - u.area);
    // Descarta o maior (envelope exterior) e devolve interiores
    return withArea.slice(1).map((x) => x.poly);
  }

  return loops;
}

function segmentsFromRoom(room: ProjectRoomConfig): Array<{ start: Pt; end: Pt }> {
  const graph = projectRoomToPimoRoomGraph(room);
  return graph.walls.map((w) => ({
    start: { x: w.start[0], z: w.start[1] },
    end: { x: w.end[0], z: w.end[1] },
  }));
}

/** Converte loops (m) → zonas ProjectRoom (mm). */
export function loopsToZones(
  loopsM: Pt[][],
  room: Pick<ProjectRoomConfig, "heightMm">,
  existingNames?: string[]
): ProjectRoomZone[] {
  return loopsM.map((loop, i) => {
    const polygonMm: ProjectRoomZonePoint[] = loop.map((p) => ({
      x: Math.round(p.x * 1000),
      z: Math.round(p.z * 1000),
    }));
    const area = polygonAreaMm2(polygonMm);
    return {
      id: `zone-auto-${i + 1}`,
      name: existingNames?.[i] ?? (loopsM.length === 1 ? "Sala" : `Zona ${i + 1}`),
      polygonMm,
      ceilingHeightMm: room.heightMm,
      spaceRole: area > 1e6 ? "room" : "generic", // > 1 m²
    };
  });
}

/**
 * Detecta zonas por loops fechados. Se não encontrar ciclo, fallback à zona rectangular.
 * Opt-in: o caller decide quando escrever `room.zones`.
 */
export function autoZonesFromClosedLoops(room: ProjectRoomConfig): ProjectRoomZone[] {
  const segments = segmentsFromRoom(room);
  const tol = Math.max(DEFAULT_TOL_M, (room.wallThicknessMm / 1000) * 1.5);
  const loops = detectClosedWallLoopsMeters(segments, tol);
  if (loops.length === 0) {
    return [createMainZoneFromRoom(room)];
  }
  return loopsToZones(loops, room);
}
