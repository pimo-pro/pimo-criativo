import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import type { ProjectState } from "../../context/projectTypes";
import {
  attachShowroomCadContent,
  isShowroomCadOnlyBox,
} from "./showroomCadModels";
import {
  buildShowroomWorkspaceSceneGroup,
  disposeShowroomObject3D,
} from "./showroomBuildWorkspaceScene";
import { createShowroomFinishVisuals, type ShowroomFinishVisuals } from "./showroomFinishVisuals";
import {
  applyShowroomBoxSeparation,
  applyShowroomExplodedView,
} from "./showroomExplodedView";

type Props = {
  projectState: ProjectState;
  focusBoxId?: string;
  boxExplode?: boolean;
  boxIntensity?: number;
  pieceExplode?: boolean;
  pieceIntensity?: number;
};

/**
 * Pré-visualização 3D alinhada ao motor paramétrico do workspace (buildBoxLegacy),
 * com remates, roda pé, hematis e modelos CAD/GLB — sem ViewerCore.
 */
export function ShowroomParametricBoxes({
  projectState,
  focusBoxId,
  boxExplode = false,
  boxIntensity = 0.45,
  pieceExplode = false,
  pieceIntensity = 0.35,
}: Props) {
  const sceneGroup = useMemo(() => buildShowroomWorkspaceSceneGroup(projectState), [projectState]);
  const rootRef = useRef<THREE.Group>(null);
  const finishRef = useRef<ShowroomFinishVisuals | null>(null);

  const getBoxWorldMatrix = useCallback((boxId: string): THREE.Matrix4 | null => {
    const root = rootRef.current ?? sceneGroup;
    const wrap = root.getObjectByName(`showroom-box-wrap-${boxId}`);
    if (!wrap) return null;
    wrap.updateMatrixWorld(true);
    return wrap.matrixWorld.clone();
  }, [sceneGroup]);

  useLayoutEffect(() => {
    finishRef.current?.dispose();
    finishRef.current = createShowroomFinishVisuals(projectState, getBoxWorldMatrix);
    const finish = finishRef.current;
    const root = rootRef.current;
    if (!root || !finish) return;

    root.add(finish.remateVisualizer.getRoot());
    root.add(finish.tampoVisualizer.getRoot());
    root.add(finish.rodapeVisualizer.getRoot());
    root.add(finish.hematiVisualizer.getRoot());
    finish.syncAll();

    return () => {
      root.remove(finish.remateVisualizer.getRoot());
      root.remove(finish.tampoVisualizer.getRoot());
      root.remove(finish.rodapeVisualizer.getRoot());
      root.remove(finish.hematiVisualizer.getRoot());
      finish.dispose();
      if (finishRef.current === finish) finishRef.current = null;
    };
  }, [projectState, getBoxWorldMatrix]);

  useLayoutEffect(() => {
    finishRef.current?.syncAll();
  }, [projectState.remates, projectState.rodapes, projectState.hematis, projectState.workspaceBoxes]);

  useEffect(() => {
    let cancelled = false;
    const cadBoxes = (projectState.workspaceBoxes ?? []).filter(isShowroomCadOnlyBox);

    void (async () => {
      for (const wsBox of cadBoxes) {
        if (cancelled) return;
        const wrap = sceneGroup.getObjectByName(`showroom-box-wrap-${wsBox.id}`);
        if (!wrap) continue;
        await attachShowroomCadContent(projectState, wsBox, wrap);
        if (cancelled) return;
        finishRef.current?.syncAll();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectState, sceneGroup]);

  useLayoutEffect(() => {
    // usar sceneGroup directamente — os box-wrappers são filhos do sceneGroup (primitive),
    // não do rootRef.current (group exterior)
    applyShowroomBoxSeparation(sceneGroup, boxExplode, boxIntensity);
    sceneGroup.children.forEach((child) => {
      if (!child.name.startsWith("showroom-box-wrap-")) return;
      if (focusBoxId && !child.name.endsWith(focusBoxId)) return;
      applyShowroomExplodedView(child, pieceExplode, pieceIntensity);
    });
  }, [sceneGroup, boxExplode, boxIntensity, pieceExplode, pieceIntensity, focusBoxId]);

  useEffect(() => {
    return () => {
      finishRef.current?.dispose();
      finishRef.current = null;
      disposeShowroomObject3D(sceneGroup);
    };
  }, [sceneGroup]);

  return (
    <group ref={rootRef}>
      <primitive object={sceneGroup} />
    </group>
  );
}
