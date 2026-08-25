# Environment Separation — Implementation Report

**Data:** 24 de Agosto de 2026  
**Tipo:** IMPLEMENTAÇÃO (código + testes + documentação)  
**Fonte oficial de plano:** `docs/ENVIRONMENT-SEPARATION-DEPLOYMENT-SAFETY-PLAN.md`  
**Contexto de produto:** Web + futuro Desktop/Offline + futuro Mobile — Environment ≠ Role ≠ Plan ≠ Permission ≠ Local Development Access

---

## 1. Executive Summary

Foi implementada uma base de separação de ambientes que:

- deixa de apontar `npm run dev` para Production (`pimo.pro`) por omissão;
- modela runtime cliente (`local-dev` / `staging-client` / `production-client`);
- activa **Full Local Development Access** só em Vite DEV (não por username `K`);
- preserva **K/K** apenas em LOCAL/DEV;
- endurece o migration runner com target + allowlist + confirmação Production;
- remove apply automático de migrations em `push main`;
- injeta `VITE_PIMO_APP_ENV=production` no build de deploy.

**Não** foi criado Supabase Staging, Hostinger Staging, nem aplicada a Migration 015.  
**Não** foram implementados Offline, Desktop runtime, Mobile, nem Phase 2.

| Classificação | Conteúdo |
|---------------|----------|
| **IMPLEMENTED** | Modelo env cliente; proxy local seguro; full local access; K/K local-only; guards migrate; CI migrations explícito; config `.env.example` / gitignore; testes; build |
| **REQUIRES EXTERNAL CONFIGURATION** | Project refs Staging/Production; secrets GitHub Environments; `.env.staging`; Hostinger staging; Supabase staging project |
| **NOT IMPLEMENTED** | Infra staging externa; Offline; Desktop app; Mobile; Sync Engine; apply 015 |
| **NOT VERIFIED** | Smoke HTTP Hostinger; secrets reais em CI; que `DATABASE_URL` local/staging exista e bata certo com allowlist |

---

## 2. Current Architecture (após esta tarefa)

```
LOCAL DEVELOPMENT (npm run dev)
  ├─ Client runtime: local-dev
  ├─ Full Local Development Access: ON (salvo VITE_ALLOW_FULL_LOCAL_DEV_ACCESS=false)
  ├─ K/K + /api/auth/dev-local: ALLOWED
  ├─ /api proxy → OFF por default
  └─ Proxy remoto só com VITE_DEV_API_PROXY_TARGET (pimo.pro bloqueado salvo override explícito)

STAGING (preparado no código; infra externa em falta)
  ├─ Client: VITE_PIMO_APP_ENV=staging → staging-client
  ├─ K/K / full local access: DENIED (não é Vite DEV)
  ├─ Migrations: PIMO_MIGRATE_TARGET=staging + allowlist ref
  └─ Host / Supabase project: REQUIRES EXTERNAL CONFIGURATION

PRODUCTION (Web / futuro Desktop Prod / Mobile Prod)
  ├─ Client: production-client (fail-closed)
  ├─ Deploy FTP tags v* → pimo.pro + VITE_PIMO_APP_ENV=production
  ├─ K/K / developer bypass: DENIED
  └─ Migrations: target=production + allowlist + CONFIRM_PRODUCTION_MIGRATE=I_UNDERSTAND
```

---

## 3. Environment Model

| Conceito | Implementação | Notas |
|----------|---------------|--------|
| `ClientRuntimeKind` | `src/core/environment/pimoEnvironment.ts` | `local-dev` \| `staging-client` \| `production-client` |
| Declared env | `VITE_PIMO_APP_ENV` + `normalizePimoAppEnv` | Desconhecido → **production** (fail-closed) |
| Vite DEV | `import.meta.env.DEV` → sempre `local-dev` | Distinto de Desktop Production futuro |
| Server PHP | `PIMO_APP_ENV` (já Phase 0) | Mantido; não misturado com role/plan |
| Migrate target | `PIMO_MIGRATE_TARGET` | `local` \| `staging` \| `production` |

**Distinções preservadas (não colapsadas):**

1. LOCAL DEVELOPMENT ≠ LOCAL DESKTOP APPLICATION  
2. LOCAL DEVELOPMENT ≠ OFFLINE MODE  
3. STAGING ≠ PRODUCTION  
4. PRODUCTION WEB ≠ PRODUCTION DESKTOP ≠ PRODUCTION MOBILE  

---

## 4. LOCAL Changes

### 4.1 Proxy `/api` (`vite.config.ts`)

| Antes | Depois |
|-------|--------|
| Default → `https://pimo.pro` | Default → **sem proxy remoto** |
| — | `VITE_DEV_API_PROXY_TARGET` obrigatório para remoto |
| — | Target com `pimo.pro` **bloqueado** salvo `VITE_ALLOW_DEV_PROXY_PRODUCTION=true` |
| materials + `/api/auth/dev-local` | Continuam middleware local Vite |

### 4.2 Dependências que antes falavam com Production

| Endpoint / fluxo | Motivo histórico | Estado agora | Alternativa |
|------------------|------------------|--------------|-------------|
| `/api/auth` (JWT login) | Proxy default pimo.pro | Sem proxy → precisa API local ou target explícito | PHP local / staging URL |
| `/api/projects`, industrial orders | Idem | Idem | Idem |
| `/api/auth/dev-local` (K/K) | Middleware Vite | Continua local | — |
| `/api/materials` | Middleware Vite | Continua local | — |

**Documentação operacional:** para login JWT em DEV, definir explicitamente `VITE_DEV_API_PROXY_TARGET` (preferência staging ou PHP local). Nunca Production por default.

### 4.3 Config

- `.env.example` — variáveis de proxy, full local access, migrate target/allowlist  
- `.gitignore` — inclui `.env.staging`

---

## 5. Full Local Development Access

| Requisito | Como |
|-----------|------|
| Todas as permissões conhecidas em DEV | `getLocalDevelopmentPermissions()` → `ALL_KNOWN_PERMISSIONS` |
| Gate de UI | `hasPermissionWithLocalDevAccess` + `localDevSessionActive` no `AuthProvider` |
| Ligado ao ambiente | `isFullLocalDevelopmentAccessEnabled()` só se `local-dev` |
| Desligável | `VITE_ALLOW_FULL_LOCAL_DEV_ACCESS=false` |
| **Não** | `if (username === "K") allow everything` fora de LOCAL |

Sessão local usa role simbólica `local-dev` + flag `fullLocalDevAccess: true` (cliente e middleware `devLocalAuthMiddleware`).

---

## 6. K/K

| Ambiente | K/K |
|----------|-----|
| LOCAL / Vite DEV | **ALLOWED** (UI + `/api/auth/dev-local`) |
| Staging client build | **DENIED** (não `local-dev`) |
| Production client | **DENIED** |
| PHP Production (`PIMO_APP_ENV=production`) | Já fail-closed (Phase 0) |

K/K = autenticação rápida local. Privileges = propriedade do **ambiente** local-dev + sessão local, não do username em Production.

---

## 7. STAGING Preparation

| Item | Estado |
|------|--------|
| Código reconhece `staging` / `staging-client` | **IMPLEMENTED** |
| `PIMO_MIGRATE_TARGET=staging` + allowlist | **IMPLEMENTED** (código) |
| Workflow `environment: staging` | **IMPLEMENTED** (estrutura CI) |
| Project Supabase Staging | **REQUIRES EXTERNAL CONFIGURATION** |
| Hostinger Staging | **REQUIRES EXTERNAL CONFIGURATION** |
| `.env.staging` com secrets reais | **REQUIRES EXTERNAL CONFIGURATION** |
| Secrets `PIMO_SUPABASE_PROJECT_REF_STAGING` / `PIMO_MIGRATE_ALLOWED_REF` | **REQUIRES EXTERNAL CONFIGURATION** |

**Regra respeitada:** não inventar project ref; não usar Production como Staging.

---

## 8. PRODUCTION Protection

| Controlo | Estado |
|----------|--------|
| Client fail-closed (env inválido → production) | **IMPLEMENTED** |
| Sem K/K / full local access em build PROD | **IMPLEMENTED** |
| Deploy injeta `VITE_PIMO_APP_ENV=production` | **IMPLEMENTED** (`deploy.yml`) |
| Migrate Production exige `CONFIRM_PRODUCTION_MIGRATE=I_UNDERSTAND` | **IMPLEMENTED** |
| Bypass developer em Production | **DENIED** por desenho |

---

## 9. Migration Safety

Ficheiros: `scripts/migrateTargetGuard.mjs` + wiring em `scripts/applyMigrationsPg.mjs`.

O runner **falha** se:

- `PIMO_MIGRATE_TARGET` em falta / inválido  
- allowlist em falta  
- project ref actual indeterminável  
- ref actual ≠ allowlist  
- Production sem `CONFIRM_PRODUCTION_MIGRATE=I_UNDERSTAND`

Também: `PIMO_MIGRATE_DRY_RUN=1`; load de `.env.staging` quando aplicável.

| Migration 015 | Estado |
|---------------|--------|
| Aplicar nesta tarefa | **NOT IMPLEMENTED** (propositadamente) |
| Modificar ficheiro SQL | **NOT IMPLEMENTED** |
| Preparar apply seguro em Staging depois | **IMPLEMENTED** (guards) |

---

## 10. GitHub Actions

### `supabase-migrations.yml`

- Removido apply automático em **push main**  
- `workflow_dispatch` com input `target` (`local` \| `staging` \| `production`)  
- `environment: ${{ inputs.target }}`  
- Injeta `PIMO_MIGRATE_TARGET` + secrets de allowlist / DB  

### `deploy.yml`

- Continua tags `v*` → Production FTP  
- Build env inclui `VITE_PIMO_APP_ENV=production`

**NOT VERIFIED:** GitHub Environments `staging` / `production` / `local` e secrets associados existem no repositório remoto.

---

## 11. Supabase

| Aspecto | Estado |
|---------|--------|
| Target = variáveis no momento da execução | Mantido |
| Allowlist por ambiente no migrate | **IMPLEMENTED** |
| `supabase/config.toml` `project_id` | Continua vazio — **REQUIRES EXTERNAL CONFIGURATION** para link CLI |
| Project Staging criado | **NOT IMPLEMENTED** |

---

## 12. Hostinger

| Aspecto | Estado |
|---------|--------|
| Production `pimo.pro` | Mantido (deploy existente) |
| Staging host | **REQUIRES EXTERNAL CONFIGURATION** |
| Smoke remoto pós-deploy | **NOT VERIFIED** |

---

## 13. Desktop Compatibility

**NOT IMPLEMENTED** (app desktop).

Espaço arquitectural preservado:

- Authz/permissions como conceitos de domínio (não só cookies browser)  
- Ambiente `local-dev` ≠ “Desktop Production”  
- Futuro caminho: Desktop → local storage/DB → Sync Engine → Remote API → Supabase  

**Recomendação (sem inventar implementação):** quando Desktop existir, introduzir `runtimePlatform: web | desktop | mobile` separado de `ClientRuntimeKind` / `PIMO_APP_ENV`.

---

## 14. Offline Compatibility

**NOT IMPLEMENTED.**

Pontos futuros a tratar (documentados, não construídos):

- autenticação offline / cache de sessão  
- permissions offline  
- dados de projecto locais + sync / conflitos  
- operações que hoje assumem Remote API  

Esta tarefa **não** obriga Internet+Supabase para cada operação futura; o proxy local default já favorece API local em DEV.

---

## 15. Mobile Compatibility

**NOT IMPLEMENTED.**

Mantido: identidade/autorização baseada em JWT + permissions efectivas (consumível por clientes não-browser).  
Evitar amarrar full access a mecanismos só Vite — full access já está gated por `import.meta.env.DEV` (web local); Desktop/Mobile Production devem usar o mesmo fail-closed que Production web.

---

## 16. Tests

| Suite | Resultado |
|-------|-----------|
| `src/core/environment/pimoEnvironment.test.ts` | PASS |
| `src/core/environment/migrateTargetGuard.test.ts` | PASS |
| `src/local-auth.test.ts` | PASS (incl. `local-dev` + full access) |
| `projectsAuthz` + `writePolicy` (regressão Phase 1) | PASS |
| **Total nesta verificação** | **31 tests PASS** |

Cobertura pedida:

- LOCAL reconhecido / full access / K/K local — **IMPLEMENTED** nos testes  
- STAGING: K/K e bypass rejeitados fora de DEV — **IMPLEMENTED** (runtime kind)  
- PRODUCTION: fail-closed / rejeição — **IMPLEMENTED**  
- MIGRATE: missing/wrong/production protect / staging valid — **IMPLEMENTED** no guard  

---

## 17. Build

| Comando | Resultado |
|---------|-----------|
| `tsc -b` | **PASS** (exit 0) |
| `npm run build` | **PASS** (`BUILD_EXIT:0`; Vite ✓ built; `copyDeployApiToDist` OK) |

Avisos Rollup de chunk size: pré-existentes / não mascarados; não falham o build.

---

## 18. Files Changed (esta implementação)

Principais (lista não exaustiva de todo o working tree pré-existente):

| Ficheiro | Acção |
|----------|--------|
| `src/core/environment/pimoEnvironment.ts` | Novo |
| `src/core/environment/localDevAccess.ts` | Novo |
| `src/core/environment/pimoEnvironment.test.ts` | Novo |
| `src/core/environment/migrateTargetGuard.test.ts` | Novo |
| `scripts/migrateTargetGuard.mjs` | Novo |
| `scripts/applyMigrationsPg.mjs` | Guard + `.env.staging` |
| `vite.config.ts` | Proxy sem Production default |
| `src/local-auth.ts` | Gate env + role `local-dev` |
| `src/server/devLocalAuthMiddleware.ts` | Full local access flag |
| `src/auth/AuthProvider.tsx` | `localDevSessionActive` + gate permissões |
| `src/local-auth.test.ts` | Actualizado |
| `.github/workflows/supabase-migrations.yml` | Dispatch + environment |
| `.github/workflows/deploy.yml` | `VITE_PIMO_APP_ENV=production` |
| `.env.example` | Variáveis env/migrate/proxy |
| `.gitignore` | `.env.staging` |
| `docs/ENVIRONMENT-SEPARATION-IMPLEMENTATION-REPORT.md` | Este relatório |

Alterações pré-existentes de Phase 0/1 e outros agentes **preservadas** (sem `git reset` / `clean` / `checkout`).

---

## 19. External Configuration Required

Para Staging operacional:

1. Criar projecto Supabase **Staging** (ref real)  
2. Definir `PIMO_SUPABASE_PROJECT_REF_STAGING` (local + GitHub Environment `staging`)  
3. `DATABASE_URL` / credenciais **só** desse projecto  
4. Hostinger (ou host) Staging + `PIMO_APP_ENV=staging`  
5. GitHub Environments `staging` / `production` (e opcionalmente `local`) com secrets allowlisted  
6. `.env.staging` local (gitignored) — **nunca** copiar Production  

Para migrate Production controlado:

1. `PIMO_SUPABASE_PROJECT_REF_PRODUCTION`  
2. `CONFIRM_PRODUCTION_MIGRATE=I_UNDERSTAND` só em runs intencionais  

---

## 20. Known Limitations

- Sem staging externo, **não** há caminho verificado LOCAL → STAGING API.  
- Login JWT remoto em `npm run dev` exige configuração explícita (quebra intencional do default perigoso).  
- Full local access depende de Vite `DEV`; um futuro Desktop “dev build” precisará de sinal de plataforma separado (recomendação §13).  
- Identity de DB em secrets CI **NOT VERIFIED** nesta máquina.  
- Migration 015 continua **não aplicada**.

---

## 21. Next Step

1. Provisionar **Supabase Staging** + secrets allowlist (externo).  
2. Smoke: migrate **dry-run** `target=staging` → apply 015 **só** em Staging.  
3. Opcional: PHP local ou proxy staging para DEV JWT.  
4. Só depois: Phase 2 / Offline / Desktop — sem reabrir bypasses Production.

---

## Matriz final (obrigatória)

| Item | Classificação |
|------|----------------|
| Environment model (client) | **IMPLEMENTED** |
| Local API target correction (no prod default) | **IMPLEMENTED** |
| Full Local Development Access | **IMPLEMENTED** |
| K/K local-only | **IMPLEMENTED** |
| Production fail-closed (client + migrate confirm) | **IMPLEMENTED** |
| Migration safety guards | **IMPLEMENTED** |
| CI migrations explícito (sem push main auto) | **IMPLEMENTED** |
| Config / docs / tests / build | **IMPLEMENTED** |
| Supabase Staging project | **REQUIRES EXTERNAL CONFIGURATION** |
| Hostinger Staging | **REQUIRES EXTERNAL CONFIGURATION** |
| GitHub Environment secrets reais | **REQUIRES EXTERNAL CONFIGURATION** / **NOT VERIFIED** |
| Apply Migration 015 | **NOT IMPLEMENTED** |
| Offline / Desktop / Mobile / Sync | **NOT IMPLEMENTED** |
| Live Hostinger / remote DB smoke | **NOT VERIFIED** |

**STOP:** sem apply 015, sem alterar Production DB, sem criar infra externa, sem Phase 2, sem commit/push.
