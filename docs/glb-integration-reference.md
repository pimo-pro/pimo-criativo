# Painel de Referência: Integração GLB → Sistema Multi-Box

Documento de referência com decisões, estruturas e funções da integração de modelos GLB (cadModels) com o ThreeViewer, Lista de Peças e Calculator.

---

## 1. Análise do sistema anterior

- **Carregamento GLB**: Existia apenas no Viewer (`loadModelObject`, `addModelToBox`): carregava GLB/GLTF/OBJ/STL e adicionava o objeto como filho da caixa. Sem extração de peças.
- **cadModels**: Armazenamento em localStorage (`pimo_admin_cad_models`) de `CadModel` (id, nome, categoria, descricao, arquivo). Usado pelo LeftPanel para escolher modelo e chamar `addModelToBox`.
- **Lista de peças**: Gerada apenas a partir de caixas paramétricas (`BoxModule` → `boxManufacturing` → `cutlistFromBoxes`). Não havia fluxo de peças a partir de modelos importados.
- **Decisão**: Foi criado um **módulo novo e unificado** (`src/core/glb/`) para o pipeline GLB → extração → cut list. O código antigo de carregamento no Viewer foi **mantido e estendido** (callback `onModelLoaded`), sem duplicação.

---

## 2. Pipeline oficial

```
GLB (cadModels) → ThreeViewer (load + addModelToBox)
                        ↓
              setOnModelLoaded(boxId, modelId, object)
                        ↓
              extractPartsFromGLB(object)  →  ExtractedPart[]
                        ↓
              glbPartsToCutListItems(parts, boxId, material, espessura)  →  CutListItem[]
                        ↓
              calcularPrecoCutList(items)  →  CutListItemComPreco[]
                        ↓
              setExtractedPartsForBox(boxId, modelInstanceId, withPreco)
                        ↓
              buildDesignState (merge paramétrico + extraído)  →  cutListComPreco, precoTotalPecas
```

---

## 3. Estruturas e tipos

### 3.1 `src/core/glb/types.ts`

- **ExtractedPart**: Peça extraída de um mesh GLTF.
  - `id`, `nome`, `dimensoes` (largura, altura, profundidade em mm), `espessura` (mm), `posicao` (mm), `rotacao` (radianos), `materialHint` (opcional).

### 3.2 `src/core/glb/extractPartsFromGLB.ts`

- **extractPartsFromGLB(gltfScene: THREE.Object3D): ExtractedPart[]**
  - Percorre a cena com `traverse`; para cada `THREE.Mesh` com geometria:
  - Calcula bounding box em mundo (`Box3().setFromObject(mesh)`).
  - Converte dimensões e posição de metros para mm (`mToMm`).
  - Espessura = menor dimensão do bbox.
  - Material hint = nome do material ou cor hexadecimal.

### 3.3 `src/core/glb/glbPartsToCutList.ts`

- **glbPartsToCutListItems(parts, boxId, defaultMaterial?, defaultEspessuraMm?): CutListItem[]**
  - Converte cada `ExtractedPart` em `CutListItem` com `tipo: "glb_importado"`.
  - Usa material e espessura padrão do projeto quando não há hint.

### 3.4 Estado do projeto (`projectTypes.ts`)

- **extractedPartsByBoxId: Record<string, Record<string, CutListItemComPreco[]>>**
  - Peças extraídas por caixa e por modelo: `boxId` → `modelInstanceId` → itens com preço.
  - Merge em `buildDesignState`: `extractedParts = Object.values(extractedPartsByBoxId[selectedBox.id]).flat()`; `cutListComPreco = parametric + extractedParts`.

### 3.5 Viewer (`src/3d/core/Viewer.ts`)

- **setOnModelLoaded(callback | null)**
  - Callback chamado quando um modelo é carregado em `addModelToBox`: `(boxId, modelId, object) => void`.
  - Permite à aplicação extrair peças e atualizar estado sem duplicar lógica de load.

---

## 4. Funções principais

| Função | Módulo | Descrição |
|--------|--------|-----------|
| `extractPartsFromGLB(gltfScene)` | `core/glb` | Extrai meshes da cena → `ExtractedPart[]` (bbox, posição, rotação, material hint). |
| `glbPartsToCutListItems(parts, boxId, modelInstanceId, material?, espessura?)` | `core/glb` | Adapta peças extraídas → `CutListItem[]` (com sourceType e modelInstanceId). |
| `calcularPrecoCutList(cutList)` | `core/pricing` | Calcula preço por peça → `CutListItemComPreco[]`. |
| `setExtractedPartsForBox(boxId, modelInstanceId, parts)` | ProjectProvider | Regista peças extraídas desse modelo nessa caixa. |
| `clearExtractedPartsForBox(boxId, modelInstanceId?)` | ProjectProvider | Remove peças extraídas (de um modelo ou de toda a caixa). |

---

## 5. Integração com o Viewer

- O viewer **atualiza o modelo** sempre que um GLB é carregado (fluxo existente `addModelToBox`).
- Após o load, o callback `onModelLoaded` é invocado; a aplicação (Workspace) executa extração e atualiza `extractedPartsByBoxId` e, em seguida, `buildDesignState` faz o merge na cut list e no preço.

---

## 6. Lista de Peças e Calculator

- A Lista de Peças (cut list) passa a incluir:
  - Peças **paramétricas** (caixas: painéis, portas, gavetas) via `cutlistComPrecoFromBoxes(boxes)`.
  - Peças **extraídas de GLB** via `extractedPartsByBoxId[boxId]`.
- O Calculator usa a mesma `cutListComPreco` (já com preços) e `calcularPrecoTotalPecas` / `calcularPrecoTotalProjeto` incluem automaticamente as peças importadas.

---

## 7. Unidades

- **Viewer / Three.js**: 1 unidade = 1 m.
- **Calculator / Cut list**: mm.
- Conversão na fronteira: `mToMm` em `extractPartsFromGLB`; `mmToM` onde se envia dimensões para o viewer.

---

## 8. Código removido / obsoleto

- Nenhum código antigo foi removido. Não existia sistema prévio de extração de peças a partir de GLB; apenas carregamento visual. O novo pipeline foi adicionado em paralelo (módulo `core/glb` + callback no Viewer + estado `extractedPartsByBoxId`).

---

## 9. Fase no Roadmap

- Nova fase no Project Roadmap: **"Integração GLB → Sistema Multi-Box"** (ver `src/core/docs/projectRoadmap.ts`).
