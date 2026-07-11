/**
 * Auditoria visual de highlight — validação em runtime (browser / DEV).
 * Usar com projecto Antunes carregado: window.__PIMO_HIGHLIGHT_AUDIT__?.()
 */

import * as THREE from "three";
import {
  HOLE_HIGHLIGHT_OVERLAY_FLAG,
  PAIRING_OVERLAY_FLAG,
  PANEL_EDGE_OVERLAY_FLAG,
} from "./viewerHighlightConstants";
import { auditMeshHighlightOverlays } from "./viewerHighlightGuard";
import { isKnownPieceMesh } from "./viewerHighlightPolicy";
import type { ViewerHighlightInvariantViolation } from "./viewerHighlightInvariant";

export type HighlightVisualAuditEntry = {
  boxId: string;
  meshId: string;
  meshName: string;
  pieceKind: string;
  meshVisible: boolean;
  contourOverlays: number;
  holeOverlays: number;
  pairingGroups: number;
  violations: ViewerHighlightInvariantViolation[];
};

export type HighlightVisualAuditReport = {
  timestamp: string;
  projectHint?: string;
  totalMeshes: number;
  knownPieces: number;
  totalViolations: number;
  passed: boolean;
  entries: HighlightVisualAuditEntry[];
  summary: string[];
};

function classifyPieceKind(mesh: THREE.Mesh): string {
  const ud = mesh.userData ?? {};
  if (ud.divSepKind === "sep") return "sep";
  if (ud.divSepKind === "div") return "div";
  if (mesh.name === "frente-fixa") return "frente-fixa";
  if (ud.doorLayerId != null || mesh.name?.startsWith("door-leaf-")) return "door";
  if (ud.drawerPart === "front") return "drawer-front";
  if (ud.shelfIndex != null || mesh.name?.startsWith("shelf-")) return "shelf";
  if (ud.drawerPart != null || mesh.name?.startsWith("drawer-")) return "drawer";
  if (ud.isRematePiece) return "remate";
  if (ud.panelType != null) return `structural:${String(ud.panelType)}`;
  return "unknown";
}

function countHoleOverlays(mesh: THREE.Mesh): number {
  return mesh.children.filter((c) => c.userData?.[HOLE_HIGHLIGHT_OVERLAY_FLAG] === true).length;
}

function countContourOverlays(mesh: THREE.Mesh): number {
  return mesh.children.filter((c) => c.userData?.[PANEL_EDGE_OVERLAY_FLAG] === true).length;
}

function countPairingInSubtree(root: THREE.Object3D): number {
  let n = 0;
  root.traverse((node) => {
    if (node.userData?.[PAIRING_OVERLAY_FLAG] === true) n += 1;
  });
  return n;
}

/** Audita highlight visual numa árvore de caixa (mesh root). */
export function auditBoxHighlightVisuals(
  boxId: string,
  boxMesh: THREE.Object3D
): HighlightVisualAuditEntry[] {
  const entries: HighlightVisualAuditEntry[] = [];

  boxMesh.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    if (!isKnownPieceMesh(node)) return;

    const holeOverlays = countHoleOverlays(node);
    const violations = auditMeshHighlightOverlays(node, holeOverlays);

    if (!node.visible) {
      const visibleOverlays = node.children.filter(
        (c) =>
          (c.userData?.[PANEL_EDGE_OVERLAY_FLAG] === true ||
            c.userData?.[HOLE_HIGHLIGHT_OVERLAY_FLAG] === true) &&
          c.visible
      );
      if (visibleOverlays.length > 0) {
        violations.push({
          code: "HIGHLIGHT_ORPHAN_OVERLAY",
          meshId: String(node.userData?.pieceId ?? node.name),
          detail: `peça oculta com ${visibleOverlays.length} overlay(s) visível(eis)`,
        });
      }
    }

    entries.push({
      boxId,
      meshId: String(node.userData?.pieceId ?? node.userData?.panelId ?? node.name ?? node.uuid),
      meshName: node.name,
      pieceKind: classifyPieceKind(node),
      meshVisible: node.visible,
      contourOverlays: countContourOverlays(node),
      holeOverlays,
      pairingGroups: countPairingInSubtree(node),
      violations,
    });
  });

  return entries;
}

export type AuditAllBoxesInput = {
  boxes: Map<string, { mesh: THREE.Object3D }>;
  projectName?: string;
};

export function auditAllBoxesHighlightVisuals(input: AuditAllBoxesInput): HighlightVisualAuditReport {
  const entries: HighlightVisualAuditEntry[] = [];
  input.boxes.forEach((entry, boxId) => {
    entries.push(...auditBoxHighlightVisuals(boxId, entry.mesh));
  });

  const totalViolations = entries.reduce((n, e) => n + e.violations.length, 0);
  const knownPieces = entries.length;

  const summary: string[] = [];
  const sepEntries = entries.filter((e) => e.pieceKind === "sep");
  const divEntries = entries.filter((e) => e.pieceKind === "div");
  const doorEntries = entries.filter((e) => e.pieceKind === "door");
  const shelfEntries = entries.filter((e) => e.pieceKind === "shelf");
  const frenteEntries = entries.filter((e) => e.pieceKind === "frente-fixa");

  summary.push(`SEP: ${sepEntries.length} peça(s), ${sepEntries.reduce((n, e) => n + e.holeOverlays, 0)} overlay(s) de furo`);
  summary.push(`DIV: ${divEntries.length} peça(s), ${divEntries.reduce((n, e) => n + e.holeOverlays, 0)} overlay(s) de furo (esperado 0)`);
  summary.push(`Portas: ${doorEntries.length}, Prateleiras: ${shelfEntries.length}, Frente fixa: ${frenteEntries.length}`);
  summary.push(
    `Pairing: ${entries.reduce((n, e) => n + e.pairingGroups, 0)} grupo(s) na árvore das peças`
  );
  summary.push(`Violações: ${totalViolations}`);

  return {
    timestamp: new Date().toISOString(),
    projectHint: input.projectName,
    totalMeshes: entries.length,
    knownPieces,
    totalViolations,
    passed: totalViolations === 0,
    entries,
    summary,
  };
}

export function formatHighlightVisualAuditReport(report: HighlightVisualAuditReport): string {
  const lines = [
    "=== PIMO Highlight Visual Audit ===",
    `Projecto: ${report.projectHint ?? "(não indicado)"}`,
    `Data: ${report.timestamp}`,
    `Peças reconhecidas: ${report.knownPieces}`,
    `Resultado: ${report.passed ? "PASS ✅" : "FAIL ❌"} (${report.totalViolations} violações)`,
    "",
    "Resumo:",
    ...report.summary.map((s) => `  • ${s}`),
  ];

  const failed = report.entries.filter((e) => e.violations.length > 0);
  if (failed.length > 0) {
    lines.push("", "Violações por peça:");
    for (const entry of failed) {
      lines.push(`  [${entry.boxId}] ${entry.meshId} (${entry.pieceKind}):`);
      for (const v of entry.violations) {
        lines.push(`    - ${v.code}: ${v.detail}`);
      }
    }
  }

  return lines.join("\n");
}

declare global {
  interface Window {
    __PIMO_HIGHLIGHT_AUDIT__?: (projectName?: string) => HighlightVisualAuditReport;
  }
}

/** Regista auditoria global (DEV) — requer window.viewerCore com boxes. */
export function registerHighlightVisualAuditOnWindow(): void {
  if (typeof window === "undefined") return;

  window.__PIMO_HIGHLIGHT_AUDIT__ = (projectName?: string) => {
    const core = (
      window as Window & {
        viewerCore?: {
          auditHighlightVisuals?: (name?: string) => HighlightVisualAuditReport;
        };
      }
    ).viewerCore;

    if (!core?.auditHighlightVisuals) {
      throw new Error("viewerCore não está pronto — abra um projecto e aguarde o viewer.");
    }
    const report = core.auditHighlightVisuals(projectName);
    console.log(formatHighlightVisualAuditReport(report));
    return report;
  };
}
