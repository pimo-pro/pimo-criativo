# Catálogo – Pivot na base (correção definitiva)

## 1. Ficheiros modificados

- **`src/3d/core/Viewer.ts`**
- **`docs/CATALOGO_PIVOT_BASE_CORRECAO.md`** (este ficheiro)

---

## 2. Impacto

| Alteração | Impacto |
|-----------|---------|
| **centerObjectInGroup** | Passa a usar `object.position.y = this._size.y / 2` em vez de `-this._boundingBox.min.y`, de forma explícita: centro em X/Z na origem do grupo e base no chão (y=0). Comentário a explicar que normaliza o pivot para modelos do Catálogo e CAD-only e que só altera o filho (object), nunca a posição do grupo (entry.mesh). |
| **applyCatalogModelScale** | Chama sempre `centerObjectInGroup(object)` após aplicar a escala, para todos os modelos de catálogo. Removido o guard `if (!entry.manualPosition)`. Tipo de `entry` volta a não incluir `manualPosition`. |
| **addModelToBox (CAD-only não catálogo)** | Chama sempre `centerObjectInGroup(object)` para CAD-only, removido o guard `if (!entry.manualPosition)`. |

Com isto:

- No carregamento de qualquer modelo do Catálogo (e CAD-only), aplica-se: bbox real → getCenter() → posição do modelo = -centro em X/Z e `position.y = size.y/2` (base no chão).
- A normalização é só no **filho** (object); a posição do **grupo** (entry.mesh) continua a ser a enviada pelo ProjectProvider (X = rightmost + 0.1, Y = altura/2, Z = 0) e não é alterada.
- Modelos do Catálogo deixam de nascer com pivot no meio (centro da tela), ficam com base no chão e centro em XZ no grupo, e respeitam a posição inicial.

---

## 3. Diff completo

```diff
--- a/src/3d/core/Viewer.ts
+++ b/src/3d/core/Viewer.ts
@@ -927,12 +927,16 @@ export class Viewer {
   }
 
-  /** Coloca o GLB com base no chão: centra em X e Z; em Y coloca a base em y=0 no grupo. */
+  /**
+   * Normaliza o pivot do modelo: centro em X/Z na origem do grupo, base no chão (y=0).
+   * Usado para modelos do Catálogo e CAD-only para que não nasçam com pivot no meio (centro da tela).
+   * Altera apenas object.position (filho); a posição do grupo (entry.mesh) não é tocada.
+   */
   private centerObjectInGroup(object: THREE.Object3D): void {
     object.updateMatrixWorld(true);
     this._boundingBox.setFromObject(object);
     this._boundingBox.getCenter(this._center);
+    this._boundingBox.getSize(this._size);
     object.position.x = -this._center.x;
     object.position.z = -this._center.z;
-    object.position.y = -this._boundingBox.min.y;
+    object.position.y = this._size.y / 2;
   }
 
@@ -951,15 +955,12 @@ export class Viewer {
     };
   }
 
-  /** Ajusta escala do GLB de catálogo. manualPosition: NÃO recentrar (preserva posição do grupo). */
+  /** Ajusta escala do GLB de catálogo e normaliza pivot (base no chão, centro XZ). Grupo não é movido. */
   private applyCatalogModelScale(
-    entry: { width: number; height: number; depth: number; manualPosition?: boolean },
+    entry: { width: number; height: number; depth: number },
     object: THREE.Object3D
   ): void {
     const base = object.userData.glbBaseSize as { x: number; y: number; z: number } | undefined;
     if (!base) return;
     const sx = entry.width / Math.max(base.x, 0.001);
     const sy = entry.height / Math.max(base.y, 0.001);
     const sz = entry.depth / Math.max(base.z, 0.001);
     object.scale.set(sx, sy, sz);
-    if (!entry.manualPosition) {
-      this.centerObjectInGroup(object);
-    }
+    this.centerObjectInGroup(object);
   }
 
   removeModelFromBox(boxId: string, modelId: string): boolean {
@@ -911,8 +914,7 @@ export class Viewer {
             this.applyCatalogModelScale(entry, object);
           }
         } else if (entry.cadOnly) {
-          if (!entry.manualPosition) {
-            this.centerObjectInGroup(object);
-          }
+          this.centerObjectInGroup(object);
         } else {
           object.position.set(0, entry.height / 2, 0);
         }
```
