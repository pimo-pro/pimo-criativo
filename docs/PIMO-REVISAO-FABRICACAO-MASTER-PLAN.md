# PIMO — MASTER PLAN
# REVISÃO PARA FABRICAÇÃO

**Versão:** 1.1  
**Data:** Agosto 2026  
**Estado:** Aprovado para implementação futura — **não implementado**  
**Modo de criação deste documento:** auditoria read-only + planeamento (sem alterações ao código industrial)

---

## AVISO IMPORTANTE — Re-auditoria obrigatória antes da implementação

> **Este Master Plan baseia-se numa auditoria realizada em Agosto 2026.**  
> O projecto PIMO está **em evolução contínua**. Entre a data deste documento e o início da implementação, é **provável** que:
>
> - ficheiros sejam movidos, renomeados ou substituídos;
> - módulos sejam refactorados ou removidos;
> - novos pipelines ou APIs entrem em produção;
> - pré-requisitos (F0) já tenham sido corrigidos — ou surjam novos problemas.
>
> **Por isso, é OBRIGATÓRIO executar uma nova auditoria read-only completa do projecto imediatamente antes de iniciar qualquer fase de implementação** (F0 ou F1), e **não** assumir que os caminhos, funções e conclusões deste documento continuam válidos sem verificação.
>
> A re-auditoria deve, no mínimo, reconfirmar:
>
> 1. Localização e contrato de `buildCutlistItemsForIndustrialExport`, `useGerarArquivoHandlers.onArquivoCompleto`, `materialSync`, pipeline nesting/CNC/drill;
> 2. Estado actual dos pré-requisitos HIGH (sec. 23);
> 3. Existência ou alteração de sistemas duplicados/legacy referidos neste plano;
> 4. Compatibilidade das decisões do proprietário (R1–R10) com o código actual;
> 5. Impacto de alterações feitas por outros agentes ou branches entretanto merged.
>
> **Nenhuma fase de implementação deve começar com base apenas neste documento estático** — usar sempre o código actual como fonte de verdade e actualizar este ficheiro se a re-auditoria encontrar divergências materiais.

---

## Índice

1. [Executive Summary](#1-executive-summary)
2. [Objetivo](#2-objetivo)
3. [Requisitos confirmados](#3-requisitos-confirmados)
4. [Requisitos derivados](#4-requisitos-derivados)
5. [Estado atual relevante](#5-estado-atual-relevante)
6. [Arquitetura atual relevante](#6-arquitetura-atual-relevante)
7. [Pipeline industrial atual](#7-pipeline-industrial-atual)
8. [Arquitetura futura proposta](#8-arquitetura-futura-proposta)
9. [Review Session](#9-review-session)
10. [Snapshot](#10-snapshot)
11. [Working Copy](#11-working-copy)
12. [Material Overrides](#12-material-overrides)
13. [Dimensional Review](#13-dimensional-review)
14. [Ferragens Comerciais](#14-ferragens-comerciais)
15. [Validações](#15-validações)
16. [Avisos](#16-avisos)
17. [Histórico](#17-histórico)
18. [Auditoria](#18-auditoria)
19. [Permissões](#19-permissões)
20. [UX proposta](#20-ux-proposta)
21. [Reutilização de componentes existentes](#21-reutilização-de-componentes-existentes)
22. [Componentes protegidos](#22-componentes-protegidos)
23. [Pré-requisitos](#23-pré-requisitos)
24. [Refactors necessários](#24-refactors-necessários)
25. [Refactors proibidos](#25-refactors-proibidos)
26. [Compatibilidade](#26-compatibilidade)
27. [Feature Flag](#27-feature-flag)
28. [Estratégia de coexistência](#28-estratégia-de-coexistência)
29. [Estratégia de paridade](#29-estratégia-de-paridade)
30. [Estratégia de testes](#30-estratégia-de-testes)
31. [Roadmap](#31-roadmap)
32. [Estimativa](#32-estimativa)
33. [Matriz de riscos](#33-matriz-de-riscos)
34. [Decisões confirmadas](#34-decisões-confirmadas)
35. [Decisões abertas](#35-decisões-abertas)
36. [Melhorias recomendadas](#36-melhorias-recomendadas)
37. [Futuras extensões](#37-futuras-extensões)
38. [Critérios de aceitação](#38-critérios-de-aceitação)
39. [Checklist pré-implementação](#39-checklist-pré-implementação)
40. [Conclusão](#40-conclusão)

---

## 1. Executive Summary

É **viável** adicionar a etapa «Revisão para Fabricação» **sem reescrever** o pipeline industrial existente.

A abordagem recomendada:

1. **Novo fluxo paralelo** — botão «Revisar antes de fabricar» coexistindo com «Gerar direto»
2. **Sessão efémera** (`FabricationReviewSession`) — não mutar `ProjectState` até confirmação
3. **Mesmos builders** — `buildCutlistItemsForIndustrialExport`, `materialSync`, `onArquivoCompleto` / futuro `runIndustrialExportPipeline`
4. **Extras comerciais** fora do CNC — camada financeira separada
5. **Dimensões de parede manuais** na v1 — abstração `DimensionConstraintSource` para futuro room system
6. **Paridade obrigatória** — DIRECT EXPORT ≡ REVIEW (sem alterações) → CONFIRM → EXPORT

**Risco global:** MÉDIO (controlado com snapshot + pipeline único).  
**Esforço global:** 10–20 semanas (1 dev experiente), faseado.

---

## 2. Objetivo

Permitir ao projetista **rever, ajustar e validar** o projeto completo antes da geração industrial, como:

**PRÉ-FLIGHT CHECK + CONFERÊNCIA + CONFIGURAÇÃO FINAL**

Sem substituir o botão «Gerar arquivo completo» nas fases iniciais.

---

## 3. Requisitos confirmados

| ID | Requisito |
|----|-----------|
| R1 | Alteração **global** de material + **excepções por módulo** (e componente quando necessário) |
| R2 | **Sessão/working copy** — não mutar projecto original durante edição |
| R3 | Dimensão de parede **manual** na v1; **sem acoplamento** ao room system actual |
| R4 | Conflitos dimensionais = **WARNING** (não bloqueia geração na v1) |
| R5 | Extras (cola, parafusos, ferragens) → **lista/preço comercial**; **nunca CNC/cutlist/TCN** |
| R6 | UI: **resumo primeiro**; «Ver peças» para detalhe |
| R7 | **Histórico** de revisões (arquitectura preparada) |
| R8 | Futuro: revisão = fluxo **recomendado**; «Gerar direto» permanece |
| R9 | Não remover botão actual nas primeiras fases |
| R10 | **Não duplicar** pipeline industrial |

---

## 4. Requisitos derivados

- Paridade DIRECT vs REVIEW→CONFIRM→EXPORT
- Feature flag `fabricationReview: false` inicial
- Severidades INFO / WARNING / ERROR preparadas
- Contrato `DimensionConstraintSource` para futuro room system
- Backward compatibility total com projectos antigos
- Auditoria de alterações (quem/quando/o quê)

---

## 5. Estado atual relevante

### Pontos fortes

- SSOT export: `src/core/fabrication/buildCutlistItemsForIndustrialExport.ts`
- Orquestração: `src/hooks/useGerarArquivoHandlers.ts` → `onArquivoCompleto`
- Sync material: `src/core/materials/materialSync.ts`
- Validação: `assertExportInvariantsAllowed`, `src/core/industrial/industrialValidation.ts`
- Ferragens industrial: `src/core/industriais/buildIndustrialFerragensForProject.ts`
- Ferragens comerciais (padrão): `src/core/projectReport/financeiroFerragensEngine.ts` (linhas `added: true`)
- Snapshot pós-geração: `src/core/industrial/productionRelease.ts`

### Lacunas

- `getMaterialForBox(box, undefined)` ignora `project.materialId` em vários paths
- Overlay MC não inclui remates
- Sem validação remate vs abertura
- `guardIndustrialExport` não passa `layoutResult`
- Extras manuais só no Relatório Final, não no `ProjectState`

---

## 6. Arquitetura atual relevante

```
ProjectContext (ProjectState)
  workspaceBoxes → boxes → cutlistFromBoxes
  remates[], rodapes[]
  materialId + overrides por caixa/componente
  rules (RulesConfig)

buildCutlistItemsForIndustrialExport(snap)
  → industrialPerThicknessPipeline → TCN
  → buildDrillFilesForProject
  → PDFs / UnifiedEtiquetaEngine
  → productionRelease
```

**UI export:** `UnifiedTopToolbar` → `UnifiedExportBubble` → `useGerarArquivoHandlers`

---

## 7. Pipeline industrial atual

### Fluxo `onArquivoCompleto` (resumo)

1. `guardIndustrialExport` → `assertExportInvariantsAllowed`
2. Save projecto + thumbnail
3. `buildCutlistItemsForIndustrialExport`
4. `validateCncExport` (auto-correcção espessura)
5. PDFs: cutlist, técnico, unificado, ferragens, secções industriais
6. `buildCncBundlesPerThickness` (nesting PRO)
7. Etiquetas UEE + Layout PRO + Layout manual
8. TCN + `manifest-industrial.json`
9. MC Dimensions (opcional)
10. Drill XML
11. `enviarParaFabrica` / TRAK
12. ZIP + `concludeArquivoCompletoSuccess` → `productionRelease`

**SSOT de peças:** `buildCutlistItemsForIndustrialExport` — **único ponto de entrada**.

---

## 8. Arquitetura futura proposta

```
UnifiedExportBubble
  ├── [Revisar antes de fabricar] → /PROJETOS/:id/revisao-fabricacao
  └── [Gerar direto]             → onArquivoCompleto (inalterado)

FabricationReviewSession (Zustand efémero)
  → baseline snapshot
  → working copy (alterações)
  → buildFabricationReviewReport()
  → validateFabricationReview()
  → [Confirmar] → applyFabricationReviewToProject()
                → runIndustrialExportPipeline()
```

### Módulos novos (futuros)

| Módulo | Path proposto |
|--------|---------------|
| Tipos | `src/core/fabricationReview/types.ts` |
| Report | `src/core/fabricationReview/buildFabricationReviewReport.ts` |
| Material resolver | `src/core/fabricationReview/materialOverrideResolver.ts` |
| Dimensões | `src/core/fabricationReview/dimensionalReviewEngine.ts` |
| Validação | `src/core/fabricationReview/validateFabricationReview.ts` |
| Apply | `src/core/fabricationReview/applyFabricationReview.ts` |
| Histórico | `src/core/fabricationReview/fabricationReviewHistory.ts` |
| Store | `src/stores/fabricationReviewStore.ts` |
| Pipeline | `src/core/fabrication/runIndustrialExportPipeline.ts` |
| UI | `src/app/PROJETOS/revisao-fabricacao/` |

---

## 9. Review Session

```typescript
type FabricationReviewSession = {
  sessionId: string;
  projectId: string;
  userId: string;
  createdAt: string;
  status: "draft" | "validated" | "confirmed" | "cancelled" | "exported";
};
```

**Ciclo:** Abrir → Editar (working copy) → Recalcular → Validar → Confirmar/Cancelar

**Durante edição:** Zustand efémero + objecto imutável — **não** escrever em `ProjectContext`.

---

## 10. Snapshot

### Baseline inclui

- `IndustrialExportProjectSnapshot` (tipo existente)
- Slice de materiais: `materialId`, `workspaceBoxes` (campos material), `remates`, `rodapes`
- `fingerprint` via `cutlistFingerprint.ts`

### Baseline exclui

- `room`, `viewerSettings`, `industrialDocumentOverrides`
- Cache cutlist, estado UI

---

## 11. Working Copy

```typescript
type FabricationReviewWorkingCopy = {
  materialChanges: FabricationMaterialChanges;
  dimensionConstraints: DimensionConstraint[];
  commercialExtras: CommercialExtraItem[];
};
```

**Resolver:** `resolveEffectiveProjectSlice(baseline, workingCopy)` — função pura.

**Confirmar:** apply único ao `ProjectState` via `materialSync` + merge extras.

**Cancelar:** descartar session — projecto intacto.

---

## 12. Material Overrides

### Níveis existentes (`materialSync.ts`)

Project → box → door/drawer → costa/separador/frente → remate → rodapé → selection

### Precedência proposta

```
1. Component override explícito (sessão ou baseline)
2. Module override explícito (sessão)
3. Module exclusion do global → mantém baseline
4. Global change da sessão (por scope: body/doors/drawers/remates/rodapes)
5. Valor baseline existente
6. project.materialId
7. resolveIndustrialMaterialKey fallback
```

**Global não sobrescreve** portas/gavetas/remates com material explícito no baseline.

**Apply na confirmação:** reutilizar `applyMaterialSync` / `commitMaterialSync` — não criar segundo motor.

---

## 13. Dimensional Review

### Abstração (desacoplada do room actual)

```typescript
type DimensionConstraintSource = {
  id: string;
  kind: "manual" | "room_wall" | "opening" | "custom";
  label: string;
  axis: "width" | "height" | "depth";
  availableMm: number;
  externalRef?: string; // futuro room system
};
```

### Cálculo ocupado (v1)

- Módulos: `BoxModule.dimensoes` / `workspaceBoxes`
- Remates: `RematePiece.width/height` (`remateProductRules.ts` — ex.: 2000 + 20 + 20 = 2040 mm)
- Rodapés: `ProjectRodape.dimensions`
- Associação módulo↔parede: **manual** na UI da revisão

### Futuro

```typescript
interface RoomDimensionProvider {
  listWallConstraints(projectId: string): Promise<DimensionConstraintSource[]>;
}
```

---

## 14. Ferragens Comerciais

### Onde integrar

**Novo campo:** `ProjectState.commercialExtras: CommercialExtraItem[]`

**Consumidores (SIM):** `computeFerragensUnificadoSsot`, PDF ferragens totais, `productionRelease`, UI revisão

**Nunca consumir:** `buildCutlistItemsForIndustrialExport`, `buildIndustrialFerragensForProject`, drill, TCN, nesting

### Padrão existente a reutilizar

`financeiroFerragensEngine.ts` — linhas `added: true`, `origemPreco: "manual"`

---

## 15. Validações

### Reutilizar

- `assertExportInvariantsAllowed`
- `industrialValidation.ts`
- `ruleViolations`, `layoutWarnings`
- `validateCncExport`

### Novos (criar)

- `DIM_WALL_EXCEEDED` — WARNING v1
- `MAT_INCONSISTENT_THICKNESS` — WARNING
- `MAT_MISSING` — WARNING

---

## 16. Avisos

```typescript
type FabricationWarning = {
  code: string;
  severity: "info" | "warning" | "error";
  title: string;
  description: string;
  elementId?: string;
};
```

**v1:** WARNING não bloqueia. Futuro: config admin para bloquear ERROR.

---

## 17. Histórico

```typescript
type FabricationReviewRecord = {
  reviewNumber: number;
  sessionId: string;
  projectId: string;
  userId: string;
  status: "confirmed" | "cancelled";
  changes: FabricationReviewChange[];
  warnings: FabricationReviewWarning[];
  exportResult?: { zipDelivered: boolean };
};
```

**Persistência v1:** `ProjectState.fabricationReviewHistory[]` append-only.

---

## 18. Auditoria

Registar: utilizador, timestamp, alterações (before/after), resultado, fingerprints baseline/pós-apply.

Hook futuro: Events System (`features.eventsSystem`) — no-op se flag off.

---

## 19. Permissões

| Acção | Permissão proposta |
|-------|-------------------|
| Abrir revisão | `project.fabrication.review` |
| Alterar materiais | `project.fabrication.edit_materials` |
| Extras comerciais | `project.fabrication.edit_commercial` |
| Confirmar + gerar | `project.fabrication.confirm` |
| Gerar directo | `project.export.direct` |

Roles sugeridos: pro+ revisão; ultra+ confirmar; visitor só leitura.

---

## 20. UX proposta

Secções: Resumo → Dimensões → Materiais → Espessuras → Ferragens (auto + comerciais) → Peças (lazy) → Avisos → Acções

Botões: `[Cancelar]` `[Confirmar e gerar]`

Entry: `UnifiedExportBubble` com «Revisar antes de fabricar» (futuro primário) e «Gerar direto».

---

## 21. Reutilização de componentes existentes

| Componente | Reutilizar |
|------------|------------|
| `buildCutlistItemsForIndustrialExport` | **SIM** — SSOT peças |
| `materialSync.ts` | **SIM** — apply na confirmação |
| `invariant engine` | **SIM** |
| `buildIndustrialFerragensForProject` | **SIM** — resumo auto |
| `financeiroFerragensEngine` | **SIM** — padrão extras |
| `productionRelease` | **SIM** — pós-export inalterado |
| `useGerarArquivoHandlers` | Refactor — extrair pipeline |
| `industrialDocumentOverrides` | **NÃO** — domínio pós-export PDF |

---

## 22. Componentes protegidos

**Não alterar:**

- `buildCncFromCutlistItemsInWorker` / algoritmo cutlayout
- Formato TCN / `tcnGeneratorNestingMo.ts`
- `buildDrillFilesForProject` / regras furação
- Schema `productionRelease` v1
- Normalização `projectPersistence` (só adicionar campos opcionais)

---

## 23. Pré-requisitos

| Item | Prioridade | Estado (ago/2026) |
|------|------------|-------------------|
| `getMaterialForBox` + `projectMaterialId` | HIGH | Pendente |
| `guardIndustrialExport` + `layoutResult` | HIGH | Pendente |
| Testes paridade infra | HIGH | Pendente |
| Manufacturing AI | — | Não dependência |

**Ficheiros afectados (F0):** `boxManufacturing.ts`, `cornerCabinetManufacturing.ts`, `caixaFornoGenerator.ts`, `pi/manufacturing.ts`, `useGerarArquivoHandlers.ts`

---

## 24. Refactors necessários

- Extrair `runIndustrialExportPipeline()` (Fase 10)
- Criar módulos `fabricationReview/*` (Fases 1–9)
- Adicionar `commercialExtras` + `fabricationReviewHistory` ao `ProjectState`
- Merge extras em `computeFerragensUnificadoSsot`

---

## 25. Refactors proibidos

- Segundo cutlist/nesting/CNC engine
- Unificar room system na revisão
- Substituir `materialSync`
- Alterar formatos ZIP/TCN/manifest
- Migrar `productionRelease` para v2 nesta feature

---

## 26. Compatibilidade

- Campos novos **opcionais** com defaults `[]`
- Feature flag off = zero impacto
- Projectos antigos: «Gerar directo» idêntico
- `schemaVersion` no histórico

---

## 27. Feature Flag

```typescript
// src/industrial/config/featureFlags.ts
fabricationReview: false,
```

Rollout: dev → admin/ultra+ beta → pro+ → default on (após paridade F11).

---

## 28. Estratégia de coexistência

| Fase | Botão directo | Botão revisão |
|------|---------------|---------------|
| 0–10 | Activo | Beta (flag) |
| 12–13 | Activo | Recomendado |
| 14+ | Secundário | Primário |

Nunca remover «Gerar directo» sem decisão explícita.

---

## 29. Estratégia de paridade

```
DIRECT_EXPORT(projectX) ≡ REVIEW(projectX, noChanges).confirm().export()
```

| Saída | Critério |
|-------|----------|
| Cutlist | `cutlistFingerprint` idêntico |
| TCN | manifest hash idêntico |
| Drill | ficheiros equivalentes |
| Ferragens industrial | linhas auto iguais |
| Ferragens totais | industrial + extras (vazios na paridade) |

Teste: `src/validation/fabricationReviewParity.test.ts`

---

## 30. Estratégia de testes

- Unit: `materialOverrideResolver`, `dimensionalReviewEngine`
- Integration: report vs cutlist export
- Parity: direct vs review sem alterações
- Negativo: extras **não** aparecem em cutlist
- Cenários: simples, cozinha L, remates, material, projecto antigo

---

## 31. Roadmap

| Fase | Conteúdo |
|------|----------|
| **F0** | Pré-requisitos HIGH |
| **F1** | Contratos + tipos + flag stub |
| **F2** | Snapshot / session |
| **F3** | Report read-only |
| **F4** | UI read-only |
| **F5** | Materiais + excepções |
| **F6** | Dimensões + warnings |
| **F7** | Extras comerciais |
| **F8** | Histórico |
| **F9** | Validação integrada |
| **F10** | Integração export + `runIndustrialExportPipeline` |
| **F11** | Paridade |
| **F12–13** | Beta + rollout |
| **F14** | Revisão como fluxo primário |

---

## 32. Estimativa

| | Mínima | Realista | Conservadora |
|---|--------|----------|--------------|
| Total | 10 sem | 14 sem | 20 sem |

Por fase (realista): F0 1.5sem, F1 0.5sem, F2 1sem, F3–4 3sem, F5 2sem, F6 1.5sem, F7–9 3sem, F10–11 3sem, F12–14 2.5sem.

---

## 33. Matriz de riscos

| Risco | Prob. | Impacto | Mitigação |
|-------|-------|---------|-----------|
| Corrupção ProjectState | Média | Crítico | Session efémera |
| Divergência cutlist/CNC | Baixa | Crítico | SSOT único + paridade |
| Extras no CNC | Média | Crítico | Allowlist consumidores |
| Snapshot incompleto | Média | Alto | Checklist + testes |
| Refactor export | Média | Alto | Paridade antes/depois |

---

## 34. Decisões confirmadas

Ver secção [3. Requisitos confirmados](#3-requisitos-confirmados) (R1–R10).

---

## 35. Decisões abertas

1. Persistir rascunho ao refresh?
2. Confirmar apply antes ou durante export?
3. Preview nesting na revisão?
4. Histórico no snapshot vs API?
5. Global afecta remates/rodapés por default?
6. PDF impressão da revisão pré-export?

---

## 36. Melhorias recomendadas

**Essencial:** paridade test, materialOverrideResolver, isolamento extras CNC

**Recomendado:** diff antes/depois, navegação aviso→módulo, checklist confirmação

**Futuro:** RoomDimensionProvider, auto-ajuste dimensão alvo (MUITO ALTA), aprovação two-step

---

## 37. Futuras extensões

- Integração novo Room System via `RoomDimensionProvider`
- Auto-ajuste «dimensão final desejada» — viabilidade futura, dificuldade MUITO ALTA
- Events System para auditoria
- Export CSV BOM comercial

---

## 38. Critérios de aceitação

1. Revisão inserida entre UI export e pipeline industrial
2. SSOT peças: `buildCutlistItemsForIndustrialExport`
3. Snapshot isolado; projecto intacto até confirmar
4. Material global + excepções via resolver documentado
5. Extras comerciais fora CNC (teste negativo)
6. Paridade DIRECT ≡ REVIEW sem alterações
7. «Gerar directo» permanece
8. Feature flag controla rollout
9. Projectos antigos compatíveis

---

## 39. Checklist pré-implementação

- [ ] **Re-auditoria read-only completa do projecto** (ver [AVISO IMPORTANTE](#aviso-importante--re-auditoria-obrigatória-antes-da-implementação)) — actualizar este documento se necessário
- [ ] F0 HIGH concluído pelo agente de estabilização (revalidar após re-auditoria)
- [ ] Decisões abertas (sec. 35) resolvidas
- [ ] Permissões RBAC no backend
- [ ] ADR/tipos revistos
- [ ] Ambiente teste: simples, L, remates, antigo

---

## 40. Conclusão

A «Revisão para Fabricação» encaixa **acima** do pipeline existente, reutilizando builders validados. A decisão crítica — **sessão isolada + commit na confirmação** — protege o projecto original.

**Próximo passo autorizado:** **Re-auditoria completa** → depois Fase 0 (pré-requisitos) ou Fase 1 (contratos), após confirmação explícita de implementação.

**Referências de código críticas:**

- `src/hooks/useGerarArquivoHandlers.ts`
- `src/core/fabrication/buildCutlistItemsForIndustrialExport.ts`
- `src/core/materials/materialSync.ts`
- `src/core/fabrication/industrialPerThicknessPipeline.ts`
- `src/core/industrial/productionRelease.ts`
- `src/components/export/UnifiedExportBubble.tsx`

---

*Documento gerado a partir da auditoria arquitectural e sessão de planeamento (ago/2026). v1.1 — aviso de re-auditoria obrigatória antes da implementação. Implementação pendente.*
