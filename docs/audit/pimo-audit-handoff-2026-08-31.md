# Handoff auditoria PIMO-Criativo — 2026-08-31

Documento de continuidade da auditoria não-destrutiva e das Fases 0–1 (estabilização da suite / correções de viewer).

## Estado da suite

| Marco | Test files | Tests |
|---|---|---|
| Início auditoria (baseline) | — | **14 falhas** |
| Após Fase 0 + Fase 1 parcial (`63837315`) | 4 failed \| 400 passed | **4 falhas** |
| Após fix contorno remate + B2a (este handoff) | 3 failed \| 401 passed | **3 falhas** / 1941 passed |

**Progresso líquido: 14 → 3 falhas.**

### 3 falhas ainda abertas (pré-existentes / fora do contorno)

1. `src/.../p3IndustrialCenter.smoke.test.ts` — expectativa de texto (`'caixas'` vs `/pe/`)
2. `src/nesting-v3/nestingV3IndustrialParity.test.ts` — paridade de assinatura de layout (coords negativas em laterais de gaveta)
3. `src/core/projectReport/financeiroMargemGanho.legacyBaseline.test.ts` — `484.38` vs `484.39` (arredondamento)

## Contorno de remates — “canto fantasma” (fechado)

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

Correcções de testes / UI / CI (ex.: corner left 447/447, mocks work orders, metalBox, lazyInit paths, mojibake, workflow verify não-bloqueante, etc.). Suite 14→4; o 4.º era o contorno (agora resolvido → 3).

## SSH / projetos reais (contexto)

- Path: `~/domains/pimo.pro/public_html/api/projects/data/*.json`
- Zero uso observado de presets `industrial-corner-(left|right)-900x720x600-v1`
- JSON por vezes incompletos → candidato a **Fase 3**

## Próximos passos sugeridos

1. Fechar as **3 falhas** restantes → CI bloqueante viável
2. Fase 2 — docs / flags
3. Fase 3 — sync / Supabase / WO / JSON incompletos (prioridade produto)
4. Fases 5–7 — limpeza, modularidade, placeholders industriais

## Regras de trabalho (mantidas)

- Diff completo → confirmação explícita → gravar
- Events System: documentado, zero código nesta fase
- Zero deps novas quando possível
- Não completar stubs sem evidência de remoção deliberada
