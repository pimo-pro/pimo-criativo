# Relatório — FASE 3 Etapa 6 (Parte 2): Melhorias na página Admin → Materials

## Objetivo

Completar a experiência de gestão de materiais com Quick View (hover), melhorias visuais (UI/UX), botão Duplicar Material, Exportar/Importar por ficheiro JSON e garantir que a página está estável e funcional, sem alterar MaterialLibrary, Viewer, CNC, PDF, Cutlist ou Materiais & Fabricação.

---

## 1. Lista completa das melhorias implementadas (Parte 2)

### 6) Quick View (hover preview)

- **Comportamento:** Ao passar o rato sobre um card de material, é exibido um overlay (tooltip) no topo do próprio card.
- **Conteúdo do Quick View:**
  - Nome/label
  - Categoria
  - Espessura (mm)
  - Preço por m²
  - Tipo (Industrial / Visual / Migrado / Outro)
- **Implementação:** Overlay com `position: absolute`, `pointer-events: none` (não bloqueia cliques nos botões Editar, Duplicar, Eliminar). Desaparece ao remover o rato do card (`onMouseLeave`). Leve (apenas estado `hoveredCardId` e um bloco condicional).

### 7) Melhorias visuais gerais (UI/UX)

- **Grid de cards:** `gap: 18px`, `minmax(292px, 1fr)` para melhor espaçamento e alinhamento; responsivo.
- **Cards:**
  - Bordas mais suaves: `borderRadius: 10`, `border: 1px solid rgba(255,255,255,0.1)`.
  - Sombras leves: `boxShadow: "0 1px 4px rgba(0,0,0,0.12)"`.
  - Transição ao hover (opcional no futuro): `transition` em border e box-shadow.
  - Ícone de cor maior (32×32) e bordas arredondadas (8px).
  - Badge de tipo (Industrial/Visual/Migrado/Outro) com fundo discreto e tipografia 10px.
  - Tipografia: `letterSpacing: "0.01em"`, hierarquia clara (título 14px, secundário 11px).
- **Área de filtros:**
  - Separador visual entre linha de pesquisa/categorias e linha de preço/espessura (`height: 1`, `background: rgba(255,255,255,0.08)`).
  - Mais espaçamento (`gap: 16`, `gap: 12`), labels com `fontWeight: 500`.
  - Inputs de preço e espessura com largura 80px.
- Consistência com o restante do Admin (cores, radius, Panel).

### 8) Botão “Duplicar Material”

- **Local:** Em cada card, ao lado de Editar e Eliminar.
- **Comportamento ao clicar:**
  - Chama `duplicateMaterial(id)` no serviço.
  - Cria um novo material com os mesmos dados (label alterado para `"... (cópia)"`), novo `id` gerado pelo serviço.
  - Recarrega a lista e abre o drawer já preenchido com o material duplicado (edição do novo registo).
- **Garantias:** O serviço não copia o `id`; gera novo com `generateId()`. Sem conflitos.

### 9) Exportar / Importar Materiais (JSON)

- **Botões no topo:**
  - **“Exportar Materiais”:** Continua a descarregar um ficheiro JSON com todos os materiais do CRUD (nome `pimo-materiais-YYYY-MM-DD.json`).
  - **“Importar Materiais”:** Abre o seletor de ficheiro do sistema; ao escolher um `.json`, o conteúdo é lido e o painel de importação é aberto com o JSON no textarea (o utilizador pode editar e clicar em Importar).
- **Alternativa “Colar JSON”:** Alterna a visibilidade do painel de importação para colar JSON manualmente.
- **Painel de importação:**
  - Texto explicativo: merge e evita duplicados por nome.
  - Input “Escolher ficheiro” para selecionar outro JSON.
  - Textarea para colar ou editar JSON.
  - Botão “Importar (merge: evita duplicados por nome)” e “Cancelar”.
- **Regras (já existentes no serviço):**
  - Evitar duplicados: comparação por label (case-insensitive); em modo merge não insere se já existir.
  - Manter categorias e campos existentes nos objetos importados.
  - Não sobrescrever materiais existentes (apenas inserir novos).

### 10) Garantias

- Nenhuma alteração em MaterialLibrary nem Viewer.
- Nenhuma alteração em CNC, PDF ou Cutlist.
- Nenhuma alteração na página Materiais & Fabricação.
- Apenas a UI/UX da página Admin → Materials foi alterada.
- Compatibilidade com materiais migrados mantida (categoria "industrial", tipo "Migrado").

---

## 2. Ficheiros alterados

| Ficheiro | Alterações |
|----------|------------|
| `src/pages/admin/materials/GestaoMateriaisPage.tsx` | Quick View overlay com `hoveredCardId` e `pointer-events: none`; melhorias no grid (gap, minmax); cards com bordas 10px, sombra leve, badge de tipo; área de filtros com separador e espaçamento; botão “Importar Materiais” com input de ficheiro e painel com “Escolher ficheiro”; texto “Exportar Materiais”; helper `getTypeLabel` e `handleImportFile` para leitura de ficheiro. |

Nenhum ficheiro do serviço de materiais (CRUD), MaterialLibrary, Viewer, CNC, PDF, Cutlist ou Materiais & Fabricação foi alterado nesta parte.

---

## 3. Como funciona o Quick View

- **Estado:** `hoveredCardId: string | null` — guarda o `id` do material cujo card está sob o rato.
- **Eventos:** Cada card tem `onMouseEnter={() => setHoveredCardId(m.id)}` e `onMouseLeave={() => setHoveredCardId(null)}`.
- **Renderização:** Quando `hoveredCardId === m.id`, é renderizado um `div` em `position: absolute` no topo do card, com fundo escuro, borda inferior e `pointerEvents: "none"`, exibindo nome, categoria, espessura, preço e tipo.
- **Leve e sem bloquear cliques:** O overlay não recebe eventos de rato; os cliques nos botões do card (Editar, Duplicar, Eliminar) funcionam normalmente. Ao sair do card, o overlay desaparece de imediato.

---

## 4. Como funciona duplicação, exportação e importação

### Duplicação

- **Serviço:** `duplicateMaterial(id)` em `src/core/materials/service.ts` (já existente).
- Lê o material por `id`, cria um novo registo com `createMaterial({ ...dados, label: source.label + " (cópia)" })` (novo `id` gerado).
- **Página:** Ao clicar em “Duplicar”, chama `duplicateMaterial(m.id)`; se sucesso, faz `reload()` e `openEdit(result.material.id)` para abrir o drawer com o material duplicado.

### Exportação

- **Serviço:** `exportMaterialsAsJson()` devolve uma string JSON com o array de todos os materiais.
- **Página:** O botão “Exportar Materiais” gera um `Blob` e um link de download com nome `pimo-materiais-YYYY-MM-DD.json`.

### Importação

- **Serviço:** `importMaterialsFromJson(json, { merge: true })` (já existente). Em modo merge, não insere se já existir material com o mesmo label (case-insensitive). Mantém categorias e restantes campos dos objetos importados; não sobrescreve registos existentes.
- **Página:**
  - “Importar Materiais”: input `type="file"` (aceita `.json`); ao selecionar ficheiro, `FileReader` lê o texto, preenche o textarea e abre o painel de importação.
  - “Colar JSON”: mostra/esconde o painel com textarea.
  - No painel, “Escolher ficheiro” permite selecionar outro JSON (mesmo fluxo).
  - “Importar (merge: evita duplicados por nome)” envia o conteúdo do textarea para `importMaterialsFromJson`, faz `reload()` se houve importados e mostra toast com resultado.

---

## 5. Confirmação de que a página Materials está estável e funcional

- **CRUD:** Criar, editar e eliminar materiais continuam a usar o mesmo serviço e localStorage. A migração de materiais antigos continua a ser executada ao montar a página.
- **Quick View:** Aparece e desaparece corretamente; não interfere com cliques.
- **Duplicar:** Gera sempre novo `id` e abre o drawer com o novo material.
- **Exportar/Importar:** Export gera JSON válido; import com merge evita duplicados por nome e mantém dados existentes. Input de ficheiro e colar JSON funcionam em conjunto.
- **Garantias:** Nenhuma alteração fora da página Admin → Materials. A página está estável e pronta para uso na Etapa 6 da Fase 3.
