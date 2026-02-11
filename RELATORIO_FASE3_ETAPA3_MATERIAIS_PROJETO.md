# Relatório — FASE 3 Etapa 3: Integração Materiais CRUD com o Nível de Projeto

**Data:** 11 de fevereiro de 2025  
**Objetivo:** Integrar o sistema de Materiais (CRUD) com o nível de projeto: `project.materialId`, material padrão, propagação opcional para caixas e UI em modo só leitura.

---

## 1. Como project.materialId foi integrado

- **ProjectState** passou a ter o campo opcional **`materialId?: string`** (`src/context/projectTypes.ts`), que referencia o id de um material no CRUD. Quando vazio (`""` ou `undefined`), a resolução do material usa **`project.material.tipo`** (legado).
- **project.material** foi mantido apenas para **compatibilidade**: não é mais a fonte principal; a fonte principal é **`project.materialId`**. O tipo e comentários indicam que `material` é legado.
- **Estado inicial (novo projeto):** em **`defaultState`** (`projectState.ts`) foi definido **`materialId: ""`**. Assim, novos projetos usam o fallback `project.material.tipo` (ex.: "MDF Branco") até ser definido um material do CRUD.
- **Projetos antigos (restore):** em **`reviveState`** (`ProjectProvider.tsx`), ao restaurar um snapshot:
  - Se o snapshot já tiver **`materialId`**, esse valor é usado.
  - Se não tiver (projeto antigo) e existir **`material.tipo`**, é usada **`getMaterialByIdOrLabel(restored.material.tipo)`**: se existir um material no CRUD com esse id/label, **`materialId`** fica com **`m.id`**; caso contrário **`materialId`** fica **`""`**. Assim, projetos antigos ganham um `materialId` coerente com o CRUD quando há correspondência, sem quebrar os que não têm.
- **Persistência:** o snapshot do projeto (autosave e lista de projetos) continua a serializar o estado com **`serializeState`**; como **`materialId`** faz parte de **ProjectState**, é guardado e restaurado normalmente.

---

## 2. Material padrão do projeto e setProjectMaterial

- **Ação** **`setProjectMaterial(materialId: string)`** foi adicionada a **ProjectActions** e implementada em **ProjectProvider**:
  - Atualiza o estado do projeto com o novo **`materialId`**.
  - **Propagação para caixas:** percorre **`workspaceBoxes`** e, para cada caixa em que **`box.material`** é `undefined`, `null` ou igual ao **materialId anterior** do projeto, atualiza **`box.material`** para o novo **`materialId`**. Caixas com material próprio (outro id) não são alteradas.
  - O estado é atualizado com **`recomputeState(prev, { materialId, workspaceBoxes }, true)`**, e o **useCalculadoraSync** reage às alterações de **boxes** e **project.materialId**, enviando ao Viewer o **materialName** correto para cada caixa (incluindo as que passaram a usar o novo material do projeto).

---

## 3. Como caixas herdaram o material padrão

- **Regra:** uma caixa “usa o material padrão” quando **`box.material`** está vazio (`undefined`/`null`) ou é igual ao **materialId** anterior do projeto.
- **Ao chamar** **`setProjectMaterial(novoMaterialId)`**:
  1. **prevMaterialId** = `project.materialId ?? ""`.
  2. **workspaceBoxes** é recalculado: para cada caixa, se `box.material === undefined || box.material === null || box.material === prevMaterialId`, então **`box.material`** passa a **`novoMaterialId`**; as restantes mantêm-se.
  3. O estado é atualizado com o novo **`materialId`** e o novo **`workspaceBoxes`**.
- **Sincronização com o Viewer:** o **useCalculadoraSync** usa **`box.material ?? projectMaterialId ?? materialName ?? "MDF Branco"`** e **`getViewerMaterialId(...)`** para obter o **materialName** a enviar. Assim, as caixas que passaram a ter **`box.material = novoMaterialId`** recebem no Viewer **`viewerApi.updateBox(boxId, { materialName: getViewerMaterialId(novoMaterialId) })`** no próximo ciclo de sincronização, sem alterar MaterialLibrary nem WoodMaterial.

---

## 4. Como o Viewer foi atualizado

- **MaterialLibrary** e **WoodMaterial** não foram alterados.
- O Viewer continua a receber apenas **`materialName`** (string) em **`updateBox(id, { materialName })`**.
- **useCalculadoraSync** passou a receber **`projectMaterialId`** (opcional) e a usar:
  - **`effectiveMaterial = box.material ?? projectMaterialId ?? materialName ?? "MDF Branco"`**
  - **`resolvedMaterialName = getViewerMaterialId(effectiveMaterial)`**
- Assim, quando **project.materialId** muda e as caixas que usam o padrão são atualizadas (com **`box.material`** = novo id), o efeito do **useCalculadoraSync** corre de novo e cada uma dessas caixas recebe **`materialName: getViewerMaterialId(novoMaterialId)`**, atualizando a aparência no Viewer.

---

## 5. UI: material do projeto (somente leitura)

- **Quando nenhuma caixa está selecionada**, no painel esquerdo (tab Início) foi adicionado o painel **“Material do projeto”** com a descrição **“Material padrão (somente leitura)”**.
- O valor mostrado é:
  - Se **`project.materialId`** estiver definido: **`getMaterialByIdOrLabel(project.materialId)?.label ?? project.material.tipo`**
  - Caso contrário: **`project.material.tipo`**
- Assim, o utilizador vê sempre um rótulo legível (do CRUD ou legado), em modo só leitura. Admin → Materials e o resto do Workspace não foram alterados além desta adição.

---

## 6. Ficheiros alterados

| Ficheiro | Alteração |
|----------|-----------|
| **`src/context/projectTypes.ts`** | Em **ProjectState** adicionado **`materialId?: string`** (comentários a indicar material legado vs fonte principal). Em **ProjectActions** adicionada **`setProjectMaterial: (materialId: string) => void`**. |
| **`src/context/projectState.ts`** | Em **defaultState** adicionado **`materialId: ""`**. |
| **`src/context/ProjectProvider.tsx`** | Import de **getMaterialByIdOrLabel**. Em **reviveState**, cálculo de **materialId** a partir de **restored.materialId** ou de **getMaterialByIdOrLabel(restored.material?.tipo)?.id ?? ""**. Implementação de **setProjectMaterial(materialId)** com atualização de **materialId** e propagação às caixas que usam o material padrão. |
| **`src/hooks/useCalculadoraSync.ts`** | Novo parâmetro **`projectMaterialId?: string`**; **projectMaterialIdRef** para uso estável no callback; **effectiveMaterial = box.material ?? projectMaterialIdRef.current ?? materialName ?? "MDF Branco"** e **resolvedMaterialName = getViewerMaterialId(effectiveMaterial)**. |
| **`src/core/multibox/multiBoxManager.ts`** | Chamada a **useCalculadoraSync** passando **project.materialId** como último argumento. |
| **`src/components/layout/left-panel/LeftPanel.tsx`** | Import de **getMaterialByIdOrLabel**. Quando **!selectedBox**, novo painel **“Material do projeto”** (somente leitura) com o rótulo derivado de **project.materialId** ou **project.material.tipo**. |

**Não alterados (conforme pedido):** Materiais & Fabricação, PDF/CNC/cutlist, MaterialLibrary, WoodMaterial.

---

## 7. Confirmação de que tudo funciona

- **Build:** `npm run build` concluído com sucesso.
- **Projetos antigos:** ao carregar um projeto sem **materialId**, **reviveState** deriva **materialId** a partir de **material.tipo** quando há correspondência no CRUD; caso contrário **materialId** fica **""** e o comportamento mantém-se (uso de **material.tipo**).
- **Novos projetos:** **materialId** inicia em **""**; o material efetivo vem de **project.material.tipo** e o Viewer recebe o **materialName** correto via **getViewerMaterialId**.
- **setProjectMaterial:** ao mudar o material do projeto, apenas as caixas que usam o padrão são atualizadas; as outras mantêm o material próprio; o Viewer reflete a mudança na próxima sincronização.
- **UI:** com nenhuma caixa selecionada, o painel “Material do projeto” mostra o rótulo correto (CRUD ou legado), em somente leitura.

A integração do material do projeto com o CRUD e com as caixas está implementada e operacional, sem alterar Materiais & Fabricação, PDF/CNC/cutlist ou MaterialLibrary/WoodMaterial, e sem quebrar projetos antigos.
