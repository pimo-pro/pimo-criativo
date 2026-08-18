# PIMO-Criativo — Plano de limpeza (hub oficial)

| Campo | Valor |
|-------|--------|
| **Versão do plano** | 1.19 |
| **Estado** | Fases **1.3–1.12 (L-03 → L-30) executadas**; **Z-01.2.1** a **Z-01.2.4** executados em 18 de Agosto de 2026 |
| **Modo actual** | Pós-execução L-, Z-01.2.1–Z-01.2.4; restante Z-01.2 em **planeamento** |
| **Data da leitura inicial** | 18 de Agosto de 2026 |
| **Última actualização do plano** | 18 de Agosto de 2026 |
| **Método** | Leitura real do código como fonte primária; relatórios externos só para reconciliação |
| **Âmbito** | Repositório completo, incluindo ficheiros industriais protegidos (só leitura) |
| **Próximo passo** | Próximo código Viewer: **Z-01.2.5** (`ProjectLoader` + `ProjectFormatAdapter`) só com gatilho. L-01/L-02, 1.13 (L-12/L-13) e 1.14 (L-18/L-20) continuam pendentes. |

Este documento é a **fonte de verdade única** das decisões de limpeza. Qualquer execução futura deve referenciar IDs (`L-`, `D-`, `F-`, `R-`, `P-`, `Z-`) e actualizar o estado aqui.

**Não executar nada com base neste ficheiro sem aprovação explícita** (ex.: «aplica Fase 1.3»). Sugestões de «aplicar Fase X» existem **apenas como texto** neste plano — sem diffs, sem commits, sem refactors.

Resumo visual complementar (não SSOT): [plano-limpeza.canvas.tsx](../canvases/plano-limpeza.canvas.tsx) no workspace Cursor.

---

## 0. Governança desta fase (obrigatório)

### 0.1 O que é permitido agora

| Permitido | Proibido |
|-----------|----------|
| Actualizar **este** ficheiro (`docs/PIMO-CRIATIVO-PLANO-LIMPEZA.md`) | Aplicar Fases 0–5 **não** aprovadas |
| Reconciliar relatórios técnicos com evidência de código | Apagar, mover ou refactorar ficheiros de produto **fora** dos lotes L- aprovados |
| Reclassificar itens (morto ↔ fantasma ↔ duplicado) | Alterar TCN, DRILL, PI, `industrialOutputGuard`, geradores industriais |
| Documentar zonas protegidas e dependências | Tocar em `src/validation/` excepto para **manter** testes verdes numa fase futura |
| Ajustar prioridades, riscos e estrutura de IDs | Criar código novo, rotas, endpoints ou scripts de runtime |

A regra L- («remover ficheiros sem uso») está **activa**. As fases 1.3–1.12 foram executadas em 18-08-2026. Novos lotes **não** avançam sem gatilho explícito.

---

## 0.5 Relatório de execução — 18 de Agosto de 2026

**Gatilho:** pedido explícito do dono do produto (Khaled) para aplicar Fases 1.3–1.12 (L-03 → L-30).

**Pré-checagens (todas OK):**
1. Grep estático: zero consumidores activos dos alvos (excluindo auto-referências e este plano).
2. Sem participação em viewer-engine / ViewerCore / BoxBuilder / pipeline industrial / routing / Supabase / PHP / CI.
3. Sem carregamento dinâmico (`import()` / barrels) dos alvos.
4. `src/api/apiClient.ts` e `useProjectsUIOverlay` **não** foram tocados (homónimos vivos).
5. `layoutWarnings.ts` **mantido**.
6. `scripts/backupManager.ts` **mantido**.

**Companion necessário:** `src/core/layout/utils.ts` removido com L-05 porque importava `./types.ts` e não tinha consumidores — caso contrário o `tsc` quebrava.

**Não executado:** L-01, L-02, L-12, L-13, L-18, L-20, L-22, zonas P-/Z-, `dist/`, `docs/RELATORIO_*`, `ferragens_3d/RELATORIO_*`.

### Ficheiros removidos por fase

| Fase | IDs | Removido |
|------|-----|----------|
| 1.3 | L-03, L-04 | `src/hooks/useProjects.js`, `src/services/apiClient.js` |
| 1.4 | L-05…L-08 | `service.ts`, `hooks.ts`, `types.ts`, `utils.ts` (companion), `smartArrange.ts`, `viewerLayoutAdapter.ts`, `pieceMaterialExtension.ts` em `src/core/layout/` |
| 1.5 | L-09…L-11 | `drawerGroup3D.ts`, `drawerTransforms.ts`, `drawerPlacement3D.ts` |
| 1.6 | L-14, L-15 | `tests/export.test.ts`, `tests/projectState.test.ts` |
| 1.7 | L-25 | 16× `*.diff`/`*.patch` na raiz |
| 1.8 | L-26 | 4 relatórios (html/txt/hífen) na raiz |
| 1.9 | L-27 | 33× `RELATORIO_*.md` na raiz |
| 1.10 | L-28 | pastas `tmp/` e `test-output/`; entradas no `.gitignore` |
| 1.11 | L-29 | `src/3d/viewer-engine/cleanup/ViewerCleanupReport.ts` |
| 1.12 | L-30 | `DocumentacaoSistemaLegacy.tsx.bak`, `_extract_preview.json` |

**Impacto em fluxos vivos:** nenhum. ViewerCore, BoxBuilder, cutlayout, TCN, DRILL, PI, routing, Supabase e PHP não foram alterados.

### 0.2 Hierarquia de fontes

1. **Código actual** (`grep`, leitura de ficheiros, imports reais) — verdade técnica.
2. **Este plano** — decisões de limpeza consolidadas.
3. **Relatórios no repo** — contexto histórico; podem estar desactualizados (ver §0.3).
4. **Conversas / análises externas** (ex.: sessão Cursor «Project code analysis report», Aug 2026) — input para reconciliação, não SSOT.

**Nota:** Não foi encontrado no repositório um ficheiro nomeado «Cliny» ou «VS Code/Cliny». A reconciliação abaixo usa a análise profunda da sessão Cursor (subagentes + grep) e relatórios `RELATORIO_*` / `docs/` existentes no repo.

### 0.3 Reconciliação com relatórios técnicos

| Fonte | Data | Usar como SSOT? | Alinhamento com plano v1.1 |
|-------|------|-----------------|----------------------------|
| Leitura profunda Cursor (Aug 2026) | 2026-08-18 | **Sim** (base) | Origem do plano v1.0 |
| `RELATORIO_AUDITORIA_TECNICA_POS_MIGRACAO_FASES1-7_2026-03-06.md` | 2026-03-06 | Parcial | Confirma pipeline drill/cutlist; `buildBoxLegacy` é **vivo** (nomenclatura legacy, não morto). `buildBasicDrillOperations` **já não existe** em `cncExport.ts` actual — item histórico |
| `RELATORIO_LIMPEZA_CODIGO.md` | 2025-02-11 | Histórico | Remoções **já executadas** (`Documentation.tsx`, `docsLoader.ts`, etc.) — não repetir |
| `RELATORIO_TECNICO_PIMO_CRIATIVO_COMPLETO.md` | 2026-06 | **Não** | Descreve `features.eventsSystem` e `useCadModelsSync` como existentes — **falso** no código actual (F-05, F-15) |
| `docs/auditoria-tecnica.md` | 2025 | **Não** | Arquitectura pré-migração viewer; referencia `PimoViewerClean`, `useCadModelsSync` — obsoleto |
| `RELATORIO_LIMPEZA_CODIGO.md` + 37× `RELATORIO_*` na raiz | várias | Histórico / ruído | Ver L-27, R-18 — documentação não é runtime mas confunde onboarding |
| `ViewerCleanupReport.ts` | 2026-05 | Interno | Lista limpezas viewer já feitas; **L-29** (ex-L-26) |

### 0.4 Legenda de categorias

| Prefixo | Significado | Exemplo |
|---------|-------------|---------|
| **L-** | Código morto — zero consumidores ou stub no-op | `useProjects.js` |
| **D-** | Duplicação / sobreposição activa ou estrutural | 4× TCN, 3× PHP |
| **F-** | Fantasma — chamada ou doc sem implementação / efeito real | `GET /projects` Axios |
| **R-** | Risco técnico, segurança ou processo | JWT fallback |
| **P-** | **Zona protegida** — não limpar; só documentar dependências | golden drill, PI |
| **Z-** | Zona de auditoria: dormida (Z-02…Z-04) **ou** expositor vivo (Z-01 ViewerCore) — não apagar sem cadeia auditada | `ViewerCore.ts` / dashboard |

---

## 1. Mapa geral da arquitectura actual

O produto é um **monólito React 19 + TypeScript + Three.js + PHP Hostinger + Supabase**. Não existe backend Node/Express.

```
Browser
  main.tsx → AuthProvider (JWT PHP / local-auth)
    App.tsx (React Router)
      ├── LegacyApp  (/ , /:projectSlug, /admin)
      │     Workspace → ViewerCore (Three.js)
      │     ProjectProvider → ProjectState (SSOT mm)
      └── Rotas modernas
            /dashboard, /projects, /industrial/*, /PROJETOS/*, /nesting_v3, /v4

Persistência
  PHP Hostinger: auth, users, settings, projects JSON, industrial/orders JSON
  Supabase: TRAK (industrial_work_orders*) + legado (work_orders)
  localStorage / IndexedDB: settings, autosave, offline projects

Fabricação (core, sem servidor)
  cutlistFromBoxes → drillingService → cutlayout → TCN/TXML/PDF
  (gate: industrialOutputGuard — zona P-02)
```

### 1.1 Pastas da raiz — classificação

| Pasta / ficheiro | Papel | Classificação |
|------------------|-------|----------------|
| `src/` | Aplicação (~2089 TS/TSX) | **Canónico** |
| `public/` | Assets, SSOT Excel/JSON, docs industriais | **Canónico** |
| `hostinger/api/` | PHP de projectos (fonte de deploy) | **Canónico deploy** |
| `api/` | PHP auth/users/settings/orders + `materials.ts` | **Canónico deploy** |
| `public_html/` | Stubs PHP + cópia projects | **Duplicata de deploy** (D-01) |
| `supabase/` | 27 migrations | **Canónico TRAK** |
| `scripts/` | Build, CNC bench, hub docs (~124) | **Ferramentas** + artefactos |
| `tests/` | 11 testes (2 placeholders L-14/L-15) | **CI** |
| `data/projects/` | 3 samples JSON locais | **Dev / não produção** (F-11) |
| `ferragens_3d/` | GLTF + medidas | **Runtime industrial UI** |
| `backend/` | 1 JSON órfão | **Fantasma** (F-09) |
| `services/` (raiz) | Vazia | **Fantasma** (L-01) |
| `tmp/`, `test-output/` | Sobras internas (L-28) | **Removidas**; no `.gitignore` |
| `dist/` | Artefacto de build | **Fora de L-28** (gerado pelo build) |
| `dev/` | Gitignored | Fora de publicação |
| `*.diff`, `*.patch` (raiz) | 16 patches/diffs na raiz (inventário Aug 2026) | **Lixo de repo** (L-25) |
| `RELATORIO_*` (raiz) | 37 resíduos documentais (4 em L-26 + 33 em L-27) | **Ruído documental** |

### 1.2 Camadas `src/` (contagem TS/TSX)

| Pasta | Ficheiros | Papel |
|-------|-----------|-------|
| `core/` | ~797 | Domínio: cutlist, CNC, gavetas, financeiro, PDF, drill |
| `components/` | ~266 | UI workspace, admin, showroom |
| `3d/` | ~241 | Motor Three.js + geometria |
| `industrial/` | ~229 | TRAK + persistência Supabase |
| `app/` | ~119 | Rotas industrial / PROJETOS / nesting |
| `admin/` | ~73 | Editores de regras |
| `pages/` | ~69 | Páginas React Router |
| `validation/` | ~63 | Contratos industriais (**zona P-06**) |
| `context/` | ~55 | ProjectState, viewer context |
| `v4/` | ~24 | Experimento TEMPORARY |
| `viewer/` | 4 | Fachada de tipos/utils (não é o motor) |
| `src/services/` | 3 | `boxLayersService` + `drawerCutlistAdapter` (**vivos**) + `apiClient.js` (**morto** L-04) |

### 1.3 Fluxo crítico runtime (zona P — não mexer sem plano dedicado)

1. `actions.*` → `recomputeState` (`context/projectState.ts`) — SSOT paramétrico.
2. `cutlistComPrecoFromBox` (`cutlistFromBoxes.ts`) — única fonte cutlist paramétrica (auditoria Fase 7).
3. `drillingService` + `drillingAdapter` — faces A/B, topDrillable (zona P-03).
4. `useCalculadoraSync` → fingerprints → `addBox` / `updateBox` / `removeBox`.
5. `ViewerCore` (~6112 linhas) → `BoxSceneController` → `buildBoxLegacy` (= `buildBoxGroup`).
6. Export: `industrialOutputGuard` → `cutlayout` → `cncExport` (4 geradores TCN — zona P-04 observação only).

Unidades: **mm** no domínio, **metros** no Three.js.

---

## 2. Zonas protegidas (`P-`) — documentação apenas

**Regra:** Nenhuma fase de limpeza 0–2 pode alterar estes sistemas. Fases 4–6 só com dono industrial, testes `src/validation/` verdes e pedido explícito.

| ID | Zona | Caminhos principais | Dependências runtime | Risco se tocado |
|----|------|---------------------|----------------------|-----------------|
| P-01 | Golden laterais módulo | `src/core/drill/golden/*`, `PROTECTED_DRAWER_LATERAL_TIPOS` | Export TXML, testes golden | Regressão fábrica |
| P-02 | Gate export industrial | `src/core/industrial/industrialOutputGuard.ts` | TCN, TXML, PDF layout, worker | Export bloqueado ou bypass |
| P-03 | Pipeline furação SSOT | `src/core/drilling/drillingService.ts`, `src/modules/drilling/drillingAdapter.ts` | cutlist, viewer overlay, DRILL export | Divergência A/B / CNC |
| P-04 | Geradores TCN | `src/core/cnc/tcnGenerator*.ts`, `cncExport.ts` | Settings `cnc.tcnMetodo`; golden SHA256 em testes | Máquina errada |
| P-05 | Cutlayout / nesting industrial | `src/core/cutlayout/**` | CNC pipeline, PDF chapas | Layout produção |
| P-06 | Contratos validação | `src/validation/**`, testes co-localizados em `core/**` | CI industrial; paridade viewer↔XML↔PDF | Regressão silenciosa |
| P-07 | Dados PI | `src/data/moveisUnificados/pi/**` | `isPiBaseCabinetId`, cutlist, viewer sync | Mobiliário PI quebrado |
| P-08 | SSOT financeiro / materiais | `financeiroUnificado`, `public/config/pricing.json`, `materiais-ssot.xlsx` | Relatório final, orçamentos | Preços errados |
| P-09 | Ficheiros `.legacy` só testes | `drawerLowestFrenteExtFixedHoles.legacy.ts` | Golden gaveta; **não** produção | Quebra testes golden |
| P-10 | Worker geração industrial | `src/workers/industrialGeneration.worker.ts` | Export ZIP off-main-thread | UI bloqueada |

**Nota sobre `buildBoxLegacy`:** Não é zona morta — é alias activo de `buildBoxGroup` usado por `BoxSceneController`, showroom e v4 (D-19 nomenclatura).

---

## 3. Código morto (`L-`)

Critério: zero consumidores externos, stub no-op, placeholder de teste, ou artefacto não-runtime.

| ID | Item | Caminho | Evidência | Impacto runtime | Risco remoção |
|----|------|---------|-----------|-----------------|---------------|
| L-01 | Pasta `services/` vazia | `services/` | Zero ficheiros | Nenhum | Nulo |
| L-02 | Fixture backend | `backend/backend/data/projects/project-pimo-mn5tsivc-zcrvwgfl.json` | Sem servidor; sem imports | Nenhum | Nulo |
| L-03 | Hook projectos JS | `src/hooks/useProjects.js` | Zero imports `from ".../useProjects"` | Nenhum | **Nulo** — **Executado** (Fase 1.3; executado 18-08-2026) |
| L-04 | Cliente API JS legado | `src/services/apiClient.js` | Só usado por L-03; zero referências no código actual | Nenhum | **Nulo** — **Executado** (Fase 1.3; executado 18-08-2026) |
| L-05 | Layout engine skeleton | `src/core/layout/service.ts`, `hooks.ts`, `types.ts` | `@placeholder`; `useLayoutEngine` sem consumidores | Nenhum | **Nulo** — **Executado** (Fase 1.4; executado 18-08-2026) |
| L-06 | Smart arrange CAD | `src/core/layout/smartArrange.ts` | `autoArrangeModels` sem imports externos | Nenhum | **Nulo** — **Executado** (Fase 1.4; executado 18-08-2026) |
| L-07 | Adapter layout↔viewer | `src/core/layout/viewerLayoutAdapter.ts` | Só usado por L-06 | Nenhum | **Nulo** — **Executado** (Fase 1.4; executado 18-08-2026) |
| L-08 | Extensão material preview | `src/core/layout/pieceMaterialExtension.ts` | Zero registos `setApplyPieceMaterialToPreview` | Nenhum | **Nulo** — **Executado** (Fase 1.4; executado 18-08-2026) |
| L-09 | Stub gaveta 3D grupo | `src/3d/groups/drawerGroup3D.ts` | Modelo B removido; zero imports | Nenhum | **Nulo** — **Executado** (Fase 1.5; executado 18-08-2026) |
| L-10 | Stub transforms gaveta | `src/3d/transforms/drawerTransforms.ts` | Devolve `null`; zero imports | Nenhum | **Nulo** — **Executado** (Fase 1.5; executado 18-08-2026) |
| L-11 | Stub placement gaveta | `src/3d/placement/drawerPlacement3D.ts` | Modelo B removido; zero imports | Nenhum | **Nulo** — **Executado** (Fase 1.5; executado 18-08-2026) |
| L-12 | SelectionManager deprecated | `src/3d/viewer-engine/selection/SelectionManager.ts` | `@deprecated`; export no barrel local; ViewerState activo | Nenhum | Baixo |
| L-13 | Re-export drawers viewer | `src/viewer/layers/resolveActiveDrawersLayer.ts` | Zero imports; SSOT em `core/drawers` | Nenhum | Nulo |
| L-14 | Teste placeholder export | `tests/export.test.ts` | `expect(true).toBe(true)` | CI falso-positivo | **Nulo** — **Executado** (Fase 1.6; executado 18-08-2026) |
| L-15 | Teste placeholder projectState | `tests/projectState.test.ts` | Idem | CI falso-positivo | **Nulo** — **Executado** (Fase 1.6; executado 18-08-2026) |
| L-16 | Archive `.bak` | `src/core/docs/archive/DocumentacaoSistemaLegacy.tsx.bak` | Backup | Nenhum | **Absorvido em L-30** — **Executado** (Fase 1.12; 18-08-2026) |
| L-17 | Extract preview JSON | `src/core/docs/archive/_extract_preview.json` | Artefacto equivalente na mesma pasta | Nenhum | **Absorvido em L-30** — **Executado** (Fase 1.12; 18-08-2026) |
| L-18 | Recover hub | `scripts/_ProjectProgress_recover.tsx` | Fora da app | Nenhum | Nulo |
| L-20 | Wrapper Ajuda deprecated | `src/pages/Ajuda.tsx` | Re-export; zero imports (rota usa `ajuda/AjudaPage`) | Nenhum | Nulo |
| L-22 | Wrapper relatório final | `src/pages/RelatorioFinalProjeto.tsx` | Re-export; rota usa `RelatorioFinalRoute` | Indireto | Baixo |
| L-25 | Patches/diffs raiz | 16× `*.diff` / `*.patch` na raiz do repo | Histórico git; zero imports; fora de CI/build/deploy | Nenhum | **Nulo** — **Executado** (Fase 1.7; executado 18-08-2026) |
| L-26 | Relatórios antigos na raiz (lote 4) | `RELATORIO-FINAL.md`, `RELATORIO_EXECUTIVO.txt`, `RELATORIO_TECNICO_COMPLETO.html`, `RELATORIO_TECNICO_FINAL_RECONSTRUCAO_DOORS_DRAWERS.html` | Resíduos documentais; zero imports; fora de CI | Nenhum | **Nulo** — **Executado** (Fase 1.8; executado 18-08-2026) |
| L-27 | Relatórios `RELATORIO_*.md` na raiz | 33× `RELATORIO_*.md` na raiz | Não importados; SSOT falso (F-12); fora de CI/build/deploy | Nenhum | **Nulo** — **Executado** (Fase 1.9; executado 18-08-2026) |
| L-28 | Sobras internas em pastas secundárias | `tmp/` (~10 ficheiros), `test-output/` (~55 ficheiros); âmbito também `old/`, `draft/`, `experiments/`, `legacy/`, `unused/` se existirem na raiz | Zero imports; fora de CI/build/deploy; **não** no `.gitignore` | Nenhum | **Nulo** — **Executado** (Fase 1.10; executado 18-08-2026) |
| L-29 | ViewerCleanupReport | `src/3d/viewer-engine/cleanup/ViewerCleanupReport.ts` (pasta `cleanup/` só contém este ficheiro) | Zero imports em `src/`; resíduo documental (ex-L-26) | Nenhum | **Nulo** — **Executado** (Fase 1.11; executado 18-08-2026) |
| L-30 | Resíduos finais (padrões) | `backup_*`, `notes_*`, `analysis_*`, `draft_*`, `temp_*`, `*.old`, `*.bak`, `*.copy`, `*.unused`, `*.deprecated` + equivalentes | Glob Aug 2026: 1× `*.bak` + 1× JSON archive; restantes padrões **ausentes** | Nenhum | **Nulo** — **Executado** (Fase 1.12; executado 18-08-2026) |

**Removido de L- (reclassificado):**

| Antigo ID | Novo ID | Motivo |
|-----------|---------|--------|
| L-19 `useCadModelsSync` | **F-15** | Fantasma documental — ficheiro não existe; só `projectRoadmap.ts` |
| L-21 `ajuda/AjudaPage.tsx` | **D-14** (mantido) | **Activo** — importado por `ajudaRoutes.tsx`; é re-export, não morto |
| L-23 integration/ui | **Z-04** (ex-Z-01) | Cadeia interna; zero imports em `app/`; ID libertado para o expositor Viewer |
| L-16 / L-17 | **L-30** | Absorvidos no lote de resíduos finais (Fase 1.12) |
| L-24 dashboard core | **Z-02** | Cadeia metrics→dashboard→analytics; zero UI TRAK |

### 3.1 Regras gerais e decisões de remoção aprovadas (executado 18-08-2026)

**Regra L- (oficial):** Remover definitivamente qualquer ficheiro que não seja usado e que não quebre o projecto.

> Regra aprovada pelo dono do produto (Khaled): todo ficheiro sem uso, sem referências e sem impacto no produto deve ser removido definitivamente nas fases L-.

Esta regra **não** autoriza execução automática. Cada lote continua a ser aprovado manualmente pelo dono do produto (Khaled), com gatilho explícito (ex.: «aplica Fase 1.8 — L-26»).

Nenhuma das remoções abaixo foi aplicada. A aprovação autoriza a execução **apenas** quando o dono do produto pedir explicitamente o passo correspondente.

| Passo | IDs | Decisão | Status | Execução | Justificação | Aprovado por |
|-------|-----|---------|--------|----------|--------------|--------------|
| **Fase 1.3** | **L-03**, **L-04** | **Remoção definitiva** | **Executado** | **Concluída** (18-08-2026). Gatilho: «aplica Fase 1.3 — L-03 + L-04» | Remoção segura — sistema antigo — zero referências — aprovado pelo dono do produto (Khaled). Fluxo real de projectos: `listProjects` + `/api/projects/index.php`. Não participam em industrial, viewer, routing, Supabase nem PHP. Sem plano de reactivação. | Khaled (dono do produto) |
| **Fase 1.4** | **L-05**, **L-06**, **L-07**, **L-08** | **Remoção definitiva** | **Executado** | **Concluída** (18-08-2026). Gatilho: «aplica Fase 1.4 — L-05 – L-08» | Remoção segura — sistema antigo de Layout — zero referências — aprovado pelo dono do produto (Khaled). Layout Engine nunca concluído; substituído por `cutlayout`, `nesting3`, `drill`, `cnc`, `drawers`, `remate`. **Excluído:** `layoutWarnings.ts` (activo). | Khaled (dono do produto) |
| **Fase 1.5** | **L-09**, **L-10**, **L-11** | **Remoção definitiva** | **Executado** | **Concluída** (18-08-2026). Gatilho: «aplica Fase 1.5 — L-09 – L-11» | Remoção segura — stubs 3D experimentais — zero referências — aprovado pelo dono do produto (Khaled). Modelo B nunca concluído; substituído pelo ViewerCore / `viewer-engine`. **Excluído:** ViewerCore, BoxBuilder, L-12 (`SelectionManager`), L-13. | Khaled (dono do produto) |
| **Fase 1.6** | **L-14**, **L-15** | **Remoção definitiva** | **Executado** | **Concluída** (18-08-2026). Gatilho: «aplica Fase 1.6 — L-14 + L-15» | Remoção segura — testes placeholder — zero referências — aprovado pelo dono do produto (Khaled). Não testam nenhum módulo real; CI actual não depende deles. **Excluído:** restantes testes em `tests/` e `src/validation/`. | Khaled (dono do produto) |
| **Fase 1.7** | **L-25** | **Remoção definitiva** | **Executado** | **Concluída** (18-08-2026). Gatilho: «aplica Fase 1.7 — L-25» | Remoção segura — patches/diffs experimentais no raiz — zero referências — aprovado pelo dono do produto (Khaled). Inventário actual: 16 ficheiros `*.diff`/`*.patch` na raiz (o plano v1.0–1.6 dizia 13). **Excluído:** patches noutros caminhos, código de produto, CI. | Khaled (dono do produto) |
| **Fase 1.8** | **L-26** | **Remoção definitiva** | **Executado** | **Concluída** (18-08-2026). Gatilho: «aplica Fase 1.8 — L-26» | Remoção segura — relatórios antigos no raiz — zero referências — aprovado pelo dono do produto (Khaled). Lote: 4 resíduos `relatorio*` na raiz (html/txt/hífen). **Excluído:** L-27 (lote separado), `docs/`, `ferragens_3d/`, páginas `RelatorioFinal*`, L-29 (`ViewerCleanupReport`). | Khaled (dono do produto) |
| **Fase 1.9** | **L-27** | **Remoção definitiva** | **Executado** | **Concluída** (18-08-2026). Gatilho: «aplica Fase 1.9 — L-27» | Remoção segura — relatórios antigos `RELATORIO_*` — zero referências — aprovado pelo dono do produto (Khaled). 33× `RELATORIO_*.md` na raiz. **Excluído:** L-26 (já aprovado à parte), `docs/RELATORIO_*`, `ferragens_3d/RELATORIO_*`, páginas `RelatorioFinal*`. | Khaled (dono do produto) |
| **Fase 1.10** | **L-28** | **Remoção definitiva** | **Executado** | **Concluída** (18-08-2026). Gatilho: «aplica Fase 1.10 — L-28» | Remoção segura — sobras internas em pastas secundárias — zero referências — aprovado pelo dono do produto (Khaled). Inventário actual: `tmp/` + `test-output/`. Pastas `old/`, `draft/`, `experiments/`, `legacy/`, `unused/` **não existem** neste clone. **Excluído:** `dist/`, `node_modules`, `*.legacy.ts` (P-09), `src/core/docs/archive` (L-16/L-17). | Khaled (dono do produto) |
| **Fase 1.11** | **L-29** | **Remoção definitiva** | **Executado** | **Concluída** (18-08-2026). Gatilho: «aplica Fase 1.11 — L-29» | Remoção segura — ViewerCleanupReport.ts — zero referências — aprovado pelo dono do produto (Khaled). Pasta `cleanup/` só tem este ficheiro (remove-se também se ficar vazia). **Excluído:** ViewerCore, resto de `viewer-engine`, BoxBuilder, L-12. | Khaled (dono do produto) |
| **Fase 1.12** | **L-30** | **Remoção definitiva** | **Executado** | **Concluída** (18-08-2026). Gatilho: «aplica Fase 1.12 — L-30» | Remoção segura — resíduos finais no raiz e pastas secundárias — zero referências — aprovado pelo dono do produto (Khaled). Inclui L-16/L-17. **Excluído:** `scripts/backupManager.ts` (produto), `tmp/encoding-backup` (L-28), `*.legacy.ts` (P-09), L-18, L-20. | Khaled (dono do produto) |

**Vivo — não confundir com L-05…L-11:**

- `src/core/layout/layoutWarnings.ts` — usado por `projectState.ts`, `LayoutWarningsAlert.tsx`.
- ViewerCore / `src/3d/viewer-engine/` / `BoxBuilder` — motor 3D de produção; **não** são L-09…L-11 nem L-29.
- Restantes testes em `tests/` e `src/validation/` — **activos**; **não** são L-14/L-15.
- Páginas `RelatorioFinal*` / `src/core/projectReport/` — **produto**; **não** são L-26 nem L-27.
- `docs/RELATORIO_*`, `ferragens_3d/RELATORIO_*` — **fora da raiz**; **não** são L-26 nem L-27.
- `dist/` (build), `node_modules`, ficheiros `*.legacy.ts` (P-09) — **não** são L-28 nem L-30.
- `scripts/backupManager.ts` — **produto**; **não** é L-30.

**Inventário L-25 (raiz, Aug 2026) — executado 18-08-2026; ficheiros removidos:**

```
auth-layout-refactor.diff
auth-pages-final.diff
auth-pages-original-shell.diff
cnc_albatros_hotfix.patch
dashboard-projects-final.diff
final-auth-pages.diff
final-dashboard-projects.diff
final-saas-polish.diff
final-ui-components.diff
frontend-user-admin.diff
industrial-list-fix.patch
nesting_hotfix.patch
rotation_diff.patch
ui-components-final.diff
ui-reforma-completa.diff
wood-grain-nesting.patch
```

**Inventário L-26 (raiz, Aug 2026) — executado 18-08-2026; ficheiros removidos:**

```
RELATORIO-FINAL.md
RELATORIO_EXECUTIVO.txt
RELATORIO_TECNICO_COMPLETO.html
RELATORIO_TECNICO_FINAL_RECONSTRUCAO_DOORS_DRAWERS.html
```

Nota: o dono referiu 4 ficheiros `relatorio_*` na raiz. O inventário da raiz tem 37 `RELATORIO*` no total; os 33 `RELATORIO_*.md` restantes são **L-27** (Fase 1.9, Ready for Removal).

**Inventário L-27 (raiz, Aug 2026) — executado 18-08-2026; ficheiros removidos:**

```
RELATORIO_ANALISE_MATERIAIS_EXISTENTES.md
RELATORIO_ANALISE_PROJETO.md
RELATORIO_ANALISE_TECNICA.md
RELATORIO_ATUALIZACAO_DIMENSOES_PAINEIS.md
RELATORIO_AUDITORIA_TECNICA_POS_MIGRACAO_FASES1-7_2026-03-06.md
RELATORIO_CAMADAS_ZINDEX.md
RELATORIO_CORRECAO_COMPLETA_GAVETAS_MARCENARIA.md
RELATORIO_CORRECAO_ERRO_500_GESTAO_MATERIAIS.md
RELATORIO_CORRECAO_GAVETAS_COMPLETA.md
RELATORIO_CORRECOES_ESTRUTURAIS.md
RELATORIO_CRUD_MATERIAIS_FASE3_ETAPA1.md
RELATORIO_FASE3_ETAPA2_MATERIAIS_VIEWER_BOXES.md
RELATORIO_FASE3_ETAPA3_MATERIAIS_PROJETO.md
RELATORIO_FASE3_ETAPA4_MATERIAIS_PDF_CNC_CUTLIST.md
RELATORIO_FASE3_ETAPA6_MELHORIAS_MATERIALS.md
RELATORIO_FASE3_ETAPA6_PARTE2_MELHORIAS_MATERIALS.md
RELATORIO_FASE3_SKELETON.md
RELATORIO_FASE4_ETAPA8_PARTE1_MATERIAL_PRESETS.md
RELATORIO_FASE4_ETAPA8_PARTE2_MATERIALLIB_V2.md
RELATORIO_FASE4_ETAPA8_PARTE3_LAYOUT_MATERIAIS_UV.md
RELATORIO_FIX_OVERLAY_LOOP.md
RELATORIO_GESTAO_MATERIAIS_ADMIN.md
RELATORIO_IMPLEMENTACAO_FUROS_SUPERIORES.md
RELATORIO_LIMPEZA_CODIGO.md
RELATORIO_MELHORIAS_PRE_DEV.md
RELATORIO_MODELOS_CAIXAS_2026-03-05.md
RELATORIO_RECONSTRUCAO_PORTAS_GAVETAS_V3.md
RELATORIO_SIDEBAR_BOX_SELECIONADO.md
RELATORIO_SISTEMA_PI_TECNICO.md
RELATORIO_TAREFAS_PRE_FASE3.md
RELATORIO_TECNICO_COMPLETO.md
RELATORIO_TECNICO_PIMO_CRIATIVO_COMPLETO.md
RELATORIO_VALIDACAO_FERRAGENS_3D.md
```

**Inventário L-28 (Aug 2026) — executado 18-08-2026; ficheiros removidos:**

Pastas presentes:

```
tmp/Amostra_ferragens_totais.json
tmp/layout_gaveta_cavilhas_ssot.json
tmp/encoding-backup/ (8 ficheiros: backup de groups/transforms/placement/layers/DrawerFactory)
test-output/ (~55 ficheiros: PDFs de teste + xlsm-extract/)
```

Pastas nomeadas pelo dono **ausentes** neste clone: `old/`, `draft/`, `experiments/`, `legacy/`, `unused/`. Se existirem na execução, entram no mesmo lote **só** se forem pastas secundárias na raiz (não `src/**/*.legacy.ts`).

Após remoção: acrescentar `tmp/` e `test-output/` ao `.gitignore` (prevenção; faz parte do passo 1.10, não é um passo separado).

**Inventário L-29 (Aug 2026) — executado 18-08-2026; ficheiros removidos:**

```
src/3d/viewer-engine/cleanup/ViewerCleanupReport.ts
```

Artefacto associado: pasta `src/3d/viewer-engine/cleanup/` (só este ficheiro; remove-se se ficar vazia). Zero imports em `src/`. **Não** arquivar — remoção definitiva.

**Inventário L-30 (Aug 2026) — executado 18-08-2026; ficheiros removidos:**

Padrões do lote: `backup_*`, `notes_*`, `analysis_*`, `draft_*`, `temp_*`, `*.old`, `*.bak`, `*.copy`, `*.unused`, `*.deprecated` e equivalentes.

Hits actuais:

```
src/core/docs/archive/DocumentacaoSistemaLegacy.tsx.bak   (L-16, *.bak)
src/core/docs/archive/_extract_preview.json               (L-17, equivalente na mesma pasta)
```

Padrões **sem hits** neste clone: `backup_*`, `notes_*`, `analysis_*`, `draft_*`, `temp_*`, `*.old`, `*.copy`, `*.unused`, `*.deprecated`. Se aparecerem até à execução (raiz ou pastas secundárias), entram no mesmo lote.

**Limpeza histórica já feita** (não repetir — o ficheiro `RELATORIO_LIMPEZA_CODIGO.md` descreve remoções de 2025 **já aplicadas** no código; o próprio relatório é L-27):

- `Documentation.tsx`, `ProjectRoadmapStyles_new.ts`, `docsLoader.ts`, `ferragensIndustriaisPdf.ts` — **já removidos**.

---

## 4. Sistemas duplicados ou sobrepostos (`D-`)

| ID | Sistemas | Caminhos | Relação | Sugestão (texto only) | Impacto |
|----|----------|----------|---------|----------------------|---------|
| D-01 | 3 locais PHP | `api/`, `hostinger/`, `public_html/` | `copyDeployApiToDist.mjs` | Uma fonte deploy | Manutenção |
| D-02 | 3 clientes projectos | `src/api/projectsApi.ts`, `core/projects/*`, `apiClient.js` | Axios vs Fetch vs morto | Só `core/projects/*` | F-01 |
| D-03 | Work orders legado vs TRAK | `work_orders` vs `industrial_work_orders` | UI TRAK vs `industrial/core/work-orders/actions.ts` | Migração dados | R-07 |
| D-04 | Auth dupla | JWT PHP + Supabase + `local-auth` | Sessões independentes | Plataforma | SSO |
| D-05 | 4 geradores TCN | `tcnGenerator*.ts` | `settings.cnc.tcnMetodo` default `nesting_mo` | Deprecar v1/v2 (**P-04**) | Alto industrial |
| D-06 | 3 nestings | `cutlayout/`, `nesting3/`, `nesting-v3/` | Fallback híbrido em `nestingV3Engine` | Fundir após validar flag | Bundle |
| D-07 | 5 viewers 3D | ViewerCore, `src/viewer/`, v4, showroom, pimo-drill | Modos derivados + experimento | Isolar v4 | Confusão |
| D-08 | API tripla viewer | `window.viewerCore`, Context, `useViewerSync` | Stubs triplicados | Unificar API | React |
| D-09 | Sala dupla | `RoomManager` vs `RoomEngine` | Bind duplo em `useViewerRoom` | Interface única | Bugs parede |
| D-10 | Snap parede duplo | `ModelWallSnap` vs `SmartSnapping` | `ViewerCoreAudit.ts` | **Mitigado** em Z-01.2.3 (`SnapEngine`; SmartSnapping overlay-only) | Drag |
| D-11 | 3 camadas materiais | `core/`, `3d/`, `viewer-engine/materials/` | Domínio vs PBR | Renomear | Nomes |
| D-12 | 3 camadas regras | `core/rules/`, `admin/rules/`, snapping admin | Produto vs admin vs runtime | Mapa regra→runtime | Config |
| D-13 | Routing híbrido | React Router + `LegacyApp.pushState` | `/` legacy | Migrar rotas | URLs |
| D-14 | Ajuda triplicada | `HelpPage`, `Ajuda.tsx`, `ajuda/AjudaPage.tsx` | Re-exports | Um entry (`HelpPage`) | Nulo |
| D-15 | `.htaccess` duplicado | `public/` = `public_html/` | Idênticos | Fonte única build | Drift |
| D-16 | `version.json` duplicado | raiz + `public/` | CI carimba ambos | Documentar | Baixo |
| D-17 | Migrations SQL | `create_*.sql` vs `001_*.sql` | Ordem CI ambígua | Renumerar | Schema |
| D-18 | Materiais localStorage vs API | `core/materials/service.ts` vs `/api/materials` | SSOT split | Unificar | Preços |
| D-19 | Alias `buildBoxLegacy` | `BoxBuilder.ts:540` | Alias de `buildBoxGroup`; usado em 6+ sítios | Renomear gradualmente | Nomenclatura only |
| D-20 | `src/services/` vs raiz `services/` | Dois namespaces «services» | Raiz vazia; `src/services/` vivo | Remover L-01; documentar | Confusão |

---

## 5. Sistemas ou código fantasma (`F-`)

Critério: chamada, rota ou documentação sem implementação efectiva ou efeito no-op/404.

| ID | Item | Evidência | Efeito actual | Risco |
|----|------|-----------|---------------|-------|
| F-01 | `GET /projects` (Axios) | `projectsApi.ts`; `.htaccess` sem rewrite; `DashboardPage` também usa `listProjects()` | Erro remoto silenciável | Contagens erradas |
| F-02 | SGPI `/api/industrial/sgpi/*` | `industrialExportBridge.ts`; zero PHP | Catch silencioso; export OK | Falsa integração |
| F-03 | `/api/deploy` | TODO `DeployAdminPage.tsx` | UI sem backend | Admin enganoso |
| F-04 | Rewrites em falta | PHP `auth/register`, `user-settings`; `.htaccess` incompleto | SPA fallback | Auth online |
| F-05 | Events System | `features.eventsSystem` só em docs/rules; **zero código** | No-op | Plano vs código |
| F-06 | Rota `/v4` | `App.tsx` «TEMPORARY» | Experimento público | Superfície R3F |
| F-07 | `core/layout` Fase 3 | Skeleton com `@placeholder` (L-05…L-08) | **Removido** na Fase 1.4 | — |
| F-08 | `Viewer.events.emit` | Stub (auditoria viewer) | **Removido** em Z-01.2.1 | — |
| F-09 | Pasta `backend/` | Nome «servidor»; 1 JSON | Confusão | Onboarding |
| F-10 | `api/materials.ts` | Handler Node; runtime = `src/server/materialsApi.ts` | Órfão design? | Confusão |
| F-11 | `data/projects/` no git | Zero imports TS | Samples locais | Ruído clone |
| F-12 | `RELATORIO_TECNICO_PIMO_CRIATIVO_COMPLETO.md` | Events System como existente | Doc fantasma | Decisões erradas |
| F-13 | `landing-v4/` referenciado | Mencionado em relatório Jun/2026; **pasta não existe** em `src/` | Doc obsoleta | — |
| F-14 | `useCadModelsSync` em CLAUDE/roadmap | Hook documentado; **ficheiro inexistente**; sync via `addModelToBox` | Doc obsoleta | — |
| F-15 | (= ex-L-19) | `projectRoadmap.ts` referencia hook inexistente | Roadmap interno errado | — |

---

## 6. Zonas `Z-` — auditoria obrigatória antes de remover ou fatiar

Nota de governança (v1.14): o prefixo `Z-` nasceu como «zona dormida». **Z-01 foi reatribuído pelo dono do produto** à auditoria do expositor geral do Viewer (código **vivo**). A antiga Z-01 (integration UI industrial) passou a **Z-04**. Z-02 e Z-03 mantêm o significado original (dormidas).

| ID | Item | Caminho | Evidência | Porque não é L- |
|----|------|---------|-----------|-----------------|
| **Z-01** | **Expositor geral do Viewer** | `src/3d/viewer-engine/ViewerCore.ts` | **6112 linhas** — maior ficheiro TS/TSX de `src/`; orquestra cena, boxes, sala, snap, régua, materiais e engines de layout | **Vivo e crítico** — auditoria §6.1; plano de modularização **§6.2 (Z-01.2)**; **não apagar** |
| Z-02 | Dashboard + analytics | `industrial/core/dashboard/*`, `analytics/stats.ts` | Cadeia interna metrics→dashboard; sem UI | Pode alimentar supervisor futuro |
| Z-03 | Adapter WO legado | `legacyWorkflowWorkOrderAdapter.ts` | Exportado; documentado como ponte read-only | Transição TRAK (D-03) |
| **Z-04** | Integration UI industrial (**ex-Z-01**) | `src/industrial/integration/ui/*` | Zero imports em `src/app` | Tipos re-exportados; possível uso futuro TRAK |

**Contentor React (não é o alvo Z-01):** `src/components/layout/workspace/Workspace.tsx` (1439 linhas) monta o ViewerCore, liga bridges e overlays. É o casco UI, não o expositor 3D.

---

## 6.1 Z-01 — Auditoria completa do expositor geral (Viewer)

| Campo | Valor |
|-------|--------|
| **Estado** | Auditoria **concluída** (18-08-2026). Plano de modularização em **§6.2**. Código **não** iniciado. |
| **Gatilho de código** | Nenhum. Qualquer fatiamento futuro exige pedido explícito (ex.: «aplica Z-01 — extrair módulo X»). |
| **Ficheiro alvo** | `src/3d/viewer-engine/ViewerCore.ts` |
| **Caminho absoluto** | `c:\Users\Mofreita\pimo-v3\pimo-criativo\src\3d\viewer-engine\ViewerCore.ts` |
| **Linhas** | **6112** (contagem PowerShell, 18-08-2026) |
| **Instanciação** | `Workspace.tsx` → `loadViewerCore()` dinâmico → `new ViewerCore(container)` |
| **Fachada legado** | `src/3d/core/Viewer.ts` (8 linhas: `export class Viewer extends ViewerCore {}`) |
| **Exclusões** | BoxBuilder, DrawerFactory, TCN/DRILL/PI, PHP, Supabase, `src/validation/` — **não tocar** nesta fase |

### 6.1.1 Identificação do ficheiro alvo

Critérios do dono do produto: maior número de linhas; botões/handlers não usados; sistemas antigos ou duplicados; lógica acumulada; «expositor geral» do Viewer; responsável por grande parte do comportamento visual.

Comparação (linhas com conteúdo, `src/`, excl. testes):

| Ficheiro | Linhas | Papel |
|----------|--------|--------|
| **`src/3d/viewer-engine/ViewerCore.ts`** | **6112** | **Alvo Z-01** — orquestrador / expositor 3D |
| `src/components/admin/SystemSettingsBase.tsx` | 1597 | Admin (fora do Viewer) |
| `src/components/layout/workspace/Workspace.tsx` | 1439 | Contentor React (montagem + sync) |
| `src/3d/viewer-engine/panels/ViewerPanelVisibility.ts` | 990 | Já extraído (visibilidade / exploded) |
| `src/3d/viewer-engine/box/BoxSceneController.ts` | 845 | Já extraído (CRUD scene-graph) |
| `src/3d/viewer-engine/raycast/ViewerRaycastSystem.ts` | 771 | Já extraído (picking) |

**Conclusão:** o expositor geral é `ViewerCore.ts`. Já existem ~210 ficheiros em `viewer-engine/`, mas o orquestrador continua a concentrar API pública, construtor, drag/snap, sala, materiais, pós-processamento e engines de layout. O rascunho interno `core/ViewerCoreAudit.ts` está **desactualizado** (ainda refere «~4500 linhas»).

### 6.1.2 Estrutura geral e responsabilidades actuais

O próprio ficheiro declara-se orquestrador (linhas ~248–254) e ponto único de composição. Na prática ainda contém lógica própria além da delegação.

| Linhas (aprox.) | Bloco | Responsabilidade |
|-----------------|-------|------------------|
| 1–247 | Imports | Three/postprocessing, composition, box, room, snap, materials, overlays, industrial |
| 256–610 | Campos + facades | `display`, `events` (stub), `internalRuler`, `snapping`, `autoLayout`, `smartLayout`, `intelligentDesigner`, `conversationalDesigner`, `manufacturing`, `costEstimator`, visuais orla/remate/hemati/rodapé |
| 612–1165 | Constructor / init | Foundation (cena/câmara/renderer/luzes), raycast, materiais, **todas as engines**, TransformControls, RoomManager, composers, RAF (`start()`), `notifyViewerReady` |
| 1167–1538 | Bridges visuais | orla / remate / tampo / hemati / rodapé / divSep |
| 1540–1759 | Modos + lighting | showcase / ultra-performance, intensidade luz/sombra |
| 1763–2180 | Selecção / grupo | marquee, outlines, group gizmo, align |
| 2200–2366 | Medição / régua | `UnifiedMeasurementEngine` + aliases «régua interna» |
| 2370–2446 | Pós-processamento | `composer` (showcase: bloom+bokeh) vs `mainComposer` (bloom suave) |
| 2448–2812 | Materiais | updateBox/Door/Drawer/frente-fixa; NO-OP de sync de frentes |
| 2818–3345 | Câmara / qualidade / industrial design | mouse preset, photo, exploded, highlight, furos |
| 3347–4096 | Sala | RoomManager, piso/tecto/utilities; `createRoom` deprecated |
| 4098–4200 | Presets de câmara | vistas, `resetCamera`, `frameSelection` |
| 3393–3644 + 4473–4685 | Boxes + CAD | add/update/remove, GLB/OBJ/STL, gap/spacing legado |
| 4328–5340 | Gizmos / tools | TransformControls, GroupGizmo, WallGizmo, clamp/drag |
| 5688–6088 | Snap no translate | SmartAlign + RemateSmart + TransformConstraints |
| 5731–5932 | Layout / designer / custo | wrappers das engines |
| 6090–6669 | RAF tick, snapshot, **dispose** | |

**Já extraído (não voltar a fundir):** `ViewerCompositionRoot`, `ViewerRuntimeLoop`, `BoxSceneController`, `ViewerPanelVisibility`, `ViewerRaycastSystem`, `ViewerOverlayCoordinator`, `ViewerBoundsCache`, visualizers orla/remate/hemati/rodapé.

### 6.1.3 Secções antigas, duplicadas, mortas e handlers/botões não usados

#### Código morto / NO-OP / aliases (grep 18-08-2026)

| Símbolo | Linha (aprox.) | Veredicto |
|---------|----------------|-----------|
| `events.emit` | 375–380 | Stub sem listeners; único emit interno (`shadowIntensityChanged`) sem subscritores |
| `setOnRulerTick` | 4300 | **@deprecated + NO-OP**; zero callers |
| `setRulerEnabled` | 3138 | **@deprecated**; só muda o cursor; zero callers |
| `setTransformAttachmentRefreshSuspended` | 4343 | NO-OP ligado ao EventsManager |
| `refineLayoutPlan` | 5735 | NO-OP; engines de manufacturing/intelligent chamam sem efeito |
| `onAfterRenderTick` | 6561 | Corpo vazio; chamado **todos os frames** |
| `syncDrawerFrontMaterialsForBox` | 2793 | NO-OP; `BoxSceneController` **não** invoca o callback |
| `updateBoxDimensions` | 2818 | Alias de `updateBox`; zero callers |
| `setCameraFrontView` | 2889 | Zero callers (UI usa `setCameraView` / `resetCamera`) |
| `enableInternalRuler` / `disableInternalRuler` / `setInternalMeasurementMode` | 2210–2260 | Vivos na API/tipos; **mortos na UI** |
| `setBoxSpacing` / `updateBoxSpacing` | 4677–4684 | LEGACY; sync real usa `setBoxGap` |
| `SmartSnapping.applyDuringTranslate` | (módulo) | **Nunca** chamado pelo ViewerCore no clamp |
| `Tools3DToolbar` | `viewer-toolbar/Tools3DToolbar.tsx` | **`return null`** — slot UI morto; props só por compatibilidade |

#### Sistemas duplicados (vivos em paralelo)

| Duplicação | Evidência | Risco |
|------------|-----------|--------|
| **Triplo snap** | Unificado em Z-01.2.3: `SnapEngine` orquestra SmartAlign → TransformConstraints/ModelWallSnap; `SmartSnapping` só overlay | Resolvido (algoritmos intactos; D-10) |
| **autoLayout vs smartLayout vs `core/autoRoomFill`** | Unificado em Z-01.2.4: `LayoutEngine` orquestra; Kitchen 3.0 = projecto; 3D = adapters (menus intactos) | Resolvido (algoritmos intactos) |
| **`composer` vs `mainComposer`** | Dois EffectComposers no RAF | Custo GPU; não é morto |
| **`window.viewerCore` vs `PimoViewerApi`** | Workspace atribui o global em `setOnViewerReady`; contexto React relê o mesmo objecto | Dois caminhos, tipagem frouxa |
| **Régua vs Régua interna** | Toolbar: `toggleRuler` → `setMeasurementMode` — **unificado** em Z-01.2.2 (ContextMenu duplicado removido) | Resolvido |
| **Três pastas «viewer»** | `src/3d/viewer-engine/` (motor), `src/viewer/` (tipos/utils, 4 ficheiros), `src/core/viewer/` (adapter/readiness) | Onboarding |

`createRoom` (@deprecated, ~3660) **ainda é chamado** por `useViewerSync.ts` — não é morto; é ponte.

### 6.1.4 Dependências internas e externas

| Grupo | Origem |
|-------|--------|
| Three / postprocessing | `three`, EffectComposer, UnrealBloomPass, BokehPass, OBJLoader, STLLoader, TransformControls |
| Composition / runtime | `ViewerCompositionRoot`, Scene/Camera/Renderer, Controls, `ViewerRuntimeLoop` |
| Box / malha | `BoxSceneController`, BoxBuilder, DrawerFactory, drill filter (só visual) |
| Sala | `RoomManager`, `RoomBuilder`, WallGizmo, WallRaycastCulling |
| Snap / layout | SmartSnapping, SmartAlign, AutoLayout, AutoWall/Room/Distribution/Stack, Predictive, Intelligent/Conversational designer, Manufacturing, Cost |
| Materiais | pipeline, display/ultra, grain, drawer-front trace |
| Overlays | Dimensions, SelectionOutline, Internal/Multi outline, OverlayCoordinator, IndustrialDesign overlay |
| Medição | UnifiedMeasurementEngine, internalRulerFacade, anchors |
| Industrial (viewer) | `IndustrialDesignWorkspaceMode` — **não** importa `src/industrial/**` de produção |
| Projecto | types, glbLoader, historyManager, selectionIds, rulesStore |
| Legado `@/viewer` | `viewerUtils`, `ViewerOptions` |

Consumidores principais: `Workspace.tsx`, `usePimoViewer.ts`, `ContextMenu.tsx`, `UnifiedTopToolbar.tsx`, `PainelSala.tsx` (conversational / manufacturing / cost), remates, `useViewerSync`, hooks `useViewerBoxes` / `useViewerRoom` / `useViewerMaterials`.

### 6.1.5 Riscos, desempenho e pontos frágeis

| ID interno | Tema | Severidade | Nota |
|------------|------|------------|------|
| R-05 | Monólito 6112 linhas | **Alta** | Qualquer bug de drag/snap/câmara passa por este ficheiro |
| — | RAF + dois composers | **Alta** runtime | Bloom no modo normal todos os frames; showcase acrescenta bokeh |
| D-10 | Dual/triplo snap | **Mitigado** | Orquestrador `SnapEngine` (Z-01.2.3); tolerâncias de produto intocadas |
| — | `window.viewerCore` | **Média** | HMR, acesso antes de ready, `as unknown` |
| — | Zero testes directos | **Alta** | Nenhum `ViewerCore*.test.ts`; só subsistemas |
| — | Engines no constructor | **Média** | designer/cost/manufacturing nascem mesmo sem PainelSala |
| F-08 | `events.emit` stub | **Baixa** | **Removido** em Z-01.2.1 |
| — | API pública inchada | **Média** | `viewerCoreWindow.d.ts` ~430 linhas; fácil chamar o alias errado |

**Pontos frágeis:** `clampTransform` (ordem snap+constraints); `dispose()` / remount HMR; sync live `objectChange` → ProjectContext por frame; `syncRemateForBox` ignora `_boxId`.

**Isolar primeiro (sem reescrita):** pipeline de snap; superfície de medição; facades `autoLayout` vs `smartLayout`; acesso global vs contexto.

**Modularizar a seguir:** lighting/composers; finish sync (orla/remate/hemati/rodapé); selection/group; room API; box API (já há controller); layout facades.

**Reescrita futura (não agora):** unificar snap numa única pipeline testável; fundir auto-fill com `core/autoRoomFill`; eliminar `window.viewerCore` após migrar consumidores para `PimoViewerApi`.

### 6.1.6 Plano industrial de divisão (proposta — não executar)

Manter `ViewerCore.ts` como **fachada fina** (constructor + bind + dispose + getters). Mover lógica para módulos já alinhados com `viewer-engine/`.

| Ficheiro proposto | Conteúdo a extrair | Camada |
|-------------------|--------------------|--------|
| `viewer-engine/lighting/ViewerLightingController.ts` | ultra/showcase, lerp luzes, sombra, init dos composers | engine |
| `viewer-engine/finish/ViewerFinishSync.ts` | bind/sync orla/remate/hemati/rodapé/divSep | engine |
| `viewer-engine/selection/ViewerSelectionApi.ts` | multi/group/marquee/align/outlines | engine |
| `viewer-engine/measurement/ViewerMeasurementApi.ts` | uma régua; eliminar aliases públicos | engine |
| `viewer-engine/materials/ViewerMaterialApi.ts` | update materiais; apagar NO-OP de drawer sync | engine |
| `viewer-engine/room/ViewerRoomApi.ts` | createRoom*, floor/ceiling/utilities | engine |
| `viewer-engine/camera/ViewerCameraApi.ts` | presets, frame, reset | engine |
| `viewer-engine/box/ViewerBoxApi.ts` | só delegação para `BoxSceneController` | engine |
| `viewer-engine/layout/ViewerLayoutFacades.ts` | **um** de autoLayout/smartLayout; designer/cost/manufacturing | engine |
| `viewer-engine/snap/ViewerSnapPipeline.ts` | um `applyDuringTranslate` com ordem documentada | core |
| (já existe) `Workspace.tsx` + hooks | UI, teclado, overlays React | ui |
| (já existe) `createViewerApiAdapter` | ponte ProjectContext | helpers / adapter |

Separação obrigatória: **UI** (Workspace, toolbars, ContextMenu) ≠ **estado** (`ViewerState` + ProjectContext) ≠ **eventos** (`EventsManager`; hoje `events.emit` é no-op) ≠ **cálculos** (snap AABB, auto-layout plans, cavity measurements).

Ordem sugerida (cada passo = gatilho próprio):

1. Remover NO-OPs e aliases sem callers (`setOnRulerTick`, `setRulerEnabled`, `updateBoxDimensions`, `setCameraFrontView`, wiring morto de drawer-front sync). **Não** remover `createRoom` enquanto `useViewerSync` o chamar.
2. Unificar régua na UI (ContextMenu «Régua interna» → `toggleRuler`, ou esconder o segundo botão).
3. Escolher **um** pipeline de snap e **um** de auto-fill; o outro vira adapter.
4. Migrar `window.viewerCore` → `PimoViewerApi` (começar pelo ContextMenu).
5. Fatiar o ficheiro com testes de fachada (`viewerReady`, addBox, setMeasurementMode, dispose).
6. Só então considerar lazy-init das engines de designer/cost/manufacturing.

### 6.1.7 Recomendações adicionais (sem execução)

| Acção | Destino | Motivo |
|-------|---------|--------|
| Manter malha paramétrica em **BoxBuilder** / **DrawerFactory** | `src/3d/objects/` | Já é o sítio certo; ViewerCore só orquestra |
| Não migrar cutlist/TCN/DRILL/PI para o Viewer | industrial | Viewer só filtra furos para **visualização** |
| Completar extração já começada | `viewer-engine/*` | CompositionRoot, RuntimeLoop, PanelVisibility, Raycast, OverlayCoordinator |
| Adapters | `src/core/viewer/viewerApiAdapter.ts` (já existe) | Alargar em vez de criar um segundo adapter |
| Hooks | `useViewerBoxes` / `useViewerRoom` / `useViewerMaterials` (já existem) | Completar cobertura; deixar de ler o global nos componentes |
| Serviços | `SmartAlignSnapEngine` + `TransformConstraints` | Fundir atrás de `ViewerSnapPipeline` |
| Actualizar `ViewerCoreAudit.ts` | `core/ViewerCoreAudit.ts` | Ainda diz ~4500 linhas |
| `Tools3DToolbar` | UI | **Removido** em Z-01.2.1 |

**Não fazer nesta fase:** alterar ViewerCore, BoxBuilder, `viewer-engine` vivo, routing, Supabase, PHP, geradores industriais.

A sequência oficial de extração e o «motor universal» de formatos estão em **§6.2 (Z-01.2)** — esta subsecção 6.1.6 fica como rascunho da auditoria.

---

## 6.2 Z-01.2 — Plano de modularização do expositor (`ViewerCore` → fachada fina)

| Campo | Valor |
|-------|--------|
| **Estado** | Plano técnico **registado** (18-08-2026). **Nenhuma** extração, rename ou teste novo executado. |
| **Objectivo** | `ViewerCore` como fachada fina; módulos especializados; Viewer preparado para ser o motor de visualização do PIMO.PRO, capaz de **exibir** projectos normalizados de múltiplas origens. |
| **SSOT de produto** | Continua a ser `ProjectState` (milímetros) em `src/context/projectTypes.ts`. O Viewer **não** passa a ser a fonte de verdade industrial. |
| **Gatilho de código** | Só `aplica Z-01 — extrair módulo X` (passos Z-01.2.1 … Z-01.2.9). |
| **Exclusões permanentes** | BoxBuilder, DrawerFactory, malha paramétrica, PDF/XLSX/TCN/DRILL/PI, `industrialOutputGuard`, PHP, Supabase, `src/validation/` excepto testes de fachada **depois** de extração aprovada. |

### 6.2.1 Princípio industrial — motor universal de *visualização*, não de fabricação

O Viewer deve, no futuro, **ler e mostrar** qualquer projecto ou design que tenha sido convertido para um modelo interno único. **Não** deve gerar TCN, DRILL, PI, PDF ou XLSX a partir de CAD cru (GLB/DXF/IFC/STEP) sem passar por `ProjectState` validado.

```
Formatos externos (PIMO-PROJECT, JSON, GLB, DXF, IFC, STEP, …)
        │
        ▼
 ProjectFormatAdapter  →  NormalizedProject (mm, schema PIMO)
        │
        ▼
   ProjectState (SSOT)  ──►  pipeline industrial (intocada)
        │
        ▼
 ViewerFacade / engines  ──►  cena Three.js (exibir / manipular / sincronizar)
```

Regras:

- Adaptadores vivem em **`src/core/viewer/formats/`** (dados), **não** dentro de `ViewerCore.ts`.
- O Viewer só consome `NormalizedProject` / `ProjectState` + assets 3D já resolvidos.
- Um GLB/IFC importado começa como **visual** (caixa CAD / malha). Fabricação só depois de mapeamento explícito para `WorkspaceBox` + regras industriais.
- Cada formato novo = gatilho próprio **depois** de Z-01.2.5 (não misturar com extração de snap/luzes).

### 6.2.2 Arquitectura alvo (camadas)

| Camada | Pasta / peça | Função | Não faz |
|--------|----------------|--------|---------|
| **ui** | `Workspace.tsx`, toolbars, ContextMenu, hooks `useViewer*` | Input React, overlays 2D, teclado | Não contém RAF nem geometria de caixa |
| **facade** | `ViewerCore.ts` (nome público mantido) ≡ `ViewerFacade` | Constructor, bind, dispose, getters estáveis | Sem lógica de snap/luz/régua |
| **runtime** | `ViewerRuntimeLoop.ts`, `ViewerState.ts` | Frame, resize, flags de modo | Sem I/O de projecto |
| **engine** | módulos A–D abaixo | Cena, interacção, dados 3D, layout | Sem PHP/Supabase/TCN |
| **adapter** | `viewerApiAdapter.ts`, `ProjectFormatAdapter` | ProjectContext ↔ Viewer; ficheiro ↔ `NormalizedProject` | Sem malha BoxBuilder |
| **core produto** | `ProjectState`, BoxBuilder, cutlist | SSOT + fabricação | Não importar Three.js |

`src/3d/core/Viewer.ts` (`class Viewer extends ViewerCore`) **mantém-se** até todos os imports de tipo migrarem. Não criar uma terceira classe pública no passo 1.

### 6.2.3 Mapa proposto ↔ o que já existe (não duplicar)

Os nomes A–E são o vocabulário Z-01.2. A extração **reutiliza** ficheiros vivos; só se cria ficheiro novo quando não há dono claro.

#### A) Núcleo de cena

| Módulo Z-01.2 | Caminho alvo | Estado actual | Responsabilidade |
|---------------|--------------|---------------|------------------|
| `SceneEngine.ts` | `viewer-engine/scene/SceneManager.ts` (já existe) + orquestração residual no Core | Parcial | Cena, fundo, environment, ground |
| `LightingEngine.ts` | **novo** `viewer-engine/lighting/LightingEngine.ts` | Lógica no Core (~1540–1759) | Intensidade global, sombras, ultra lerp, perfil showcase |
| `ComposerEngine.ts` | **novo** `viewer-engine/lighting/ComposerEngine.ts` | `composer` + `mainComposer` no Core | Um API: `setMode(performance\|showcase\|ultra)`; dois pipelines internos até unificação GPU |

#### B) Núcleo de interacção

| Módulo Z-01.2 | Caminho alvo | Estado actual | Responsabilidade |
|---------------|--------------|---------------|------------------|
| `CameraEngine.ts` | `camera/CameraManager.ts` + extrair presets do Core | Parcial | Vistas, frame, reset, photo-mode camera |
| `SelectionEngine.ts` | **novo** `selection/SelectionEngine.ts` | Outlines + marquee + group no Core | Selecção simples/multi, align, encoded IDs |
| `MeasurementEngine.ts` | `UnifiedMeasurementEngine` + matar aliases | Duplicado na UI | **Uma** régua; `internalRuler` = alias interno, não botão |
| `GizmoEngine.ts` | `tools/ViewerTools.ts` + TransformControls / GroupGizmo / WallGizmo | Disperso | Attachment, drag lifecycle, clamp **chama** SnapEngine |

#### C) Núcleo de dados (cena + projecto)

| Módulo Z-01.2 | Caminho alvo | Estado actual | Responsabilidade |
|---------------|--------------|---------------|------------------|
| `MaterialEngine.ts` | `materials/materialPipelineFacade.ts` + extrair API do Core | Parcial | Qualidade, gloss, matte, update por caixa/porta/gaveta |
| `RoomEngine.ts` | `RoomManager` + extrair API do Core | Parcial | create/update/remove sala, piso, tecto, utilities |
| `BoxEngine.ts` | `box/BoxSceneController.ts` (já existe) | Quase | Única porta `addBox`/`updateBox`/`removeBox`; **delega malha ao BoxBuilder** |
| `ProjectLoader.ts` | **novo** `src/core/viewer/formats/ProjectLoader.ts` | Inexistente como módulo | Orquestra detect → adapt → validate → `ProjectState` |
| Finish sync | `finish/ViewerFinishSync.ts` (proposta §6.1.6) | orla/remate/hemati/rodapé no Core | Sync visual; não é formato |

#### D) Núcleo de layout

| Módulo Z-01.2 | Caminho alvo | Estado actual | Responsabilidade |
|---------------|--------------|---------------|------------------|
| `SnapEngine.ts` | **novo** `snap/SnapEngine.ts` (pipeline única) | Triplo: SmartAlign + ModelWallSnap + SmartSnapping overlay | Um `applyDuringTranslate`; outros viram estratégias internas |
| `LayoutEngine.ts` | **executado** `viewer-engine/layout/LayoutEngine.ts` — fachada sobre `core/autoRoomFill` + adapters 3D | Triplo auto-fill | Um auto-fill de produto; o outro 3D vira adapter |
| `DesignerEngine.ts` | lazy sobre intelligent / conversational / cost / manufacturing | Constructor eager | Fora do hot path; **não** substitui cutlist industrial |

#### E) Núcleo de runtime

| Módulo Z-01.2 | Caminho alvo | Estado actual | Responsabilidade |
|---------------|--------------|---------------|------------------|
| `ViewerRuntimeLoop.ts` | já existe | Vivo | RAF, resize, escolha composer vs `renderScene` |
| `ViewerState.ts` | já existe | Vivo; superfície ainda larga | Flags de tool, selecção, drag; sem Three.js pesado |
| `ViewerFacade.ts` | **é o próprio `ViewerCore.ts` reduzido** | 6112 linhas | API pública estável; re-exporta engines |

### 6.2.4 `ProjectFormatAdapter` — formatos futuros

Ficheiro conceptual: `src/core/viewer/formats/ProjectFormatAdapter.ts` + um adapter por formato.

Contrato alvo (não implementar agora):

```
detect(input) → FormatId
parse(input) → unknown
toNormalized(parsed) → NormalizedProject   // mm, ids PIMO, sem Three.js
validate(normalized) → ValidationResult    // schema; NÃO é golden drill
toProjectState(normalized) → ProjectState
```

| FormatId | Prioridade | Situação actual | Notas industriais |
|----------|------------|-----------------|-------------------|
| `pimo-project` / JSON interno | P0 | Já é o fluxo (`ProjectState`) | Adapter identidade |
| `glb` | P1 | `loadGLB` + `addModelToBox` | Visual/CAD na caixa; **não** gera cutlist sozinho |
| `json-externo` (export de outro PIMO) | P1 | Persistência PHP/JSON | Validar versão de schema |
| `dxf` | P2 futuro | **Inexistente** | Só 2D/paredes/peças planas após parser dedicado |
| `ifc` | P2 futuro | **Inexistente** | BIM → mapeamento de IfcFurnishing/IfcWall; visual first |
| `step` | P3 futuro | **Inexistente** | Sólidos CAD; nunca pipeline TCN directo |
| outros | sob pedido | — | Feature flag por formato |

`NormalizedProject` (esboço): `version`, `units: "mm"`, `room?`, `workspaceBoxes[]`, `materials[]`, `assets[]` (glb urls), `source: { format, warnings[] }`. Campos industriais (`cutList`, drill, PI) **só** se a origem for PIMO validado; imports CAD trazem `source.warnings` e `industrialReady: false`.

O Viewer, após load: `BoxEngine` aplica boxes; `RoomEngine` aplica sala; `MaterialEngine` resolve IDs; assets GLB via loader existente. Sem isto, «carregar qualquer design» no Core actual acopla parsers ao RAF — **proibido**.

### 6.2.5 Ordem de execução (gatilhos Z-01.2.1 … Z-01.2.9)

Nenhum passo avança sem: `aplica Z-01 — extrair módulo X` (X = ID da linha). Cada extração é **atómica**, reversível (um commit), e o Viewer permanece funcional.

| ID | Passo | O que entra | O que **não** entra | Dependências |
|----|-------|-------------|---------------------|--------------|
| **Z-01.2.1** | Remover NO-OPs sem consumidores | `setOnRulerTick`, `setRulerEnabled`, `updateBoxDimensions`, `setCameraFrontView`, wiring `syncDrawerFrontMaterialsForBox`, `events.emit`, `refineLayoutPlan`, `onAfterRenderTick`, `Tools3DToolbar` | `createRoom` (ainda usado por `useViewerSync`); BoxBuilder | **Executado** 18-08-2026 |
| **Z-01.2.2** | Unificar régua | Um botão / uma API `setMeasurementMode`; ContextMenu deixa de duplicar «Régua interna»; fachada `MeasurementEngine.ts` | Novo motor de medição (reutiliza `UnifiedMeasurementEngine`) | **Executado** 18-08-2026 |
| **Z-01.2.3** | Unificar snap | `SnapEngine.applyDuringTranslate` / `applyBoxTranslatePipeline`; ordem SmartAlign → TransformConstraints; SmartSnapping overlay-only | Alterar tolerâncias de produto sem testes de drag | **Executado** 18-08-2026 |
| **Z-01.2.4** | Unificar auto-fill | Uma fachada `LayoutEngine`; Kitchen 3.0 (`core/autoRoomFill`) é o canónico de **projecto**; 3D preview opcional | Apagar `core/autoRoomFill` | **Executado** 18-08-2026 |
| **Z-01.2.5** | `ProjectLoader` + `ProjectFormatAdapter` | Esqueleto + adapter `pimo-project` + gancho GLB existente | Parsers DXF/IFC/STEP; qualquer gerador industrial | SSOT `ProjectState` |
| **Z-01.2.6** | Migrar API global → `PimoViewerApi` | ContextMenu e remates deixam `window.viewerCore`; tipos em `viewerCoreWindow.d.ts` encolhem | Remover o global no mesmo passo se HMR/Workspace ainda o atribuir | Adapter já existe |
| **Z-01.2.7** | Extrair módulos A → E | Lighting, Composer, Selection, Room API, Box fachada, Finish sync, Camera presets | Mudança de comportamento visual | 2.1–2.4 estáveis |
| **Z-01.2.8** | Testes de fachada | `viewerReady`, addBox, setMeasurementMode, dispose, load `pimo-project` mínimo | jsdom Three completo no primeiro PR | Após 2.7 ou por módulo |
| **Z-01.2.9** | Lazy-init engines pesadas | designer / cost / manufacturing / conversational só ao abrir PainelSala | Alterar algoritmos desses engines | 2.7 |

Ordem obrigatória: **2.1 → 2.2 → 2.3 → 2.4** antes de fatiar ficheiros grandes. **2.5** pode paralelizar após 2.1 (é `core/`, não hot path 3D). **2.6** pode começar pelo ContextMenu em paralelo com 2.2. **2.7** é o fatiamento. **2.8** acompanha cada extração quando possível. **2.9** no fim (constructor já fino).

### 6.2.6 Impactos

| Eixo | Hoje | Depois (se o plano for executado) | Risco se avançar cedo |
|------|------|-----------------------------------|------------------------|
| **Desempenho** | RAF + dois composers; engines pesadas no constructor | Constructor leve; composer atrás de `ComposerEngine`; lazy designer | Unificar snap mal → drag «salta» |
| **Manutenção** | 6112 linhas, API ~430 linhas de `d.ts` | Fachada &lt; ~800 linhas alvo; engines testáveis | Extrair sem testes = regressão silenciosa |
| **API pública** | `window.viewerCore` + `PimoViewerApi` + aliases | Uma `PimoViewerApi`; global só ponte de transição | Quebrar ContextMenu/remates se o global cair cedo |
| **Formatos** | JSON PIMO + GLB por caixa | Loader + adapters; DXF/IFC/STEP **opt-in** | Parser no ViewerCore = novo monólito |
| **Industrial** | Cutlist a partir de boxes paramétricas | Inalterado; imports CAD com `industrialReady: false` | Gerar TCN de STEP = **proibido** |
| **Testes** | 0 directos ao Core | Fachada + SnapEngine + FormatAdapter identidade | Vitest sem WebGL: mockar renderer |

Alvo de superfície pública (orientação, não contrato rígido): grupos `scene`, `camera`, `selection`, `measurement`, `room`, `boxes`, `materials`, `layout`, `loadProject` — sem aliases `setBoxSpacing` / `enableInternalRuler`.

### 6.2.7 Riscos e mitigação

| Risco | Mitigação |
|-------|-----------|
| Drag/snap (D-10) | **Feito** em Z-01.2.3: testes de ordem + limiar 250 mm; algoritmos SmartAlign/ModelWallSnap não fundidos |
| Dupla API durante 2.6 | `window.viewerCore` permanece até grep = 0 consumidores de produto |
| HMR / dispose | Teste de fachada `dispose` + `setOnViewerReady` (já documentado em `viewerReadiness.ts`) |
| BoxBuilder tocado por acidente | Extrações só movem **chamadas**; zero edits em `src/3d/objects/` |
| «Motor universal» interpretado como fabricação universal | §6.2.1; flag `industrialReady` |
| Criar SceneEngine paralelo ao `SceneManager` | Reutilizar; rename só com gatilho |
| DXF/IFC/STEP sem dono de parser | 2.5 entrega só esqueleto + PIMO + GLB; formatos CAD = IDs futuros Z-01.3+ |

### 6.2.8 Dependências (o que pode / não pode mover)

| Pode depender de | Não pode depender de |
|------------------|----------------------|
| `ProjectState`, tipos em `core/types`, `ViewerOptions` | `api/**/*.php`, Supabase client, geradores TCN/DRILL/PI |
| BoxBuilder **como biblioteca de malha** (chamada) | Alterar BoxBuilder |
| `RoomManager`, loaders GLB/OBJ/STL existentes | `src/industrial/**` de produção (TRAK) |
| `createViewerApiAdapter` | Segundo adapter concorrente |

Finish (orla/remate/hemati/rodapé): extração de **sync visual** no passo 2.7; regras de peça continuam em `src/core/remate` etc.

### 6.2.9 Recomendações industriais

1. Tratar Z-01.2 como **campanha de fachada**, não como rewrite do Viewer.
2. Um PR = um ID Z-01.2.x; Viewer sempre arranca.
3. Não introduzir DXF/IFC/STEP no mesmo PR que Lighting/Snap.
4. Não fundir materiais de domínio com shaders Three (já proibido no hub).
5. Actualizar `ViewerCoreAudit.ts` no primeiro PR de código (ainda diz ~4500 linhas).
6. `Tools3DToolbar` — **removido** em Z-01.2.1 (pedido explícito do dono).
7. `events.emit` (F-08) — **removido** em Z-01.2.1; Events System continua F-05 (sem código).
8. Documentar `industrialReady: false` em qualquer import CAD na UI, para o operador não exportar CNC de malha não paramétrica.

**Z-01.2.1 a Z-01.2.4 executados** em 18-08-2026. Próximo código possível: **Z-01.2.5** (`ProjectLoader` + `ProjectFormatAdapter`).

### 6.2.10 Relatório de execução — Z-01.2.1 (18 de Agosto de 2026)

**Gatilho:** «Aplicar Z-01.2.1» / remoção de NO-OPs, aprovado pelo dono do produto.

**Pré-checagens:** grep sem consumidores vivos fora do próprio wiring; `createRoom` **não** tocado; BoxBuilder, TCN/DRILL/PI, PHP, Supabase **não** tocados.

| Alvo | Acção |
|------|--------|
| `events.emit` / `readonly events` | Removido do ViewerCore e de `viewerCoreWindow.d.ts`; emit de `shadowIntensityChanged` eliminado (zero listeners) |
| `setOnRulerTick` | Removido |
| `setRulerEnabled` | Removido |
| `updateBoxDimensions` | Removido (alias sem callers) |
| `setCameraFrontView` | Removido (zero callers; UI usa `setCameraView` / `resetCamera`) |
| `syncDrawerFrontMaterialsForBox` | Método + param morto em `BoxSceneController` removidos |
| `refineLayoutPlan` | Método e wiring removidos; `refinePlan` nas engines ficou **opcional** |
| `onAfterRenderTick` | Método vazio removido; callback do runtime loop passou a opcional |
| `Tools3DToolbar` | Ficheiro apagado; JSX removido de `Workspace.tsx` |

**Intocado:** `createRoom`, BoxBuilder, pipeline industrial.

### 6.2.11 Relatório de execução — Z-01.2.2 (18 de Agosto de 2026)

**Gatilho:** «Aplicar Z-01.2.2» — unificação da régua.

**Motor canónico:** `src/3d/viewer-engine/measurement/MeasurementEngine.ts` (fachada sobre `UnifiedMeasurementEngine`, **sem** segundo algoritmo).

**Fluxo único:**
`UnifiedTopToolbar` → `actions.toggleRuler()` → `viewerSettings.rulerEnabled` → `Workspace` → `viewerApi.setMeasurementMode` → `MeasurementEngine.setEnabled`.

**UI:** removido o item «Régua interna» do ContextMenu (`ferramentas.internalRulerToggle`). O botão **Régua** da toolbar mantém-se.

**Aliases públicos removidos:** `setInternalMeasurementMode`, `getInternalMeasurementMode`, `enableInternalRuler`, `disableInternalRuler`.

**Mantido:** `internalRuler` (sync/isActive), `getInternalMeasurements` (cavidade, não é a régua), `createRoom`, BoxBuilder, snap, layout, ProjectState schema (`internalRulerEnabled` passa a espelhar `rulerEnabled`).

**Grep:** zero callers de `enableForBox` fora da fachada/motor; zero «Régua interna» na UI.

### 6.2.12 Relatório de execução — Z-01.2.3 (18 de Agosto de 2026)

**Gatilho:** «Aplicar Z-01.2.3» — unificação do snap, aprovado pelo dono do produto.

**Motor canónico:** `src/3d/viewer-engine/snapping/SnapEngine.ts` (orquestrador; **não** funde a matemática de SmartAlign + ModelWallSnap).

**Pontos de entrada mapeados:**
- `ViewerCore.clampTransform` — caixas, remates, rodapés
- `ViewerCore.clampGroupTransform` / `applySmartSnapForGroup` — gizmos de grupo
- `ViewerTools` → `clampTransform`
- `BoxSceneController` — **sem** snap (auto-rotate desligado, comentário legado)
- Workspace — **sem** chamadas directas de snap

**Fluxo único (caixa, translate):**
1. `SnapEngine.applyDuringTranslate` → `SmartAlignSnapEngine` + overlay de alinhamento
2. `TransformConstraints.clampTransform` → chão, colisão, `SnapEngine.snapMeshToNearestMainWall` (`ModelWallSnap`, limiar **250 mm**), limites da sala

**Overlay:** `SmartSnapping.applyDuringTranslate` **não** entra no pipeline (fachada `viewerApi.snapping` / refresh de overlay). Remates continuam a usar `RemateSmartSnapping` (domínio de peça, não motor de caixa).

**Grep:** `snapModelToNearestWall` só em `ModelWallSnap.ts` (definição) e `SnapEngine.ts` (único wrapper). ViewerCore **não** chama ModelWallSnap nem SmartAlign directamente no drag.

**Intocado:** BoxBuilder, malha, PDF/XLSX/TCN/DRILL/PI, ProjectState, mm industriais, RoomManager, LayoutEngine, algoritmos de SmartAlign/ModelWallSnap.

**Testes D-10:** `SnapEngine.test.ts` — ordem align→constraints; limiar 250 mm; posição em mm inalterada quando os motores mock não movem.

### 6.2.13 Relatório de execução — Z-01.2.4 (18 de Agosto de 2026)

**Gatilho:** «Aplicar Z-01.2.4» — unificação do auto-fill, aprovado pelo dono do produto.

**Motor canónico:** `src/3d/viewer-engine/layout/LayoutEngine.ts` (orquestrador; **não** funde Kitchen 3.0 com os planos 3D).

**Canais (UX intacta):**
1. **Projecto** — Kitchen 3.0 (`runProjectKitchenLayout` → `runKitchenLayout30OnState`); PainelSala e `Workspace.bindAutoLayoutBridge.runProjectRoomFill`
2. **3D Ferramentas** — `autoLayout.*` → `AutoLayoutEngine` (preencher parede / estender / distribuir / prateleiras)
3. **3D Smart Layout** — `smartLayout.*` → Auto-Wall-Fill / Auto-Room-Fill 3D (este último delega a Kitchen 3.0 quando o bridge existe)

**Pontos de entrada mapeados:**
- PainelSala / `useAutoRoomFillActions` — Kitchen 3.0 e auto-room legado de projecto
- ContextMenu `ferramentas.fillWall` → `viewerApi.autoLayout`
- ContextMenu `smartLayout.*` → `window.viewerCore.smartLayout`
- `BoxSceneController` — **sem** auto-fill
- Workspace — só `bindAutoLayoutBridge` (Kitchen 3.0 no `runProjectRoomFill`)

**Grep:** `runKitchenLayout30OnState` / `runAutoRoomFillOnState` só em `core/autoRoomFill` (definição) e `LayoutEngine` (único wrapper). ViewerCore **não** instancia AutoLayout/AutoWallFill/AutoRoomFill.

**Intocado:** BoxBuilder, malha, PDF/XLSX/TCN/DRILL/PI, ProjectState schema, mm industriais, RoomManager, SnapEngine, menus do ContextMenu e botões do PainelSala.

**Testes:** `LayoutEngine.test.ts` — Kitchen 3.0 vs legado; posições `_mm` no fill 3D; adapters autoLayout ≠ smartLayout.

---

## 7. Riscos técnicos e de segurança (`R-`)

| ID | Risco | Evidência | Severidade | Notas |
|----|-------|-----------|------------|-------|
| R-01 | JWT fallback hardcoded | `api/auth/index.php` — env ou default | **Alta** prod | Obrigar `PIMO_JWT_SECRET` |
| R-02 | CORS `*` ordens industriais | `api/industrial/orders/index.php` | **Média** | Restringir origem |
| R-03 | GitHub sync config | `.gitignore` cobre `githubSyncConfig.php`; só `.example` no repo | **Controlado** | Validar servidor |
| R-04 | `users.json` gitignored | `api/data/users.json` | **Controlado** | — |
| R-05 | ViewerCore monolítico | **6112 linhas** (confirmado Z-01, 18-08-2026) | **Alta** manutenção | §6.1 + §6.2; Fase 5 só com gatilho |
| R-06 | TCN multi-gerador | 4 implementações importadas | **Alta** industrial | P-04 |
| R-07 | Dual work_orders Supabase | Legado + TRAK paralelos | **Alta** dados | D-03 |
| R-08 | `tsc:strict` fora do build | Script separado | **Média** | Dívida tipos |
| R-09 | Vitest sem jsdom | ~0 testes UI | **Média** | Regressão páginas |
| R-10 | Sem E2E | — | **Média** | Release |
| R-11 | Supabase env obrigatório TRAK | `createSupabaseClient()` | **Média** | Workspace OK sem |
| R-12 | `npm run deploy` auto-commit | `git add . && git commit` | **Alta** processo | Pode commitar L-25/L-28 |
| R-13 | CLAUDE.md desactualizado | Viewer em `src/viewer/` vs `3d/viewer-engine` | **Baixa** | Doc only |
| R-14 | Tocar zonas P- | Ver §2 | **Alta** se alterado | Bloqueio limpeza |
| R-15 | `pg` / `nodemailer` em dependencies | Só scripts | **Baixa** | Bundle metadata |
| R-16 | Limpeza perto de `3d/objects/` | Stubs L-09…11 adjacentes a BoxBuilder | **Média** | Testes validation |
| R-17 | `npm run deploy` + artefactos | L-28 não ignorados | **Média** | Commits sujos |
| R-18 | 37 relatórios raiz | Falsos SSOT (F-12) | **Baixa** doc | Decisões erradas |

---

## 8. Impacto no runtime e na manutenção

### 8.1 Pesado no runtime (não é «morto»)

| Sistema | Porquê pesa | Limpeza segura? |
|---------|-------------|-----------------|
| ViewerCore + postprocessing | RAF, outlines, snapping | Só Fase 5 incremental |
| `recomputeState` + cutlist | Recálculo a cada mutação | Fingerprints — manter |
| cutlayout metaheurística | 420 iter / 24 starts | Tuning only (P-05) |
| 4 TCN no bundle | Todos importados em `cncExport` | Deprecar (P-04) |
| `/v4` + R3F | Chunk lazy | Remover rota (F-06) |

### 8.2 Lacunas de testes (informação para Fase 5)

| Área | ~Testes | Lacuna |
|------|---------|--------|
| `src/validation/` + `core/**/*.test.ts` | ~280+ | Domínio industrial — **forte** |
| `src/pages/`, `hooks/`, `admin/` | 0 | UI — **crítico** |
| `src/industrial/` (~229 ficheiros) | ~5 unit + integridade | TRAK — **smoke only** |
| `ViewerCore.ts` | 0 directo | Viewer — **crítico** |
| E2E | 0 | Release — **inexistente** |

### 8.3 `services/` — clarificação definitiva

| Local | Conteúdo | Acção futura |
|-------|----------|-------------|
| `services/` (raiz) | Vazia | L-01 |
| `src/services/boxLayersService.ts` | **Vivo** — layers UI | **Manter** |
| `src/services/drawerCutlistAdapter.ts` | **Vivo** — cutlist gavetas (P-03 adjacente) | **Manter** |
| `src/services/apiClient.js` | Morto | L-04 com L-03 |

---

## 9. Lista de ficheiros afectados (caminhos completos)

Base: `c:\Users\Mofreita\pimo-v3\pimo-criativo\`

### 9.1 Remoção — Fase 1 (L-03 → L-30 **executados** em 18-08-2026)

```
backend/backend/data/projects/project-pimo-mn5tsivc-zcrvwgfl.json
src/hooks/useProjects.js
src/services/apiClient.js
src/core/layout/service.ts
src/core/layout/hooks.ts
src/core/layout/types.ts
src/core/layout/smartArrange.ts
src/core/layout/viewerLayoutAdapter.ts
src/core/layout/pieceMaterialExtension.ts
src/3d/groups/drawerGroup3D.ts
src/3d/transforms/drawerTransforms.ts
src/3d/placement/drawerPlacement3D.ts
src/viewer/layers/resolveActiveDrawersLayer.ts
src/pages/Ajuda.tsx
src/core/docs/archive/DocumentacaoSistemaLegacy.tsx.bak
src/core/docs/archive/_extract_preview.json
scripts/_ProjectProgress_recover.tsx
tests/export.test.ts
tests/projectState.test.ts
[16× *.diff / *.patch na raiz — L-25; lista em §3.1]
```

**Ready for Removal (decisão: remoção definitiva; executado 18-08-2026):**

- Fase 1.3 — `src/hooks/useProjects.js` (L-03) e `src/services/apiClient.js` (L-04)
- Fase 1.4 — `src/core/layout/service.ts`, `hooks.ts`, `types.ts` (L-05); `smartArrange.ts` (L-06); `viewerLayoutAdapter.ts` (L-07); `pieceMaterialExtension.ts` (L-08)
- Fase 1.5 — `src/3d/groups/drawerGroup3D.ts` (L-09); `src/3d/transforms/drawerTransforms.ts` (L-10); `src/3d/placement/drawerPlacement3D.ts` (L-11)
- Fase 1.6 — `tests/export.test.ts` (L-14) e `tests/projectState.test.ts` (L-15)
- Fase 1.7 — 16× `*.diff` / `*.patch` na raiz (L-25; lista em §3.1)
- Fase 1.8 — 4 relatórios na raiz (L-26; lista em §3.1)
- Fase 1.9 — 33× `RELATORIO_*.md` na raiz (L-27; lista em §3.1)
- Fase 1.10 — `tmp/` + `test-output/` (L-28; lista em §3.1)
- Fase 1.11 — `src/3d/viewer-engine/cleanup/ViewerCleanupReport.ts` (L-29)
- Fase 1.12 — resíduos finais L-30 (`*.bak` + archive equivalente; lista em §3.1)

Os ficheiros **ainda existem** no repo.

**Explicitamente excluído de 9.1:**

- `src/pages/ajuda/AjudaPage.tsx` — **activo** (D-14, não L-)
- `src/core/layout/layoutWarnings.ts` — **activo** (não é L-05…L-08)
- ViewerCore, `viewer-engine`, `BoxBuilder` — **activos** (não são L-09…L-11)
- L-12 (`SelectionManager`) e L-13 — **fora** da Fase 1.5 (ainda proposta)
- Restantes testes em `tests/` e `src/validation/` — **activos** (não são L-14/L-15)
- Patches/diffs **fora da raiz** — **fora** de L-25
- L-27 — **Ready for Removal** na Fase 1.9 (não na 1.8)
- `docs/RELATORIO_*`, `ferragens_3d/RELATORIO_*`, páginas `RelatorioFinal*` — **fora** de L-26 e L-27
- L-29 (`ViewerCleanupReport.ts`) — **Ready for Removal** na Fase 1.11 (não arquivar; **não** é L-26)
- `dist/`, `node_modules`, `*.legacy.ts` (P-09), `src/core/docs/archive` (L-16/L-17) — **fora** de L-28
- `scripts/backupManager.ts` — **produto** (não é `backup_*`)
- `tmp/encoding-backup/` — **L-28**, não L-30
- Tudo em §2 Zonas P-

### 9.2 Isolar / decisão produto (não apagar à cega)

```
src/v4/**, src/pages/V4Page.tsx, src/components/v4/**
src/App.tsx (rota /v4)
src/industrial/sgpi/industrialExportBridge.ts
src/industrial/integration/ui/**          [Z-04]
src/api/projectsApi.ts
src/pages/DashboardPage.tsx
src/3d/viewer-engine/selection/SelectionManager.ts
```

### 9.3 Protegidos — §2 (`P-01` … `P-10`)

### 9.4 Deploy / API — consolidar (Fase 3; não apagar produção)

```
api/auth/index.php
api/users/index.php
api/user-settings/index.php
api/global-config/index.php
api/industrial/orders/index.php
hostinger/api/projects/**
public_html/api/**
public/.htaccess
scripts/copyDeployApiToDist.mjs
vite.config.ts
```

### 9.5 Documentação — remoção na Fase 1 (não arquivar)

L-26 + L-27 cobrem os 37 `RELATORIO*` da raiz (**Ready for Removal**; executado 18-08-2026). `docs/RELATORIO_*` e `ferragens_3d/RELATORIO_*` **não** estão nestes lotes.

---

## 10. Sugestões de reorganização (texto only — sem executar)

1. Uma árvore PHP no git (`D-01`).
2. Um cliente de projectos (`core/projects/`; remover chamada F-01).
3. Mapa viewers documentado (`3d/viewer-engine` = motor).
4. Mapa Supabase legado vs TRAK (`D-03`).
5. Events System: implementar **ou** riscar do Master Plan (`F-05`).
6. Actualizar `CLAUDE.md` (`R-13`).
7. Remover `tmp/` e `test-output/` (`L-28`); acrescentar ambos ao `.gitignore`.
8. Remover `RELATORIO_*` da raiz (`L-26` + `L-27`; **não** arquivar).
9. **Não fundir** `boxLayersService` / `drawerCutlistAdapter` sem testes gaveta.
10. Renomear `buildBoxLegacy` → `buildBoxGroup` export único (`D-19`) — **fora** de Fase 1.

---

## 11. Plano de execução proposto (texto only — Fases 0–5)

> **Aviso:** Nenhuma fase abaixo foi iniciada. Serve apenas como guia para uma campanha futura.

Princípios:

- Um PR por etapa.
- `src/validation/` verde em qualquer toque a `core/` ou `3d/objects/`.
- §2 (P-) e §6 (Z-) excluídos das Fases 0–2.

### Fase 0 — Gates (1–3 dias)

| Passo | Acção | IDs | Prioridade |
|-------|-------|-----|------------|
| 0.1 | Congelar este hub v1.1 | — | P0 |
| 0.2 | Validar produção: JWT env, githubSync, CORS | R-01, R-03, R-02 | P0 |
| 0.3 | Registar `tcnMetodo` efectivo | D-05, P-04 | P0 |
| 0.4 | Confirmar zero novos imports L-03…L-13 | L-* | P1 |

### Fase 1 — Lixo confirmado (1 semana)

**Regra L- (oficial, sem execução automática):** Remover definitivamente qualquer ficheiro que não seja usado e que não quebre o projecto. Cada lote L- só avança com gatilho explícito do dono do produto (Khaled).

Ordem proposta: L-01/L-02 → L-03/L-04 → L-05…L-08 → L-09…L-11 → L-12/L-13 → L-14/L-15 → L-25 → L-26 → L-27 → L-28 → L-29 → L-30 → L-18 → L-20.

| Passo | IDs | Acção (texto only) | Estado da decisão |
|-------|-----|--------------------|-------------------|
| 1.1 | — | *(L-25 reatribuído à Fase 1.7)* | Ver **1.7** |
| 1.2 | L-01, L-02 | Remover pasta `services/` vazia e fixture `backend/` | Proposta |
| **1.3** | **L-03**, **L-04** | Remover `src/hooks/useProjects.js` e `src/services/apiClient.js` | **Ready for Removal** — decisão: remoção definitiva; execução: pendente. Remoção segura — sistema antigo — zero referências — aprovado pelo dono do produto (Khaled). **Executado 18-08-2026.** Gatilho futuro: «aplica Fase 1.3 — L-03 + L-04» |
| **1.4** | **L-05**, **L-06**, **L-07**, **L-08** | Remover skeleton `core/layout/` (`service.ts`, `hooks.ts`, `types.ts`, `smartArrange.ts`, `viewerLayoutAdapter.ts`, `pieceMaterialExtension.ts`). **Manter** `layoutWarnings.ts`. | **Ready for Removal** — decisão: remoção definitiva; execução: pendente. Remoção segura — sistema antigo de Layout — zero referências — aprovado pelo dono do produto (Khaled). **Executado 18-08-2026.** Gatilho futuro: «aplica Fase 1.4 — L-05 – L-08» |
| **1.5** | **L-09**, **L-10**, **L-11** | Remover stubs 3D do Modelo B: `drawerGroup3D.ts`, `drawerTransforms.ts`, `drawerPlacement3D.ts`. **Não** tocar em ViewerCore / `viewer-engine` / BoxBuilder. | **Ready for Removal** — decisão: remoção definitiva; execução: pendente. Remoção segura — stubs 3D experimentais — zero referências — aprovado pelo dono do produto (Khaled). **Executado 18-08-2026.** Gatilho futuro: «aplica Fase 1.5 — L-09 – L-11» |
| **1.6** | **L-14**, **L-15** | Remover testes placeholder `tests/export.test.ts` e `tests/projectState.test.ts`. **Não** tocar nos restantes testes nem em `src/validation/`. | **Ready for Removal** — decisão: remoção definitiva; execução: pendente. Remoção segura — testes placeholder — zero referências — aprovado pelo dono do produto (Khaled). **Executado 18-08-2026.** Gatilho futuro: «aplica Fase 1.6 — L-14 + L-15» |
| **1.7** | **L-25** | Remover os 16 ficheiros `*.diff` / `*.patch` na raiz do repositório (lista em §3.1). **Não** tocar em código de produto nem em patches noutros caminhos. | **Ready for Removal** — decisão: remoção definitiva; execução: pendente. Remoção segura — patches/diffs experimentais no raiz — zero referências — aprovado pelo dono do produto (Khaled). **Executado 18-08-2026.** Gatilho futuro: «aplica Fase 1.7 — L-25» |
| **1.8** | **L-26** | Remover os 4 relatórios na raiz (lista em §3.1). **Não** tocar em L-27 (lote 1.9), `docs/`, `ferragens_3d/`, páginas `RelatorioFinal*` nem L-29. | **Ready for Removal** — decisão: remoção definitiva; execução: pendente. Remoção segura — relatórios antigos no raiz — zero referências — aprovado pelo dono do produto (Khaled). **Executado 18-08-2026.** Gatilho futuro: «aplica Fase 1.8 — L-26» |
| **1.9** | **L-27** | Remover os 33 `RELATORIO_*.md` na raiz (lista em §3.1). **Não** tocar em `docs/`, `ferragens_3d/` nem páginas `RelatorioFinal*`. | **Ready for Removal** — decisão: remoção definitiva; execução: pendente. Remoção segura — relatórios antigos `RELATORIO_*` — zero referências — aprovado pelo dono do produto (Khaled). **Executado 18-08-2026.** Gatilho futuro: «aplica Fase 1.9 — L-27» |
| **1.10** | **L-28** | Remover `tmp/` e `test-output/`; acrescentar ambos ao `.gitignore`. **Não** tocar em `dist/`, `node_modules` nem `*.legacy.ts` (P-09). | **Ready for Removal** — decisão: remoção definitiva; execução: pendente. Remoção segura — sobras internas em pastas secundárias — zero referências — aprovado pelo dono do produto (Khaled). **Executado 18-08-2026.** Gatilho futuro: «aplica Fase 1.10 — L-28» |
| **1.11** | **L-29** | Remover `src/3d/viewer-engine/cleanup/ViewerCleanupReport.ts` e a pasta `cleanup/` se ficar vazia. **Não** tocar em ViewerCore, resto de `viewer-engine`, BoxBuilder nem L-12. | **Ready for Removal** — decisão: remoção definitiva (não arquivar); execução: pendente. Remoção segura — ViewerCleanupReport.ts — zero referências — aprovado pelo dono do produto (Khaled). **Executado 18-08-2026.** Gatilho futuro: «aplica Fase 1.11 — L-29» |
| **1.12** | **L-30** | Remover resíduos `backup_*` / `notes_*` / `analysis_*` / `draft_*` / `temp_*` / `*.old` / `*.bak` / `*.copy` / `*.unused` / `*.deprecated` e equivalentes (inventário em §3.1). **Não** tocar em `scripts/backupManager.ts` nem P-09. | **Ready for Removal** — decisão: remoção definitiva; execução: pendente. Remoção segura — resíduos finais no raiz e pastas secundárias — zero referências — aprovado pelo dono do produto (Khaled). **Executado 18-08-2026.** Gatilho futuro: «aplica Fase 1.12 — L-30» |
| 1.13 | L-12, L-13 | Remover `SelectionManager` deprecated e re-export drawers (`src/viewer/layers/`) | Proposta — antigo passo 1.9, reatribuído |
| 1.14 | L-18, L-20 | Remover recover hub e wrapper `Ajuda.tsx` | Proposta — L-16/L-17 absorvidos em L-30 |

**Excluído:** TCN, ViewerCore split, Supabase, PHP prod, v4, **tudo P-**.

### Fase 2 — Fantasmas API + documentação (1–2 semanas)

| Passo | IDs | Notas |
|-------|-----|-------|
| Dashboard só `listProjects` | F-01 | Não tocar cutlist |
| htaccess register/settings | F-04 | Testar Hostinger |
| SGPI implementar ou remover wrap | F-02 | Export já funciona |
| Events System doc alinhada | F-05, F-12 | Master Plan |
| CLAUDE.md | R-13 | Doc only |

### Fase 3 — Deploy PHP (2 semanas)

D-01, D-15, R-01, R-02, R-12 — **alto risco produção**.

### Fase 4 — Duplicados produto (1–2 meses; dono industrial)

F-06, D-07, D-08, D-13, D-03/R-07, D-06, D-05 — **P-04 observação**; golden obrigatório.

### Fase 5 — Viewer + qualidade (2–3 meses; opcional)

**Pré-requisito documental:** §6.1 (auditoria) + **§6.2 (Z-01.2)**. **Não** fatiar `ViewerCore.ts` sem gatilho `aplica Z-01 — extrair módulo X`.

R-05, D-09, D-10, smoke ViewerCore, R-08, R-10, E2E mínimo. Ordem oficial: Z-01.2.1 … Z-01.2.9.

### Dependências entre fases

```
0.2 ──► 3.2 (segurança)
0.3 ──► 4.x deprecar TCN (P-04)
1.x ──► 5.1 (viewer) — nunca antes de P- verde
2.x ──► independente de industrial
4.4 ──► Supabase + dono TRAK
```

### O que nenhuma fase deve fazer

- Alterar P-01…P-10 sem pedido explícito e testes.
- Fundir materiais domínio ↔ shaders Three.js.
- Apagar `public_html/` no servidor sem confirmar deploy.
- Activar Events System sem código (`F-05`).
- Gerar TCN/DRILL/PI a partir de GLB/DXF/IFC/STEP sem `ProjectState` com `industrialReady`.

---

## 12. Ganhos esperados (se plano executado no futuro)

| Área | Ganho |
|------|-------|
| Clareza repo | Alto após Fase 1 + L-27 |
| Onboarding | Alto após Fase 2 doc |
| Segurança | Alto se 0.2 + 3.2 |
| Bundle | Moderado (v4, TCN não usados) |
| Industrial | Só Fase 4 com dono |

---

## 13. Registo de decisões e changelog do plano

### 13.1 Decisões

| Data | Versão | Decisão | Autor |
|------|--------|---------|-------|
| 2026-08-18 | 1.0 | Hub criado; zero execuções | Leitura código |
| 2026-08-18 | 1.1 | Fase **só planeamento**; reconciliação relatórios; zonas P-/Z-; reclassificações | Pedido utilizador |
| 2026-08-18 | 1.2 | **Fase 1.3 — remoção definitiva aprovada** para L-03 (`src/hooks/useProjects.js`) e L-04 (`src/services/apiClient.js`). Texto oficial: «Remoção segura — sistema antigo — zero referências — aprovado pelo dono do produto (Khaled).» Execução **não** iniciada. Gatilho: «aplica Fase 1.3 — L-03 + L-04». | Khaled (dono do produto) |
| 2026-08-18 | 1.3 | L-03 e L-04 marcados **Ready for Removal**. Decisão: remoção definitiva. Execução: pendente. Fase: 1.3 — Lixo confirmado. Ficheiros **não** apagados. | Khaled (dono do produto) |
| 2026-08-18 | 1.4 | **Fase 1.4 — remoção definitiva aprovada** para L-05…L-08 (`src/core/layout/*` skeleton). Texto oficial: «Remoção segura — sistema antigo de Layout — zero referências — aprovado pelo dono do produto (Khaled).» Status: **Ready for Removal**. Execução **não** iniciada. **Excluído:** `layoutWarnings.ts`. Gatilho: «aplica Fase 1.4 — L-05 – L-08». | Khaled (dono do produto) |
| 2026-08-18 | 1.5 | **Fase 1.5 — remoção definitiva aprovada** para L-09…L-11 (stubs 3D Modelo B). Texto oficial: «Remoção segura — stubs 3D experimentais — zero referências — aprovado pelo dono do produto (Khaled).» Status: **Ready for Removal**. Execução **não** iniciada. **Excluído:** ViewerCore, BoxBuilder, L-12, L-13. Gatilho: «aplica Fase 1.5 — L-09 – L-11». | Khaled (dono do produto) |
| 2026-08-18 | 1.6 | **Fase 1.6 — remoção definitiva aprovada** para L-14 e L-15 (`tests/export.test.ts`, `tests/projectState.test.ts`). Texto oficial: «Remoção segura — testes placeholder — zero referências — aprovado pelo dono do produto (Khaled).» Status: **Ready for Removal**. Execução **não** iniciada. **Excluído:** restantes testes e `src/validation/`. Gatilho: «aplica Fase 1.6 — L-14 + L-15». | Khaled (dono do produto) |
| 2026-08-18 | 1.7 | **Fase 1.7 — remoção definitiva aprovada** para L-25 (patches/diffs na raiz). Texto oficial: «Remoção segura — patches/diffs experimentais no raiz — zero referências — aprovado pelo dono do produto (Khaled).» Status: **Ready for Removal**. Execução **não** iniciada. Inventário: **16** ficheiros (correção vs. 13 no plano antigo). Gatilho: «aplica Fase 1.7 — L-25». | Khaled (dono do produto) |
| 2026-08-18 | 1.8 | **Regra L- oficial:** «todo ficheiro sem uso, sem referências e sem impacto no produto deve ser removido definitivamente nas fases L-» — sem execução automática; cada lote continua a ser aprovado manualmente. **Fase 1.8 — remoção definitiva aprovada** para L-26 (4 relatórios na raiz). Texto oficial: «Remoção segura — relatórios antigos no raiz — zero referências — aprovado pelo dono do produto (Khaled).» Status: **Ready for Removal**. Ex-L-26 (`ViewerCleanupReport`) reatribuído a **L-29**. Gatilho: «aplica Fase 1.8 — L-26». | Khaled (dono do produto) |
| 2026-08-18 | 1.9 | **Fase 1.9 — remoção definitiva aprovada** para L-27 (33× `RELATORIO_*.md` na raiz). Texto oficial: «Remoção segura — relatórios antigos `RELATORIO_*` — zero referências — aprovado pelo dono do produto (Khaled).» Status: **Ready for Removal**. Execução **não** iniciada. **Excluído:** `docs/`, `ferragens_3d/`, páginas `RelatorioFinal*`. Gatilho: «aplica Fase 1.9 — L-27». | Khaled (dono do produto) |
| 2026-08-18 | 1.10 | **Fase 1.10 — remoção definitiva aprovada** para L-28 (`tmp/` + `test-output/` e pastas secundárias equivalentes). Texto oficial: «Remoção segura — sobras internas em pastas secundárias — zero referências — aprovado pelo dono do produto (Khaled).» Status: **Ready for Removal**. Execução **não** iniciada. **Excluído:** `dist/`, `node_modules`, P-09. Gatilho: «aplica Fase 1.10 — L-28». | Khaled (dono do produto) |
| 2026-08-18 | 1.11 | **Fase 1.11 — remoção definitiva aprovada** para L-29 (`ViewerCleanupReport.ts`). Texto oficial: «Remoção segura — ViewerCleanupReport.ts — zero referências — aprovado pelo dono do produto (Khaled).» Status: **Ready for Removal**. Execução **não** iniciada. **Não** arquivar. **Excluído:** ViewerCore, resto de `viewer-engine`, BoxBuilder, L-12. Gatilho: «aplica Fase 1.11 — L-29». | Khaled (dono do produto) |
| 2026-08-18 | 1.12 | **Fase 1.12 — remoção definitiva aprovada** para L-30 (resíduos `backup_*` / `*.bak` / equivalentes). Texto oficial: «Remoção segura — resíduos finais no raiz e pastas secundárias — zero referências — aprovado pelo dono do produto (Khaled).» Status: **Ready for Removal**. L-16 e L-17 absorvidos. Execução **não** iniciada. Gatilho: «aplica Fase 1.12 — L-30». | Khaled (dono do produto) |
| 2026-08-18 | 1.13 | **Execução completa Fases 1.3–1.12 (L-03 → L-30).** Ficheiros removidos; `.gitignore` actualizado (`tmp/`, `test-output/`). Companion: `layout/utils.ts` removido com L-05. **Não** tocados: ViewerCore, BoxBuilder, TCN/DRILL/PI, PHP, Supabase, L-12/L-13/L-18/L-20. | Khaled (dono do produto) + execução Cursor |
| 2026-08-18 | 1.14 | **Z-01 iniciado:** auditoria completa do expositor geral. Alvo: `src/3d/viewer-engine/ViewerCore.ts` (6112 linhas). Relatório + plano de divisão em §6.1. **Zero** alterações ao Viewer. Antiga Z-01 (integration UI) reatribuída a **Z-04**. | Khaled (dono do produto) + auditoria Cursor |
| 2026-08-18 | 1.15 | **Z-01.2:** plano de modularização (fachada fina, módulos A–E, ProjectLoader/FormatAdapter, ordem Z-01.2.1…2.9). **Zero** alterações ao Viewer. Motor universal = visualização via `ProjectState`; CAD externo não gera TCN/DRILL. | Khaled (dono do produto) + plano Cursor |
| 2026-08-18 | 1.16 | **Z-01.2.1 executado:** remoção de NO-OPs (`events.emit`, régua legada, aliases, sync drawer NO-OP, `refineLayoutPlan`, `onAfterRenderTick`, `Tools3DToolbar`). `createRoom` e BoxBuilder intocados. Tag `z-01-2-1-noops`. | Khaled (dono do produto) + execução Cursor |
| 2026-08-18 | 1.17 | **Z-01.2.2 executado:** régua unificada via `MeasurementEngine`; botão duplicado do ContextMenu removido; aliases públicos da régua interna apagados. Tag `z-01-2-2-ruler`. | Khaled (dono do produto) + execução Cursor |
| 2026-08-18 | 1.18 | **Z-01.2.3 executado:** `SnapEngine` orquestra SmartAlign → TransformConstraints/ModelWallSnap; SmartSnapping overlay-only. Tag `z-01-2-3-snap`. | Khaled (dono do produto) + execução Cursor |
| 2026-08-18 | 1.19 | **Z-01.2.4 executado:** `LayoutEngine` orquestra auto-fill; Kitchen 3.0 canónico de projecto; autoLayout/smartLayout 3D como adapters. Tag `z-01-2-4-autofill`. | Khaled (dono do produto) + execução Cursor |

### 13.2 Changelog v1.0 → v1.1 (resumo das mudanças neste documento)

| Tipo | Mudança |
|------|---------|
| **Governança** | Secção §0 — modo planeamento; proibições explícitas TCN/DRILL/PI/validation |
| **Nova categoria** | `P-` zonas protegidas (10 itens); `Z-` zonas dormidas (3 itens) |
| **Reclassificação** | L-19 → F-15; L-21 → D-14 (activo); L-23/L-24 → Z-01/Z-02 |
| **Novos itens** | L-27 (37 RELATORIO_* raiz), L-28 (test-output), D-19 (buildBoxLegacy), D-20 (services naming), F-13/F-14, R-16…R-18 |
| **Reconciliação** | Tabela §0.3; `buildBasicDrillOperations` removido do código (auditoria Mar/2026 desactualizada); limpeza Fev/2025 já aplicada |
| **Correcção** | `ajuda/AjudaPage.tsx` **não** está na lista de remoção; `src/services/` vivo documentado |
| **Clarificação** | Relatório «Cliny/VS Code» = sessão Cursor Aug 2026; não ficheiro no repo |
| **Testes** | Secção §8.2 lacunas de cobertura |
| **Contagens** | 26 L- + 20 D- + 15 F- + 18 R- + 10 P- + 3 Z- = **92 itens catalogados** |

### 13.3 Changelog v1.1 → v1.2

| Tipo | Mudança |
|------|---------|
| **Decisão oficial** | Fase 1.3: L-03 + L-04 com **remoção definitiva aprovada** pelo dono do produto (Khaled); execução pendente |
| **Estrutura** | Fase 1 desdobrada em passos 1.1–1.8; nova §3.1 (decisões de remoção aprovadas) |
| **Estado L-03 / L-04** | Risco = nulo + «remoção aprovada»; fluxo canónico de projectos documentado (`listProjects` + `/api/projects/index.php`) |
| **Execução** | Nenhuma — ficheiros **não** apagados |

### 13.4 Changelog v1.2 → v1.3

| Tipo | Mudança |
|------|---------|
| **Status** | L-03 e L-04: **Ready for Removal** (prontos para remoção na execução da Fase 1.3) |
| **Decisão** | Remoção definitiva (inalterada) |
| **Execução** | Pendente — gatilho: «aplica Fase 1.3 — L-03 + L-04» |
| **Ficheiros** | `src/hooks/useProjects.js` e `src/services/apiClient.js` **ainda no repo** |

### 13.5 Changelog v1.3 → v1.4

| Tipo | Mudança |
|------|---------|
| **Decisão oficial** | Fase 1.4: L-05…L-08 com **remoção definitiva** aprovada pelo dono do produto (Khaled) |
| **Status** | L-05, L-06, L-07, L-08: **Ready for Removal** |
| **Execução** | Pendente — gatilho: «aplica Fase 1.4 — L-05 – L-08» |
| **Exclusão** | `src/core/layout/layoutWarnings.ts` permanece **activo** |
| **Substitutos** | `cutlayout`, `nesting3`, `drill`, `cnc`, `drawers`, `remate` |
| **Ficheiros** | skeleton `core/layout/` **ainda no repo** |

### 13.6 Changelog v1.4 → v1.5

| Tipo | Mudança |
|------|---------|
| **Decisão oficial** | Fase 1.5: L-09…L-11 com **remoção definitiva** aprovada pelo dono do produto (Khaled) |
| **Status** | L-09, L-10, L-11: **Ready for Removal** |
| **Execução** | Pendente — gatilho: «aplica Fase 1.5 — L-09 – L-11» |
| **Exclusão** | ViewerCore, `viewer-engine`, BoxBuilder; L-12 e L-13 passam a passo **1.9** (ainda proposta) |
| **Substitutos** | ViewerCore / motor actual (`viewer-engine`) |
| **Ficheiros** | stubs Modelo B **ainda no repo** |

### 13.7 Changelog v1.5 → v1.6

| Tipo | Mudança |
|------|---------|
| **Decisão oficial** | Fase 1.6: L-14 + L-15 com **remoção definitiva** aprovada pelo dono do produto (Khaled) |
| **Status** | L-14, L-15: **Ready for Removal** |
| **Execução** | Pendente — gatilho: «aplica Fase 1.6 — L-14 + L-15» |
| **Exclusão** | Restantes testes em `tests/` e toda a pasta `src/validation/` |
| **Acção** | Remoção (não substituição) dos placeholders `expect(true).toBe(true)` |
| **Ficheiros** | `tests/export.test.ts` e `tests/projectState.test.ts` **ainda no repo** |

### 13.8 Changelog v1.6 → v1.7

| Tipo | Mudança |
|------|---------|
| **Decisão oficial** | Fase 1.7: L-25 com **remoção definitiva** aprovada pelo dono do produto (Khaled) |
| **Status** | L-25: **Ready for Removal** |
| **Execução** | Pendente — gatilho: «aplica Fase 1.7 — L-25» |
| **Correcção de inventário** | 13 → **16** ficheiros `*.diff`/`*.patch` na raiz (lista em §3.1) |
| **Reatribuição** | Passo 1.1 deixa de apontar a L-25; antigo 1.7 (L-16…L-18, L-20) passa a **1.10** |
| **Exclusão** | Código de produto; patches fora da raiz; CI/build/deploy |
| **Ficheiros** | os 16 patches/diffs da raiz **ainda no repo** |

### 13.9 Changelog v1.7 → v1.8

| Tipo | Mudança |
|------|---------|
| **Regra oficial** | Remover definitivamente qualquer ficheiro que não seja usado e que não quebre o projecto — nas fases L-, sem execução automática |
| **Decisão oficial** | Fase 1.8: L-26 com **remoção definitiva** aprovada pelo dono do produto (Khaled) |
| **Status** | L-26: **Ready for Removal** |
| **Execução** | Pendente — gatilho: «aplica Fase 1.8 — L-26» |
| **Reclassificação** | Ex-L-26 (`ViewerCleanupReport.ts`) → **L-29**; antigo passo 1.8 (L-28) → **1.11** |
| **Inventário L-26** | 4 ficheiros na raiz: `RELATORIO-FINAL.md`, `RELATORIO_EXECUTIVO.txt`, `RELATORIO_TECNICO_COMPLETO.html`, `RELATORIO_TECNICO_FINAL_RECONSTRUCAO_DOORS_DRAWERS.html` |
| **Exclusão** | L-27 (33× `RELATORIO_*.md`), `docs/`, `ferragens_3d/`, páginas `RelatorioFinal*` |
| **Ficheiros** | os 4 relatórios L-26 **ainda no repo** |

### 13.10 Changelog v1.8 → v1.9

| Tipo | Mudança |
|------|---------|
| **Decisão oficial** | Fase 1.9: L-27 com **remoção definitiva** (não arquivar) aprovada pelo dono do produto (Khaled) |
| **Status** | L-27: **Ready for Removal** |
| **Execução** | Pendente — gatilho: «aplica Fase 1.9 — L-27» |
| **Inventário** | 33× `RELATORIO_*.md` na raiz (lista em §3.1) |
| **Reatribuição** | Antigo passo 1.9 (L-12, L-13) → **1.13** |
| **Exclusão** | L-26 (lote 1.8); `docs/RELATORIO_*`; `ferragens_3d/RELATORIO_*`; páginas `RelatorioFinal*` |
| **Fase 2** | Removida a linha «Arquivar RELATORIO_* raiz» |
| **Ficheiros** | os 33 relatórios L-27 **ainda no repo** |

### 13.11 Changelog v1.9 → v1.10

| Tipo | Mudança |
|------|---------|
| **Decisão oficial** | Fase 1.10: L-28 com **remoção definitiva** aprovada pelo dono do produto (Khaled) |
| **Status** | L-28: **Ready for Removal** |
| **Execução** | Pendente — gatilho: «aplica Fase 1.10 — L-28» |
| **Âmbito alargado** | De só `test-output/` para sobras internas: `tmp/`, `test-output/` e equivalentes (`old/`, `draft/`, `experiments/`, `legacy/`, `unused/`) |
| **Inventário actual** | `tmp/` (~10) + `test-output/` (~55); pastas `old/draft/experiments/legacy/unused` **ausentes** |
| **Reatribuição** | Antigo passo 1.10 (L-16…L-18, L-20) → **1.14**; gitignore de 1.11 absorvido na 1.10 |
| **Exclusão** | `dist/`, `node_modules`, `*.legacy.ts` (P-09), `src/core/docs/archive` |
| **Ficheiros** | `tmp/` e `test-output/` **ainda no repo** |

### 13.12 Changelog v1.10 → v1.11

| Tipo | Mudança |
|------|---------|
| **Decisão oficial** | Fase 1.11: L-29 com **remoção definitiva** (não arquivar) aprovada pelo dono do produto (Khaled) |
| **Status** | L-29: **Ready for Removal** |
| **Execução** | Pendente — gatilho: «aplica Fase 1.11 — L-29» |
| **Inventário** | `src/3d/viewer-engine/cleanup/ViewerCleanupReport.ts`; pasta `cleanup/` só com este ficheiro |
| **Reatribuição** | Antigo passo 1.12 (arquivar L-29) → absorvido na **1.11** como remoção |
| **Exclusão** | ViewerCore, resto de `viewer-engine`, BoxBuilder, L-12 (`SelectionManager`) |
| **Ficheiros** | `ViewerCleanupReport.ts` **ainda no repo** |

### 13.13 Changelog v1.11 → v1.12

| Tipo | Mudança |
|------|---------|
| **Decisão oficial** | Fase 1.12: L-30 com **remoção definitiva** aprovada pelo dono do produto (Khaled) |
| **Status** | L-30: **Ready for Removal** |
| **Execução** | Pendente — gatilho: «aplica Fase 1.12 — L-30» |
| **Inventário** | 1× `*.bak` + 1× JSON archive; restantes padrões do lote **ausentes** |
| **Absorção** | L-16 e L-17 passam a fazer parte de L-30; 1.14 fica só L-18 + L-20 |
| **Exclusão** | `scripts/backupManager.ts` (produto); `tmp/encoding-backup` (L-28); `*.legacy.ts` (P-09) |
| **Ficheiros** | hits L-30 **ainda no repo** |

### 13.14 Changelog v1.12 → v1.13

| Tipo | Mudança |
|------|---------|
| **Execução** | Fases 1.3–1.12 (L-03 → L-30) **concluídas** |
| **Companion** | `src/core/layout/utils.ts` removido com L-05 (dependia de `types.ts`; zero consumidores) |
| **`.gitignore`** | Adicionados `tmp/` e `test-output/` |
| **Intocado** | ViewerCore, `viewer-engine` (excepto L-29), BoxBuilder, TCN/DRILL/PI, PHP, Supabase, `layoutWarnings.ts` |
| **Pendente** | L-01, L-02, L-12, L-13, L-18, L-20 |

### 13.15 Changelog v1.13 → v1.14

| Tipo | Mudança |
|------|---------|
| **Z-01** | Reatribuído ao expositor Viewer: `src/3d/viewer-engine/ViewerCore.ts` (6112 linhas) |
| **Z-04** | Nova ID para integration UI industrial (ex-Z-01 / L-23) |
| **Secção** | Nova §6.1 — auditoria, duplicações, NO-OPs, plano de módulos, recomendações |
| **Execução de código** | Nenhuma — ViewerCore, BoxBuilder e `viewer-engine` vivo **intocados** |
| **Fase 5** | Passa a referenciar §6.1 como pré-requisito documental |

### 13.16 Changelog v1.14 → v1.15

| Tipo | Mudança |
|------|---------|
| **Z-01.2** | Nova §6.2 — arquitectura de fachada fina, módulos A–E, formatos, gatilhos Z-01.2.1…2.9 |
| **SSOT** | Visualização universal via `NormalizedProject` → `ProjectState`; Viewer não fabrica |
| **Reuso** | Mapa explícito: não criar `SceneEngine` paralelo a `SceneManager` / `ViewerRuntimeLoop` |
| **Execução de código** | Nenhuma |

### 13.17 Changelog v1.15 → v1.16

| Tipo | Mudança |
|------|---------|
| **Z-01.2.1** | NO-OPs removidos do ViewerCore e wiring associado |
| **UI** | `Tools3DToolbar.tsx` apagado (`return null`) |
| **F-08** | `events.emit` removido |
| **Intocado** | `createRoom`, BoxBuilder, TCN/DRILL/PI, PHP, Supabase |

### 13.18 Changelog v1.16 → v1.17

| Tipo | Mudança |
|------|---------|
| **Z-01.2.2** | `MeasurementEngine` como fachada canónica; botão «Régua interna» removido do ContextMenu |
| **API** | Removidos aliases `setInternalMeasurementMode` / `enableInternalRuler` / `disableInternalRuler` |
| **Intocado** | `createRoom`, BoxBuilder, snap, layout, schema ProjectState, pipeline industrial |

### 13.19 Changelog v1.17 → v1.18

| Tipo | Mudança |
|------|---------|
| **Z-01.2.3** | `SnapEngine` como orquestrador canónico; ordem SmartAlign → TransformConstraints; ModelWallSnap só via wrapper |
| **Overlay** | `SmartSnapping.applyDuringTranslate` confirmado fora do pipeline de drag |
| **D-10** | Limiar 250 mm testado; algoritmos de alinhamento/parede **não** fundidos |
| **Intocado** | BoxBuilder, malha, RoomManager, LayoutEngine, ProjectState, pipeline industrial |

### 13.20 Changelog v1.18 → v1.19

| Tipo | Mudança |
|------|---------|
| **Z-01.2.4** | `LayoutEngine` como orquestrador canónico; Kitchen 3.0 = projecto; 3D = adapters autoLayout/smartLayout |
| **Hooks** | `useAutoRoomFillActions` deixa de chamar `core/autoRoomFill` directamente |
| **Intocado** | BoxBuilder, malha, RoomManager, SnapEngine, schema ProjectState, menus UX, pipeline industrial |

---

## 14. Como usar este hub (execução futura)

1. Escolher IDs (`L-`, `D-`, `F-`, `R-`; nunca `P-` sem dono industrial).
2. Pedir execução **explícita** (ex.: «aplica Fase 1.11 — L-29», «aplica Z-01 — extrair módulo Z-01.2.1»). A regra L- **não** substitui este gatilho.
3. Diff completo antes de gravar (regra workflow do projecto).
4. Actualizar §13.1 com data e IDs concluídos.
5. Manter `src/validation/` verde.

Fim do documento de planeamento (v1.19).
