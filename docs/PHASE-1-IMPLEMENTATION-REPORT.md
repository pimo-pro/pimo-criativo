# PHASE 1 — Implementation Report (API / ACL P0)

**Data:** 24 de Agosto de 2026  
**Estado:** Implementação concluída no código; migration RLS **não aplicada** à base remota neste agente  
**Plano oficial:** `docs/PHASE-1-API-ACL-IMPLEMENTATION-PLAN.md`  
**Pré-requisito:** Phase 0 (`docs/PHASE-0-IMPLEMENTATION-REPORT.md`)

---

## 1. Executive Summary

A Phase 1 fecha os buracos P0 de Broken Access Control:

- Projects API exige JWT e ownership (anti-IDOR)
- Industrial orders PHP exige JWT + permissão de produção
- `/admin` legado e settings industriais exigem sessão + permission
- Migration SQL revoga anon read/write industrial (ficheiro criado; **ops deve aplicar**)
- Cliente deixa de sync remoto com guest / K/K (`local-dev-token`)
- K/K local (Phase 0) preservado; continua rejeitado pelas APIs JWT

**Não** se implementou Organization/Factory, RBAC completo, entitlements, subscriptions, nem BFF industrial completo.

---

## 2. Plan Used

`docs/PHASE-1-API-ACL-IMPLEMENTATION-PLAN.md` (criado nesta fase — não existia plano completo prévio).

Consistente com `docs/SPEC-ARQUITETURA-AUTH-AUTHZ-SUBSCRIPTIONS.md` (ownership transitório = `JWT.sub === project.ownerId`).

---

## 3. Files Changed (CHANGED BY THIS PHASE)

| File | Change |
|------|--------|
| `api/authz/resourceAccess.php` | **NEW** — helpers JWT + permissions + ownership |
| `api/authz/load.php` | **NEW** — helper de resolução de path (opcional) |
| `hostinger/api/projects/index.php` | Authz + CORS allowlist + IDOR + bind owner |
| `hostinger/api/projects/list.php` | Authz + scope forçado |
| `public_html/api/projects/index.php` | Sincronizado com hostinger (canónico deploy) |
| `public_html/api/projects/list.php` | Idem |
| `api/industrial/orders/index.php` | JWT + send_to_production + owner JWT |
| `scripts/copyDeployApiToDist.mjs` | Copia `_impl/authz/resourceAccess.php` |
| `src/core/projects/remoteApiAuth.ts` | **NEW** — Bearer / skip guest+K/K |
| `src/core/projects/projectsApi.ts` | Envia Authorization; offline se sem JWT |
| `src/core/projects/projectsAuthzRules.ts` | **NEW** — espelho TS das regras PHP |
| `src/core/projects/projectsAuthz.test.ts` | **NEW** — testes IDOR + client auth |
| `src/core/industrial/industrialOrdersApi.ts` | Bearer + fail sem sessão remota |
| `src/App.tsx` | Gate `/admin`; PermissionRoute settings industriais |
| `supabase/migrations/015_revoke_industrial_anon_write.sql` | **NEW** — DROP policies anon |
| `src/industrial/infra/supabase/writePolicy.ts` | **NEW** — soft-block writes PROD |
| `src/industrial/infra/supabase/writePolicy.test.ts` | **NEW** |
| `src/industrial/infra/supabase/client.ts` | Proxy intercepta insert/update/upsert/delete |
| `src/industrial/persistence/piece/savePieceTransform.ts` | Trata `PIMO_WRITE_BLOCKED` |
| `src/industrial/persistence/events/logEvent.ts` | Trata `PIMO_WRITE_BLOCKED` |
| `src/core/projects/phase1PhpAclRegression.test.ts` | **NEW** — regressão ACL no código PHP |
| `src/core/projects/phase1AdminGateRegression.test.ts` | **NEW** — regressão gate `/admin` |
| `.env.example` | Nota `VITE_INDUSTRIAL_SUPABASE_DIRECT_WRITES` |
| `docs/PHASE-1-API-ACL-IMPLEMENTATION-PLAN.md` | **NEW** plano oficial |
| `docs/PHASE-1-IMPLEMENTATION-REPORT.md` | Este relatório |

---

## 4. Files Created

Ver coluna **NEW** acima + pasta `api/authz/`.

---

## 5. APIs Protected

| API | Protection |
|-----|------------|
| `GET/POST/PUT/DELETE /api/projects/index.php` | JWT; view/mutate por ownership; `scope=all` só `project.view.all`/`admin` |
| `GET /api/projects/list.php` | Idem |
| `GET/POST /api/industrial/orders` | JWT; POST = `project.send_to_production.self` ou admin; GET filtrado por owner |

CORS: removido `Access-Control-Allow-Origin: *` nestes endpoints; allowlist (pimo.pro + localhost em local/dev).

---

## 6. Authorization Changes

Pipeline:

```
Bearer JWT → decode → load user → effective permissions (role map Phase 0)
→ resource ownerId === sub  OR  admin.full_access / project.view.all
```

- `ownerId` / `ownerName` no body **ignorados** no save (bind server-side)
- Query `ownerId` **ignorada** na listagem (usa JWT.sub)
- Respostas IDOR → **404** “Não encontrado” (anti-enumeration), excepto `scope=all` sem permission → **403**

---

## 7. IDOR Fixes

- Load / update / delete / thumb de projeto alheio → 404
- Save sobre projecto alheio → 404
- Spoof `ownerId` no POST → sobrescrito pelo JWT
- Listagem `scope=mine` não aceita `ownerId` de outro user

Testes automatizados (espelho TS): `src/core/projects/projectsAuthz.test.ts`

PHP end-to-end contra Hostinger: **NOT VERIFIED** (PHP CLI indisponível nesta máquina).

---

## 8. Admin Protection

- `LegacyApp` em `/admin`: sem sessão → `/login`; sem `canAccessAdminPanel` → deny UI
- `/admin/settings/industrial` e realtime-alerts → `PermissionRoute check={canAccessAdminPanel}`

Nota: isto é gate de UI + sessão; a autoridade de dados continua no backend (Projects/industrial). AdminPanel PHP APIs já tinham JWT (Phase 0 / prévio).

---

## 9. Industrial Security Changes

- Orders PHP autenticado e com ACL
- Cliente `submitIndustrialOrder` envia Bearer
- Soft-policy: writes Supabase directos off em PROD (salvo env explícito)
- **Proxy central** em `client.ts` bloqueia `insert`/`update`/`upsert`/`delete` quando a policy está off (cobre todos os writers industriais que usam `supabase.from`)
- Migration 015 preparada para revogar policies anon da 013

BFF + service role: **deferred** (fase posterior).

---

## 10. RLS Changes

Ficheiro: `supabase/migrations/015_revoke_industrial_anon_write.sql`

- DROP `anon write *` e `anon read *` nas tabelas listadas na 013
- **Não executado** contra produção/staging por este agente
- Estado: **NOT APPLIED** — requer ops / staging first

---

## 11. Tests Created/Modified

| Test | Purpose |
|------|---------|
| `projectsAuthz.test.ts` | IDOR ownership, spoof owner, visitor, production perm, remote token rules |
| `phase1PhpAclRegression.test.ts` | Markers ACL no PHP (projects, orders, migration, deploy) |
| `phase1AdminGateRegression.test.ts` | Gate `/admin` + PermissionRoute settings |
| `writePolicy.test.ts` | write policy + `PIMO_WRITE_BLOCKED` |
| `local-auth.test.ts` | Phase 0 (regressão) — mantido |

---

## 12. Tests Executed

```text
npx vitest run src/core/projects/projectsAuthz.test.ts \
  src/core/projects/phase1PhpAclRegression.test.ts \
  src/core/projects/phase1AdminGateRegression.test.ts \
  src/industrial/infra/supabase/writePolicy.test.ts \
  src/local-auth.test.ts
```

```text
npx tsc -b
```

---

## 13. Test Results

| Suite | Result |
|-------|--------|
| Phase 1 suite (authz + PHP regression + admin + writePolicy + local-auth) | **24 passed** |
| `tsc -b` | **PASS** (exit 0) |
| PHP integration HTTP live (Hostinger) | **NOT VERIFIED** (sem PHP CLI nesta máquina) |
| Migration 015 applied on Supabase | **NOT APPLIED** (intencional — ops/staging) |
| Manual browser `/admin` | **NOT VERIFIED** (código + regressão source **PASS**) |

---

## 14. Security Verification

| Criterion | Status |
|-----------|--------|
| C1 Projects sem JWT → 401 | Código + PHP regression **PASS**; live HTTP **NOT VERIFIED** |
| C2 IDOR User A↛B | Rules + TS tests **PASS**; live **NOT VERIFIED** |
| C3 ownerId spoof blocked | TS test **PASS** |
| C4 scope=all sem perm → 403 | Código + PHP regression **PASS** |
| C5 `/admin` gated | Código + source regression **PASS**; browser **NOT VERIFIED** |
| C6 industrial orders sem JWT → 401 | Código + PHP regression **PASS** |
| C7 migration revoke anon write | File + regression **PASS**; DB **NOT APPLIED** |
| C8 K/K local only | Phase 0 tests **PASS** |
| C9 guest offline | Client tests **PASS** |
| C10 IDOR automated tests | **PASS** |

---

## 15. Known Limitations

- Sem PHP CLI → não há smoke HTTP local end-to-end (mitigado por regressão de código-fonte + regras TS)
- Migration 015 não é aplicada automaticamente (requer ops; documentado)
- `ultra+` `project.view.factory` sem Factory → não concede `scope=all` (intencional)
- Sync remoto com K/K deixa de funcionar (intencional — offline local)
- Leituras anon Supabase só caem após aplicar 015; até lá, proxy já bloqueia writes em PROD

---

## 16. Deferred Items (Phase 2+)

- Authentication hardening (refresh, password reset real)
- Organization / Factory (Phase 3)
- RBAC extra/removed permissions (Phase 4)
- Entitlements / Subscriptions / Limits / Billing
- BFF industrial + service role
- Quotes rate-limit; materials Vite POST; global config public

---

## 17. Risks

| Risk | Mitigation |
|------|------------|
| Aplicar 015 em prod sem BFF | Soft-fail writes; staging first |
| Deploy sem `PIMO_JWT_SECRET` | Phase 0 fail-closed |
| Drift hostinger vs public_html | Sincronizados nesta fase |

---

## 18. Pre-existing Changes Preserved

**Não** se fez `git reset` / clean / commit / push.

Alterações **pré-existentes / Phase 0** (não reverter):

- `api/auth/index.php`, `src/local-auth.ts`, `AuthProvider`, `LoginPage`, `devLocalAuthMiddleware`, `vite.config.ts`
- Quotes API / `sendQuoteRequestEmail` / deploy / `.gitignore` / `.env.production` deleted / `publish.js`
- Docs audit / spec / Phase 0
- `scripts/cnc-examples-output/*.json` (worktree prévio, **fora** do âmbito Phase 1)

---

## 19. Recommended Next Phase

**PHASE 2 — Authentication Hardening** (conforme Spec), depois Organization/Factory (3) e RBAC (4).

Ops imediato recomendado:

1. Confirmar `PIMO_JWT_SECRET` + `PIMO_APP_ENV=production` no Hostinger  
2. Deploy com `copyDeployApiToDist` (inclui authz)  
3. Staging: aplicar `015_revoke_industrial_anon_write.sql`  
4. Smoke HTTP: projects/list sem token → 401; token User A em projecto B → 404  

---

## 20. Git

- `git status` executado  
- **Sem commit**  
- **Sem push**

---

*Fim do relatório Phase 1.*
