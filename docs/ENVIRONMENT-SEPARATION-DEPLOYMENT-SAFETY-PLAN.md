# Environment Separation & Deployment Safety Plan

**Documento:** Fonte oficial para separação LOCAL / STAGING / PRODUCTION  
**Data:** 24 de Agosto de 2026  
**Tipo:** AUDIT + PLANNING (sem implementação nesta tarefa)  
**Contexto:** Phase 0 concluída; Phase 1 code/test OK; Phase 1 **PARTIALLY VERIFIED**; apply 015 em STAGING **bloqueado** por falta de target inequívoco (`docs/PHASE-1-STAGING-VERIFICATION-REPORT.md`)

---

## 0. Documentos de referência lidos

| Pedido | Caminho real |
|--------|----------------|
| Auditoria Auth/Authz | `docs/RELATORIO-AUDITORIA-AUTH-AUTHZ-SUBSCRIPTIONS.md` |
| Spec arquitectura | `docs/SPEC-ARQUITETURA-AUTH-AUTHZ-SUBSCRIPTIONS.md` |
| Phase 0 report | `docs/PHASE-0-IMPLEMENTATION-REPORT.md` |
| Phase 1 plan | **`docs/PHASE-1-API-ACL-IMPLEMENTATION-PLAN.md`** (não existe `PHASE-1-IMPLEMENTATION-PLAN.md`) |
| Phase 1 impl report | `docs/PHASE-1-IMPLEMENTATION-REPORT.md` |
| Phase 1 final verification | `docs/PHASE-1-FINAL-VERIFICATION-REPORT.md` |
| Phase 1 staging verification | `docs/PHASE-1-STAGING-VERIFICATION-REPORT.md` |
| Phase 0 secrets plan | `docs/PLANO-PHASE-0-SECURITY-SECRETS.md` (contexto) |

---

## 1. Environment inventory

| Mechanism | Purpose | Current value / behaviour | Source | Environment | Risk | Recommendation |
|-----------|---------|---------------------------|--------|-------------|------|----------------|
| `PIMO_APP_ENV` | Ambiente PHP (JWT fail-closed, K/K, seed admin) | Valores: `local\|development\|staging\|production\|preview`; **ausente → production** | Hostinger env / `.env.example` | Server PHP | Se ausente em Hostinger → assume production (bom fail-closed); se mal setado → K/K/seed errados | Documentar valor **obrigatório** por host; checklist deploy |
| `import.meta.env.DEV` / `PROD` / `MODE` | Vite client mode | `DEV=true` em `npm run dev`; `PROD=true` em build | Vite | LOCAL vs build | Confundir com `PIMO_APP_ENV` | Manter separados: Vite ≠ PHP env |
| `NODE_ENV` | Node tooling | Usado pontualmente em scripts/core | Node | LOCAL/CI | Polyfills podem mentir no browser (já documentado em projectsApi) | Não usar no cliente para authz |
| `VITE_*` | Bundle browser | Ver §11 | `.env` / CI `.env.production` gerado | Build | Secrets `VITE_` vazam | Só CLIENT-SAFE |
| `.env` | Secrets/local config | **PRESENT** localmente (conteúdo **NOT VERIFIED** / não lido nesta auditoria) | Disco local | LOCAL | Pode apontar para prod Supabase | Nunca assumir staging |
| `.env.local` | Overrides Vite | **MISSING** | — | — | — | Opcional |
| `.env.development` | Vite mode development | **MISSING** | — | — | — | Opcional |
| `.env.production` | Vite production build | **MISSING** local; **gitignored**; CI gera no job | CI `deploy.yml` / `publish.js` | PRODUCTION build | Merge local perigoso se commitado (Phase 0 mitigou tracking) | Só CI ou máquina controlada |
| `.env.staging` | Staging explícito | **MISSING** | — | STAGING | Sem ficheiro → staging não operacionalizado | **Criar** no modelo alvo |
| `.gitignore` | Evitar secrets no git | Ignora `.env`, `.env.production`, etc.; **não** lista `.env.staging` explicitamente (coberto por padrão? **não** — só `.env` exact e alguns) | Repo | All | `.env.staging` **pode ser commitado por engano** se criado | Adicionar `.env.staging` ao gitignore |
| `npm run dev` | LOCAL app | Vite + proxy `/api` → `https://pimo.pro` (exceto materials + auth/dev-local) | `vite.config.ts` | LOCAL → **PRODUCTION API** em muitos requests | Dev fala com **prod Hostinger** por omissão | Proxy staging quando existir; ou local PHP |
| `npm run build` | Artefacto prod | `tsc` + vite + `copyDeployApiToDist` | `package.json` | PRODUCTION-shaped | — | OK |
| `npm run deploy` | Auto commit+push main + release flow | **PERIGOSO** processo | `package.json` | → main | Pode empurrar working tree sujo | Deprecated / restringir |
| `npm run publish` | Version stamp + build flow | `scripts/publish.js` | LOCAL | Pode gerar `.env.production` | Documentado Phase 0 | Evitar secrets em disco versionável |
| GitHub Actions `deploy.yml` | Publish FTP | Trigger: **tags `v*`** | CI | **PRODUCTION** (`pimo.pro`) | Único destino FTP | Ver §5 |
| GitHub Actions `supabase-migrations.yml` | Apply all SQL | Trigger: **push `main`** (paths migrations) + `workflow_dispatch` | CI | **UNKNOWN = provavelmente canónico/prod** | **Alto:** migration → DB sem label staging | Ver §5–6 |
| Hostinger PHP | Auth/API runtime | Env vars no painel (**NOT VERIFIED** remotamente) | Painel Hostinger | PRODUCTION site | `PIMO_APP_ENV` / JWT **NOT VERIFIED** | Smoke Hostinger |
| `supabase/config.toml` | CLI config | `project_id = ""` | Repo | None linked | Sem project CLI linkado | Preencher só em setup staging/local |
| Docker | — | **NOT FOUND** | — | — | — | N/A |
| Branch `staging` | Deploy staging | **NOT FOUND** (branches locais/remotos sem `staging` dedicado nesta inspeção) | Git | — | — | Criar se adoptar modelo dual |

---

## 2. Supabase environments

### Como o projecto “sabe” qual Supabase usar?

| Caminho | Como resolve o projecto |
|---------|-------------------------|
| Frontend industrial | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (bundle) |
| CI deploy build | Secrets GitHub `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` → ficheiro `.env.production` temporário |
| Migrations | `DATABASE_URL` **ou** `SUPABASE_DB_PASSWORD` + ref de `SUPABASE_PROJECT_REF` / URL Vite | `scripts/applyMigrationsPg.mjs` |
| Supabase CLI | `config.toml` `project_id` **vazio** → **não** identifica projecto |

**Conclusão:** Não há abstração “environment → project ref”. O target é **o valor das variáveis no momento da execução**. Sem label STAGING/PRODUCTION no secret, **não é possível provar** qual projecto é.

Project refs concretos: **NOT INVENTED / NOT DISCLOSED** nesta auditoria.

---

## 3. Staging — classificação

| Evidência | Estado |
|-----------|--------|
| Supabase staging project documentado | **NOT CONFIGURED** |
| Hostinger staging host | **STAGING HOST NOT CONFIGURED** |
| GitHub Environment `staging` | **NOT CONFIGURED** (workflows sem `environment:`) |
| Branch `staging` | **NOT CONFIGURED** (nesta inspeção) |
| Secrets `STAGING_*` | **NOT CONFIGURED** no código/workflows |
| URL staging (ex. staging.pimo.pro) | **NOT FOUND** |
| Staging database | **UNKNOWN / NOT CONFIGURED** |
| Staging deployment pipeline | **NOT CONFIGURED** |

### Veredicto STAGING

**NOT CONFIGURED** (conceito mencionado em docs/códigos PHP; **infraestrutura real de staging não evidenciada**).

Menções a “staging” no código (`PIMO_APP_ENV=staging`, textos de planos) = **PARTIAL** apenas como *enum de ambiente PHP*, não como ambiente deployável.

---

## 4. Production — identificação

| Evidência | Estado |
|-----------|--------|
| URL canónica | **CONFIGURED** — `https://pimo.pro` (deploy verify, Vite proxy, `.env.example`) |
| Deploy FTP | **CONFIGURED** — secrets `FTP_*` → `/public_html/` |
| Trigger | **CONFIGURED** — tags `v*` |
| Build injecta `VITE_API_URL=https://pimo.pro` | **CONFIGURED** |
| Supabase prod | **CONFIGURED** via secrets CI (valores **PRESENT** no CI; conteúdo **UNKNOWN** ao agente) |
| `PIMO_APP_ENV` no Hostinger | **UNKNOWN / NOT VERIFIED** |
| `PIMO_JWT_SECRET` Hostinger | **UNKNOWN / NOT VERIFIED** |

Secrets (apenas presença conceptual):

| Secret (nome) | Em CI deploy | Em CI migrations | Classificação |
|---------------|--------------|------------------|---------------|
| `VITE_SUPABASE_URL` | PRESENT | PRESENT | PUBLIC / CLIENT-SAFE |
| `VITE_SUPABASE_ANON_KEY` | PRESENT | PRESENT | CLIENT-SAFE (perigoso com RLS fraco) |
| `SUPABASE_SERVICE_ROLE_KEY` | — | PRESENT (verify REST) | SERVER-ONLY CRITICAL |
| `SUPABASE_DB_PASSWORD` / `DATABASE_URL` | — | PRESENT | SERVER-ONLY CRITICAL |
| `SUPABASE_PROJECT_REF` | — | PRESENT | ENVIRONMENT-SPECIFIC |
| `FTP_HOST/USERNAME/PASSWORD` | PRESENT | — | SERVER-ONLY CRITICAL |
| `PIMO_JWT_SECRET` | **MISSING** no workflow frontend | — | SERVER-ONLY CRITICAL (Hostinger) |
| `PIMO_INTERNAL_API_SECRET` | **MISSING** no workflow (intencional Phase 0) | — | SERVER-ONLY |

---

## 5. GitHub Actions audit

### `deploy.yml` — Publish and Deploy

| Campo | Valor |
|-------|--------|
| Trigger | `push` tags `v*` |
| Branch | N/A (tag) |
| Environment GitHub | **NONE** |
| Secrets | `VITE_SUPABASE_*`, `FTP_*` |
| Deploy target | FTP → `/public_html/` |
| Verify | `https://pimo.pro/assets/...` |
| Supabase | Inject no **build** (anon URL/key) — não corre migrations |
| Risk | **PRODUCTION deploy** inequívoco (URL pimo.pro) |

### `supabase-migrations.yml` — Supabase Industrial Migrations

| Campo | Valor |
|-------|--------|
| Trigger | `push` **main** (paths `supabase/migrations/**`) + `workflow_dispatch` |
| Environment GitHub | **NONE** |
| Secrets | `DATABASE_URL` / `SUPABASE_DB_*` / `VITE_SUPABASE_*` / `SUPABASE_SERVICE_ROLE_KEY` |
| Behaviour | `node scripts/applyMigrationsPg.mjs` → **todas** as migrations pendentes |
| Staging label | **NONE** |
| Production guard | **NONE** |
| Dry-run | **NONE** |

### Riscos CI explícitos

```
DEVELOPER push SQL to main
        ↓
supabase-migrations.yml
        ↓
secrets VITE_SUPABASE_* / DATABASE_*  (sem label)
        ↓
LIKELY CANONICAL / PRODUCTION SUPABASE   ← HIGH RISK
```

```
LOCAL: node scripts/applyMigrationsPg.mjs
        ↓
.env then .env.production then process.env
        ↓
WHATEVER URL/PASSWORD IS IN THOSE FILES  ← HIGH RISK
```

```
npm run dev (Vite proxy)
        ↓
https://pimo.pro /api/*
        ↓
PRODUCTION Hostinger PHP                 ← DEV→PROD coupling
```

**Não** existe workflow evidenciado:

```
STAGING WORKFLOW → STAGING SUPABASE
```

---

## 6. Migration safety (`applyMigrationsPg.mjs`)

| Pergunta | Resposta |
|----------|----------|
| Como escolhe DB? | `DATABASE_URL` ou password + project ref derivado de URL/`SUPABASE_PROJECT_REF` |
| Env files | Carrega `.env` **depois** `.env.production` **depois** `process.env` (env process ganha) |
| Identifica environment? | **NÃO** |
| Safety check / production guard? | **NÃO** |
| Staging guard? | **NÃO** |
| Dry-run? | **NÃO** |
| Confirmation prompt? | **NÃO** |
| Project-ref allowlist? | **NÃO** |
| Aplica só uma migration? | **NÃO** — todas as pendentes em `_pimo_schema_migrations` |
| Pode apontar DB errado? | **SIM** — qualquer credencial válida |

**Implicação para 015:** Correr o script “para aplicar 015” aplica também quaisquer outras migrations SQL ainda não registadas na tabela de tracking — não é “015 only” a menos que todas as anteriores já estejam aplicadas.

---

## 7. Required safety model (recomendado)

Modelo recomendado (compatível com o repo actual):

```
LOCAL (dev machine)
  → código + testes; DB opcional local/staging read-only
  → NUNCA secrets de produção no .env por omissão

STAGING (obrigatório criar)
  → Hostinger staging OU subdomain
  → Supabase project STAGING (separado)
  → Secrets STAGING_* / GitHub Environment "staging"
  → Migrations só aqui primeiro
  → RLS + smoke tests

PRODUCTION (pimo.pro)
  → Tag deploy FTP (já existe)
  → Supabase PRODUCTION
  → Migrations só com: Environment protection + allowlist + aprovação manual
```

Safeguards obrigatórios:

1. **Environment identity** (`PIMO_APP_ENV` + `PIMO_SUPABASE_TARGET=staging|production`)  
2. **Project identity** (ref allowlist por ambiente)  
3. **Explicit allowlist** no script de migrations  
4. **Production confirmation** (`CONFIRM_PRODUCTION_MIGRATE=I_UNDERSTAND` + GitHub Environment approval)  
5. **Migration validation** (dry-run lista ficheiros; apply one-file mode opcional)  

Não é obrigatório Docker; dual-project Supabase + GitHub Environments é o mínimo seguro.

---

## 8. Production guard — opções e recomendação

| Opção | Prós | Contras | Recomendação |
|-------|------|---------|--------------|
| Env var `PIMO_ALLOW_PROD_MIGRATE` | Simples | Fácil de setar por engano | Complementar |
| Project ref allowlist no script | Impede DB errado | Precisa manter lista | **MUST** |
| GitHub Environment `production` + required reviewers | Approval humana | Setup org | **MUST** para prod migrate |
| Separar credentials staging/prod | Isolamento real | Custo 2º projecto | **MUST** |
| Remover auto-migrate on push main | Evita acidentes | Requer workflow_dispatch | **MUST** |
| Dry-run default | Visibilidade | Extra step | SHOULD |

**Recomendação composta:**  
(1) Parar migrate automático em `push main` → só `workflow_dispatch` com input `target=staging|production`.  
(2) Staging: Environment `staging`, secrets `STAGING_*`.  
(3) Production: Environment `production` + reviewers + allowlist + confirmation string.  
(4) Script local: recusar produção sem confirmation; default staging allowlist.

---

## 9. Secrets model (conceptual — sem valores)

### LOCAL

| Secret | Class | Notes |
|--------|-------|-------|
| `PIMO_APP_ENV=local\|development` | ENVIRONMENT-SPECIFIC | Fail-open JWT local material |
| `PIMO_JWT_SECRET` / `_LOCAL` | SERVER-ONLY | Opcional local |
| `VITE_SUPABASE_URL/ANON` | PUBLIC | Prefer **staging** anon, não prod |
| `DATABASE_URL` | SERVER-ONLY CRITICAL | Prefer staging; evitar prod |
| `PIMO_INTERNAL_API_SECRET` | SERVER-ONLY | Só se testar quotes local |

### STAGING (a criar)

| Secret | Class |
|--------|-------|
| `STAGING_SUPABASE_URL` / `ANON` | PUBLIC / CLIENT-SAFE |
| `STAGING_SUPABASE_SERVICE_ROLE_KEY` | SERVER-ONLY CRITICAL |
| `STAGING_DATABASE_URL` ou DB password | SERVER-ONLY CRITICAL |
| `STAGING_SUPABASE_PROJECT_REF` | ENVIRONMENT-SPECIFIC |
| `PIMO_JWT_SECRET` (staging) | SERVER-ONLY CRITICAL |
| `PIMO_INTERNAL_API_SECRET` (staging) | SERVER-ONLY |
| `PIMO_APP_ENV=staging` | ENVIRONMENT-SPECIFIC |
| FTP staging (se houver) | SERVER-ONLY CRITICAL |

### PRODUCTION

| Secret | Class |
|--------|-------|
| `VITE_SUPABASE_URL/ANON` (prod) | PUBLIC |
| `SUPABASE_SERVICE_ROLE_KEY` | SERVER-ONLY CRITICAL |
| `DATABASE_URL` / DB password | SERVER-ONLY CRITICAL |
| `SUPABASE_PROJECT_REF` | ENVIRONMENT-SPECIFIC |
| `FTP_*` | SERVER-ONLY CRITICAL |
| `PIMO_JWT_SECRET` (Hostinger) | SERVER-ONLY CRITICAL |
| `PIMO_INTERNAL_API_SECRET` (Hostinger) | SERVER-ONLY |
| `PIMO_APP_ENV=production` | ENVIRONMENT-SPECIFIC |

**Regra:** Nunca `VITE_` para service role / JWT / DB password / internal API secret.

---

## 10. Hostinger

| Item | Estado |
|------|--------|
| Production host | **CONFIGURED** — `pimo.pro` / FTP `/public_html/` |
| Staging host | **STAGING HOST NOT CONFIGURED** |
| Env vars no painel | **NOT VERIFIED** (fora do repo) |
| Deploy target no código | Production-only no `deploy.yml` |
| PHP sources | `api/`, `hostinger/api/projects/`, stubs `public_html/` |

Não foi acedida configuração externa Hostinger nesta auditoria.

---

## 11. Vite / frontend environment

| Variable | Browser? | Notes |
|----------|----------|-------|
| `VITE_API_URL` | Yes | Pode ser vazio same-origin |
| `VITE_TEXTURES_URL` | Yes | |
| `VITE_SUPABASE_URL` | Yes | |
| `VITE_SUPABASE_ANON_KEY` | Yes | OK só com RLS correcto |
| `VITE_INDUSTRIAL_SUPABASE_DIRECT_WRITES` | Yes | Flag Phase 1 |
| `VITE_ALLOW_LOCAL_DEV_AUTH` | Yes | K/K |
| `VITE_INTERNAL_API_SECRET` | **REMOVED** Phase 0 | Não reinjectar |

CI `deploy.yml` confirma: **não** injecta internal secret no bundle.

---

## 12. Database safety recommendations

| Ameaça | Mitigação |
|--------|-----------|
| Migration DB errado | Allowlist project ref + env target |
| Seed prod | Seeds só `PIMO_APP_ENV=local\|development` (já parcial no PHP auth) |
| Reset prod | Proibir `supabase db reset` remoto; sem script reset no CI |
| Destructive SQL | Review + staging first; 015 é DROP POLICY (não dados) mas impacto operacional |
| Test data prod | Contas/users de teste só staging |
| Staging data → prod | Projetos/DB separados |

---

## 13. Current state diagram

```
Developer laptop
  ├── npm run dev ──Vite──► (proxy) https://pimo.pro /api  ──► Hostinger PRODUCTION PHP
  ├── .env (PRESENT, unlabeled) ──?──► Supabase ??? (UNKNOWN if prod)
  └── applyMigrationsPg.mjs ──► .env / .env.production / CI secrets ──► Supabase ??? 

Git (main / tags)
  │
  ├─ push main + supabase/migrations/**
  │     └─► GitHub Action migrations ──► secrets (unlabeled) ──► Supabase CANÓNICO (likely PROD)
  │
  └─ push tag v*
        └─► GitHub Action deploy
              ├─ build with VITE_* secrets
              └─ FTP ──► Hostinger PRODUCTION (pimo.pro/public_html)

STAGING lane:  ═══════════════ DOES NOT EXIST ═══════════════
```

**Onde existe separação:**  
- Vite DEV vs PROD build (`import.meta.env`)  
- PHP `PIMO_APP_ENV` (conceito; Hostinger value **NOT VERIFIED**)  
- Phase 0: K/K só local/dev  

**Onde NÃO existe:**  
- Supabase staging vs prod  
- Hostinger staging  
- GitHub Environments  
- Migration target guards  

---

## 14. Target state diagram

```
LOCAL
  ├── Vite DEV
  ├── PIMO_APP_ENV=local|development
  ├── optional: STAGING anon for industrial reads
  └── NO prod DB password in default .env

        │  PR / merge
        ▼
STAGING  (GitHub Environment: staging — required)
  ├── Deploy → staging host (new) OR preview
  ├── PIMO_APP_ENV=staging
  ├── Secrets STAGING_* only
  ├── Supabase STAGING project (dedicated)
  ├── Migrations: workflow_dispatch target=staging
  ├── Apply 015 HERE first
  └── RLS + HTTP smoke + IDOR tests

        │  manual approval (GitHub Environment: production)
        ▼
PRODUCTION
  ├── Tag v* → FTP → pimo.pro (existing)
  ├── PIMO_APP_ENV=production
  ├── Secrets PRODUCTION_* / existing FTP + Supabase prod
  ├── Migrations: workflow_dispatch target=production
  │     + CONFIRM_PRODUCTION_MIGRATE
  │     + project ref allowlist
  │     + required reviewers
  └── No auto-migrate on push main
```

---

## 15. File-by-file impact (proposed — **DO NOT IMPLEMENT NOW**)

| PATH | PURPOSE | CURRENT | PROPOSED CHANGE | RISK | DEPS | PHASE |
|------|---------|---------|-----------------|------|------|-------|
| `scripts/applyMigrationsPg.mjs` | Apply SQL | No env guard | Target + allowlist + confirm + optional single-file | Médio | Secrets model | ENV-SEP |
| `.github/workflows/supabase-migrations.yml` | CI migrate | Auto on main | `workflow_dispatch` + environments | Alto se mal feito | GH Environments | ENV-SEP |
| `.github/workflows/deploy.yml` | Prod FTP | OK prod | Opcional: `environment: production` | Baixo | — | ENV-SEP |
| `.github/workflows/deploy-staging.yml` | NEW | Missing | Staging deploy | Médio | Staging host | ENV-SEP |
| `.env.example` | Docs | Sem staging block | Secções LOCAL/STAGING/PROD | Baixo | — | ENV-SEP |
| `.gitignore` | Secrets | Sem `.env.staging` | Ignorar `.env.staging` | Baixo | — | ENV-SEP |
| `docs/ENVIRONMENTS.md` | NEW runbook | Missing | Refs + checklists (sem secrets) | Baixo | Ops | ENV-SEP |
| Hostinger panel | PHP env | NOT VERIFIED | Set `PIMO_APP_ENV`, JWT, internal | Alto ops | Access | OPS |
| Supabase dashboard | Projects | Single unlabeled | Create staging project | Custo/ops | Billing | OPS |
| `vite.config.ts` | Dev proxy | → pimo.pro | Proxy staging URL quando `PIMO_DEV_API_TARGET=staging` | Médio | Staging host | ENV-SEP |
| `package.json` `deploy` | Auto push | Perigoso | Remover ou exigir flag | Processo | — | ENV-SEP |

---

## 16. Implementation plan (multi-agent executable)

### Agent rules (obrigatório)

Nenhum agente pode:

- Escolher Supabase project por guessing  
- Usar credentials production em staging (ou o inverso)  
- Aplicar migrations sem target verification + allowlist  
- Modificar secrets sem autorização humana  
- Production deploy/migrate sem approval  
- Destructive DB ops (`reset`, `DROP TABLE`, delete data)  
- Apagar/alterar trabalho pré-existente alheio  
- `git reset` / force push / history rewrite  

---

### ENV-SEP-001 — Document environment matrix  
- **OBJECTIVE:** Runbook oficial LOCAL/STAGING/PROD  
- **PRECONDITIONS:** Este plano aprovado  
- **FILES:** `docs/ENVIRONMENTS.md` (NEW)  
- **IMPLEMENTATION:** Tabela de URLs, refs (placeholders), secrets names, owners  
- **SECURITY:** Sem valores secretos  
- **TESTS:** Review humano  
- **ACCEPTANCE:** Matriz completa; staging marcado MISSING até existir  
- **DEPENDENCIES:** None  
- **ROLLBACK:** Delete doc  
- **STATUS:** pending  

### ENV-SEP-002 — Gitignore staging env  
- **OBJECTIVE:** Impedir commit `.env.staging`  
- **FILES:** `.gitignore`  
- **ACCEPTANCE:** `git check-ignore .env.staging`  
- **STATUS:** pending  

### ENV-SEP-003 — Create Supabase STAGING project (OPS humano)  
- **OBJECTIVE:** Projecto físico separado  
- **PRECONDITIONS:** Aprovação billing/ops  
- **FILES:** N/A (dashboard)  
- **IMPLEMENTATION:** Criar project; anotar ref em `ENVIRONMENTS.md`  
- **SECURITY:** Credenciais só em GitHub Environment staging  
- **ACCEPTANCE:** Ref staging ≠ ref production  
- **STATUS:** pending — **REQUIRES HUMAN**  

### ENV-SEP-004 — GitHub Environments + secrets split  
- **OBJECTIVE:** `staging` e `production` com secrets separados  
- **PRECONDITIONS:** ENV-SEP-003  
- **IMPLEMENTATION:** Environments + required reviewers em production  
- **ACCEPTANCE:** Workflow não corre prod migrate sem approval  
- **STATUS:** pending — **REQUIRES HUMAN/ADMIN**  

### ENV-SEP-005 — Harden `applyMigrationsPg.mjs`  
- **OBJECTIVE:** Guards de target  
- **PRECONDITIONS:** Allowlist refs conhecidos  
- **IMPLEMENTATION:**  
  - Require `PIMO_MIGRATE_TARGET=staging|production`  
  - Resolve expected project ref from allowlist  
  - Abort se URL/ref ≠ expected  
  - Production requires `CONFIRM_PRODUCTION_MIGRATE=I_UNDERSTAND`  
  - Optional `--file=015_...sql` only mode  
  - Dry-run prints pending files  
- **TESTS:** Unit tests for guard logic with fake env  
- **ACCEPTANCE:** Sem target → exit 1; wrong ref → exit 1  
- **DEPENDENCIES:** ENV-SEP-001  
- **ROLLBACK:** Reverter script  
- **STATUS:** pending  

### ENV-SEP-006 — Rewrite migrations workflow  
- **OBJECTIVE:** Sem auto-apply em push main  
- **FILES:** `supabase-migrations.yml`  
- **IMPLEMENTATION:** `workflow_dispatch` inputs `target`; map secrets; call hardened script  
- **ACCEPTANCE:** Push main **não** migra  
- **DEPENDENCIES:** ENV-SEP-004, ENV-SEP-005  
- **STATUS:** pending  

### ENV-SEP-007 — Staging Hostinger / URL (OPS)  
- **OBJECTIVE:** Host HTTP staging  
- **ACCEPTANCE:** URL documentada; `PIMO_APP_ENV=staging`  
- **STATUS:** pending — **REQUIRES HUMAN**  
- **ALTERNATIVE:** Se impossível short-term → usar só Supabase staging + testes REST/SQL sem host app (parcial)  

### ENV-SEP-008 — Apply migration 015 on STAGING  
- **OBJECTIVE:** Fechar anon RLS bypass em staging  
- **PRECONDITIONS:** ENV-SEP-003..006 + checklist §18  
- **IMPLEMENTATION:** Dispatch target=staging; verify policies  
- **ACCEPTANCE:** Anon SELECT/INSERT falham nas 11 tabelas; service role OK  
- **STATUS:** pending  

### ENV-SEP-009 — Hostinger production smoke  
- **OBJECTIVE:** Validar Phase 1 ACL em pimo.pro  
- **PRECONDITIONS:** Deploy com authz; JWT secret set  
- **STATUS:** pending  

### ENV-SEP-010 — Production apply 015 (later)  
- **OBJECTIVE:** Fechar bypass prod  
- **PRECONDITIONS:** Staging verified + approval  
- **STATUS:** pending — **DO NOT** before staging  

---

## 17. Multi-agent safety (summary)

Ver §16 Agent rules. Adicionar ao plano de qualquer agente futuro:

1. Ler este documento  
2. Verificar `PIMO_MIGRATE_TARGET` + allowlist  
3. Recusar produção sem confirmation string + GH approval  
4. Não inventar project refs  

---

## 18. Migration 015 — unblock checklist

```text
[ ] Staging Supabase project exists
[ ] Project ref documented (ENVIRONMENTS.md) — distinct from production
[ ] Staging DB credentials configured (GitHub Environment staging / .env.staging gitignored)
[ ] Staging environment identifiable (PIMO_MIGRATE_TARGET=staging + allowlist)
[ ] Migration target guard exists (ENV-SEP-005 implemented)
[ ] Migration 015 validated (static review already: DROP POLICY IF EXISTS only — non-data-destructive)
[ ] Backup/rollback understood (re-create anon policies from 013 if needed; prefer forward-fix)
[ ] Staging migration approved (human)
[ ] Post-migration RLS tests ready (anon REST deny; service role allow)
[ ] Confirm prior migrations already applied on staging (_pimo_schema_migrations) OR accept full pending apply
```

**Hoje (24-08-2026):** quase todos os itens **unchecked** → **não é seguro aplicar 015**.

---

## 19. Hostinger smoke test — prerequisites (later)

Não executar agora. Dados necessários (sem credentials no doc):

```text
[ ] Base URL (ex.: https://pimo.pro) — CONFIRMED candidate
[ ] Confirm PIMO_APP_ENV=production on host — NOT VERIFIED
[ ] JWT: contas de teste User A / User B / admin (não K/K)
[ ] Login real → token Bearer
[ ] Protected API: GET /api/auth/me
[ ] Projects API: list/load sem token → 401
[ ] Projects IDOR: A → B → 404
[ ] Admin: anonymous / normal / admin
[ ] Industrial orders: 401/403/200 matrix
[ ] Supabase: anon curl vs tabelas 013 (pré/pós 015)
[ ] K/K rejected on production login + /auth/dev-local
[ ] Authz library loaded (não 503)
[ ] Error responses sem stack traces
```

---

## 20. Risk matrix

| Risk | Severity | Probability | Impact | Mitigation |
|------|----------|-------------|--------|------------|
| Production migration accident via push main | **Critical** | **High** | RLS/ops break / wrong DB | ENV-SEP-006; remove auto migrate |
| Wrong Supabase project via local `.env` | **Critical** | **High** | Data exposure / outage | Allowlist; no prod password in local default |
| Staging/production confusion | **Critical** | **High** | Apply 015 to prod believing staging | Dedicated staging project + labels |
| Secret leakage (`VITE_` / tracked env) | **High** | Medium | Token theft | Phase 0 hygiene; rotate after RLS |
| CI FTP → wrong host | **High** | Low | Wipe/wrong site | Document FTP_HOST; GH Environment production |
| Dev proxy → prod API | **Medium** | **High** | Accidental writes to prod projects | Proxy to staging; or local PHP |
| `npm run deploy` dirty tree | **Medium** | Medium | Bad commit | Remove/restrict script |
| Apply all pending migrations when intending only 015 | **High** | Medium | Unexpected schema changes | Single-file mode |
| 015 without BFF breaks industrial UI | **Medium** | **High** after apply | Ops disruption | Soft-fail writes; staging first; communicate |

---

## 21. Final recommendations (Q&A)

1. **Existe atualmente um STAGING real?**  
   **NÃO** (infra **NOT CONFIGURED**).

2. **Existe um Supabase STAGING identificado?**  
   **NÃO** / **NOT VERIFIED** como projecto separado.

3. **Existe separação segura staging vs production?**  
   **NÃO.**

4. **É seguro aplicar 015 hoje?**  
   **NÃO.**

5. **O que falta para ser seguro?**  
   Projecto Supabase staging + credentials isoladas + guards no script + workflow sem auto-main + checklist §18 + aprovação humana.

6. **Devemos criar um Supabase staging project?**  
   **SIM** — recomendação forte (único isolamento real de DB).

7. **Modelo final?**  
   LOCAL → STAGING (migrate + verify) → PRODUCTION (tag deploy + migrate só com approval). Dual Supabase + GitHub Environments + allowlist.

8. **Ordem de implementação?**  
   ENV-SEP-001 → 002 → 003 (ops) → 004 (ops) → 005 → 006 → 007 → **008 (015 staging)** → 009 (Hostinger smoke) → 010 (015 prod).

---

## 22. Relation to Phase 1 / Phase 2

| Item | Estado |
|------|--------|
| Phase 1 code/test | OK (local) |
| Phase 1 security verified | **PARTIAL** até staging 015 + Hostinger smoke |
| Phase 2 Auth Hardening | **NÃO iniciar** como substituto desta separação; pode planear-se em paralelo **depois** ENV-SEP-001..006 se desejado, mas **015 staging primeiro** para fechar P0 RLS |

---

## 23. What this audit did NOT do

- Não leu nem imprimiu secrets  
- Não aplicou migrations  
- Não alterou GitHub / Hostinger / Supabase  
- Não criou projectos  
- Não commit/push  
- Não implementou o plano  

---

*Fim do plano oficial — Environment Separation & Deployment Safety. STOP até instrução humana.*
