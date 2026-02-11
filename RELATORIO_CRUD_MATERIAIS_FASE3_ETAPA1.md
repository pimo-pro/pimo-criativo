# Relatório — CRUD real do sistema de Materiais (FASE 3 — Etapa 1)

**Data:** 11 de fevereiro de 2025  
**Objetivo:** Implementar CRUD completo no Materials Service (localStorage) e integrar com a página “Gestão de Materiais” no Admin.

---

## 1. Funções CRUD implementadas

Todas em **`src/core/materials/service.ts`**:

| Função | Descrição |
|--------|-----------|
| **`listMaterials()`** | Lê do localStorage a chave `pimo_materials_crud_v1`, faz parse do JSON e devolve um array de `MaterialRecord`. Se a chave não existir ou o conteúdo for inválido, devolve `[]`. |
| **`getMaterialByIdOrLabel(idOuLabel)`** | Carrega a lista do storage e devolve o primeiro material cujo `id` ou `label` (case-insensitive) coincida com o argumento. Devolve `null` se não encontrar. |
| **`createMaterial(materialData)`** | Valida campos obrigatórios (nome/label, categoria, espessura, preço). Gera um id único (`crypto.randomUUID()` ou fallback `mat_<timestamp>_<random>`), cria o `MaterialRecord`, adiciona-o ao array, grava no localStorage e devolve `{ success: true, material }` ou `{ success: false, error }`. |
| **`updateMaterial(id, materialData)`** | Localiza o material por `id`, faz merge com `materialData` (sem alterar `id`), valida o resultado, grava no localStorage e devolve `{ success: true, material }` ou `{ success: false, error }`. |
| **`deleteMaterial(id)`** | Remove o material com o `id` dado do array, grava no localStorage e devolve `true` se foi removido, `false` se não existir. |

**Validação (`validateMaterialData`):**

- **Nome/Label:** obrigatório, não vazio após trim.
- **Categoria:** obrigatória (não undefined/null e não string vazia após trim).
- **Espessura:** obrigatória, número > 0.
- **Preço por m²:** obrigatório, número ≥ 0.

Presets visuais e materiais industriais são guardados apenas como referências (strings `industrialMaterialId` e `visualPresetId`); não há validação de objetos externos.

---

## 2. Como os dados são guardados no localStorage

- **Chave:** `pimo_materials_crud_v1`
- **Formato:** um único array JSON de objetos `MaterialRecord`.
- **Estrutura de cada registo:**  
  `id`, `label`, `categoryId?`, `color?`, `textureUrl?`, `espessura?`, `precoPorM2?`, `industrialMaterialId?`, `visualPresetId?`
- **Leitura:** `loadFromStorage()` — `localStorage.getItem(STORAGE_KEY)`, `JSON.parse`, filtro para garantir elementos com `id` e `label` string.
- **Escrita:** `saveToStorage(list)` — `JSON.stringify(list)` e `localStorage.setItem(STORAGE_KEY, …)`.
- **Ids únicos:** em criação usa-se `generateId()`: `crypto.randomUUID()` quando disponível, senão `mat_${Date.now()}_${random}`.

Armazenamento é temporário até existir backend; a mesma chave e formato podem ser migrados para API depois.

---

## 3. Como a UI foi ligada ao serviço

- **Lista:** A página usa **`useMaterialsList()`**, que mantém em estado o array devolvido por `listMaterials()` e expõe **`reload()`** para o voltar a ler do localStorage. A lista na UI é `materials`; após criar, atualizar ou eliminar chama-se `reload()` para atualizar a lista.
- **Guardar:** Usa **`useSaveMaterial()`**, que expõe **`save(data, editingId)`**. A página constrói os dados do formulário com **`buildFormData()`** (label, categoryId, espessura, preço, cor, textura, ligações industrial/preset). Se `editingId` for `null` chama `createMaterial(data)`, senão `updateMaterial(editingId, data)`. Em sucesso: `reload()`, fecha o drawer e mostra toast de sucesso; em erro mostra toast com a mensagem do serviço.
- **Eliminar:** Usa **`useDeleteMaterial()`**, que expõe **`deleteMaterial(id)`**. Na página, cada card tem botão “Eliminar”; ao clicar mostra `confirm()` e, se o utilizador confirmar, chama o serviço. Em sucesso: `reload()`, fecha o drawer se o material editado for o eliminado e mostra toast; em falha mostra toast de erro.
- **Editar:** Ao clicar “Editar”, a página chama **`getMaterialByIdOrLabel(id)`** (exportado pelo módulo materials), preenche o estado do formulário com o resultado e abre o drawer com `editingId` definido. O botão “Guardar alterações” chama `save(formData, editingId)` (update).
- **Toasts:** Usa **`useToast()`** de `ToastContext`: sucesso com `"info"`, erros com `"error"`.

Nenhuma lógica de projeto, boxes ou Viewer foi alterada; apenas a página de Gestão de Materiais e o Materials Service.

---

## 4. Ficheiros alterados

| Ficheiro | Alterações |
|----------|------------|
| **`src/core/materials/types.ts`** | Adicionados `CreateMaterialData`, `UpdateMaterialData` e `MaterialValidationResult`. |
| **`src/core/materials/service.ts`** | Implementação completa do CRUD: `loadFromStorage`, `saveToStorage`, `generateId`, `validateMaterialData`, `listMaterials`, `getMaterialByIdOrLabel`, `createMaterial`, `updateMaterial`, `deleteMaterial`. Mantidos placeholders `getPresetsByCategory`, `applyMaterial`, `getMaterialsState`, `resetCategoryOverrides`. |
| **`src/core/materials/hooks.ts`** | Novos hooks: **`useMaterialsList()`** (materials + reload), **`useMaterial(id)`** (material por id), **`useSaveMaterial()`** (save com create/update), **`useDeleteMaterial()`** (deleteMaterial). Mantidos `useMaterialsSystem` e `useMaterialPresets` sem alteração de comportamento. |
| **`src/pages/admin/materials/GestaoMateriaisPage.tsx`** | Passou a usar os hooks e o serviço: `useMaterialsList`, `useSaveMaterial`, `useDeleteMaterial`, `getMaterialByIdOrLabel`, `getPresetsByCategory`. Botão “Guardar” chama `save(buildFormData(), editingId)`, depois `reload()` e toast. Botão “Eliminar” em cada card com `confirm` e chamada a `deleteMaterial`. Toasts de sucesso e erro via `useToast()`. Removido uso de `useMaterial` na página (preenchimento do formulário em edição feito com `getMaterialByIdOrLabel` em `openEdit`). |

**Ficheiros não alterados (conforme pedido):** Viewer, `project.material`, `box.material`, módulo “Materiais & Fabricação”, rotas ou menu do Admin além do que já existia.

---

## 5. Confirmação de que o CRUD está funcional

- **Build:** `npm run build` concluído com sucesso (sem erros de TypeScript).
- **Fluxo implementado:**
  - **Criar:** “Adicionar Material” → preencher formulário (nome, categoria, espessura, preço obrigatórios) → “Criar material” → material é guardado no localStorage, lista atualiza, drawer fecha, toast de sucesso. Validação sem nome/categoria/espessura/preço devolve erro e toast.
  - **Listar:** A lista é preenchida com `listMaterials()` através de `useMaterialsList()`; ao recarregar a página os dados mantêm-se (localStorage).
  - **Editar:** “Editar” num material → drawer abre com dados preenchidos → alterações → “Guardar alterações” → `updateMaterial` é chamado, lista atualiza, drawer fecha, toast de sucesso.
  - **Eliminar:** “Eliminar” → confirmação → material removido do storage, lista atualiza, toast; se o drawer estiver aberto para esse material, fecha.

O CRUD está funcional na interface de Gestão de Materiais, com persistência em localStorage e compatível com o plano de unificação da FASE 3 (referências a materiais industriais e presets visuais por id/label, sem alterar outros sistemas nesta etapa).
