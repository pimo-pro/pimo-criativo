# Handoff auditoria PIMO-Criativo — 2026-08-31

Documento de continuidade da auditoria não-destrutiva e das Fases 0–1 (estabilização da suite / correcções de viewer e nesting).

## Estado da suite — Fase 1 FECHADA

| Marco | Test files | Tests |
|---|---|---|
| Início auditoria (baseline) | — | **14 falhas** |
| Após Fase 0 + Fase 1 parcial (`63837315`) | 4 failed \| 400 passed | **4 falhas** |
| Após fix contorno remate (`e2fd7735`) | 3 failed \| 401 passed | **3 falhas** |
| **Fase 1 fechada (este handoff)** | **404 passed \| 0 failed** | **0 falhas** / ~1949 passed |

**Progresso líquido: 14 → 0 falhas.** CI `verify.yml` passou a **bloqueante** (lint + tsc + test sem `continue-on-error`).

### Fechos Fase 1 (últimos 3)

| Teste | Tipo | Notas |
|---|---|---|
| `financeiroMargemGanho.legacyBaseline` | só teste | ±0.01 Unificado vs Relatório; ver nota Fase 2 |
| `p3IndustrialCenter.smoke` | só teste | linha «Peças» por label `/peças/i`, não índice 0 |
| `nestingV3IndustrialParity` (SPM_FULL / gav_lat) | **produção** | `inferV3RotationFromFootprint` em `cutLayoutResultToV3State` |

---

## Nesting V3 — footprint trocado + rotacao=0 (**maior risco de negócio da Fase 1**)

### Problema (bug real de produção)

O CutLayout podia gravar L×A **já trocado** com `rotacao=0` (especialmente `gav_lat_esq` / `gav_lat_dir`). O bridge V3 (`cutLayoutResultToV3State`) copiava `rot=0` à letra →:

- overflow no canvas de nesting V3;
- footprint errado no export **TCN / PDF / etiquetas** via `fixedPlacementsFromV3State`.

Impacto de negócio: peças laterais de gaveta com dimensões/orientação incorrectas no pacote industrial (corte CNC + etiquetas).

### Fix

`inferV3RotationFromFootprint` em `src/core/cutlayout/integration/cutLayoutResultToV3State.ts`:

- swapped + rot 0/180 → força 90/270;
- swapped + rot já 90/270 → mantém (sem dupla-aplica).

### Evidência

- `docs/audit/nesting-v3-gav-lat-swap-rot0.svg` (+ `.html`) — após fix: **13 match, 0 overflow**.
- Suite: `cutLayoutResultToV3State.test.ts` + `nestingV3IndustrialParity.test.ts`.

### Limite forense

Estado Nesting V3 **não** vive no JSON de projecto no servidor; impacto em clientes já exportados não é reconstruível só por SSH aos `*.json` de `api/projects/data/`.

---

### Nota Fase 2 — arredondamento financeiro (esperado)

O **Unificado (ADMIN ao vivo)** calcula `totalProjeto = subtotal + adm + montagem + portes + (subtotal×IVA)` em float e só depois se aplica `round2` na UI/mapper.

O **Relatório finalizado** (`finalizeReportFinanceiro` / `calcReportTotals`) faz `round2` em cada parcela e só depois soma.

Na fronteira de cêntimos (ex. fixture com 2 gavetas: `484.3859878` → Unificado arredondado **484.39**, Relatório **484.38**) a divergência de **1 cêntimo é comportamento esperado**, não bug. Documentar na Fase 2 (docs de produto/financeiro); não unificar as fórmulas sem decisão explícita de produto.

## Contorno de remates — “canto fantasma” (fechado em `e2fd7735`)

### Problema

`ViewerPanelVisibility` desenhava o overlay preto de **todas** as peças `isRematePiece` com AABB (`createBoxWireframeContourGeometry`). Em tampos angulares (ex.: frente 900 mm / trás 600 mm) a malha é trapézio, mas o wireframe era um rectângulo — **canto fantasma** visível com arestas ligadas.

### Decisão

Opção **A** (produção) + evidência visual (screenshot vista de cima). Critério de ramo:

- `isRematePiece` + `geometry instanceof THREE.BoxGeometry` → AABB (avista / completo / L / merge)
- `isRematePiece` + geometria custom (TAMPO postforming / ângulo / recorte / união) → `EdgesGeometry`

Alinhado com `SelectionOutlineController` (já usava EdgesGeometry em `isTampoPiece`).

### Testes (`ViewerPanelVisibility.contour.test.ts`)

| Caso | Expectativa |
|---|---|
| Tampo angular | `hasSlantedPlanEdge` = true (milan, não AABB) |
| Recorte fogão (**B2a**) | arestas do furo **aceites** (`insideHole` = true) — consistência com outline de selecção |
| Remate rectangular `BoxGeometry` | 12 arestas / 24 vértices AABB |

### Ficheiros

- `src/3d/viewer-engine/panels/ViewerPanelVisibility.ts`
- `src/3d/viewer-engine/panels/ViewerPanelVisibility.contour.test.ts`

Sem impacto no pipeline industrial (só overlay visual do viewer).

## Fase 0 (já no commit `63837315`)

- ESLint: `no-unused-vars` base → off (ruído → erros reais)
- `textureCache.ts`: guard `document`
- `vitest.config.ts`: `testTimeout: 30_000`

## Fase 1 parcial (já no commit `63837315`)

Correcções de testes / UI / CI (ex.: corner left 447/447, mocks work orders, metalBox, lazyInit paths, mojibake, workflow verify não-bloqueante, etc.). Suite 14→4; o 4.º era o contorno (resolvido em `e2fd7735` → 3; depois nesting/financeiro/p3 → **0**).

## SSH / projetos reais (contexto)

- Path: `~/domains/pimo.pro/public_html/api/projects/data/*.json`
- Zero uso observado de presets `industrial-corner-(left|right)-900x720x600-v1`
- JSON por vezes incompletos → candidato a **Fase 3**

## Achados críticos ainda abertos (Fase 3+)

| ID | Item | Notas |
|---|---|---|
| F3-edges | `updatePieceEdgeSelection` / `savePieceEdges` | Mesmo padrão pré-fix B: `savePieceEdges` **throw** no `PIMO_WRITE_BLOCKED`; `usePieceInteraction` chama `onPersisted`/reload sem verificar resultado. Fora do âmbito do fix B (`persistTransform`); tratar após C/D/E. |
| F3-C | Work orders duplicáveis | **Fechado (Fase 3C):** `skipExistingStationOrders: true`. Nunca esteve true antes (só warn desde 2026-06-23). |
| F3-D | Clearance corrediça 20 mm vs laterais −10 mm | **Fechado (Fase 3D):** documentação SSOT desactualizada — comportamento `generateDrawerGroup` correcto (cascata seleção NL + sideDepth). Nota produto: catálogo código `[350…600]` vs fornecedor 250–550 — verificar fora do código. |
| F3-E | JSON de projecto incompletos (SSH) | Evidência código abaixo — **sem fix ainda** |

## Fase 3D — fechado (documentação SSOT)

- **Veredicto:** não é bug de produção; SSOT em `DrawerSystemReference.ts` estava desactualizado (20 mm classificado como «legado UI»).
- **Comportamento confirmado:** cascata em `generateDrawerGroup` — 20 mm reduzem profundidade útil para **selecionar** NL; `bodyDepth = nominalDepth`; laterais `bodyDepth − 10 mm` (`DRAWER_SIDE_DEPTH_SLIDE_CLEARANCE_MM`). Dois efeitos, não dupla contagem.
- **Alteração:** apenas texto SSOT (`runner-clearance`, `runner-clearance-hardcoded`, `DRAWER_GEOMETRY_PHASE6.runnerClearance`).
- **Nota produto (fora do código):** `DRAWER_SLIDE_LENGTHS_MM` = `[350, 400, 450, 500, 550, 600]` — confirmar catálogo fornecedor vs 250–550 mencionado pelo utilizador.
- **Regressão:** suite completa **409 ficheiros / 1970 testes OK** (1 skipped), após actualização SSOT.

## Fase 3E — JSON incompletos (evidência código, em curso)

**Observação SSH (já registada):** ficheiros em `api/projects/data/*.json` por vezes omitem dados → auditorias forenses/sync não são 100% conclusivas.

### Formato no servidor

| Camada | O quê |
|---|---|
| POST body | `PimoProjectData` (`projectsApi.remoteSaveProject` → `buildPimoProjectDataFromRequest`) |
| Ficheiro PHP | Grava `$input` tal qual (`index.php` POST) — **não** envolve `SavedProjectRecord.snapshot` |
| GET load | Se não há chave `snapshot`, reconstrói via `toRecordFromProjectData` a partir de `settings.projectState` |

### Pontos de perda / denormalização (código)

1. **`buildPimoProjectDataFromRequest`** (`projectsMappers.ts`):
   - SSOT do estado = `settings.projectState` (cópia integral de `serializeState`).
   - Campos top-level (`boxes`, `shelves`, `dividers`, `holes`, …) são **extractos** do `projectState`.
   - `holes` = flatten de `cutList[].drillHoles` apenas — **não** espelha todo o modelo de furação.
   - `boxes` = `workspaceBoxes ?? boxes` — possível divergência se só uma chave existir no JSON antigo.

2. **Merge defensivo PHP** (`index.php` ~513–528): preserva só `settings.projectReport` e `settings.productionRelease` se o POST não os trouxer. Outras chaves em `settings.*` **não** têm merge equivalente.

3. **Relatório / production release** (`projectReportStore.ts`, `productionReleasePersist.ts`): usam padrão GET completo → funde uma chave → POST, precisamente porque o save normal pode sobrescrever. Comentário explícito em `productionReleasePersist.ts`: «Não apaga settings.projectReport».

4. **Nesting V3:** estado **não** persiste no JSON de projecto no servidor (já no handoff) — exportações antigas não reconstruíveis só por SSH.

5. **Load cliente** (`useProjectIoActions.loadProjectSnapshot`): revive **só** `entry.snapshot.projectState`; top-level `PimoProjectData.boxes` / `holes` no ficheiro SSH **não** entram no restore se `settings.projectState` estiver incompleto ou ausente.

### Hipóteses ordenadas (pendente amostra SSH)

| # | Hipótese | Evidência |
|---|---|---|
| H1 | Saves antigos / parciais sem `settings.projectState` completo | Load depende de `settings.projectState`; top-level é legado |
| H2 | Race: POST snapshot antes de merge de `productionRelease` / `projectReport` | PHP merge parcial + outbox (`PRODUCTION_RELEASE_OUTBOX_KEY`) |
| H3 | Campos novos de `ProjectState` nunca serializados em projectos guardados antes da feature | `reviveState` tolera ausência; forense vê «incompleto» |
| H4 | Sync A (Fase 3A) falhou silenciosamente no passado | Menos provável pós-fix; verificar `updatedAt` local vs remoto |

### Próximo passo E (sem fix)

1. ~~Amostra manual SSH (grep)~~ — **feito:** projectState/workspaceBoxes 5/5; productionRelease 2/5 (benigno); H1 sem evidência; H2 refutado via harness (`projectsProductionReleaseMerge.fase3e.runtime.test.ts`).
2. Comparar com offline IDB do mesmo `id` (se existir no cliente) — opcional.
3. Só então propor fix mínimo (ex.: merge PHP alargado vs. deixar de duplicar top-level).

## Backlog desenvolvimento futuro (fora do escopo E)

| Item | Notas |
|---|---|
| Persistência sep/div + modelos gaveta | Separadores/divisores (`sep`/`div`) e novos modelos de gaveta — confirmar se `serializeState` / `buildPimoProjectDataFromRequest` / load preservam correctamente. Backlog; não bloqueia fecho de E. |

## Deploy / CI (urgente — 2026-09-01)

| Workflow | Trigger | Estado |
|---|---|---|
| `verify.yml` | **push main + PR** | Últimos 5 runs **falharam no Lint** (105 erros ESLint pré-existentes; typecheck/testes skipped) |
| `deploy.yml` | **só tag `v*`** (via `npm run publish`) | **Não dispara em push main.** Último deploy OK: **v6.0828.1714** (2026-08-28). Produção live = commit `f453a995` |

Commits de hoje (sync, Supabase, WO, nesting, F3D doc) estão em `main` mas **não estão live** até correr `npm run publish`.

### Achado de processo CI (verify.yml — não bloqueante agora)

O `verify.yml` corre Lint → Typecheck → Tests **em sequência com fail-fast**: se Lint falha, TSC e testes **nunca correm**. Resultado: 5 pushes seguidos com Lint vermelho (105 erros pré-existentes) **mascararam** um erro real de build TS (Fase 3A/3B) sem qualquer sinal no Actions.

**Proposta futura (registar, não implementar agora):** correr os 3 passos sempre (cada um reporta o seu resultado); passo final agrega e falha o job se qualquer um falhou — evita que um passo esconda outro.


1. ~~Fechar as falhas restantes → CI bloqueante~~ **FEITO**
2. **Fase 3** — A+B+C+D fechados; **E** (JSON incompletos) em curso; depois F3-edges
3. Fase 2 — docs / flags / arredondamento financeiro (produto)
4. Fases 5–7 — limpeza, modularidade, placeholders industriais
5. Follow-up **F3-edges** após C/D/E

## Regras de trabalho (mantidas)

- Diff completo → confirmação explícita → gravar (excepto quando o utilizador pede commit/aplicar explicitamente)
- Events System: documentado, zero código nesta fase
- Zero deps novas quando possível
- Não completar stubs sem evidência de remoção deliberada
