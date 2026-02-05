# Catálogo – Grupo (entry.mesh) nunca reposicionado

## 1. Ficheiros modificados

- **`src/3d/core/Viewer.ts`**
- **`docs/CATALOGO_GRUPO_NUNCA_REPOSICIONAR.md`** (este ficheiro)

---

## 2. Impacto

| Alteração | Impacto |
|-----------|---------|
| **addBox: não chamar reflowBoxes quando manualPosition** | Após adicionar uma caixa com `manualPosition === true`, o Viewer **não** chama `reflowBoxes()`. Assim, a posição do grupo (entry.mesh) definida em addBox (X = rightmost + 0.1, Y = altura/2, Z = 0) **nunca** é sobrescrita por reflow. Só se chama reflowBoxes quando `!manualPosition` (caixas paramétricas). |
| **addBox: manualPositionLock no mesh** | Quando `manualPosition === true`, define-se `box.userData.manualPositionLock = true`. reflowBoxes e qualquer lógica futura podem usar este flag para nunca alterar a posição do grupo. |
| **reflowBoxes: guard duplo** | Só se altera `entry.mesh.position.x/z` quando `entry.manualPosition !== true` **e** `entry.mesh.userData.manualPositionLock !== true`. Comentário explícito: nunca alterar position para Catálogo e caixas com posição do ProjectProvider. |
| **updateBox: bloco de posição explícito para manualPosition** | Quando `entry.manualPosition === true`, só se faz `entry.mesh.position.set(...)` se existir `opts.position`; não há ramo que aplique height/2 ou reflow. Quando `manualPosition !== true`, mantém-se o comportamento anterior (opts.position ou height/2). |
| **updateBox: dimensionsChanged** | `entry.mesh.position.y = height/2` só quando `entry.cadOnly && entry.manualPosition !== true`. |
| **updateBox: propagar manualPositionLock** | Quando `opts.manualPosition !== undefined`, define-se `entry.mesh.userData.manualPositionLock = (opts.manualPosition === true)`. |

Com isto:

- Nenhuma linha no Viewer altera `entry.mesh.position` durante ou após o carregamento do modelo do Catálogo quando `manualPosition === true`, exceto a atribuição inicial em addBox e a aplicação explícita de `opts.position` em updateBox.
- A posição do grupo é exactamente a do ProjectProvider (X = rightmost + 0.1 m, Y = altura/2, Z = 0) e não é alterada por reflow, updateBox sem position, clampTransform na criação, nem por centerObject (que só mexe no filho).
- Modelos do Catálogo não nascem no centro, não nascem dentro de outros e `manualPosition === true` impede qualquer recálculo posterior da posição do grupo.

---

## 3. Diff completo

```diff
--- a/src/3d/core/Viewer.ts
+++ b/src/3d/core/Viewer.ts
@@ -614,6 +614,9 @@ export class Viewer {
 
     box.frustumCulled = false;
     box.userData.boxId = id;
+    if (manualPosition) {
+      box.userData.manualPositionLock = true;
+    }
     const baseY = height / 2;
     // Posição inicial aplicada IMEDIATAMENTE; sem recenter, clamp, colisão nem bbox antes.
     const position =
@@ -630,8 +633,9 @@ export class Viewer {
       material,
     });
     this.sceneManager.add(box);
-    // reflowBoxes não altera caixas com manualPosition; clampTransform só em objectChange (arraste).
-    this.reflowBoxes();
+    if (!manualPosition) {
+      this.reflowBoxes();
+    }
     this.updateCameraTarget();
     return true;
   }
@@ -702,7 +706,7 @@ export class Viewer {
         depth = updated.depth;
       }
-      if (entry.cadOnly && !entry.manualPosition) {
+      if (entry.cadOnly && entry.manualPosition !== true) {
         entry.mesh.position.y = height / 2;
       }
     }
@@ -714,11 +718,15 @@ export class Viewer {
     if (opts.materialName && !entry.cadOnly) {
       this.updateBoxMaterial(id, opts.materialName);
     }
-    if (entry.manualPosition && !opts.position) {
-      // Nunca alterar position.x/y/z quando manualPosition sem opts.position explícito.
-    } else if (opts.position) {
-      entry.mesh.position.set(opts.position.x, opts.position.y, opts.position.z);
-    } else if (!entry.manualPosition) {
-      entry.mesh.position.y = height / 2;
+    if (entry.manualPosition === true) {
+      if (opts.position) {
+        entry.mesh.position.set(opts.position.x, opts.position.y, opts.position.z);
+      }
+    } else {
+      if (opts.position) {
+        entry.mesh.position.set(opts.position.x, opts.position.y, opts.position.z);
+      } else {
+        entry.mesh.position.y = height / 2;
+      }
     }
     if (opts.rotationY != null && Number.isFinite(opts.rotationY)) {
       entry.mesh.rotation.y = opts.rotationY;
     }
     if (opts.manualPosition !== undefined) {
       entry.manualPosition = opts.manualPosition;
+      entry.mesh.userData.manualPositionLock = opts.manualPosition === true;
     }
     entry.mesh.updateMatrixWorld();
@@ -1070,7 +1078,7 @@ export class Viewer {
       }
       entry.mesh.frustumCulled = false;
-      if (entry.manualPosition) {
-        // Nunca alterar position: caixa posicionada pelo ProjectProvider (rightmost + 0.1, Y=altura/2, Z=0).
+      if (entry.manualPosition === true || entry.mesh.userData.manualPositionLock === true) {
+        // NUNCA alterar entry.mesh.position: Catálogo e outras caixas com posição do ProjectProvider.
       } else {
         entry.mesh.position.x = cursorX + w / 2;
         entry.mesh.position.z = 0;
```

(Ver `git diff -- src/3d/core/Viewer.ts` no repositório para o diff integral.)
