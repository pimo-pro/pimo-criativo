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
    area: "ViewerCore.ts (fachada Z-01.2.7; motores A→E extraídos)",
    finding: "A API pública permanece no ViewerCore; cena, luz, composer, câmara, selecção, sala, caixa e finish sync delegam para motores.",
    recommendation: "Z-01.2.9 lazy-init de motores pesados; constructor não instancia designer/cost/composer/lighting. Não mover malha nem BoxBuilder.",
    touchedInPass: true,
  },
  {
    id: "window-viewerCore-dual-api",
    severity: "medium",
    area: "PimoViewerApi (window.viewerCore só ponte)",
    finding: "Consumidores de produto usam PimoViewerApi / getActiveViewerCore(); o global é ponte HMR.",
    recommendation: "Ponte mantida após Z-01.2.7; não reintroduzir chamadas de produto a window.viewerCore.",
    touchedInPass: true,
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
