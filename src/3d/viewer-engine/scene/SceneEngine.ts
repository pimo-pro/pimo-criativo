/**
 * SceneEngine (Z-01.2.7 A) — fachada sobre SceneManager.
 * Não cria uma segunda cena: reutiliza o gestor vivo.
 */
import type { SceneManager } from "./SceneManager";

export class SceneEngine {
  readonly manager: SceneManager;

  constructor(manager: SceneManager) {
    this.manager = manager;
  }

  get scene() {
    return this.manager.scene;
  }

  get root() {
    return this.manager.root;
  }

  add(object: Parameters<SceneManager["add"]>[0]): void {
    this.manager.add(object);
  }

  setBackground(color: string | null): void {
    this.manager.setBackground(color);
  }

  setGroundVisible(visible: boolean): void {
    this.manager.setGroundVisible(visible);
  }

  getGroundVisible(): boolean {
    return this.manager.getGroundVisible();
  }

  setGridVisible(visible: boolean): void {
    this.manager.setGridVisible(visible);
  }

  getGridVisible(): boolean {
    return this.manager.getGridVisible();
  }
}
