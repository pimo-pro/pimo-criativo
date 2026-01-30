# Painel de Referência: Dynamic Rules & Smart Behaviors (Fase 4)

Documento de referência do sistema de regras dinâmicas e comportamentos inteligentes para modelos GLB.

---

## 1. Objetivos da Fase 4

- **Sistema de Regras Dinâmicas por Modelo GLB**: cada modelo pode ter regras próprias (dimensão, material, compatibilidade, posição, comportamento).
- **Auto-Positioning**: posicionamento automático de modelos dentro da caixa, evitando sobreposição, com snapping e alinhamento.
- **Smart Constraints**: impedir combinações inválidas (ex.: porta maior que a caixa); validar posições e dimensões em tempo real.
- **UI para gestão de regras**: painel para editar regras por modelo, ativar/desativar regras e mostrar avisos de violação.

---

## 2. Estrutura do módulo `src/core/rules/`

| Ficheiro | Descrição |
|----------|-----------|
| `types.ts` | Tipos: `RuleKind`, `RuleSeverity`, `DimensionRule`, `MaterialRule`, `CompatibilityRule`, `PositionRule`, `BehaviorRule`, `ModelRules`, `RuleViolation`, `ValidationContext`, `AutoPositionResult`. |
| `modelRules.ts` | Armazenamento em localStorage (`pimo_model_rules`): `getModelRules`, `getRulesForModel`, `setModelRules`, `updateModelRule`, `setRuleEnabled`, `addModelRule`, `removeModelRule`, `getModelIdsWithRules`. |
| `validation.ts` | Validação: `validateModelRules(ctx)`, `validateBoxModels(boxId, boxDimensoes, boxModels, modelDimensoesByInstanceId)`. Produz `RuleViolation[]`. |
| `positioning.ts` | Auto-posicionamento e snapping: `computeAutoPosition`, `boxesOverlap`, `snapPosition`. |
| `index.ts` | Re-exportação do módulo. |

---

## 3. Tipos de regras

- **dimension**: limites min/max (mm ou percentual da caixa) para largura, altura ou profundidade do modelo.
- **material**: lista de materiais permitidos para a instância.
- **compatibility**: máximo de instâncias do mesmo modelo por caixa; categorias permitidas na caixa (futuro).
- **position**: posições válidas (frente, interior, etc.) – usado para lógica de posicionamento.
- **behavior**: snapping (grid mm), auto-position (stack, align_front, align_center).

---

## 4. Fluxo de validação

```
workspaceBoxes + extractedPartsByBoxId
        ↓
getModelDimensoesFromExtracted (bbox aprox. por instância)
        ↓
validateBoxModels(boxId, boxDimensoes, boxModels, modelDimensoesByInstanceId)
        ↓
Para cada modelo: getRulesForModel(modelId) → validateModelRules(ctx)
        ↓
ruleViolations (estado do projeto)
        ↓
RuleViolationsAlert (painel Modelos) e RulesPanel
```

A validação é executada em `buildDesignState` (projectState), que chama `computeRuleViolations(prev)` e inclui `ruleViolations` no estado devolvido.

---

## 5. Estado do projeto

- **ruleViolations: RuleViolation[]**  
  Lista de violações calculada em cada `buildDesignState` (e em `recomputeState` quando aplicável).

---

## 6. UI

- **Sidebar esquerda**: ícone **Modelos** abre o painel dedicado a modelos GLB; `RuleViolationsAlert` mostra violações da caixa selecionada nesse painel.
- **Admin → Regras**: `RulesManager` – selecionar modelo, listar regras, ativar/desativar, adicionar (dimensão, material, compatibilidade), remover.
- **RulesPanel** (componente): lista violações e regras por modelo com toggles; pode ser usado em Documentação ou num separador dedicado.

---

## 7. Auto-positioning e snapping

- **computeAutoPosition(boxBounds, placedModels, modelId, modelSizeMm, instanceId)**: calcula próxima posição (stack, align_front, align_center) e aplica snap.
- **snapPosition(positionMm, modelId)**: aplica grid de snap conforme regras do modelo.
- **boxesOverlap(...)**: deteta sobreposição entre dois volumes AABB (com margem opcional).

A aplicação da posição calculada ao viewer fica para integração futura (ex.: ao adicionar modelo, definir posição no viewer com base em `computeAutoPosition`).

---

## 8. Funções principais

| Função | Módulo | Descrição |
|--------|--------|-----------|
| `getModelRules(modelId)` | core/rules | Obtém regras do modelo (localStorage). |
| `getRulesForModel(modelId)` | core/rules | Regras ativas (enabled) do modelo. |
| `setModelRules(modelId, rules)` | core/rules | Substitui regras do modelo. |
| `addModelRule(modelId, rule)` | core/rules | Adiciona uma regra. |
| `setRuleEnabled(modelId, ruleId, enabled)` | core/rules | Ativa/desativa regra. |
| `validateModelRules(ctx)` | core/rules | Valida contexto e devolve violações. |
| `validateBoxModels(...)` | core/rules | Valida todos os modelos de uma caixa. |
| `computeRuleViolations(prev)` | projectState | Calcula todas as violações do estado. |
| `computeAutoPosition(...)` | core/rules | Calcula posição automática e snap. |

---

## 9. Requisitos cumpridos

- Reutilização da arquitetura multi-model (workspaceBoxes, BoxModelInstance, extractedPartsByBoxId).
- Código modular e expansível (novos tipos de regra em types + validation).
- Sem duplicação: validação centralizada em validation.ts; estado em projectState.
- Regras aplicadas no estado (ruleViolations em buildDesignState) e expostas na UI (avisos e painel de regras).
