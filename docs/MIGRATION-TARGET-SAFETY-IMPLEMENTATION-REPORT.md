# Migration Target Safety — Implementation Report

**Data:** 25 de Agosto de 2026  
**Tipo:** IMPLEMENTAÇÃO (guard fail-closed) — **ZERO** operações remotas de DB  
**Refs canónicas:**

```text
STAGING REF:
rszpnvmscehqapflaklv

PRODUCTION REF:
ritmrjwrmcsofyugviil
```

---

## 1. Current migration architecture

```text
GitHub workflow_dispatch (target)
        │
        ▼
GitHub Environment = target (staging|production|local)
        │
        ▼
scripts/migrateEnv.mjs          → carrega .env + ficheiro do target (sem misturar prod em staging)
        │
        ▼
scripts/migrateTargetGuard.mjs  → allowlist canónica + consenso de identidade + confirm prod
        │
        ▼
scripts/applyMigrationsPg.mjs   → Postgres apply (só se guard PASS)
   ou validateIndustrialMetadata.mjs
   ou applySupabaseMigrations.mjs (CLI)
   ou regenerateIndustrialWorkOrderNqr.mjs
```

Tracking: `public._pimo_schema_migrations` (runner PG).

---

## 2. Runners audited

| Runner | Antes | Depois |
|--------|-------|--------|
| `scripts/applyMigrationsPg.mjs` | Guard fraco + allowlist env flexível; side-effect no import | Guard canónico; `main()` só em execução directa; env por target |
| `scripts/applySupabaseMigrations.mjs` | **Sem** guard | Mesmo guard + link só ao ref validado |
| `scripts/validateIndustrialMetadata.mjs` | **Sem** guard; importava apply (risco side-effect); load `.env.production` sempre | Guard + `loadMigrateEnv`; liga via `migratePgConnection.mjs` |
| `scripts/regenerateIndustrialWorkOrderNqr.mjs` | Sem guard; default path prod | Guard + `loadMigrateEnv` |
| `scripts/migratePgConnection.mjs` | — | **Novo** — ligação PG sem apply |
| `scripts/migrateEnv.mjs` | — | **Novo** — precedência segura de `.env*` |
| Workflow `supabase-migrations.yml` | Dispatch + environment | + job `guard-inputs`; refs canónicas injectadas; sem `PIMO_MIGRATE_ALLOWED_REF` partilhável |

---

## 3. Target identity model

| Target | Identificação | Expected ref |
|--------|---------------|--------------|
| `local` | `PIMO_MIGRATE_TARGET=local` + `PIMO_SUPABASE_PROJECT_REF_LOCAL` | Ref local dedicado (**proibido** = staging/prod canónicos) |
| `staging` | `PIMO_MIGRATE_TARGET=staging` | **Sempre** `rszpnvmscehqapflaklv` |
| `production` | `PIMO_MIGRATE_TARGET=production` + `CONFIRM_PRODUCTION_MIGRATE=I_UNDERSTAND` | **Sempre** `ritmrjwrmcsofyugviil` |

Actual ref = consenso de:

- `SUPABASE_PROJECT_REF`
- `VITE_SUPABASE_URL` / `SUPABASE_URL`
- `DATABASE_URL` (host `db.<ref>.supabase.co` ou `postgres.<ref>@`)

Qualquer divergência → `INCONSISTENT_IDENTITY` → STOP.

---

## 4. Allowlist

Hardcoded em `scripts/migrateTargetGuard.mjs`:

| Ambiente | Project Ref | URL canónica |
|----------|-------------|--------------|
| STAGING | `rszpnvmscehqapflaklv` | `https://rszpnvmscehqapflaklv.supabase.co` |
| PRODUCTION | `ritmrjwrmcsofyugviil` | `https://ritmrjwrmcsofyugviil.supabase.co` |

- Sem wildcards.  
- Sem inferir production “porque existe URL”.  
- Se `PIMO_SUPABASE_PROJECT_REF_STAGING` / `_PRODUCTION` / `PIMO_MIGRATE_ALLOWED_REF` estiver definido e **diferir** da allowlist → `ENV_ALLOWLIST_CONFLICT`.

---

## 5. Production protection

1. Expected ref fixo = `ritmrjwrmcsofyugviil`  
2. `CONFIRM_PRODUCTION_MIGRATE=I_UNDERSTAND` obrigatório  
3. Workflow job `guard-inputs` falha cedo se `confirm_production != I_UNDERSTAND`  
4. GitHub `environment: production` (requer configuração externa de reviewers)

---

## 6. Staging protection

1. Expected ref fixo = `rszpnvmscehqapflaklv`  
2. `TARGET=staging` + ref production → `REF_MISMATCH`  
3. URL production com target staging → `URL_REF_MISMATCH` / inconsistência  
4. `.env.production` **não** é carregado quando target=staging

---

## 7. GitHub workflow changes

Ficheiro: `.github/workflows/supabase-migrations.yml`

- Continua **sem** trigger `push` main  
- Job `guard-inputs` (confirmação production)  
- Job `migrate` com `environment: ${{ inputs.target }}`  
- Injecta refs canónicos como env (não secrets)  
- Remove dependência de `PIMO_MIGRATE_ALLOWED_REF` no workflow  
- REST verify imprime só host da URL (não keys)

**Não** criados Environments/secrets nesta tarefa.

---

## 8. Secrets model (nomes only)

| Variável | staging Environment | production Environment | local |
|----------|---------------------|------------------------|-------|
| `DATABASE_URL` | Staging only | Production only | Local/dedicated |
| `SUPABASE_DB_PASSWORD` | Staging | Production | Local |
| `VITE_SUPABASE_URL` | `https://rszpnvmscehqapflaklv.supabase.co` | `https://ritmrjwrmcsofyugviil.supabase.co` | Local URL |
| `SUPABASE_PROJECT_REF` | `rszpnvmscehqapflaklv` | `ritmrjwrmcsofyugviil` | Local ref |
| `VITE_SUPABASE_ANON_KEY` | Staging | Production | Local |
| `SUPABASE_SERVICE_ROLE_KEY` | Staging | Production | — |
| `PIMO_SUPABASE_PROJECT_REF_LOCAL` | — | — | Required for target=local |
| `CONFIRM_PRODUCTION_MIGRATE` | — | Input `I_UNDERSTAND` | — |

Valores reais: **fora do repository**.

---

## 9. Tests

`src/core/environment/migrateTargetGuard.test.ts` — casos A–J + extras.

| Resultado | Valor |
|-----------|--------|
| migrateTargetGuard + pimoEnvironment | **26 PASS** |
| `tsc -b` | **FAIL** (exit 2) — erros pré-existentes em cutlayout/`shortCode`, `EtiquetaDesignerPage` — **não** introduzidos por esta tarefa |
| `npm run build` | **FAIL** (exit 2) — bloqueado pelo mesmo `tsc -b` pré-existente |

Sem testes de ligação remota. Sem impacto do guard nestes erros TS.

---

## 10. Files changed (esta tarefa)

- `scripts/migrateTargetGuard.mjs` — allowlist canónica + consenso + redact  
- `scripts/migrateEnv.mjs` — **novo**  
- `scripts/migratePgConnection.mjs` — **novo**  
- `scripts/applyMigrationsPg.mjs` — refactor + guard  
- `scripts/applySupabaseMigrations.mjs` — guard  
- `scripts/validateIndustrialMetadata.mjs` — guard  
- `scripts/regenerateIndustrialWorkOrderNqr.mjs` — guard  
- `.github/workflows/supabase-migrations.yml` — endurecido  
- `src/core/environment/migrateTargetGuard.test.ts` — reescrito  
- `.env.example` — docs allowlist  
- `docs/MIGRATION-TARGET-SAFETY-IMPLEMENTATION-REPORT.md` — este relatório  

---

## 11. Files intentionally not changed

- `supabase/migrations/**` (incl. 015)  
- Secrets GitHub / Hostinger  
- Código de produto React/PHP authz  
- Documentos de auditoria anteriores  

---

## 12. What was NOT executed

- `applyMigrationsPg` contra DB remota  
- `applySupabaseMigrations` / `db push`  
- `validateIndustrialMetadata` remoto  
- Migration 015  
- Qualquer SQL Supabase  
- Acesso Staging DB  
- Acesso Production DB  
- Commit / push  

---

## 13. Remaining external configuration

```text
[ ] GitHub Environment "staging" com secrets só de rszpnvmscehqapflaklv
[ ] GitHub Environment "production" com secrets só de ritmrjwrmcsofyugviil + reviewers
[ ] Remover/evitar DATABASE_URL de production ao nível repo se conflitar com Environment staging
[ ] .env.staging local (gitignored) para developers — sem credentials de prod
```

---

## 14. Next safe step

1. Configurar GitHub Environments + secrets isolados.  
2. Dry-run: `workflow_dispatch` `target=staging` `dry_run=true`.  
3. Com aprovação explícita: apply cadeia completa em **Staging only**.  
4. **Não** Production neste ciclo.

---

## Verdicts desta tarefa

```text
TARGET GUARD: PASS
STAGING PROTECTION: PASS
PRODUCTION PROTECTION: PASS
MIGRATION EXECUTION: NOT EXECUTED
REMOTE DATABASE ACCESS: NOT EXECUTED
PRODUCTION TOUCHED: NO
STAGING TOUCHED: NO
```

STOP — nenhuma migration foi executada.  
Aguardar autorização explícita para a próxima fase.
