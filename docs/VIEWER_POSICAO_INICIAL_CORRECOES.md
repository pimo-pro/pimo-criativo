# Posição inicial no Viewer – correções definitivas

## 1. Lista dos ficheiros modificados

- **`src/3d/core/Viewer.ts`**

---

## 2. Explicação breve do impacto

| Alteração | Impacto |
|-----------|---------|
| **Posição aplicada imediatamente** | A posição inicial (`opts.position`) é aplicada à caixa logo após a criação do mesh, antes de qualquer bbox, recenter, clampTransform ou colisão. Nenhum recálculo automático altera X/Y/Z na criação. |
| **Registo em `this.boxes` antes da cena** | A nova caixa é registada em `this.boxes` (com posição e `manualPosition`) **antes** de ser adicionada à cena (`sceneManager.add`). Assim, qualquer lógica que use o mapa (incluindo `getRightmostX`) vê a caixa já com posição definida. |
| **getRightmostX com bbox não carregado** | Quando o bbox ainda não está disponível (ex.: Group vazio antes do GLB carregar), usa-se `position.x + width/2` em vez do bbox. Assim não se usa bbox “zero” e a próxima caixa não nasce em cima da anterior. O bbox real só é usado quando `_size.x >= 0.001` e `max.x` é finito. |
| **Sem recenter/clamp/colisão na criação** | `reflowBoxes` continua a não alterar caixas com `manualPosition`. `clampTransform` só corre em `objectChange` (arraste). Nenhuma lógica move a caixa após a criação. |
| **manualPosition = true** | Continua a impedir qualquer recálculo de posição em `updateBox` e `reflowBoxes`. |

Com isto:
- As caixas não nascem no centro (X vem do ProjectProvider: rightmost + 0,1 m).
- Não nascem em cima de outras (getRightmostX usa posição + largura quando o modelo ainda não carregou).
- Não nascem com “bbox zero” a afectar o rightmost (fallback position + width/2).
- A posição inicial é exactamente X = rightmost + 0,1 m, Y = altura/2, Z = 0, sem ajustes adicionais no Viewer.

---

## 3. Diff completo das mudanças

```diff
diff --git a/src/3d/core/Viewer.ts b/src/3d/core/Viewer.ts
--- a/src/3d/core/Viewer.ts
+++ b/src/3d/core/Viewer.ts
@@ -362,14 +362,23 @@ export class Viewer {
     };
   }
 
-  /** Maior X (borda direita) das caixas em metros. Atualiza bounding boxes antes. Sem caixas retorna -0.1 (100 mm à esquerda da origem). */
+  /**
+   * Maior X (borda direita) das caixas em metros.
+   * Usa bbox real quando disponível; quando bbox ainda não carregado (ex.: Group vazio) usa position + width/2.
+   * Sem caixas retorna -0.1.
+   */
   getRightmostX(): number {
     if (this.boxes.size === 0) return -0.1;
     let maxX = -Infinity;
     this.boxes.forEach((entry) => {
       entry.mesh.updateMatrixWorld(true);
       this._boundingBox.setFromObject(entry.mesh);
-      if (this._boundingBox.max.x > maxX) maxX = this._boundingBox.max.x;
+      this._boundingBox.getSize(this._size);
+      const rightEdge =
+        this._size.x < 0.001 || !Number.isFinite(this._boundingBox.max.x)
+          ? entry.mesh.position.x + entry.width / 2
+          : this._boundingBox.max.x;
+      if (rightEdge > maxX) maxX = rightEdge;
     });
     return Number.isFinite(maxX) ? maxX : -0.1;
   }
@@ -585,7 +594,6 @@ export class Viewer {
     let material: LoadedWoodMaterial | null = null;
 
     if (cadOnly) {
-      // Caixa só CAD: grupo vazio; o GLB é a própria caixa (sem geometria paramétrica)
       box = new THREE.Group();
       box.name = id;
     } else {
@@ -609,7 +617,7 @@ export class Viewer {
     box.frustumCulled = false;
     box.userData.boxId = id;
     const baseY = height / 2;
-    // manualPosition + position: usar EXCLUSIVAMENTE a posição do projeto (ProjectProvider). Sem offsets, recenter ou ajustes.
+    // Posição inicial aplicada IMEDIATAMENTE; sem recenter, clamp, colisão nem bbox antes.
     const position =
       manualPosition && opts.position
         ? { x: opts.position.x, y: opts.position.y, z: opts.position.z }
@@ -620,7 +628,7 @@ export class Viewer {
     if (opts.rotationY != null && Number.isFinite(opts.rotationY)) {
       box.rotation.y = opts.rotationY;
     }
-    this.sceneManager.add(box);
+    // Registar em this.boxes ANTES de adicionar à cena (getRightmostX e restante lógica usam este mapa).
     this.boxes.set(id, {
       mesh: box,
       width,
@@ -632,6 +640,8 @@ export class Viewer {
       cadModels: [],
       material,
     });
+    this.sceneManager.add(box);
+    // reflowBoxes não altera caixas com manualPosition; clampTransform só em objectChange (arraste).
     this.reflowBoxes();
     this.updateCameraTarget();
     return true;
```
