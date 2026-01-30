# Painel de Referência: Multi-Model & Multi-Box Expansion (Fase 3)

Documento de referência com a arquitetura da Fase 3: múltiplos modelos GLB por caixa, categorias CAD e gestão avançada.

---

## 1. Objetivos da Fase 3

- **Múltiplos modelos GLB por caixa**: cada `WorkspaceBox` tem um array `models[]` de instâncias de modelos.
- **Viewer**: carrega e renderiza todos os modelos associados a cada Box (sincronizado por `useCadModelsSync`).
- **Peças extraídas**: `extractedPartsByBoxId[boxId][modelInstanceId]` — estrutura aninhada por caixa e por instância de modelo.
- **Categorias CAD**: portas, gavetas, acessórios, estrutura, decoração (`src/core/cad/categories.ts`).
- **UI**: listar modelos por caixa; adicionar, remover, renomear, alterar material e categoria; filtro por categoria ao adicionar.
- **Lista de peças**: distinção paramétrico vs GLB importado (`sourceType`); agrupamento por caixa e por modelo; preço total considera todos os modelos.

---

## 2. Estruturas e tipos

### 2.1 `BoxModelInstance` (core/types.ts)

- **id**: string — ID único da instância (ex.: `box-1-model-1738234567890`).
- **modelId**: string — Referência ao `CadModel` no catálogo.
- **nome?**: string — Nome de exibição (override do catálogo).
- **material?**: string — Material aplicado a esta instância.
- **categoria?**: string — Categoria (override do catálogo).

### 2.2 `WorkspaceBox` e `BoxModule`

- **models: BoxModelInstance[]** — substitui o antigo `modelId: string | null`.
- Cada caixa pode ter zero ou mais modelos GLB associados.

### 2.3 `extractedPartsByBoxId`

- **Tipo**: `Record<string, Record<string, CutListItemComPreco[]>>`.
- **Significado**: `extractedPartsByBoxId[boxId][modelInstanceId]` = peças extraídas desse modelo nessa caixa.
- Merge em `buildDesignState`: para a caixa selecionada, junta todas as peças paramétricas com `Object.values(extractedPartsByBoxId[boxId]).flat()`.

### 2.4 `CutListItem` / `CutListItemComPreco`

- **sourceType?**: `"parametric" | "glb_importado"` — permite distinguir na UI.
- **modelInstanceId?**: string — quando `sourceType === "glb_importado"`.
- **boxId?**: string — para agrupamento.

### 2.5 Categorias CAD (`src/core/cad/categories.ts`)

- **CadModelCategoryId**: `"portas" | "gavetas" | "acessorios" | "estrutura" | "decoracao"`.
- **CATEGORIAS_CAD**: array de `{ id, nome, descricao? }`.
- **getCategoriaById**, **getCategoriaNome**: helpers.

---

## 3. Fluxo multi-model

1. **Adicionar modelo**: `actions.addModelToBox(caixaId, cadModelId)` → cria `BoxModelInstance`, adiciona a `box.models` → `useCadModelsSync` chama `viewerApi.addModelToBox(boxId, url, instance.id)` → ao carregar, `onModelLoaded(boxId, modelInstanceId, object)` → extração → `setExtractedPartsForBox(boxId, modelInstanceId, parts)`.
2. **Remover modelo**: `actions.removeModelFromBox(caixaId, instanceId)` → remove de `box.models`, limpa `extractedPartsByBoxId[caixaId][instanceId]` → sync remove do viewer.
3. **Atualizar modelo**: `actions.updateModelInBox(caixaId, instanceId, { nome?, material?, categoria? })` → atualiza a instância em `box.models`; peças extraídas mantêm-se (reextração só ao recarregar).
4. **Sincronização Viewer**: `useCadModelsSync(workspaceBoxes, viewerApi)` — para cada caixa, adiciona ao viewer os modelos em `box.models` que ainda não estão, remove os que já não estão em `box.models`.

---

## 4. Ações do projeto (ProjectProvider)

| Ação | Descrição |
|------|-----------|
| **addModelToBox(caixaId, cadModelId)** | Cria instância, adiciona a `box.models`; sync adiciona ao viewer. |
| **removeModelFromBox(caixaId, modelInstanceId)** | Remove instância, limpa peças extraídas desse modelo, sync remove do viewer. |
| **updateModelInBox(caixaId, modelInstanceId, updates)** | Atualiza nome, material ou categoria da instância. |
| **setExtractedPartsForBox(boxId, modelInstanceId, parts)** | Regista peças extraídas desse modelo nessa caixa. |
| **clearExtractedPartsForBox(boxId, modelInstanceId?)** | Limpa peças extraídas (de um modelo ou de toda a caixa). |
| **selectModelInstance(boxId, modelInstanceId)** | Define o modelo selecionado para edição (e URL para preview). |
| **updateCaixaModelId(caixaId, modelId)** | (Legado) Se modelId: adiciona um modelo; se null: remove todos os modelos da caixa. |

---

## 5. UI (LeftPanel)

- **Modelos GLB na caixa**: lista de instâncias na caixa selecionada.
- **Filtrar por categoria**: select para filtrar o catálogo ao adicionar.
- **Adicionar modelo**: select do catálogo (filtrado); ao escolher, `addModelToBox(selectedCaixaId, cadModelId)`.
- Por instância: **nome** (editável), **material** (select), **categoria** (select), **Remover** (removeModelFromBox).

---

## 6. Lista de peças e Calculator

- **CutListView**: por caixa, mostra peças paramétricas + peças extraídas (`cutlistComPrecoFromBox(box)` + `Object.values(extractedPartsByBoxId[box.id]).flat()`).
- **CutListTable**: lista global com coluna **Origem** (badge "Param." ou "GLB").
- **RightToolsBar** e totais: cut list inclui paramétrico + extraído de todas as caixas; preço total considera múltiplos modelos por caixa.

---

## 7. Migração de estado antigo

- **reviveState**: se `workspaceBoxes[].modelId` existir, converte para `models: [{ id: \`${box.id}-model-1\`, modelId }]`.
- **extractedPartsByBoxId**: se valor por box for array (formato antigo), converte para `{ default: array }`.

---

## 8. Fase no Roadmap

- Nova fase: **"Multi-Model & Multi-Box Expansion"** em `src/core/docs/projectRoadmap.ts`.
