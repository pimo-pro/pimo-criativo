# Relatório — FASE 3 Etapa 6: Melhorias na página Admin → Materials

## Objetivo

Transformar a página de gestão de materiais numa interface profissional, com categorias, filtros, pesquisa, ordenação, drawer melhorado, quick view, duplicar e export/import, sem alterar MaterialLibrary, Viewer, CNC, PDF, Cutlist ou Materiais & Fabricação.

---

## 1. Melhorias implementadas

### 1.1 Categorias de materiais

- **Sistema de categorias:** Lista fixa de categorias no código (`CATEGORIAS_MATERIAIS`), exportada para reutilização.
- **Categorias disponíveis:** MDF, Carvalho, Lacado, Melamina, Contraplacado, Vidro (glass), Metal, Industrial, Visual, Outros.
- **Dropdown no formulário (drawer):** O campo "Categoria" usa um `<select>` com todas as categorias.
- **Filtro por categoria:** Na barra de filtros, um dropdown "Todas as categorias" / categoria específica filtra a lista.
- **Categoria no card:** Cada card mostra a categoria (nome legível), espessura e preço por m².

### 1.2 Pesquisa (Search)

- **Campo de pesquisa** no topo da área de filtros.
- **Pesquisa instantânea (filtragem local)** por:
  - Nome/label (contém o texto)
  - Espessura (valor numérico)
  - Preço (valor numérico)
  - Categoria (nome da categoria contém o texto)
- A lista é filtrada em tempo real através de `useMemo` sobre `materials` + critérios.

### 1.3 Filtros (Filters)

- **Filtro por categoria:** Dropdown para escolher uma categoria ou "Todas".
- **Filtro por tipo:** Dropdown com: Todos os tipos, Industrial, Visual, Migrado.
  - **Industrial:** materiais com `industrialMaterialId` preenchido.
  - **Visual:** materiais com `visualPresetId` preenchido.
  - **Migrado:** materiais com `categoryId === "industrial"` (migrados da lista industrial).
- **Filtro por faixa de preço:** Campos "Mín" e "Máx" para preço por m² (€/m²).
- **Filtro por espessura:** Campos "Mín" e "Máx" para espessura (mm).

### 1.4 Ordenação (Sorting)

- **Dropdown "Ordenar por":** Nome, Preço, Espessura, Categoria.
- **Botão de direção:** "↑ Asc" / "↓ Desc" para alternar entre ascendente e descendente.
- **Critérios:** Ordenação por `label`, `precoPorM2`, `espessura` ou `categoryId` (nome da categoria), com direção aplicada a todos.

### 1.5 Melhorias no Drawer (formulário)

- **ColorPicker:** Input `type="color"` + campo de texto para cor em hex (já existia; mantido e integrado no layout).
- **Campo textura:** Input de texto para URL ou caminho, com placeholder para "upload em breve".
- **Material industrial associado:** `<select>` preenchido com `MATERIAIS_INDUSTRIAIS` (MDF Branco, Carvalho, Lacado, Contraplacado, Melamina).
- **Preset visual associado:** `<select>` preenchido com a lista completa de `materialPresets` (Madeira — Carvalho, Nogueira, Metal — Aço, etc.).
- **Preço final e espessura:** Campos "Preço por m² (€)" e "Espessura (mm)" com labels claros.
- **Layout:** Drawer com largura 380px, espaçamento e agrupamento lógico dos campos.

### 1.6 Quick View (hover)

- **Tooltip no card:** Atributo `title` em cada card com:
  - Nome
  - Categoria
  - Espessura (mm)
  - Preço (€/m²)
  - Tipo (Industrial / Visual / Migrado / Outro)
- Ativado ao passar o rato sobre o card (comportamento nativo do browser).

### 1.7 Melhorias visuais gerais

- **Grid de cards:** `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))` para layout responsivo.
- **Design dos cards:** Fundo semi-transparente, borda, bordas arredondadas (`var(--radius)`), sombra; ícone de cor maior (28x28) quando existir.
- **Espaçamento e tipografia:** Gaps consistentes (12–20px), títulos 14–18px, texto secundário 11px, cores `var(--text-main)` e `var(--text-muted)`.
- **Contador:** Texto "X de Y materiais" ao lado da ordenação.
- **Responsividade:** Flex/grid com wrap onde aplicável; drawer `maxWidth: 100%`.

### 1.8 Duplicar material

- **Botão "Duplicar"** em cada card.
- **Comportamento:** Chama `duplicateMaterial(id)` no serviço; cria novo registo com os mesmos dados, novo `id` e label `"… (cópia)"`; recarrega a lista e abre o drawer em edição do novo material.

### 1.9 Exportar / Importar (JSON)

- **Exportar:** Botão "Exportar JSON" descarrega um ficheiro JSON com todos os materiais (array), nome `pimo-materiais-YYYY-MM-DD.json`.
- **Importar:** Botão "Importar JSON" mostra um painel com textarea para colar JSON; botão "Importar (merge: evita duplicados por nome)" chama `importMaterialsFromJson` com `merge: true` (não insere se já existir material com o mesmo label, case-insensitive). Mostra toast com número de importados e erros se houver.

---

## 2. Ficheiros alterados

| Ficheiro | Alterações |
|----------|------------|
| `src/core/materials/service.ts` | Novas funções: `duplicateMaterial`, `exportMaterialsAsJson`, `importMaterialsFromJson`. |
| `src/pages/admin/materials/GestaoMateriaisPage.tsx` | Reescrita da página: categorias, pesquisa, filtros, ordenação, grid de cards, drawer melhorado, tooltip, duplicar, export/import. Imports de `MATERIAIS_INDUSTRIAIS` e `materialPresets` para os dropdowns do drawer. |

Nenhum ficheiro foi alterado em:

- MaterialLibrary / Viewer
- CNC / PDF / Cutlist
- Materiais & Fabricação

---

## 3. Como funcionam categorias, filtros, pesquisa e ordenação

### Categorias

- **Definição:** Constante `CATEGORIAS_MATERIAIS` em `GestaoMateriaisPage.tsx` com `id` e `label` (MDF, Carvalho, Lacado, etc.).
- **Uso:** No formulário, o utilizador escolhe uma categoria; no filtro, escolhe "Todas as categorias" ou uma categoria para reduzir a lista. A função `getCategoryLabel(id)` devolve o nome legível para exibição.

### Pesquisa

- Uma única caixa de texto. O valor é guardado em `search`.
- Em `useMemo`, a lista é filtrada se `search` não estiver vazia: cada material é mantido se o texto (em minúsculas) existir em `label`, em `String(espessura)`, em `String(precoPorM2)` ou no nome da categoria. A pesquisa é instantânea (sem debounce; filtragem síncrona em cada render).

### Filtros

- **Categoria:** `filterCategory` — mantém apenas materiais com `categoryId === filterCategory`.
- **Tipo:** `filterType` (all | industrial | visual | migrado) — `getMaterialType(m)` classifica cada material; a lista é filtrada por esse tipo.
- **Preço:** `filterPriceMin` e `filterPriceMax` — mantém materiais cujo `precoPorM2` está dentro do intervalo (se o campo estiver preenchido).
- **Espessura:** `filterEspessuraMin` e `filterEspessuraMax` — mesma lógica para `espessura`.

Todos os filtros são aplicados em sequência no mesmo `useMemo` que produz `filteredAndSorted`.

### Ordenação

- **Campo:** `sortField` (label | precoPorM2 | espessura | categoryId) escolhido no dropdown.
- **Direção:** `sortDir` (asc | desc) alternada pelo botão.
- No final do `useMemo`, a lista filtrada é ordenada com `sort()`: comparação por string (localeCompare) para nome e categoria; por número para preço e espessura; depois inverte se `sortDir === "desc"`.

---

## 4. Confirmação de funcionalidade e estabilidade

- **CRUD:** Criar, editar e eliminar materiais continuam a usar o mesmo serviço e localStorage (`pimo_materials_crud_v1`). A migração de materiais antigos (`migrateMaterialsFromLegacy`) continua a ser executada ao montar a página.
- **Compatibilidade:** Materiais migrados (categoria "industrial") continuam a ser listados, filtrados por tipo "Migrado" e editáveis. Nenhuma alteração ao contrato de dados do CRUD.
- **Garantias respeitadas:** Nenhuma alteração em MaterialLibrary, Viewer, CNC, PDF, Cutlist ou na página Materiais & Fabricação; apenas a UI/UX da página Admin → Materials foi melhorada.
- **Export/Import:** Opcional e funcional: export gera JSON válido; import com merge evita duplicados por nome e mostra feedback por toast.

A página Materials está funcional e estável para uso na Etapa 6 da Fase 3.
