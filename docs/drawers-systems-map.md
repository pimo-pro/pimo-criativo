# Sistemas de Gavetas — Mapa Completo

> **ESTADO (23-08-2026): documento HISTÓRICO / OBSOLETO como SSOT de runtime.**  
> O mapa abaixo foi escrito em 2026-07-27 quando o Modelo B / `european/` ainda era o default de produto.  
> **Runtime actual (código):** só o **Modelo A** está activo (`isDrawerModeloAActive()` sempre `true`; `isDrawerModeloBActive()` sempre `false`).  
> A pasta `src/core/drawers/european/` **não existe**. Não usar este ficheiro para decisões de limpeza ou flags sem revalidar o código.  
> Fonte de verdade de flags: `src/core/drawers/drawerSystemFlags.ts` + `drawerModeloAGate.ts`.

> **Fase original:** análise e documentação apenas (PASSOS 0–5), data 2026-07-27.  
> **Âmbito histórico:** `pimo-criativo/` na altura do mapa.

---

## Snapshot de runtime CORRECTO (substitui a secção antiga «Estado actual»)

| Item | Valor actual (23-08-2026) |
|---|---|
| Sistema activo | **Modelo A** (Sistema Unificado / pipeline clássico em `src/core/drawers/**`) |
| Modelo B / europeu | **Morto em runtime**; pasta `european/` **ausente** |
| `isDrawerModeloAActive()` | Sempre `true` (restauro) |
| `isDrawerModeloBActive()` | Sempre `false` |
| `DRAWER_MODELO_A_DEFAULT_ENABLED` | `true` |
| Migração B | `applyModeloBProductDefaultMigration()` é no-op |

O texto restante deste ficheiro mantém-se como **arquivo histórico** (glossário, inventário de ficheiros de Jul/2026) e **pode estar errado** face ao código actual — sobretudo onde afirma «Modelo B ON por default» ou existência de `european/`.

---

## Glossário (terminologia no código vs UI) — histórico Jul/2026

| Termo do utilizador | Termo no código | Onde aparece na UI |
|---|---|---|
| **Sistema antigo (Modelo A)** | Pipeline clássico em `src/core/drawers/**` | Admin → Produtos → **Configurações das Gavetas (Sistema Unificado)** + **Regras das Gavetas** + UI clássica no Viewer |
| **Sistema novo (histórico)** | **Modelo B** / Sistema Europeu (`european/**`) — **removido / inexistente no código actual** | Hub Admin «Gavetas» (legado documental) |
| Flag de escolha | `isDrawerModeloAActive()` em `drawerSystemFlags.ts` | Toggle histórico; restauro ignora desactivação |

**Nota:** `src/core/drawers/README.md` foi corrigido em 23-08-2026 para reflectir só Modelo A activo.

---

## Estado actual de runtime (interferência crítica) — OBSOLETO (Jul/2026)

> **Não usar.** Ver snapshot correcto no topo. O quadro seguinte é o texto original e está **errado** face ao código de 23-08-2026.

| Item | Valor no mapa original (obsoleto) |
|---|---|
| Default produto | ~~Modelo A OFF → Modelo B ON~~ → **corrigido: só A ON** |
| Persistência | `localStorage["pimo_drawer_modelo_a_enabled"]` (legado; restauro força A) |
| Migração one-shot | ~~força false~~ → **no-op no código actual** |
| Regra de escolha | ~~B = !A~~ → **B sempre false** |

Conclusão actual: o Modelo B **não** substitui o A em runtime; o pipeline clássico (A) é o único activo.

---

## Sistema Antigo (Modelo A / Configurações das Gavetas — Sistema Unificado)

### Onde é configurado

1. **Admin → Produtos → Regras das Gavetas**  
   - Ficheiro: `src/components/admin/DrawerRulesAdminPage.tsx`  
   - Guarda em: `SettingsSchema.gavetas` (via `SettingsContext` / `updateSettings`)  
   - Campos: espessuras, folgas, profundidades, corrediças, soft-close, caixa metálica, handles, validações.  
   - Também existe bloco relacionado em `SystemSettingsBase` («Regras das Gavetas (Drawer Rules)»).

2. **Admin → Produtos → Configurações das Gavetas (Sistema Unificado)**  
   - Ficheiro: `src/components/admin/DrawerSystemUnifiedAdminPage.tsx`  
   - Mostra mapa oficial/legado (`DrawerSystemReference.ts`) + valores live de `settings.gavetas`.  
   - **Não** é o motor de geração; é documentação operacional + inventário de regras.

3. **UI de projecto (Viewer)** quando Modelo A activo:  
   - `HomeLeftPanelSelected.tsx` — stepper de quantidade / opções clássicas  
   - `BoxLayersPanel.tsx` — edição por gaveta (altura, material, tipo normal/pro, abertura)  
   - `DrawerConfigPanel.tsx` — painel de configuração clássico

### Como é guardado no projecto

| Campo | Local | Função |
|---|---|---|
| `gavetas` (número) | `WorkspaceBox` / `BoxModule` | Contagem pedida |
| `drawerType`, `drawerHeightMode`, `alturaGaveta` | `WorkspaceBox` / `BoxModule` | Modo clássico |
| `drawersLayer: DrawerLayerItem[]` | `WorkspaceBox` | Camada persistida (SSOT visual/parcial produção) |
| `settings.gavetas` | Settings globais (não por caixa) | Defaults/regras do domínio A |
| Sem `metadata.modeloB` | Nos `DrawerLayerItem` clássicos | Distingue layers A das B |

### Como é usado na produção

Fluxo oficial Modelo A (documentado em `DrawerSystemReference.DRAWER_OFFICIAL_PIPELINE`):

```text
settings.gavetas
  → DrawerParametrics.calculateDrawerSpecs
  → DrawerGenerationService.generateDrawerGroup
  → DrawerGroup (alturas/posições)
  → drawerGroupToLayerItems → WorkspaceBox.drawersLayer
  → drawerCutlistAdapter → cutlistFromBoxes
  → buildCutlistItemsForIndustrialExport → CNC/TCN/nesting
```

Pipeline legado paralelo (ainda referenciado):

```text
BoxModule.gavetas → boxManufacturing.gerarPaineis / gerarGavetas / gerarFerragens
  → PDFs técnicos / totais industriais (parcial)
```

Pontos de produção (Modelo A + partilhados com filtro de gate):

- `src/services/boxLayersService.ts` — gera `drawersLayer` clássico **só se** `isDrawerModeloAActive()`
- `src/services/drawerCutlistAdapter.ts` — cutlist via `resolveActiveDrawersLayer`
- `src/core/manufacturing/cutlistFromBoxes.ts` — usa `resolveActiveDrawersLayer`
- `src/core/manufacturing/drawerManufacturing.ts` / `boxManufacturing.ts`
- `src/core/pdf/pdfUnified.ts`, `pdfFerragensTotaisNormalize.ts`, etiquetas, etc.
- Furação: `src/core/drawers/drilling/*`, `drillingService`, PI em `data/moveisUnificados/pi/*`
- Roupeiros: `src/core/wardrobe/wardrobeRules.ts`

> **Garantia desta fase:** nenhum ficheiro industrial (`src/industrial/**`, CNC, cutlist, técnico, etiquetas) foi modificado nesta análise.

### Como é usado no Viewer

- `DrawerFactory` 3D (`src/3d/objects/DrawerFactory.ts`) + assemblers/updaters  
  - **Atenção:** este ficheiro é clássico na origem mas **já contém ramos `modeloB`** (pose europeia, skip metal-box clássico, etc.) — preservar o ficheiro; na fase de remoção só reverter ramos B.
- `useCalculadoraSync.ts` — sync boxes → viewer com `resolveActiveDrawersLayer`
- `DrawerController` / motion services — abertura/fecho
- `Workspace.tsx` — regras de selecção/abertura; com A off só aceita layers `metadata.modeloB`

### Integração com motor industrial

- Cutlist/PDF/CNC consomem `drawersLayer` filtrado pelo gate A/B.  
- Comentários no código afirmam que `src/industrial/**` (PIMO-TRAK) **não** deve ser tocado pelos flags de design.  
- PI / roupeiro / furação clássica continuam no domínio A quando activo.

### Ficheiros envolvidos — núcleo Modelo A (PRESERVAR)

#### Domínio clássico (`src/core/drawers/` — excepto `european/` e bridges B)

- `Drawer.ts`, `DrawerGroup.ts`, `DrawerParametrics.ts`, `DrawerGenerationService.ts`
- `DrawerBomService.ts`, `DrawerCollisionService.ts`, `DrawerController.ts`
- `DrawerMotionService.ts`, `DrawerMotionCurves.ts`
- `drawerGeometryConstants.ts`, `drawerModuleGeometry.ts`, `drawerVerticalPosition.ts`
- `drawerViewerLayout.ts`, `drawerSlideDepth.ts`, `drawerHeightModeTypes.ts`
- `drawerFrontMaterial.ts`, `drawerHandleCatalog.ts`, `drawerMetalBoxCatalog.ts`
- `drawerLayerCustomization.ts`, `drawerParametricOverrides.ts`
- `drawerPresets.ts`, `drawerPresetService.ts`, `drawerPresetTypes.ts`
- `drawerUiConstants.ts`, `drawerUiValidation.ts`, `drawerErgonomics*.ts`
- `drawerIndustrialLabels.ts`, `drawerMeshIdentity.ts`, `handlePlacement.ts`
- `adapters/drawerGroupToLayerItems.ts`
- `drilling/DrawerDrillingRules.ts`, `DrawerHandleDrillingRules.ts`, `DrawerMetalBoxFrontDrilling.ts`
- `DrawerSystemReference.ts` (mapa de referência do Sistema Unificado)
- `index.ts`, `README.md` (+ testes `*.test.ts` do domínio A)

#### Admin / UI Modelo A

- `src/components/admin/DrawerSystemUnifiedAdminPage.tsx` → **Sistema Unificado**
- `src/components/admin/DrawerRulesAdminPage.tsx` → **Regras das Gavetas**
- `src/components/panels/DrawerConfigPanel.tsx`
- Partes clássicas de `HomeLeftPanelSelected.tsx` / `BoxLayersPanel.tsx` (ramos `modeloAActive === true`)
- `src/components/help/system/DrawersSystemDocs.tsx` (se presente)
- Entradas de menu em `src/pages/AdminPanel.tsx` (itens Unificado + Regras)

#### Viewer / 3D clássico

- `src/3d/objects/DrawerFactory.ts`, `drawerRenderingFlags.ts`
- `src/3d/groups/drawerGroup3D.ts`, `placement/drawerPlacement3D.ts`, `transforms/drawerTransforms.ts`

#### Settings / estado

- `src/core/settings/settingsSchema.ts` (`gavetas`)
- `settingsDefaults` / `settingsValidation.ts` / `settingsMerge.ts`
- `src/models/BoxLayers.ts` (`DrawerLayerItem`)
- `src/core/types.ts` (`gavetas`, `drawersLayer`, …)
- `src/context/hooks/useLayerActions.ts` (ramos Modelo A)
- `src/context/hooks/useDrawerPresetActions.ts`

#### Produção / docs históricas (contexto A)

- `src/services/drawerCutlistAdapter.ts`
- `docs/drawers-system.md`
- Checklists/relatórios na raiz do repo (se existirem: `CHECKLIST_VALIDACAO_GAVETAS.md`, etc.)

### Componentes principais (Modelo A)

| Componente | Papel |
|---|---|
| `generateDrawerGroup` | Geração paramétrica clássica |
| `DrawerParametrics` | Folgas/peças madeira |
| `drawerGroupToLayerItems` | Persistência em `drawersLayer` |
| `DrawerRulesAdminPage` | Config admin editável |
| `DrawerSystemUnifiedAdminPage` | Mapa/referência unificada |
| `DrawerFactory` (3D) | Meshes Viewer |
| `drawerCutlistAdapter` | Peças cutlist |

### Fluxo de funcionamento (Modelo A)

```text
UI (stepper gavetas)
  → setGavetas / regenerateLayersForBox
  → generateDrawerGroup (se isDrawerModeloAActive)
  → drawersLayer (sem metadata.modeloB)
  → Viewer + cutlist + PDF clássico
```

---

## Sistema Novo (Admin Panel → Produtos → Gavetas)

### O que é

Hub Admin + **Sistema Europeu de Gavetas (Modelo B)** + módulos satélite (kitchen/planner/pricing/release) criados à volta do Modelo B.

### Pontos de entrada (UI)

| Entrada | Ficheiro | Notas |
|---|---|---|
| Admin → Produtos → **Gavetas** | `DrawersAdminHubPage.tsx` | Hub novo; toggle A↔B; catálogo B; Auto QA; embute Regras + Unificado como tabs |
| Menu `adminMenu` | `AdminPanel.tsx` (grupo Produtos, 1.º item) | `id: "Gavetas"` → render `<DrawersAdminHubPage />` |
| Painel Viewer (A off) | `EuropeanDrawerConfigPanel` | Em `HomeLeftPanelSelected` / `BoxLayersPanel` |
| Kitchen Planner | `KitchenPlannerPage.tsx` | Consome library Modelo B |

Ordem actual no menu Produtos (verificado):

1. **Gavetas** (novo)  
2. **Configurações das Gavetas (Sistema Unificado)** (A)  
3. … outros …  
4. **Regras das Gavetas** (A)

### Como é activado / desactivado

- Toggle: **«Desativar Sistema Atual de Gavetas (Modelo A)»** no hub  
  - `setDrawerModeloADeactivated(checked)` → `localStorage` + evento `pimo:drawer-modelo-a-changed`
- Quando A está desactivado (`isDrawerModeloAActive() === false`):
  - `boxLayersService` chama `generateEuropeanDrawer` e marca `metadata.modeloB = true`
  - UI mostra `EuropeanDrawerConfigPanel`
  - `resolveActiveDrawersLayer` **só** devolve layers com `modeloB`
  - `pdfUnified` usa secção europeia
  - `drawerFactory.resolveDrawerFactoryMode()` → `"european"`

### Como é guardado no projecto

| Campo | Local |
|---|---|
| `europeanDrawerConfig` | `WorkspaceBox` / `BoxModule` (`types.ts`) |
| `drawersLayer[].metadata.modeloB` | `true` nas layers geradas pelo europeu |
| `drawersLayer[].metadata.europeanSystemId` | ex. `blum-legrabox` |
| Flag runtime | **browser localStorage** (não no JSON do projecto) |

Sistemas europeus catalogados no **mapa histórico de Jul/2026** (`european/README.md` / `catalog.ts` na altura):

- `blum-legrabox`
- `blum-tandembox-antaro`
- `hettich-innotech-atira`
- `grass-nova-pro-scala`

### Ficheiros envolvidos — sistema novo (INVENTÁRIO HISTÓRICO, não estado actual do repo)

#### Hub Admin e bridges de escolha A/B

- `src/components/admin/DrawersAdminHubPage.tsx` → **entrada UI «Gavetas»**
- `src/core/drawers/drawerSystemFlags.ts`
- `src/core/drawers/drawerModeloAGate.ts`
- `src/core/drawers/drawerFactory.ts` (binding europeu)
- `src/core/drawers/drawerRuntimeBinding.test.ts`
- `src/hooks/useDrawerModeloAActive.ts`
- `src/viewer/layers/resolveActiveDrawersLayer.ts` (re-export do gate)

#### Domínio europeu completo (histórico Jul/2026)

- **Pasta inteira:** `src/core/drawers/european/**` (**152 ficheiros** no inventário de Jul/2026; **ausente** no repo actual)  
  Incluía: `adapter`, `assembly`, `cnc`, `consistency`, `cutlist`, `docs`, `drilling`, `dxf`, `geometry`, `measures`, `models/*`, `naming`, `overlay`, `pdf`, `perf`, `placement`, `qa`, `release`, `robustness`, `safety`, `transforms`, `ui`, `validation`, `viewer`, `catalog.ts`, `config.ts`, `types.ts`, `index.ts`, testes, READMEs.

UI europeia (histórica):

- `src/core/drawers/european/ui/EuropeanDrawerConfigPanel.tsx`
- `src/core/drawers/european/ui/EuropeanFrontConfigPanel.tsx`
- `src/core/drawers/european/ui/index.ts`

#### Satélites criados em torno do Modelo B (histórico)

| Pasta / ficheiro | Contagem aprox. | Notas de remoção |
|---|---|---|
| `src/core/kitchen/**` | ~19 ficheiros | Library Modelo B; **NÃO confundir** com `src/core/kitchenFinish/**` (rodapé/hemati — preservar) |
| `src/core/planner/**` | ~12 ficheiros | Depende de `kitchen` / Modelo B |
| `src/core/pricing/**` | ~16 ficheiros | Builder/testes ligados a B — **rever** se algum pricing genérico é partilhado |
| `src/core/release-final/**` | ~8 ficheiros | Anúncio/versionamento Modelo B |
| `src/pages/KitchenPlannerPage.tsx` | 1 | Página planner |
| `src/validation/drawerEuropeanSystem.test.ts` | 1 | + testes sob `european/**` no inventário histórico |

Consumidores externos de `src/core/kitchen` (além do próprio domínio): `DrawersAdminHubPage`, `release-final`, `pricing`, `planner`.  
`kitchenFinish` / rodapé / hemati / remate usam **outro** módulo (`kitchenFinish`) — fora do âmbito de remoção B.

### Componentes principais (sistema novo)

| Componente | Papel |
|---|---|
| `DrawersAdminHubPage` | Admin hub + toggle + QA/DXF/CNC amostra B |
| `generateEuropeanDrawer` | Motor Modelo B |
| `europeanResultToLayerItems` | Persistência layers B |
| `EuropeanDrawerConfigPanel` | UI projecto quando A off |
| `isDrawerModeloAActive` / gate | Escolha global A vs B |
| Kitchen / Planner / Pricing / Release | Ecossistema produto à volta de B |

### Regras e lógica (Modelo B)

- Medidas por fabricante (folgas laterais e alturas oficiais por sistema).  
- Validação industrial própria (`valid` / `errors` / `warnings` / `autoFixes`).  
- Saídas próprias: cutlist, drilling, PDF ficha, DXF, CNC multi-formato, overlay, release notes.  
- Activo **apenas** com Modelo A desactivado (gates espalhados).

### Interferência com o sistema antigo

Ver secção seguinte.

---

## Pontos de conflito ou sobreposição

### 1. Onde o sistema novo substitui / desactiva o antigo

| Ponto | Comportamento |
|---|---|
| `drawerSystemFlags.ts` | Default A=false + migração força A off |
| `boxLayersService.ts` | Se A off → `generateEuropeanDrawer`; se A on → `generateDrawerGroup` |
| `DrawerGenerationService.ts` | Early-return / no-op se A off |
| `drawerPresetService.ts` | Bloqueado se A off |
| `useLayerActions.ts` | Ramos distintos: europeu vs clássico |
| `HomeLeftPanelSelected` / `BoxLayersPanel` | UI clássica **ou** `EuropeanDrawerConfigPanel` |
| `resolveActiveDrawersLayer` | Filtra A **ou** B; nunca mistura na saída efectiva |
| `pdfUnified.ts` | Secção gavetas europeia substitui clássica se A off |
| `cutlistFromBoxes` / `drawerCutlistAdapter` | Só vê layer «activa» do gate |
| `useCalculadoraSync` / `Workspace` | Sync/selecção dependem do flag |
| `drawerFactory.ts` | Mode `european` vs `legacy` |
| `DrawerFactory.ts` (3D) | Ramos `metadata.modeloB` para pose/geometry europeia |

### 2. Onde ambos são carregados ao mesmo tempo

- **Código:** ambos permanecem no bundle; o gate escolhe o ramo.  
- **Dados no projecto:** `drawersLayer` pode conter layers A e B misturadas; o gate filtra por `metadata.modeloB`.  
- **Admin hub `Gavetas`:** embute UI do Modelo A (tabs «Regras» / «Mapa») **e** catálogo B na mesma página — sobreposição de UX.  
- **Menu Admin:** três entradas coexistentes: **Gavetas** (novo), **Regras das Gavetas** (A), **Configurações… Unificado** (A).

### 3. Lógica de escolha entre sistemas

```text
isDrawerModeloAActive()
  ├── true  → Modelo A (clássico / Sistema Unificado runtime)
  └── false → Modelo B (europeu)   ← DEFAULT DE PRODUTO ACTUAL
```

Não há feature flag separada «enable Modelo B»: **B = !A**.

### 4. Ficheiros partilhados (NÃO apagar na remoção de B — só reverter branches)

Estes ficheiros **pertencem ao fluxo A** mas foram **infectados** com gates B:

- `src/services/boxLayersService.ts`
- `src/services/drawerCutlistAdapter.ts`
- `src/core/manufacturing/cutlistFromBoxes.ts`
- `src/core/pdf/pdfUnified.ts`
- `src/core/pdf/pdfFerragensTotaisNormalize.ts`
- `src/hooks/useCalculadoraSync.ts`
- `src/context/hooks/useLayerActions.ts`
- `src/components/layout/left-panel/HomeLeftPanelSelected.tsx`
- `src/components/layout/left-panel/BoxLayersPanel.tsx`
- `src/components/layout/workspace/Workspace.tsx`
- `src/pages/AdminPanel.tsx` (menu + switch)
- `src/core/types.ts` / `BoxLayers.ts` (campos `europeanDrawerConfig`, `metadata.modeloB`)
- `src/core/drawers/index.ts` (exports de flags/gate/factory B)
- `src/core/drawers/DrawerGenerationService.ts`, `drawerPresetService.ts`
- `src/3d/objects/DrawerFactory.ts`, `src/3d/placement/drawerPlacement3D.ts`

---

## Plano técnico para REMOVER o sistema novo (NÃO EXECUTAR NESTA FASE)

### Objectivo da fase seguinte (aguardando instrução)

1. Desligar completamente Admin → Produtos → **Gavetas** (hub Modelo B).  
2. Restaurar Modelo A como **único** sistema activo (default ON, sem gate B).  
3. Não apagar nem alterar regras industriais clássicas sem pedido explícito.

### A) Ficheiros que podem ser removidos (apenas sistema novo)

**Remoção directa (candidatos claros):**

1. `src/components/admin/DrawersAdminHubPage.tsx`
2. Pasta `src/core/drawers/european/**` (inteira, ~152 ficheiros)
3. `src/core/drawers/drawerSystemFlags.ts`
4. `src/core/drawers/drawerModeloAGate.ts`
5. `src/core/drawers/drawerFactory.ts`
6. `src/core/drawers/drawerRuntimeBinding.test.ts`
7. `src/hooks/useDrawerModeloAActive.ts`
8. `src/viewer/layers/resolveActiveDrawersLayer.ts` (ou reduzir a identity helper só A)
9. `src/core/kitchen/**` (satélite B — **não** apagar `kitchenFinish`)
10. `src/core/planner/**` (idem)
11. `src/core/pricing/**` ligados a B — **rever** se pricing genérico é partilhado antes de apagar
12. `src/core/release-final/**`
13. `src/pages/KitchenPlannerPage.tsx` (+ rotas se existirem)
14. `src/validation/drawerEuropeanSystem.test.ts` e testes sob `european/**`

> **Atenção pricing/kitchen/planner:** confirmar numa passagem de grep se há consumidores fora do Modelo B antes de apagar pastas inteiras. Já verificado: `kitchen` ≠ `kitchenFinish`.

### B) Componentes a desligar do Admin Panel

Em `src/pages/AdminPanel.tsx`:

- Remover item de menu `{ id: "Gavetas", label: "Gavetas" }`
- Remover tipo `AdminTab` `"Gavetas"`
- Remover ramo `active === "Gavetas" ? <DrawersAdminHubPage />`
- Remover import de `DrawersAdminHubPage`
- Remover ícone `Gavetas: "adminRuler"` do mapa de ícones
- **Manter** «Regras das Gavetas» e «Configurações das Gavetas (Sistema Unificado)»

### C) Referências a apagar / reverter (rotas, menus, toggles, imports)

- Todos os `import` de `./european` ou `drawers/european`
- Chamadas a `generateEuropeanDrawer`, `europeanResultToLayerItems`, `defaultEuropeanDrawerConfig`
- `isDrawerModeloAActive` / `resolveActiveDrawersLayer` → substituir por uso directo de `box.drawersLayer` (ou helper que **não** filtre por `modeloB`)
- Ramos `if (!modeloAActive)` / `metadata?.modeloB` em UI e serviços
- Campos `europeanDrawerConfig` (decidir: ignorar em runtime vs migração de limpeza — **não apagar dados de projectos sem instrução**)
- Documentação desactualizada em `src/core/drawers/README.md`
- Anúncio `MODELO_B_PRODUCT_ANNOUNCEMENT` / help se referenciar B como produto activo

### D) Garantias necessárias

| Garantia | Como validar |
|---|---|
| Modelo A 100% funcional | `generateDrawerGroup` sempre no path; UI clássica visível; settings.gavetas aplicadas |
| Produção / cutlist | `drawerCutlistAdapter` + `cutlistFromBoxes` sem filtro B; peças `gaveta_*` clássicas |
| PDFs | `pdfUnified` secção clássica; ferragens totais coerentes |
| Nesting / CNC clássico | `buildCutlistItemsForIndustrialExport` sem dependência europeia |
| Furação | regras A + PI + corrediças clássicas |
| Viewer | meshes via `DrawerFactory` clássico; motion A |
| Industrial PIMO-TRAK | **não tocar** `src/industrial/**` sem pedido explícito |
| Dados antigos | layers com `modeloB` podem ficar órfãs no JSON — ignorar ou limpar só com instrução |
| Testes | suites Vitest A devem passar sem mock de B; remover/ignorar testes B |
| localStorage | limpar/ignorar `pimo_drawer_modelo_a_enabled` (A sempre on) |
| kitchenFinish / rodapé | confirmar que remoção de `src/core/kitchen` não afecta `kitchenFinish` |

### E) Ordem sugerida na fase de execução (futura)

1. Forçar Modelo A ON (ou eliminar flag) e validar smoke Viewer + cutlist + PDF.  
2. Remover menu/hub **Gavetas**.  
3. Remover ramos B dos ficheiros partilhados.  
4. Remover pasta `european/**` + satélites confirmados.  
5. Correr testes de validação gavetas/industriais existentes (não criar novos sem pedido).  
6. Só então considerar limpeza de campos `europeanDrawerConfig` em tipos (opcional).

---

## Listas-resumo pedidas no PASSO 6

### Ficheiros do sistema NOVO (para remoção controlada futura)

```
src/components/admin/DrawersAdminHubPage.tsx
src/core/drawers/drawerSystemFlags.ts
src/core/drawers/drawerModeloAGate.ts
src/core/drawers/drawerFactory.ts
src/core/drawers/drawerRuntimeBinding.test.ts
src/hooks/useDrawerModeloAActive.ts
src/viewer/layers/resolveActiveDrawersLayer.ts
src/core/drawers/european/**                    (~152 ficheiros)
src/core/kitchen/**                            (satélite B; NÃO kitchenFinish)
src/core/planner/**                            (satélite B)
src/core/pricing/**                            (rever partilha)
src/core/release-final/**
src/pages/KitchenPlannerPage.tsx
src/validation/drawerEuropeanSystem.test.ts
(+ entradas de menu/switch em AdminPanel.tsx — editar, não «ficheiro novo»)
```

### Ficheiros do sistema ANTIGO / Modelo A (PRESERVAR)

```
# Admin
src/components/admin/DrawerSystemUnifiedAdminPage.tsx
src/components/admin/DrawerRulesAdminPage.tsx

# Domínio clássico (excepto european/ e bridges B listados acima)
src/core/drawers/Drawer*.ts / drawer*.ts (clássicos)
src/core/drawers/adapters/**
src/core/drawers/drilling/**
src/core/drawers/DrawerSystemReference.ts

# UI / Viewer clássico
src/components/panels/DrawerConfigPanel.tsx
src/3d/objects/DrawerFactory.ts                 # preservar; reverter ramos modeloB depois
src/3d/objects/drawerRenderingFlags.ts
src/3d/groups/drawerGroup3D.ts
src/3d/placement/drawerPlacement3D.ts           # preservar; reverter ramos modeloB depois
src/3d/transforms/drawerTransforms.ts

# Produção clássica (preservar; só reverter gates na fase seguinte)
src/services/drawerCutlistAdapter.ts
src/services/boxLayersService.ts                # reverter ramo B depois
src/core/manufacturing/**                       # sem apagar regras A
src/core/settings/settingsSchema.ts             # bloco gavetas

# Docs de referência A
docs/drawers-system.md
docs/drawers-systems-map.md                     # este ficheiro
```

### Como o sistema novo interfere com o antigo (resumo)

1. **Default de produto = Modelo B**: ao abrir a app, A fica inactivo salvo o admin reactivar.  
2. **Gate único** (`isDrawerModeloAActive`) bifurca geração, UI, cutlist, PDF e Viewer.  
3. **Filtro de layers**: com A off, layers clássicas são invisíveis ao pipeline (`!metadata.modeloB`).  
4. **Hub Admin «Gavetas»** concentra o toggle e promove o catálogo europeu; as páginas Unificado/Regras passam a secundárias ou embutidas.  
5. **Código A não é apagado**, mas fica **inoperante por omissão** — exactamente o inverso do objectivo de restauro.

---

## Comparação com snapshot `pimo-safe-pre-purge-build`

| Artefacto | `pimo-criativo` | `pimo-safe-pre-purge-build` |
|---|---|---|
| `DrawersAdminHubPage` | Sim | Não |
| `drawerSystemFlags` / `drawerModeloAGate` / `drawerFactory` | Sim | Não |
| Pasta `european/` | ~152 ficheiros | Ausente |
| `DrawerSystemUnifiedAdminPage` / `DrawerRulesAdminPage` | Sim | Sim |

O safe build confirma que o «sistema novo» é uma camada **posterior** sobre o Modelo A.

---

---

## Estado pos-restauracao (FASES 1-4 executadas ? 2026-07-27)

| Fase | Commit | Resultado |
|---|---|---|
| 1 Flags | `0e87978` | Modelo A sempre activo (`isDrawerModeloAActive() === true`) |
| 2 Gates | `a3b9173` | Ramos B removidos dos ficheiros partilhados |
| 3 Remocao | `bf83b22` | Hub Gavetas, european/**, satelites B apagados |
| 4 QA | este commit | tsc OK; Admin so Unificado + Regras |

### Garantias verificadas
- Menu Admin Produtos: sem entrada Gavetas (Modelo B)
- Mantidos: Configuracoes das Gavetas (Sistema Unificado) + Regras das Gavetas
- kitchenFinish/** e src/industrial/** preservados
- Zero imports de drawers/european / generateEuropeanDrawer / DrawersAdminHubPage
- Typecheck (npx tsc --noEmit) passou
- Suites src/core/drawers: 36 passed / 2 failed (fora do ambito B)

### Residual intencional
- drawerSystemFlags.ts ? shim A sempre ON
- drawerModeloAGate.ts ? filtra orfas metadata.modeloB
- europeanDrawerConfig?: Record<string, unknown> em tipos (legado ignorado)

**Veredicto: Modelo B removido, Modelo A restaurado como unico sistema activo.**
