import type { ProjectState } from "../../../context/projectTypes";
import {
  runAutoRoomFillOnState,
  runKitchenLayout30OnState,
  type AutoFillApplyResult,
} from "../../../core/autoRoomFill";
import { AutoLayoutEngine } from "../autoLayout/AutoLayoutEngine";
import type { AutoLayoutPlan, AutoStackShelvesOptions } from "../autoLayout/autoLayoutTypes";
import { AutoWallFillEngine } from "../snapping/autoWallFillEngine";
import { AutoRoomFillEngine } from "../snapping/autoRoomFillEngine";
import { AutoDistributionEngine } from "../snapping/autoDistributionEngine";
import { AutoStackShelvesEngine } from "../snapping/autoStackShelvesEngine";
import { PredictiveLayoutEngine } from "../snapping/predictiveLayoutEngine";
import type { SmartLayoutBridge, SmartLayoutEngineDeps } from "../snapping/smartLayoutTypes";

/**
 * Motor canónico de auto-fill do Viewer (Z-01.2.4).
 *
 * Dois canais, sem fundir a matemática (UX intacta):
 *   1. Projecto — Kitchen 3.0 (`core/autoRoomFill`); PainelSala / `runProjectRoomFill`
 *   2. 3D — adapters `AutoLayoutEngine` (menu Ferramentas) e smartLayout (preview / parede / sala)
 *
 * `autoLayout` e `smartLayout` da API pública delegam aqui; não há terceiro caminho no ViewerCore.
 */
export class LayoutEngine {
  readonly autoLayoutEngine: AutoLayoutEngine;
  readonly wallFill: AutoWallFillEngine;
  readonly roomFill: AutoRoomFillEngine;
  readonly distribution: AutoDistributionEngine;
  readonly stackShelves: AutoStackShelvesEngine;
  readonly predictive: PredictiveLayoutEngine;

  constructor(deps: SmartLayoutEngineDeps) {
    this.autoLayoutEngine = new AutoLayoutEngine();
    this.wallFill = new AutoWallFillEngine(deps);
    this.roomFill = new AutoRoomFillEngine(deps);
    this.distribution = new AutoDistributionEngine(deps);
    this.stackShelves = new AutoStackShelvesEngine(deps);
    this.predictive = new PredictiveLayoutEngine(deps);
  }

  bindBridge(bridge: SmartLayoutBridge | null): void {
    this.autoLayoutEngine.bindBridge(bridge);
  }

  fillWallWithModule(wallId: string | number, moduleBoxId: string): boolean {
    return this.autoLayoutEngine.fillWallWithModule(wallId, moduleBoxId);
  }

  extendAlongWallFromBox(boxId: string): boolean {
    return this.autoLayoutEngine.extendAlongWallFromBox(boxId);
  }

  distributeBoxesEvenly(boxIds: string[]): boolean {
    return this.autoLayoutEngine.distributeBoxesEvenly(boxIds);
  }

  autoStackShelvesInBox(boxId: string, options: AutoStackShelvesOptions): boolean {
    return this.autoLayoutEngine.autoStackShelvesInBox(boxId, options);
  }

  autoWallFill(wallId: string | number, moduleBoxId: string): boolean {
    return this.wallFill.fillWall({
      wallId,
      moduleBoxId,
      alignTop: true,
      alignFront: true,
    });
  }

  buildWallFillPlan(wallId: string | number, moduleBoxId: string): AutoLayoutPlan | null {
    return this.wallFill.buildPlan({
      wallId,
      moduleBoxId,
      alignTop: true,
      alignFront: true,
    });
  }

  autoRoomFill(seedBoxId?: string): boolean {
    return this.roomFill.fillRoom(seedBoxId);
  }

  autoDistribute(boxIds: string[]): boolean {
    return this.distribution.distribute({
      boxIds,
      alignTop: true,
      alignFront: true,
      alignDepth: true,
      useHistorySpacing: true,
    });
  }

  autoStackShelves(boxId: string, options: AutoStackShelvesOptions): boolean {
    return this.stackShelves.stackShelves(boxId, options);
  }

  /** Kitchen Layout 3.0 — único auto-fill de **projecto** (PainelSala). */
  static runProjectKitchenLayout(prev: ProjectState): AutoFillApplyResult | null {
    return runKitchenLayout30OnState(prev);
  }

  /** Preenchimento de sala legado de projecto (botão PainelSala; não substitui Kitchen 3.0). */
  static runProjectAutoRoomFill(prev: ProjectState): AutoFillApplyResult | null {
    return runAutoRoomFillOnState(prev);
  }
}
