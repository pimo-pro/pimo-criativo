import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { PimoViewerApi } from "../context/PimoViewerContextCore";
import type { ViewerBackgroundMode, ViewerRenderBackground, ViewerRenderMode } from "../context/projectTypes";
import type { Viewer } from "../3d/core/Viewer";
import {
  applyLightPreview,
  applyProjectTransparentChrome,
  captureChromeBaseline,
  captureLightBaseline,
  getViewerFromWindow,
  mapPhotoBackgroundToViewerMode,
  restoreChromeBaseline,
  restoreLightBaseline,
  type PhotoModeChromeBaseline,
  type PhotoModeLightBaseline,
} from "../core/viewer/photoModeViewerBridge";
import { createCabinetSilhouetteLines, disposeSilhouetteObject } from "../core/viewer/photoModeSilhouette";

export type PhotoModeLivePreviewParams = {
  active: boolean;
  viewerApi: PimoViewerApi | null;
  background: ViewerRenderBackground;
  shadowIntensity: number;
  advancedRealism: boolean;
  ultraEnabled?: boolean;
  mode: ViewerRenderMode;
};

type SessionBaseline = {
  light: PhotoModeLightBaseline;
  chrome: PhotoModeChromeBaseline;
  backgroundMode: ViewerBackgroundMode;
  viewerMode: "performance" | "showcase";
};

type SilhouetteSession = {
  visibility: Array<{ mesh: THREE.Object3D; visible: boolean }>;
  group: THREE.Group;
};

function getScene(viewer: Viewer): THREE.Scene | null {
  const sm = viewer as unknown as { sceneManager?: { scene: THREE.Scene } };
  return sm.sceneManager?.scene ?? null;
}

function clearSilhouetteSession(session: SilhouetteSession): void {
  session.visibility.forEach(({ mesh, visible }) => {
    mesh.visible = visible;
  });
  session.group.children.slice().forEach((ch) => {
    session.group.remove(ch);
    disposeSilhouetteObject(ch);
  });
  session.group.removeFromParent();
}

export function usePhotoModeLivePreview(params: PhotoModeLivePreviewParams): void {
  const { active, viewerApi, background, shadowIntensity, advancedRealism, ultraEnabled = false, mode } = params;
  const sessionRef = useRef<SessionBaseline | null>(null);
  const sceneMediaRef = useRef<{ environment: THREE.Texture | null; background: THREE.Color | THREE.Texture | null } | null>(
    null
  );
  const silhouetteSessionRef = useRef<SilhouetteSession | null>(null);

  useEffect(() => {
    const viewer = getViewerFromWindow();

    const fullRestoreAndClear = () => {
      const scene = viewer ? getScene(viewer) : null;
      if (silhouetteSessionRef.current) {
        clearSilhouetteSession(silhouetteSessionRef.current);
        silhouetteSessionRef.current = null;
      }

      if (scene && sceneMediaRef.current) {
        scene.environment = sceneMediaRef.current.environment;
        scene.background = sceneMediaRef.current.background;
        sceneMediaRef.current = null;
      }

      if (viewer && sessionRef.current) {
        viewerApi?.setUltraPerformanceMode?.(false);
        restoreLightBaseline(viewer, sessionRef.current.light);
        restoreChromeBaseline(viewer, sessionRef.current.chrome);
        viewerApi?.setBackgroundMode?.(sessionRef.current.backgroundMode);
        viewerApi?.setMode?.(sessionRef.current.viewerMode, false);
        sessionRef.current = null;
      }
    };

    if (!active || !viewerApi?.viewerReady) {
      fullRestoreAndClear();
      return;
    }

    if (!viewer) return;

    if (!sessionRef.current) {
      const light = captureLightBaseline(viewer);
      const chrome = captureChromeBaseline(viewer);
      if (!light || !chrome) return;
      sessionRef.current = {
        light,
        chrome,
        backgroundMode: viewerApi.getBackgroundMode?.() ?? "studio",
        viewerMode: viewerApi.getCurrentMode?.() ?? "performance",
      };
    }

    const session = sessionRef.current;

    const applyPreview = () => {
      restoreChromeBaseline(viewer, session.chrome);
      viewerApi.setBackgroundMode?.(mapPhotoBackgroundToViewerMode(background));
      viewerApi.setMode?.(advancedRealism || ultraEnabled ? "showcase" : "performance", false);

      if (ultraEnabled) {
        viewerApi.setUltraPerformanceMode?.(true);
      } else {
        viewerApi.setUltraPerformanceMode?.(false);
        restoreLightBaseline(viewer, session.light);
        applyLightPreview(viewer, session.light, shadowIntensity, advancedRealism);
      }

      if (background === "project-transparent") {
        applyProjectTransparentChrome(viewer, session.chrome);
      }

      const scene = getScene(viewer);
      if (!scene) return;

      if (mode === "lines") {
        if (!sceneMediaRef.current) {
          sceneMediaRef.current = {
            environment: scene.environment,
            background: scene.background,
          };
        }
        scene.environment = null;
        scene.background = new THREE.Color(0xffffff);

        if (!silhouetteSessionRef.current) {
          const group = new THREE.Group();
          group.name = "photoModeSilhouettePreview";
          const visibility: Array<{ mesh: THREE.Object3D; visible: boolean }> = [];
          viewer.boxes.forEach((entry) => {
            visibility.push({ mesh: entry.mesh, visible: entry.mesh.visible });
            const sil = createCabinetSilhouetteLines(entry.mesh);
            entry.mesh.visible = false;
            if (sil) group.add(sil);
          });
          scene.add(group);
          silhouetteSessionRef.current = { visibility, group };
        } else {
          const { group } = silhouetteSessionRef.current;
          group.children.slice().forEach((ch) => {
            group.remove(ch);
            disposeSilhouetteObject(ch);
          });
          viewer.boxes.forEach((entry) => {
            const sil = createCabinetSilhouetteLines(entry.mesh);
            if (sil) group.add(sil);
          });
          if (group.parent !== scene) scene.add(group);
        }
      } else {
        if (silhouetteSessionRef.current) {
          clearSilhouetteSession(silhouetteSessionRef.current);
          silhouetteSessionRef.current = null;
        }
        if (sceneMediaRef.current) {
          scene.environment = sceneMediaRef.current.environment;
          scene.background = sceneMediaRef.current.background;
          sceneMediaRef.current = null;
        }
      }
    };

    applyPreview();

    return () => {
      viewerApi.setUltraPerformanceMode?.(false);
      restoreLightBaseline(viewer, session.light);
      restoreChromeBaseline(viewer, session.chrome);
      const scene = getScene(viewer);
      if (silhouetteSessionRef.current) {
        clearSilhouetteSession(silhouetteSessionRef.current);
        silhouetteSessionRef.current = null;
      }
      if (scene && sceneMediaRef.current) {
        scene.environment = sceneMediaRef.current.environment;
        scene.background = sceneMediaRef.current.background;
      }
      sceneMediaRef.current = null;
      viewerApi.setBackgroundMode?.(session.backgroundMode);
      viewerApi.setMode?.(session.viewerMode, false);
    };
  }, [active, viewerApi, background, shadowIntensity, advancedRealism, ultraEnabled, mode]);
}
