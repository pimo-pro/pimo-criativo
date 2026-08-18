/**
 * BoxEngine (Z-01.2.7 C) — porta pública add/update/remove.
 * Delega malha ao BoxSceneController → BoxBuilder. Zero geometria aqui.
 */
import type { BoxSceneController } from "./BoxSceneController";

export class BoxEngine {
  readonly controller: BoxSceneController;

  constructor(controller: BoxSceneController) {
    this.controller = controller;
  }

  static ensure(current: BoxEngine | null, controller: BoxSceneController): BoxEngine {
    return current ?? new BoxEngine(controller);
  }

  addBox(params: Parameters<BoxSceneController["addBox"]>[0]): boolean {
    return this.controller.addBox(params);
  }

  createUpdateBoxStructurePlan(
    ...args: Parameters<BoxSceneController["createUpdateBoxStructurePlan"]>
  ): ReturnType<BoxSceneController["createUpdateBoxStructurePlan"]> {
    return this.controller.createUpdateBoxStructurePlan(...args);
  }

  applyOnlyTransformUpdate(
    ...args: Parameters<BoxSceneController["applyOnlyTransformUpdate"]>
  ): ReturnType<BoxSceneController["applyOnlyTransformUpdate"]> {
    return this.controller.applyOnlyTransformUpdate(...args);
  }

  applyStructuralUpdate(
    ...args: Parameters<BoxSceneController["applyStructuralUpdate"]>
  ): ReturnType<BoxSceneController["applyStructuralUpdate"]> {
    return this.controller.applyStructuralUpdate(...args);
  }
}
