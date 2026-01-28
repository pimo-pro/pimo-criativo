import { useEffect, useRef } from "react";
import { useProject } from "../../../context/useProject";
import { usePimoViewer } from "../../../hooks/usePimoViewer";
import { useCalculadoraSync } from "../../../hooks/useCalculadoraSync";
import { usePimoViewerContext } from "../../../hooks/usePimoViewerContext";
import type { ViewerOptions } from "../../../3d/core/Viewer";

type WorkspaceProps = {
  viewerBackground?: string;
  viewerHeight?: number | string;
  viewerOptions?: Omit<ViewerOptions, "background">;
};

export default function Workspace({
  viewerBackground,
  viewerHeight = "100%",
  viewerOptions,
}: WorkspaceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { project, actions } = useProject();
  const viewerApi = usePimoViewer(containerRef, {
    background: viewerBackground,
    ...viewerOptions,
  });
  const { registerViewerApi } = usePimoViewerContext();

  useEffect(() => {
    registerViewerApi(viewerApi);
    return () => registerViewerApi(null);
  }, [registerViewerApi, viewerApi]);

  useEffect(() => {
    viewerApi.setOnBoxSelected((boxId) => {
      if (boxId) {
        actions.selectBox(boxId);
      }
    });
  }, [actions, viewerApi]);

  useCalculadoraSync(project.boxes, viewerApi, undefined, project.material.tipo);

  useEffect(() => {
    if (project.selectedWorkspaceBoxId) {
      viewerApi.selectBox?.(project.selectedWorkspaceBoxId);
    }
  }, [project.selectedWorkspaceBoxId, viewerApi]);

  return (
    <main className="workspace-root">
      <div className="workspace-canvas">
        <div className="workspace-viewer">
          <div
            ref={containerRef}
            style={{
              width: "100%",
              height: typeof viewerHeight === "number" ? `${viewerHeight}px` : viewerHeight,
            }}
          />
        </div>
      </div>
      <a
        href="/test-viewer"
        style={{
          position: "fixed",
          right: 16,
          bottom: 16,
          zIndex: 5,
          background: "rgba(15, 23, 42, 0.85)",
          border: "1px solid rgba(148, 163, 184, 0.35)",
          color: "#e2e8f0",
          padding: "8px 12px",
          borderRadius: 8,
          fontSize: 12,
          textDecoration: "none",
        }}
      >
        Abrir test-viewer
      </a>
    </main>
  );
}
