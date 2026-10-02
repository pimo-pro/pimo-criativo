/**
 * Walkthrough — 1ª pessoa no ViewerCore WebGL (sem R3F).
 * WASD + mouse look; colisão AABB com footprint da sala.
 */
import * as THREE from "three";

export type WalkthroughBoundsM = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY: number;
  maxY: number;
};

export type WalkthroughOptions = {
  eyeHeightM?: number;
  moveSpeedMps?: number;
  lookSensitivity?: number;
  collisionPaddingM?: number;
  spawn?: { x: number; y: number; z: number; yawDeg?: number };
};

type OrbitLike = {
  enabled: boolean;
  enableDamping?: boolean;
  update?: () => void;
};

export class WalkthroughCamera {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly dom: HTMLElement;
  private readonly getOrbit: () => OrbitLike | null;
  private bounds: WalkthroughBoundsM;
  private active = false;
  private keys = new Set<string>();
  private yaw = 0;
  private pitch = 0;
  private eyeHeightM: number;
  private moveSpeedMps: number;
  private lookSensitivity: number;
  private collisionPaddingM: number;
  private raf = 0;
  private lastT = 0;
  private pointerLocked = false;
  private savedOrbitEnabled: boolean | null = null;

  private readonly onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.code);
    if (["KeyW", "KeyA", "KeyS", "KeyD", "Space"].includes(e.code)) e.preventDefault();
  };
  private readonly onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };
  private readonly onMouseMove = (e: MouseEvent) => {
    if (!this.active || !this.pointerLocked) return;
    this.yaw -= e.movementX * this.lookSensitivity;
    this.pitch -= e.movementY * this.lookSensitivity;
    const lim = Math.PI / 2 - 0.05;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  };
  private readonly onPointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.dom;
  };
  private readonly onClick = () => {
    if (this.active && !this.pointerLocked) {
      this.dom.requestPointerLock?.();
    }
  };

  constructor(
    camera: THREE.PerspectiveCamera,
    dom: HTMLElement,
    getOrbit: () => OrbitLike | null,
    bounds: WalkthroughBoundsM,
    options: WalkthroughOptions = {}
  ) {
    this.camera = camera;
    this.dom = dom;
    this.getOrbit = getOrbit;
    this.bounds = bounds;
    this.eyeHeightM = options.eyeHeightM ?? 1.6;
    this.moveSpeedMps = options.moveSpeedMps ?? 2.2;
    this.lookSensitivity = options.lookSensitivity ?? 0.0022;
    this.collisionPaddingM = options.collisionPaddingM ?? 0.25;
    if (options.spawn) {
      this.camera.position.set(
        options.spawn.x,
        options.spawn.y ?? this.eyeHeightM,
        options.spawn.z
      );
      this.yaw = ((options.spawn.yawDeg ?? 0) * Math.PI) / 180;
      this.pitch = 0;
    } else {
      this.camera.position.set(0, this.eyeHeightM, 0);
      this.yaw = 0;
      this.pitch = 0;
    }
    this.applyLook();
  }

  setBounds(bounds: WalkthroughBoundsM): void {
    this.bounds = bounds;
  }

  isActive(): boolean {
    return this.active;
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    const orbit = this.getOrbit();
    if (orbit) {
      this.savedOrbitEnabled = orbit.enabled;
      orbit.enabled = false;
    }
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    this.dom.addEventListener("click", this.onClick);
    this.dom.requestPointerLock?.();
    this.lastT = performance.now();
    const loop = (t: number) => {
      if (!this.active) return;
      const dt = Math.min(0.05, (t - this.lastT) / 1000);
      this.lastT = t;
      this.tick(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    document.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    this.dom.removeEventListener("click", this.onClick);
    if (document.pointerLockElement === this.dom) {
      document.exitPointerLock?.();
    }
    const orbit = this.getOrbit();
    if (orbit && this.savedOrbitEnabled != null) {
      orbit.enabled = this.savedOrbitEnabled;
    }
    this.keys.clear();
    this.pointerLocked = false;
  }

  dispose(): void {
    this.stop();
  }

  private applyLook(): void {
    const euler = new THREE.Euler(this.pitch, this.yaw, 0, "YXZ");
    this.camera.quaternion.setFromEuler(euler);
  }

  private tick(dt: number): void {
    this.applyLook();
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    forward.normalize();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    right.y = 0;
    right.normalize();

    const wish = new THREE.Vector3();
    if (this.keys.has("KeyW")) wish.add(forward);
    if (this.keys.has("KeyS")) wish.sub(forward);
    if (this.keys.has("KeyD")) wish.add(right);
    if (this.keys.has("KeyA")) wish.sub(right);
    if (wish.lengthSq() > 0) {
      wish.normalize().multiplyScalar(this.moveSpeedMps * dt);
      this.tryMove(wish.x, wish.z);
    }
    this.camera.position.y = Math.min(
      this.bounds.maxY - 0.2,
      Math.max(this.bounds.minY + this.eyeHeightM * 0.5, this.eyeHeightM + this.bounds.minY)
    );
  }

  private tryMove(dx: number, dz: number): void {
    const pad = this.collisionPaddingM;
    const minX = this.bounds.minX + pad;
    const maxX = this.bounds.maxX - pad;
    const minZ = this.bounds.minZ + pad;
    const maxZ = this.bounds.maxZ - pad;
    let x = this.camera.position.x + dx;
    let z = this.camera.position.z + dz;
    x = Math.min(maxX, Math.max(minX, x));
    z = Math.min(maxZ, Math.max(minZ, z));
    this.camera.position.x = x;
    this.camera.position.z = z;
  }
}
