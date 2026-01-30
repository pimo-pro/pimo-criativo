# Painel de Referência: Smart Layout Engine & Auto-Placement (Fase 5)

Documento de referência do sistema de layout inteligente, auto-posicionamento e controlo de modelos GLB dentro da caixa.

---

## 1. Objetivos da Fase 5

- **Aplicar auto-positioning no Viewer**: ao adicionar um modelo, aplicar automaticamente a posição calculada; snapping real (grid configurável); atualização sem flicker.
- **Deteção de colisões e limites**: impedir modelos fora dos limites da caixa e sobreposição; mostrar avisos na UI.
- **Smart Arrangement**: funções para organizar automaticamente prateleiras, gavetas, portas, acessórios; botão "Auto-Organizar" no painel esquerdo.
- **UI para controlo de layout**: Auto-Organizar, Snap to Grid, Reset Position; posição atual do modelo (x, y, z).

---

## 2. Estrutura do módulo `src/core/layout/`

| Ficheiro | Descrição |
|----------|-----------|
| `viewerLayoutAdapter.ts` | Conversão entre Viewer (metros, origem no centro da caixa) e posicionamento (mm, origem no canto). `boxDimsToBoundsMm`, `toPlacedModelMm`, `positionMmToLocalM`, `computeAutoPositionLocal`. |
| `layoutWarnings.ts` | Deteção de colisões e fora dos limites: `computeLayoutWarnings(boxId, boxDimsM, positionsAndSizes)` → `LayoutWarnings` (collisions, outOfBounds). |
| `smartArrange.ts` | Organização automática por categoria: `autoArrangeModels(boxDimsM, models)` → posições em espaço local (m). Ordem: estrutura, gavetas, portas, acessórios, decoração. |
| `index.ts` | Re-exportação. |

---

## 3. Viewer (src/3d/core/Viewer.ts)

Novos métodos públicos:

- **getBoxDimensions(boxId)** → `{ width, height, depth }` em metros.
- **getModelPosition(boxId, modelId)** → posição em espaço local da caixa (m).
- **getModelBoundingBoxSize(boxId, modelId)** → tamanho do bbox em metros.
- **setModelPosition(boxId, modelId, position)** → define posição em espaço local (m).

O Viewer usa espaço local da caixa com **origem no centro** da caixa; o módulo de posicionamento usa **mm com origem no canto** (0,0,0). O adaptador faz a conversão.

---

## 4. Fluxo de auto-posicionamento ao adicionar modelo

```
addModelToBox(boxId, url, instanceId)
    → load GLB
    → onModelLoaded(boxId, instanceId, object)
    → extractPartsFromGLB, setExtractedPartsForBox
    → getBoxDimensions(boxId)
    → listModels(boxId), para cada outro modelo: getModelPosition, getModelBoundingBoxSize
    → toPlacedModelMm (outros) + bbox do object (novo) → modelSizeMm
    → computeAutoPositionLocal(boxDims, placedModels, modelId, modelSizeMm, instanceId)
    → positionMmToLocalM(result.positionMm, boxDims)
    → setModelPosition(viewer) + setModelPositionInBox(state)
```

---

## 5. Estado do projeto

- **modelPositionsByBoxId**: `Record<boxId, Record<modelInstanceId, { x, y, z }>>` — posições em espaço local da caixa (m). Atualizado ao aplicar auto-position, Snap to Grid, Reset, Auto-Organizar.
- **layoutWarnings**: `{ collisions: LayoutCollision[], outOfBounds: LayoutOutOfBounds[] }` — calculado em `buildDesignState` via `computeLayoutWarningsFromState(prev)`.

Ações:

- **setModelPositionInBox(boxId, modelInstanceId, position)** — atualiza posição no estado e recalcula design (inclui layoutWarnings).
- **setLayoutWarnings(warnings)** — define avisos manualmente (opcional).

---

## 6. UI

- **Painel Modelos** (tab «Modelos» na sidebar esquerda): secção "Layout" (quando há modelos na caixa) com posição (x, y, z) do modelo selecionado (m) e botões **Auto-Organizar**, **Snap to Grid**, **Reset Position**.
- **LayoutWarningsAlert**: avisos de colisão e modelos fora dos limites (por caixa), exibidos no painel Modelos.

---

## 7. Funções principais

| Função | Módulo | Descrição |
|--------|--------|-----------|
| `getBoxDimensions(boxId)` | Viewer | Dimensões da caixa em m. |
| `getModelPosition(boxId, modelId)` | Viewer | Posição do modelo (box local, m). |
| `getModelBoundingBoxSize(boxId, modelId)` | Viewer | Tamanho do bbox em m. |
| `setModelPosition(boxId, modelId, position)` | Viewer | Define posição (box local, m). |
| `computeAutoPositionLocal(...)` | core/layout | Próxima posição automática; devolve resultado em mm (conversão para local no caller). |
| `positionMmToLocalM(positionMm, boxDimsM)` | core/layout | Converte centro em mm (canto) → local m (centro). |
| `computeLayoutWarnings(boxId, boxDimsM, positionsAndSizes)` | core/layout | Colisões e out-of-bounds. |
| `computeLayoutWarningsFromState(prev)` | projectState | Avisos a partir do estado. |
| `autoArrangeModels(boxDimsM, models)` | core/layout | Posições automáticas por categoria. |
| `snapPosition(positionMm, modelId)` | core/rules | Snapping ao grid (regras do modelo). |

---

## 8. Requisitos cumpridos

- Reutilização do módulo de regras e do módulo de posicionamento (`computeAutoPosition`, `snapPosition`, `boxesOverlap`).
- Código modular (layout em `core/layout/`, viewer apenas com API de posição/tamanho).
- Viewer atualizado de forma previsível (posição definida após load; estado sincronizado com `setModelPositionInBox`).
