import { useEffect, useRef } from "react";
import { Viewer } from "../3d/core/Viewer";
import type { ViewerOptions } from "../3d/core/Viewer";

type ThreeViewerProps = {
  height?: number | string;
  backgroundColor?: string;
  viewerOptions?: Omit<ViewerOptions, "background">;
};

export default function ThreeViewer({
  height = 300,
  backgroundColor = "#0f172a",
  viewerOptions,
}: ThreeViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Viewer | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    viewerRef.current = new Viewer(container, {
      background: backgroundColor,
      ...viewerOptions,
    });

    return () => {
      viewerRef.current?.dispose();
      viewerRef.current = null;
    };
  }, [backgroundColor, viewerOptions]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: typeof height === "number" ? `${height}px` : height,
        background: backgroundColor,
        borderRadius: "var(--radius)",
        overflow: "hidden",
      }}
    />
  );
}
