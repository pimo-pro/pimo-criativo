# PHASE 1 — Final Security Verification Report

**Data:** 24 de Agosto de 2026  
**Tipo de tarefa:** VERIFICAÇÃO ONLY (sem alterações de implementação)  
**Veredicto:** **PHASE 1 PARTIALLY VERIFIED**

---

## 1. Executive Summary

A Phase 1 **está implementada no código** de forma alinhada com o plano oficial e fecha, no repositório, os controlos P0 principais (Projects JWT+ownership, industrial orders ACL, gate `/admin`, ficheiro migration 015, soft-block de writes Supabase em PROD).

Contudo, **não pode ser declarada “SECURITY VERIFIED” / “fully verified”** porque:

| Lacuna de verificação | Impacto |
|----------------------|---------|
| Sem smoke HTTP PHP live | Enforcement real 401/403/IDOR **NOT VERIFIED** |
| Sem Hostinger | Deploy + env + runtime **NOT VERIFIED — HOSTINGER** |
| Migration 015 **não aplicada** | Anon RLS da 013 **ainda activa** na DB remota → risco P0 residual até ops |
| Sem staging DB evidence | **NOT VERIFIED — STAGING** |
| `npm run build` completo | **NOT RUN** nesta verificação (apenas `tsc -b`) |

**Conclusão operacional:** CODE COMPLETE + TEST COMPLETE (suite Phase 1 local). **Não** STAGING VERIFIED. **Não** PRODUCTION VERIFIED. Avançar para Phase 2 é aceitável para hardening de auth **desde que** se trate a migration 015 + smoke Hostinger como pré-requisitos de produção, não como “já feito”.

---

## 2. Verification Scope

### Documentos lidos (existem com estes nomes)

1. `docs/RELATORIO-AUDITORIA-AUTH-AUTHZ-SUBSCRIPTIONS.md`
2. `docs/SPEC-ARQUITETURA-AUTH-AUTHZ-SUBSCRIPTIONS.md`
3. `docs/PHASE-0-IMPLEMENTATION-REPORT.md`
4. `docs/PHASE-1-API-ACL-IMPLEMENTATION-PLAN.md`
5. `docs/PHASE-1-IMPLEMENTATION-REPORT.md`

Também consultado: `docs/PLANO-PHASE-0-SECURITY-SECRETS.md` (contexto Phase 0).

### Métodos usados

- Leitura de código PHP/TS (authz, projects, orders, App, supabase client, migrations)
- Re-execução local da suite Phase 1 (24 testes) — **PASS**
- `npx tsc -b` — **PASS** (exit 0)
- Pesquisa de regressões (service role, K/K, CORS `*`, endpoints)
- **Não** executado: PHP CLI (**NOT AVAILABLE**), HTTP contra Hostinger, aplicação de migration, `vite build`

### O que esta verificação **não** faz

- Não altera código / migrations / secrets  
- Não faz deploy / commit / push  
- Não inventa resultados de staging/produção  

---

## 3. Requirement Matrix

| Requirement | Implemented | Tested | Verified | Evidence | Status |
|------------|:-----------:|:------:|:--------:|----------|--------|
| Projects API authentication | Yes | Partial | Partial | JWT gate em `index.php`/`list.php`; regressão PHP source; **sem** HTTP live | **PARTIAL** |
| Project resource authorization | Yes | Partial | Partial | `pimo_authz_can_view/mutate_project`; testes TS espelho; **sem** HTTP live | **PARTIAL** |
| IDOR protection | Yes | Partial | Partial | Ownership + bind owner + 404; testes IDOR TS; **sem** User A/B live | **PARTIAL** |
| Admin route protection | Yes (UI) | Partial | Partial | `App.tsx` gate + PermissionRoute; admin APIs users/global-config já JWT; browser **NOT VERIFIED** | **PARTIAL** |
| Industrial API (orders PHP) protection | Yes | Partial | Partial | JWT + `send_to_production`; source regression; HTTP **NOT VERIFIED** | **PARTIAL** |
| Supabase access control (app client) | Partial | Partial | Partial | Proxy bloqueia mutations em PROD; SELECTs ainda directos; bypass fora da app possível | **PARTIAL** |
| RLS hardening | File only | Source | No (DB) | `015_*.sql` existe; **NOT APPLIED** | **NOT VERIFIED** (DB) |
| Anonymous access restrictions | Partial | Partial | No (DB) | Soft-block writes PROD no client; RLS anon ainda na DB até 015 | **PARTIAL** |
| Backend authorization authority | Yes (PHP paths) | Partial | Partial | Backend decide ownership; frontend não é a barreira | **PARTIAL** (live pending) |
| Frontend not security boundary | Yes (design) | Yes | Partial | `remoteApiAuth` + PHP; UI gates secundários | **COMPLIANT (design)** |
| K/K local-only preservation | Yes | Yes | Local yes | `local-auth.test.ts` + Phase 0; prod Hostinger **NOT VERIFIED** | **PARTIAL** |
| Existing auth compatibility | Yes | Yes | Local yes | Login JWT + K/K path preservados | **PASS (local)** |

Legenda: **Verified** = evidência runtime no ambiente alvo. Código + testes unitários ≠ verified em produção.

---

## 4. Projects API Verification

### Endpoints canónicos

| Path | Auth no código | Authz |
|------|----------------|-------|
| `hostinger/api/projects/index.php` (deploy) | `pimo_authz_require_jwt_user()` no início | view/mutate/bind/list scope |
| `hostinger/api/projects/list.php` | Idem | scope=mine força JWT.sub; scope=all exige view.all |
| `public_html/api/projects/*` | Alinhado (hash igual ao hostinger nesta working tree) | Idem |

### Operações

| Operação | Sem JWT (código) | User A → próprio | User A → User B |
|----------|------------------|------------------|-----------------|
| list | Exige JWT → 401 | Filtra owner=A | Não lista B se scope=mine |
| read/load | Exige JWT; deny → 404 | Allow se owner | Deny 404 |
| create/save POST | Exige JWT + edit.self; bind owner | Allow | Não cria como B (owner forçado) |
| update/rename | mutate check | Allow | Deny 404 |
| delete | mutate check | Allow | Deny 404 |
| thumb GET/POST | view/mutate | Allow | Deny 404 |

### Live HTTP

**NOT VERIFIED** — PHP CLI **NOT AVAILABLE**; Hostinger não contactado.

### Endpoints / vias alternativas

| Via | Achado |
|-----|--------|
| `list.php` fallback do cliente | Também gated (JWT) |
| `src/api/projectsApi.ts` (`apiClient` → `VITE_API_URL/projects`) | Cliente axios separado; **não** é o path PHP Hostinger principal do sync (`/api/projects/index.php`). Risco: se `VITE_API_URL` apontar para API sem ACL, bypass possível — **NOT VERIFIED** em runtime |
| `data/*.json` directo | Bloqueado por `data/.htaccess` (Require all denied) — OK no desenho Apache |
| `thumbs/*` estáticos | `.htaccess` de projects **permite ficheiros físicos**; **não há** `thumbs/.htaccess` → URLs `/api/projects/thumbs/{nome}.jpg` podem ser públicas se o ficheiro existir (**residual P2**) |
| `githubSync.php` | Usa token GitHub server-side; não é API pública de listagem de projectos |

### Cliente

`src/core/projects/projectsApi.ts` + `remoteApiAuth.ts`: sem JWT real / com `local-dev-token` → **não** faz sync remoto. Testado.

---

## 5. IDOR Verification

### Controlos confirmados no código

- Autorização **não** é “ID existe?” — é ownership/`admin`/`view.all`
- `ownerId` do body **sobrescrito** (`pimo_authz_bind_project_owner`)
- Query `ownerId` **ignorada** na listagem
- Failures de acesso a recurso alheio → **404** (anti-enumeration)

### Testes IDOR

Espelho TypeScript (`projectsAuthzRules` + `projectsAuthz.test.ts`): User A↛B **PASS**.

### Live IDOR (dois JWTs reais)

**NOT VERIFIED.**

### Bypass potenciais documentados

| Bypass | Severidade | Notas |
|--------|------------|-------|
| Thumbs estáticos por URL | P2 | Sem auth no ficheiro físico |
| Supabase PostgREST directo com anon key (enquanto 013 activa) | **P0** até 015 | Fora do PHP projects |
| Deploy sem copiar `api/authz` → `_impl/authz` | P0 ops | API devolveria 503 Authz unavailable (fail-closed) se path correcto; se ficheiro antigo sem gate → risco — smoke Hostinger necessário |
| Spoof `localStorage` role no frontend | P3 UI | Backend rejeita `local-dev-token` |

---

## 6. Admin Verification

### UI `/admin` (LegacyApp)

| Actor (código) | Resultado esperado |
|----------------|--------------------|
| Unauthenticated | `Navigate` → `/login` |
| Authenticated sem `canAccessAdminPanel` | Mensagem deny |
| Authorized | `<AdminPanel />` |

Evidência: `src/App.tsx` + `phase1AdminGateRegression.test.ts` **PASS**.  
Browser runtime: **NOT VERIFIED**.

### Rotas admin industriais

`/admin/settings/industrial` e realtime-alerts: `PermissionRoute` + `canAccessAdminPanel` — confirmado no código.

### Backend admin

| API | Controlo |
|-----|----------|
| `api/users` | JWT + `admin.full_access` |
| `api/global-config` PATCH | JWT + `admin.full_access` |
| `api/user-settings` | JWT (self) |

AdminPanel parece sobretudo UI local (tabs / localStorage) — **não** se encontrou `fetch` directo no `AdminPanel.tsx`. Materiais em DEV via Vite middleware (`/api/materials`) — **fora do escopo P0 Phase 1** (plano: deferred); risco residual **P2** em DEV only se middleware não existir em prod.

### Conclusão admin

- UI gate: **implemented + source-tested**  
- Backend users/config: **já protegido** (pré/Phase 0)  
- “Normal user DENY / admin ALLOW” em browser + Hostinger: **NOT VERIFIED**

---

## 7. Industrial Verification

### Caminho alvo (Spec)

```
Frontend → PIMO BFF → JWT → AuthZ → Supabase service role → RLS
```

### Caminho **actual** (código)

```
Frontend → supabase-js (anon key) → PostgREST
         ↘ write proxy (PROD: bloqueia insert/update/upsert/delete)
Frontend → /api/industrial/orders (JWT + permission) → JSON files
```

**BFF industrial completo:** **DEFERRED BY DESIGN** (não Phase 1).

### Orders PHP

- JWT obrigatório  
- POST: `project.send_to_production.self` ou admin  
- GET: filtrado por owner (exceto admin/view.all)  
- `ownerId` do JWT  
Live: **NOT VERIFIED**

### Direct Supabase

| Operação | App client (PROD default) | DB com 013 ainda activa | Após 015 |
|----------|---------------------------|-------------------------|----------|
| INSERT/UPDATE/DELETE | Bloqueado pelo proxy | Ainda permitido via curl/outra app com anon key | Negado a anon |
| SELECT | **Ainda permitido** no app | Permitido a anon | Negado a anon (sem policies substitutas) |

**Risco residual crítico:** até aplicar 015, qualquer detentor da anon key (pública por natureza) pode ler/escrever tabelas da 013 **fora** do proxy da app.

---

## 8. Supabase / RLS Verification

### Migration 013 (estado histórico / presumível em remoto)

Cria, por tabela listada:

- `"anon read …" FOR SELECT TO anon USING (true)`
- `"anon write …" FOR ALL TO anon USING (true) WITH CHECK (true)`

### Migration 015 (ficheiro no repo)

| Aspecto | Valor |
|---------|--------|
| Policies **criadas** | Nenhuma |
| Policies **alteradas** | Nenhuma |
| Policies **removidas** | DROP `"anon write %"` e `"anon read %"` nas 11 tabelas |
| Tabelas | `industrial_work_orders`, `industrial_work_order_tasks`, `industrial_work_order_events`, `industrial_piece_transforms`, `industrial_piece_edges`, `industrial_piece_operations`, `industrial_piece_quality`, `industrial_piece_time_entries`, `industrial_piece_remates`, `system_settings`, `system_events` |
| anon SELECT após 015 | Removido (estas policies) |
| anon INSERT/UPDATE/DELETE | Removido (via DROP write ALL) |
| authenticated access | **Não definido** por 015 — depende de policies pré-existentes noutras migrations |
| service role | Não alterado por 015 (bypass RLS típico no servidor) |

### Riscos residuais RLS

1. **015 não aplicada** → 013 continua (**P0**)  
2. Após 015: app industrial **lê/escreve** via anon pode falhar até BFF — esperado; soft-fail writes em PROD mitiga writes da app  
3. Tabelas industriais **fora** da lista 013/015 (ex.: `profiles`, `departments`, `notifications`, `permission_change_logs`, `workflowLogs`) — **não** cobertas por 015; estado RLS **NOT FULLY INVENTORIED** nesta verificação  
4. Nenhum `service_role` no frontend encontrado (grep) — **PASS** neste ponto

---

## 9. Migration 015 Status

| Pergunta | Resposta |
|----------|----------|
| Só criada no código? | **Sim** |
| Aplicada localmente? | **NOT VERIFIED** / sem evidência |
| Aplicada em staging? | **NOT VERIFIED — STAGING** |
| Evidência real de aplicação? | **Nenhuma** |
| Pode aplicar-se com segurança? | **Sim no sentido de não-destrutiva de dados** (só DROP POLICY). Risco operacional: industrial browser quebra reads/writes até BFF. Staging first — conforme plano. |
| Migrations dependentes? | Depende logicamente de **013** ter corrido (senão DROP é no-op). Não cria dependência para migrations posteriores no repo. |

**NÃO aplicada nesta tarefa** (proibido).

---

## 10. Test Verification

Re-execução nesta sessão:

```text
npx vitest run
  src/core/projects/projectsAuthz.test.ts
  src/core/projects/phase1PhpAclRegression.test.ts
  src/core/projects/phase1AdminGateRegression.test.ts
  src/industrial/infra/supabase/writePolicy.test.ts
  src/local-auth.test.ts
→ 5 files, 24 tests, ALL PASSED
```

| TEST | PURPOSE | RESULT | SECURITY COVERAGE |
|------|---------|--------|-------------------|
| authz User A own project | ownership allow | PASS | IDOR positive |
| authz User A↛B view/mutate | IDOR deny | PASS | **Core IDOR (rules only)** |
| authz User B↛A | IDOR deny | PASS | IDOR |
| authz admin all | admin bypass | PASS | admin ACL |
| authz bind owner spoof | anti-spoof | PASS | C3 |
| authz visitor no create | permission | PASS | authz |
| authz ultra production | send_to_production | PASS | industrial orders perm |
| remote no token | offline | PASS | guest |
| remote local-dev-token | offline | PASS | K/K sem sync |
| remote JWT string | allow sync flag | PASS | client Bearer gate (não valida JWT crypto) |
| PHP: authz helpers | source markers | PASS | presence, not runtime |
| PHP: projects JWT/ownership | source markers | PASS | presence |
| PHP: list.php JWT | source markers | PASS | presence |
| PHP: public_html sync markers | source markers | PASS | deploy copies |
| PHP: industrial orders | source markers | PASS | presence |
| PHP: migration 015 content | source markers | PASS | file integrity |
| PHP: deploy copies authz | source markers | PASS | ops path |
| Admin gate App.tsx | source markers | PASS | UI gate presence |
| writePolicy boolean | smoke | PASS | weak |
| writePolicy PIMO_WRITE_BLOCKED | shape | PASS | client soft-fail |
| allowIndustrialDirectWrite | smoke | PASS | env-dependent |
| local-auth backend reject | Phase 0 | PASS | K/K fail-closed |
| local-auth K/K ok | Phase 0 | PASS | local path |
| local-auth non-K reject | Phase 0 | PASS | local path |

**O que os 24 testes NÃO cobrem:** HTTP 401/403/404 reais; JWT expirado/assinatura inválida em PHP; dois utilizadores reais; AdminPanel browser; Supabase RLS live; Hostinger; CSRF/CORS live.

---

## 11. Build / Typecheck Verification

| Check | Result |
|-------|--------|
| `npx tsc -b` | **PASS** (exit 0) — reconfirmado nesta sessão |
| `npm run build` (vite + copyDeploy) | **NOT RUN** |
| PHP CLI | **NOT AVAILABLE** |
| Suite Phase 1 (24) | **PASS** |

---

## 12. Phase 0 Regression Verification

| Controlo Phase 0 | Estado no código | Testado agora |
|------------------|------------------|---------------|
| `PIMO_JWT_SECRET` fail-closed fora local | Presente em `api/auth/index.php` | Source only |
| `PIMO_APP_ENV` | Presente | Source only |
| K/K só DEV + `/auth/dev-local` | Presente | **3 local-auth tests PASS** |
| K/K rejeitado em `/auth/login` | Presente | Source only |
| `local-dev-token` rejeitado em JWT APIs | Presente (`pimo_jwt_decode` / authz) | Source + client tests |
| Sem `VITE_INTERNAL_API_SECRET` no fluxo quotes | Report Phase 0; não re-auditado linha-a-linha agora | **PARTIAL** |
| Seed admin só local/dev | Presente | Source only |
| Workflow local DEV | Preservado por desenho | Local tests PASS |

Quebra Phase 0 por Phase 1: **não encontrada** nos testes locais executados.

Hostinger env (`PIMO_JWT_SECRET`, `PIMO_APP_ENV=production`): **NOT VERIFIED — HOSTINGER**.

---

## 13. Architecture Compliance

Comparação com `docs/SPEC-ARQUITETURA-AUTH-AUTHZ-SUBSCRIPTIONS.md` (Phase 1 slice):

| Item Spec | Estado |
|-----------|--------|
| Projects API JWT + ownership | **COMPLIANT** (código) |
| Remover CORS `*` em projects | **COMPLIANT** (allowlist via `pimo_authz_cors`) |
| Industrial orders authz | **COMPLIANT** (código) |
| `/admin` gate | **COMPLIANT** (UI) |
| Revogar anon write RLS | **PARTIALLY COMPLIANT** (ficheiro 015; DB não) |
| BFF + service role industrial | **DEFERRED BY DESIGN** |
| Organization/Factory tenancy | **DEFERRED BY DESIGN** |
| Entitlements / subscriptions | **DEFERRED BY DESIGN** |
| Frontend nunca é autoridade | **COMPLIANT** (desenho Phase 1 PHP) |
| Dual identity PHP vs Supabase Auth | **PARTIALLY COMPLIANT** / residual — bridge **DEFERRED** |

---

## 14. Remaining Security Gaps

### P0 Critical

| Gap | Localização | Impacto | Exploitability | Fase | Recomendação |
|-----|-------------|---------|----------------|------|--------------|
| Policies anon 013 ainda presumivelmente activas | Supabase remoto | Read/write industrial sem auth | Alta (anon key pública) | Ops / Phase 1 residual | Aplicar **015** em staging → prod; smoke |
| Deploy Hostinger sem smoke ACL | Hostinger | Pode servir código antigo ou sem authz | Média–Alta | Ops | Checklist §16 |

### P1 High

| Gap | Localização | Impacto | Exploitability | Fase | Recomendação |
|-----|-------------|---------|----------------|------|--------------|
| SELECT industrial directo no browser | `supabase.from().select` | Leitura dados até 015; após 015 falha sem BFF | Alta até 015 | Phase 1 residual / BFF later | 015 + BFF |
| Sem testes HTTP PHP IDOR | CI/local | Falsa confiança nos 24 testes | — | Phase 1 residual | Smoke Hostinger / PHP CI |
| Env Hostinger JWT | Produção | Login 503 ou secret fraco | Ops | Phase 0 residual | Verificar secret ≥32 |

### P2 Medium

| Gap | Localização | Impacto | Exploitability | Fase | Recomendação |
|-----|-------------|---------|----------------|------|--------------|
| Thumbs estáticos sem auth | `/api/projects/thumbs/*` | Enumeração/visualização previews | Média se nomes previsíveis | Phase 1+/hardening | Negar listagem; auth ou signed URLs |
| `src/api/projectsApi.ts` path alternativo | axios `VITE_API_URL` | Confusão / bypass se backend paralelo | Desconhecida | Audit | Confirmar se endpoint existe e tem ACL |
| Materials Vite middleware | DEV | Mutação materiais sem auth em DEV | Local | Deferred | Não expor em prod |
| Quotes / global-config GET públicos | API | Info disclosure limitada | Baixa–média | Deferred | Rate-limit / auth onde necessário |
| Tabelas industriais fora de 013/015 | Supabase | RLS desconhecido | **NOT VERIFIED** | Audit RLS full | Inventário completo policies |

### P3 Low

| Gap | Localização | Impacto | Exploitability | Fase | Recomendação |
|-----|-------------|---------|----------------|------|--------------|
| Spoof UI role em localStorage | Frontend | Só UX | N/A se APIs OK | — | Já mitigado no backend |
| Dual identity industrial | Spec | Confusão operacional | — | Phase 3–4 / BFF | Bridge |

---

## 15. Staging Requirements

Antes de considerar Phase 1 “segura em ambiente partilhado”:

1. Deploy artefacto com `dist/api/_impl/authz/resourceAccess.php`  
2. `PIMO_APP_ENV=staging|production` + `PIMO_JWT_SECRET` ≥32  
3. Aplicar migration **015** em **staging** Supabase  
4. Validar: industrial reads/writes app (esperar falhas controladas)  
5. Dois users JWT: IDOR projects  
6. Admin deny/allow  
7. K/K rejeitado  
8. Só depois: prod + 015

---

## 16. Hostinger Smoke Test Checklist

**Estado desta verificação:** **NOT VERIFIED — HOSTINGER** (nenhum item executado aqui).

```text
[ ] Production login (JWT real)
[ ] Protected API (/me, users deny non-admin)
[ ] Projects API sem Bearer → 401
[ ] Projects API list/load próprio OK
[ ] Unauthorized project access (User A → B) → 404
[ ] Admin access: anónimo → login/deny; user normal → deny; admin → allow
[ ] Industrial API orders sem token → 401
[ ] Industrial API POST sem permission → 403
[ ] Supabase operations (anon curl SELECT/INSERT nas tabelas 013) — estado pré/pós 015
[ ] K/K rejected (login + /auth/dev-local)
[ ] JWT validation (token inválido / local-dev-token → 401)
[ ] Error responses (sem stack traces / sem enumeração)
[ ] Authz library loaded (não 503 "Authz library unavailable")
[ ] CORS não é * em projects/orders
```

---

## 17. Production Readiness

| Gate | Estado |
|------|--------|
| **PHASE 1 CODE COMPLETE** | **YES** (face ao plano oficial) |
| **TEST COMPLETE** | **YES** (suite Phase 1 local 24/24 + tsc) |
| **STAGING VERIFIED** | **NO** — **NOT VERIFIED — STAGING** |
| **PRODUCTION VERIFIED** | **NO** — **NOT VERIFIED — HOSTINGER** |
| **PHASE 1 SECURITY VERIFIED** | **NO** (faltam runtime + 015) |

Definições usadas:

- **CODE COMPLETE:** controlos no repositório conforme plano  
- **TEST COMPLETE:** testes automatizados da fase passam localmente  
- **STAGING VERIFIED:** evidência em staging (HTTP + DB pós-015)  
- **PRODUCTION VERIFIED:** evidência em Hostinger/prod  

---

## 18. Final Verdict

# PHASE 1 PARTIALLY VERIFIED

### Porquê não “VERIFIED”

1. Enforcement PHP **não** foi exercitado com HTTP real.  
2. Hostinger **não** foi testado.  
3. Migration **015** está só no código — RLS anon da auditoria **não** está comprovadamente fechada na base.  
4. Os 24 testes cobrem regras/espelhos/regressão de fonte — **não** equivalem a security verification de produção.

### Porquê não “NOT VERIFIED”

1. Código e plano estão coerentes com a auditoria P0 Phase 1.  
2. Controlo de Projects/orders/admin/K/K está **presente** e coberto por testes locais.  
3. Não há evidência, nesta revisão, de regressão Phase 0 nos testes executados.

### Podemos avançar para Phase 2?

**Sim, com condições:**

- Phase 2 (Authentication Hardening) pode avançar em paralelo no código.  
- **Não** tratar produção como “ACL fechada” até: smoke Hostinger + decisão explícita sobre **015** (staging first).  
- Gaps P0 de RLS remota e smoke Hostinger devem constar do plano ops **antes** de afirmar readiness.

---

## 19. Git status (informativo)

Executado no fim desta tarefa (sem limpar working tree). Esperado:

- Alterações **pré-existentes** (Phase 0, CNC examples, quotes, etc.)  
- Alterações **Phase 1** (authz, projects, App, industrial, migration 015, testes, reports)  
- **Novo nesta verificação:** `docs/PHASE-1-FINAL-VERIFICATION-REPORT.md`

Sem commit / sem push.

---

*Fim da verificação. STOP — sem implementação, sem Phase 2, sem alteração à 015.*
