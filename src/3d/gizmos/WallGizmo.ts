/**
 * STUB no-op — sistema Sala removido (feature/sala-rebuild-opensource).
 */
import * as THREE from "three";

export type WallGizmoDragMode = "move" | "rotate" | null;

export interface WallGizmoHandleHit {
  mode: "move" | "rotate";
  axis?: "x" | "z";
}

export class WallGizmo {
  readonly group = new THREE.Group();
  selectedWall: THREE.Mesh | null = null;
  isDragging = false;
  dragMode: WallGizmoDragMode = null;
  private camera: THREE.Camera;
  private onTransform: (() => void) | null = null;

  constructor(camera: THREE.Camera) {
    this.camera = camera;
    this.group.name = "wallGizmo";
    this.group.visible = false;
    void this.camera;
  }

  setOnTransform(cb: (() => void) | null): void {
    this.onTransform = cb;
  }

  attach(wall: THREE.Mesh): void {
    this.selectedWall = wall;
    this.group.visible = false;
  }

  detach(): void {
    this.selectedWall = null;
    this.isDragging = false;
    this.dragMode = null;
    this.group.visible = false;
  }

  update(): void {}

  hitTest(_x: number, _y: number): WallGizmoHandleHit | null {
    void _x;
    void _y;
    return null;
  }

  onPointerDown(_x: number, _y: number): boolean {
    void _x;
    void _y;
    return false;
  }

  onPointerMove(_x: number, _y: number): void {
    void _x;
    void _y;
  }

  onPointerUp(): void {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.dragMode = null;
    this.onTransform?.();
  }

  dispose(): void {
    this.detach();
  }
}
