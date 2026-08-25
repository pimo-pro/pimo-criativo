# STAGING PROVISIONING & ISOLATION PLAN

**Documento:** Plano oficial para provisionar e isolar o ambiente STAGING  
**Data:** 24 de Agosto de 2026  
**Tipo:** PLANNING ONLY — sem criação de infra, sem migrations, sem alterações de código de produto  
**Fontes:**  
`docs/FINAL-ENVIRONMENT-READINESS-AUDIT.md`,  
`docs/ENVIRONMENT-SEPARATION-DEPLOYMENT-SAFETY-PLAN.md`,  
`docs/ENVIRONMENT-SEPARATION-IMPLEMENTATION-REPORT.md`,  
`docs/SPEC-ARQUITETURA-AUTH-AUTHZ-SUBSCRIPTIONS.md`,  
`docs/PHASE-1-FINAL-VERIFICATION-REPORT.md`

**Estado actual (herdado da auditoria):**

| Item | Estado |
|------|--------|
| Staging infra | **NOT READY / MISSING** |
| Migration 015 | **NOT READY** (não aplicar neste plano) |
| Production código (bypasses env) | **READY** |
| Production ops / RLS | **PARTIAL** |

---

## 0. Scope e regras

Este documento define **como** provisionar Staging e isolar Production.  
**Não** executa nenhum passo operacional.

Tratamento dos achados da auditoria **durante** o provisioning (sem corrigir código nesta tarefa):

| Achado | Severidade | Tratamento no provisioning |
|--------|------------|----------------------------|
| RLS anon 013 activa até 015 | P0 | Só aplicar 015 **depois** de Staging READY + identidade validada (§8) |
| Staging inexistente | P1 | Objectivo deste plano |
| Allowlist / `DATABASE_URL` partilháveis | P1 | Secrets **por Environment**; proibir `PIMO_MIGRATE_ALLOWED_REF` único partilhado entre staging e production (§5–6) |
| `.env.production` sobrescreve staging | P1 | Precedência por ficheiro-alvo único (§11) |
| `.env` DEV → Production Supabase | P1 | LOCAL usa Staging anon **ou** local; nunca prod por omissão (§12) |
| Hostinger env **NOT VERIFIED** | P1 | Checklist Owner + Hostinger Staging (§10) |
| JWT DX / tooling pimo.pro / role PHP | P2–P3 | Fora do caminho crítico; backlog pós-Staging READY |

---

## 1. Staging Architecture (alvo)

```
LOCAL DEVELOPMENT (máquina do developer)
  ├── Vite DEV → runtime local-dev
  ├── K/K + Full Local Development Access
  ├── API: local PHP OU proxy explícito → STAGING (nunca Production por default)
  └── Supabase client: prefer STAGING anon (ou local); nunca Production implícito
           │
           │  promote / PR / workflow_dispatch target=staging
           ▼
STAGING (ambiente real isolado)
  ├── Host: Hostinger Staging (hostname TO BE PROVIDED)
  ├── PHP API: mesmo código API, PIMO_APP_ENV=staging
  ├── Supabase: project STAGING dedicado (ref TO BE PROVIDED)
  ├── Database: Postgres do project STAGING
  ├── Storage / Auth Supabase: do project STAGING
  ├── Secrets: só GitHub Environment "staging" + painel Hostinger staging
  ├── Migrations: PIMO_MIGRATE_TARGET=staging + allowlist STAGING only
  └── Smoke / RLS / ACL / 015 first here
           │
           │  manual approval + CONFIRM_PRODUCTION_MIGRATE
           ▼
PRODUCTION (pimo.pro)
  ├── Hostinger Production
  ├── Supabase Production (ref TO BE PROVIDED — never invent)
  ├── Migrations: target=production + allowlist PRODUCTION + confirm
  └── Sem K/K / sem full local access
```

### STAGING — componentes obrigatórios

| Componente | Papel | Estado agora |
|------------|-------|--------------|
| Supabase Project | DB industrial + PostgREST + Storage/Auth do projecto | **MISSING** |
| Host | Servir SPA + PHP API staging | **MISSING** |
| API (PHP) | Auth JWT, projects, orders, quotes | Código existe; host **MISSING** |
| Database | Postgres do project Staging | **MISSING** |
| Storage | Buckets do project Staging (se usados) | **MISSING** / inventário **NOT VERIFIED** |
| Auth (PIMO JWT) | `PIMO_JWT_SECRET` staging no Hostinger | **TO BE PROVIDED** |
| Auth (Supabase Auth) | Só se o produto o usar neste projecto | **NOT VERIFIED** se activo |
| Secrets | Separados de Production | **MISSING** |
| GitHub Environment `staging` | Secrets + (opcional) reviewers | **MISSING** / **NOT VERIFIED** |
| Hostinger target | FTP/path ou subdomain | **TO BE PROVIDED** |
| Migration target | `PIMO_MIGRATE_TARGET=staging` | Código **READY**; ops **NOT READY** |

---

## 2. Supabase Staging Project

### O que criar (Owner / ops)

Criar um **projecto Supabase novo**, dedicado a Staging.  
**Não** clonar Production como “staging”.  
**Não** reutilizar o projecto canónico/Production.

### Campos a registar (sem inventar valores)

| Campo | Valor |
|-------|--------|
| Project name (sugerido) | `pimo-criativo-staging` (nome final: **TO BE PROVIDED** pelo Owner) |
| Project ref | `<TO BE PROVIDED>` |
| Project URL | `https://<TO BE PROVIDED>.supabase.co` |
| Dashboard URL | `<TO BE PROVIDED>` |
| Region | `<TO BE PROVIDED>` (preferir a mesma região operacional do prod **só como escolha consciente**, não como partilha de DB) |
| Database host | `db.<ref>.supabase.co` ou pooler — **TO BE PROVIDED** após criação |
| Database name | tipicamente `postgres` — confirmar no Dashboard |
| Postgres version | alinhar com Production se conhecido; senão **TO BE PROVIDED** |
| Auth (Supabase) | Activar só se necessário ao produto industrial; estado **TO BE PROVIDED** |
| Storage | Buckets necessários: inventário **TO BE PROVIDED** (pode ser vazio inicialmente) |
| RLS | Aplicar migrations do repo no Staging; 015 **só** após checklist §8 |
| Edge Functions | Inventário no repo/Production: **NOT VERIFIED** — se existirem em Production, decidir deploy separado; default Staging: **nenhuma** até inventário |
| Anon / publishable key | `<TO BE PROVIDED>` — CLIENT-SAFE; nunca commitar |
| Service role key | `<TO BE PROVIDED>` — SERVER-ONLY CRITICAL |
| Database password / `DATABASE_URL` | `<TO BE PROVIDED>` — SERVER-ONLY CRITICAL |

### Pós-criação (obrigatório antes de qualquer migration)

1. Registar `project_ref` num sítio **fora do git** de secrets (password manager / GitHub Environment).  
2. Preencher `PIMO_SUPABASE_PROJECT_REF_STAGING=<ref>` (nunca o ref de Production).  
3. Confirmar que `VITE_SUPABASE_URL` staging contém esse ref.  
4. **Proibido** copiar `DATABASE_URL` de Production para o Environment `staging`.

---

## 3. Production Isolation

### Ameaças a impedir

| Fluxo proibido | Mitigação |
|----------------|-----------|
| Staging → Production DB | Credenciais DB distintas + allowlist ref Production ≠ Staging |
| Staging → Production Supabase API | URL/keys só do project Staging no Environment `staging` |
| Staging → Production Storage | Storage do mesmo project Staging (isolamento por project) |
| Staging → Production Auth (PIMO JWT) | `PIMO_JWT_SECRET` distinto no Hostinger Staging |
| Label `staging` com secrets de prod | Proibir secrets repo-level partilhados; só Environment-scoped |
| `PIMO_MIGRATE_ALLOWED_REF` único = prod usado com `target=staging` | Preferir **apenas** `PIMO_SUPABASE_PROJECT_REF_STAGING` / `_PRODUCTION` / `_LOCAL`; evitar fallback partilhado em ops |

### Identidade inequívoca (obrigatória)

Cada execução de migrate / deploy deve conhecer:

1. **Environment name** — `local` \| `staging` \| `production`  
2. **Explicit target** — `PIMO_MIGRATE_TARGET` (migrations) / `PIMO_APP_ENV` + `VITE_PIMO_APP_ENV` (runtime)  
3. **Project ref allowlist** — variável *específica* do target  
4. **Actual project ref** — derivado de `SUPABASE_PROJECT_REF` ou URL  
5. **Match** — actual === expected; senão abort  
6. **CI Environment** — GitHub `environment: staging|production` com secrets isolados  
7. **Production only** — `CONFIRM_PRODUCTION_MIGRATE=I_UNDERSTAND` + reviewers

### Regra de ouro

```
if target == staging:
  credentials MUST resolve to STAGING_ALLOWED_PROJECT_REFS
if target == production:
  credentials MUST resolve to PRODUCTION_ALLOWED_PROJECT_REFS
  AND confirmation == I_UNDERSTAND
never: staging label + production credentials
```

---

## 4. Secrets Matrix

Valores **nunca** neste documento. Apenas nomes e exposição.

| Secret | LOCAL | STAGING | PRODUCTION | Exposure |
|--------|-------|---------|------------|----------|
| `PIMO_APP_ENV` | `local` / `development` | `staging` | `production` | SERVER (PHP) |
| `VITE_PIMO_APP_ENV` | omit / local (DEV) | `staging` | `production` | PUBLIC (bundle) |
| `PIMO_JWT_SECRET` | opcional / `_LOCAL` | **obrigatório** ≥32 | **obrigatório** ≥32 | SERVER-ONLY |
| `PIMO_INTERNAL_API_SECRET` | só se testar quotes | **obrigatório** se quotes | **obrigatório** | SERVER-ONLY |
| `VITE_SUPABASE_URL` | staging ou local | staging URL | prod URL | PUBLIC |
| `VITE_SUPABASE_ANON_KEY` | staging/local anon | staging anon | prod anon | PUBLIC (RLS crítico) |
| `SUPABASE_SERVICE_ROLE_KEY` | evitar; só scripts controlados | staging service role | prod service role | SERVER-ONLY CRITICAL |
| `DATABASE_URL` | local **ou** staging (nunca prod default) | **só** staging DB | **só** prod DB | SERVER-ONLY CRITICAL |
| `SUPABASE_DB_PASSWORD` | alinhado ao target | staging | production | SERVER-ONLY CRITICAL |
| `SUPABASE_PROJECT_REF` | local allowlist | staging ref | production ref | ENVIRONMENT-SPECIFIC |
| `PIMO_SUPABASE_PROJECT_REF_LOCAL` | allowlist local | — | — | ENVIRONMENT-SPECIFIC |
| `PIMO_SUPABASE_PROJECT_REF_STAGING` | — | allowlist staging | — | ENVIRONMENT-SPECIFIC |
| `PIMO_SUPABASE_PROJECT_REF_PRODUCTION` | — | — | allowlist prod | ENVIRONMENT-SPECIFIC |
| `PIMO_MIGRATE_ALLOWED_REF` | **evitar** se possível | **evitar** partilhado | **evitar** partilhado | Preferir refs por target |
| `PIMO_MIGRATE_TARGET` | `local` | `staging` | `production` | RUNTIME / CI |
| `CONFIRM_PRODUCTION_MIGRATE` | N/A | N/A | `I_UNDERSTAND` só em runs prod | CI / local prod |
| `VITE_API_URL` | vazio / local | staging origin | `https://pimo.pro` | PUBLIC |
| `VITE_DEV_API_PROXY_TARGET` | local PHP **ou** staging URL | N/A (build) | N/A | DEV only |
| `FTP_*` | — | FTP staging **TO BE PROVIDED** | FTP prod (existente) | SERVER-ONLY CRITICAL |

**Nunca** colocar em `VITE_*`: JWT secret, internal API secret, service role, `DATABASE_URL`, DB password.

---

## 5. DATABASE_URL Isolation

### Regra

```
LOCAL DATABASE_URL
  ≠ STAGING DATABASE_URL
  ≠ PRODUCTION DATABASE_URL
```

Três URIs distintas, três passwords distintas, três project refs distintos.

### Onde viver

| Target | Onde configurar | Não misturar com |
|--------|-----------------|------------------|
| local | `.env` **ou** ficheiro dedicado local (gitignored); **não** carregar `.env.production` | Prod / Staging credentials |
| staging | GitHub Environment `staging` + opcional `.env.staging` (só quando o comando é staging) | Prod |
| production | GitHub Environment `production` + Hostinger; `.env.production` só para runs **explicitamente** production | Staging / Local default |

### Validação no migration runner (já parcialmente implementada; ops deve cumprir)

1. `PIMO_MIGRATE_TARGET` obrigatório.  
2. Allowlist **específica** do target (`PIMO_SUPABASE_PROJECT_REF_<TARGET>`).  
3. `actualRef` de `SUPABASE_PROJECT_REF` ou URL da `DATABASE_URL` / `VITE_SUPABASE_URL`.  
4. `actualRef === expectedRef` senão **exit 1**.  
5. Production: confirmação explícita.  
6. **Ops rule adicional (recomendada):** no Environment `staging`, **não** definir `PIMO_MIGRATE_ALLOWED_REF` apontando para Production; preferir só `PIMO_SUPABASE_PROJECT_REF_STAGING`.  
7. **Futuro hardening (não nesta tarefa):** recusar runs se `PIMO_MIGRATE_ALLOWED_REF` estiver definido **em simultâneo** com refs por-target distintos (ambiguidade).

### Prova de isolamento (antes do primeiro migrate Staging)

```
[ ] dry-run target=staging com secrets staging → PASS (ref match)
[ ] dry-run target=staging com URL/ref de production (teste negativo controlado) → FAIL REF_MISMATCH
[ ] dry-run target=production sem confirm → FAIL PRODUCTION_CONFIRM_REQUIRED
```

---

## 6. Supabase Project Ref Allowlists

### Definições (valores = TO BE PROVIDED)

| Allowlist | Variável canónica | Valor |
|-----------|-------------------|--------|
| `LOCAL_ALLOWED_PROJECT_REFS` | `PIMO_SUPABASE_PROJECT_REF_LOCAL` | `<TO BE PROVIDED>` (pode ser project local Supabase CLI / branch; ou vazio até existir local DB) |
| `STAGING_ALLOWED_PROJECT_REFS` | `PIMO_SUPABASE_PROJECT_REF_STAGING` | `<TO BE PROVIDED>` — **um** ref Staging |
| `PRODUCTION_ALLOWED_PROJECT_REFS` | `PIMO_SUPABASE_PROJECT_REF_PRODUCTION` | `<TO BE PROVIDED>` — **um** ref Production |

Se no futuro forem necessários múltiplos refs por ambiente, documentar lista explícita; **hoje** o runner espera um ref por target.

### Onde configurar

| Local | Staging allowlist | Production allowlist |
|-------|-------------------|----------------------|
| GitHub Environment `staging` | `PIMO_SUPABASE_PROJECT_REF_STAGING` | **ausente** |
| GitHub Environment `production` | **ausente** | `PIMO_SUPABASE_PROJECT_REF_PRODUCTION` |
| Máquina developer (migrate local→staging) | `.env.staging` gitignored | nunca |
| Password manager / runbook Owner | refs registados | refs registados |

**Não** commit refs sensíveis em docs públicos se a política do Owner for privada; no mínimo: placeholders neste plano.

---

## 7. Migration Runner — validação futura / ops

### Estado código actual (evidência)

`scripts/migrateTargetGuard.mjs` + `applyMigrationsPg.mjs` já exigem:

- target  
- allowlist  
- actual ref  
- match  
- confirm production  

CI: só `workflow_dispatch` + `environment: ${{ inputs.target }}` (sem push main automático).

### Contrato operacional alvo

```
environment (GitHub Environment name)
  + PIMO_MIGRATE_TARGET
  + PIMO_SUPABASE_PROJECT_REF_<TARGET>
  + DATABASE_URL / credentials do MESMO project
  + (production) CONFIRM_PRODUCTION_MIGRATE
  ─────────────────────────────
  → apply all pending migrations in _pimo_schema_migrations
```

### STAGING ≠ PRODUCTION

| | Staging | Production |
|--|---------|------------|
| Trigger | `workflow_dispatch` `target=staging` | `workflow_dispatch` `target=production` |
| Environment | `staging` | `production` (+ required reviewers **TO BE PROVIDED**) |
| Confirm string | não necessária | `I_UNDERSTAND` |
| Ordem | **sempre primeiro** | só após Staging PASS |
| 015 | primeiro aqui | só depois de Staging verificado |

### Nota sobre “015 only”

O runner aplica **todas** as migrations pendentes. Antes de 015 em Staging:

- Confirmar estado da tabela `_pimo_schema_migrations` no Staging.  
- Garantir que 001–014 já estão aplicadas **ou** que o apply conjunto é intencional num projecto novo (bootstrap completo).  
- Projecto Staging **novo**: esperar apply de **toda** a cadeia SQL até 015 inclusive num único run planeado — documentar no log.

---

## 8. Migration 015 — procedimento futuro (NÃO executar agora)

Pré-condição: **STAGING READY** (§17 checklist completa até “Migration 015 ready”).

| # | Passo | Critério de saída |
|---|-------|-------------------|
| 1 | Provision Staging | Project + host + secrets existem |
| 2 | Configure secrets | Environment `staging` preenchido; refs distintos de prod |
| 3 | Validate project identity | dry-run / guard `target=staging` PASS |
| 4 | Validate DB identity | `actualRef` = Staging; teste negativo com prod FAIL |
| 5 | Backup / recovery | Snapshot/backup Supabase Staging **TO BE PROVIDED** (Dashboard backup ou export) |
| 6 | Dry run | `PIMO_MIGRATE_DRY_RUN=1` lista ficheiros; confirma 015 na lista se pendente |
| 7 | Apply 015 (via runner pending set) | Exit 0; 015 registada em `_pimo_schema_migrations` |
| 8 | Verify RLS | Anon SELECT/ALL policies 013 **ausentes** nas tabelas alvo (REST/SQL) |
| 9 | Verify API ACL | Projects/Orders PHP staging: 401 sem JWT; ownership |
| 10 | Verify IDOR | Dois JWT staging: A↛B |
| 11 | Verify industrial access | Anon write/read negado; app soft-fail esperado até BFF |
| 12 | Smoke test | Login JWT staging; rotas críticas; sem K/K |
| 13 | Record result | Relatório `PHASE-1-STAGING-…` actualizado ou novo report; **sem** secrets |

**Impacto conhecido de 015:** DROP POLICY anon — dados preservados; app industrial browser pode perder reads/writes anon até BFF (esperado Phase 1).

**Rollback 015 (Staging):** reaplicar policies 013 **só** se decisão explícita Owner (não automático). Preferir fix forward (BFF / policies authenticated).

---

## 9. GitHub Environments

### Criar (Owner) — não nesta tarefa

| Environment | Propósito | Protections recomendadas |
|-------------|-----------|--------------------------|
| `staging` | Migrations + (futuro) deploy staging | Opcional: limitar who can deploy |
| `production` | Migrations prod + (opcional) amarrar deploy FTP | **Required reviewers** **TO BE PROVIDED** |
| `local` | Só se necessário para CI experimental | Evitar secrets de prod |

### Secrets por Environment (nomes)

**Environment `staging`:**

- `PIMO_SUPABASE_PROJECT_REF_STAGING`  
- `VITE_SUPABASE_URL` (staging)  
- `VITE_SUPABASE_ANON_KEY` (staging)  
- `SUPABASE_PROJECT_REF` (staging)  
- `DATABASE_URL` **ou** `SUPABASE_DB_PASSWORD` (staging)  
- `SUPABASE_SERVICE_ROLE_KEY` (staging) — verify REST  
- (futuro) `FTP_*` staging  

**Environment `production`:**

- `PIMO_SUPABASE_PROJECT_REF_PRODUCTION`  
- `VITE_SUPABASE_URL` / `ANON` / `SUPABASE_PROJECT_REF` / `DATABASE_URL` / service role — **só** prod  
- `FTP_*` (já usados pelo deploy)  

### Migration workflow futuro (já alinhado no YAML actual)

```
manual workflow_dispatch
  + explicit input target
  + GitHub environment == target
  + guard validateMigrateTarget
  ≠ push main → automatic migration
```

---

## 10. Hostinger Staging

### Necessário (não criar agora)

| Item | Valor |
|------|--------|
| Hostname / subdomain | `<TO BE PROVIDED>` (ex. sugestão conceptual `staging.pimo.pro` — **não** assumir DNS) |
| Deployment target (path FTP) | `<TO BE PROVIDED>` |
| Conta FTP / credenciais | `<TO BE PROVIDED>` — SERVER-ONLY |
| `PIMO_APP_ENV` | `staging` |
| `PIMO_JWT_SECRET` | `<TO BE PROVIDED>` ≥32 — **≠** Production |
| `PIMO_INTERNAL_API_SECRET` | `<TO BE PROVIDED>` — alinhado ao mail/staging se aplicável |
| `VITE_API_URL` (build staging) | origin do host staging (ou same-origin) |
| `VITE_PIMO_APP_ENV` | `staging` |
| `VITE_SUPABASE_URL` / `ANON` | **Staging** project only |
| CORS PHP | Incluir origin staging na allowlist (hoje código lista sobretudo `pimo.pro` + localhost em local) — **gap a tratar numa tarefa de implementação futura**; documentado aqui como **REQUIRED FOLLOW-UP** |

### Relação com Production Hostinger

| | Staging | Production |
|--|---------|------------|
| Host | Novo | `pimo.pro` (existente) |
| JWT secret | Distinto | Distinto |
| Users file / data | Separado | Separado |
| Deploy workflow | Novo `deploy-staging.yml` (**NOT IMPLEMENTED**) | `deploy.yml` tags `v*` |

---

## 11. `.env` Loading Order (modelo correcto)

### Problema actual (auditoria)

`applyMigrationsPg.mjs` faz merge:

`.env` → `.env.staging` → `.env.production` → `process.env`

Se `.env.production` existir, **sobrescreve** staging silenciosamente antes do guard (o guard mitiga se allowlists estiverem certas; **não** substitui precedência limpa).

### Modelo alvo (ops + futuro fix de script — **não implementar agora**)

| Contexto | Ficheiros permitidos | Precedência |
|----------|----------------------|-------------|
| LOCAL app (`npm run dev`) | `.env`, `.env.local`, `.env.development` | Vite: mode development; **nunca** carregar `.env.production` no DEV |
| Migrate / script `target=local` | `.env` (+ `.env.local`) apenas | `process.env` ganha |
| Migrate `target=staging` | **só** `.env.staging` (+ process) | **Proibido** ler `.env.production` neste target |
| Migrate `target=production` | **só** `.env.production` (+ process) | Confirmação obrigatória |
| CI | **só** `process.env` do Environment | Sem ficheiros `.env*` no runner |

### PHP (Hostinger)

Variáveis do painel do **host** respectivo. Staging host ≠ Production host. Sem ficheiro `.env` partilhado entre hosts.

### Regra anti-contaminação

```
Nunca: um único .env com credentials de dois ambientes.
Nunca: carregar Production quando o target declarado é Staging.
Sempre: PIMO_MIGRATE_TARGET decide qual ficheiro/Environment é válido.
```

---

## 12. Local Safety

### Impedir LOCAL → PRODUCTION por default

Já no código (Environment Separation):

- Proxy `/api` **off** por default  
- `pimo.pro` bloqueado sem `VITE_ALLOW_DEV_PROXY_PRODUCTION=true`  

### Modelo DX seguro

```
LOCAL default:
  → Vite middleware (materials, K/K)
  → Full Local Development Access
  → Sem Production API
  → Sem Production DATABASE_URL no .env default

LOCAL → STAGING (explícito):
  → VITE_DEV_API_PROXY_TARGET=<staging host>
  → VITE_SUPABASE_* = staging
  → JWT real contra staging

LOCAL → PRODUCTION:
  → só com flags explícitas + justificação
  → proibido como default de onboarding
```

### Developer Experience (preservar)

| Capacidade | Staging provisioning impact |
|------------|------------------------------|
| K/K | Mantém-se LOCAL only |
| Full Development Access | Mantém-se LOCAL only |
| Todas as páginas / permissions UI | Mantém-se |
| Testar ACL real Projects/Orders | Usar Staging JWT (não precisa Production) |
| Testar industrial pós-015 | Staging Supabase |

---

## 13. Developer Experience (resumo)

Staging existe para **validar** segurança e migrations, não para substituir Local full-access.

```
LOCAL  = velocidade + full access + K/K
STAGING = realidade + isolamento + 015 + smoke
PRODUCTION = fail-closed + approval
```

---

## 14. Web / Desktop / Mobile — environment selection

**Não implementar** Desktop/Mobile agora.

| Plataforma | Como selecciona ambiente (modelo) |
|------------|-----------------------------------|
| Web DEV | Vite `DEV` → `local-dev`; proxy/API explícitos |
| Web Staging build | `VITE_PIMO_APP_ENV=staging` + URL staging + Supabase staging |
| Web Production build | `VITE_PIMO_APP_ENV=production` + pimo.pro + Supabase prod |
| Desktop futuro | `runtimePlatform=desktop` + `appEnv=local\|staging\|production` **separados**; config instalada / channel update |
| Mobile futuro | Idem: build flavors `staging` / `production`; sem K/K em stores |

Config remota (URL API + Supabase URL + env name) deve ser **injecção de build/channel**, não hardcoded Production.

---

## 15. Offline (futuro)

Offline Desktop **não** deve depender de Staging nem de Production como única fonte.

Modelo:

```
Desktop Offline
  → Local DB / storage
  → Sync Engine (quando online)
  → Remote API (staging OU production conforme channel)
  → Supabase do ambiente do channel
```

Provisioning Staging **não** introduz acoplamento obrigatório Offline→Staging.  
Dados offline = locais; Staging/Prod só no sync autenticado.

---

## 16. Security Boundaries

| Boundary | Protection |
|----------|------------|
| Local → Staging | Proxy/URL explícitos; secrets staging no `.env` DEV se industrial; sem prod default |
| Local → Production | Bloqueio proxy pimo.pro; flags explícitas; proibir DB prod no `.env` default |
| Staging → Production DB | Allowlist ref + credentials Environment-scoped |
| Staging → Production Supabase | Keys/URL distintos |
| Migration → DB | `validateMigrateTarget` + confirm prod |
| CI → Supabase | `workflow_dispatch` + GitHub Environment |
| Hostinger → Supabase | Build injecta só anon do **mesmo** ambiente do host |
| Frontend → API | JWT; K/K só local-dev; `local-dev-token` rejeitado em ACL |
| Frontend → Supabase anon | RLS; 015 remove open anon; soft-block writes em prod build |
| Desktop/Mobile Prod → Local bypass | Sem `local-dev` runtime; sem K/K |

---

## 17. Provisioning Checklist (executável)

Marcar só com evidência real.

```
[ ] Supabase Staging project created
[ ] Project ref recorded (<TO BE PROVIDED> → valor real fora do git público se necessário)
[ ] Project URL recorded
[ ] Staging DB credentials created (DATABASE_URL / password)
[ ] Staging service role configured (password manager + GH Environment staging)
[ ] Staging anon key configured
[ ] Staging JWT secret configured (Hostinger staging) — distinto de prod
[ ] Staging internal API secret configured
[ ] GitHub Environment "staging" configured
[ ] GitHub staging secrets configured (incl. PIMO_SUPABASE_PROJECT_REF_STAGING)
[ ] GitHub Environment "production" allowlist PIMO_SUPABASE_PROJECT_REF_PRODUCTION configured
[ ] Hostinger staging created (hostname TO BE PROVIDED)
[ ] Hostinger staging env configured (PIMO_APP_ENV=staging, JWT, internal, CORS follow-up)
[ ] Project allowlist configured and tested (positive + negative)
[ ] Migration guard validated (dry-run staging PASS; mismatch FAIL)
[ ] Staging smoke test ready (login JWT, /api health, industrial REST)
[ ] Migration 015 ready (backup + procedimento §8 aceite pelo Owner)
[ ] Confirmed: Staging credentials ≠ Production credentials
[ ] Confirmed: no shared PIMO_MIGRATE_ALLOWED_REF pointing at prod used under target=staging
```

**STAGING READY** = todos os itens acima excepto o último bloco 015 podem estar feitos;  
**Migration 015 READY** = checklist §8 pré-apply completa.

---

## 18. Rollback Strategy

| Falha | Acção |
|-------|--------|
| Failed staging provisioning (project a meio) | Apagar/pausar project Staging **novo**; não tocar Production; recomeçar checklist |
| Incorrect project identity (ref errado nos secrets) | Parar todos os workflows; rodar secrets; dry-run negativo/positivo; **não** migrate |
| Failed migration (SQL error a meio) | Não aplicar “fix” em Production; inspeccionar `_pimo_schema_migrations`; restaurar backup Staging se inconsistente; re-run só após análise |
| Failed RLS verify pós-015 | Não promover a Production; decidir rollback policies 013 **só** com Owner; ou avançar BFF |
| Failed API ACL / IDOR | Bloquear promote; corrigir em branch; re-test Staging |
| Hostinger staging failure | Manter Supabase Staging; corrigir host/DNS/FTP; Production intacta |
| Accidental prod credential in staging env | Rodar **imediatamente** credenciais afectadas; auditar logs de migrate; considerar 015 status em **ambos** os projectos |

---

## 19. Required User Input (Owner)

O Owner / ops deve fornecer ou confirmar (**sem** colocar passwords no repositório):

| Item | Tipo |
|------|------|
| Autorização para criar projecto Supabase Staging (billing/conta) | Decisão |
| Nome do projecto Staging | String |
| Região Supabase | String |
| Project ref + URL após criação | Registo seguro |
| Anon key + service role + DB password Staging | Password manager → GH secrets |
| Confirmação do project ref **Production** (para allowlist prod, sem o usar em staging) | Registo seguro |
| Acesso GitHub: criar Environments `staging` / `production` + reviewers | Permissão org |
| Acesso Hostinger: criar site/subdomain staging + FTP | Permissão |
| Hostname / DNS staging | `<TO BE PROVIDED>` |
| Valores `PIMO_JWT_SECRET` e `PIMO_INTERNAL_API_SECRET` **novos** para staging | Geração Owner |
| Aceite do impacto 015 (industrial anon quebra até BFF) | Decisão de produto |
| Política de backup Staging antes de 015 | Decisão |
| Confirmação de que Production **não** será alvo do primeiro apply 015 | Decisão |

---

## 20. Implementation Order (não executar)

### Até STAGING READY

| Step | Acção |
|------|--------|
| STEP 1 | Owner aprova este plano |
| STEP 2 | Criar Supabase Staging project; registar ref/URL/região |
| STEP 3 | Gerar e guardar secrets Staging (anon, service role, DB) — fora do git |
| STEP 4 | Criar GitHub Environment `staging`; injectar secrets + `PIMO_SUPABASE_PROJECT_REF_STAGING` |
| STEP 5 | Criar/actualizar Environment `production` com `PIMO_SUPABASE_PROJECT_REF_PRODUCTION` (sem partilhar DB staging) |
| STEP 6 | Validar guard: dry-run `target=staging` PASS; mismatch FAIL |
| STEP 7 | (Opcional mas recomendado) Bootstrap migrations 001–014 no Staging **ou** apply cadeia completa num run controlado |
| STEP 8 | Criar Hostinger Staging + DNS; `PIMO_APP_ENV=staging` + JWT/internal |
| STEP 9 | Build/deploy staging (workflow futuro ou manual) com `VITE_PIMO_APP_ENV=staging` + Supabase staging |
| STEP 10 | CORS follow-up se origin staging bloqueado |
| STEP 11 | Smoke JWT + API ACL em Staging |
| STEP 12 | Actualizar runbook Owner: “STAGING READY” com evidências (sem secrets) |

### Até Migration 015 READY / apply Staging

| Step | Acção |
|------|--------|
| STEP 13 | Backup Staging |
| STEP 14 | Dry-run migrate staging; confirmar 015 pendente ou na cadeia |
| STEP 15 | Apply migrations (incl. 015) em Staging via workflow_dispatch |
| STEP 16 | Verify RLS / industrial / ACL / IDOR / smoke (§8) |
| STEP 17 | Registar relatório de verificação Staging |
| STEP 18 | **Só então** planear Production migrate (approval + confirm) — **fora** deste documento de provisioning inicial |

**STOP points:** qualquer falha de identidade → não avançar; nunca “usar prod como staging”.

---

## 21. Estado residual após este plano (ainda NOT READY)

| Item | Estado após **só** este documento |
|------|-------------------------------------|
| Staging infra | Continua **MISSING** até Owner executar STEPs |
| Migration 015 | **NOT READY** / **NOT APPLIED** |
| Production DB | **NOT TOUCHED** |
| Código produto | **NOT MODIFIED** nesta tarefa |
| Hostinger Production env values | **NOT VERIFIED** |
| Desktop / Offline / Mobile | Modelados; **NOT IMPLEMENTED** |

---

## 22. Riscos (resumo)

| Risco | Mitigação neste plano |
|-------|------------------------|
| Staging partilha DB com Production | Project dedicado + allowlists distintas |
| Label staging com secrets prod | Environments separados; ban shared allowlist ops |
| `.env.production` contamina migrate staging | Precedência por target (§11); futuro fix script |
| LOCAL continua a usar Supabase prod | Política: Staging anon em DEV; checklist Owner |
| 015 quebra industrial reads | Esperado; Staging first; BFF depois |
| CORS staging omitido | Follow-up implementação obrigatório |
| Bootstrap Staging aplica muitas SQL de uma vez | Runbook + dry-run + backup |

---

**Documento oficial de provisioning.**  
**Nenhuma infraestrutura criada por esta tarefa.**  
**Nenhuma migration executada.**  
**Nenhum commit/push.**
