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
| F3-D | Dimensões gaveta legado (`gavetaRecuoProfundidadeCorredicaMm`) | Consistência com Quadro V6 / X1=38 / `corredica_marca` |
| F3-E | JSON de projecto incompletos (SSH) | Serialização / campos omitidos |

## Próximos passos

1. ~~Fechar as falhas restantes → CI bloqueante~~ **FEITO**
2. **Fase 3** — A+B feitos e no remoto; **C fechado** (`skipExistingStationOrders: true`); evidência **D** (clearance legado) pronta; depois E + F3-edges
3. Fase 2 — docs / flags / arredondamento financeiro (produto)
4. Fases 5–7 — limpeza, modularidade, placeholders industriais
5. Follow-up **F3-edges** após C/D/E

## Regras de trabalho (mantidas)

- Diff completo → confirmação explícita → gravar (excepto quando o utilizador pede commit/aplicar explicitamente)
- Events System: documentado, zero código nesta fase
- Zero deps novas quando possível
- Não completar stubs sem evidência de remoção deliberada
