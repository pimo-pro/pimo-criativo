# STAGING MIGRATION READINESS AUDIT

**Data:** 25 de Agosto de 2026  
**Tipo:** AUDIT READ-ONLY — nenhuma migration executada; nenhuma alteração de DB/secrets/código (exceto este relatório)  
**Referência de ambientes (não configurados nesta tarefa):**

| Ambiente | Project | Ref |
|----------|---------|-----|
| **STAGING** | PIMO-Staging | `rszpnvmscehqapflaklv` |
| **PRODUCTION** | pimo-industrial | `ritmrjwrmcsofyugviil` |

**URL Staging (referência):** `https://rszpnvmscehqapflaklv.supabase.co`  
**Premissa:** Staging = projecto Supabase novo / DB vazia de schema app (schema `auth` nativo Supabase presente).

---

## 1. Migration Inventory

### 1.1 Ordem de apply efectiva

O runner oficial `scripts/applyMigrationsPg.mjs` aplica **todos** os `*.sql` em `supabase/migrations/` com:

```text
fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()
```

Ordem **lexicográfica** (27 ficheiros):

| # | Filename | Classe |
|---|----------|--------|
| 1 | `000_profiles_bootstrap.sql` | Numerada |
| 2 | `001_create_base_tables.sql` | Numerada |
| 3 | `001_diagnostic_check.sql` | Numerada (duplicado prefixo `001`) |
| 4 | `002_full_repair.sql` | Numerada |
| 5 | `003_profiles_roles.sql` | Numerada |
| 6 | `004_rls_roles_policies.sql` | Numerada |
| 7 | `005_permission_change_logs.sql` | Numerada |
| 8 | `006_rls_permission_change_logs.sql` | Numerada |
| 9 | `007_fk_work_order_tasks_work_orders.sql` | Numerada |
| 10 | `008_work_orders_order_number_if_missing.sql` | Numerada |
| 11 | `009_industrial_piece_persistence.sql` | Numerada |
| 12 | `010_industrial_work_orders.sql` | Numerada |
| 13 | `011_restore_public_users.sql` | Numerada (duplicado prefixo `011`) |
| 14 | `011_system_settings.sql` | Numerada |
| 15 | `012_industrial_aliases.sql` | Numerada |
| 16 | `013_industrial_anon_rls.sql` | Numerada |
| 17 | `014_industrial_work_order_tasks_view.sql` | Numerada |
| 18 | `015_revoke_industrial_anon_write.sql` | Numerada |
| 19 | `add_departments_columns.sql` | Sem prefixo (após 015) |
| 20 | `add_profiles_is_active.sql` | Sem prefixo |
| 21 | `create_event_log_tables.sql` | Sem prefixo |
| 22 | `create_metrics_tables.sql` | Sem prefixo |
| 23 | `create_notifications_table.sql` | Sem prefixo |
| 24 | `create_quality_tables.sql` | Sem prefixo |
| 25 | `create_system_events_table.sql` | Sem prefixo |
| 26 | `create_work_order_events.sql` | Sem prefixo |
| 27 | `create_workflow_tables.sql` | Sem prefixo |

**Primeira migration (apply):** `000_profiles_bootstrap.sql`  
**Última migration (apply):** `create_workflow_tables.sql`  
**Última numerada “015”:** `015_revoke_industrial_anon_write.sql` (posição 18/27)

### 1.2 Grupo 001–014 vs 015

| Grupo | Ficheiros |
|-------|-----------|
| Bootstrap + base | `000`, `001_create_base_tables`, `001_diagnostic_check`, `002`–`008` |
| Industrial core | `009`, `010`, `011_restore_public_users`, `011_system_settings`, `012`, `013`, `014` |
| Harden anon | `015` |
| Legado / overlap pós-015 | `add_*`, `create_*` |

### 1.3 Resumo por ficheiro

| File | Purpose | Tables / views / funcs | RLS / policies | Seeds | Notes |
|------|---------|------------------------|----------------|-------|-------|
| `000_profiles_bootstrap` | `profiles` + RLS auth | `profiles` | ENABLE + 3 policies authenticated | — | Essencial antes de `002` |
| `001_create_base_tables` | Domínio legado WO | `departments`, `work_orders`, `work_order_tasks`, `task_status_history` | RLS + policies authenticated; GRANTs | — | FK → `auth.users` |
| `001_diagnostic_check` | Diagnóstico | — (só SELECT) | — | — | Não altera schema |
| `002_full_repair` | Repair idempotente amplo | + statuses/transitions/rules/events/quality/`system_events`; `is_admin_or_manager()` | Muitas policies | 3 statuses (`ON CONFLICT DO NOTHING`) | Depende de `profiles` |
| `003_profiles_roles` | Cols role/dept | ALTER `profiles` | — | — | Idempotente |
| `004_rls_roles_policies` | Policies por role | — | Novas policies work_orders/tasks/departments | — | Parcialmente não-idempotente |
| `005_permission_change_logs` | Audit permissões | `permission_change_logs` | — | — | FK → `profiles` |
| `006_rls_permission_change_logs` | RLS admin logs | — | 2 policies | — | |
| `007_fk_work_order_tasks_work_orders` | Renomeia FK PostgREST | CONSTRAINT | — | — | **Não idempotente** no re-apply |
| `008_work_orders_order_number_if_missing` | Coluna order_number | ALTER | — | — | |
| `009_industrial_piece_persistence` | Peças industriais | 6× `industrial_piece_*` | authenticated read/write | — | |
| `010_industrial_work_orders` | WO industriais | `industrial_work_orders`, `_tasks`, `_events` | authenticated | — | |
| `011_restore_public_users` | `public.users` | `users` | `users_select_all` / `users_insert_all` (anon+authenticated) | user `pimo-trak-industrial@pimo.pro` | NOTIFY pgrst |
| `011_system_settings` | KV settings | `system_settings` | authenticated | — | |
| `012_industrial_aliases` | Views alias | 7 views | GRANT SELECT anon+authenticated | — | |
| `013_industrial_anon_rls` | Abre anon R/W | — | `"anon read/write <tbl>"` ×11 tables | — | P0 até 015 |
| `014_industrial_work_order_tasks_view` | View tracking | `industrial_work_order_tasks_view`; redefine `industrial_tracking` | GRANT SELECT | — | |
| `015_revoke_industrial_anon_write` | Revoga anon 013 | — | DROP POLICY IF EXISTS ×22 | — | Sem dados destruídos |
| `add_departments_columns` | Cols + `is_admin()` | ALTER + function | policies admin | — | Após 015 |
| `add_profiles_is_active` | `is_active` | ALTER | — | — | Já em `000` |
| `create_event_log_tables` | `system_events` (overlap 002) | table | policies | — | |
| `create_metrics_tables` | Métricas | 3 tables | policies **sem DROP** | — | Re-apply frágil |
| `create_notifications_table` | Notificações | table + funcs + trigger | policies | — | FK `auth.users` |
| `create_quality_tables` | Quality (overlap 002) | tables | policies | seed comentado | Precisa `is_admin_or_manager` |
| `create_system_events_table` | Events + audit triggers | funcs/triggers | policies **sem DROP** | — | **Risco runtime** `NEW.name` em tasks |
| `create_work_order_events` | Events WO | table | policies | — | Overlap 002 |
| `create_workflow_tables` | Workflow genérico | `workflow_*` | policies **sem DROP** | — | |

### 1.4 Extensões / Storage

| Item | Achado |
|------|--------|
| `CREATE EXTENSION` | **Não encontrado** nas migrations (usa `gen_random_uuid()` — disponível no Supabase) |
| Storage buckets / `storage.*` | **Não encontrado** |
| Edge Functions | **Não** nas migrations SQL |

---

## 2. Dependency Graph

```text
auth.users (Supabase built-in)
    │
    ├── 001_create_base_tables ──► departments, work_orders, work_order_tasks, task_status_history
    │         │
    │         └── 007 FK rename (work_order_tasks → work_orders)
    │         └── 008 order_number
    │
000 profiles ──► 002 (is_admin_or_manager) ──► quality/statuses/events/system_events
    │                 │
    ├── 003 cols
    ├── 005/006 permission_change_logs
    └── (add_*/create_workflow FKs profiles)

009 industrial_piece_* ──┐
010 industrial_work_*  ──┼──► 012 views ──► 014 view/tracking override
011_system_settings ───┘         │
011_restore public.users (seed)  │
                                 ▼
                         013 anon policies
                                 ▼
                         015 DROP anon policies

create_* / add_* (lex after 015) ──► overlap / métricas / notifications / workflow
                                      create_quality depende de 002 (já aplicado)
```

**Duplicados de prefixo (ordem lex resolve):**

- `001_create_base_tables` → depois `001_diagnostic_check`  
- `011_restore_public_users` → depois `011_system_settings`

**015 depende de objectos 001–014?**

- Depende das **tabelas** listadas (criadas em `002`/`009`/`010`/`011_system_settings`).  
- Depende das **policies** de `013` apenas logicamente; SQL usa `DROP POLICY IF EXISTS` → seguro se 013 não tiver corrido.  
- **Não** depende de dados em linhas.

---

## 3. Empty Database Compatibility

### Pode uma DB Supabase vazia (app) ser inicializada com a cadeia completa?

**SIM**, com condições:

| Condição | Estado |
|----------|--------|
| Projecto Supabase real (schema `auth` + `auth.users`) | **Obrigatório** — não Postgres nu |
| Apply na ordem lex do runner | **Obrigatório** |
| Credenciais Postgres / `DATABASE_URL` do **Staging** | **Obrigatório** (ops) |
| Guard `PIMO_MIGRATE_TARGET=staging` + allowlist `rszpnvmscehqapflaklv` | **Obrigatório** (ops) |

### Expectativa após apply completo (vazio → schema)

- Tracking table `public._pimo_schema_migrations` com 27 filenames  
- Tabelas industriais + legado + views exigidas pelo pós-check do script  
- Seed user industrial em `public.users`  
- Estado RLS industrial: **sem** policies anon 013 (revogadas por 015)  
- Views 012/014 ainda com **GRANT SELECT** a `anon` (grants ≠ RLS table policies)

### Riscos em empty DB (não bloqueiam necessariamente o apply)

| Risco | Severidade |
|-------|------------|
| `create_system_events_table` instala triggers que referenciam `work_order_tasks.name` / `.status` mas o schema 001 usa `message` / `type` → DML legado pode falhar **em runtime** | **P1** |
| Policies additive (`004` + `001`/`002`) → superfície RLS mais permissiva que o ideal | **P2** |
| `011` policies `users_*_all` permitem INSERT/SELECT a **anon** em `public.users` | **P1** segurança Staging/Prod |
| Re-apply parcial sem tracking limpo: `004`, `007`, `create_metrics`, `create_workflow`, `create_system_events` policies podem falhar | **P2** (1ª init OK) |

**Veredicto empty-DB chain:** compatível com bootstrap Staging **num único run** do runner oficial.

---

## 4. Migration 015 Analysis

| Pergunta | Resposta |
|----------|----------|
| O que faz? | `DROP POLICY IF EXISTS` `"anon write …"` e `"anon read …"` nas 11 tabelas de 013 |
| Destrói dados? | **Não** |
| Idempotente? | **Sim** (`IF EXISTS`) |
| Depende de 001–014? | Tabelas devem existir para `DROP POLICY ON table` (Postgres exige relação). Na cadeia, tabelas já criadas. |
| Pode correr sozinha numa DB vazia? | **Falharia** se as tabelas não existirem |
| Posição correcta? | **Após 013** (lex OK) |
| Efeito operacional app? | Cliente Vite com anon key deixa de ler/escrever essas tables via RLS; BFF/service role ainda necessário (Phase 1) |

**015 sozinha ≠ init Staging.** Init = cadeia completa incluindo 015.

---

## 5. RLS / Security Analysis

| Fase na cadeia | Estado de segurança |
|----------------|---------------------|
| Após 009–012 | authenticated policies industriais |
| Após 013 | **Anon R/W aberto** (P0 residual se parar aqui) |
| Após 015 | Policies anon 013 **removidas** |
| Após `011_restore_public_users` | `public.users` aberto a anon SELECT/INSERT (permanece após 015) |
| Views 012/014 | `GRANT SELECT` a anon permanece; sem policies de view RLS típicas |

**Implicação Staging:** após init completo, industrial tables endurecidas quanto a anon policies 013; `public.users` e grants de views continuam a merecer atenção (não são corrigidos por 015).

---

## 6. Auth Dependencies

| Dependência | Onde |
|-------------|------|
| Schema / tabela `auth.users` | FKs em `001`, `002`, `create_event_log`, `create_metrics`, `create_notifications`, `create_quality`, etc. |
| Role DB `authenticated` / `anon` / `service_role` | Policies e GRANTs |
| Supabase Auth (utilizadores reais) | **Não** exigidos para o DDL; seed `public.users` é tabela app, não `auth.users` |
| PHP JWT PIMO | **Fora** das migrations SQL |

Init Staging **não** requer criar utilizadores Auth previamente, mas **requer** projecto Supabase (não Postgres bare).

---

## 7. Storage Dependencies

**Nenhuma** migration referencia Storage.  
Init Staging **não** depende de buckets.

---

## 8. External Dependencies

| Dependência | Necessária para apply SQL? |
|-------------|----------------------------|
| Secrets / password DB | **Sim** (ligação Postgres) |
| `VITE_SUPABASE_URL` / anon | Para pós-validação REST no runner (users); avisado se ausente |
| Objectos criados manualmente fora do repo | **Não** evidenciados como requisito |
| Edge Functions | **Não** |
| Hostinger | **Não** para schema Supabase |
| DNS | **Não** |

---

## 9. Current Migration Tooling

### Oficial recomendado: `scripts/applyMigrationsPg.mjs`

| Capacidade | Detalhe |
|------------|---------|
| Ligação | `DATABASE_URL` **ou** `SUPABASE_DB_PASSWORD` + ref/URL |
| Guard | `validateMigrateTarget` (`migrateTargetGuard.mjs`) |
| Tracking | `public._pimo_schema_migrations` |
| Transação | BEGIN/COMMIT **por ficheiro** |
| Ordem | Lex sort de **todos** os `.sql` |
| Pós-check | Tables/views industriais + seed user + optional REST users |
| Dry-run | `PIMO_MIGRATE_DRY_RUN=1` (lista ficheiros; **não** consulta DB pending vs applied de forma fina — lista todos os candidatos) |
| Env load | `.env` → `.env.staging` → `.env.production` → `process.env` (**risco** sobrescrita — ver §11) |

### Alternativo: `scripts/applySupabaseMigrations.mjs`

| Capacidade | Detalhe |
|------------|---------|
| Método | `supabase link` + `supabase db push` |
| Guard target/allowlist | **AUSENTE** |
| Load env | `.env` + `.env.production` (sem `.env.staging`) |
| Risco | Pode apontar ao ref de `VITE_SUPABASE_URL` sem confirmação Staging |

**Recomendação:** **não usar** `applySupabaseMigrations.mjs` para init Staging até ter o mesmo guard.

### Pós-passo CI: `scripts/validateIndustrialMetadata.mjs`

| Capacidade | Detalhe |
|------------|---------|
| Guard `PIMO_MIGRATE_TARGET` | **AUSENTE** (ignora allowlist) |
| Load env | `.env` + `.env.production` (**não** `.env.staging`) |
| Risco | Validação pode ligar a Production se credentials locais/CI forem as de prod |

---

## 10. GitHub Workflow Analysis

Ficheiro: `.github/workflows/supabase-migrations.yml`

| Aspecto | Estado |
|---------|--------|
| Trigger | **Só** `workflow_dispatch` (sem push main) |
| Inputs | `target` = staging\|production\|local; `dry_run`; `confirm_production` |
| Environment | `environment: ${{ inputs.target }}` |
| Apply | `node scripts/applyMigrationsPg.mjs` com guard env |
| Verify REST | curl tables com service role/anon do **mesmo** secret set |
| Validate metadata | `validateIndustrialMetadata.mjs` (**sem** guard próprio) |

### Lacuna ops actual (evidência prévia / estado típico)

- GitHub Environments com secrets Staging **ainda podem estar em falta** (**NOT VERIFIED** nesta auditoria se já foram criados após o provisioning).  
- Secrets ao nível do **repositório** historicamente incluem `VITE_SUPABASE_URL` / `DATABASE_URL` alinhados a **Production** (`ritmrjwrmcsofyugviil` no site pimo.pro).  
- Se Environment `staging` herdar ou reutilizar esses secrets → **risco de migrate em Production com label staging**.

---

## 11. Production Safety Analysis

### Pode o mecanismo actual apontar acidentalmente para PRODUCTION?

**SIM — se a configuração ops estiver incorrecta.**

| Cenário | Resultado |
|---------|-----------|
| `target=staging` + allowlist `rszpnvmscehqapflaklv` + URL/DB staging | **Seguro** (guard PASS) |
| `target=staging` + allowlist staging + `VITE_SUPABASE_URL`/`DATABASE_URL` ainda Production | Guard **FAIL** `REF_MISMATCH` |
| `target=staging` + `PIMO_MIGRATE_ALLOWED_REF=ritmrjwrmcsofyugviil` + credentials Production | Guard **PASS** indevidamente → **PERIGO** |
| `target=production` sem `CONFIRM_PRODUCTION_MIGRATE=I_UNDERSTAND` | Guard **FAIL** |
| Runner local com merge `.env.production` por cima de staging | Contaminação possível; guard mitiga **só se** allowlist ≠ actual |
| `applySupabaseMigrations.mjs` | **Sem guard** → **PERIGO** |
| `validateIndustrialMetadata.mjs` local | **Sem guard** → **PERIGO** |

### Isolamento requerido (referência)

```text
STAGING allowlist / URL / DATABASE_URL  → rszpnvmscehqapflaklv
PRODUCTION allowlist / URL / DATABASE_URL → ritmrjwrmcsofyugviil
NUNCA partilhar o mesmo DATABASE_URL entre Environments
```

---

## 12. Staging Initialization Strategy

### Mecanismo exacto recomendado

```text
1. Configurar secrets APENAS do projecto Staging (rszpnvmscehqapflaklv)
2. PIMO_MIGRATE_TARGET=staging
3. PIMO_SUPABASE_PROJECT_REF_STAGING=rszpnvmscehqapflaklv
4. SUPABASE_PROJECT_REF ou VITE_SUPABASE_URL contendo o mesmo ref
5. DATABASE_URL (ou password) do Staging — distinto de Production
6. Dry-run: PIMO_MIGRATE_DRY_RUN=1
7. Apply: node scripts/applyMigrationsPg.mjs
   (preferir GitHub workflow_dispatch target=staging com Environment staging isolado)
8. Verificar _pimo_schema_migrations (27 entries) + pós-checks do script
9. Verificar RLS: policies anon 013 ausentes; tables industriais existem
```

**Não** usar Supabase CLI `db push` / `applySupabaseMigrations.mjs` para o primeiro init, salvo revisão de segurança.

**Não** aplicar só a 015.

**Não** apontar Local `.env` para Production durante o processo.

---

## 13. Recommended Execution Order

| Step | Acção | Executar agora? |
|------|--------|-----------------|
| 0 | Owner confirma refs: Staging `rszpnvmscehqapflaklv` ≠ Prod `ritmrjwrmcsofyugviil` | Aprovação |
| 1 | Criar GitHub Environment `staging` + secrets Staging only | Ops (fora desta tarefa) |
| 2 | Definir `PIMO_SUPABASE_PROJECT_REF_STAGING=rszpnvmscehqapflaklv` | Ops |
| 3 | Confirmar Environment `production` allowlist = `ritmrjwrmcsofyugviil` (sem DB staging) | Ops |
| 4 | `workflow_dispatch` **dry_run=true** `target=staging` | Após aprovação |
| 5 | Prova negativa (opcional): credentials prod + allowlist staging → deve FAIL | Após aprovação |
| 6 | Backup/snapshot Staging (Dashboard) | Após aprovação |
| 7 | `workflow_dispatch` dry_run=false `target=staging` → apply **cadeia completa** | Após aprovação |
| 8 | Validar tables/views/RLS/seed; anotar 015 aplicada via cadeia | Após apply |
| 9 | Smoke industrial REST (anon deve falhar writes nas 11 tables; service role OK) | Após apply |
| 10 | **Não** migrar Production neste ciclo | — |

---

## 14. Risks

| ID | Risco | Severidade |
|----|-------|------------|
| R1 | Secrets repo/Environment ainda = Production | **P0** ops |
| R2 | `PIMO_MIGRATE_ALLOWED_REF` partilhado = prod com `target=staging` | **P0** |
| R3 | Parar apply entre 013 e 015 → anon aberto | **P0** (mitigar: run completo) |
| R4 | `applySupabaseMigrations.mjs` sem guard | **P0** se usado |
| R5 | `validateIndustrialMetadata` sem guard + load `.env.production` | **P1** |
| R6 | Merge `.env.production` no apply local | **P1** |
| R7 | Triggers `create_system_events_table` vs schema tasks | **P1** runtime legado |
| R8 | `public.users` anon open após init | **P1** |
| R9 | Grants SELECT anon em views industriais | **P2** |
| R10 | Policies não-idempotentes se re-run manual | **P2** |

---

## 15. Preconditions

Antes de **qualquer** apply Staging:

```text
[ ] Project Staging existe: rszpnvmscehqapflaklv
[ ] DATABASE_URL / DB password são do Staging (não ritmrjwrmcsofyugviil)
[ ] VITE_SUPABASE_URL (se usada) = https://rszpnvmscehqapflaklv.supabase.co
[ ] PIMO_SUPABASE_PROJECT_REF_STAGING = rszpnvmscehqapflaklv
[ ] PIMO_MIGRATE_TARGET = staging
[ ] GitHub Environment staging com secrets isolados (recomendado)
[ ] Confirmação explícita Owner para executar
[ ] Dry-run PASS
[ ] Prova REF_MISMATCH se credentials erradas (recomendado)
[ ] Ninguém usa applySupabaseMigrations.mjs neste init
[ ] Production ritmrjwrmcsofyugviil permanece read-only neste ciclo
```

---

## 16. Exact Next Steps

1. **Configurar** secrets Staging (Owner) — não misturar com Production.  
2. **Aprovar** explicitamente o primeiro apply Staging.  
3. Correr **dry-run** `target=staging`.  
4. Correr **apply** `scripts/applyMigrationsPg.mjs` (ou workflow) com target staging.  
5. **Verificar** 27 migrations registadas + ausência policies anon 013 + presença schema industrial.  
6. Documentar resultado num relatório de verificação **futuro** (não nesta tarefa).  
7. Só depois planear qualquer migrate Production (fora de âmbito).

---

## 17. STOP Conditions

Parar imediatamente se:

- Ref actual ≠ `rszpnvmscehqapflaklv` no run staging  
- `DATABASE_URL` contém `ritmrjwrmcsofyugviil`  
- Guard falha ou é contornado  
- Alguém propõe aplicar só 015 sem cadeia  
- Alguém propõe `applySupabaseMigrations.mjs` / `db push` sem guard  
- Apply falha a meio (não “continuar à força” em Production)  
- Não há aprovação explícita do Owner  

---

## Verdicts

```text
MIGRATION CHAIN:
READY

STAGING INITIALIZATION:
NOT READY

MIGRATION 015:
READY

PRODUCTION SAFETY:
NOT READY
```

### Interpretação

| Veredicto | Significado |
|-----------|-------------|
| **MIGRATION CHAIN READY** | A sequência SQL do repo é adequada para bootstrap de um projecto Supabase vazio (com `auth`), incluindo 015 no fim da fase numerada + ficheiros unnumbered. |
| **STAGING INITIALIZATION NOT READY** | O projecto Staging já existe, mas **ops/secrets/allowlist/CI Environment** ainda têm de estar comprovadamente isolados antes do primeiro apply. |
| **MIGRATION 015 READY** | O ficheiro é seguro e correcto **como parte da cadeia**; não como único passo de init. |
| **PRODUCTION SAFETY NOT READY** | Até secrets Staging ≠ Production e allowlists correctas, o risco de apontar a `ritmrjwrmcsofyugviil` permanece. |

---

STOP — aguardando aprovação explícita antes de executar qualquer migration.
