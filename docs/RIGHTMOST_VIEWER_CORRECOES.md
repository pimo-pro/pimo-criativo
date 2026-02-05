# Rightmost no Viewer – correções

## 1. Lista dos ficheiros modificados

- **`src/3d/core/Viewer.ts`** – Novo método `getRightmostX()`.
- **`src/context/ProjectProvider.tsx`** – Uso de `viewerSync.getRightmostX()`; remoção de todo o cálculo de `rightmost_mm`.
- **`src/context/projectTypes.ts`** – `getRightmostX: () => number` em `ViewerApi` e `ViewerSync`.
- **`src/context/PimoViewerContextCore.ts`** – `getRightmostX?: () => number` em `PimoViewerApi`.
- **`src/core/viewer/viewerApiAdapter.ts`** – Implementação de `getRightmostX` no adapter.
- **`src/hooks/usePimoViewer.ts`** – Exposição de `getRightmostX` no retorno do hook.
- **`src/hooks/useViewerSync.ts`** – Exposição de `getRightmostX` no retorno do hook.

---

## 2. Explicação breve do impacto

| Alteração | Impacto |
|-----------|---------|
| **Rightmost no Viewer** | O valor “borda direita” passa a ser calculado no Viewer a partir dos bounding boxes reais (`this.boxes` + `updateMatrixWorld` + `setFromObject`). Retorno em metros; sem caixas retorna `-0.1` (100 mm à esquerda da origem). |
| **ProjectProvider deixa de calcular rightmost** | Em `addWorkspaceBoxFromCatalog`, `duplicateBox` e `addCadModelAsNewBox` remove-se todo o cálculo de `rightmost_mm` a partir de `workspaceBoxes`. A posição X passa a ser: `posicaoX_mm = (viewerSync.getRightmostX() + 0.1) * 1000 + largura/2` (centro da nova caixa em mm). |
| **Sincronização** | O Viewer atualiza as bounding boxes dentro de `getRightmostX()` antes de calcular o máximo em X, garantindo que a resposta reflete o estado actual da cena. |
| **Estabilidade** | Mantém-se `manualPosition = true` e a regra de não alterar posição inicial (reflow/updateBox/clampTransform não mexem em caixas com posição manual). |

Com isto, as novas caixas (catálogo, duplicar, CAD) passam a nascer sempre à direita da última caixa visível no viewer (rightmost + 100 mm), e não “em cima” da caixa do centro nem com X desfasado do estado real do viewer.

---

## 3. Diff completo das mudanças

```diff
diff --git a/src/3d/core/Viewer.ts b/src/3d/core/Viewer.ts
--- a/src/3d/core/Viewer.ts
+++ b/src/3d/core/Viewer.ts
@@ -362,6 +362,18 @@ export class Viewer {
     };
   }
 
+  /** Maior X (borda direita) das caixas em metros. Atualiza bounding boxes antes. Sem caixas retorna -0.1 (100 mm à esquerda da origem). */
+  getRightmostX(): number {
+    if (this.boxes.size === 0) return -0.1;
+    let maxX = -Infinity;
+    this.boxes.forEach((entry) => {
+      entry.mesh.updateMatrixWorld(true);
+      this._boundingBox.setFromObject(entry.mesh);
+      if (this._boundingBox.max.x > maxX) maxX = this._boundingBox.max.x;
+    });
+    return Number.isFinite(maxX) ? maxX : -0.1;
+  }
+
   /** Dimensões da caixa selecionada (L, A, P). Usado no modo Selecionar para overlay. */
   getSelectedBoxDimensions(): ...
```

(Ver output completo de `git diff -- src/3d/core/Viewer.ts src/context/ProjectProvider.tsx src/context/projectTypes.ts src/context/PimoViewerContextCore.ts src/core/viewer/viewerApiAdapter.ts src/hooks/usePimoViewer.ts src/hooks/useViewerSync.ts` para o diff integral.)
