# Relatório de Auditoria — Authentication, Authorization & Subscriptions

**Projeto:** pimo-criativo  
**Data:** 24 de Agosto de 2026  
**Tipo:** Análise exclusivamente documental (sem alterações de código além deste ficheiro)  
**Âmbito:** Autenticação, autorização (RBAC), organizações/fábricas, sessões/tokens, APIs, frontend, industrial/Supabase, subscrições/entitlements, segurança (OWASP)  
**Autor da análise:** Engenheiro de Software / Arquiteto de Sistemas / AppSec (modo auditoria)

---

## Tabela de estado (visão rápida)

| Área | Estado Atual | Severidade | Observação |
|------|--------------|------------|------------|
| Authentication | Parcial | High | Login/registo/JWT PHP funcionam; reset/change/email verify inexistentes; bypass local `K/K`; credenciais default |
| Authorization | Parcial / Problemático | Critical | RBAC de produto no cliente + mapa PHP; APIs de projetos/industrial sem enforcement real |
| Roles | Parcial | High | 5 roles do Master Plan no PHP; roles industriais separados; UIs de gestão são mocks |
| Permissions | Parcial | High | Mapa role→permissions existe; `extraPermissions`/`removedPermissions` do Master Plan **não implementados** |
| Organizations / Factories | Inexistente (conceitual) | Medium | Master Plan define “Fábrica”; código quase sem modelo persistido |
| Teams | Inexistente | Low | Não há modelo de equipas |
| Subscriptions | Inexistente (marketing only) | Medium | Landing com preços Free/Pro/Ultra/Ultra+; zero backend/billing |
| Entitlements | Inexistente | Medium | Feature flags industriais hardcoded; sem entitlements por plano |
| Security | Problemático / Crítico | Critical | Projects API aberta; industrial anon RLS write; JWT secret fallback; `/admin` legado sem gate |
| Sessions / Tokens | Parcial | High | JWT HS256 24h em `localStorage`; sem refresh/revogação server-side |
| Audit / Logs | Parcial | Medium | Audit trail industrial previsto; Events System de produto não implementado |

---

# 1. Executive Summary

O pimo-criativo **já possui um núcleo de autenticação e RBAC de produto**, mas **não possui um sistema completo, coerente e seguro** de Authorization + Organizations + Subscriptions.

### O que existe (resumo factual)

1. **Auth de produto (PHP + JWT + JSON):** login, registo público (`visitor`/`pro`), `/me`, CRUD de users (só `admin.full_access`), settings de utilizador autenticado, PATCH de global-config (admin).
2. **RBAC de produto no frontend:** `AuthProvider`, `permissionsMap`, `rbacHelpers`, `ProtectedRoute`, `PermissionRoute`.
3. **Auth industrial paralelo (Supabase):** código de `supabase.auth` + roles industriais (`admin`/`manager`/`operador`/`worker`/`guest`) + RLS SQL — **desalinhado** do JWT PHP e, em migração crítica, **aberto a `anon`**.
4. **Marketing de planos** na Landing (Free / Pro / Ultra / Ultra+) — **sem** billing, entitlements ou enforcement.

### Classificação por área

| Área | Classificação |
|------|---------------|
| Authentication | **Parcial** (funcional no happy path; incompleta e com riscos) |
| Authorization | **Problemático** → **Crítico** nas APIs de dados |
| Roles | **Parcial** (dois universos de roles) |
| Permissions | **Parcial** (mapa estático; sem overrides) |
| Organizations / Factories | **Inexistente** (só documentação + campos residuais) |
| Subscriptions | **Inexistente** (só UI marketing) |
| Entitlements | **Inexistente** |
| Security overall | **Crítico** |

### Veredicto executivo

O Master Plan descreve um modelo maduro (roles, fábrica, permissões efetivas, UI por plano). A implementação actual cobre **apenas uma fatia da Fase 1**, com **lacunas graves de enforcement no backend** e **dois sistemas de identidade** que não se unificam. Continuar a construir funcionalidades de produto/industrial **sem fechar o controlo de acesso nas APIs** amplia a superfície de ataque e o custo de migração.

---

# 2. Arquitetura Atual

## 2.1 Vista de alto nível (como realmente está)

```
┌─────────────────────────────────────────────────────────────────┐
│ Frontend React (Vite)                                           │
│  AuthProvider (JWT localStorage) + RBAC helpers                 │
│  ProtectedRoute / PermissionRoute (UI only)                     │
│  LegacyApp / AdminPanel (/admin sem gate de rota)               │
│  Industrial UI → Supabase client (anon key)                     │
└───────────────┬─────────────────────────────┬───────────────────┘
                │                             │
                ▼                             ▼
┌───────────────────────────┐   ┌─────────────────────────────────┐
│ Backend PHP (Hostinger)   │   │ Supabase (PostgreSQL + Auth)    │
│ api/auth → users.json JWT │   │ profiles + industrial tables    │
│ api/users (admin CRUD)    │   │ RLS policies (+ anon open 013)  │
│ api/user-settings (JWT)   │   │ supabase.auth (pouco usado)     │
│ api/global-config         │   └─────────────────────────────────┘
│ public_html/api/projects  │
│   ★ SEM autenticação ★    │
│ api/industrial/orders     │
│   ★ SEM autenticação ★    │
└───────────────────────────┘
```

## 2.2 Componentes identificados

| Camada | Tecnologia / localização | Papel actual |
|--------|--------------------------|--------------|
| Frontend | React 19 + React Router (`src/App.tsx`) | SPA; guards de UI |
| Auth client | `src/auth/*`, `src/api/authApi.ts`, `src/local-auth.ts` | Sessão JWT / bypass local |
| API client | `src/api/apiClient.ts` (Axios + `VITE_API_URL`) | Bearer token para auth/users/settings |
| Projects sync | `src/core/projects/projectsApi.ts` (fetch same-origin) | **Sem** Authorization header |
| Backend auth | `api/auth/index.php` | JWT HS256 + `users.json` |
| Backend users | `api/users/index.php` | CRUD admin |
| Backend projects | `public_html/api/projects/index.php` (+ hostinger mirror) | CRUD JSON **público** |
| Industrial data | `@supabase/supabase-js` + migrations SQL | Persistência WO/peças |
| ORM | **Nenhum** no PHP; PostgREST via Supabase JS no industrial | — |
| Subscriptions | Landing marketing only | Sem serviços |

## 2.3 Providers / mecanismos

- **Authentication provider principal:** JWT custom HS256 em PHP (não Auth0/Clerk/Firebase; Supabase Auth existe só no pacote industrial e não é o SSOT da app).
- **Authorization mechanism principal (produto):** RBAC baseado em lista de strings de permission calculadas no servidor a partir do `role`, espelhadas no cliente.
- **Authorization industrial:** funções TypeScript por role + políticas RLS (parcialmente anuladas por políticas `anon`).

## 2.4 Persistência

| Dados | Store |
|-------|--------|
| Users produto | `api/data/users.json` (criado em runtime; não versionado) |
| User settings | `api/data/user-settings/user-settings-<id>.json` |
| Global settings | `api/data/global-settings.json` |
| Projects | `public_html/api/projects/data/project-*.json` |
| Industrial orders (PHP) | `api/industrial/orders/data/*.json` |
| Industrial runtime | Tabelas Supabase |

---

# 3. Authentication Atual

## 3.1 Login — EXISTE (parcial)

**Fluxo real:**

1. UI: `src/pages/LoginPage.tsx` → `useAuth().login(email, password)`.
2. Bypass local: `src/local-auth.ts` — se `email=== "K"` e `password=== "K"`, grava `pimo_session` com token `local-dev-token` e role `"industrial"`, **sem** chamar API e **sem** permissions.
3. Caso contrário: `POST /auth/login` (`src/api/authApi.ts` → `api/auth/index.php` → `pimo_auth_handle_login`).
4. PHP: `password_verify` contra `passwordHash`; emite JWT (`sub`, `email`, `iat`, `exp`).
5. Cliente chama `GET /me`, guarda `pimo_auth_token`, `pimo_auth_user`, `pimo_auth_permissions` em **localStorage**.

**Ficheiros:** `AuthProvider.tsx`, `authApi.ts`, `api/auth/index.php`, `LoginPage.tsx`, `local-auth.ts`.

**Problemas:**

- `LoginPage` pré-preenche `admin@pimo.local` / `admin123` (credenciais default do seed PHP).
- Bypass `K/K` presente no bundle de produção (não está atrás de `import.meta.env.DEV`).
- Logout é apenas limpeza local — sem endpoint de invalidação.

## 3.2 Registo — EXISTE (parcial)

- Público: `POST /auth/register` — roles normalizados para `visitor` ou `pro` apenas (`pimo_register_normalize_public_role`).
- Password mínima: 6 caracteres.
- Cria ficheiro de user-settings vazio.
- UI: `RegisterPage` + `RegisterUserForm` + **códigos de convite mock** (`inviteCodesMock.ts`) — validação **só no cliente**; servidor **não** valida invite codes nem aplica permissions do convite.

## 3.3 Logout — EXISTE (cliente only)

- `AuthProvider.logout` → limpa state + localStorage + sessão local.
- Sem blacklist JWT, sem cookie de sessão server-side.

## 3.4 Password reset — INEXISTENTE (UI stub)

- `ForgotPasswordPage.tsx`: submit apenas seta `submitted=true`; **nenhuma** chamada API/email.
- Variáveis SMTP em `.env.example` existem, mas **não** há fluxo ligado ao auth.

## 3.5 Password change — PARCIAL

- Admin pode alterar password de qualquer user via `PUT /users?id=...` (campo `password`).
- Utilizador comum **não** tem endpoint “change my password”.
- Sem verificação de password actual.

## 3.6 Email verification — INEXISTENTE

- Conta fica activa imediatamente após registo.

## 3.7 Session management — PARCIAL / PROBLEMÁTICO

| Aspecto | Estado |
|---------|--------|
| Persistência | `localStorage` (token + user + permissions) |
| Cookies httpOnly | Não usados para auth |
| Refresh tokens | Não existem |
| TTL JWT | 86400 s (24h) — `PIMO_JWT_TTL` |
| Revogação | Não existe (token válido até `exp`) |
| Revalidação no boot | **Não**: restaura de localStorage sem chamar `/me` |
| Sessão local bypass | `pimo_session` independente do JWT |

**Impacto:** permissions/role em cache podem ficar stale; token roubado de XSS funciona até expirar; logout noutro dispositivo não invalida.

## 3.8 Tokens / JWT

- Algoritmo: HS256 implementado manualmente em PHP (`pimo_jwt_encode` / `pimo_jwt_decode`).
- Secret: `getenv('PIMO_JWT_SECRET')` **com fallback hardcoded** no código-fonte.
- Claims: `sub`, `email`, `iat`, `exp` — **role/permissions não vão no JWT** (recalculados em `/me` e users API) — ponto positivo parcial.
- Cliente: `Authorization: Bearer <token>` via `setApiToken`.

## 3.9 Proteções existentes (auth)

| Controlo | Presente? |
|----------|-----------|
| password_hash / password_verify | Sim |
| CORS allowlist em auth/users | Sim (`pimo.pro`) |
| Rate limiting login | **Não** |
| Lockout / captcha | **Não** |
| Constant-time compare HMAC | Sim (`hash_equals`) |
| Validação email no registo | Sim (`filter_var`) |
| Unicidade email/username | Sim (409) |

## 3.10 Conta admin default — EXISTE (risco)

`pimo_ensure_default_admin()` cria `admin@pimo.local` / `admin123` se o ficheiro de users não tiver esse email. Corre em login e registo.

---

# 4. Authorization Atual

## 4.1 Modelo de produto (RBAC)

**Roles oficiais (Master Plan + PHP map):** `visitor`, `pro`, `ultra`, `ultra+`, `admin`.

**Mapa efectivo (`pimo_role_permissions_map`):**

| Role | Permissions |
|------|-------------|
| admin | `admin.full_access`, `project.view.all`, `project.edit.self`, `user.manage.below` |
| ultra+ | `project.view.factory`, `user.manage.below`, `project.edit.self` |
| ultra | `project.edit.self`, `project.view.self`, `project.send_to_production.self` |
| pro | `project.edit.self`, `project.view.self` |
| visitor | `project.view.self` |

**Cliente:** `src/auth/permissionsMap.ts` espelha estas chaves; `rbacHelpers.ts` deriva capacidades UI (`canEditProject`, `canAccessAdminPanel`, etc.).

**Fórmula Master Plan:**  
`effective = (rolePermissions + extraPermissions) - removedPermissions`  
**Código actual:** apenas `rolePermissions`. Campos `extraPermissions` / `removedPermissions` **não existem** em users.json nem no PHP.

## 4.2 Onde a autorização É aplicada

| Local | Mecanismo |
|-------|-----------|
| Rotas `/dashboard`, `/projects`, `/industrial/*` (maioria) | `ProtectedRoute` (só “há token?”) |
| `/admin/users`, `/admin/global-settings` | `PermissionRoute` + `hasFullAccess` |
| Várias rotas `/admin/*` | `PermissionRoute` + `canAccessAdminPanel` |
| `GET/PATCH` user-settings | JWT obrigatório; scoped ao `sub` |
| `PATCH` global-config | JWT + `admin.full_access` |
| CRUD `/users` | JWT + `admin.full_access` |
| UI preços/financeiro | `hasFullAccess` (esconder/mostrar) |
| ProjectsPage mutações | helpers `canEditProject` (UI) |

## 4.3 Onde a autorização NÃO é aplicada (lacunas críticas)

| Local | Problema |
|-------|----------|
| `public_html/api/projects/index.php` | Load/save/update/delete/list **sem JWT**; CORS `*`; `scope=all` lista tudo; `ownerId` enviado pelo cliente |
| `api/industrial/orders/index.php` | GET/POST **sem auth**; CORS `*` |
| Cliente `remoteSaveProject` | Não envia `Authorization` |
| Rota `/admin` (LegacyApp) | Renderiza `AdminPanel` **sem** `ProtectedRoute`/`PermissionRoute` |
| `/admin/settings/industrial` e realtime-alerts | Dentro de `ProtectedLayout` mas **sem** `PermissionRoute` |
| Industrial Supabase | Policies `anon` ALL (migration 013) → bypass efectivo de RLS autenticado |
| ManageRoles / ManagePermissions pages | Estado React local; **não** persistem nem alteram backend |
| Invite codes | Só UI; servidor ignora |

## 4.4 Frontend vs Backend (padrão clássico Broken Access Control)

**Sim, o padrão existe de forma sistémica:**

- UI esconde/bloqueia acções com `hasPermission` / `canEditProject`.
- API de projetos aceita leitura/escrita por ID sem provar identidade nem ownership.
- Qualquer pessoa que conheça (ou enumere) um `project-*.json` id pode carregar/alterar/apagar.
- Listagem `scope=all` sem auth devolve metadados de todos os projetos.

Isto é **Broken Access Control / IDOR** (OWASP A01).

## 4.5 RBAC vs ABAC

- **RBAC:** sim, no produto (role → permissions).
- **ABAC:** não formal; há checks ad-hoc de ownership (`projectOwnerId === currentUserId`) só no frontend.
- **Industrial:** RBAC por role + alguma lógica por `departmentId` (ABAC leve), mas enfraquecida pela camada de dados aberta.

## 4.6 Dois universos de roles (conflito arquitectural)

| Universo | Roles | SSOT |
|----------|-------|------|
| Produto / Master Plan | visitor, pro, ultra, ultra+, admin | PHP `users.json` + JWT |
| Industrial / Supabase | admin, manager, operador, worker, guest | `profiles.role` |
| Bypass local | `"industrial"` | `local-auth.ts` |

Não há bridge oficial entre JWT PHP e `supabase.auth`. Páginas industriais usam `useAuth()` (PHP) sobretudo para `user.id` em UI, enquanto a persistência industrial vai pelo cliente anon Supabase.

## 4.7 Guards / Middleware

- Frontend: `ProtectedRoute`, `PermissionRoute` (inline em `App.tsx`).
- PHP: funções `pimo_bearer_token` + decode JWT por endpoint (não há middleware framework).
- Sem API gateway / WAF application-level rate limits observados no código.

---

# 5. Users / Organizations / Teams

## 5.1 Users — EXISTE (produto)

Modelo implícito em `users.json`:

```text
id, email, username, passwordHash, role, createdAt
```

CRUD admin: `api/users/index.php` + `src/api/usersApi.ts` + `UsersAdminPage`.  
Registo público limitado a visitor/pro.  
Admin CRUD aceita **qualquer string** em `role` (sem whitelist server-side) → risco de roles inventados ou privilege paths futuros.

## 5.2 Organizations / Companies — INEXISTENTE

Não há tabela/ficheiro `organizations` / `companies` no fluxo de produto.

## 5.3 Factory (Fábrica) — CONCEITO DOCUMENTADO, IMPLEMENTAÇÃO AUSENTE/RESIDUAL

- Master Plan: fábrica como escopo de ultra+.
- Código: `factoryId: string | null` aparece em tipo `src/api/projectsApi.ts` (cliente Axios legado), mas a API PHP de projetos **não** modela fábrica de forma autoritativa.
- `inviteCodesMock` menciona “Fábrica” apenas como label de marketing de convite.
- Sem endpoints `/factory/*`.

## 5.4 Teams — INEXISTENTE

## 5.5 Projects — EXISTE (persistência fraca em isolamento)

- Persistidos como JSON por id.
- Campos `ownerId` / `ownerName` atribuídos pelo cliente (`getCurrentProjectUser` / guest id).
- Isolamento real: **não enforced** no servidor.

## 5.6 Memberships — INEXISTENTE

Não há membership user↔org↔role.

## 5.7 Estrutura recomendada para crescimento (ver também §12)

```text
User
  └─ Membership (userId, organizationId, roleId, status)
Organization (= Factory no vocabulário PIMO)
  └─ Subscription (planId, status, period)
  └─ Entitlement overrides
Project
  └─ organizationId + ownerUserId + visibility
```

Manter o termo **Factory** do Master Plan como tipo de Organization no domínio PIMO, para não partir a documentação de produto.

---

# 6. Subscription System Atual

## 6.1 O que existe

| Elemento | Estado |
|----------|--------|
| Landing pricing cards Free / Pro / Ultra / Ultra+ | Marketing UI (`LandingPage.tsx`) |
| Preços anunciados | Free €0/mês; Pro €10/mês; Ultra €300/mês; Ultra+ €5000/ano |
| Stripe / billing provider | **Não encontrado** |
| Tabelas subscription/plan | **Não** |
| Usage metering | **Não** |
| Feature gating por plano | **Não** (roles misturam-se com ideia de plano no Master Plan) |
| Trial | **Não** |

## 6.2 Feature flags existentes (não são entitlements de subscrição)

- Industriais: `src/industrial/config/featureFlags.ts` — constantes booleanas no código.
- Events System (`features.eventsSystem`): documentado; **sem implementação de produto** (confirmado em planos de limpeza).

## 6.3 Relação actual Role ↔ “Plano”

Na prática, o produto trata **role** quase como **plano** (visitor≈free, pro≈pro, ultra/ultra+≈planos altos). Isto é frágil: roles de autorização e planos comerciais devem separar-se (ver §7 e §13).

---

# 7. Relação entre Subscription, Roles, Permissions e Features

## 7.1 Relação ACTUAL (descoberta)

```text
User.role  ──►  role_permissions_map  ──►  permissions[]  ──►  UI checks
                                                      └──►  (poucos) PHP checks

Subscription / Plan / Entitlement / Usage ──►  NÃO EXISTEM

Factory / Organization ──►  NÃO EXISTEM (só docs)

InviteCode.permissions ──►  só mock UI, ignorado no servidor
```

## 7.2 O que o Master Plan pretende (ainda não implementado)

```text
User (role + extraPermissions - removedPermissions)
  └─ Factory scope (ultra+)
  └─ UI bloqueada com mensagens de upgrade por “plano”
```

## 7.3 Arquitectura recomendada (Entitlements, não “if plan === Pro”)

Separar **três eixos**:

1. **Identity & Org:** User, Organization(Factory), Membership  
2. **Authorization:** Role → Permission (o que o utilizador *pode* fazer no domínio, ex. `project.edit.self`)  
3. **Commercial access:** Subscription → Plan → Entitlements/Features + Limits (o que a org *tem direito* a usar, ex. `feature.cnc_export`, `limit.projects=50`)

Regra de decisão na API:

```text
allow = authenticated
     AND membership.active
     AND hasPermission(action, resource)
     AND hasEntitlement(feature)   // da subscription da org (+ overrides)
     AND withinUsageLimit(metric)
```

**Porquê entitlements e não checks por nome de plano?**  
Permite mudar catálogo de planos, campanhas, trials e overrides enterprise **sem** reescrever `if (plan === 'ultra')` espalhado pelo código.

---

# 8. Database Analysis

## 8.1 Produto (PHP / ficheiros) — não é BD relacional

| “Tabela” | Campos | Constraints |
|----------|--------|-------------|
| users.json | id, email, username, passwordHash, role, createdAt | Unicidade lógica email/username no código; sem índices reais; race conditions em escrita concorrente |
| user-settings-*.json | updatedAt, settings | Path sanitizado por regex hex |
| project-*.json | project payload completo | id sanitizado; **sem ACL** |
| global-settings.json | version, updatedAt, settings | PATCH admin |

**Problemas:** escalabilidade fraca; ausência de FK; backups/auditoria limitados; `users.json` é single point of failure; password hashes OK, mas ficheiro no disco do hosting se exposto = compromisso total.

## 8.2 Supabase (industrial)

Tabelas relevantes (migrations):

- `profiles` (id, email, role, default_department, is_active, …)
- `permission_change_logs` (audit de mudanças de role)
- `work_orders`, `work_order_tasks`, departments, industrial_* piece/work order tables, `system_settings`, `system_events`, …

**RLS:**

- Migrations 003/004: policies por role autenticado.
- **Migration 013:** cria policies `anon` SELECT/ALL `USING (true)` em tabelas industriais críticas.

**Impacto de 013:** com `VITE_SUPABASE_ANON_KEY` no browser (e commitada em `.env.production`), o isolamento RLS por role fica **ineficaz** para quem use a anon key directamente.

## 8.3 Campos / problemas

| Problema | Severidade |
|----------|------------|
| Sem `organization_id` / `factory_id` canónico em users/projects produto | High (bloqueia Fase 3) |
| Sem `extraPermissions` / `removedPermissions` | Medium |
| `profiles.role` industrial ≠ roles produto | High (dual identity) |
| Anon full write | Critical |
| Users role string sem enum/check constraint | Medium |
| Sessions/tokens table inexistente | Medium (revogação) |
| Subscriptions/plans/entitlements/usage inexistentes | Medium (futuro comercial) |

---

# 9. Security Audit

> Nota: descrições conceptuais de exploração, sem playbooks ofensivos operacionais.

### V-01 — Projects API sem autenticação / IDOR  
- **Severidade:** Critical  
- **Localização:** `public_html/api/projects/index.php` (+ mirrors hostinger); cliente `src/core/projects/projectsApi.ts`  
- **Explicação:** Qualquer cliente HTTP pode listar (`scope=all`), carregar, gravar ou apagar projetos. Ownership filtrado só se o cliente enviar `ownerId` — não verificado.  
- **Impacto:** Exfiltração e destruição de IP de clientes; violação de isolamento multi-tenant futuro.  
- **Exploração conceptual:** Pedidos HTTP directos ao endpoint público.  
- **Recomendação:** Exigir JWT; autorizar por owner/factory/admin; remover CORS `*`; nunca confiar em `ownerId` do body sem binding ao `sub`.

### V-02 — Industrial Supabase aberto a `anon`  
- **Severidade:** Critical  
- **Localização:** `supabase/migrations/013_industrial_anon_rls.sql`; cliente `industrial/infra/supabase/client.ts`  
- **Explicação:** Policies permitem read/write totais ao role `anon`.  
- **Impacto:** Manipulação de ordens de trabalho, qualidade, tempos, settings.  
- **Recomendação:** Remover policies anon permissivas; autenticar (Supabase Auth ou backend com service role); RLS por org/factory.

### V-03 — Painel Admin legado sem gate de rota  
- **Severidade:** High  
- **Localização:** `App.tsx` LegacyApp `pathname === "/admin"` → `<AdminPanel />`  
- **Explicação:** `AdminPanel` só esconde alguns menus `adminOnly` via `hasFullAccess`; a rota em si é pública.  
- **Impacto:** Exposição de configurações industriais/regras/materiais a anónimos (conforme o que o painel grava localmente/remoto).  
- **Recomendação:** Envolver `/admin` em `ProtectedRoute` + `PermissionRoute`; auditar cada sub-página quanto a side-effects.

### V-04 — JWT secret com fallback hardcoded  
- **Severidade:** Critical (se fallback usado em produção) / High  
- **Localização:** `api/auth/index.php` `pimo_jwt_secret()`  
- **Impacto:** Forja de tokens admin se o secret default estiver activo.  
- **Recomendação:** Falhar hard se `PIMO_JWT_SECRET` ausente; rotação de secret; nunca commitar secrets.

### V-05 — Credenciais default admin + UI pré-preenchida  
- **Severidade:** High  
- **Localização:** `pimo_ensure_default_admin`; `LoginPage` defaults  
- **Impacto:** Conta privilegiada previsível em ambientes que usem o seed.  
- **Recomendação:** Remover seed em produção; forçar bootstrap one-time; limpar defaults da UI.

### V-06 — Bypass local `K`/`K` no bundle  
- **Severidade:** High (prod) / Medium (se só dev)  
- **Localização:** `src/local-auth.ts` usado por `AuthProvider`  
- **Impacto:** Entrada em área `ProtectedLayout` (industrial incluído) sem JWT real.  
- **Recomendação:** Compilar só em DEV; eliminar de builds de produção.

### V-07 — Token em localStorage (XSS → session theft)  
- **Severidade:** High  
- **Localização:** `AuthProvider` storage keys  
- **Impacto:** Qualquer XSS rouba sessão.  
- **Recomendação:** Preferir cookies httpOnly Secure SameSite; CSP rigorosa; sanitização.

### V-08 — Sem rate limiting / brute force em login/registo  
- **Severidade:** High  
- **Localização:** `api/auth/index.php`  
- **Recomendação:** Rate limit por IP/email; backoff; opcionalmente captcha; alertas.

### V-09 — Password policy fraca (mín. 6)  
- **Severidade:** Medium  
- **Recomendação:** Política ≥10–12, complexity ou check de breached passwords; rehash/rotate guidance.

### V-10 — Password reset falso-positivo  
- **Severidade:** Medium  
- **Localização:** `ForgotPasswordPage`  
- **Impacto:** UX enganosa; utilizadores pensam que o fluxo existe.  
- **Recomendação:** Implementar fluxo seguro ou remover a página até existir.

### V-11 — Mass assignment de role no CRUD admin  
- **Severidade:** Medium  
- **Localização:** `api/users/index.php` POST/PUT `role` livre  
- **Recomendação:** Whitelist dos 5 roles; impedir auto-promoção; auditar mudanças.

### V-12 — `.env.production` versionado com URL/keys Supabase  
- **Severidade:** High  
- **Localização:** `.env.production` tracked; `.gitignore` só ignora `.env`  
- **Impacto:** Chaves publicáveis no histórico git; combinado com V-02 é grave.  
- **Recomendação:** Remover do tracking; rotacionar keys; alargar gitignore; secrets só no CI/hosting.

### V-13 — Industrial orders PHP sem auth  
- **Severidade:** High  
- **Localização:** `api/industrial/orders/index.php`  
- **Recomendação:** Autenticar + autorizar; rejeitar CORS aberto.

### V-14 — Sessão sem revalidação; permissions cacheáveis  
- **Severidade:** Medium  
- **Localização:** `AuthProvider` boot path  
- **Recomendação:** No boot, validar `/me`; limpar se 401; opcional short TTL + refresh.

### V-15 — Dual auth (PHP vs Supabase) + UI industrial só “authenticated?”  
- **Severidade:** High  
- **Impacto:** Confusão operacional; falsa sensação de RBAC industrial.  
- **Recomendação:** Um identity plane; mapear memberships; enforcement na BD/API.

### V-16 — Invite codes client-only  
- **Severidade:** Low–Medium  
- **Impacto:** Controlo comercial ilusório.  
- **Recomendação:** Validar no servidor ou remover da UX até existir.

### V-17 — CSRF  
- **Severidade:** Low–Medium (Bearer em header mitiga CSRF clássico de forms; cookies futuros precisarão de tokens)  
- **Nota:** Projects API sem auth torna CSRF irrelevante vs acesso directo.

### V-18 — Sensitive logging  
- **Severidade:** Low–Medium  
- **Localização:** `error_log` em projects API com URI; industrial console.error  
- **Recomendação:** Evitar tokens/PII em logs; structured audit.

### OWASP Top 10 (mapeamento resumido)

| OWASP | Achado |
|-------|--------|
| A01 Broken Access Control | V-01, V-02, V-03, V-13 |
| A02 Cryptographic Failures | V-04, V-07 |
| A03 Injection | Baixo no auth PHP (prepared via JSON file); atenção a inputs em paths (há sanitize parcial) |
| A04 Insecure Design | Dual auth, role=plan, mocks de roles UI |
| A05 Security Misconfiguration | V-05, V-06, V-12, CORS `*`, anon RLS |
| A07 Identification/Auth Failures | V-08, V-09, V-10, V-14 |
| A09 Security Logging Failures | Audit parcial; Events System produto ausente |

---

# 10. Current Problems

| ID | Prioridade | Problema |
|----|------------|----------|
| P0-1 | P0 | Projects API sem auth → IDOR total |
| P0-2 | P0 | Supabase industrial anon read/write |
| P0-3 | P0 | JWT secret fallback hardcoded (risco prod) |
| P0-4 | P0 | `/admin` legado acessível sem autenticação de rota |
| P1-1 | P1 | Bypass `K/K` e admin default em builds/ambientes reais |
| P1-2 | P1 | Industrial orders PHP aberto |
| P1-3 | P1 | `.env.production` no git |
| P1-4 | P1 | Dois sistemas de identidade sem bridge |
| P1-5 | P1 | Autorização de projetos só no frontend |
| P1-6 | P1 | Sem refresh/revogação de sessão |
| P2-1 | P2 | extra/removed permissions não implementados |
| P2-2 | P2 | Factory/Organization inexistente |
| P2-3 | P2 | ManageRoles/Permissions são mocks |
| P2-4 | P2 | Password reset stub; sem email verify/change self-service |
| P2-5 | P2 | Password policy fraca; sem rate limit |
| P2-6 | P2 | Role livre no CRUD users |
| P2-7 | P2 | Feature flags ≠ entitlements; roles misturados com planos |
| P3-1 | P3 | Subscriptions/billing inexistentes (esperado nesta fase, mas a separar conceptualmente) |
| P3-2 | P3 | users.json pouco escalável |
| P3-3 | P3 | Invite codes mock |
| P3-4 | P3 | Events System de produto não implementado |

---

# 11. What Should NOT Be Changed

Preservar e evoluir (não reconstruir do zero):

1. **Contrato de permissions de produto** (`admin.full_access`, `project.view.*`, etc.) e alinhamento `permissionsMap.ts` ↔ PHP map.  
2. **`AuthProvider` + `useAuth` + `ProtectedRoute`/`PermissionRoute`** como padrão de UI — completar, não abandonar.  
3. **Hashing com `password_hash`/`password_verify`.**  
4. **Registo público limitado a visitor/pro** (bom controlo de privilege escalation no self-signup).  
5. **Separação JWT claims mínimos (`sub`/`email`) com permissions calculadas server-side em `/me`.**  
6. **Master Plan roles fixos (5 níveis)** e conceito de **Fábrica** como vocabulário de produto.  
7. **Isolamento conceptual** pipeline industrial vs sala (já documentado) — mas **corrigir** a segurança de dados industrial.  
8. **User settings online autenticado** e **global-config PATCH admin** — bons padrões a replicar nas outras APIs.  
9. **Guest owner id** (`authGuest.ts`) para visitantes offline — manter, mas **nunca** confiar nele como prova de autorização server-side.

---

# 12. Target Architecture

## 12.1 Conceitos e responsabilidades

| Conceito | Responsabilidade |
|----------|------------------|
| **User** | Identidade humana (credenciais, perfil) |
| **Organization (Factory)** | Tenant comercial/operacional; dono da subscription |
| **Membership** | Ligação User↔Org com Role + estado |
| **Role** | Conjunto base de Permissions (RBAC) |
| **Permission** | Acção atómica no domínio (`project.edit.self`, …) |
| **Subscription** | Estado comercial da Org (active/trial/past_due/canceled) |
| **Plan** | Catálogo (Free/Pro/Ultra/Ultra+/Custom) |
| **Feature / Entitlement** | Direito comercial (`feature.industrial`, `feature.api_access`) |
| **Usage Limit** | Quotas (`projects.max`, `exports.month`) |
| **Project** | Recurso com `organizationId`, `ownerUserId`, `visibility` |
| **Session/Token** | Prova de autenticação; revogável |

## 12.2 Princípio de enforcement

- **Frontend:** UX only (esconder, upgrade prompts).  
- **Backend/API:** enforcement obrigatório.  
- **Database:** RLS/constraints como última linha (especialmente multi-tenant).

## 12.3 Diagrama alvo

```text
User ── Membership ── Organization(Factory)
              │                │
            Role               Subscription ── Plan ── Entitlements
              │                                  │
         Permissions                        Usage Limits
              │
         Resource (Project, WO, Settings, …)
```

---

# 13. Recommended Subscription Architecture

## 13.1 Planos iniciais (catálogo, não hardcode de ifs)

Sugestão alinhada à Landing + Master Plan:

| Plan code | Posicionamento | Exemplos de entitlements |
|-----------|----------------|--------------------------|
| `free` | Visitor / trial leve | `project.view`, limites baixos |
| `pro` | Designer | edição, PDF técnico, templates |
| `ultra` | Produção | industrial/CNC, send_to_production |
| `ultra_plus` | Fábrica | multi-user factory, API, domínio |
| `enterprise` (opcional) | Custom | overrides manuais |

## 13.2 Modelo de dados (lógico)

- `plans(id, code, name, active)`  
- `plan_entitlements(plan_id, feature_key, value_json)`  
- `subscriptions(org_id, plan_id, status, current_period_*)`  
- `org_entitlement_overrides(org_id, feature_key, value_json, reason)`  
- `usage_counters(org_id, metric, period, count)`  

Resolução:

```text
effectiveEntitlements =
  plan_entitlements(subscription.plan)
  ⊕ org_entitlement_overrides
```

## 13.3 Capacidades futuras sem reescrita

- Upgrade/downgrade: muda `subscriptions.plan_id` + proration (billing depois).  
- Trial: `status=trialing` + entitlements do plan trial.  
- Billing: Stripe Customer no `organizations`; webhooks actualizam `subscriptions`.  
- Overrides: clientes enterprise sem fork do código.

## 13.4 Separação Role vs Plan

- Role = **quem** é na org (worker vs manager vs admin fábrica).  
- Plan = **o que a org comprou**.  
- Um `visitor` num tenant Ultra+ continua limitado por permissions de membership, mas a org tem entitlements Ultra+.

---

# 14. Recommended Authorization Architecture

## 14.1 Cadeia de verificação

```text
Request
  → Authenticate (session/JWT)
  → Resolve Membership (org context)
  → Authorize Permission (RBAC ± ownership/factory scope)
  → Check Entitlement (feature)
  → Check Usage Limit
  → Access Resource
```

## 14.2 Onde verificar

| Camada | Obrigatório? | Exemplos |
|--------|--------------|----------|
| Frontend | Recomendado (UX) | `hasPermission`, `hasEntitlement` para CTAs |
| API/Backend | **Obrigatório** | Todo GET/POST/PATCH/DELETE sensível |
| Database/RLS | Fortemente recomendado | Isolamento org_id |
| Edge/WAF | Recomendado | Rate limit, bot |

**Regra absoluta:** esconder no frontend **não** é controlo de segurança.

## 14.3 Scopes de recurso (produto)

- `self`: ownerUserId == caller  
- `factory`: same organizationId  
- `all`: admin plataforma  

Mapear permissions actuais para estes scopes sem renomear desnecessariamente as chaves já usadas.

---

# 15. Implementation Plan

> Adaptado ao estado real: há auth parcial; falhas críticas estão nas APIs de dados e no dual-stack industrial.

### Phase 0 — Preparation  
- **Objetivo:** Inventário fechado, secrets, feature flags de kill-switch.  
- **Implementar:** Remover/ignorar `.env.production` do git (processo); checklist ambientes; decidir SSOT identity (PHP JWT vs migrar para Supabase/Auth provider).  
- **Dependências:** nenhuma de código de produto.  
- **Afectados:** ops/docs/CI.  
- **Riscos:** rotação de keys quebra deploys se mal coordenada.  
- **Testes:** smoke deploy staging.  
- **Done:** secrets fora do VCS; inventário APIs classificadas (public/authz/admin).

### Phase 1 — Emergency Access Control (Security Hardening imediato)  
- **Objetivo:** Parar hemorragia de dados.  
- **Implementar:** AuthZ na Projects API; fechar industrial orders; restringir `/admin`; desactivar `K/K` em prod; exigir `PIMO_JWT_SECRET`; rever migration 013 (desligar anon write).  
- **Dependências:** Phase 0 decisão mínima de secret/JWT.  
- **Afectados:** `public_html/api/projects/*`, `api/auth`, `App.tsx`, `local-auth`, supabase policies, `api/industrial/orders`.  
- **Riscos:** clientes guest/offline podem partir — prever token guest assinado ou modo offline-only local.  
- **Testes:** IDOR negativos; testes e2e save/load autenticado.  
- **Done:** impossível ler/escrever projeto alheio sem credencial válida.

### Phase 2 — Authentication completeness  
- **Objetivo:** Sessões sólidas.  
- **Implementar:** revalidate `/me` no boot; logout server-side opcional; password change self-service; reset real ou remoção UI; rate limit; remover defaults login; policy password.  
- **Dependências:** Phase 1.  
- **Afectados:** `AuthProvider`, auth PHP, Login/Forgot pages.  
- **Done:** sem stubs enganadores; brute force mitigado.

### Phase 3 — Users & Organizations (Factory)  
- **Objetivo:** Tenant model.  
- **Implementar:** Organization/Factory + membership; associar projects; endpoints `/factory/*` do Master Plan.  
- **Dependências:** Phase 1–2.  
- **Done:** ultra+ vê só a sua fábrica **no servidor**.

### Phase 4 — Roles & Permissions (completar Master Plan)  
- **Objetivo:** `extraPermissions` / `removedPermissions`; whitelist roles; substituir mocks ManageRoles/Permissions por read-only ou API real.  
- **Dependências:** Phase 3.  
- **Done:** `/me` devolve permissions efectivas completas; audit log de mudanças.

### Phase 5 — Unify Industrial Identity  
- **Objetivo:** Um utilizador, dois módulos.  
- **Implementar:** Bridge JWT↔Supabase (ou BFF com service role); RLS por org; remover dependência de anon write.  
- **Dependências:** Phase 3.  
- **Done:** operador sem membership adequada não lê/escreve WO.

### Phase 6 — Subscription & Plans (catálogo)  
- **Objetivo:** Planos sem billing ainda.  
- **Implementar:** tabelas plan/entitlement/subscription; resolver entitlements por org; admin UI mínima.  
- **Dependências:** Phase 3–4.  
- **Done:** entitlements consultáveis por API.

### Phase 7 — Entitlements na aplicação  
- **Objetivo:** Gates reais.  
- **Implementar:** `requireEntitlement` no backend export/industrial/API; UI upgrade messaging (Fase 5 Master Plan).  
- **Dependências:** Phase 6.  
- **Done:** feature paga bloqueada na API mesmo com UI adulterada.

### Phase 8 — Usage Limits  
- **Objetivo:** Quotas.  
- **Implementar:** counters atómicos; erros 402/403 tipados.  
- **Dependências:** Phase 6–7.

### Phase 9 — Billing (opcional posterior)  
- Stripe/webhooks; não bloquear Phases 1–7.

### Phase 10 — Testing & Production Readiness  
- Matriz de testes §18; pen-test interno A01; checklist §19.

---

# 16. Recommended Implementation Order

Ordem para **minimizar retrabalho** e **não bloquear** desenvolvimento de CAD/industrial de forma prolongada:

1. **Phase 0–1 (já)** — fechar APIs abertas e admin legado (senão qualquer feature nova aumenta o blast radius).  
2. **Phase 2** — endurecer auth sem mudar domínio de negócio.  
3. **Phase 3–4** — Factory + permissions efectivas (desbloqueia Master Plan Fases 3–4).  
4. **Phase 5** — unificar industrial (pode correr em paralelo técnico após 3).  
5. **Phase 6–8** — subscriptions/entitlements/limits quando o produto comercial precisar — **depois** do isolamento tenant.  
6. **Phase 9** — billing.  
7. **Phase 10** — hardening contínuo.

**Não** implementar billing/plan UI sofisticada antes de authz de recursos (Projects/Industrial).

---

# 17. Migration Strategy

Evitar big-bang:

1. **Manter** `users.json` + JWT temporariamente; introduzir campos `organizationId`, `extraPermissions`, `removedPermissions` de forma aditiva.  
2. **Projects API:**  
   - v1 autenticada em paralelo;  
   - aceitar guest tokens assinados de curto prazo para visitantes;  
   - migrar `ownerId` orphan para org pessoal automática.  
3. **Industrial:**  
   - criar policies autenticadas correctas **antes** de dropar anon;  
   - feature flag `industrial.anonCompat` temporária só em staging.  
4. **Roles UI mocks:** marcar deprecated; apontar para SSOT PHP.  
5. **Subscriptions:** introduzir plan `legacy_unassigned` para orgs existentes = entitlements permissivos temporários, depois restringir.  
6. **Dual auth:** período de coexistência com tabela de link `user_id_php ↔ supabase_uuid`.

Rollback: feature flags server-side por endpoint; não apagar JSON stores até paridade comprovada.

---

# 18. Testing Strategy

| Camada | Casos |
|--------|-------|
| Unit | `rbacHelpers`, effective permissions (+extra/-removed), entitlement resolver, invite server validator |
| Integration API | login/me/users; projects CRUD negado sem token; IDOR cross-user; factory scope ultra+; admin-only global-config |
| Industrial | RLS: anon denied; worker cannot update other dept; permission_change_logs |
| E2E | register→login→create project→logout; admin users CRUD; visitor cannot open admin routes |
| Security regression | suite A01 (IDOR), brute force 429, forged JWT rejected, local-auth absent in prod build |
| Subscription | plan change updates entitlements; override wins; usage limit blocks |

Automatizar testes negativos (“must fail”) com igual prioridade aos happy paths.

---

# 19. Security Checklist (pré-produção)

- [ ] `PIMO_JWT_SECRET` forte, único por ambiente, sem fallback no código  
- [ ] Sem contas default conhecidas activas  
- [ ] Bypass `local-auth` ausente no build de produção  
- [ ] Projects API exige authz por recurso  
- [ ] Industrial: anon sem write; preferencialmente sem read sensível  
- [ ] `/admin` e settings industriais atrás de authz  
- [ ] Rate limiting login/register  
- [ ] Password policy adequada; reset seguro (token one-time, expiração)  
- [ ] Tokens não em logs; HTTPS only  
- [ ] Secrets não commitados (`.env*` correctos no gitignore)  
- [ ] CORS allowlist; sem `*` em APIs autenticadas  
- [ ] CSP / sanitização XSS  
- [ ] Auditoria de mudanças de role/subscription  
- [ ] Testes automatizados de IDOR a passar em CI  
- [ ] Backup cifrado de stores sensíveis  
- [ ] Procedimento de revogação de sessões (rotação secret ou session store)

---

# 20. Final Recommendation

### 1. Implementar Auth/Authz/Subscription agora ou esperar pelo fim do projeto?

**Não esperar pelo fim.**  
- **AuthZ de APIs (Projects + Industrial + Admin)** é **imediato** (risco actual).  
- **Subscriptions/billing** podem esperar até haver tenant (Factory) estável — mas a **separação conceptual Role vs Plan vs Entitlement** deve ser adoptada já para não acumular `if (role===...)` comerciais.

### 2. O que implementar imediatamente?

1. Fechar Projects API e industrial orders.  
2. Corrigir `/admin` e settings industriais.  
3. Remover/condicionar `K/K`, defaults admin, JWT fallback.  
4. Reverter/restringir anon RLS 013.  
5. Tirar `.env.production` do histórico operativo (rotação).

### 3. O que pode esperar?

- Stripe/billing completo  
- UI rica de gestão de planos  
- Events System de produto  
- Migração total users.json → PostgreSQL (desejável, não bloqueante se APIs fecharem)

### 4. Maior risco actual?

**Broken Access Control nas APIs de dados (projetos + industrial anon)** — não a ausência de ecrãs de pricing.

### 5. Arquitectura recomendada?

Identity única + Organization(Factory) + Membership/RBAC + Subscription→Entitlements/Limits, com enforcement na API/BD e UI apenas como espelho.

### 6. Ordem de implementação?

Phases **0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10** (§15–16).

### 7. Alterar algo antes de continuar o desenvolvimento de features?

**Sim.** Continuar a expandir industrial/CAD com APIs abertas **aumenta dívida de segurança e custo de migração**. Congelar novas exposições de dados e executar Phase 1 antes de novas superfícies HTTP/Supabase.

---

## Tabela final de prioridades

| Prioridade | Tarefa | Motivo | Fase |
|------------|--------|--------|------|
| P0 | Autenticar + autorizar Projects API | IDOR / perda de dados | 1 |
| P0 | Fechar RLS anon industrial write/read sensível | Compromisso produção | 1 |
| P0 | Proteger rota `/admin` e settings industriais | Painel privilegiado exposto | 1 |
| P0 | Obrigar `PIMO_JWT_SECRET` sem fallback | Forja de tokens | 0–1 |
| P1 | Remover bypass `K/K` e credenciais default | Privilege / auth bypass | 1–2 |
| P1 | Auth em industrial orders PHP | Endpoint aberto | 1 |
| P1 | Remover secrets do git + rotacionar | Exposure | 0 |
| P1 | Revalidar sessão (`/me`) + rate limit | Session hygiene | 2 |
| P2 | Modelo Factory + membership server-side | Master Plan Fase 3 | 3 |
| P2 | extra/removed permissions | Master Plan incompleto | 4 |
| P2 | Unificar identidade industrial | Dual stack | 5 |
| P2 | Password reset real ou remover stub | Auth completeness | 2 |
| P3 | Catálogo plans/entitlements | Preparar comercial | 6–7 |
| P3 | Usage limits + billing | Monetização | 8–9 |

---

## Apêndice A — Inventário de ficheiros-chave

### Produto Auth/RBAC
- `api/auth/index.php`
- `api/users/index.php`
- `api/user-settings/index.php`
- `api/global-config/index.php`
- `public_html/api/auth/index.php` (router)
- `src/auth/AuthProvider.tsx`, `AuthContext.tsx`, `useAuth.ts`
- `src/auth/permissionsMap.ts`, `rbacHelpers.ts`, `rbac.ts`
- `src/api/authApi.ts`, `usersApi.ts`, `apiClient.ts`
- `src/local-auth.ts`, `src/core/auth/authGuest.ts`
- `src/components/ProtectedRoute.tsx`
- `src/pages/LoginPage.tsx`, `RegisterPage.tsx`, `ForgotPasswordPage.tsx`, `MePage.tsx`
- `src/pages/admin/ManageRolesPage.tsx`, `ManagePermissionsPage.tsx` (**mocks**)
- `src/components/admin/inviteCodesMock.ts` (**mock**)

### Projects (crítico)
- `public_html/api/projects/index.php`
- `src/core/projects/projectsApi.ts`, `projectsClient.ts`, `currentUser.ts`

### Industrial / Supabase
- `src/industrial/core/auth/actions.ts`
- `src/industrial/core/permissions/*`
- `src/industrial/infra/supabase/client.ts`
- `supabase/migrations/003_profiles_roles.sql`, `004_rls_roles_policies.sql`, `005_permission_change_logs.sql`, `013_industrial_anon_rls.sql`
- `api/industrial/orders/index.php`

### Docs de intenção
- `docs/PIMO-CRIATIVO-MASTER-PLAN.md`

### Config / secrets
- `.env.example`, `.env.production` (tracked — risco)
- `package.json` → `@supabase/supabase-js`

---

## Apêndice B — Unknown / Needs Verification

| Item | Nota |
|------|------|
| Valor real de `PIMO_JWT_SECRET` em produção Hostinger | Não verificável só pelo repo; se ausente, fallback aplica-se |
| Conteúdo actual de `users.json` em produção | Runtime; não versionado |
| Se migration 013 foi aplicada no projecto Supabase live | Repo contém o SQL; estado remoto Needs Verification |
| Exposição pública exacta dos paths `api/data/*.json` via web server | Depende da config Hostinger/nginx |
| Serviço `pimo-mail-service` auth (`VITE_INTERNAL_API_SECRET`) | Fora do âmbito auth de utilizadores; revisar em auditoria de integrações |
| Se `VITE_API_URL` em produção aponta sempre para o mesmo host que Projects API | Projects usa same-origin `/api/projects`; auth Axios usa `VITE_API_URL` — possível split de backends Needs Verification |

---

## Apêndice C — Declaração de integridade desta tarefa

- Esta análise baseia-se em leitura de código, migrations e configuração no repositório.  
- **Única alteração intencional permitida:** criação deste relatório.  
- Nenhuma dependência foi instalada; nenhuma migration foi executada; nenhum ficheiro de aplicação foi modificado no âmbito desta tarefa de auditoria.

---

*Fim do relatório.*
