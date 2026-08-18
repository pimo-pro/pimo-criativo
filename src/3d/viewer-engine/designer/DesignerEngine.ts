/**
 * DesignerEngine (Z-01.2.9) — fachada sobre IntelligentDesignerEngine com lazy-init.
 * `ensure()` só constrói o motor pesado na primeira chamada da API (PainelSala).
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
