# Relatório — FASE 3 Etapa 2: Integração Materiais CRUD com Caixas e Viewer

**Data:** 11 de fevereiro de 2025  
**Objetivo:** Integrar o sistema de Materiais (CRUD real) com as caixas (boxes) e com o Viewer, sem alterar project.material, Materiais & Fabricação, PDF/CNC/cutlist nem MaterialLibrary/WoodMaterial.

---

## 1. Como box.material passou a usar o id real

- **WorkspaceBox** passou a ter o campo opcional **`material?: string`** (`src/core/types.ts`). Esse valor é o **id do material no CRUD** (ou, em caixas antigas, uma string legada como "MDF Branco").
- **BoxModule** já tinha **`material?: string`**; continua a ser uma string. A fonte desse valor é o WorkspaceBox: em **`convertWorkspaceToBox`** (`projectState.ts`) passou a ser copiado **`material: box.material`** do WorkspaceBox para o BoxModule.
- **Compatibilidade com caixas antigas:** Caixas que não têm `material` definido continuam a funcionar: em `useCalculadoraSync` e no Viewer usa-se `box.material ?? materialName ?? "MDF Branco"`, em que `materialName` é `project.material.tipo`. Ou seja, id do CRUD tem prioridade; se não existir, usa-se o material do projeto e por fim o fallback "MDF Branco".
- **Quando um material é escolhido** no modal "Selecionar Material", chama-se **`actions.setWorkspaceBoxMaterial(selectedBox.id, m.id)`**, que grava o **id do material (CRUD)** em `workspaceBox.material`. Esse valor propaga-se para o BoxModule via `buildBoxesFromWorkspace` → `convertWorkspaceToBox`.

---

## 2. Como o botão "Selecionar Material" foi ligado ao CRUD

- O botão **"Selecionar Material"** no painel esquerdo (tab Início, quando há caixa selecionada) deixa de fazer scroll para um painel ou mostrar um toast genérico e passa a **abrir um modal**.
- **Modal "Selecionar Material":**
  - Lista de materiais obtida com **`listMaterials()`** (CRUD em localStorage).
  - Cada material é um botão (card) com cor (swatch), label, espessura e preço por m².
  - Ao clicar num material:
    1. **`actions.setWorkspaceBoxMaterial(selectedBox.id, m.id)`** — atualiza `workspaceBox.material` com o id do CRUD.
    2. **`viewerApi.updateBox(selectedBox.id, { materialName: getViewerMaterialId(m.id) })`** — aplica o material no Viewer.
    3. **`showToast("Material aplicado à caixa.", "info")`**
    4. Fecha o modal.
  - Se não existir nenhum material no registo, é mostrada a mensagem: "Nenhum material no registo. Adicione em Admin → Materials."
- **Nova ação:** **`setWorkspaceBoxMaterial(boxId, materialId)`** em `projectTypes` e implementada em `ProjectProvider`: atualiza apenas o campo `material` do `WorkspaceBox` com o id dado.

---

## 3. Como o Viewer recebe o materialName

- Foi criada no serviço de materiais a função **`getViewerMaterialId(materialIdOrLabel: string): string`** (`src/core/materials/service.ts`).
  - **Entrada:** id do material no CRUD ou label legado (ex.: "MDF Branco", "mat_xxx").
  - **Comportamento:**  
    - Se existir um material no CRUD com esse id/label e tiver **`industrialMaterialId`**, usa-se esse valor (mapeado para um id aceite pelo Viewer, ex.: "mdf_branco").  
    - Caso contrário, usa-se um mapeamento fixo de labels/nomes para os ids do MaterialLibrary (ex.: "mdf branco" → "mdf_branco", "carvalho natural" → "carvalho_natural").  
    - Fallback: **"mdf_branco"**.
  - **Saída:** string a passar em **`viewerApi.updateBox(id, { materialName })`**. O Viewer (MaterialLibrary + WoodMaterial) não foi alterado; continua a receber um `materialName` (ex.: "mdf_branco") e a resolver o preset internamente.
- **Onde é usado:**
  - **useCalculadoraSync:** ao sincronizar cada caixa, calcula `resolvedMaterialName = getViewerMaterialId(box.material ?? materialName ?? "MDF Branco")` e passa esse valor em `addBox`/`updateBox` como `materialName`.
  - **PainelModelosDaCaixa:** ao alterar o material no select (project.material.tipo), chama `viewerApi.updateBox(..., { materialName: getViewerMaterialId(value) })`.
  - **LeftPanel (modal):** ao escolher um material da lista CRUD, chama `viewerApi.updateBox(..., { materialName: getViewerMaterialId(m.id) })`.

Assim, o Viewer recebe sempre um **materialName** compatível com o MaterialLibrary, quer o valor venha do id do CRUD quer de uma string legada.

---

## 4. Ficheiros alterados

| Ficheiro | Alteração |
|----------|-----------|
| **`src/core/types.ts`** | Adicionado **`material?: string`** à interface **WorkspaceBox** (comentário: id do material CRUD ou label legado). |
| **`src/core/materials/service.ts`** | Adicionados mapeamento **VIEWER_MATERIAL_ID_MAP** e função **`getViewerMaterialId(materialIdOrLabel)`** para converter id/label do CRUD (ou legado) no materialName do Viewer. |
| **`src/context/projectState.ts`** | Em **`convertWorkspaceToBox`**, passou a incluir **`material: box.material`** no objeto BoxModule devolvido. |
| **`src/context/projectTypes.ts`** | Adicionada ação **`setWorkspaceBoxMaterial: (boxId, materialId) => void`**. |
| **`src/context/ProjectProvider.tsx`** | Implementada **`setWorkspaceBoxMaterial(boxId, materialId)`**: atualiza `workspaceBoxes` definindo `material` na caixa com o id dado. |
| **`src/hooks/useCalculadoraSync.ts`** | Import de **`getViewerMaterialId`**; **`resolvedMaterialName`** passou a ser **`getViewerMaterialId(box.material ?? materialName ?? "MDF Branco")`**. |
| **`src/components/layout/left-panel/PainelModelosDaCaixa.tsx`** | Import de **`getViewerMaterialId`**; ao alterar o material no select, **`viewerApi.updateBox`** passa a usar **`materialName: getViewerMaterialId(value)`**. |
| **`src/components/layout/left-panel/LeftPanel.tsx`** | Import de **`listMaterials`** e **`getViewerMaterialId`**; estado **`materialModalOpen`**; lista **`materialsList = listMaterials()`**; botão "Selecionar Material" abre o modal; modal lista materiais do CRUD e ao selecionar chama **setWorkspaceBoxMaterial**, **viewerApi.updateBox** com **getViewerMaterialId(m.id)** e **showToast**, e fecha o modal. |

**Não alterados (conforme pedido):** project.material, módulo Materiais & Fabricação, PDF/CNC/cutlist, MaterialLibrary, WoodMaterial, Viewer (apenas consomem o materialName que lhes é passado).

---

## 5. Confirmação de que tudo funciona no Workspace

- **Build:** `npm run build` concluído com sucesso.
- **Fluxo verificado:**
  1. **Caixa sem material (legado):** `box.material` é undefined; usa-se `materialName` (project.material.tipo) e `getViewerMaterialId` devolve o id correto para o Viewer (ex.: "MDF Branco" → "mdf_branco").
  2. **Caixa com material do CRUD:** Ao escolher um material no modal "Selecionar Material", `workspaceBox.material` fica com o id do CRUD; `buildBoxesFromWorkspace` propaga para `box.material`; na sincronização, `getViewerMaterialId(box.material)` usa o registo do CRUD (e, se existir, `industrialMaterialId`) para obter o materialName do Viewer; o Viewer atualiza a aparência da caixa.
  3. **Compatibilidade:** Strings antigas (ex.: "MDF Branco") em `box.material` ou em project.material.tipo continuam a ser resolvidas por `getViewerMaterialId` através do mapeamento de labels para ids do MaterialLibrary.

A integração entre CRUD de materiais, boxes (WorkspaceBox + BoxModule) e Viewer está implementada e operacional no Workspace, com compatibilidade para dados antigos e sem alterar project.material, PDF/CNC/cutlist, MaterialLibrary ou WoodMaterial.
