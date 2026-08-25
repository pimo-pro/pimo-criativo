# FINAL ENVIRONMENT + MULTI-PLATFORM READINESS AUDIT

**Data:** 24 de Agosto de 2026  
**Tipo:** AUDIT ONLY (read-only)  
**Âmbito:** Verificar a implementação de Environment Separation e compatibilidade Web / Desktop / Mobile / Offline futuro  
**Fontes lidas:**  
`docs/ENVIRONMENT-SEPARATION-DEPLOYMENT-SAFETY-PLAN.md`,  
`docs/ENVIRONMENT-SEPARATION-IMPLEMENTATION-REPORT.md`,  
`docs/SPEC-ARQUITETURA-AUTH-AUTHZ-SUBSCRIPTIONS.md`,  
`docs/PHASE-0-IMPLEMENTATION-REPORT.md`,  
`docs/PHASE-1-FINAL-VERIFICATION-REPORT.md`,  
`docs/PHASE-1-STAGING-VERIFICATION-REPORT.md`,  
`docs/PHASE-1-API-ACL-IMPLEMENTATION-PLAN.md`  
**Código inspeccionado (amostra):** `pimoEnvironment.ts`, `localDevAccess.ts`, `local-auth.ts`, `AuthProvider.tsx`, `vite.config.ts`, `devLocalAuthMiddleware.ts`, `api/auth/index.php`, `api/authz/resourceAccess.php`, `migrateTargetGuard.mjs`, `applyMigrationsPg.mjs`, workflows CI, `.env.example`, `writePolicy.ts`, `config/api.ts`, testes environment

**Restrições desta tarefa:** sem correções, sem migrations, sem infra externa, sem commit/push.

---

## 1. Executive Summary

A separação de ambientes no **código do repositório** está **substancialmente correcta e alinhada** com o plano oficial: proxy LOCAL sem Production por default, Full Local Development Access ligado a runtime `local-dev` (não a `username === "K"`), K/K fail-closed fora de LOCAL, guards de migrate com target/allowlist/confirmação Production, e CI de migrations sem auto-`push main`.

Contudo, o sistema **não está operacionalmente READY** para Staging nem para aplicar Migration 015 com identidade inequívoca: falta infraestrutura/secrets externos (**REQUIRES EXTERNAL CONFIGURATION** / **NOT VERIFIED**). Production client/migrate code é fail-closed; o risco residual P0 de RLS anon (013 sem 015) e smoke Hostinger permanecem da Phase 1 — **fora** de “environment separation”, mas relevantes para segurança global.

| Área | Veredicto rápido |
|------|------------------|
| Environment Separation (código) | **PARTIAL** (modelo OK; Staging operacional ausente) |
| Local Development (UI/RBAC) | **READY** com ressalvas API remota |
| K/K | **READY** (código) / Hostinger **NOT VERIFIED** |
| Production Security (bypasses env) | **READY** (código) / ops Hostinger **NOT VERIFIED** |
| Migration Safety (runner/CI) | **PARTIAL** (guards OK; misconfig allowlist partilhado possível) |
| Migration 015 Readiness | **NOT READY** (dependências externas) |
| Desktop / Offline / Mobile | **PARTIAL** (não bloqueados; não implementados) |

---

## 2. Environment Model

### Separação observada

| Camada | Source of truth | Detecção | Fail-closed? |
|--------|-----------------|----------|--------------|
| Client runtime | `resolveClientRuntimeKind()` | Vite `import.meta.env.DEV` → `local-dev`; senão `VITE_PIMO_APP_ENV` → staging vs production-client | Desconhecido → **production** |
| Declared app env | `VITE_PIMO_APP_ENV` / default DEV=`local` | `normalizePimoAppEnv` | Sim |
| PHP server | `PIMO_APP_ENV` | `pimo_app_env()` | Ausente/inválido → **production** |
| Migrate target | `PIMO_MIGRATE_TARGET` | `validateMigrateTarget` | Missing/invalid → **exit 1** |
| Vite MODE | `npm run dev` vs build | `import.meta.env.DEV/PROD` | N/A |
| Node | scripts CI/local | `process.env` + ficheiros `.env*` | Depende do guard |

### Distinções preservadas (código)

- `local-dev` ≠ Desktop Production (comentários + gating por Vite DEV).  
- Staging client ≠ Production client.  
- Full Local Development Access ≠ Role/Plan.

### Caminhos de interpretação incorrecta (documentados, não corrigidos)

| Risco | Evidência | Severidade |
|-------|-----------|------------|
| Cliente com `VITE_PIMO_APP_ENV=local` em **build** não-DEV | `resolveClientRuntimeKind` cai em `production-client` (não promove a local-dev) | Mitigado (bom) |
| PHP `PIMO_APP_ENV` mal definido no Hostinger | **NOT VERIFIED** remotamente | P1 ops |
| Migrate: `PIMO_MIGRATE_ALLOWED_REF` único partilhado entre targets | Fallback comum em `resolveExpectedProjectRef` — label `staging` pode validar ref de Production se secrets forem os mesmos | **P1** misconfig |
| Load `.env` → `.env.staging` → `.env.production` | `.env.production` sobrescreve chaves de staging no merge local | **P1** se ambos existirem |
| Client vs PHP env dessincronizados | Dois eixos independentes (Vite vs `PIMO_APP_ENV`) — correcto, mas exige disciplina ops | P2 |

**Conclusão modelo:** claro no código; **não** unificado numa única abstração multi-plataforma (`runtimePlatform`) — aceitável nesta fase.

---

## 3. Local Development

### `npm run dev` (evidência `vite.config.ts`)

| Comportamento | Estado |
|---------------|--------|
| Proxy `/api` default | **DESLIGADO** (não aponta pimo.pro) |
| Proxy remoto | Só com `VITE_DEV_API_PROXY_TARGET` |
| pimo.pro | Bloqueado salvo `VITE_ALLOW_DEV_PROXY_PRODUCTION=true` |
| `/api/materials` | Middleware local |
| `/api/auth/dev-local` | Middleware local (bypass do proxy) |

### Capacidade de testar áreas

| Área | Com K/K + full local access | Sem Production | Notas |
|------|----------------------------|----------------|-------|
| Páginas / Admin UI | **SIM** (permissões all + `hasPermission` bypass local) | SIM | Gate UI `App.tsx` |
| RBAC permissions (UI) | **SIM** (todas as `ALL_KNOWN_PERMISSIONS`) | SIM | Sem selector de role restrita |
| Simular role *restrita* (ex. visitor sem admin) | **NÃO** out-of-the-box | — | Só “tudo ligado”; **PARTIAL** |
| Auth JWT real | Precisa PHP local ou proxy **explícito** | SIM se staging/local PHP | Default sem proxy → JWT remoto falha |
| Projects / Orders sync remoto | `local-dev-token` → **sem** Bearer remoto (`remoteApiAuth.ts`) | Offline local only | Alinhado Phase 1 plan |
| Industrial PHP orders | Requer JWT real | Idem | |
| Supabase industrial writes | Permitidos em DEV por `writePolicy` | Pode apontar ao projecto das `VITE_SUPABASE_*` do `.env` | **NOT VERIFIED** se `.env` é prod |
| Subscription / entitlement states | **NOT IMPLEMENTED** | — | Spec futura |
| Feature gates futuras | Só o que existir no código | — | |

**Veredicto LOCAL:** **READY** para desenvolvimento UI/RBAC completo; **PARTIAL** para testar ACL de APIs remotas e roles restritas sem contas JWT / tooling extra. **Não** depende de Production por default (proxy).

---

## 4. K/K

### Locais tratados (inventário)

| Local | Comportamento |
|-------|----------------|
| `src/local-auth.ts` | Gate `isLocalDevAuthUiAllowed()`; credenciais K/K; sessão `local-dev-token` |
| `src/server/devLocalAuthMiddleware.ts` | Só `configureServer` (dev); role `local-dev` |
| `src/pages/LoginPage.tsx` | Hint só se local auth allowed |
| `api/auth/index.php` `/login` | K/K → **401** sempre |
| `api/auth/index.php` `/dev-local` | Só `PIMO_APP_ENV=local\|development`; senão **403** |
| Bearer `local-dev-token` | Rejeitado em `/me`, authz resourceAccess, APIs JWT |
| Preview Vite | Middleware K/K **não** registado |

### Caminhos proibidos

| Caminho | Resultado da auditoria |
|---------|------------------------|
| K/K → STAGING (client build) | **DENIED** (não `local-dev`) |
| K/K → PRODUCTION PHP (`PIMO_APP_ENV` prod) | **DENIED** no código |
| `username == K` → privilege em Production | **Não encontrado** como bypass de permissões; privileges vêm de full local access + sessão local só em DEV |
| Hostinger live rejeita K/K | **NOT VERIFIED** |

### Inconsistência menor (não corrigida)

PHP `pimo_auth_handle_dev_local` ainda devolve `role: industrial` (Vite devolve `local-dev`). Em `npm run dev` o middleware Vite tem prioridade no path `/api/auth/dev-local`. Risco baixo; **P3** higiene.

---

## 5. Full Development Access

| Pergunta | Resposta |
|----------|----------|
| Depende de ENVIRONMENT? | **SIM** — `isLocalDevelopmentRuntime()` (= Vite DEV) |
| Depende de username/password para privileges? | **NÃO** — K/K só autentica; permissões de `getLocalDevelopmentPermissions()` |
| Interferência Production/Staging client? | **NÃO** se `DEV=false` |
| Interferência API authorization? | **NÃO** — token local rejeitado pelas APIs JWT |
| Interfere Subscription entitlements? | N/A — entitlements **NOT IMPLEMENTED** |
| Simular *todas* as permissions? | **SIM** (conjunto completo) |
| Simular *cada* role isoladamente? | **PARTIAL** — sem mode switcher; full-allow apenas |

---

## 6. API Targets

### Referências a `pimo.pro`

| Contexto | Classificação |
|----------|---------------|
| `vite.config.ts` default proxy | **REMOVIDO** (bloqueio explícito) |
| `.github/workflows/deploy.yml` `VITE_API_URL` / verify | **PRODUCTION DEPLOY** (esperado) |
| `.env.example` `VITE_API_URL=` vazio | **DEFAULT** local seguro |
| `src/config/api.ts` default `""` → same-origin | **SAFE** default |
| Docs / README / testes industriais | **DOCUMENTATION** / fixtures |
| `scripts/regenerateIndustrialWorkOrderNqr.mjs` fallback `https://pimo.pro` | **EXPLICIT** script tool — **P2** (não é `npm run dev`) |
| `scripts/appendWhatsApp…` / news URL | Tooling — fora do path DEV default |

### Endpoints sob LOCAL default (sem proxy)

| Path | Destino LOCAL default |
|------|------------------------|
| `/api/auth/dev-local` | Vite middleware |
| `/api/materials` | Vite middleware |
| `/api/auth` (JWT), `/api/projects`, industrial, quotes | **Sem backend** salvo PHP local / proxy explícito |

**Regra “LOCAL ≠ Production por default”:** **CUMPRIDA** no Vite DEV.

---

## 7. Production Security

| Bypass | Estado no código |
|--------|------------------|
| K/K | Bloqueado fora local-dev + PHP local |
| `local-dev-token` em APIs | Rejeitado |
| Full local access | Requer DEV + sessão local |
| Fake admin UI via localStorage | Possível spoof UI (browser) — APIs JWT/ACL são autoridade; conhecido Phase 0 |
| JWT secret fallback prod | Removido Phase 0 (fail-closed) |
| Seed admin prod | Só local/development (Phase 0) |
| Hardcoded admin password em login UI | Removido Phase 0 |

| Superfície | Estado |
|------------|--------|
| JWT / RBAC client | Fail-closed env; ACL Phase 1 no código |
| Projects / Orders PHP ACL | Implementado; HTTP live **NOT VERIFIED** |
| Admin UI gate | Implementado; browser Hostinger **NOT VERIFIED** |
| Industrial anon RLS 013 | **P0 residual** até 015 (Phase 1) — **não** introduzido por Environment Separation |

Deploy: `VITE_PIMO_APP_ENV=production` injectado. `deploy.yml` **sem** `environment:` GitHub — proteções de Environment **NOT VERIFIED** / ausentes no YAML.

---

## 8. Migration Safety

### Runner (`applyMigrationsPg.mjs` + `migrateTargetGuard.mjs`)

Falha em: target em falta/inválido, allowlist em falta, ref actual em falta, mismatch, Production sem `CONFIRM_PRODUCTION_MIGRATE=I_UNDERSTAND`. Dry-run suportado.

### CI (`supabase-migrations.yml`)

- Auto `push main` → **REMOVIDO**  
- Só `workflow_dispatch` + `environment: ${{ inputs.target }}`  
- Inputs target / dry_run / confirm_production  

### Pode uma migration chegar a Production **acidentalmente**?

**PARTIAL**

| Cenário | Risco |
|---------|--------|
| Push main sem dispatch | **NÃO** (trigger removido) |
| Dispatch sem allowlist / confirm | **NÃO** (guard exit 1) |
| Dispatch `target=staging` com secrets Environment mal configurados (mesmo `DATABASE_URL` + `PIMO_MIGRATE_ALLOWED_REF` = prod) | **SIM** — label mente; guard passa se refs coincidem |
| Local com `.env.production` a sobrescrever staging + allowlist prod + `PIMO_MIGRATE_TARGET=production` + confirm | **SIM** — intencional/ops, não “acidente silencioso” |
| Apply “só 015” | Runner aplica **todas** pendentes — risco operacional conhecido |

---

## 9. Migration 015 Readiness

Nesta auditoria **não** aplicada / não modificada.

| Checklist | Classificação |
|-----------|---------------|
| environment identity (código migrate target) | **READY** |
| staging project identity | **EXTERNAL DEPENDENCY** / **NOT READY** |
| credentials separation | **EXTERNAL DEPENDENCY** / **NOT READY** |
| migration guard | **READY** |
| target allowlist | **READY** (código) / secrets **EXTERNAL DEPENDENCY** |
| backup strategy | **NOT READY** (não evidenciada no repo) |
| rollback understanding | **PARTIAL** (015 = DROP POLICY IF EXISTS; rollback = reaplicar 013 — documentado Phase 1, não runbook ops formal) |
| post-migration tests | **NOT READY** (suite REST CI existe; não corrida em staging real) |
| RLS verification live | **NOT READY** |
| API smoke tests | **NOT READY** |

**Veredicto 015:** **NOT READY** para execução segura em STAGING até identidade de projecto + secrets separados + backup/rollback ops.

---

## 10. Supabase

| Ambiente | Status |
|----------|--------|
| LOCAL Supabase | **UNKNOWN** — depende de `.env` local (**conteúdo não lido** nesta auditoria) |
| STAGING Supabase | **MISSING** / **NOT CONFIGURED** (sem project documentado; `config.toml` `project_id = ""`) |
| PRODUCTION Supabase | **CONFIGURED** via secrets CI / uso histórico — valores **UNKNOWN** ao auditor; identidade inequívoca **NOT VERIFIED** |

Não foram inventados nem divulgados project refs.

---

## 11. Hostinger

| Item | Estado (repo only) |
|------|---------------------|
| Production deploy FTP tags `v*` | **CONFIGURED** no workflow |
| `VITE_API_URL=https://pimo.pro` no build deploy | **CONFIGURED** |
| `VITE_PIMO_APP_ENV=production` | **CONFIGURED** no workflow |
| `PIMO_APP_ENV` / `PIMO_JWT_SECRET` no painel | **NOT VERIFIED** |
| Staging host | **MISSING** |

---

## 12. GitHub Actions

| Workflow | Achado |
|----------|--------|
| `supabase-migrations.yml` | Sem push→DB; dispatch + environment name = target |
| `deploy.yml` | Produção `pimo.pro`; sem `environment:` GitHub no YAML |
| Secrets Environments reais | **NOT VERIFIED** |
| `main → migration → unknown DB` | **Mitigado** no desenho actual do YAML |
| `staging → production DB` | **Possível se** Environment `staging` partilhar secrets de produção (**EXTERNAL** / misconfig) |

---

## 13. Web Compatibility

**READY** para o modelo actual Web online: Vite + PHP Hostinger + Supabase client. Environment Separation melhora o isolamento DEV↔PROD no path default.

---

## 14. Desktop Compatibility

**PARTIAL** (não bloqueado; não pronto).

| Pergunta | Avaliação |
|----------|-----------|
| Authz como conceito de domínio (JWT + permissions)? | **SIM** — reutilizável |
| Full access amarrado a Vite `DEV`? | **SIM** — Desktop “dev” precisará sinal próprio (`runtimePlatform`) — recomendação já no impl report |
| Local storage / DB / Sync? | **NOT IMPLEMENTED** — espaço arquitectural livre |
| Bloqueio duro? | **NÃO** |

---

## 15. Offline Compatibility

**PARTIAL / PARTIALLY COMPATIBLE**

| Capacidade futura | Estado |
|-------------------|--------|
| Guest / local projects sem sync | Já alinhado (`local-dev-token` / guest → sem sync remoto) |
| Offline auth / permissions formal | **NOT IMPLEMENTED** |
| Sync / conflitos | **NOT IMPLEMENTED** |
| Obrigatoriedade Internet+Supabase em todas as ops | **Não forçada** pelo novo default de proxy; industrial ainda usa Supabase quando configurado |

**Não BLOCKED.**

---

## 16. Mobile Compatibility

**PARTIAL**

- JWT + permissions efectivas são consumíveis fora do browser.  
- Sessão actual em `localStorage` é web-centric — **não** bloqueia Mobile, mas exigirá storage nativo.  
- Full local access **não** deve ser portado para Mobile Production (já gated por DEV).  
- Evitar cookies-only: auth actual já é Bearer — favorável.

**Não BLOCKED.**

---

## 17. Auth / AuthZ / Plans

| Conceito | Misturado indevidamente? |
|----------|---------------------------|
| Environment | Separado (`pimoEnvironment` / `PIMO_APP_ENV`) |
| Role | Sessão JWT / `local-dev`; não = environment |
| Permission | Lista + `hasPermission`; full access = excepção **LOCAL** explícita |
| Plan / Entitlement | **NOT IMPLEMENTED** — sem mistura observada |
| Development Access | Explicitamente local-dev + sessão local |

Alinhamento com Spec: Auth ∧ Membership ∧ Permission ∧ Entitlement ∧ Limit — Membership/Entitlement ainda futuros; excepção LOCAL documentada.

---

## 18. Regression Findings

| Área | Achado | Severidade |
|------|--------|------------|
| Login JWT em `npm run dev` | Sem proxy/PHP local, login remoto deixa de “funcionar por magia” | **P2** regressão DX (intencional) |
| Projects/Orders remoto com K/K | Continua sem sync (esperado Phase 1) | Info |
| AuthProvider | Usa ainda `import.meta.env.DEV` directo nalgumas limpezas (equivalente a local-dev no Vite) | P3 |
| PHP role `industrial` vs Vite `local-dev` | Inconsistência path PHP | P3 |
| Build / testes reportados na impl | 31 PASS, `tsc`, `npm run build` PASS — **não re-executados** nesta auditoria read-only | **NOT VERIFIED** nesta tarefa |
| Industrial writes DEV | Continuam permitidos por default — podem atingir Supabase do `.env` | **P1** se `.env` = prod |
| `src/api/projectsApi.ts` path alternativo | Risco histórico Phase 1 — **NOT VERIFIED** runtime | P2 legado |

---

## 19. Security Findings

| ID | Achado | Severidade |
|----|--------|------------|
| S1 | RLS anon 013 presumivelmente activa até 015 | **P0** (pré-existente Phase 1) |
| S2 | Staging inexistente → pressão para apontar DEV/migrate a Production | **P1** ops |
| S3 | `PIMO_MIGRATE_ALLOWED_REF` partilhável + Environments mal configurados | **P1** |
| S4 | Merge local `.env.production` sobre `.env.staging` | **P1** |
| S5 | `.env` local pode ainda apontar Supabase Production em DEV writes | **P1** / **NOT VERIFIED** conteúdo |
| S6 | Hostinger `PIMO_JWT_SECRET` / `PIMO_APP_ENV` | **P1** **NOT VERIFIED** |
| S7 | Spoof UI localStorage em browser | **P2** (APIs rejeitam token local) |
| S8 | Script tooling com default `pimo.pro` | **P2** |
| S9 | Testes production stub de `import.meta.env.DEV` limitados | **P2** cobertura |
| S10 | Deploy sem GitHub Environment protections no YAML | **P2** |
| S11 | PHP role string desactualizada em `/dev-local` | **P3** |
| S12 | Secrets em `VITE_*` (JWT/service role/DB password) | **Não encontrados** em `.env.example` / modelo actual |

---

## 20. Multi-Platform Risk Matrix

| Área | Web | Desktop | Mobile | Offline | Risco |
|------|-----|---------|--------|---------|-------|
| Environment model | OK | Precisa `runtimePlatform` | Idem | Separar offline≠local-dev | Médio (futuro) |
| K/K / full access | OK local-only | Não portar a Desktop Prod | Não portar | N/A | Baixo se disciplina |
| JWT Authz | OK | Reutilizável | Reutilizável | Cache futuro | Baixo |
| Session storage | localStorage | Precisa abstrair | Precisa abstrair | Precisa abstrair | Médio |
| Projects sync | PHP + token | Local DB + sync | Idem | Guest/local já | Médio |
| Industrial / Supabase | Anon+BFF gap | Offline industrial | Idem | Alto até BFF/015 | **Alto** |
| Migrations | Guards OK | N/A | N/A | N/A | Médio (ops) |
| Staging gap | Bloqueia validação | Bloqueia | Bloqueia | — | **Alto** ops |

---

## 21. Final Verdict

| | Área | Veredicto |
|---|------|-----------|
| A | Environment Separation | **PARTIAL** |
| B | Local Development | **PARTIAL** (UI/RBAC **READY**; APIs remotas/roles restritas **PARTIAL**) |
| C | K/K | **READY** (código) — live Hostinger **NOT VERIFIED** |
| D | Production Security | **PARTIAL** (bypasses env **READY** no código; RLS 015 + Hostinger smoke abertos) |
| E | Migration Safety | **PARTIAL** |
| F | Migration 015 Readiness | **NOT READY** |
| G | Desktop Compatibility | **PARTIAL** (não **BLOCKED**) |
| H | Offline Compatibility | **PARTIAL** (não **BLOCKED**) |
| I | Mobile Compatibility | **PARTIAL** (não **BLOCKED**) |

---

## 22. Recommended Next Step

**A. Criar/configurar Supabase STAGING** (projecto dedicado + refs allowlist + secrets GitHub Environment `staging` distintos de Production).

Ordem sugerida (não executar nesta tarefa):

1. **A** — Staging Supabase + allowlists  
2. Validar migrate dry-run `target=staging`  
3. Só então **C** — Migration 015 em STAGING  
4. Em paralelo/ops: confirmar Hostinger `PIMO_APP_ENV` / JWT (**NOT VERIFIED**)  
5. Corrigir achados P1 de misconfig (S3/S4) numa tarefa de fix **separada** se desejado  
6. **Não** avançar Phase 2 como substituto de Staging/015

---

## Evidência de testes/build (herdada; não revalidada aqui)

| Item | Estado nesta auditoria |
|------|------------------------|
| Testes environment + Phase 1 (31) | Reportados PASS na implementação — **NOT RE-RUN** |
| `tsc -b` / `npm run build` | Reportados PASS — **NOT RE-RUN** |

---

**STOP.** Sem correcções, sem 015, sem Staging criado, sem alterações a Supabase/Hostinger/GitHub, sem Phase 2, sem commit/push.
