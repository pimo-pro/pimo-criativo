# Plano — SSOT dimensões de chapa via Gestão de Materiais

**STATUS: BACKLOG — NÃO IMPLEMENTADO — plano para execução futura**

**Data do plano:** 2026-08-28  
**Escopo deste documento:** apenas intenção e direcção; **nenhum código foi alterado**.  
**Contexto:** diagnóstico realizado em 2026-08-28 sobre a migração 2800×2070 → 2810×2100 e sobre a arquitectura actual de fontes paralelas.

---

## Nota obrigatória (ler antes de implementar)

O projecto PIMO-Criativo está em **desenvolvimento contínuo**. Este ficheiro é um **plano de intenção**, não uma especificação técnica congelada.

**No dia em que se decidir avançar com a implementação:**

1. Fazer um **novo foco/diagnóstico** do estado do código nessa altura (módulos, testes, defaults, CRUD, snapshots).
2. Confirmar que os caminhos de ficheiros, APIs e convenções ainda correspondem ao descrito aqui.
3. Só então redigir diffs e pedir aprovação explícita antes de gravar qualquer alteração (regra permanente do repositório).

---

## 1. Problema actual

### 1.1 Três camadas paralelas (sem SSOT único)

Hoje o tamanho da chapa de madeira não vem de um único sítio. Coexistem **três fontes** que podem divergir:

| Camada | Onde vive | Valor típico hoje | Quem consome |
|--------|-----------|-------------------|--------------|
| **A — Constantes compile-time** | `src/core/panel/panelConstants.ts` → `CHAPA_PADRAO_*` em `src/core/manufacturing/materials.ts`; `INDUSTRIAL_SHEET_LF/HF_MM` em `src/core/materials/materials.api.ts`; `DEFAULT_SHEET_*` em `src/core/materials/service.ts` | 2800 × 2070 mm | Fallbacks, seeds, estimativas, UI presets |
| **B — Settings globais (runtime)** | `getSettings().materiais.sheetWidthMm` / `sheetHeightMm` (default em `src/core/settings/settingsSchema.ts` via `PANEL_DEFAULTS`); editável em Admin → Sistema | 2800 × 2070 mm | `getSheetDefinitionFromSettings()`, Nesting V3, pipeline CNC quando não há dimensão por peça |
| **C — Por material (CRUD)** | Gestão de Materiais (`MaterialRecord.sheetWidthMm` / `sheetHeightMm`); espelhado em `industrialDefaults.larguraChapa` / `alturaChapa` no catálogo oficial | Variável por material (ex.: MDB 3660×630; utilizador reporta 2810×2100 já configurado em materiais activos) | Nesting industrial (`layoutPipeline.resolveGroupSheetDefinition`), peças enriquecidas, validações de largura máxima |

**Consequência:** alterar só a camada C (CRUD) **não garante** coerência em Financeiro, contagem estimada de chapas, consumo de materiais, nem em todos os fallbacks de nesting legacy.

### 1.2 Módulos que ainda ignoram o material e usam global/constante

Diagnóstico 2026-08-28 — estes pontos **não** leem dimensões da chapa do registo em Gestão de Materiais:

| Módulo / ficheiro | Comportamento actual | Impacto se CRUD = 2810×2100 mas constantes = 2800×2070 |
|-------------------|----------------------|--------------------------------------------------------|
| **`deriveCustoChapaReal.ts`** | `getSheetDefinitionFromSettings()` + fallback `CHAPA_PADRAO_*` | €/chapa derivado (N × €/chapa no Financeiro preliminar) desalinhado do nesting por material |
| **`financeiroUnificado.ts`** (`chapasEstimadas`) | `CHAPA_PADRAO_LARGURA × CHAPA_PADRAO_ALTURA` | Contagem «Nº de chapas (Estimado)» por área pode divergir do nesting fast |
| **`computeConsumoMateriais.ts`** | `CHAPA_PADRAO_*` para área de chapa | Consumo/indicadores auxiliares errados |
| **`chapasReport.ts`** | `AREA_CHAPA_PADRAO_M2 = 5.8` (≈ 5,796 m² de 2800×2070) | Relatório / detalhe visual com área default incorrecta |
| **`nestingV3Settings.ts`** | `DEFAULT_NESTING_V3_SETTINGS` hardcoded 2800×2070 (runtime lê settings, mas default local persiste) | Novos ambientes ou paths sem settings sincronizados |
| **Nesting3 legacy** (`strategySkyline`, `strategyShelf`, `strategyFFD`, `strategyBlockPacking`, `scoring`) | Fallback `{ widthMm: 2800, heightMm: 2070 }` se lista de sheets vazia | Caminho secundário ainda assume PT antigo |
| **`woodCalculator.ts`** | Defaults via `PANEL_DEFAULTS` | Calculadora auxiliar desalinhada |
| **UI Admin Materiais** (`GestaoMateriaisPage.tsx`) | Defaults de formulário 2800×2070 ao criar material | Risco de reintroduzir tamanho antigo em registos novos |

### 1.3 O que já funciona por material (parcialmente)

O pipeline industrial principal **já suporta** chapa por material quando as peças são enriquecidas:

- `enrichPiecesWithMaterialSheetDimensions()` (`cncPipeline.ts`, `preparePiecesForNesting.ts`)
- `layoutPipeline.resolveGroupSheetDefinition()` — prioridade: MDB especial → opções → `piece.sheetWidthMm` → settings globais
- **TCN** (`tcnGeneratorV2New`, `tcnGeneratorNestingMo`) — recebe dimensões do **layout já calculado**, não 2800 fixo
- **Cut layout PDF** (`cutLayoutPdf.ts`) — desenha `CutLayoutResult.sheets[].sheet.largura_mm/altura_mm`
- **Financeiro Σ sheets** (`priceChapasSheetsEur`) — usa dimensões reais de cada sheet do nesting

Ou seja: **nesting + TCN + PDF + preço por sheet** podem estar correctos por material, enquanto **Financeiro (N×€/chapa, N estimado por área) e constantes raiz** ficam para trás.

### 1.4 Caso especial já existente: MDB Laminado 3660×630

Não faz parte do objectivo deste plano alterar a regra MDB/tampo. O motor industrial trata `mdb_laminado` como chapa **fixa** 3660×630 mm, independentemente de settings globais 2800×2070. Qualquer unificação SSOT deve **preservar** excepções de produto documentadas (tampo cozinha, laminado de fábrica).

---

## 2. Objectivo final

### 2.1 Visão

**Gestão de Materiais (Admin → Definições → Materiais)** passa a ser a **única fonte de verdade (SSOT)** para:

- Largura e altura da chapa (`sheetWidthMm`, `sheetHeightMm`) por material industrial
- (Opcionalmente, espessura padrão da variante — já existe no CRUD)

Quando o utilizador altera o tamanho da chapa de uma madeira na Gestão de Materiais, a alteração deve propagar-se de forma previsível a:

1. Nesting (cut layout / industrial)
2. Geração TCN/CNC
3. Cut layout PDF
4. Financeiro (Painéis, N chapas, €/chapa derivado, relatórios)
5. Relatório final / production release (na próxima geração industrial)

### 2.2 O que eliminar ou reduzir

| Actual | Objectivo |
|--------|-----------|
| `PANEL_DEFAULT_LF/HF_MM = 2800/2070` como SSOT de negócio | Manter só como **fallback de emergência** (material desconhecido / dados corruptos), claramente documentado e rastreável (warning) |
| `INDUSTRIAL_SHEET_LF/HF_MM` no seed oficial | Seed inicial único na migração; novos materiais herdam do CRUD, não de constante global |
| Settings globais `materiais.sheetWidthMm/HeightMm` como dimensão de chapa | **Decisão pendente** (ver §4): deprecar para nesting ou usar só como default ao **criar** material novo |
| `AREA_CHAPA_PADRAO_M2 = 5.8` | Derivar de material dominante ou da sheet efectiva; constante só fallback |
| Fallbacks nesting3 `2800×2070` | Ler dimensão do material da peça ou do grupo; fallback global só último recurso |

### 2.3 Princípios de desenho (alto nível)

1. **Resolução por peça/grupo:** dimensão de chapa = f(materialId, espessura) → registo CRUD.
2. **Material dominante no Financeiro:** quando um único €/chapa derivado for necessário (modo N×€), usar área da chapa do **material dominante da cutlist** (já parcialmente identificado em `resolveDominantMaterialFromCutlist`), não settings globais.
3. **Sem alterar algoritmos de nesting:** mudar apenas inputs `SheetDefinition`; rotação, kerf, estratégias e meta-heurísticas mantêm-se.
4. **Excepções de produto explícitas:** MDB 3660×630 (e futuras) permanecem em regras dedicadas, não no CRUD genérico.

---

## 3. Plano de execução proposto (alto nível)

Ordem sugerida para minimizar regressões e permitir validação incremental.

### Fase 0 — Re-diagnóstico (obrigatório no dia D)

- [ ] Repetir grep/inventário de `2800`, `2070`, `CHAPA_PADRAO`, `getSheetDefinitionFromSettings`, `AREA_CHAPA_PADRAO`.
- [ ] Confirmar estado do CRUD (quantos materiais têm 2810×2100 vs 2800×2070).
- [ ] Confirmar se settings globais Admin ainda são usados em produção para nesting.
- [ ] Listar testes afectados (ver §3.5).

### Fase 1 — Contrato SSOT e API de resolução

- [ ] Definir função canónica única (ex.: `resolveSheetDimensionsForMaterial(materialId, espessuraMm)`) que devolve `{ larguraMm, alturaMm, fonte: 'crud' | 'excecao_mdb' | 'fallback' }`.
- [ ] Centralizar em módulo de materiais (ex.: `src/core/materials/` ou extensão de `service.ts`), **sem** duplicar lógica em Financeiro/CNC/PDF.
- [ ] Documentar contrato: todo consumidor industrial chama esta API; proibir novos hardcodes de 2800×2070.

### Fase 2 — Pipeline industrial (nesting → TCN → PDF)

- [ ] Auditar `computeChapasReal`, `cncPipeline`, `layoutPipeline`, `enrichPiecesWithMaterialSheetDimensions` — garantir 100% via SSOT material (já parcial).
- [ ] Remover dependência desnecessária de `getSheetDefinitionFromSettings()` onde o grupo tem material identificado.
- [ ] Validar paridade: N chapas e dimensões em sheets[] iguais entre Admin, nesting fast e PRO.
- [ ] **Risco:** testes de paridade SSOT (`chapasOficiaisParity.ssot.test.ts`) e benchmarks cutlayout.

### Fase 3 — Financeiro e relatórios

- [ ] `deriveCustoChapaReal`: área da chapa = material dominante (CRUD), não settings globais.
- [ ] `financeiroUnificado.chapasEstimadas`: área por material dominante ou média ponderada; eliminar `CHAPA_PADRAO_*` directo.
- [ ] `priceChapasSheetsEur`: já correcto quando há sheets; confirmar fallback N×€ alinhado.
- [ ] `chapasReport` / `AREA_CHAPA_PADRAO_M2`: derivar ou deprecar constante 5.8.
- [ ] `computeConsumoMateriais`: usar resolução SSOT.
- [ ] **Risco:** testes Antunes, CAIXA 1201, paridade 47/47, valores documentados (179,68 € → 182,93 € se 2810×2100).

### Fase 4 — Settings globais e UI Admin

- [ ] **Decisão utilizador:** o selector «Tamanho do painel» em Admin → Sistema passa a ser só default para **novos** materiais, ou desaparece?
- [ ] `GestaoMateriaisPage`: defaults de formulário = último material editado ou template SSOT, não 2800×2070 fixo.
- [ ] `SystemSettingsBase` / `PANEL_PRESETS`: adicionar preset 2810×2100 se aprovado; marcar 2800×2070 como legado.
- [ ] Sync CRUD ↔ catálogo oficial (`materials.api` seed) na migração one-shot.

### Fase 5 — Nesting V3 / nesting3 legacy

- [ ] `loadNestingV3SettingsFromGlobal`: passar a derivar de material do projecto ou manter settings só como fallback.
- [ ] Fallbacks `2800×2070` em `strategy*.ts` / `scoring.ts`: substituir por chamada SSOT.
- [ ] **Risco:** `nestingV3IndustrialParity.test.ts`, testes V3.

### Fase 6 — Constantes raiz e migração numérica

- [ ] Actualizar `panelConstants.ts`, `INDUSTRIAL_SHEET_*`, `DEFAULT_SHEET_*` para 2810×2100 **ou** reduzir ao mínimo (só fallback de emergência com warning).
- [ ] Actualizar testes e snapshots (.tcn de exemplo, JSON de benchmark) — **só** se aprovado; ficheiros de output industrial podem manter histórico.
- [ ] Comunicar delta de área: 5,796 m² → 5,901 m² (+1,8% por chapa).

### Fase 7 — Validação e release

- [ ] Suite financeira + paridade SSOT + smoke industrial.
- [ ] Validar projecto real (grande + CAIXA 1201) em modo Estimado e Oficial TCN/PRO.
- [ ] Documentar em Novidades / release notes (sem alterar pipeline industrial além do input dimensional).

---

## 4. Riscos previsíveis

| Risco | Mitigação |
|-------|-----------|
| **Dezenas de testes assumem 2800×2070 / 5,796 / 179,68 €** | Inventário na Fase 0; actualizar valores esperados com comentário «SSOT material CRUD» |
| **Projectos com `productionRelease` congelado** | Snapshots mantêm `sheetLarguraMm` da geração; só mudam após «Gerar arquivo completo» — documentar na UI se necessário |
| **TCN/PDF já exportados** | Ficheiros no disco não mudam; comportamento correcto |
| **Sessão `chapasOficiaisProStore`** | Invalidar ou recalcular se fingerprint igual mas dimensão CRUD mudou — pode exigir incluir dimensões no fingerprint (decisão futura) |
| **CRUD vs seed oficial dessincronizados** | Script/migração one-shot + `MATERIALS_CRUD_DATA_VERSION` bump |
| **MDB 3660×630 quebrado por refactor** | Testes dedicados `mdbLaminadoSheetFaseA.test.ts`; excepção explícita na API SSOT |
| **Settings globais ainda usados por operadores** | Comunicar depreciação; periodo de transição com warnings no log |
| **Materiais sem sheetWidth/Height no CRUD** | Fallback documentado + warning visível no Financeiro |

---

## 5. Decisões necessárias do utilizador (antes de implementar)

1. **Settings globais Admin → Sistema → «Tamanho do painel»:** deprecar para nesting, ou manter como default ao criar material novo?
2. **Migração 2810×2100:** alteração imediata em todos os materiais + constantes, ou só novos projectos?
3. **Projectos antigos com release congelado:** manter valores históricos até regeneração manual, ou forçar recálculo ao abrir?
4. **Fingerprint oficial de chapas:** incluir dimensões de chapa do CRUD para invalidar snapshot PRO quando o tamanho do material mudar?
5. **Constantes `panelConstants` / presets 2800×2070:** remover da UI, manter como preset legado, ou substituir preset «Padrão PT» por 2810×2100?
6. **Área arredondada `5.8` m² em relatórios:** passar a valor exacto (5,901) ou calcular sempre dinamicamente?

---

## 6. Referência rápida — ficheiros tocados na implementação futura

*(Lista indicativa do diagnóstico 2026-08-28; confirmar na Fase 0.)*

**Fontes / SSOT:**  
`panelConstants.ts`, `materials.api.ts`, `materials/service.ts`, `settingsSchema.ts`, `GestaoMateriaisPage.tsx`, `SystemSettingsBase.tsx`

**Industrial:**  
`cncPipeline.ts`, `layoutPipeline.ts`, `cutLayoutEngine.ts`, `computeChapasReal.ts`, `preparePiecesForNesting.ts`, `tcnGenerator*.ts`, `cutLayoutPdf.ts`

**Financeiro / relatório:**  
`deriveCustoChapaReal.ts`, `financeiroUnificado.ts`, `priceChapasSheetsEur.ts`, `chapasReport.ts`, `computeConsumoMateriais.ts`, `productionRelease.ts`

**Nesting V3 / legacy:**  
`nestingV3Settings.ts`, `nesting3/strategy*.ts`, `nesting3/scoring.ts`

**Testes (amostra):**  
`deriveCustoChapaReal.test.ts`, `chapasOficiaisParity.ssot.test.ts`, `financeiroDynamicEngine.test.ts`, `caixa1201MarketPricing.test.ts`, `aglBrancoMaterial.test.ts`, `mdbLaminadoSheetFaseA.test.ts`, `nestingV3*.test.ts`

---

## 7. Critérios de aceitação (quando implementado)

- [ ] Alterar `sheetWidthMm` / `sheetHeightMm` de um material na Gestão de Materiais reflecte-se no nesting fast, TCN, PDF e Painéis (Estimado e Oficial) **sem** editar constantes nem settings globais.
- [ ] Não existem caminhos de produção que usem 2800×2070 silenciosamente quando o material tem 2810×2100 (excepto fallback explícito com warning).
- [ ] MDB 3660×630 e regras de tampo intactos.
- [ ] Paridade SSOT Admin ↔ Relatório ↔ PDF mantida.
- [ ] Testes financeiros e industriais actualizados e verdes.
- [ ] Documentação de release / ajuda actualizada para utilizadores Admin.

---

## 8. Histórico deste plano

| Data | Evento |
|------|--------|
| 2026-08-28 | Plano criado após diagnóstico de fontes paralelas (2800×2070 vs CRUD 2810×2100) e correcção Financeiro modo Estimado (deploy v6.0828.1135). Estado: **BACKLOG**. |
