# Architecture & Implementation Specification  
## Authentication · Authorization · Multi-tenancy · Subscriptions · Entitlements

**Projeto:** pimo-criativo  
**Documento:** Especificação oficial de arquitectura e implementação (Fase 2)  
**Data:** 24 de Agosto de 2026  
**Fonte primária:** `docs/RELATORIO-AUDITORIA-AUTH-AUTHZ-SUBSCRIPTIONS.md`  
**Complementos:** `docs/PIMO-CRIATIVO-MASTER-PLAN.md`, código actual (validação pontual)  
**Estado:** Aprovação pendente — **sem implementação nesta fase**

---

## Como usar este documento

| Fase | Documento | Pergunta |
|------|-----------|----------|
| 1 (feita) | Relatório de auditoria | O que existe? O que está errado? |
| **2 (este)** | **Specification** | Como construir? Em que ordem? O que preservar? |
| 3 (futura) | Implementação por fases | Executar diffs aprovados fase a fase |

**Regra:** Nenhuma implementação começa sem aprovação explícita deste documento (ou de uma revisão datada).

---

## Tabela executiva — decisões de classificação

| Componente actual | Classificação | Motivo (resumo) |
|-------------------|---------------|-----------------|
| `api/auth` JWT HS256 + `users.json` | **IMPROVE** → depois **REFACTOR** | Funciona; endurecer já; migrar store mais tarde |
| `AuthProvider` / `useAuth` / `apiClient` | **KEEP** + **IMPROVE** | Contrato UI estável; revalidar `/me`; unificar token nas APIs |
| `permissionsMap` + `rbacHelpers` | **KEEP** + **IMPROVE** | Chaves alinhadas com PHP; completar fórmula Master Plan |
| Roles Master Plan (`visitor`…`admin`) | **IMPROVE** (semântica) | Nomes KEEP; separar role de plano comercial |
| `ProtectedRoute` / `PermissionRoute` | **KEEP** + **IMPROVE** | UX; nunca substituto de authz API |
| `local-auth.ts` (`K`/`K`) | **REMOVE** (prod) / **KEEP** só DEV | Bypass de segurança |
| Admin default `admin@pimo.local` | **REMOVE** (prod) / bootstrap one-time | Credenciais previsíveis |
| `ForgotPasswordPage` stub | **REPLACE** ou **REMOVE** até existir | UX enganosa |
| ManageRoles / ManagePermissions (mocks) | **REPLACE** | Estado local falso |
| `inviteCodesMock` | **DEFER** → **REPLACE** server-side | Hoje só cliente |
| Projects API PHP (JSON) | **IMPROVE** (authz urgente) → **REFACTOR** store | Persistência útil; ACL crítica |
| `projectsApi.ts` (fetch sem Bearer) | **IMPROVE** | Passar Authorization + org context |
| `/admin` LegacyApp sem gate | **IMPROVE** imediato → **REFACTOR** UX | Painel útil; rota insegura |
| Industrial `featureFlags.ts` | **KEEP** (engenharia) ≠ entitlements | Flags de release ≠ planos |
| Supabase client + tabelas industriais | **IMPROVE** + **REFACTOR** auth path | Dados reais; anon RLS inaceitável |
| Migration 013 anon ALL | **REMOVE** / restringir | P0 |
| `supabase.auth` industrial paralelo | **REFACTOR** → bridge/BFF | Dual identity |
| Landing pricing | **KEEP** marketing → **NEW** backend depois | Não acoplar UI a `if plan` |
| Subscriptions / Entitlements / Usage | **NEW** (após segurança + org) | Ainda inexistentes |
| PostgreSQL como SSOT users/orgs | **NEW** (fase média) | JSON não escala multi-tenant |
| Stripe / Billing | **DEFER** | Só após entitlements |

---

# 0. Princípios orientadores (não negociáveis)

1. **Security first** — nenhuma feature comercial antes de fechar P0 de acesso a dados.  
2. **Backend is source of truth** — frontend só espelha; nunca autoriza sozinho.  
3. **Evolve, don’t rewrite** — reutilizar JWT PHP, RBAC keys, AuthProvider, Projects JSON enquanto forem seguros.  
4. **Three axes** — Identity/Org ≠ Authorization ≠ Commercial Entitlements.  
5. **Factory = Organization** no vocabulário PIMO (Master Plan).  
6. **No `if (plan === "pro")` em domínio** — só entitlements/limits.  
7. **Compatibilidade temporária** — dual-read/dual-write e feature flags durante migração.  
8. **Um identity plane** — eliminar dual PHP↔Supabase Auth a médio prazo.

---

# 1. Target Architecture

## 1.1 Visão alvo

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         Frontend (React SPA)                              │
│  AuthProvider · Permission/Entitlement helpers · Route guards (UX only)  │
└───────────────┬───────────────────────────────┬──────────────────────────┘
                │ Bearer / session               │ (fase média: sem writes
                ▼                                │  directos com anon key)
┌───────────────────────────────┐   ┌───────────▼──────────────────────────┐
│  API Gateway / PHP AuthZ layer │   │  BFF Industrial (recomendado)        │
│  auth · users · projects       │   │  valida JWT → service role Supabase  │
│  orgs · entitlements · usage   │   └───────────┬──────────────────────────┘
└───────────────┬───────────────┘               │
                │                               ▼
                │                    ┌─────────────────────┐
                │                    │ Supabase PostgreSQL │
                │                    │ RLS por org_id      │
                │                    └─────────────────────┘
                ▼
┌───────────────────────────────────┐
│  Identity & Tenant Store          │
│  (fase próxima: PostgreSQL;       │
│   transição: users.json + sidecars│
│   orgs/memberships)               │
└───────────────────────────────────┘
```

## 1.2 Domínios transversais

| Domínio | Responsabilidade | Consumidores |
|---------|------------------|--------------|
| **Identity** | Quem é o utilizador (credenciais, sessão) | Toda a app |
| **Tenancy** | Em que Factory/Org opera | Projects, Industrial, Admin org |
| **Authorization** | O que o membership pode fazer | APIs + UI |
| **Commercial** | O que a Org comprou (entitlements/limits) | Features premium, quotas |
| **Resources** | Projects, WO, settings, exports | Módulos de produto |
| **Audit** | Quem fez o quê | Compliance, suporte |

## 1.3 Comunicação entre componentes

1. Cliente autentica-se → recebe **access token** (+ refresh numa fase seguinte).  
2. Cada request API envia token + opcionalmente `X-Organization-Id` (ou org derivada do token/membership default).  
3. Middleware PHP (funções partilhadas, padrão já usado em `user-settings`/`users`):  
   `authenticate → resolveMembership → authorizePermission → checkEntitlement → checkUsage → handler`.  
4. Industrial: **preferir BFF** autenticado; browser não usa service role; RLS como defesa em profundidade.  
5. `/me` (ou `/session/context`) devolve: user, memberships, effectivePermissions, entitlements, limits usage snapshot.

## 1.4 Adequação do modelo conceptual proposto

O modelo  
`User → Org/Factory → Membership → Role → Permissions → Subscription → Plan → Entitlements → Features/Limits`  
é **adequado** ao PIMO, com estes ajustes:

| Ajuste | Motivo |
|--------|--------|
| **Organization ≡ Factory** (um tipo, dois nomes) | Master Plan; evitar “Company” paralelo |
| **Role vive no Membership**, não só no User | Multi-org futuro; um user em várias fábricas |
| **Platform Admin** fora do tenant | `admin` global ≠ admin de fábrica |
| **Personal workspace** = Org tipo `personal` | Registo visitor/pro sem fábrica real |
| **Teams** = **DEFER** | Não bloquear; membership cobre 95% |

---

# 2. Authentication Architecture

## 2.1 Decisão tecnológica

| Opção | Veredito |
|-------|----------|
| Manter JWT HS256 PHP custom (curto prazo) | **RECOMMENDED agora** |
| Migrar já para Auth0/Clerk/Supabase Auth only | **REJECTED agora** (custo, dual stack, breaking) |
| Cookies httpOnly + refresh (médio prazo) | **RECOMMENDED evolução** |
| Eliminar JWT | **REJECTED** (SPA + APIs multi-host já usam Bearer) |

**Porquê manter JWT agora:** já existe login/register/`/me`/users/settings; o risco crítico não é o algoritmo JWT em si, é **APIs sem authz** e **secret fraco**. Trocar IdP antes de fechar Projects/Industrial multiplica retrabalho.

**Porquê evoluir depois:** `localStorage` + JWT longo sem revogação é frágil a XSS; refresh + cookies httpOnly melhoram postura sem obrigar reescrever o domínio.

## 2.2 Fluxos alvo

### Registration
- Público: só criar User + **Org personal** + Membership com role base (`visitor` ou `pro` no período de transição).  
- Continuar a **bloquear** self-signup de `ultra` / `ultra+` / `admin` (já correcto no PHP).  
- Invite codes: **DEFER** server-side; até lá, UI mock não deve fingir enforcement (ou remover validação falsa).

### Login
- `password_verify` → emitir access token.  
- Resposta mínima: token(s) + redirect para `/me` no cliente.  
- Rate limit por IP + email.  
- Sem pré-preenchimento de credenciais na UI.

### Logout
- Cliente limpa storage.  
- Servidor: invalidar refresh / `jti` (quando existir session store).  
- Access JWT curto: logout “best effort” até expirar (aceitável se TTL ≤ 15–30 min).

### Password reset
- Token one-time, curto TTL, single-use, enviado por email (SMTP já previsto em `.env.example`).  
- Até existir: página stub **REMOVE** ou banner “indisponível”.

### Password change
- Endpoint autenticado: verifica password actual → novo hash.  
- Admin reset: audit log obrigatório.

### Email verification
- **DEFER** para pós-P0 (não bloqueia authz de APIs).  
- Quando existir: flag `emailVerified`; políticas comerciais podem exigir.

### Session / tokens

| Token | TTL sugerido | Storage (fase) | Revogação |
|-------|--------------|----------------|-----------|
| Access JWT | 15–30 min (hoje 24h → reduzir gradualmente) | localStorage (já) → cookie httpOnly Secure SameSite=Lax/Strict | Via `jti` blacklist ou TTL curto |
| Refresh | 7–30 dias | httpOnly cookie (fase seguinte) | Rotação + família de refresh |

**Claims access token (mínimos):** `sub`, `iat`, `exp`, `jti` (quando houver revogação).  
**Não colocar** permissions longas no JWT (já correcto hoje — recalcular em `/me`).  
**Org context:** claim opcional `org` *ou* header; membership validado sempre no servidor.

### Account security
- Secret só via env; **fail closed** se ausente.  
- Remover seed admin automático em produção.  
- `local-auth` só com `import.meta.env.DEV`.  
- Lockout progressivo / captcha após N falhas (**IMPROVE** Phase 1–2).

## 2.3 Guest / offline (compatibilidade)

Hoje: `guest-<uuid>` em localStorage e Projects API aceita qualquer `ownerId`.

**Alvo de transição:**
- Modo offline-only: dados só no browser (KEEP comportamento local).  
- Sync remoto: exige auth **ou** **guest capability token** assinado (JWT curto `aud=guest`, `sub=guest-…`, sem permissions elevadas).  
- Nunca confiar em `ownerId` do body sem binding ao `sub` do token.

---

# 3. Authorization Architecture

## 3.1 Três conceitos distintos

| Conceito | Pergunta | Exemplo |
|----------|----------|---------|
| **Authentication** | Quem és? | JWT válido → userId |
| **Authorization (RBAC + resource)** | Podes fazer esta acção neste recurso? | `project.edit.self` no projecto X |
| **Subscription Entitlement** | A tua Org pagou / tem direito a esta capacidade? | `feature.cnc_export=true`, `limit.projects=100` |

Falhar qualquer eixo → **deny** (excepto recursos públicos explícitos).

## 3.2 Modelo RBAC

**KEEP** chaves actuais (`project.view.self`, `admin.full_access`, …).

**IMPROVE** fórmula Master Plan no servidor:

```
effectivePermissions(membership) =
  (rolePermissions[role] ∪ extraPermissions) − removedPermissions
```

`admin.full_access` (platform) continua a short-circuitar checks de plataforma — **não** deve short-circuitar billing de outra org sem regra explícita (platform admin ≠ “tudo grátis”).

## 3.3 Níveis de autorização

| Nível | Regra |
|-------|-------|
| Platform | `admin.full_access` / system roles |
| Organization | membership.active + role naquela org |
| Project | org_id match + ownership/visibility + permission |
| Industrial resource | org_id (+ department se aplicável) + permission industrial |
| API | middleware uniforme (§9) |
| Frontend | helpers espelham `/me`; fail closed se loading |

## 3.4 Resource-level (projects)

Para `GET/PUT/DELETE/POST` project:

1. Authenticated (ou guest token válido).  
2. Load project metadata (`organizationId`, `ownerUserId`, `visibility`).  
3. Allow se:  
   - platform admin com permission adequada, **ou**  
   - `visibility=public` e acção read, **ou**  
   - membership na mesma org **e** permission adequada **e** (owner **ou** `project.view.factory` / edit factory conforme acção).

## 3.5 Frontend vs Backend

| | Frontend | Backend |
|--|----------|---------|
| Papel | UX, upgrade prompts | Segurança |
| Falha | Esconder botão | 401/403 |
| Suficiente sozinho? | **Não** | **Sim (obrigatório)** |

---

# 4. Multi-tenancy / Organization Architecture

## 4.1 Modelo

```
Organization (Factory | Personal)
    ├── Memberships (User, Role, extra/removed, status)
    ├── Subscription (1 activa lógica)
    ├── Projects (organizationId, ownerUserId)
    └── Industrial data (organizationId)  [fase média]
```

- **Factory:** tenant comercial/produção (ultra+ manager).  
- **Personal:** criada no registo; um user “sozinho”; facilita migração sem factory real.  
- User pode ter N memberships (futuro); v1 pode limitar a 1 activa na UI.

## 4.2 Isolamento (camadas)

| Camada | Mecanismo |
|--------|-----------|
| API | Todo query filtra `organization_id` derivado do membership, **nunca** só do client body |
| Application | Helpers `assertSameOrg(resource, membership)` |
| Database / RLS | `organization_id = auth.org()` (Supabase) |
| Storage paths | Prefixo por org quando migrar de flat JSON |
| Audit | Logar org_id em mutações |

## 4.3 Prevenção IDOR / cross-tenant

- IDs opacos OK, mas **ACL obrigatória** (segurança ≠ obscurity).  
- Proibir `scope=all` sem permission `project.view.all` / factory.  
- `ownerId` no POST é **informativo**; servidor define `ownerUserId = sub` e `organizationId = membership.org`.

## 4.4 Industrial + tenant

Hoje industrial não tem `organization_id` canónico no fluxo produto (**UNKNOWN** se alguma coluna parcial existe em tabelas — Needs Verification em schema live).

**Spec:** adicionar `organization_id` (ou `factory_id` alias) a work orders / pieces na migração industrial; até lá, **não** expandir writes anon.

---

# 5. Role & Permission Architecture

## 5.1 Separar “role de produto” de “plano”

**Problema actual:** `visitor`/`pro`/`ultra` misturam autorização e marketing.

**Decisão:**

| Camada | Uso dos nomes Master Plan |
|--------|---------------------------|
| **Transição (KEEP names)** | Continuar 5 roles como membership roles para não partir UI/PHP |
| **Alvo semântico** | Role = capacidade operacional; Plan = comercial |
| **Platform** | Só `admin` (system) |
| **Factory manager** | `ultra+` (equiv. org admin/manager) |
| **Designer/editor** | `pro` / `ultra` (permissions diferem: produção) |
| **Viewer** | `visitor` |

Roles industriais (`operador`, `worker`, …) tornam-se **roles de membership no módulo industrial** *ou* permissions adicionais (`industrial.operate`, `industrial.supervise`) — **REFACTOR** unificado na Phase 3–5, sem manter dois SSOT eternos.

## 5.2 Evolução futura (custom roles)

**DEFER** roles totalmente custom por org até existir:

- catálogo de permissions estável,  
- UI admin de membership,  
- audit.

Até lá: **system roles fixos** + `extraPermissions` / `removedPermissions` (já no Master Plan) dão flexibilidade sem explosion de roles.

## 5.3 Inheritance / overrides

- Sem hierarquia OO complexa.  
- Herança = “role template → lista de permissions”.  
- Overrides = extra/removed no membership.  
- Org-specific roles = **DEFER**.

## 5.4 Exemplos futuros (não finais)

Owner / Admin / Manager / Designer / Sales / Production / CNC / Viewer — úteis como **labels de produto**, mapeáveis a permissions; **não** substituir já os 5 nomes oficiais sem revisão do Master Plan.

---

# 6. Subscription Architecture

## 6.1 Princípio

```
Organization
  └── Subscription (status, period)
        └── Plan (code)
              └── PlanEntitlements[]  (feature_key → value)
Organization
  └── EntitlementOverrides[]  (opcional, enterprise)
```

Código de feature **nunca** lê `plan.code` para decisões de domínio.

## 6.2 Planos iniciais (catálogo)

Alinhados à Landing + Master Plan:

| code | Nome comercial | Notas |
|------|----------------|-------|
| `free` | Free | Personal / visitor |
| `pro` | Pro | Designer |
| `ultra` | Ultra | Produção |
| `ultra_plus` | Ultra+ | Fábrica / API |
| `enterprise` | Enterprise | Overrides manuais (**opcional**) |

Adicionar planos = novas rows + entitlements; **zero** deploy de `if`.

## 6.3 Subscription status

`trialing | active | past_due | canceled | incomplete`  
Acesso comercial: tipicamente `trialing|active` (+ grace `past_due` configurável).

## 6.4 Billing

**DEFER.** Subscription pode ser **manual/admin-assigned** durante meses (plano atribuído no admin) antes de Stripe.

---

# 7. Entitlements

## 7.1 Tipos de valor

| Tipo | Significado | Exemplo |
|------|-------------|---------|
| **Boolean feature** | Ligado/desligado | `feature.module.cnc` |
| **Numeric limit** | Tecto | `limit.projects.max = 100` |
| **Quota period** | Por período | `limit.exports.month = 50` |
| **String/enum** | Variante | `feature.support.tier = priority` |

## 7.2 Catálogo inicial sugerido (extensível)

| key | Tipo | Notas |
|-----|------|-------|
| `feature.design.kitchen` | bool | |
| `feature.design.bedroom` | bool | |
| `feature.viewer.3d` | bool | Core; provavelmente true desde free |
| `feature.rendering.advanced` | bool | |
| `feature.module.cnc` | bool | |
| `feature.module.production` | bool | Industrial / send_to_production |
| `feature.reports.advanced` | bool | |
| `feature.export.pdf_technical` | bool | |
| `feature.api.access` | bool | Ultra+ |
| `limit.members.max` | int | |
| `limit.projects.max` | int | |
| `limit.storage.gb` | int | **DEFER** metering fino |
| `limit.exports.month` | int | |

Feature flags de engenharia (`industrialFeatureFlags`) **permanecem separados** (KEEP): rollout técnico ≠ direito comercial.

## 7.3 Resolução

```
effectiveEntitlements(org) =
  merge(plan_entitlements(subscription.plan), org_overrides)
```

Overrides ganham (com audit).

---

# 8. Subscription + Role Interaction

## 8.1 Matriz

| Permission? | Entitlement? | Resultado |
|-------------|--------------|-----------|
| Não | Sim | **403 Forbidden** — “sem permissão” |
| Sim | Não | **402/403 Entitlement** — “upgrade / plano” (UI) |
| Não | Não | **403** |
| Sim | Sim | Avaliar limit → **200** ou **429/403 quota** |

## 8.2 Fórmula recomendada (API)

```
allow =
  authenticated
  AND membership.active_in(org)
  AND hasPermission(action, resource, membership)
  AND hasEntitlement(requiredFeature, org)      // se a acção exigir feature
  AND withinLimit(metric, org)                  // se aplicável
```

**Casos especiais:**
- Recursos públicos read-only: autenticado opcional; entitlement tipicamente N/A.  
- Platform admin: permission platform; entitlements de **tenant alvo** ainda se aplicam a acções *em nome da org* (exceto ferramentas de suporte explícitas).

## 8.3 Porquê AND e não OR

Permission sem entitlement = empregado com perfil alto numa org Free não deve desbloquear CNC.  
Entitlement sem permission = org Ultra+ não dá CNC a um visitor membership.

---

# 9. API Security Architecture

## 9.1 Prioridade absoluta

Uniformizar **todas** as APIs mutáveis/sensíveis, começando por:

1. Projects API  
2. Industrial orders PHP  
3. Qualquer write Supabase a partir do browser  
4. Admin/global-config (já parcialmente OK — modelo a copiar)

## 9.2 Pipeline único (PHP)

Extrair (conceitualmente) módulo partilhado já iniciado em `api/auth/index.php`:

```
pimo_require_auth()
pimo_require_org_context()
pimo_require_permission($perm, $resource?)
pimo_require_entitlement($feature)     // fase entitlements
pimo_require_quota($metric)            // fase usage
```

**Objectivo:** endpoints não reinventam decode JWT / checks.

## 9.3 Projects API — contrato alvo

| Acção | Auth | Authz |
|-------|------|-------|
| list mine | JWT/guest | sub/org filter server-side |
| list factory/all | JWT | `project.view.factory` / `project.view.all` |
| load | JWT/guest/public | ACL resource |
| save | JWT (guest token limitado) | edit permission + ownership/org |
| delete | JWT | delete permission + ownership/org |

Cliente: `projectsApi.ts` **IMPROVE** — enviar `Authorization` (mesmo token que `apiClient`).

## 9.4 CORS

- Auth APIs: keep allowlist `pimo.pro`.  
- Projects: **REMOVE** `Access-Control-Allow-Origin: *` em mutações autenticadas; alinhar allowlist.

## 9.5 Industrial

**Opção A (recomendada):** BFF PHP/Node valida JWT → Supabase **service role** só no servidor → queries com `organization_id`.  
**Opção B:** Supabase Auth com JWT custom / linking; RLS estrito; **sem** anon write.  
**REJECTED:** continuar anon key com ALL policies.

---

# 10. Supabase / Database Security

## 10.1 Papéis

| Role | Uso permitido |
|------|----------------|
| `anon` | Apenas dados **explicitamente públicos** (idealmente nenhum industrial) |
| `authenticated` | User Supabase ligado à identidade PIMO (fase bridge) |
| `service_role` | **Só servidor** (BFF); nunca no Vite |

## 10.2 RLS

- **KEEP** ideia das policies 003/004 por role.  
- **REMOVE** permissividade da 013.  
- **IMPROVE** policies para `organization_id` (não só `profiles.role`).  
- RLS = cinturão; BFF = cinto. Ambos.

## 10.3 O que pode ser público

- Marketing, docs públicos, assets estáticos.  
- Projectos com `visibility=public` **via API que aplica ACL** — não dump de tabela.

## 10.4 Secrets

- `.env.production` tracked: processo de **remover do VCS + rotação** (Phase 0).  
- Anon key no frontend é normal **se** RLS estiver correcto; hoje não está.

---

# 11. Admin Architecture

## 11.1 Três planos de admin (não confundir)

| Tipo | Quem | Âmbito |
|------|------|--------|
| **System Admin** | Role platform `admin` / `admin.full_access` | Todas as orgs, global-config, users globais |
| **Organization Admin / Factory Manager** | Membership `ultra+` (+ permissions) | Só a sua Factory: users below, projects factory |
| **Module Admin** | Permissions pontuais | Ex.: regras CAD locais — ainda gated |

## 11.2 `/admin` legado (`LegacyApp` → `AdminPanel`)

| Decisão | Detalhe |
|---------|---------|
| **IMPROVE já** | Exigir `ProtectedRoute` + `PermissionRoute` (`canAccessAdminPanel` ou `hasFullAccess` conforme tab) |
| **KEEP** conteúdo útil | Materiais, regras, ferragens, etc. — valor de produto |
| **REFACTOR** médio prazo | Separar “System settings” vs “Org settings”; tabs `adminOnly` já existem parcialmente |
| **REPLACE** mocks | `/admin/roles`, `/admin/permissions` → vistas read-only do SSOT ou CRUD real |
| **Não apagar** painel inteiro na Phase 1 | Risco alto de parar operações internas |

## 11.3 Settings `/definicoes`

Hoje mostra AdminPanel desabilitado visualmente — **KEEP** ideia de preview; garantir que não há side-effects ativos sem permission (**VERIFY**).

---

# 12. Data Model (conceptual)

## 12.1 Entidades

```
User
  id, email, username, passwordHash, emailVerified, createdAt, status

Organization
  id, type(personal|factory), name, createdAt, status

Membership
  id, userId, organizationId, role,
  extraPermissions[], removedPermissions[],
  status(active|invited|suspended), createdAt

Permission (catálogo)
  key, description

RolePermission
  role, permissionKey

Subscription
  id, organizationId, planId, status, currentPeriodStart/End

Plan
  id, code, name, active

PlanEntitlement
  planId, featureKey, valueJson

OrgEntitlementOverride
  organizationId, featureKey, valueJson, reason, createdBy

UsageCounter
  organizationId, metric, periodKey, count

Project
  id, organizationId, ownerUserId, visibility, name, payload…, timestamps

Session / RefreshToken (fase tokens)
  id, userId, jti, expiresAt, revokedAt

AuditLog
  id, actorUserId, organizationId?, action, resourceType, resourceId, meta, createdAt
```

## 12.2 Cardinalidade e boundaries

| Relação | Cardinalidade | Boundary |
|---------|---------------|----------|
| User ↔ Membership | 1:N | User global |
| Org ↔ Membership | 1:N | Tenant |
| Org ↔ Subscription | 1:1 activa (histório N) | Tenant |
| Org ↔ Project | 1:N | Tenant |
| Plan ↔ PlanEntitlement | 1:N | Global catalog |
| User ↔ Project (owner) | 1:N | Dentro da org |

## 12.3 Persistência por fase

| Fase | Store |
|------|--------|
| Agora→Phase 2 | `users.json` + sidecars JSON `orgs.json` / campos em project JSON |
| Phase 3+ | PostgreSQL (Supabase ou DB dedicada) como SSOT identity/tenant |
| Industrial | Supabase tables + `organization_id` |

**Não** é obrigatório SQL nesta fase de spec; a migração física vem nas phases.

---

# 13. Migration Strategy

## 13.1 Sequência real (adaptada ao PIMO)

```
Current (parcial, inseguro)
    ↓
Phase 0  Security hygiene (secrets, defaults, local-auth)
    ↓
Phase 1  API Authorization (Projects + Industrial PHP + Admin gate)
    ↓
Phase 2  Auth hardening (TTL, /me revalidate, rate limit, password flows)
    ↓
Phase 3  Organization / Factory + project.organizationId
    ↓
Phase 4  RBAC completo (extra/removed) + unificação roles industriais (início)
    ↓
Phase 5  Entitlements resolver (ainda sem billing)
    ↓
Phase 6  Subscriptions (admin-assigned plans)
    ↓
Phase 7  Usage limits
    ↓
Phase 8  Billing (Stripe) — DEFER até 5–7 estáveis
    ↓
Phase 9  Identity store PostgreSQL + session refresh cookies
    ↓
Phase 10 Production readiness / remove shims
```

## 13.2 Coexistência

| Antigo | Novo | Estratégia |
|--------|------|------------|
| users.json role | Membership.role | Dual-write; `/me` lê membership se existir |
| project.ownerId | ownerUserId + organizationId | Backfill: personal org por user; guest → org guest ou só local |
| Permissions só role map | + extra/removed | Default arrays vazios |
| Anon Supabase | BFF / RLS | Feature flag `industrial.anonCompat` só staging |
| JWT 24h | TTL curto + refresh | Reduzir TTL gradualmente |
| Role≈plan | Plan entitlements | Map inicial: visitor→free, pro→pro, ultra→ultra, ultra+→ultra_plus |

## 13.3 Sem breaking changes (possível)

- Adicionar headers Authorization (clientes oficiais controlados).  
- Adicionar campos JSON opcionais (`organizationId`).  
- Feature flags server-side.  
- `/me` campos novos aditivos.

## 13.4 Breaking (planeados)

- Projects API rejeitar requests sem auth.  
- Remover anon write.  
- Remover `K/K` em produção.  
- CORS `*` removido.

**Mitigação:** release notes + janela; guest token; modo offline local intacto.

## 13.5 Quando remover legado

| Remover | Quando |
|---------|--------|
| local-auth prod | Imediatamente após gate DEV |
| ManageRoles mock | Quando SSOT admin existir |
| users.json | Após PostgreSQL + 2 semanas sem dual-read |
| anon policies | Após BFF/RLS verified em staging |
| Role-as-plan heuristics | Após entitlements 100% nas features gated |

---

# 14. Priority: Security First (P0)

Ordem **obrigatória** antes de Subscriptions:

| # | Acção | Critério PASS |
|---|-------|---------------|
| 1 | Fail closed sem `PIMO_JWT_SECRET` | Sem fallback no código |
| 2 | Remover/ignorar secrets no git + rotação | Keys antigas inválidas |
| 3 | AuthZ Projects API | IDOR testes falham (acesso negado) |
| 4 | Fechar industrial orders PHP | 401 sem token |
| 5 | Gate `/admin` + settings industriais | Anónimo não renderiza painel útil |
| 6 | Desactivar local-auth em prod build | Bundle sem `K`/`K` path |
| 7 | Restringir/remover anon RLS 013 | Anon não escreve tabelas industriais |
| 8 | Cliente projects envia Bearer | Save autenticado funciona |

**Gate:** não iniciar Phase 5–8 (entitlements/billing) enquanto 1–7 não estiverem PASS em staging.

---

# 15. Development Strategy

| Bucket | Itens |
|--------|-------|
| **IMMEDIATELY** (Security-critical) | §14 P0 |
| **NEXT** (Architecture-critical) | Org/Factory, project.organizationId, RBAC extra/removed, BFF industrial bridge |
| **LATER** (Feature-critical comercial) | Entitlements, subscriptions admin-assigned, usage limits, UI upgrade |
| **DEFERRED** | Stripe, email verification rigorosa, custom roles, Teams, storage metering fino, Events System produto |

| Classe | Exemplos |
|--------|----------|
| Security-critical | IDOR, anon write, admin gate, JWT secret |
| Architecture-critical | Tenant model, permission formula, entitlement resolver |
| Feature-critical | CNC gated, members limit, plan UX |
| Nice-to-have | Invite codes polish, marketing experiments |

---

# 16. Implementation Phases (detalhe)

### Phase 0 — Security hygiene  
- **Objetivo:** Reduzir riscos sem mudar domínio.  
- **Pré-requisitos:** Aprovação desta spec.  
- **Criar:** procedimento rotação secrets (doc ops).  
- **Alterar:** env handling JWT; gitignore; LoginPage defaults; local-auth DEV-only; desactivar seed admin em prod.  
- **Manter:** fluxo login.  
- **Remover:** fallback secret; credenciais UI.  
- **Riscos:** deploy sem env → auth down (desejável vs secreto fraco).  
- **Testes:** login com secret real; build prod sem bypass.  
- **Done:** checklist §14 itens 1–2, 6.

### Phase 1 — API Authorization & Admin gate  
- **Objetivo:** Parar hemorragia de dados.  
- **Pré-requisitos:** Phase 0.  
- **Criar:** helpers authz partilhados PHP; testes IDOR.  
- **Alterar:** Projects API, projects client, industrial orders, App.tsx admin routes, CORS.  
- **Manter:** formato JSON de project; guest local offline.  
- **Remover:** listagem all anónima.  
- **Riscos:** sync remoto guest.  
- **Mitigação:** guest capability token ou sync só autenticado.  
- **Done:** §14 itens 3–5, 7–8.

### Phase 2 — Authentication hardening  
- **Objetivo:** Sessões dignas de produção.  
- **Criar:** rate limit; password change self; reset real **ou** remover página.  
- **Alterar:** AuthProvider revalidate `/me`; reduzir TTL.  
- **Done:** sem stubs enganadores; brute-force mitigado.

### Phase 3 — Organization / Factory  
- **Objetivo:** Tenant boundary.  
- **Criar:** Org + Membership model (JSON sidecar ou PG); endpoints `/factory/*` mínimos.  
- **Alterar:** projects com `organizationId`; `/me` memberships.  
- **Manter:** roles names.  
- **Done:** ultra+ só vê factory no **servidor**.

### Phase 4 — RBAC complete  
- **Objetivo:** Master Plan permissions efectivas.  
- **Criar:** extra/removed persistence; audit log mudanças.  
- **Alterar:** `pimo_effective_permissions`; users API whitelist roles.  
- **Remover:** mocks ManageRoles como “CRUD falso”.  
- **Done:** fórmula Master Plan no `/me`.

### Phase 5 — Entitlements  
- **Objetivo:** Feature access desacoplado de plan name.  
- **Criar:** catálogo features; resolver; `requireEntitlement` API.  
- **Alterar:** pontos de export/CNC/industrial gated.  
- **Done:** UI adulterada não contorna API.

### Phase 6 — Subscriptions  
- **Objetivo:** Org tem plan atribuído (manual).  
- **Criar:** Subscription + Plan tables/files; admin assign.  
- **Done:** mudar plan muda entitlements sem redeploy de ifs.

### Phase 7 — Usage limits  
- **Objetivo:** Quotas.  
- **Criar:** counters; erros tipados.  
- **Done:** limite de projects/members enforced.

### Phase 8 — Billing  
- **DEFER** até Phase 6–7 estáveis. Stripe webhooks → subscription status.

### Phase 9 — Identity & session modernization  
- PostgreSQL SSOT; refresh cookies; bridge industrial final; remover dual-read.

### Phase 10 — Production readiness  
- Pen-test A01; docs ops; remover shims; performance.

---

# 17. File / Module Impact Analysis

| Área / módulo | Classificação | Phases |
|---------------|---------------|--------|
| `api/auth/index.php` | IMPROVE → REFACTOR | 0–2, 4, 9 |
| `api/users/index.php` | IMPROVE | 1, 4 |
| `api/user-settings/index.php` | KEEP (padrão a clonar) | — |
| `api/global-config/index.php` | KEEP + IMPROVE | 1 |
| `public_html/api/projects/index.php` | IMPROVE (crítico) | 1, 3 |
| `api/industrial/orders/index.php` | IMPROVE | 1 |
| `src/auth/*` | KEEP + IMPROVE | 0–2, 4–5 |
| `src/api/apiClient.ts` / `authApi.ts` | KEEP + IMPROVE | 1–2 |
| `src/core/projects/*` | IMPROVE | 1, 3 |
| `src/local-auth.ts` | REMOVE prod | 0 |
| `src/App.tsx` routes admin | IMPROVE | 1, 11 |
| `src/pages/AdminPanel.tsx` | KEEP + IMPROVE | 1, 11 |
| `ManageRoles/Permissions` | REPLACE | 4 |
| `inviteCodesMock` | DEFER/REPLACE | later |
| `industrial/infra/supabase/*` | REFACTOR | 1, 5, 9 |
| `industrial/core/permissions/*` | REFACTOR merge | 4–5 |
| `industrial/core/auth/*` | REFACTOR bridge | 5, 9 |
| `supabase/migrations/013_*` | REMOVE/REPLACE policies | 1 |
| `LandingPage` pricing | KEEP | 6 (wire later) |
| `docs/PIMO-CRIATIVO-MASTER-PLAN.md` | KEEP + possível addendum | 3–6 |
| NEW: `api/authz/*` helpers | NEW | 1 |
| NEW: orgs/memberships/entitlements modules | NEW | 3–7 |
| NEW: BFF industrial | NEW | 1 ou 5 |

---

# 18. Backward Compatibility

| Superfície | Estratégia |
|------------|------------|
| APIs auth existentes | Paths KEEP; campos aditivos em `/me` |
| Projects JSON | Campos novos opcionais; readers tolerantes |
| Frontend AuthProvider | KEEP API `login/logout/hasPermission`; estender `hasEntitlement` depois |
| JWT | Mesmo issuer/secret rotation com overlap curto |
| users.json | Dual-write até PG |
| Guest offline | KEEP localStorage; sync remoto autenticado |
| Industrial UI | Flag compat; degradar writes até BFF |
| Clientes externos API | **UNKNOWN** — Needs Verification se há integradores além do SPA |

**Feature flags sugeridas (server):**  
`authz.projects.enforce`, `industrial.anonCompat`, `entitlements.enforce`, `org.required`.

**Versioned APIs:** não obrigatório se enforce for flagável; se houver integradores, `/api/v2/projects`.

---

# 19. Testing & Validation Plan

## 19.1 Critérios PASS/FAIL (exemplos objectivos)

| ID | Caso | PASS | FAIL |
|----|------|------|------|
| T-AUTH-01 | Login válido | 200 + JWT | — |
| T-AUTH-02 | Login inválido | 401 | 200 |
| T-AUTH-03 | Sem `PIMO_JWT_SECRET` em prod mode | processo recusa arranque auth | usa fallback |
| T-AUTH-04 | Build prod | sem bypass K/K | bypass activo |
| T-API-01 | GET project alheio sem auth | 401/403 | 200 |
| T-API-02 | GET project alheio outro user | 403 | 200 |
| T-API-03 | scope=all visitor | 403 | 200 lista global |
| T-API-04 | save com Bearer dono | 200 | 401 |
| T-ADM-01 | GET `/admin` anónimo | redirect/login ou deny | AdminPanel útil |
| T-RLS-01 | anon INSERT industrial | denied | success |
| T-RBAC-01 | visitor edit project próprio (se só view) | deny conforme mapa | allow indevido |
| T-ORG-01 | ultra+ org A lê project org B | 403 | 200 |
| T-ENT-01 | permission OK, entitlement OFF | 402/403 tipado | 200 |
| T-ENT-02 | entitlement OK, permission OFF | 403 | 200 |
| T-LIM-01 | projects.max excedido | deny create | create |
| T-REG-01 | CAD save offline local | continua | regressão |

## 19.2 Pirâmide

- Unit: rbacHelpers, entitlement merge, effective permissions.  
- Integration: PHP endpoints com fixtures users/projects.  
- E2E: register→login→CRUD project→logout; admin deny.  
- Security pack: suite A01 em CI a cada PR que toque `api/**` ou `projects/**`.

---

# 20. Security Gates

| Antes de… | Gate obrigatório |
|-----------|------------------|
| Qualquer Phase ≥ 5 (Entitlements) | Phase 1 PASS (Projects + industrial + admin) |
| Phase 6 Subscriptions | Entitlement resolver + org model PASS |
| Phase 8 Billing | Subscriptions manuais estáveis + webhooks staging |
| Abrir registo público massivo | Rate limit + password policy + (recomendado) email verify |
| Remover users.json | Dual-read 0 erros N dias + backup |
| Remover anonCompat | RLS org_id + BFF PASS T-RLS-* |
| Marketing “planos activos” | Entitlements enforce nas features anunciadas |

**Hard stop:** se IDOR Projects reabrir, **congelar** features comerciais até corrigir.

---

# 21. Final Architectural Decisions

### D1 — Authentication technology  
- **DECISION:** Manter JWT HS256 PHP no curto prazo; endurecer; evoluir para refresh + httpOnly.  
- **WHY:** Menor risco/retrabalho; problema real é authz, não IdP.  
- **ALTERNATIVES:** Auth0/Clerk agora; só Supabase Auth.  
- **RECOMMENDATION:** D1.  
- **IMPACT:** Reusa `api/auth`, `AuthProvider`.

### D2 — JWT / session strategy  
- **DECISION:** Access JWT curto + refresh (Phase 2/9); claims mínimos; permissions via `/me`.  
- **WHY:** Revogação prática + menor janela XSS.  
- **ALTERNATIVES:** JWT 24h forever; sessions server-only opacas.  
- **RECOMMENDATION:** JWT curto + refresh.  
- **IMPACT:** AuthProvider + PHP encode.

### D3 — RBAC  
- **DECISION:** KEEP keys + 5 roles names; implementar extra/removed; role no Membership.  
- **WHY:** Master Plan + código existente.  
- **ALTERNATIVES:** Rebater roles para Owner/Manager/… já.  
- **RECOMMENDATION:** Evoluir semântica; não renomear já.  
- **IMPACT:** PHP map + rbacHelpers.

### D4 — Organizations  
- **DECISION:** Organization ≡ Factory; personal org no signup.  
- **WHY:** Multi-tenant real + migração suave.  
- **ALTERNATIVES:** Só user-scoped sem org.  
- **RECOMMENDATION:** Org obrigatória para resources sync.  
- **IMPACT:** Projects + users model.

### D5 — Multi-tenancy  
- **DECISION:** Isolamento API-first + RLS defense-in-depth.  
- **WHY:** JSON actual não tem RLS; industrial sim.  
- **ALTERNATIVES:** Só RLS; só obscurity de IDs.  
- **RECOMMENDATION:** Dupla camada.  
- **IMPACT:** Todos endpoints de dados.

### D6 — Database security / RLS  
- **DECISION:** Remover anon write; service_role só BFF; policies por `organization_id`.  
- **WHY:** P0 auditoria.  
- **ALTERNATIVES:** Manter 013 “por facilidade”.  
- **RECOMMENDATION:** Eliminar 013 permissivo.  
- **IMPACT:** Cliente industrial.

### D7 — Subscription model  
- **DECISION:** Subscription na Org; Plan catálogo; admin-assign antes de Stripe.  
- **WHY:** Monetização sem bloquear segurança.  
- **ALTERNATIVES:** Subscription no User.  
- **RECOMMENDATION:** Org-level.  
- **IMPACT:** Ultra+ factory billing natural.

### D8 — Entitlements  
- **DECISION:** Feature keys + limits; proibir `if plan==`.  
- **WHY:** Evolução de planos sem rewrite.  
- **ALTERNATIVES:** Flags por role name.  
- **RECOMMENDATION:** Entitlements SSOT comercial.  
- **IMPACT:** Export/CNC/API gates.

### D9 — Usage limits  
- **DECISION:** Counters por org/metric/period após entitlements.  
- **WHY:** Necessário a Pro/Free.  
- **ALTERNATIVES:** Só boolean features.  
- **RECOMMENDATION:** Phase 7.  
- **IMPACT:** create project / invite member.

### D10 — API authorization  
- **DECISION:** Pipeline partilhado PHP; Projects e Industrial first.  
- **WHY:** Padrão já bom em users/settings.  
- **ALTERNATIVES:** Middleware ad hoc por ficheiro.  
- **RECOMMENDATION:** Helpers únicos.  
- **IMPACT:** `api/**`.

### D11 — Admin architecture  
- **DECISION:** Gate imediato; distinguir System vs Org admin; KEEP AdminPanel.  
- **WHY:** Conteúdo valioso + rota perigosa.  
- **ALTERNATIVES:** Reescrever admin do zero.  
- **RECOMMENDATION:** Secure-then-refactor.  
- **IMPACT:** `App.tsx`, AdminPanel.

### D12 — Migration strategy  
- **DECISION:** Gradual security→tenant→rbac→entitlements→billing; dual-write; flags.  
- **WHY:** Sistema em produção de facto (pimo.pro).  
- **ALTERNATIVES:** Big-bang rewrite.  
- **RECOMMENDATION:** Sequência §13.  
- **IMPACT:** Calendarização de toda a org.

### D13 — Industrial identity  
- **DECISION:** BFF autenticado com JWT PIMO (preferido) ou bridge Supabase Auth; fim do dual orphan.  
- **WHY:** Hoje UI PHP auth + dados anon.  
- **ALTERNATIVES:** Dois logins permanentes.  
- **RECOMMENDATION:** Um login PIMO.  
- **IMPACT:** `industrial/core/auth`, supabase client usage.

---

# 22. Executive Roadmap

```
PHASE 0  Security Stabilization
         secrets · defaults · local-auth DEV-only
              │
PHASE 1  Authentication & API Protection   ◄── P0 CRÍTICO
         Projects ACL · industrial orders · admin gate · RLS anon
              │
PHASE 2  Auth Hardening
         /me revalidate · rate limit · password flows · TTL
              │
PHASE 3  Organization / Factory
         personal+factory orgs · membership · project.organizationId
              │
PHASE 4  Roles & Permissions
         extra/removed · whitelist · audit · industrial role merge start
              │
PHASE 5  Entitlements
         feature catalog · requireEntitlement on APIs
              │
PHASE 6  Subscriptions
         plans · admin-assigned subscription per org
              │
PHASE 7  Usage Limits
         counters · quotas
              │
PHASE 8  Billing (DEFER until 6–7 solid)
         Stripe · webhooks
              │
PHASE 9  Platform Hardening
         PG SSOT · refresh cookies · remove shims
              │
PHASE 10 Production Readiness
         security pack CI · ops runbooks
```

---

# 23. Most Important Question — Ordem exacta recomendada

> Se fosses responsável tecnicamente por este projeto, qual seria a ordem exacta…?

**Resposta objectiva:**

1. **Phase 0** — secrets/JWT fail-closed, remover bypass e defaults (horas–1 dia).  
2. **Phase 1** — fechar Projects API + industrial orders + `/admin` + anon RLS (prioridade absoluta; dias).  
3. **Phase 2** — endurecer sessão/login (paralelo curto após 1).  
4. **Phase 3** — Organization/Factory + `organizationId` nos projects (base de tudo o resto).  
5. **Phase 4** — completar RBAC Master Plan (extra/removed) no servidor.  
6. **Phase 5** — Entitlements (ainda sem pagar).  
7. **Phase 6** — Subscriptions atribuídas manualmente.  
8. **Phase 7** — Usage limits.  
9. **Phase 8** — Billing.  
10. **Phase 9–10** — modernizar store/sessão e limpar legado.

**Justificação:** o maior risco e custo futuro é **dados acessíveis sem ACL**. Subscriptions cedo criariam UI comercial sobre um buraco de segurança e forçariam reescritas. Org/tenant **antes** de entitlements evita amarrar features ao `user.role` para sempre. Manter JWT/AuthProvider/permission keys **minimiza retrabalho** enquanto se corrige o que realmente está partido.

---

## Diferenças / correcções vs relatório de auditoria

| Tópico | Relatório | Esta spec |
|--------|-----------|-----------|
| Reconstruir auth | Implícito “melhorar” | Explícito: **não** trocar IdP agora |
| Roles industriais | Dual stack problemático | Plano de **merge via permissions/BFF**, não dois RBAC eternos |
| users.json | Frágil | Aceite na transição; PG na Phase 9, não Phase 1 |
| Guest | Risco IDOR | Modo offline KEEP + guest token ou sync só auth |
| Fórmula allow | Proposta | Confirmada com matriz permission×entitlement |
| AdminPanel | Risco | **KEEP + gate**, não delete |

Nenhuma contradição factual material encontrada no código na revalidação pontual (Projects sem Bearer; `/admin` sem PermissionRoute; JWT fallback; migration 013).  
Itens **UNKNOWN / NEEDS VERIFICATION:** valor real de `PIMO_JWT_SECRET` em produção; se 013 está aplicada no projecto Supabase live; integradores externos da Projects API; colunas `organization_id` parciais no schema industrial live.

---

## Declaração de integridade (Fase 2)

- Documento criado apenas para planeamento.  
- **Sem** implementação, migrations, alterações de dependências ou refactors.  
- Próximo passo: **revisão humana e aprovação** → então Fase 3 de implementação faseada com diffs explícitos.

---

*Fim da Architecture & Implementation Specification.*
