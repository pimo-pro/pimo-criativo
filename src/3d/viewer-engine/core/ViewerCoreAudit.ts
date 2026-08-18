/**
 * Auditoria interna — pontos fracos e dívidas do ViewerCore (pimo.pro stability pass).
 * Referência para evolução futura; não altera runtime.
 */

export type ViewerCoreAuditItem = {
  id: string;
  severity: "low" | "medium" | "high";
  area: string;
  finding: string;
  recommendation: string;
  touchedInPass: boolean;
};

export const VIEWER_CORE_AUDIT: ViewerCoreAuditItem[] = [
  {
    id: "monolith-size",
    severity: "medium",
    area: "ViewerCore.ts (~4500 linhas)",
    finding: "Orquestrador concentra sala, boxes, snapping, overlays e export.",
    recommendation: "Extrair subsistemas já modularizados (runtime, overlays, cache) sem mover API pública.",
    touchedInPass: true,
  },
  {
    id: "window-viewerCore-dual-api",
    severity: "medium",
    area: "window.viewerCore + PimoViewerContext",
    finding: "Dois caminhos de acesso à API do viewer.",
    recommendation: "Alinhar viewerCoreWindow.d.ts; migrar bridges para hook único.",
    touchedInPass: false,
  },
  {
    id: "transform-notify-per-frame",
    severity: "low",
    area: "objectChange → notifyBoxTransform",
    finding: "Sync live com ProjectContext em cada frame de drag.",
    recommendation: "Manter até profiling provar gargalo; batch no contexto seria alteração de produto.",
    touchedInPass: false,
  },
  {
    id: "dual-wall-snap",
    severity: "low",
    area: "SnapEngine (SmartAlign + TransformConstraints/ModelWallSnap)",
    finding: "Orquestrador único: caixa = SmartAlign depois TransformConstraints; SmartSnapping só overlay.",
    recommendation: "Manter ordem Z-01.2.3; não chamar SmartSnapping.applyDuringTranslate no clamp.",
    touchedInPass: true,
  },
  {
    id: "triple-auto-fill",
    severity: "low",
    area: "LayoutEngine (Kitchen 3.0 + autoLayout/smartLayout 3D)",
    finding: "Orquestrador único: projecto = Kitchen 3.0; Viewer 3D = adapters autoLayout/smartLayout.",
    recommendation: "Manter canais separados; não fundir planos 3D com generateKitchenLayoutPlan.",
    touchedInPass: true,
  },
  {
    id: "project-format-loader",
    severity: "low",
    area: "ProjectLoader + ProjectFormatAdapter",
    finding: "Formatos externos orquestrados em core/viewer/formats; GLB usa loadGLB; PIMO identidade.",
    recommendation: "Não aplicar NormalizedProject à cena sem ProjectState; DXF/IFC/STEP só em Z-01.3+.",
    touchedInPass: true,
  },
  {
    id: "overlay-zindex",
    severity: "low",
    area: "Measurement / InternalRuler / SmartSnapping overlays",
    finding: "z-index canvas 14–17 definidos em cada módulo.",
    recommendation: "ViewerOverlayCoordinator centraliza refresh; z-index unificado em fase UI.",
    touchedInPass: true,
  },
  {
    id: "event-order",
    severity: "low",
    area: "clampTransform pipeline",
    finding: "Ordem: translate → SnapEngine (SmartAlign → TransformConstraints/ModelWallSnap) → overlays no frame seguinte.",
    recommendation: "Documentado; finishTransformDrag garante ordem no fim de drag.",
    touchedInPass: true,
  },
  {
    id: "dispose-room-builder",
    severity: "low",
    area: "dispose() — roomBuilder group",
    finding: "clearRoom() no dispose; geometrias dependem de removeRoom do RoomManager.",
    recommendation: "Verificar dispose explícito de materiais em remount HMR.",
    touchedInPass: true,
  },
];

export function getViewerCoreAuditHighlights(): ViewerCoreAuditItem[] {
  return VIEWER_CORE_AUDIT.filter((i) => i.severity === "high" || i.touchedInPass);
}
