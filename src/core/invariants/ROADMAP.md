# Invariant System — Roadmap

> **@pimo-soon** — versão inicial funcional mas incompleta. Este documento regista o que já existe e o que falta para a fase de expansão.

## Estado actual

O Invariant System está **operacional** em modo não-bloqueante (por defeito): detecta violações, regista notificações persistentes e permite configurar regras no admin. A exportação só é bloqueada quando «Bloquear geração com erros» está activo.

---

## Implementado (v1 inicial)

### Motor (`src/core/invariants/`)
- [x] Tipos: `InvariantIssue`, severidade, fases, contexto
- [x] Registry com 8 validadores built-in
- [x] Store de configuração (`invariantRulesStore`) em `localStorage`
- [x] Pipeline `runInvariantSuite` com activação/desactivação por regra
- [x] Contrato público (`invariantContract.ts`): validar, registar, bloquear export
- [x] `InvariantViolationError` para bloqueio de exportação

### Validadores built-in
- [x] Furos fora da peça
- [x] Dimensões inválidas na cutlist
- [x] Rotação inconsistente (NaN/infinito)
- [x] Sobreposição no layout industrial
- [x] Peça fora da chapa
- [x] Cutlist vazia na exportação
- [x] Violações de regras do projecto (`ruleViolations`)
- [x] Avisos de layout CAD (`layoutWarnings`)

### Admin
- [x] Página **Invariant Rules** (`/admin`)
- [x] Activar/desactivar regras individualmente
- [x] Editar nome, descrição, severidade
- [x] Adicionar regras custom (instâncias de validadores existentes)
- [x] Toggle global: permitir / bloquear geração com erros
- [x] Indicador visual `@pimo-soon`

### Notificações
- [x] Store persistente (`invariantNotificationStore`)
- [x] Sino no `Header` com badge de não lidas
- [x] Modal com lista, filtros, marcar lidas, limpar
- [x] Indicador visual `@pimo-soon` no modal

### Integrações
- [x] Viewer + drilling: `useProjectInvariants` (debounced)
- [x] Cutlayout: `nestingV3Engine` após `runCutLayout`
- [x] Exportações: `guardIndustrialExport` em `useGerarArquivoHandlers`

### Testes e docs
- [x] `src/validation/invariants.integration.test.ts` (5 testes)
- [x] `README.md` (guia para criar novas regras)

---

## Por implementar (fase de expansão)

### Validadores e regras
- [ ] Validadores de geometria industrial (`geometryValidation`) integrados no motor
- [ ] Validação de contornos / transforms impossíveis no viewer
- [ ] Regras com parâmetros configuráveis no admin (`params` por regra)
- [ ] Editor de regras com pré-visualização em tempo real no projecto activo
- [ ] Sincronização de config com servidor (`global-config` / API PHP)

### Notificações
- [ ] Agrupamento por caixa/peça/operação
- [ ] Link «ir para» contexto (seleccionar peça no viewer)
- [ ] Notificações por projecto (scope por `projectId`)
- [ ] Exportação de relatório (PDF/CSV) de violações
- [ ] Push / alertas em tempo real (integração com Events System)

### Admin e RBAC
- [ ] Rota moderna `/admin/settings/invariants` com `PermissionRoute`
- [ ] Permissões por role (apenas `admin` / `ultra+` editam regras globais)
- [ ] Histórico de alterações de configuração

### Integrações industriais
- [ ] Hook em `ViewerCore` pós-sync (violations em tempo real no 3D)
- [ ] Validação em `runCutLayoutPerThickness` / pipeline MPM completo
- [ ] Guard em `multiProjectFabrication` e worker industrial
- [ ] Painel lateral no workspace (lista compacta de issues activas)
- [ ] Integração com `industrialDesignPanelOpen` / overlay viewer

### Qualidade
- [ ] Testes E2E (criar regra → violar → notificação → bloquear export)
- [ ] Benchmarks: impacto do debounce no viewer
- [ ] Feature flag `features.invariantSystem` (no-op quando desligado)

---

## Dependências

| Módulo | Relação |
|--------|---------|
| `industrialLayoutContract` | Validação de layout (cutlayout) |
| `geometryValidation` | Fonte futura de regras de design industrial |
| `industrialOutputGuard` | Complementar — autorização vs. invariantes |
| `createRulesStore` | Padrão de persistência admin |
| `ToastContext` | Toasts de bloqueio de export (não substitui notificações) |
| `Events System` | Evolução futura para alertas realtime (`@pimo-soon`) |
| `global-config` API | Persistência multi-dispositivo (fase 2) |

---

## Notas técnicas

1. **Validadores só em código** — o admin cria *instâncias* (`validatorId`), não funções arbitrárias em `localStorage` (segurança e manutenção).
2. **Não-bloqueante por defeito** — `blockGenerationOnErrors: false` em `invariantDefaults.ts`.
3. **Deduplicação de notificações** — mesma mensagem/regra/contexto em 60s não duplica entrada.
4. **Fases** — `viewer` | `drilling` | `cutlayout` | `export`; cada validador declara em que fases corre.
5. **Marcadores `@pimo-soon`** — presentes em todos os ficheiros do módulo até conclusão da fase de expansão.

---

## Referências

- Guia de desenvolvimento: [`README.md`](./README.md)
- Testes: [`src/validation/invariants.integration.test.ts`](../../validation/invariants.integration.test.ts)
