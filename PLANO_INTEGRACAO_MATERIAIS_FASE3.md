# Plano de Integração — Sistema de Materiais (FASE 3)

**Data:** 11 de fevereiro de 2025  
**Estado:** Apenas plano técnico — nenhuma implementação.  
**Objetivo:** Unificar os quatro sistemas de materiais existentes num fluxo único, modular e seguro.

---

## 0. Sistemas atuais (resumo)

| Sistema | Onde está | Função atual |
|--------|-----------|--------------|
| **1. Materiais do projeto** | `project.material` (Material), `box.material` (string) | Material “padrão” do projeto; design, cutlist, PDF, regras. |
| **2. Materiais industriais** | `core/manufacturing/materials.ts`, `useMaterials()` | Lista nome/espessura/custo/chapa/PBR; Admin CRUD e custos. |
| **3. Presets visuais** | `core/materials/materialPresets.ts` + MaterialProvider + MaterialPanel | Categorias (wood/metal/glass…) com maps e assignments; só em Admin, não ligado ao Viewer. |
| **4. Viewer** | `3d/materials/MaterialLibrary` + WoodMaterial + `updateBoxMaterial` | Material 3D (cor+PBR) aplicado às caixas no canvas. |

---

## 1. Unificação num único fluxo

### 1.1 Fonte de verdade (Single Source of Truth)

- **Proposta:** O **Material ID** (identificador estável) é a única referência partilhada.
  - **Material ID** = identificador interno do novo sistema (ex.: `"mdf_branco"`, `"carvalho_natural"`, ou ID de material industrial customizado).
  - Tudo o que hoje usa “nome” (string de UI) ou “tipo” passa a usar, internamente, **Material ID**; a UI continua a mostrar **label** (nome legível) obtido do serviço de materiais.
- **Onde vive a verdade:**
  - **Registo de materiais:** no novo **Materials Service** (FASE 3). Cada material tem: `id`, `label`, dados industriais (espessura, custo, chapa), e dados visuais (PBR / preset 3D).
  - **Material “de projeto”:** `project.material` mantém-se como interface de projeto, mas passa a ser **derivado** do Materials Service (ex.: `project.materialId` + espessura/preco em cache, ou `project.material` continua com tipo/espessura/preco e o serviço faz a ponte id ↔ tipo).
  - **Material “por caixa”:** `box.material` continua como **string** por compatibilidade (cutlist, PDF, CNC); essa string deve ser o **label** ou um **Material ID** resolvível pelo serviço. O serviço expõe: “dado um id ou label, devolve o material completo (industrial + visual)”.

Conclusão: a **fonte de verdade** é o **Materials Service** (registo de materiais). `project.material` e `box.material` são **referências** (id ou label) que o serviço resolve; o Viewer e os exportadores consomem através do serviço.

### 1.2 Como o box deve armazenar o material

- **Mantido por compatibilidade:** `BoxModule.material?: string` e `BoxModelInstance.material?: string`.
- **Semântica da string:**
  - Fase de transição: a string pode ser **Material ID** ou **label** (ex.: "MDF Branco"). O Materials Service deve aceitar ambos e resolver (ex.: `resolveMaterial(idOrLabel)` → material completo).
  - Objetivo final: preferir **Material ID** em novos dados; legado continua a funcionar via resolução por label.
- **WorkspaceBox:** continua sem campo `material`; o material da caixa no workspace é o do `BoxModule` correspondente (project.boxes) após sync. Não é obrigatório adicionar `WorkspaceBox.material`; o fluxo atual (derivar de box.material no sync) pode manter-se.
- **Não duplicar:** evitar guardar ao mesmo tempo “materialId” e “material” com significados diferentes; um único campo (string = id ou label) e o serviço faz a resolução.

### 1.3 Como o Viewer deve receber o material

- **Contrato estável:** o Viewer continua a receber um **nome lógico** (string) via `updateBox(id, { materialName })`. Esse nome é o **Material ID** (ou label) que o Materials Service entende.
- **Quem resolve:** a camada que chama o Viewer (ex.: useCalculadoraSync, PainelModelosDaCaixa, futuro Materials Service) deve:
  - Obter o material da caixa/projeto (id ou label).
  - Passar ao Viewer a string que o **Viewer consegue resolver** para criar o material 3D. Ou seja: o Materials Service deve expor algo como `getViewerMaterialName(materialIdOrLabel): string` que devolve o id usado pelo Viewer (ex.: "mdf_branco"), e o Viewer continua a usar MaterialLibrary/WoodMaterial com essa string; ou o Viewer passa a receber opções PBR do Materials Service em vez de apenas um nome.
- **Duas opções de integração (escolher uma na implementação):**
  - **A) Mínima:** Materials Service devolve “viewerMaterialId” (string) para cada material; o Viewer mantém MaterialLibrary + WoodMaterial; chamadas passam `materialName: service.getViewerMaterialId(box.material)`.
  - **B) Integrada:** Viewer recebe opções PBR (cor, roughness, metalness, envMapIntensity) do Materials Service e cria o material 3D; MaterialLibrary pode virar implementação interna do serviço ou ser alimentada pelo serviço.

Recomendação inicial: **A)** para reduzir risco e manter o Viewer estável; **B)** em fase posterior se se quiser um único conjunto de presets (incluindo texturas) no futuro.

### 1.4 Como os presets visuais devem ser integrados

- **Situação atual:** `core/materials/materialPresets.ts` (categorias wood/metal/glass com maps) + MaterialProvider (assignments por ModelPart) só são usados no MaterialPanel em Admin; não afetam o Viewer nem project/box.
- **Integração proposta:**
  - O **Materials Service** passa a ser o único sítio que define “o que é um material” (id, label, dados industriais, dados visuais).
  - **Dados visuais** podem ter dois níveis:
    - **Nível 1 (obrigatório):** PBR para o Viewer (cor, roughness, metalness, envMapIntensity) — já coberto por MaterialLibrary hoje.
    - **Nível 2 (opcional):** Categorias e presets com maps (wood, metal, glass…) — migrar de `materialPresets.ts` para o Materials Service como “presets visuais avançados”; usar apenas quando o Viewer ou futuras features suportarem texturas por parte.
  - **MaterialProvider / MaterialPanel:**
    - **Opção 1 (recomendada):** MaterialProvider passa a consumir o **Materials Service** (lista de materiais, presets por categoria). O estado “assignments por ModelPart” pode manter-se para UI “aplicar material por parte” no futuro; o serviço expõe os presets que o MaterialPanel mostra.
    - **Opção 2:** MaterialPanel deixa de usar `materialPresets.ts` diretamente e usa apenas a API do Materials Service (getPresetsByCategory, getPresetById); os dados de materialPresets.ts são **migrados** para o registo do Materials Service (ou para um ficheiro de dados carregado pelo serviço).
  - Assim, **presets visuais** deixam de ser um sistema paralelo e passam a ser **uma vista** (por categoria / por parte) sobre o mesmo registo de materiais que alimenta projeto, caixa e Viewer.

### 1.5 Como os materiais industriais se relacionam com os visuais

- **Relação 1:1 desejada.** Cada material “industrial” (nome, espessura, custo, chapa) deve ter **exatamente um** material visual (PBR para o Viewer).
- **Hoje:** `MaterialIndustrial` tem `materialPbrId` (opcional); MaterialLibrary tem ids (mdf_branco, carvalho_natural…). A relação existe mas está espalhada.
- **No Materials Service:**
  - Cada material no registo tem: **id**, **label**, **dados industriais** (espessura padrão, custo_m2, chapa, densidade), **dados visuais** (viewerMaterialId ou opções PBR).
  - A lista “industriais” (Admin, custos) passa a ser **uma projeção** do registo do Materials Service (ex.: `getIndustrialMaterials()`). O CRUD em MaterialsManager passa a criar/editar entradas nesse registo.
  - Para PDF/CNC/cutlist continua a usar-se **nome** ou **id** do material; o serviço fornece `getMaterialByIdOrLabel(idOrLabel)` → { id, label, espessura, custo_m2, viewerMaterialId, … }.
- **Resumo:** industriais e visuais são **um único tipo de entidade** no serviço, com campos industriais e campos visuais; a UI “industriais” e a UI “presets visuais” são duas vistas sobre a mesma lista.

---

## 2. O que manter, remover ou migrar

### 2.1 Manter (e usar como base ou contrato)

| Item | Motivo |
|------|--------|
| **`core/types.ts` — `Material` (tipo, espessura, precoPorM2)** | Contrato do projeto; usado em ProjectState, setMaterial, design, PDF. Manter; o Materials Service pode preencher/derivar estes valores a partir do material por id. |
| **`BoxModule.material` (string)** | Cutlist, PDF, CNC, regras, validação. Manter; semântica = id ou label resolvível pelo serviço. |
| **`BoxModelInstance.material` (string)** | Material por instância de modelo. Manter. |
| **Viewer API `updateBox(id, { materialName })`** | Contrato estável; manter. O “materialName” será id/label resolvido pelo serviço para o Viewer. |
| **`3d/materials/WoodMaterial.ts` (createWoodMaterial)** | Implementação concreta do material 3D. Manter; o Viewer (ou o Materials Service) continua a usá-la. |
| **`core/manufacturing/materials.ts` — tipos e `getMaterial(nome)`** | Usado em custos, boxManufacturing, BottomPanel. Manter durante transição; depois pode delegar em Materials Service ou ser substituído por chamadas ao serviço. |
| **Persistência industrial `useMaterials()` (pimo_admin_materials)** | Manter até o Materials Service expor CRUD e persistência; depois migrar para “materiais no serviço” e, se desejado, descontinuar a lista separada. |
| **MaterialProvider + MaterialPanel (UI)** | Manter; passar a consumir Materials Service em vez de materialPresets diretamente. |

### 2.2 Remover (após migração e testes)

| Item | Quando remover |
|------|----------------|
| **Nenhum ficheiro removido na primeira fase.** | Remoções apenas após o Materials Service estar em produção e todos os consumidores migrados. Depois: considerar remover duplicações (ex.: se materialPresets.ts for totalmente migrado para dados do serviço, pode tornar-se re-export do serviço ou ser eliminado). |

### 2.3 Migrar (dados e responsabilidades)

| De | Para |
|----|------|
| **Definição “o que é um material”** (espalhada em materialPresets, MaterialLibrary, MATERIAIS_INDUSTRIAIS) | **Materials Service** — um único registo: id, label, industrial, visual (viewer id ou PBR). |
| **MaterialProvider state (categories + assignments)** | Continuar a existir para UI; **fonte dos presets** = Materials Service (getPresetsByCategory, etc.). Persistência de “assignments por parte” pode manter-se em localStorage ou mover para o serviço. |
| **Resolução “nome UI → id Viewer”** (Piece3DModal materialNameToPreset, resolveMaterialId no MaterialLibrary) | **Materials Service**: `resolveToViewerId(idOrLabel): string`. |
| **Cálculo de custo por material** (getMaterial(nome), PRECOS_MATERIAIS) | **Materials Service**: `getMaterialByIdOrLabel(idOrLabel)` → custo, espessura, etc.; pricing e BottomPanel passam a usar o serviço. |

---

## 3. Serviço final de materiais

### 3.1 Estrutura (módulos e ficheiros)

- **`src/core/materials/`** (FASE 3 já tem skeleton):
  - **`types.ts`** — Expandir com: `MaterialRecord` (id, label, industrial, visual), `IndustrialData`, `VisualData`, tipos já existentes ajustados para alinhar com o plano.
  - **`service.ts`** — Lógica principal: `getMaterialByIdOrLabel`, `getViewerMaterialId`, `listMaterials`, `getPresetsByCategory` (delegar ou unificar com materialPresets durante migração), CRUD se Admin usar o serviço.
  - **`hooks.ts`** — `useMaterialsSystem` (estado + ações), `useMaterialPresets(categoryId)`, opcionalmente `useMaterialByIdOrLabel(idOrLabel)` para UI.
  - **`utils.ts`** — `resolveMaterialId`, `normalizeLabel`, validações; funções de compatibilidade com strings antigas (label ↔ id).
  - **`index.ts`** — Export central.
  - **`materialPresets.ts`** — **Mantido** na primeira fase; o serviço importa e re-exporta ou delega. Em fase posterior: dados podem vir de um JSON ou do próprio service; ficheiro pode virar thin wrapper.
- **Camada de dados (uma das opções):**
  - **Opção A:** Dados em código (como hoje): manter `materialPresets.ts` e `core/manufacturing/materials.ts` como fonte de dados e o **service** agrega-os (mapeamento id industrial ↔ id visual).
  - **Opção B:** Um único ficheiro de dados (ex.: `materialsRegistry.ts`) que o service carrega; industriais e presets visuais fundidos num só registo.

### 3.2 API do serviço (proposta)

- **Resolução e leitura:**
  - `getMaterialByIdOrLabel(idOrLabel: string): MaterialRecord | null` — devolve material completo (id, label, industrial, visual).
  - `getViewerMaterialId(idOrLabel: string): string` — devolve o id que o Viewer aceita (ex.: "mdf_branco"); para passar em `updateBox(..., { materialName })`.
  - `listMaterials(): MaterialRecord[]` — lista todos (para Admin e dropdowns).
  - `getPresetsByCategory(categoryId: string): MaterialPreset[]` — para MaterialPanel; pode mapear de materialPresets ou do registo unificado.
- **Projeto/caixa (helpers):**
  - `getMaterialForProject(materialIdOrLabel: string): { tipo: string; espessura: number; precoPorM2: number }` — para preencher `project.material` ou validar; usado por setMaterial e por design.
  - `getIndustrialMaterial(nomeOuId: string): MaterialIndustrial | null` — compatibilidade com getMaterial atual; pode delegar em getMaterialByIdOrLabel e projetar para MaterialIndustrial.
- **Escrita (fase posterior ou mínima):**
  - `createMaterial`, `updateMaterial`, `deleteMaterial` — se o CRUD de materiais passar a ser feito via Materials Service em vez de useMaterials() direto.

### 3.3 Fluxo de dados (unificado)

1. **Definição:** Materials Service mantém o registo (id, label, industrial, visual). Dados vêm de materialPresets + manufacturing/materials ou de um registo único.
2. **Projeto:** Ao carregar ou ao alterar material do projeto, ProjectProvider/setMaterial usa o serviço para obter tipo/espessura/preco (e opcionalmente guardar materialId). project.material continua a existir; pode ser preenchido a partir de `getMaterialForProject(materialId)`.
3. **Caixa:** Ao gerar design, `box.material` é preenchido com label ou id do material do projeto (ou do material escolhido por caixa, se no futuro houver material por caixa). Cutlist, PDF, CNC leem `box.material` e, se necessário, resolvem via serviço para obter label ou custo.
4. **Viewer:** useCalculadoraSync / PainelModelosDaCaixa obtêm o material da caixa ou do projeto, chamam `getViewerMaterialId(materialIdOrLabel)` e passam `viewerApi.updateBox(id, { materialName: viewerId })`. O Viewer continua a usar MaterialLibrary + WoodMaterial com esse id.
5. **UI (MaterialPanel, PainelModelosDaCaixa):** Dropdowns e selects obtêm lista de materiais via `listMaterials()` ou `getPresetsByCategory`; ao selecionar, guardam id ou label e chamam setMaterial / updateBox conforme o fluxo acima.
6. **Custos (BottomPanel, pricing):** Obter custo via `getMaterialByIdOrLabel(item.material)` e usar industrial.custo_m2 (ou campo equivalente).

### 3.4 Integração com o Viewer

- O Viewer **não** precisa de ser refatorado na primeira fase: continua a receber `materialName` (string) e a usar MaterialLibrary + WoodMaterial.
- A **única** mudança é garantir que quem chama `updateBox(id, { materialName })` passe o valor devolvido por `MaterialsService.getViewerMaterialId(box.material)` (ou equivalente), de forma que a string seja sempre um id que o MaterialLibrary conhece.
- Opcional (fase posterior): Viewer aceitar um objeto de opções PBR do Materials Service em vez de apenas um nome; nesse caso, o serviço expõe `getViewerMaterialOptions(idOrLabel)` e o Viewer ou um adapter converte em material 3D.

### 3.5 Integração com PDF / CNC / cutlist

- **Cutlist:** Já usa `item.material` (string). Manter; a string pode ser id ou label. Se for necessário “sempre label” em PDF, o serviço expõe `getLabel(idOrLabel)`.
- **PDF:** pdfGenerator, gerarPdfTecnico, pdfTechnical usam `box.material` como texto. Manter; opcionalmente passar por `getMaterialByIdOrLabel(box.material)?.label ?? box.material` para normalizar rótulos.
- **CNC:** Usa materialId/materialName em folhas. Manter; pode ser o id do material devolvido pelo serviço.
- **Pricing:** getPrecoPorMaterial(material, espessura) pode passar a delegar em `getMaterialByIdOrLabel(material)` e usar o campo de custo do registo; ou manter a lógica atual e alimentar PRECOS_MATERIAIS a partir do Materials Service.

---

## 4. Ficheiros afetados na implementação

### 4.1 Novos ou já previstos (FASE 3)

- `src/core/materials/types.ts` — expandir tipos conforme plano.
- `src/core/materials/service.ts` — implementar getMaterialByIdOrLabel, getViewerMaterialId, listMaterials, getPresetsByCategory, getMaterialForProject, getIndustrialMaterial.
- `src/core/materials/hooks.ts` — implementar useMaterialsSystem, useMaterialPresets (e eventualmente useMaterialByIdOrLabel).
- `src/core/materials/utils.ts` — resolveMaterialId / normalizeLabel / compatibilidade.
- `src/core/materials/index.ts` — exportar tudo; decidir se re-exporta materialPresets ou não.

### 4.2 Ajustes (sem remover comportamento)

- **`src/context/ProjectProvider.tsx`** — setMaterial pode passar a validar/obter dados via Materials Service; ao carregar projeto, opcionalmente resolver material por id.
- **`src/context/projectState.ts`** — ao criar caixas, material pode vir de `getMaterialForProject(project.materialId)` ou manter project.material e só usar o serviço para resolução quando necessário.
- **`src/hooks/useCalculadoraSync.ts`** — ao passar materialName ao viewer, usar `getViewerMaterialId(box.material ?? project.material.tipo)` (ou equivalente do serviço).
- **`src/components/layout/left-panel/PainelModelosDaCaixa.tsx`** — Select de material: opções vindas de listMaterials() ou getPresetsByCategory; ao mudar, setMaterial + updateBox com getViewerMaterialId(...).
- **`src/components/modals/Piece3DModal.tsx`** — Em vez de materialNameToPreset local, usar Materials Service getViewerMaterialId(materialTipo).
- **`src/core/manufacturing/boxManufacturing.ts`** — getMaterial(nome) pode delegar em Materials Service getIndustrialMaterial(nome) ou manter e alimentar a lista a partir do serviço.
- **`src/core/pricing/pricing.ts`** — getPrecoPorMaterial pode usar getMaterialByIdOrLabel e o campo industrial; ou manter PRECOS_MATERIAIS e alimentá-lo a partir do serviço.
- **`src/components/layout/bottom-panel/BottomPanel.tsx`** — Custo: obter materiais via Materials Service listMaterials() ou manter useMaterials() e garantir que a lista é consistente com o serviço.
- **`src/components/admin/MaterialsManager.tsx`** — Opcional: passar a criar/editar materiais via Materials Service em vez de useMaterials() direto; ou manter useMaterials e o serviço ler da mesma fonte.
- **`src/context/materialContext.tsx`** + **MaterialPanel** — Obter presets/categorias do Materials Service; manter state de assignments na UI se for necessário.

### 4.3 Referências a manter estáveis (não quebrar)

- **Viewer:** `src/3d/core/Viewer.ts`, `src/3d/objects/BoxBuilder.ts`, `src/3d/materials/MaterialLibrary.ts`, `src/3d/materials/WoodMaterial.ts` — manter contrato atual; apenas o “quem chama” passa a usar o Materials Service para obter a string materialName.
- **core/types.ts** — Material, BoxModule.material, BoxModelInstance.material; manter.
- **Cutlist / PDF / CNC:** Todos os ficheiros que leem `box.material` ou `item.material`; no máximo adicionar chamada ao serviço para obter label ou custo, sem alterar assinaturas de tipos.

### 4.4 Resumo por fase sugerida

- **Fase 1 (mínima):** Implementar Materials Service (registro unificado em memória ou a partir dos ficheiros atuais), getMaterialByIdOrLabel, getViewerMaterialId, getMaterialForProject. Ajustar useCalculadoraSync e PainelModelosDaCaixa e Piece3DModal para usar o serviço. Nenhuma remoção.
- **Fase 2:** MaterialPanel e MaterialProvider a consumir presets do Materials Service; migração de dados de materialPresets para o serviço (ou delegação). Pricing e BottomPanel a usar o serviço para custos.
- **Fase 3:** CRUD de materiais no Materials Service; MaterialsManager a usar o serviço; descontinuar lista separada em useMaterials se tudo estiver no serviço. Limpeza de código duplicado (materialPresets, MATERIAIS_INDUSTRIAIS como fonte única via serviço).

---

## 5. Garantias do plano

- **Nenhuma implementação neste documento:** apenas definição de fluxos, APIs e ficheiros afetados.
- **Compatibilidade:** project.material e box.material mantêm-se; cutlist, PDF, CNC e Viewer continuam a funcionar durante e após a integração.
- **Modularidade:** O Materials Service é um módulo em `core/materials`; consumidores importam e usam; a camada 3D (MaterialLibrary, WoodMaterial) pode permanecer inalterada na primeira fase.
- **Segurança:** Alterações em ProjectProvider, useCalculadoraSync e UI são incrementais (adicionar chamadas ao serviço e fallbacks para comportamento atual); remoções só após testes.

---

**Próximo passo recomendado:** Implementar a Fase 1 do plano (Materials Service com getMaterialByIdOrLabel, getViewerMaterialId, getMaterialForProject; integração em useCalculadoraSync, PainelModelosDaCaixa e Piece3DModal) e validar build e fluxo no Viewer e em um export PDF antes de avançar para presets e CRUD.
