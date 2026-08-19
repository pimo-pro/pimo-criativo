import * as THREE from "three";
import type { ViewerBoxEntry } from "./types";
import {
  runWithAllLayoutBoundsProxiesVisible,
  runWithLayoutBoundsProxiesVisible,
} from "./box/boxAabbUtils";

export type ViewerCoreCameraOpsDeps = {
  cameraManager: {
    camera: any;
    setTarget: (x: number, y: number, z: number) => void;
    getTarget: () => THREE.Vector3;
  };
  controls: { controls: { target: THREE.Vector3 }; update: () => void } | null;
  boxes: Map<string, ViewerBoxEntry>;
  cameraViewPreset: string | null;
  boundingBox: THREE.Box3;
  center: THREE.Vector3;
  boxSingle: THREE.Box3;
  size: THREE.Vector3;
  projScreenMatrix: THREE.Matrix4;
  frustum: THREE.Frustum;
};

export function syncCameraTargetImpl(
  deps: ViewerCoreCameraOpsDeps,
  center: THREE.Vector3,
  options?: { updateLookAt?: boolean }
): void {
  const updateLookAt = options?.updateLookAt !== false;
  if (updateLookAt) {
    deps.cameraManager.setTarget(center.x, center.y, center.z);
  } else {
    deps.cameraManager.getTarget().copy(center);
  }
  if (deps.controls) {
    deps.controls.controls.target.copy(center);
    deps.controls.update();
  }
}

export function updateCameraTargetImpl(deps: ViewerCoreCameraOpsDeps): void {
  if (deps.boxes.size === 0) {
    if (deps.cameraViewPreset == null) {
      syncCameraTargetImpl(deps, new THREE.Vector3(0, 0, 0));
    }
    return;
  }

  const camBboxRoots = Array.from(deps.boxes.values()).map((e) => e.mesh);
  runWithAllLayoutBoundsProxiesVisible(camBboxRoots, () => {
    deps.boundingBox.makeEmpty();
    deps.boxes.forEach((entry) => {
      deps.boundingBox.expandByObject(entry.mesh);
    });
  });

  deps.boundingBox.getCenter(deps.center);

  if (deps.cameraViewPreset != null) {
    syncCameraTargetImpl(deps, deps.center, { updateLookAt: false });
    return;
  }

  syncCameraTargetImpl(deps, deps.center);
}

export function getBoxBoundingBoxCenterImpl(
  deps: ViewerCoreCameraOpsDeps,
  boxId: string
): THREE.Vector3 | null {
  const entry = deps.boxes.get(boxId);
  if (!entry) return null;
  entry.mesh.updateMatrixWorld(true);

  runWithLayoutBoundsProxiesVisible(entry.mesh, () => {
    deps.boxSingle.setFromObject(entry.mesh);
  });

  deps.boxSingle.getCenter(deps.center);
  return deps.center.clone();
}

export function isBoxInCameraFrameImpl(deps: ViewerCoreCameraOpsDeps, boxId: string): boolean {
  const entry = deps.boxes.get(boxId);
  if (!entry) return false;

  entry.mesh.updateMatrixWorld(true);
  deps.cameraManager.camera.updateMatrixWorld(true);

  deps.projScreenMatrix.multiplyMatrices(
    deps.cameraManager.camera.projectionMatrix,
    deps.cameraManager.camera.matrixWorldInverse
  );
  deps.frustum.setFromProjectionMatrix(deps.projScreenMatrix);

  runWithLayoutBoundsProxiesVisible(entry.mesh, () => {
    deps.boxSingle.setFromObject(entry.mesh);
  });

  return deps.frustum.intersectsBox(deps.boxSingle);
}

export function adjustCameraPositionToIncludeBoxImpl(
  deps: ViewerCoreCameraOpsDeps,
  boxId: string
): void {
  const entry = deps.boxes.get(boxId);
  if (!entry) return;

  entry.mesh.updateMatrixWorld(true);
  runWithLayoutBoundsProxiesVisible(entry.mesh, () => {
    deps.boxSingle.setFromObject(entry.mesh);
  });

  deps.boxSingle.getCenter(deps.center);
  deps.boxSingle.getSize(deps.size);

  const cam = deps.cameraManager.camera;
  const dir = new THREE.Vector3().subVectors(cam.position, deps.center).normalize();

  const maxDim = Math.max(deps.size.x, deps.size.y, deps.size.z, 0.1);
  const fovRad = (cam.fov * Math.PI) / 180;
  const distance = Math.max(0.3, (maxDim / (2 * Math.tan(fovRad * 0.5))) * 1.1);

  cam.position.copy(deps.center).addScaledVector(dir, distance);
  syncCameraTargetImpl(deps, deps.center, { updateLookAt: false });
  cam.lookAt(deps.center);
  deps.controls?.update();
}

export function updateCameraTargetToBoxImpl(
  deps: ViewerCoreCameraOpsDeps,
  boxId: string,
  options?: { onlyMovePositionIfOutOfFrame?: boolean }
): void {
  const center = getBoxBoundingBoxCenterImpl(deps, boxId);
  if (!center) return;

  if (deps.cameraViewPreset != null) {
    syncCameraTargetImpl(deps, center, { updateLookAt: false });
    return;
  }

  syncCameraTargetImpl(deps, center);
  const onlyIfOut = options?.onlyMovePositionIfOutOfFrame === true;

  if (onlyIfOut && !isBoxInCameraFrameImpl(deps, boxId)) {
    adjustCameraPositionToIncludeBoxImpl(deps, boxId);
  }
}

