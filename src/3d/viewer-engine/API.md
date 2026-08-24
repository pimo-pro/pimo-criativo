# ViewerCore — API pública (resumo Fase 3)

**Compatibilidade:** `window.viewerCore` é uma **ponte transitória de compatibilidade** (HMR / dispose) e **não deve ser usada em código novo**. O ponto de entrada canónico é `PimoViewerApi`; quaisquer mudanças ao global exigem deprecação/documentação.

## Construção

```typescript
import { ViewerCore, type ViewerOptions } from "@/3d/viewer-engine/ViewerCore";

const core = new ViewerCore(container, options?: ViewerOptions);
```

## Grupos de métodos (não exaustivo)

| Grupo | Exemplos |
|-------|----------|
| Caixas | `addBox`, `removeBox`, `updateBox`, `selectBox` |
| Materiais | `updateBoxMaterial`, `setMaterialMode` |
| Remate/rodapé/orla | `syncRemateVisuals`, `syncRodapeVisuals`, `syncOrlaVisuals` |
| Snapping | `settings.enableSmartAlignSnap`, `smartLayout.*` |
| Medições | `internalRuler`, `measurementAnchors` |
| Designer | `intelligentDesigner`, `manufacturingReport`, `costReport` |
| Export | `exportRender` |
| Grupo | `applySmartSnapForGroup` (stub — retorna false) |

## Tipos extraídos (Fase 3)

- `ViewerOptions` → `@/viewer/core/viewerTypes`
- Utilitários → `@/viewer/core/viewerUtils`

## Integração industrial

Ver `@/industrial/viewerIntegration` — ViewerCore **não** importa módulos industriais.
