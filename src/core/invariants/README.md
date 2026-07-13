# Invariant Engine — Guia interno

> **@pimo-soon** — funcionalidade incompleta, será expandida na próxima fase.  
> Ver também `ROADMAP.md` para estado actual e trabalho pendente.

Motor de validação industrial não-bloqueante com notificações persistentes e controlo de exportação via admin.

## Arquitectura

```
src/core/invariants/
├── types.ts                 # Tipos (Issue, Phase, RuleConfig)
├── registry.ts              # Catálogo de validadores (código)
├── config/
│   ├── invariantDefaults.ts # Regras seed + defaults
│   └── invariantRulesStore.ts # Persistência localStorage
├── phases/                  # Validadores por domínio
├── pipeline/runInvariantSuite.ts
├── integration/invariantContract.ts  # API pública
└── errors/InvariantViolationError.ts
```

## Como criar uma nova regra (código)

### 1. Implementar o validador

Criar função em `phases/` (ou ficheiro existente):

```typescript
import type { InvariantIssue, InvariantValidationInput } from "../types";

export function validateMyRule(input: InvariantValidationInput): InvariantIssue[] {
  const issues: InvariantIssue[] = [];
  // ... lógica pura, sem side-effects
  return issues;
}
```

Cada issue deve incluir `ruleId` igual ao `validatorId` no registry.

### 2. Registar no `registry.ts`

```typescript
{
  id: "my-validator-id",
  defaultName: "Nome legível",
  defaultDescription: "O que valida",
  defaultSeverity: "warning",
  phases: ["viewer", "export"],
  validate: validateMyRule,
}
```

### 3. Adicionar seed no admin (opcional)

Em `config/invariantDefaults.ts`, adicionar entrada em `BUILTIN_RULE_SEEDS` para aparecer activa por defeito no admin.

### 4. Integrar numa fase

- **Viewer / drilling automático**: `useProjectInvariants` já corre `viewer` e `drilling`.
- **Cutlayout**: passar `layoutResult` ao chamar `validateAndRecordInvariants`.
- **Export**: `assertExportInvariantsAllowed` em `useGerarArquivoHandlers`.

## API pública

```typescript
import {
  runInvariantSuite,
  validateAndRecordInvariants,
  assertExportInvariantsAllowed,
  invariantRulesStore,
} from "./integration/invariantContract";
```

| Função | Comportamento |
|--------|---------------|
| `runInvariantSuite` | Executa validação, não regista notificações |
| `validateAndRecordInvariants` | Executa + regista no sino |
| `assertExportInvariantsAllowed` | Executa + regista; lança se bloqueio activo |

## Configuração admin

- Rota legacy: `/admin` → **Invariant Rules**
- `blockGenerationOnErrors`: false = permitir export com erros; true = bloquear
- Regras custom no admin referenciam `validatorId` do registry (funções em código)

## Notificações

Store: `src/stores/invariantNotificationStore.ts`  
Persistência: `localStorage` key `pimo_invariant_notifications_v1`  
UI: sino no `Header.tsx`

## Testes

Ver `src/validation/invariants.integration.test.ts`.
