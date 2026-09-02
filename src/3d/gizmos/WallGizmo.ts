/**
 * pimo-room v4 — gizmo de edição de paredes (mover / rodar / vértices extremos).
 * Handles: setas X/Z, círculo de rotação Y, esferas nos extremos (comprimento).
 */
import * as THREE from "three";

export type WallGizmoDragMode = "move" | "rotate" | "endpoint" | null;

export interface WallGizmoHandleHit {
  mode: "move" | "rotate" | "endpoint";
  axis?: "x" | "z";
  endpoint?: "start" | "end";
}

/**
 * Gizmo para mover, rotacionar e ajustar comprimento (vértices) de paredes no plano X/Z.
 */
export class WallGizmo {
  readonly group = new THREE.Group();
  selectedWall: THREE.Mesh | null = null;
  isDragging = false;
  dragMode: WallGizmoDragMode = null;
  activeEndpoint: "start" | "end" | null = null;

  private handles: {
    arrowX: THREE.ArrowHelper;
    arrowZ: THREE.ArrowHelper;
    circle: THREE.Mesh;
    vertexStart: THREE.Mesh;
    vertexEnd: THREE.Mesh;
  } | null = null;

  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly planeIntersect = new THREE.Vector3();

  private dragStartPosition = new THREE.Vector3();
  private dragStartPointerAngle = 0;
  private dragStartLengthM = 1;
  private dragStartWallPos = new THREE.Vector3();
  private dragEndpoint: "start" | "end" | null = null;

  private camera: THREE.Camera;
  private onTransform: (() => void) | null = null;

  private static readonly HANDLE_SCALE = 0.35;
  private static readonly ARROW_LEN = 0.25;
  private static readonly CIRCLE_RADIUS = 0.2;
  private static readonly VERTEX_RADIUS = 0.06;

  constructor(camera: THREE.Camera) {
    this.camera = camera;
    this.group.name = "wallGizmo";
    this.group.visible = false;

    const origin = new THREE.Vector3(0, 0, 0);
    const arrowX = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), origin, WallGizmo.ARROW_LEN, 0xe11d48);
    const arrowZ = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), origin, WallGizmo.ARROW_LEN, 0x2563eb);
    arrowX.userData.handle = "move" as const;
    arrowX.userData.axis = "x" as const;
    arrowZ.userData.handle = "move" as const;
    arrowZ.userData.axis = "z" as const;

    const circleGeom = new THREE.RingGeometry(
      WallGizmo.CIRCLE_RADIUS - 0.02,
      WallGizmo.CIRCLE_RADIUS + 0.02,
      32
    );
    circleGeom.rotateX(-Math.PI / 2);
    const circleMat = new THREE.MeshBasicMaterial({
      color: 0x16a34a,
      side: THREE.DoubleSide,
      depthTest: true,
    });
    const circle = new THREE.Mesh(circleGeom, circleMat);
    circle.position.y = 0.05;
    circle.userData.handle = "rotate" as const;

    const vertexMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, depthTest: true });
    const vertexStart = new THREE.Mesh(
      new THREE.SphereGeometry(WallGizmo.VERTEX_RADIUS, 16, 12),
      vertexMat.clone()
    );
    const vertexEnd = new THREE.Mesh(
      new THREE.SphereGeometry(WallGizmo.VERTEX_RADIUS, 16, 12),
      vertexMat.clone()
    );
    vertexStart.userData.handle = "endpoint" as const;
    vertexStart.userData.endpoint = "start" as const;
    vertexEnd.userData.handle = "endpoint" as const;
    vertexEnd.userData.endpoint = "end" as const;
    vertexStart.position.y = 0.08;
    vertexEnd.position.y = 0.08;

    this.group.add(arrowX, arrowZ, circle, vertexStart, vertexEnd);
    this.handles = { arrowX, arrowZ, circle, vertexStart, vertexEnd };
  }

  setOnTransform(callback: (() => void) | null): void {
    this.onTransform = callback;
  }

  attach(wall: THREE.Mesh): void {
    this.detach();
    this.selectedWall = wall;
    this.syncFromWall();
    this.group.visible = true;
  }

  detach(): void {
    this.selectedWall = null;
    this.isDragging = false;
    this.dragMode = null;
    this.activeEndpoint = null;
    this.dragEndpoint = null;
    this.group.visible = false;
  }

  update(): void {
    if (!this.selectedWall) return;
    this.syncFromWall();
  }

  private getWallHalfLengthLocal(): number {
    const lenMm = Number(this.selectedWall?.userData.wallLengthMm) || 3000;
    return Math.max(0.05, lenMm / 2000);
  }

  private syncFromWall(): void {
    if (!this.selectedWall || !this.handles) return;
    this.selectedWall.getWorldPosition(this.group.position);
    this.group.rotation.set(0, this.selectedWall.rotation.y, 0);
    const scale = WallGizmo.HANDLE_SCALE;
    this.group.scale.setScalar(scale);
    const half = this.getWallHalfLengthLocal() / scale;
    this.handles.vertexStart.position.x = -half;
    this.handles.vertexEnd.position.x = half;
    this.handles.vertexStart.position.z = 0;
    this.handles.vertexEnd.position.z = 0;
  }

  private getHandleObjects(): THREE.Object3D[] {
    const h = this.handles;
    if (!h) return [];
    return [h.arrowX, h.arrowZ, h.circle, h.vertexStart, h.vertexEnd];
  }

  hitTest(pointerNdcX: number, pointerNdcY: number): WallGizmoHandleHit | null {
    this.pointer.set(pointerNdcX, pointerNdcY);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.getHandleObjects(), true);
    if (!hits.length) return null;
    let obj: THREE.Object3D | null = hits[0].object;
    while (obj && obj.userData?.handle === undefined) obj = obj.parent;
    if (!obj) return null;
    const handle = obj.userData?.handle as "move" | "rotate" | "endpoint" | undefined;
    const axis = obj.userData?.axis as "x" | "z" | undefined;
    const endpoint = obj.userData?.endpoint as "start" | "end" | undefined;
    if (handle === "move" && axis) return { mode: "move", axis };
    if (handle === "rotate") return { mode: "rotate" };
    if (handle === "endpoint" && endpoint) return { mode: "endpoint", endpoint };
    return null;
  }

  onPointerDown(pointerNdcX: number, pointerNdcY: number): boolean {
    if (!this.selectedWall) return false;
    const hit = this.hitTest(pointerNdcX, pointerNdcY);
    if (!hit) return false;

    this.isDragging = true;
    this.dragMode = hit.mode;
    this.activeEndpoint = hit.endpoint ?? null;
    this.dragEndpoint = hit.endpoint ?? null;
    this.selectedWall.getWorldPosition(this.dragStartWallPos);
    this.dragStartLengthM = (Number(this.selectedWall.userData.wallLengthMm) || 3000) / 1000;

    this.pointer.set(pointerNdcX, pointerNdcY);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.plane.constant = -this.dragStartWallPos.y;

    if (hit.mode === "move" || hit.mode === "endpoint") {
      this.raycaster.ray.intersectPlane(this.plane, this.planeIntersect);
      this.dragStartPosition.copy(this.planeIntersect);
    } else {
      this.raycaster.ray.intersectPlane(this.plane, this.planeIntersect);
      this.dragStartPointerAngle = Math.atan2(
        this.planeIntersect.z - this.dragStartWallPos.z,
        this.planeIntersect.x - this.dragStartWallPos.x
      );
    }
    return true;
  }

  onPointerMove(pointerNdcX: number, pointerNdcY: number): void {
    if (!this.isDragging || !this.selectedWall || !this.dragMode) return;

    this.pointer.set(pointerNdcX, pointerNdcY);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.plane.setFromNormalAndCoplanarPoint(
      new THREE.Vector3(0, 1, 0),
      this.selectedWall.getWorldPosition(new THREE.Vector3())
    );
    if (!this.raycaster.ray.intersectPlane(this.plane, this.planeIntersect)) return;

    if (this.dragMode === "move") {
      const dx = this.planeIntersect.x - this.dragStartPosition.x;
      const dz = this.planeIntersect.z - this.dragStartPosition.z;
      this.selectedWall.position.x += dx;
      this.selectedWall.position.z += dz;
      this.dragStartPosition.copy(this.planeIntersect);
    } else if (this.dragMode === "rotate") {
      const wallPos = this.selectedWall.getWorldPosition(new THREE.Vector3());
      const angle = Math.atan2(
        this.planeIntersect.z - wallPos.z,
        this.planeIntersect.x - wallPos.x
      );
      const delta = angle - this.dragStartPointerAngle;
      this.dragStartPointerAngle = angle;
      this.selectedWall.rotation.y += delta;
    } else if (this.dragMode === "endpoint" && this.dragEndpoint) {
      const wall = this.selectedWall;
      const dir = new THREE.Vector3(Math.cos(wall.rotation.y), 0, Math.sin(wall.rotation.y));
      const deltaWorld = this.planeIntersect.clone().sub(this.dragStartPosition);
      const along = deltaWorld.dot(dir);
      const sign = this.dragEndpoint === "end" ? 1 : -1;
      const nextLen = Math.max(0.5, this.dragStartLengthM + along * sign);
      const deltaLen = nextLen - this.dragStartLengthM;
      wall.userData.wallLengthMm = nextLen * 1000;
      // Mantém o extremo oposto fixo: desloca o centro metade do delta.
      wall.position.x = this.dragStartWallPos.x + dir.x * (deltaLen / 2) * sign;
      wall.position.z = this.dragStartWallPos.z + dir.z * (deltaLen / 2) * sign;
      // Actualiza geometria de caixa local se existir BoxGeometry / Extrude.
      const thicknessM = Number(wall.userData.wallThicknessM) || 0.2;
      const heightM = (Number(wall.userData.wallHeightMm) || 2600) / 1000;
      const oldGeo = wall.geometry;
      const miters = wall.userData.wallMiters as
        | { startMiterRad?: number; endMiterRad?: number }
        | null
        | undefined;
      // Rebuild deferred via onTransform → RoomManager; aqui actualiza caixa simples.
      wall.geometry = new THREE.BoxGeometry(nextLen, heightM, thicknessM);
      oldGeo.dispose();
      void miters;
    }
    this.syncFromWall();
  }

  onPointerUp(): void {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.dragMode = null;
    this.activeEndpoint = null;
    this.dragEndpoint = null;
    this.onTransform?.();
  }

  dispose(): void {
    this.detach();
    const h = this.handles;
    if (h) {
      if (h.arrowX?.line?.geometry) h.arrowX.line.geometry.dispose();
      if (h.arrowZ?.line?.geometry) h.arrowZ.line.geometry.dispose();
      h.circle?.geometry?.dispose();
      if (h.circle?.material && !Array.isArray(h.circle.material)) {
        (h.circle.material as THREE.Material).dispose();
      }
      h.vertexStart.geometry.dispose();
      h.vertexEnd.geometry.dispose();
      (h.vertexStart.material as THREE.Material).dispose();
      (h.vertexEnd.material as THREE.Material).dispose();
    }
    this.group.clear();
  }
}
