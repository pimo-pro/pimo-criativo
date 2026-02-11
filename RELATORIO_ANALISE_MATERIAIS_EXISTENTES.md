# Análise do sistema de materiais existente (pré-FASE 3)

**Data:** 11 de fevereiro de 2025  
**Objetivo:** Mapear todo o código relacionado a materiais antes de implementar o novo Materials System da FASE 3. Sem implementações; apenas documentação.

---

## 1. Ficheiros existentes que tratam de materiais

### 1.1 Tipos e dados centrais

| Ficheiro | Conteúdo |
|----------|----------|
| **`src/core/types.ts`** | Interface `Material` (tipo, espessura, precoPorM2). Usado em todo o projeto como material **de projeto**. `BoxModule.material?: string`. `BoxModelInstance.material?: string`. `CutListItem.material: string`. |
| **`src/core/box/types.ts`** | Constante `MATERIAL` e overrides em configuração de caixa. |
| **`src/core/manufacturing/materials.ts`** | `MaterialPbrId`, `MATERIAIS_PBR_OPCOES`, `MaterialIndustrial` (nome, espessuraPadrao, custo_m2, materialPbrId, cor, larguraChapa, alturaChapa, densidade). `MATERIAIS_INDUSTRIAIS`, `getMaterial(nome)`. Lista de materiais **industriais** (custo, chapa, PBR). |
| **`src/core/materials/materialPresets.ts`** | `MaterialCategory` (wood, metal, glass, plastic, marble, stone). `MaterialPreset` com maps (map, normalMap, roughnessMap, metalnessMap, aoMap) e defaults (roughness, metalness, envMapIntensity, color). Lista `materialPresets` e funções `getPresetsByCategory`, `getPresetById`. Sistema de **presets visuais por categoria** (texturas SVG). |
| **`src/3d/materials/MaterialLibrary.ts`** | `MaterialPreset` (name, options). `MaterialSet`, `MATERIAIS_PBR_IDS`, `defaultMaterialSet` (carvalho_natural, mdf_branco, etc. com cor/roughness/metalness). `resolveMaterialId(nome)`, `getMaterialPreset(materialSet, idOrName)`, `mergeMaterialSet`. Usado pelo **Viewer e BoxBuilder** para materiais 3D (cor sólida, sem texturas). |
| **`src/3d/materials/WoodMaterial.ts`** | `WoodMaterialOptions`, `LoadedWoodMaterial`. `createWoodMaterial(maps, options)` — cria `THREE.MeshStandardMaterial` com cor e PBR. **Sem texturas**; apenas cor e parâmetros. |

### 1.2 Contexto e estado (React)

| Ficheiro | Conteúdo |
|----------|----------|
| **`src/context/materialContext.tsx`** | `MaterialProvider`: estado `MaterialSystemState` (categories, assignments), persistido em localStorage (`pimo_material_system_v1`). `setCategoryPreset`, `setCategoryOverrides`, `setAssignment`. Usa `materialPresets` e `materialUtils`. |
| **`src/context/materialContextInstance.ts`** | `MaterialContext` (createContext) e tipo `MaterialContextValue`. |
| **`src/context/materialUtils.ts`** | `ModelPart`, `MaterialCategoryConfig`, `MaterialSystemState`, `defaultMaterialState`, `normalizeMaterialState`, `materialCategoryOptions`, `modelPartOptions`. Define categorias e partes (wood, metal, door, drawer, etc.). |
| **`src/context/useMaterial.ts`** | Hook `useMaterial()` — retorna o contexto do MaterialProvider. |

### 1.3 Hooks e listas persistidas

| Ficheiro | Conteúdo |
|----------|----------|
| **`src/hooks/useMaterials.ts`** | Lista **industrial** de materiais (Admin): `useStorageList<MaterialIndustrial>` com chave `pimo_admin_materials`, valor default `MATERIAIS_INDUSTRIAIS`. Retorna `materials`, `setMaterials`, `reload`. Usado em **MaterialsManager** e **BottomPanel** (custo). |

### 1.4 Viewer e 3D

| Ficheiro | Conteúdo |
|----------|----------|
| **`src/3d/core/Viewer.ts`** | `materialSet` (MaterialSet), `defaultMaterialName = "mdf_branco"`. `loadMaterial(materialName)` → `getMaterialPreset(materialSet, materialName)` + `createWoodMaterial`. `updateBoxMaterial(id, materialName)` aplica material à caixa. `updateBox(id, options)` aceita `materialName` e chama `updateBoxMaterial`. Cada entrada de caixa guarda `material: LoadedWoodMaterial | null`. Dispose de materiais em removeBox e clear. |
| **`src/3d/objects/BoxBuilder.ts`** | Usa `MaterialLibrary.getMaterialPreset`, `createWoodMaterial`. `getFallbackPBRMaterial()`, `getDefaultMDFMaterial()`. Opções `BoxOptions.material`, `materialName`. Constrói geometria e aplica material às meshes. |
| **`src/3d/core/SceneManager.ts`** | Apenas dispose de `child.material` e do grid/ground ao limpar cena. |

### 1.5 UI relacionada a materiais

| Ficheiro | Conteúdo |
|----------|----------|
| **`src/components/layout/right-panel/MaterialPanel.tsx`** | Painel **“Materiais”**: tipo de material (categoria), preset, preview de textura (maps.map), sliders roughness/metalness/envMapIntensity, cor, e “Aplicar em partes” (assignments por ModelPart). Usa `useMaterial()` e `core/materials/materialPresets`. **Só é renderizado em Admin → MaterialsManufacturing**; não aparece no fluxo principal do workspace. |
| **`src/components/admin/MaterialsManager.tsx`** | Admin: CRUD de **materiais industriais** (nome, espessura, custo, materialPbrId, chapa, densidade). Usa `useMaterials()`. Lista em cards; formulário para adicionar/editar. |
| **`src/components/admin/MaterialsManufacturing.tsx`** | Página Admin que renderiza apenas `<MaterialPanel />`. |
| **`src/components/layout/left-panel/PainelModelosDaCaixa.tsx`** | Select “Material” com `project.material.tipo`; ao mudar chama `actions.setMaterial({ ...project.material, tipo: value })` e `viewerApi?.updateBox(project.selectedWorkspaceBoxId, { materialName: value })`. Liga **material de projeto** ao **viewer**. |
| **`src/components/layout/left-panel/LeftPanel.tsx`** | Botão “Selecionar Material” (quando box selecionado) que faz scroll ao painel direito ou mostra toast. Não altera material. |
| **`src/components/modals/Piece3DModal.tsx`** | Modal 3D da peça: recebe `materialTipo` (string), converte com `materialNameToPreset` para id do MaterialLibrary (mdf_branco, etc.), usa `getMaterialPreset` + `createWoodMaterial` e aplica à caixa construída com `buildBoxLegacy`. |
| **`src/components/ui/CutListTable.tsx`** | Coluna `item.material` na tabela de cutlist. |

### 1.6 Projeto, estado e sincronização

| Ficheiro | Conteúdo |
|----------|----------|
| **`src/context/projectState.ts`** | `defaultMaterial` (tipo, espessura, precoPorM2). Caixas criadas com `material: state.material` (design) ou derivado. |
| **`src/context/ProjectProvider.tsx`** | `setMaterial(material)`, restauro de `material` no load, uso de `prev.material.espessura` e `template.materialPadrao`. |
| **`src/context/projectTypes.ts`** | `setMaterial: (_material: Material) => void` em ProjectActions. |
| **`src/hooks/useCalculadoraSync.ts`** | Sincroniza `box.material` / `materialName` com o viewer: `api.updateBox(box.id, { ..., materialName: resolvedMaterialName })`. `resolvedMaterialName = box.material ?? materialName ?? "MDF Branco"`. |

### 1.7 Cutlist, manufacturing, PDF, CNC

| Ficheiro | Conteúdo |
|----------|----------|
| **`src/core/design/generateDesign.ts`** | Cutlist com `material: material.tipo` (material de projeto). |
| **`src/core/manufacturing/boxManufacturing.ts`** | `getNomeMaterial(box)`, `getMaterial(painel.material)`, `calcularCustoPainel(painel, material)`. Painéis com `material: material.nome`. |
| **`src/core/manufacturing/cutlistFromBoxes.ts`** | `material = box.material ?? "MDF Branco"`; peças com `material`. |
| **`src/core/cutlayout/cutLayoutEngine.ts`** | `materialId`, `materialName` em peças e folhas; agrupamento por material/espessura. |
| **`src/core/cutlayout/cutLayoutTypes.ts`** | `materialId?`, `materialName?` em tipos de peça/folha. |
| **`src/core/cutlayout/cutLayoutPdf.ts`** | Título por material: `materialId ?? materialName ?? "Material"`. |
| **`src/core/pdf/gerarPdfTecnico.ts`** | `box.material`, `formatMaterial`, `MATERIAIS_PBR_OPCOES`, `matInfo.materialPbrId`. |
| **`src/core/pdf/pdfTechnical.ts`** | `box.material ?? "MDF"` em texto do PDF. |
| **`src/core/export/pdfGenerator.ts`** | `box.material ?? "MDF Branco"`, `painel.material`. |
| **`src/core/pricing/pricing.ts`** | `getPrecoPorMaterial(material, espessura)`, `PRECOS_MATERIAIS`, uso de `item.material`. |
| **`src/core/cnc/cncExport.ts`** | `materialId` na primeira folha. |
| **`src/core/cnc/cncTypes.ts`** | `materialId?` em tipo de folha. |

### 1.8 Regras, validação, GLB

| Ficheiro | Conteúdo |
|----------|----------|
| **`src/core/rules/validation.ts`** | Validação de regras com `ctx.material`, `model.material`. |
| **`src/core/rules/types.ts`** | Tipos que referenciam material onde aplicável. |
| **`src/core/validation/validateProject.ts`** | `box.material` (existência/não vazio). |
| **`src/core/glb/glbPartsToCutList.ts`** | `material = p.materialHint?.trim() || defaultMaterial`. |
| **`src/core/glb/extractPartsFromGLB.ts`** | `mesh.material` (Three.js) para leitura da geometria/peças. |

### 1.9 Outros

| Ficheiro | Conteúdo |
|----------|----------|
| **`src/components/layout/bottom-panel/BottomPanel.tsx`** | Custo: `materials.find((m) => m.nome === item.material)` (lista industrial). |
| **`src/core/calculator/woodCalculator.ts`** | `config.material.precoPorM2`. |
| **`src/core/multibox/multiBoxManager.ts`** | `project.material.tipo` ao criar/sincronizar caixas. |
| **`src/materials/mdfLibrary.ts`** | Biblioteca MDF (verificar se só nomes ou também custos). |
| **`src/core/materials/*` (FASE 3 skeleton)** | `types.ts`, `service.ts`, `hooks.ts`, `utils.ts`, `index.ts` — apenas placeholders; sem uso ainda. |

---

## 2. Onde o Three/Viewer usa materiais

- **Viewer.ts**
  - `materialSet`: `MaterialSet` (MaterialLibrary); merge com opções do construtor.
  - `loadMaterial(materialName: string)`: `getMaterialPreset(this.materialSet, materialName)` → `createWoodMaterial({}, { ...preset.options })` → `LoadedWoodMaterial`.
  - `updateBoxMaterial(id, materialName)`: obtém `nextMaterial` com `loadMaterial(materialName)`; aplica a `entry.mesh.material` e filhos; guarda `entry.material = nextMaterial`; dispose do material anterior.
  - `addBox` / `updateBox`: aceitam `opts.materialName`; se presente e não cadOnly, chamam `updateBoxMaterial(id, opts.materialName)`. Default `materialName = opts.materialName ?? this.defaultMaterialName` (“mdf_branco”).
  - Não há `applyMaterial`/`setMaterial` genéricos com outro nome; a API é `updateBox(id, { materialName })` e internamente `updateBoxMaterial`.
- **BoxBuilder.ts**
  - Recebe `opts.material` (THREE.Material) e/ou `materialName`; usa MaterialLibrary + createWoodMaterial para obter material; aplica a meshes (panel.material, etc.).
- **Piece3DModal**
  - Usa `materialNameToPreset` (string de UI → id MaterialLibrary), depois `getMaterialPreset` + `createWoodMaterial` e passa `material` para `buildBoxLegacy`.
- **viewerApi**
  - Exposto via usePimoViewer: `updateBox(id, options)` com `options.materialName`; não há método separado “setMaterial” na API pública; é tudo via `updateBox`.

Resumo: o viewer usa apenas **MaterialLibrary** (3d/materials) + **WoodMaterial** (cor + PBR, sem texturas). Nenhum uso direto de `core/materials/materialPresets` (wood/metal/glass com maps) no Viewer.

---

## 3. Onde o projeto armazena o material de cada box

- **Nível projeto**
  - `project.material`: `Material` em `ProjectState` (tipo, espessura, precoPorM2). Fonte única para “material padrão” do projeto e para a UI do painel esquerdo (PainelModelosDaCaixa).
- **Nível caixa (design)**
  - `project.boxes[].material`: `string | undefined` em `BoxModule`. Preenchido pelo design (ex.: `material.tipo` em generateDesign). Usado em cutlist, PDF, manufacturing, pricing, regras.
- **Nível workspace**
  - `WorkspaceBox` **não tem** campo `material`. O material visual da caixa no viewer vem de:
    - sincronização com `project.boxes` (useCalculadoraSync) que passa `materialName: box.material ?? ...` para `updateBox`;
    - ou da UI (PainelModelosDaCaixa) que altera `project.material.tipo` e chama `viewerApi.updateBox(..., { materialName: value })`.
- **Modelos dentro da caixa**
  - `BoxModelInstance.material?: string` — material por instância de modelo (ex.: GLB). Usado em Piece3DModal e onde se lê modelo da caixa.

Não existe `box.texture` ou `box.color` em tipos; apenas `material` (string) em BoxModule e opcionalmente em BoxModelInstance.

---

## 4. Integração com exportação

- **pdfGenerator.ts** (core/export): usa `box.material ?? "MDF Branco"`, `painel.material`.
- **gerarPdfTecnico.ts** (core/pdf): usa `box.material`, `formatMaterial`, `MATERIAIS_PBR_OPCOES`/`materialPbrId` para rótulos.
- **pdfTechnical.ts** (core/pdf): `box.material ?? "MDF Branco"` em texto.
- **cutLayoutPdf.ts**: agrupa por material; título com `materialName ?? materialId`.
- **cncExport.ts** / **cncTypes.ts**: `materialId` em folha CNC.

Não existe `exportJson`, `exportProject` ou `exportMaterials` dedicados; o que existe é uso de `material` / `materialId` / `materialName` nos fluxos de PDF e CNC já listados.

---

## 5. Resumo e recomendações

### 5.1 Lista resumida de ficheiros por função

- **Tipos/dados projeto e caixa:** `core/types.ts`, `context/projectState.ts`, `context/projectTypes.ts`, `ProjectProvider.tsx`.
- **Materiais industriais (custo, chapa, PBR):** `core/manufacturing/materials.ts`, `hooks/useMaterials.ts`, `MaterialsManager.tsx`, `BottomPanel.tsx`.
- **Presets visuais (categorias + texturas):** `core/materials/materialPresets.ts`, `context/materialUtils.ts`, `materialContext.tsx`, `materialContextInstance.ts`, `useMaterial.ts`, `MaterialPanel.tsx`, `MaterialsManufacturing.tsx`.
- **Viewer/3D (cor sólida PBR):** `3d/materials/MaterialLibrary.ts`, `3d/materials/WoodMaterial.ts`, `3d/core/Viewer.ts`, `3d/objects/BoxBuilder.ts`, `Piece3DModal.tsx`.
- **Sincronização e UI de projeto:** `useCalculadoraSync.ts`, `PainelModelosDaCaixa.tsx`, `LeftPanel.tsx` (botão Selecionar Material).
- **Cutlist, manufacturing, PDF, CNC, pricing, regras, validação, GLB:** listados na secção 1.7 e 1.8.
- **FASE 3 skeleton:** `core/materials/types.ts`, `service.ts`, `hooks.ts`, `utils.ts`, `index.ts` — só estrutura; sem lógica.

### 5.2 Onde o sistema atual está a ser usado

- **project.material** e **box.material**: definição de projeto, painel esquerdo (Material + espessura), geração de design, cutlist, PDF, CNC, pricing, regras, validação.
- **Viewer**: apenas MaterialLibrary + WoodMaterial; atualização via `updateBox(..., { materialName })` a partir de `project.material.tipo` ou `box.material`.
- **MaterialPanel (presets wood/metal/glass)**: apenas em Admin → MaterialsManufacturing; estado em localStorage; **não** ligado ao Viewer nem ao fluxo principal.
- **useMaterials (industriais)**: Admin MaterialsManager (CRUD) e BottomPanel (cálculo de custo por nome de material).

### 5.3 Lógica ativa vs código morto

- **Ativo:** project.material, box.material, Viewer MaterialLibrary + updateBoxMaterial, PainelModelosDaCaixa (setMaterial + updateBox), useCalculadoraSync (materialName no viewer), useMaterials (industriais), MaterialsManager, BottomPanel (custo), PDF/CNC/cutlist/pricing/regras/validação, Piece3DModal (materialTipo → preset).
- **Pouco ou não integrado:** MaterialProvider + MaterialPanel (presets por categoria e “Aplicar em partes”) — UI ativa em Admin mas **não** altera o Viewer nem o material de projeto/caixa; é um sistema paralelo para “visual por partes” que não está ligado ao resto.

### 5.4 UI antiga de materiais

- **MaterialPanel** (right-panel): existe e está em uso só em Admin → MaterialsManufacturing. Não é UI “antiga” removida; é um fluxo alternativo (categorias + presets + assignments) que não alimenta o Viewer nem project.material.
- Não foi encontrada outra UI antiga de materiais desativada ou duplicada.

### 5.5 Ligação com o ThreeViewer

- O Viewer principal (usePimoViewer + Viewer.ts) usa **apenas**:
  - `3d/materials/MaterialLibrary.ts` (defaultMaterialSet, getMaterialPreset, resolveMaterialId)
  - `3d/materials/WoodMaterial.ts` (createWoodMaterial)
- Entrada de material no viewer: string (ex.: "MDF Branco", "mdf_branco") via `updateBox(id, { materialName })`. Não usa `core/materials/materialPresets` nem o estado do MaterialProvider.

### 5.6 Recomendações para o novo sistema (FASE 3)

- **Manter e reutilizar**
  - **core/types Material** e **project.material** / **box.material** como fonte de verdade para “qual material está no projeto/caixa”.
  - **3d/materials/MaterialLibrary** e **WoodMaterial** para a parte 3D (cor/PBR no viewer), ou abstraí-los atrás da nova API sem duplicar lógica.
  - **core/manufacturing/materials.ts** (MaterialIndustrial, getMaterial, MATERIAIS_INDUSTRIAIS) para custos e chapas; o novo sistema pode expor ou delegar nisto.
- **Integrar em vez de substituir**
  - **MaterialProvider / materialPresets (core/materials/materialPresets.ts)**: hoje desconectado do fluxo principal. O novo Materials System pode:
    - unificar “material de projeto/caixa” com “presets visuais” (um único conjunto de presets ou um mapeamento claro entre tipo de projeto e preset 3D), e/ou
    - passar a alimentar o Viewer a partir do estado do MaterialProvider quando se quiser “material por parte” no futuro.
- **Substituir com cuidado**
  - Não remover de imediato `project.material` nem `box.material`; o novo sistema deve ser a camada que **preenche** ou **deriva** esses campos (e eventualmente `materialName` no viewer) para não quebrar PDF, CNC, cutlist, pricing e regras.
- **Documentar e alinhar**
  - Dois mundos hoje: (1) material “de projeto/caixa” (string + Material) + MaterialLibrary no Viewer; (2) MaterialProvider + materialPresets (categorias + assignments) só em Admin. O relatório da FASE 3 deve definir como o novo sistema une ou substitui (2) e como se relaciona com (1) e com o Viewer.

---

**Conclusão:** O projeto tem um sistema de materiais **ativo** (project/box + MaterialLibrary no Viewer + industriais para custo) e um sistema de **presets visuais** (MaterialProvider + MaterialPanel) usado só em Admin e não ligado ao Viewer. Nenhum deles deve ser removido sem definir no novo Materials System da FASE 3 a migração e a integração com o Viewer e com a exportação (PDF/CNC).
