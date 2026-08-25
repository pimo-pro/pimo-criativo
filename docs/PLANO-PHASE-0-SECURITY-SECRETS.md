# PHASE 0 — Security & Secrets Planning

**Projeto:** pimo-criativo  
**Documento:** Especificação de implementação da Phase 0 (apenas planeamento)  
**Data:** 24 de Agosto de 2026  
**Fontes:**  
- `docs/RELATORIO-AUDITORIA-AUTH-AUTHZ-SUBSCRIPTIONS.md`  
- `docs/SPEC-ARQUITETURA-AUTH-AUTHZ-SUBSCRIPTIONS.md`  
- Inspeção do código e CI (`api/auth`, `src/local-auth`, `.env*`, `.github/workflows`, industrial Supabase, quotes)  

**Estado:** Implementado no working tree (2026-08-24) — ver `docs/PHASE-0-IMPLEMENTATION-REPORT.md`  
**Nota:** Este ficheiro permanece como plano de referência; a execução está documentada no relatório de implementação.  
**Âmbito:** Secrets, configuração insegura, credenciais, exposição frontend/backend, higiene de ambiente  
**Fora de âmbito (Phase 1+):** AuthZ da Projects API, gate `/admin`, remoção RLS anon write, Organizations, RBAC completo, Subscriptions, Authentication Hardening (TTL/refresh/rate-limit além do mínimo ligado a secrets)

---

# 1. Executive Summary

A Phase 0 existe para **eliminar segredos fracos, hardcoded, versionados ou mal classificados** antes de qualquer trabalho de autorização de APIs (Phase 1).

### Problema central

O sistema misturou três classes de configuração:

1. **Secrets de servidor** (JWT signing) com **fallback no código-fonte**  
2. **Credenciais / bypass de desenvolvimento** compiláveis no **bundle de produção**  
3. **Variáveis `VITE_*`** (públicas por natureza no Vite) a carregar valores que são **secretos ou semi-secretos**, e um ficheiro `.env.production` **tracked no git**

### Objectivo da Phase 0

| Objectivo | Resultado |
|-----------|-----------|
| Fail-closed no JWT | Sem `PIMO_JWT_SECRET` → auth PHP não assina/valida com secret default |
| Zero secrets no VCS | `.env.production` e afins fora do tracking; placeholders só em `.env.example` |
| Zero bypass em prod | `local-auth` e seed admin default inacessíveis em builds/ambientes de produção |
| Classificação clara PUBLIC vs SERVER-ONLY | Documentada e reflectida no código/CI |
| Plano de rotação | Operacional, sem executar agora |
| Não partir login | Compatibilidade com sobreposição de secrets durante rotação |

### O que Phase 0 **não** resolve

- IDOR / Projects API aberta → **Phase 1**  
- RLS `anon` write (migration 013) → **Phase 1** (mencionado aqui só como dependência de risco da anon key)  
- Refresh tokens, rate limit completo, password reset → **Phase 2**  
- Org/Factory, entitlements → **Phase 3+**

---

# 2. Current Security State

| Área | Estado actual | Severidade Phase 0 |
|------|---------------|--------------------|
| JWT signing secret | `getenv('PIMO_JWT_SECRET')` + **fallback hardcoded** em `api/auth/index.php` | **P0** |
| Valor de `PIMO_JWT_SECRET` em Hostinger | **UNKNOWN / NEEDS VERIFICATION** | P0 se = fallback ou ausente |
| `.env.production` | **Tracked no git** com URL Supabase + anon/publishable key | **P0** |
| `.gitignore` | Ignora só `.env`, **não** `.env.production` | **P0** |
| `.env.example` | Sem `PIMO_JWT_SECRET`; tem `VITE_INTERNAL_API_SECRET` | **P1** |
| Login UI defaults | `admin@pimo.local` / `admin123` | **P0** |
| Seed admin PHP | `pimo_ensure_default_admin()` cria admin conhecido | **P0** |
| Local auth bypass | `K`/`K` → `local-dev-token` no bundle (não gated por DEV) | **P0** |
| Supabase anon no frontend | Esperado no Vite; **perigoso** enquanto RLS anon write existir | **P0** (credencial) / fix RLS = Phase 1 |
| Supabase service role | Em GitHub Secrets (`SUPABASE_SERVICE_ROLE_KEY`); **não** no cliente TS | **OK padrão** (KEEP) |
| `VITE_INTERNAL_API_SECRET` | Injectado no build CI → **embaixo no JS público** | **P1** |
| GitHub PAT projects sync | Env `PIMO_GITHUB_PROJECTS_TOKEN` ou ficheiro local gitignored | **OK se só env** |
| SMTP vars | Em `.env.example`; não ligados ao auth ainda | **P3** / CAN WAIT |
| FTP deploy secrets | Só GitHub Actions secrets | **OK** (fora do app runtime) |

**Veredicto:** a base de auth “funciona”, mas a postura de secrets é **inadequada para produção**. Phase 0 é pré-requisito obrigatório da Phase 1.

---

# 3. Complete Secrets Inventory

Legenda de classificação:  
`PUBLIC` · `CLIENT-SAFE` · `SERVER-ONLY` · `SECRET` · `DANGEROUS IF EXPOSED`

| ID | Item | Localização | Utilização | Risco | Classificação | Prioridade | Acção | Recomendação |
|----|------|-------------|------------|-------|---------------|------------|-------|--------------|
| S01 | JWT HS256 fallback string | `api/auth/index.php` `pimo_jwt_secret()` | Assinar/validar JWT se env vazio | Forja de tokens admin se fallback activo | **SECRET** + **DANGEROUS IF EXPOSED** | **P0** **MUST FIX NOW** | Remover fallback; fail-closed |
| S02 | `PIMO_JWT_SECRET` env | Hostinger / PHP `getenv` | Secret real de signing | Compromisso = forja JWT | **SERVER-ONLY** **SECRET** | **P0** | Garantir set em prod; documentar em example (vazio) |
| S03 | Admin password seed `admin123` | `pimo_ensure_default_admin()` | Cria `admin@pimo.local` | Conta privilegiada previsível | **SECRET** (credencial) | **P0** **MUST FIX NOW** | Só com flag explícita non-prod; nunca prod |
| S04 | Login defaults UI | `src/pages/LoginPage.tsx` | Prefill email/password | Ajuda brute-force / leak UX | **DANGEROUS IF EXPOSED** | **P0** **MUST FIX NOW** | Campos vazios |
| S05 | Bypass `K`/`K` + `local-dev-token` | `src/local-auth.ts` + `AuthProvider` | Login falso sem API | Entrada em rotas Protected | **DANGEROUS IF EXPOSED** | **P0** **MUST FIX NOW** | Só `import.meta.env.DEV` |
| S06 | `.env.production` tracked | Repo root (git ls-files) | Build local / publish | Keys no histórico git | Mistura CLIENT + sensível | **P0** **MUST FIX NOW** | Untrack + gitignore + rotação |
| S07 | `VITE_SUPABASE_URL` | `.env*`, CI, `industrial/infra/supabase/client.ts` | Cliente Supabase | Identifica projecto | **PUBLIC** / **CLIENT-SAFE** | P2 | KEEP no Vite; OK no client |
| S08 | `VITE_SUPABASE_ANON_KEY` | Idem | PostgREST anon | Com RLS fraco = acesso dados | **CLIENT-SAFE** nominal; **DANGEROUS** com policies abertas | **P0** (contexto) | Rodar key após fechar RLS (Phase 1); Phase 0: tirar do git |
| S09 | `SUPABASE_SERVICE_ROLE_KEY` | GitHub secret; workflow migrations | CI verify / futuro BFF | Bypass total RLS | **SERVER-ONLY** **SECRET** | P1 vigilância | Nunca `VITE_`; nunca bundle |
| S10 | `DATABASE_URL` / DB password | GitHub secrets (migrations) | CI migrations | Acesso BD | **SERVER-ONLY** **SECRET** | P1 | KEEP só CI/ops |
| S11 | `VITE_INTERNAL_API_SECRET` | CI → `.env.production` build; `sendQuoteRequestEmail.ts` | Header `x-internal-secret` mail service | Qualquer user extrai do JS | **DANGEROUS IF EXPOSED** (hoje é VITE) | **P1** **SHOULD FIX** | Deixar de ser `VITE_`; proxy server-side (pode ser Phase 0.5 ou 1) |
| S12 | `VITE_API_URL` | env / `apiClient` / `config/api.ts` | Base URL API | Não é secret | **PUBLIC** **CLIENT-SAFE** | P3 | KEEP |
| S13 | `VITE_TEXTURES_URL` | env / CI | Assets | Não é secret | **PUBLIC** | P3 | KEEP |
| S14 | `PIMO_GITHUB_PROJECTS_TOKEN` | Hostinger env / `githubSyncConfig.php` (gitignored) | Sync projetos→GitHub | Write repo | **SERVER-ONLY** **SECRET** | P1 | Só env; example vazio (já) |
| S15 | `PIMO_GITHUB_PROJECTS_SYNC` | Hostinger env | Enable sync | Config | **SERVER-ONLY** | P3 | KEEP |
| S16 | FTP_HOST/USER/PASSWORD | GitHub Actions | Deploy | Acesso hosting | **SERVER-ONLY** **SECRET** | P2 | KEEP CI only |
| S17 | SMTP_* / EMAIL_TO | `.env.example` | Futuro email | Credenciais mail | **SERVER-ONLY** **SECRET** | P3 **CAN WAIT** | Não usar no Vite |
| S18 | `users.json` passwordHash | `api/data/users.json` (gitignored) | Auth | Se web-exposed = dump hashes | **SERVER-ONLY** | P1 | Confirmar docroot; KEEP ignore |
| S19 | Invite codes mock | `inviteCodesMock.ts` | UI registo | Não são secrets reais | PUBLIC fake | P3 **CAN WAIT** | Fora Phase 0 |
| S20 | Hardcoded mail URL | `sendQuoteRequestEmail.ts` | Endpoint Render | Não secret; surface | PUBLIC | P3 | CAN WAIT |

---

# 4. JWT Secret Analysis

## 4.1 Onde está

```18:25:api/auth/index.php
function pimo_jwt_secret(): string
{
    $env = getenv('PIMO_JWT_SECRET');
    if (is_string($env) && $env !== '') {
        return $env;
    }
    return 'pimo-hostinger-mudar-este-segredo-min-32-chars!!';
}
```

- **Não** aparece em `.env.example`.  
- **Não** é injectado no workflow `deploy.yml` (só variáveis Vite).  
- Deve viver **apenas** no ambiente PHP do Hostinger (painel / `.user.ini` / env do PHP-FPM) — **SERVER-ONLY**.

## 4.2 Onde é utilizado

| Função / fluxo | Ficheiro | Uso |
|----------------|----------|-----|
| `pimo_jwt_encode` | `api/auth/index.php` | Login → emite Bearer |
| `pimo_jwt_decode` | mesmo | `/me`, users CRUD, user-settings, global-config PATCH |
| Inclusões | `api/users`, `api/user-settings`, `api/global-config` | Via `require` auth lib |

TTL actual: `PIMO_JWT_TTL = 86400` (24h). Alterar TTL **não** é Phase 0 (Phase 2); mas rotação de secret **invalida** todos os JWT independentemente do TTL.

## 4.3 Fallback

| Existe? | Sim |
| Impacto se env ausente | Todos os tokens assinados com string **pública no repositório** |
| Exploração conceptual | Atacante que lê o código forja `sub` de admin → `/users`, global-config, etc. |

**UNKNOWN:** se produção Hostinger já define `PIMO_JWT_SECRET` diferente do fallback.  
**Assumir pior caso** até verificação ops: tratar como comprometido.

## 4.4 Solução proposta (Phase 0)

1. **Remover** a string de fallback do código.  
2. **Fail-closed:** se secret ausente ou comprimento &lt; 32 (recomendado ≥ 64 bytes aleatórios):  
   - login / encode → HTTP 503 com mensagem genérica “Auth misconfigured”  
   - decode → tratar como inválido (401)  
3. **Documentar** em `.env.example` (e runbook Hostinger):  
   `PIMO_JWT_SECRET=` com comentário SERVER-ONLY, nunca Vite.  
4. **Gerar** secret com CSPRNG (ex. 64 bytes hex/base64).  
5. **Não** colocar `PIMO_JWT_SECRET` em ficheiros `VITE_*` nem no frontend.

### Onde a configuração deve viver

| Ambiente | Onde |
|----------|------|
| Production (Hostinger) | Variável de ambiente PHP / painel — **única fonte** |
| Staging | Secret separado (nunca o mesmo que prod) |
| Development local | `.env` local **gitignored** **ou** `putenv` via stack PHP local; secret fraco de dev OK se nunca = prod |
| CI frontend | **Não precisa** de JWT secret (build Vite não assina JWT) |

### Quem pode / não pode ler

| Actor | Pode ler JWT secret? |
|-------|----------------------|
| Processo PHP auth | Sim |
| Browser / bundle JS | **Não** |
| Vite / `import.meta.env` | **Não** |
| GitHub Actions build | **Não** (a menos que no futuro exista job PHP de teste com secret de staging) |
| Supabase | **Não** (plano de identidade separado) |

## 4.5 Impacto nos JWT existentes

| Cenário | Efeito |
|---------|--------|
| Mudar secret sem overlap | Todos os Bearer actuais falham validação → utilizadores precisam de **novo login** |
| Overlap (dual-secret) | Ver §11 — janela de aceitar secret antigo + novo |

Phase 0 **deve** planear logout forçado aceite (re-login) ou dual-verify temporário.

## 4.6 Estratégia de rotação (resumo; detalhe §11)

1. Verificar secret actual em Hostinger.  
2. Se = fallback ou desconhecido → **comprometedido** → rotação obrigatória.  
3. Preferir dual-secret 24–48h se houver sessões activas críticas; senão cutover imediato + comunicar re-login.  
4. Remover fallback do código **na mesma release** em que o secret forte está confirmado no host (ordem exacta §9).

---

# 5. Environment Variables

| Variável | Classificação | Onde deve viver | Notas Phase 0 |
|----------|---------------|-----------------|---------------|
| `PIMO_JWT_SECRET` | **SERVER-ONLY** **SECRET** | Hostinger PHP only | **MUST** documentar + exigir |
| `PIMO_ALLOW_DEFAULT_ADMIN` | SERVER-ONLY (flag) | Só dev/staging | Novo; default ausente = seed OFF |
| `PIMO_GITHUB_PROJECTS_TOKEN` | **SERVER-ONLY** **SECRET** | Hostinger | Já padrão correcto |
| `PIMO_GITHUB_PROJECTS_SYNC` | SERVER-ONLY | Hostinger | OK |
| `VITE_API_URL` | **PUBLIC** **CLIENT-SAFE** | Build / CI | KEEP |
| `VITE_TEXTURES_URL` | **PUBLIC** | Build / CI | KEEP |
| `VITE_SUPABASE_URL` | **PUBLIC** **CLIENT-SAFE** | Build / CI | KEEP; não é signing secret |
| `VITE_SUPABASE_ANON_KEY` | **CLIENT-SAFE** (com RLS correcto) / **DANGEROUS** agora | Build / CI; **não** no git | Untrack `.env.production`; rotação após Phase 1 RLS |
| `VITE_INTERNAL_API_SECRET` | **DANGEROUS IF EXPOSED** (mal nomeada) | Hoje: Vite bundle | **SHOULD FIX:** renomear conceptualmente para server proxy; Phase 0 mínimo = não versionar valor |
| `SUPABASE_SERVICE_ROLE_KEY` | **SERVER-ONLY** **SECRET** | GitHub Secrets / futuro BFF | Nunca VITE |
| `DATABASE_URL` | **SERVER-ONLY** **SECRET** | CI | KEEP |
| `SUPABASE_DB_PASSWORD` | **SERVER-ONLY** **SECRET** | CI | KEEP |
| `SUPABASE_PROJECT_REF` | SERVER-ONLY / semi-public | CI | OK |
| `FTP_*` | **SERVER-ONLY** **SECRET** | CI deploy | KEEP |
| `SMTP_*` / `EMAIL_TO` | **SERVER-ONLY** **SECRET** | Futuro mail PHP/serviço | CAN WAIT; nunca VITE |

### Regra Vite (obrigatória na Phase 0)

> Tudo o que começa por `VITE_` **acaba no JavaScript público**.  
> Se não pode ser visto por qualquer visitante do site → **não pode ser `VITE_`**.

---

# 6. Supabase / Industrial Credentials

## 6.1 Estado actual

| Credencial | No frontend? | No git? | Uso |
|------------|--------------|---------|-----|
| Anon / publishable key | Sim (`VITE_SUPABASE_ANON_KEY`) | Sim (`.env.production` tracked) | `createClient` industrial |
| URL project | Sim | Sim | Idem |
| Service role | Não no TS app | Não no repo (só GH secret) | CI migrations verify |

Cliente: `src/industrial/infra/supabase/client.ts` — falha se URL/key ausentes.

## 6.2 Relação com RLS / BFF

- **Anon key no browser é normal** em apps Supabase **se** RLS restringe correctamente.  
- Auditoria: migration `013_industrial_anon_rls.sql` permite anon ALL → a anon key torna-se **equivalente a chave de escrita**.  
- **Phase 0:** higiene (tirar do git, planear rotação).  
- **Phase 1:** fechar policies + (recomendado) BFF; **depois** rodar anon key (rotação completa).

## 6.3 Arquitectura futura (já na SPEC; Phase 0 só alinha credenciais)

| Role | Quem usa | Phase |
|------|----------|-------|
| `anon` | Browser, só leituras públicas mínimas | 1 restringe |
| `authenticated` | Após bridge identidade | 5/9 |
| `service_role` | BFF servidor only | 1/5 |

Phase 0 **não** implementa BFF; **proíbe** introduzir `VITE_SUPABASE_SERVICE_ROLE_KEY`.

## 6.4 Riscos actuais (credenciais)

| Risco | Prioridade |
|-------|------------|
| Anon key no histórico git | P0 MUST (exposição) |
| Anon key + RLS open | P0 (exploit dados) — **fixediação RLS = Phase 1** |
| Service role leak CI logs | P1 SHOULD (auditar workflows) |
| Confusion JWT PHP vs Supabase Auth | P2 — documentação; unificação depois |

---

# 7. Proposed Changes

Cada item é **proposta para implementação futura**, não execução.

### C01 — Fail-closed JWT secret  
- **Problema:** Fallback hardcoded.  
- **Ficheiro:** `api/auth/index.php` (`pimo_jwt_secret` + callers encode).  
- **Alteração:** Remover return default; se ausente/ curto → erro controlado; opcional helper `pimo_jwt_secret_or_fail()`.  
- **Motivo:** Impedir signing com secret público.  
- **Risco:** Auth down se Hostinger sem env.  
- **Dependências:** Secret real já configurado **antes** do deploy do código fail-closed (ver §9).  
- **Impacto:** Login/`/me`/users/settings/global-config.  
- **P0 MUST FIX NOW**

### C02 — Documentar `PIMO_JWT_SECRET`  
- **Ficheiro:** `.env.example` (+ comentário SERVER-ONLY; valor vazio).  
- **Alteração:** Adicionar variável e nota “nunca VITE / nunca commit”.  
- **Risco:** Baixo.  
- **P0 MUST**

### C03 — Untrack `.env.production` + gitignore  
- **Ficheiros:** `.gitignore`, git index (comando `git rm --cached` na implementação).  
- **Alteração:** Ignorar `.env.production`, `.env.local`, `.env.*.local`; manter `.env.example`.  
- **Motivo:** Parar novas fugas; CI já gera `.env.production` no job.  
- **Risco:** Devs locais que dependiam do ficheiro tracked.  
- **Mitigação:** README curto no example: copiar de CI secrets / pedir ao lead.  
- **P0 MUST**  
- **Nota:** Limpeza de **histórico git** (filter-repo) é ops separada — SHOULD, não bloqueia Phase 0 código.

### C04 — LoginPage sem credenciais default  
- **Ficheiro:** `src/pages/LoginPage.tsx`  
- **Alteração:** `useState("")` para email e password.  
- **Risco:** Nenhum funcional.  
- **P0 MUST**

### C05 — Desactivar seed admin em produção  
- **Ficheiro:** `api/auth/index.php` `pimo_ensure_default_admin`  
- **Alteração:** Só executar se `getenv('PIMO_ALLOW_DEFAULT_ADMIN') === '1'` **e** ambiente ≠ production (heurística: flag explícita; nunca implícito). Em produção flag ignorada/forçada off.  
- **Motivo:** Eliminar criação automática `admin@pimo.local`/`admin123`.  
- **Risco:** Ambientes novos sem users — precisa bootstrap manual documentado.  
- **P0 MUST**  
- **Ops:** Se conta default já existe em prod → **mudar password / desactivar / apagar** (procedimento §11).

### C06 — `local-auth` apenas DEV  
- **Ficheiros:** `src/local-auth.ts`, `src/auth/AuthProvider.tsx` (e redirects `LoginPage` se necessário).  
- **Alteração:** `tryLocalAuth` retorna false imediatamente se `!import.meta.env.DEV`; opcional dead-code elimination.  
- **Motivo:** Bypass fora do bundle efectivo de prod.  
- **Risco:** Workflows internos que usam K/K em “prod-like” — devem usar contas reais.  
- **P0 MUST**

### C07 — CI: não persistir secrets no artefact desnecessariamente  
- **Ficheiro:** `.github/workflows/deploy.yml`  
- **Alteração:** Manter geração runtime de `.env.production` no job; garantir que artefact upload **não** inclui `.env.production` (hoje upload é `dist/**` + `version.json` — OK). Rever se `scripts/publish.js` `ensureProductionEnv` escreve secrets em disco versionável em máquinas de dev.  
- **P1 SHOULD**  
- **publish.js:** documentar que merge para `.env.production` local é perigoso se ficheiro for commitado — após C03 mitiga.

### C08 — `VITE_INTERNAL_API_SECRET` postura  
- **Problema:** Secret no bundle.  
- **Opções Phase 0:**  
  - **Mínimo:** garantir valor não está no git; rotação no GH secret + mail service.  
  - **Correcto (recomendado como follow-up imediato pós-0 ou início Phase 1):** endpoint PHP proxy `POST /api/quotes/send` com auth utilizador; secret só servidor.  
- **Classificação:** P1 SHOULD FIX (arquitectura); não bloqueia fail-closed JWT.  
- **Não** fingir que “está no .env” resolve exposição Vite.

### C09 — Runbook ops (novo doc? **Não nesta tarefa**)  
- Phase 0 implementação pode **actualizar** este mesmo plano com checklist executada, ou adicionar secção “Executed” — **sem** criar ficheiros extra **agora**.  
- Na implementação: preferir editar este ficheiro ou README ops existente **só se autorizado**.

### C10 — Verificação Hostinger `users.json` não web-reachable  
- **Problema:** Path sob `api/data/` — se docroot mal configurado, hashes expostos.  
- **Alteração:** Verificação ops + regra rewrite; sem mudança código se já OK.  
- **P1 SHOULD** / **UNKNOWN** até verificar.

### Explicitamente **NÃO** em Phase 0

| Item | Phase |
|------|-------|
| Auth Projects API | 1 |
| Fechar RLS 013 | 1 |
| Gate `/admin` | 1 |
| Reduzir JWT TTL / refresh | 2 |
| Rate limit login | 2 |
| Org model | 3 |

---

# 8. File-by-File Impact

Ficheiros **provavelmente alterados** quando a implementação for autorizada:

| Ficheiro | Mudança prevista | Prioridade |
|----------|------------------|------------|
| `api/auth/index.php` | Fail-closed JWT; gate seed admin | P0 |
| `.env.example` | Documentar `PIMO_JWT_SECRET`, flags; clarificar VITE vs SERVER | P0 |
| `.gitignore` | `.env.production`, padrões `.env.*` seguros | P0 |
| `.env.production` | Remover do tracking (não “editar secrets” no repo) | P0 |
| `src/pages/LoginPage.tsx` | Defaults vazios | P0 |
| `src/local-auth.ts` | Guard `import.meta.env.DEV` | P0 |
| `src/auth/AuthProvider.tsx` | Garantir que bypass não corre em prod | P0 |
| `.github/workflows/deploy.yml` | Revisão comentários / garantir não upload env; opcional leave as-is se OK | P1 |
| `scripts/publish.js` | Aviso mais forte / não escrever secrets se untracked | P1 |
| `README.md` ou docs deploy existentes | Como configurar Hostinger JWT secret | P1 SHOULD |
| `src/core/quotes/sendQuoteRequestEmail.ts` | Só se C08 mínimo/proxy — preferível Phase 0.5 | P1 |

**Não alterar na Phase 0:**  
`public_html/api/projects/index.php`, `App.tsx` admin routes, migrations Supabase 013, `permissionsMap`, industrial BFF (ainda inexistente).

---

# 9. Exact Implementation Order

Ordem **obrigatória** quando houver autorização explícita (“implementa Phase 0”):

### Step 0 — Pré-voo ops (sem merge ainda)
1. Verificar no Hostinger se `PIMO_JWT_SECRET` está definido.  
2. Se não / se = fallback → gerar secret novo (guardar num password manager).  
3. **Definir o secret no Hostinger PRIMEIRO** (ou dual-secret se implementarem overlap).  
4. Inventariar se existe user `admin@pimo.local` em `users.json` prod.  
5. Confirmar GitHub Secrets: Supabase URL/anon, FTP, etc.

### Step 1 — Documentação de env (baixo risco)
6. Actualizar `.env.example` com `PIMO_JWT_SECRET` (vazio) + notas.  
7. Actualizar `.gitignore`.

### Step 2 — Código fail-closed JWT
8. Alterar `pimo_jwt_secret()` / encode path para fail-closed.  
9. Deploy PHP **só depois** Step 0 confirmado (senão auth 503).

### Step 3 — Remover bypass e defaults UI
10. `local-auth` DEV-only + AuthProvider.  
11. LoginPage campos vazios.  
12. Gate `pimo_ensure_default_admin`.

### Step 4 — Git hygiene `.env.production`
13. `git rm --cached .env.production` (manter ficheiro local se necessário).  
14. Commit separado “chore(security): stop tracking .env.production”.  
15. **Não** commitar valores reais.

### Step 5 — Rotação (ops)
16. Se JWT estava no fallback → já rodado no Step 0; forçar re-login.  
17. Planear rotação `VITE_SUPABASE_ANON_KEY` para **após** Phase 1 RLS (registar no calendário; opcional rotate já se key vazou e aceitar risco residual até RLS).  
18. Rodar `VITE_INTERNAL_API_SECRET` no GH + serviço mail se foi público no git/histórico de builds.

### Step 6 — Validação
19. Executar §13 testes.  
20. Só então marcar Phase 0 PASS (§14) e autorizar Phase 1.

**Rollback:** §12 — se Step 2 falhar em prod, repor temporariamente secret conhecido (nunca repor fallback no código).

---

# 10. Backward Compatibility

| Superfície | Impacto Phase 0 | Mitigação |
|------------|-----------------|-----------|
| Login (credenciais reais) | Continua igual se secret correcto | Testar com user não-default |
| JWT já emitidos | Invalidam-se se secret mudar | Re-login; dual-secret opcional 24–48h |
| Frontend AuthProvider | Igual excepto fim do K/K em prod | Devs usam `npm run dev` |
| APIs `/me` `/users` settings | Dependem do mesmo secret | Fail-closed evita tokens forjados |
| Industrial stack | Sem mudança de cliente na Phase 0 | Anon key pode ser rodada depois |
| Sessões `localStorage` | Tokens antigos 401 até novo login | Esperado e aceite |
| Publish local | Deixa de ter `.env.production` no git | CI injecta; example documenta |
| Conta admin default | Deixa de ser criada; UI não sugere | Bootstrap manual se necessário |

**Compatibilidade intencionalmente quebrada:** bypass K/K em produção; prefill admin; signing com fallback — **desejável**.

---

# 11. Secret Rotation Plan

**NÃO executar agora** — apenas procedimento.

## 11.1 `PIMO_JWT_SECRET`

1. Gerar `NEW` (64+ bytes aleatórios).  
2. **Opção A — cutover:** set `PIMO_JWT_SECRET=NEW` no Hostinger → deploy fail-closed → todos re-login.  
3. **Opção B — dual (recomendado se uptime crítico):**  
   - Código temporário aceita decode com `PIMO_JWT_SECRET` (novo) **ou** `PIMO_JWT_SECRET_PREV` (antigo).  
   - Encode **só** com novo.  
   - Após 24–48h remover PREV e código dual.  
4. Remover fallback hardcoded na mesma linha temporal do cutover.  
5. Invalidar mentalmente qualquer JWT emitido com fallback.  
6. Registar data/hora da rotação no password manager / ops log (sem colar o secret em tickets públicos).

## 11.2 Conta `admin@pimo.local`

1. Se existe em prod: alterar password para forte **ou** eliminar se houver outro admin.  
2. Confirmar ≥1 admin restante.  
3. Desactivar seed (C05).

## 11.3 `VITE_SUPABASE_ANON_KEY`

1. Ideal: **depois** de fechar RLS (Phase 1).  
2. No dashboard Supabase: rotate anon/publishable key.  
3. Actualizar GitHub Secret `VITE_SUPABASE_ANON_KEY`.  
4. Redeploy frontend (tag).  
5. Old key deixa de funcionar → clientes com bundle antigo falham industrial até refresh.

## 11.4 `VITE_INTERNAL_API_SECRET`

1. Gerar novo no mail service + GH secret.  
2. Deploy frontend.  
3. Plano médio prazo: deixar de ser VITE (proxy).

## 11.5 `PIMO_GITHUB_PROJECTS_TOKEN`

1. Só se houve leak do `githubSyncConfig.php` ou logs.  
2. Revogar PAT no GitHub; criar fine-grained novo; set env Hostinger.

## 11.6 Service role / DATABASE_URL

1. Só rotação se suspeita de leak CI.  
2. Nunca injectar no frontend “para testar”.

---

# 12. Rollback Plan

| Alteração | Rollback | Cuidado |
|-----------|----------|--------|
| Fail-closed JWT | Reverter commit PHP **só** se secret impossível de setar; **não** restaurar fallback string | Preferir fix ops |
| Dual-secret | Remover PREV quando estável | — |
| local-auth DEV guard | Reverter ficheiro | Evitar em prod |
| LoginPage defaults | Reverter | Não recomendado |
| Seed admin gate | Reverter flag logic | — |
| gitignore / untrack env | `git add -f` emergência apenas local | Não reintroduzir secrets no remote |
| Anon key rotate | Reverter GH secret para key antiga se Supabase ainda a aceitar | Janela curta |

**Regra:** rollback de código ≠ reintroduzir secret no repositório.

---

# 13. Testing Plan

## 13.1 Antes da implementação (baseline)

| Teste | Como | Esperado hoje (baseline) |
|-------|------|---------------------------|
| B1 | Ler `pimo_jwt_secret` no código | Fallback string presente |
| B2 | `git ls-files .env.production` | Tracked |
| B3 | LoginPage source | Defaults admin |
| B4 | Bundle prod ou source `local-auth` | `K`/`K` activo sem DEV guard |
| B5 | Ops: `getenv` Hostinger JWT | UNKNOWN — registar resultado |

## 13.2 Depois da implementação

| ID | Teste | PASS | FAIL |
|----|-------|------|------|
| T0-01 | Código sem string `pimo-hostinger-mudar-este-segredo` | Ausente | Presente |
| T0-02 | PHP sem env JWT | Login 503/500 controlado; **não** emite JWT | Emite com fallback |
| T0-03 | PHP com secret forte | Login 200 + `/me` 200 | 401/503 |
| T0-04 | Token assinado com secret antigo (após cutover sem dual) | 401 no `/me` | 200 |
| T0-05 | `git check-ignore -v .env.production` | Ignorado | Tracked |
| T0-06 | `git ls-files .env.production` | Vazio | Ainda tracked |
| T0-07 | LoginPage | Inputs vazios | admin123 prefilled |
| T0-08 | Build produção (`npm run build`) + grep artefacto `local-dev-token` / tentativa K/K | Bypass inerte | Sessão local criada |
| T0-09 | `PIMO_ALLOW_DEFAULT_ADMIN` unset + users sem admin@pimo | Não cria admin default | Cria |
| T0-10 | Dev mode `npm run dev` + K/K | Opcional KEEP se DEV | — |
| T0-11 | Industrial sobe com VITE supabase de CI (não do git) | Cliente cria | Falha por key em falta |
| T0-12 | Nenhuma `SERVICE_ROLE` em `dist/**` | Grep limpo | Key no bundle |

---

# 14. Security Acceptance Criteria

Phase 0 só está **PASS** se **todos** os MUST abaixo forem verdadeiros:

| # | Critério | MUST |
|---|----------|------|
| A1 | Nenhum fallback JWT no código-fonte | MUST |
| A2 | Produção com `PIMO_JWT_SECRET` forte (≥32, preferível ≥64 chars aleatórios) verificado | MUST |
| A3 | `.env.production` não tracked | MUST |
| A4 | `.gitignore` cobre `.env.production` | MUST |
| A5 | Login UI sem credenciais default | MUST |
| A6 | Seed admin default desactivado sem flag explícita non-prod | MUST |
| A7 | Bypass `local-auth` inerte em build produção | MUST |
| A8 | `.env.example` documenta `PIMO_JWT_SECRET` como SERVER-ONLY | MUST |
| A9 | Nenhum `SUPABASE_SERVICE_ROLE` / JWT secret em variáveis `VITE_` | MUST |
| A10 | Testes T0-01…T0-09 PASS | MUST |
| A11 | Runbook de rotação JWT executado ou explicitamente N/A (já forte e ≠ fallback) | MUST |
| A12 | Decisão registada sobre rotação anon key (agora vs pós-Phase 1) | SHOULD |
| A13 | Plano proxy para `VITE_INTERNAL_API_SECRET` registado | SHOULD |

**FAIL imediato:** qualquer deploy que restaure fallback JWT ou re-tracke `.env.production` com valores reais.

---

# 15. Risk Matrix

| Risco | Prob. | Impacto | Prioridade | Mitigação Phase 0 |
|-------|-------|---------|------------|-------------------|
| Auth 503 se deploy fail-closed antes de setar env | Média | Alto | P0 | Step order §9 |
| Sessões invalidadas na rotação JWT | Alta | Médio | P0 | Comunicar re-login; dual-secret |
| Devs sem `.env.production` local | Média | Baixo | P2 | Example + CI secrets docs |
| Anon key ainda explorável via RLS até Phase 1 | Alta | Crítico | P0 residual | Aceite consciente; acelerar Phase 1 |
| Histórico git ainda contém keys | Alta | Alto | P1 | Rotação + filter-repo opcional |
| Alguém reintroduz fallback “para não partir staging” | Média | Crítico | P0 | Code review gate; checklist A1 |
| K/K ainda usado como “conta de trabalho” | Média | Médio | P1 | Contas reais de staging |

---

# 16. Dependencies with PHASE 1

```
Phase 0 PASS
    │
    ├─► Phase 1 pode começar com confiança de que JWT não é forjável via fallback
    │
    ├─► Phase 1 Projects API usará o mesmo JWT (Bearer) — secret tem de estar estável
    │
    ├─► Phase 1 RLS / BFF industrial → depois rotação final anon key (marcada em A12)
    │
    └─► NÃO misturar no mesmo PR: fail-closed JWT + rewrite Projects ACL
        (PRs separados; menos blast radius)
```

| Phase 1 precisa de Phase 0? | Sim (A1–A9) |
| Phase 0 precisa de Phase 1? | Não |
| Bloqueio: entitlements/subscriptions | Sim — gates da SPEC; secrets primeiro |

### Fronteira clara

| Phase 0 | Phase 1 |
|---------|---------|
| Secret hygiene, bypass, env tracking | Authorization enforcement APIs |
| Credencial anon no git | Policies RLS / quem pode escrever |
| Documentar service_role SERVER-ONLY | Usar service_role num BFF |

---

# 17. Final Recommendation

### Implementar Phase 0 assim que autorizado, nesta ordem mental:

1. **Ops first:** `PIMO_JWT_SECRET` real no Hostinger.  
2. **Código:** fail-closed + seed gate + local-auth DEV + LoginPage limpo.  
3. **Git:** parar de trackear `.env.production`.  
4. **Rodar** o que já vazou (JWT se era fallback; internal mail secret; anon key conforme decisão A12).  
5. **Validar** §14.  
6. **Parar** — pedir autorização explícita para Phase 1.

### Não fazer

- Não “só mover para `.env`” mantendo fallback.  
- Não pôr JWT secret em `VITE_`.  
- Não abrir Phase 1 no mesmo commit.  
- Não assumir que anon key no frontend é o bug — o bug é **secret no git + RLS aberto**; Phase 0 trata o primeiro.

### Resposta à pergunta “onde deve viver a config?”

| Tipo | Onde | Fail se ausente |
|------|------|-----------------|
| JWT signing | Env PHP servidor | Auth indisponível (503) — preferível a secret público |
| Flags bootstrap admin | Env PHP non-prod | Seed off |
| URLs públicas API/textures/supabase URL | `VITE_*` via CI | App degrada / industrial throw |
| Anon key | `VITE_*` via CI **não git** | Industrial throw |
| Service role / DB / FTP / JWT | Nunca browser | Jobs/CI/host fail closed |

---

## Declaração

- Ficheiro criado: **apenas** este plano.  
- **Nenhuma implementação** foi realizada.  
- **Nenhuma** alteração a código, `.env`, `package.json`, migrations ou dependências.  
- A implementação da Phase 0 requer **mensagem posterior explícita** de autorização.

---

*Fim do PLANO-PHASE-0-SECURITY-SECRETS.*
