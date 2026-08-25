# PHASE 1 — API / ACL P0 — Implementation Plan (Official)

**Documento:** Plano executivo multi-agente  
**Data:** 24 de Agosto de 2026  
**Pré-requisito:** Phase 0 concluída (`docs/PHASE-0-IMPLEMENTATION-REPORT.md`)  
**Fontes:** Auditoria Auth/Authz, Spec Arquitectura, inventário de código (Ago 2026)  
**Estado:** OFFICIAL — fonte de verdade para implementação Phase 1

---

## 0. Agent execution rules (obrigatório)

Nenhum agente pode:

- Executar tarefas fora do seu **TASK ID**
- Alterar módulos fora do escopo da tarefa
- Saltar dependências
- Remover controlos de segurança
- Desactivar testes
- Fazer migrations destrutivas de **dados**
- Alterar secrets / rotação sem autorização
- `git reset` / `checkout .` / `clean` / force push / history rewrite
- Apagar trabalho pré-existente alheio
- Avançar para Phase 2–8

Cada agente deve: ler este plano + Spec + Phase 0 report → verificar pré-condições → implementar só a tarefa → testar → documentar.

---

## 1. Executive intent

**WHAT:** Fechar acesso não autorizado a Projects API, industrial orders PHP, `/admin` legado, e anon write Supabase (RLS 013).  
**WHY:** Broken Access Control / IDOR (OWASP A01) — dados de clientes e produção expostos.  
**NOT in scope:** Organization/Factory completo, RBAC extra/removed, Entitlements, Subscriptions, BFF industrial completo, refresh tokens.

**Transitional ownership model (compatível com Phase 3):**

```
JWT.sub  ===  project.ownerId   (bind server-side)
admin.full_access | project.view.all  → listagem ampla
guest-* / local-dev-token  → SEM sync remoto (offline local only)
```

Não criar tabela Organization nesta fase.

---

## 2. API inventory (validated)

| ID | METHOD | PATH | Auth now | Risk | Phase 1 action |
|----|--------|------|----------|------|----------------|
| A01 | * | `/api/projects/index.php` | none | **P0** | JWT + ownership |
| A02 | GET | `/api/projects/list.php` | none | **P0** | JWT + ownership |
| A03 | GET/POST | `/api/industrial/orders` | none | **P0** | JWT + permission |
| A04 | * | Supabase industrial tables (anon) | anon ALL | **P0** | Revoke anon write (+ prefer revoke open read) |
| A05 | UI | `/admin` LegacyApp | none | **P0** | ProtectedRoute + permission |
| A06 | UI | `/admin/settings/industrial` | Protected only | **P1** | PermissionRoute |
| A07–A12 | auth/users/settings/global PATCH | JWT | OK | Keep |
| A13 | POST quotes | public + server secret | P2 | Defer rate-limit |
| A14 | GET global config | public | P2 | Defer |
| A15 | Vite materials POST | none (dev) | P2 | Defer (dev-only risk) |

---

## 3. Tasks

### P1-BASE-001 — Shared PHP authz helpers  
- **OBJECTIVE:** Funções partilhadas authenticate + permissions + ownership  
- **PRECONDITIONS:** Phase 0 JWT fail-closed  
- **FILES:** `api/authz/resourceAccess.php` (NEW), require `api/auth/index.php`  
- **IMPLEMENTATION:**  
  - `pimo_authz_require_jwt_user(): array` → 401/503  
  - reject `local-dev-token`  
  - `pimo_authz_effective_permissions(user)`  
  - `pimo_authz_has(user, perm)` / `pimo_authz_is_platform_admin`  
  - `pimo_authz_can_access_project(user, project, action: view|mutate)`  
  - ownership: `project.ownerId === user.id` OR admin/view.all for view; mutate só owner OU admin.full_access  
- **TESTS:** unit PHP or TS mirror; integration via projects tests  
- **ACCEPTANCE:** Helpers usados por Projects + industrial orders  
- **STATUS:** done

### P1-API-001 — Projects API authentication  
- **OBJECTIVE:** Qualquer mutação/listagem/load exige JWT válido  
- **FILES:** `hostinger/api/projects/index.php`, `public_html/api/projects/index.php`, `list.php` (ambos)  
- **IMPLEMENTATION:** CORS allowlist (não `*`); OPTIONS ok; require JWT no início de handlers  
- **ACCEPTANCE:** Sem Bearer → 401  
- **DEPENDENCIES:** P1-BASE-001  
- **STATUS:** done

### P1-API-002 — Projects resource authorization + IDOR  
- **OBJECTIVE:** User A não lê/altera/apaga projecto de User B  
- **IMPLEMENTATION:**  
  - POST save: forçar `ownerId`/`ownerName` a partir do JWT `sub` (ignorar body spoof)  
  - load/update/delete: carregar project → `can_access` → senão **404** (anti-enumeration)  
  - list `scope=mine`: filtrar só `ownerId === sub` (ignorar query ownerId do cliente)  
  - list `scope=all`: só se `project.view.all` OU `admin.full_access` (não `project.view.factory` ainda sem Factory)  
- **ACCEPTANCE:** Testes IDOR PASS  
- **STATUS:** done

### P1-API-003 — Projects client Bearer + offline guests  
- **OBJECTIVE:** Cliente autenticado envia `Authorization`; guest/K/K não sync remoto  
- **FILES:** `src/core/projects/projectsApi.ts`, sync helpers se necessário, `currentUser`  
- **IMPLEMENTATION:** Ler `pimo_auth_token`; se ausente ou `local-dev-token` → skip remote / return offline  
- **ACCEPTANCE:** Save autenticado com Bearer; guest só offline  
- **STATUS:** done

### P1-ADMIN-001 — Gate `/admin` LegacyApp  
- **OBJECTIVE:** Anónimo / sem permission não vê AdminPanel  
- **FILES:** `src/App.tsx` (LegacyApp), opcionalmente `AdminPanel.tsx`  
- **IMPLEMENTATION:** Se `pathname=/admin` e !auth ou !`canAccessAdminPanel` → Navigate `/login` ou mensagem deny  
- **ACCEPTANCE:** Abrir `/admin` sem sessão → login/deny  
- **STATUS:** done

### P1-ADMIN-002 — Industrial admin routes PermissionRoute  
- **FILES:** `src/App.tsx` routes settings/industrial  
- **IMPLEMENTATION:** Envolver com `PermissionRoute check={canAccessAdminPanel}`  
- **STATUS:** done

### P1-IND-001 — Industrial orders PHP authz  
- **FILES:** `api/industrial/orders/index.php`  
- **IMPLEMENTATION:** require JWT; POST exige `project.send_to_production.self` OU admin; GET exige autenticado (admin vê todos; outros filtrar por owner se campo existir, senão só admin/list própria se houver ownerId no JSON)  
- **ACCEPTANCE:** Sem token → 401  
- **STATUS:** done

### P1-IND-002 — Client industrial orders Bearer  
- **FILES:** `src/core/industrial/industrialOrdersApi.ts` (ou equivalente)  
- **STATUS:** done

### P1-RLS-001 — Revoke industrial anon write (migration file)  
- **OBJECTIVE:** Remover policies `anon write … FOR ALL` da 013  
- **FILES:** `supabase/migrations/015_revoke_industrial_anon_write.sql` (NEW)  
- **IMPLEMENTATION:** DROP POLICY anon write; opcionalmente DROP anon read aberto (recomendado: drop write primeiro; drop read aberto também para dados sensíveis)  
- **SECURITY:** Não apagar tabelas/dados  
- **NOTE:** **Não executar** contra prod automaticamente; ops aplica. Cliente deve falhar gracefully.  
- **STATUS:** done (file); NOT APPLIED to remote DB

### P1-RLS-002 — Soft-fail industrial writes when RLS denies  
- **FILES:** `writePolicy.ts`, `industrial/infra/supabase/client.ts`  
- **IMPLEMENTATION:** Flag off em PROD; proxy `from()` bloqueia insert/update/upsert/delete com `PIMO_WRITE_BLOCKED`  
- **STATUS:** done

### P1-TEST-001 — Automated IDOR + auth tests  
- **FILES:** `src/core/projects/projectsAuthz.test.ts` (+ PHP smoke if possible)  
- **ACCEPTANCE:** Ver §5  
- **STATUS:** done (TS); PHP live NOT VERIFIED

### P1-DOC-001 — Implementation report  
- **FILES:** `docs/PHASE-1-IMPLEMENTATION-REPORT.md`  
- **STATUS:** done

---

## 4. Implementation order

1. P1-BASE-001  
2. P1-API-001 + P1-API-002  
3. P1-API-003  
4. P1-ADMIN-001 + P1-ADMIN-002  
5. P1-IND-001 + P1-IND-002  
6. P1-RLS-001 + P1-RLS-002  
7. P1-TEST-001  
8. P1-DOC-001  

---

## 5. Acceptance criteria (Phase 1 PASS)

| # | Criterion |
|---|-----------|
| C1 | Projects API sem JWT → 401 |
| C2 | User A JWT não load/save/delete projecto de User B → 404/403 |
| C3 | `ownerId` no body não eleva privilégios |
| C4 | `scope=all` sem permission → 403 |
| C5 | `/admin` sem auth/permission → deny |
| C6 | Industrial orders sem JWT → 401 |
| C7 | Migration file revoga anon write; documentado NOT APPLIED até ops |
| C8 | K/K local continua (DEV + middleware); rejeitado em APIs JWT |
| C9 | Offline guest save local continua |
| C10 | Testes IDOR automatizados PASS |

---

## 6. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Guest sync remoto deixa de funcionar | Intencional — offline only |
| Industrial Supabase writes quebram após aplicar 015 | Soft-fail + BFF Phase posterior; aplicar 015 em staging primeiro |
| Hostinger vs public_html drift | Alterar ambos / deploy path hostinger |
| Deploy sem JWT secret (Phase 0) | Já fail-closed |

---

## 7. Deferred (NOT Phase 1)

- Full BFF + service role  
- Factory / organizationId  
- extraPermissions / removedPermissions  
- Entitlements  
- Quotes rate-limit  
- Materials Vite POST hardening  
- Email verification / refresh tokens  

---

*Fim do plano oficial Phase 1.*
