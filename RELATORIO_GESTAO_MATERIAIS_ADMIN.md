# Relatório — Interface de Gestão de Materiais (Admin)

**Data:** 11 de fevereiro de 2025  
**Objetivo:** Nova página de Gestão de Materiais dentro do módulo **Materials** existente, sem nova secção no Admin.

---

## 1. Ficheiros criados

| Ficheiro | Descrição |
|----------|-----------|
| **`src/pages/admin/materials/GestaoMateriaisPage.tsx`** | Página completa da Gestão de Materiais: título, lista de materiais, botão “Adicionar Material”, painel lateral para criar/editar com todos os campos (placeholders). Consome o Materials Service em modo placeholder. |

**Ficheiros alterados (não criados):**

| Ficheiro | Alteração |
|----------|-----------|
| **`src/core/materials/types.ts`** | Adicionada interface `MaterialRecord` (id, label, categoryId, color, textureUrl, espessura, precoPorM2, industrialMaterialId, visualPresetId) para listagem e formulário. |
| **`src/core/materials/service.ts`** | Adicionadas funções placeholder `listMaterials(): MaterialRecord[]` e `getMaterialByIdOrLabel(idOrLabel): MaterialRecord | null` para a UI consumir. |
| **`src/pages/AdminPanel.tsx`** | Quando a secção ativa é **“Materials”**, passa a ser renderizada `<GestaoMateriaisPage />` em vez de `<MaterialsManager />`. O import de `MaterialsManager` foi removido apenas para evitar import não utilizado; o componente **`src/components/admin/MaterialsManager.tsx`** mantém-se no projeto (pode ser reutilizado num submenu futuro). |

---

## 2. Como a página foi integrada no módulo Materials existente

- O Admin não tem submenus por secção: cada item da sidebar corresponde a uma única vista.
- O módulo **“Materials”** continua a ser um único item no menu lateral; **não** foi criado um terceiro módulo nem alterado **“Materiais & Fabricação”** (que continua a mostrar `MaterialsManufacturing` / MaterialPanel).
- **Integração:** Ao clicar em **“Materials”** na sidebar, o conteúdo exibido passou a ser a nova página **Gestão de Materiais** (`GestaoMateriaisPage`).
- A rota permanece a mesma: o utilizador continua a abrir `/admin` e a escolher “Materials” no menu. Nenhuma rota nova foi adicionada.
- O componente antigo `MaterialsManager` (materiais industriais + ferramentas) não foi apagado; ficou em `src/components/admin/MaterialsManager.tsx` e pode voltar a ser usado, por exemplo, se no futuro existir um submenu “Materials” com “Gestão de Materiais” e “Materiais industriais”.

---

## 3. Estrutura da página

- **Título:** “Gestão de Materiais” (h2 no topo).
- **Secção a) Lista de materiais:** Painel “Materiais existentes” com cards (ou mensagem “Nenhum material registado” quando `listMaterials()` devolve vazio). Cada card mostra cor (swatch), label, categoria, espessura, preço e botão “Editar”.
- **Secção b) Botão “Adicionar Material”:** Abre o painel lateral de criação.
- **Secção c) Painel lateral:** Fixo à direita (drawer), com cabeçalho “Novo material” / “Editar material”, botão “Fechar” e formulário.
- **Secção d) Campos do material (placeholders):**
  - **Nome / Label** — input texto
  - **Categoria** — select com opções placeholder (Madeira, Metal, Vidro, Plástico)
  - **Cor** — color picker (`input type="color"`) + campo texto com valor hex
  - **Textura** — input texto + botão “Selecionar ficheiro (em breve)” desativado
  - **Espessura (mm)** — input número
  - **Preço por m² (€)** — input número
  - **Ligação ao material industrial** — select placeholder (ex.: MDF Branco, Carvalho)
  - **Ligação ao preset visual** — select alimentado por `getPresetsByCategory(categoryId)` (vazio enquanto placeholder)

A página usa `Panel` e classes existentes (`stack`, `card`, `button`, `input`) para manter o aspecto do Admin.

---

## 4. Como está preparada para o CRUD futuro

- **Consumo do Materials Service:** A página chama apenas:
  - `listMaterials()` — para preencher a lista (atualmente retorna `[]`)
  - `getMaterialByIdOrLabel(id)` — ao abrir “Editar” (atualmente retorna `null`)
  - `getPresetsByCategory(categoryId)` — para o dropdown de preset visual (atualmente retorna `[]`)
- **Sem lógica de persistência:** O botão “Criar material” / “Guardar alterações” chama `handleSave()`, que apenas fecha o painel; não há `createMaterial` nem `updateMaterial` ainda.
- **Tipos e contratos:** O formulário usa `MaterialRecord` e o mesmo conjunto de campos que o plano de integração prevê (id, label, categoria, cor, textura, espessura, preço, ligação industrial, ligação visual). Quando o Materials Service tiver CRUD real, basta:
  - Implementar `listMaterials()` para devolver os dados persistidos
  - Implementar `getMaterialByIdOrLabel()` para devolver um registo por id/label
  - Em `handleSave()`, chamar `createMaterial(form)` ou `updateMaterial(editingId, form)` e em seguida atualizar estado local ou re-fetch da lista
- **UI:** Lista, botão “Adicionar”, painel com todos os campos e botão “Editar” por material já estão no sítio; a próxima fase só precisa de ligar estas ações às funções reais do Materials Service e, se necessário, a um estado global (context/hook) para refrescar a lista após criar/editar.

---

**Resumo:** Foi criada a página **Gestão de Materiais** em `src/pages/admin/materials/GestaoMateriaisPage.tsx`, integrada como conteúdo do módulo **Materials** existente (substituindo a vista anterior nessa secção), sem nova secção no Admin e sem alterar “Materiais & Fabricação”, Viewer, projeto ou boxes. A UI consome o Materials Service em modo placeholder e está pronta para receber CRUD real na próxima fase.
