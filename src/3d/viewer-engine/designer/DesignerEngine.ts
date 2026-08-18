/**
 * DesignerEngine (Z-01.2.7 D) — fachada sobre IntelligentDesignerEngine.
 * Lazy-init real fica para Z-01.2.9; aqui o ensure() só encapsula a construção.
 */
import {
  IntelligentDesignerEngine,
  type IntelligentDesignerDeps,
} from "../snapping/intelligentDesignerEngine";

export class DesignerEngine {
  private instance: IntelligentDesignerEngine | null = null;

  ensure(deps: IntelligentDesignerDeps): IntelligentDesignerEngine {
    if (!this.instance) {
      this.instance = new IntelligentDesignerEngine(deps);
    }
    return this.instance;
  }

  get(): IntelligentDesignerEngine | null {
    return this.instance;
  }
}
