# Relatório — Tarefas pré-Fase 3

## 1) Correção das páginas que deixaram de abrir no Admin

### Caminhos reais dos ficheiros

- **Project Progress:** `src/pages/ProjectProgress.tsx` (e estilos em `src/pages/ProjectProgressStyles.ts`)
- **Painel Referência:** `src/pages/PainelReferencia.tsx` (secções em `src/core/docs/painelReferenciaSections.ts`)

Ambas as páginas existem em `src/pages/`, e não em `src/pages/admin/`. Os componentes exportam corretamente: `export default function ProjectProgress()` e `export default function PainelReferencia()`.

### O que estava a causar o ecrã preto

1. **Falta de entrada no Admin:** O `AdminPanel.tsx` não tinha itens de menu "Project Progress" nem "Painel Referência". O conteúdo da área principal do Admin é escolhido por `active === "Materials"`, `active === "Templates"`, etc. Como não havia ramos para estas duas páginas, ao navegar para elas (por exemplo a partir do Header) ou ao esperar vê-las no Admin, o utilizador podia ficar sem conteúdo visível ou com o fallback "Módulo em construção" noutro fluxo.

2. **Layout da página Project Progress:** Em `ProjectProgressStyles.ts` o `main` tinha `direction: "rtl"` (direção right-to-left), o que podia fazer o layout parecer quebrado ou vazio em alguns contextos.

### Como foi corrigido

1. **Integração no Admin:**
   - Em `src/pages/AdminPanel.tsx` foram adicionados os imports de `ProjectProgress` e `PainelReferencia`.
   - Na lista `sidebarItems` foram adicionados os itens `"Project Progress"` e `"Painel Referência"`.
   - Na renderização condicional da área de conteúdo foram adicionados:
     - `active === "Project Progress"` → `<ProjectProgress />`
     - `active === "Painel Referência"` → `<PainelReferencia />`

2. **Estilo da página Project Progress:**
   - Em `src/pages/ProjectProgressStyles.ts` o `direction` do `main` foi alterado de `"rtl"` para `"ltr"`.

Com isto, as duas páginas voltam a abrir normalmente a partir do menu lateral do Admin, e a página Project Progress apresenta o layout correto. Nada foi removido nem renomeado; apenas se adicionaram entradas no Admin e se corrigiu o estilo.

### Rotas na aplicação

As rotas `/project-progress` e `/painel-referencia` continuam a funcionar em `App.tsx` (pushState e renderização de `ProjectProgress` / `PainelReferencia` em full-page). O Header continua a poder alternar para estas páginas. A correção no Admin garante que o mesmo conteúdo também está acessível dentro do painel Admin.

---

## 2) Fase 3 — Etapa 5: Migração dos materiais antigos

### Objetivo

Popular o CRUD de materiais (localStorage `pimo_materials_crud_v1`) com os materiais existentes em `core/manufacturing/materials.ts` (MATERIAIS_INDUSTRIAIS), para que a página Admin → Materials mostre todos os materiais e permita edição via CRUD, sem remover materiais industriais antigos, sem quebrar projetos antigos e sem alterar MaterialLibrary nem Viewer.

### Ficheiros lidos / fontes

- **Materiais industriais:** `src/core/manufacturing/materials.ts`  
  Constante `MATERIAIS_INDUSTRIAIS`: MDF Branco, Carvalho, Lacado, Contraplacado, Melamina (nome, espessuraPadrao, custo_m2, etc.).

- **MaterialPresets (visuais):** Não foram usados como fonte de novos registos no CRUD. Os presets visuais (`src/core/materials/materialPresets.ts`) continuam a ser usados pelo Viewer/MaterialLibrary; a migração apenas preenche o CRUD a partir dos industriais.

- **project.material.tipo (legado):** Valores como "MDF Branco" vêm do estado do projeto. Ao garantir que "MDF Branco" (e os restantes nomes industriais) existem no CRUD, `getMaterialByIdOrLabel(project.material.tipo)` e `getMaterialDisplayInfo` passam a resolver corretamente para projetos antigos.

### Conversão para MaterialRecord

Cada material industrial foi convertido para o tipo `MaterialRecord` com:

- **id:** gerado pelo serviço (`generateId()`).
- **label:** `ind.nome` (ex.: "MDF Branco", "Carvalho").
- **categoryId:** `"industrial"` (categoria fixa para migrados).
- **espessura:** `ind.espessuraPadrao` (mm).
- **precoPorM2:** `ind.custo_m2`.
- **industrialMaterialId:** `ind.nome` (ligação ao material industrial).
- **visualPresetId:** opcional; mapeamento nome → id PBR para o Viewer: "MDF Branco" → `mdf_branco`, "Carvalho" → `carvalho_natural`. Os restantes (Lacado, Contraplacado, Melamina) ficam sem `visualPresetId`.

A função de migração está em `src/core/materials/service.ts`: `migrateMaterialsFromLegacy()`.

### Evitar duplicados

- Antes de inserir cada material industrial, é chamado `getMaterialByIdOrLabel(ind.nome)`.
- Se já existir um registo com o mesmo `label` (comparação case-insensitive), o material é ignorado (`skipped`).
- Só são criados registos para nomes que ainda não existem no CRUD. A migração é idempotente: pode ser executada várias vezes sem duplicar.

### Inserção no CRUD

- Utiliza o mesmo `createMaterial()` do serviço e a chave `pimo_materials_crud_v1` em localStorage.
- A migração é executada ao abrir a página Admin → Materials (`GestaoMateriaisPage`), num `useEffect` que chama `migrateMaterialsFromLegacy()` e, se `migrated > 0`, chama `reload()` para atualizar a lista na UI.

### Quantos materiais foram migrados

- **Total de materiais industriais:** 5 (MDF Branco, Carvalho, Lacado, Contraplacado, Melamina).
- Na primeira abertura da página Materials após a alteração, os 5 são inseridos se o CRUD estiver vazio; em aberturas seguintes, `migrated` será 0 e `skipped` 5 (ou o número já existente).

### Confirmação da página Materials

- A página Admin → Materials (`src/pages/admin/materials/GestaoMateriaisPage.tsx`) usa `useMaterialsList()` → `listMaterials()`, que lê de `pimo_materials_crud_v1`.
- Após a migração, a lista mostra todos os materiais migrados (e quaisquer outros já existentes).
- A categoria "Industrial (migrado)" foi adicionada ao dropdown de categorias na página para que os materiais migrados tenham categoria visível e editável.
- Criação, edição e eliminação continuam a usar o CRUD normalmente; nenhuma alteração foi feita em MaterialLibrary nem no Viewer.

### Resumo de ficheiros alterados (Etapa 5)

- `src/core/materials/service.ts`: adicionada `migrateMaterialsFromLegacy()`, import de `MATERIAIS_INDUSTRIAIS`, constante `MIGRATED_CATEGORY_ID` e mapeamento `INDUSTRIAL_TO_PBR`.
- `src/pages/admin/materials/GestaoMateriaisPage.tsx`: import de `useEffect` e `migrateMaterialsFromLegacy`, categoria "Industrial (migrado)" em `CATEGORIAS_PLACEHOLDER`, e `useEffect` que executa a migração ao montar e faz `reload()` quando há novos materiais.
