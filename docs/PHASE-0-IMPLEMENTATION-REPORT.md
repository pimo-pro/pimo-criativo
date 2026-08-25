# PHASE 0 — Implementation Report

**Data:** 24 de Agosto de 2026  
**Estado:** Implementado no working tree (sem commit)  
**Âmbito:** Security & Secrets Hardening apenas

---

## 1. Files changed

- `api/auth/index.php`
- `.env.example`
- `.gitignore`
- `.env.production` (untracked via `git rm --cached`; ficheiro local preservado)
- `src/local-auth.ts`
- `src/auth/AuthProvider.tsx`
- `src/pages/LoginPage.tsx`
- `src/core/quotes/sendQuoteRequestEmail.ts`
- `vite.config.ts`
- `.github/workflows/deploy.yml`
- `scripts/publish.js`
- `scripts/copyDeployApiToDist.mjs`

## 2. Files created

- `src/server/devLocalAuthMiddleware.ts`
- `api/quotes/index.php`
- `public_html/api/quotes/index.php`
- `src/local-auth.test.ts`
- `docs/PHASE-0-IMPLEMENTATION-REPORT.md` (este ficheiro)

## 3. Changes implemented

- JWT: removido fallback hardcoded de produção; fail-closed sem `PIMO_JWT_SECRET` fora de local/development.
- `PIMO_APP_ENV` com default `production` (desconhecido → production).
- Seed `admin@pimo.local`/`admin123` só em local/development.
- K/K preservado: frontend DEV + backend Vite middleware; PHP `/auth/dev-local` rejeita fora de local/development; `/auth/login` rejeita K/K; Bearer `local-dev-token` rejeitado nas APIs JWT.
- Login UI sem credenciais default; hint K/K só em DEV.
- `.env.production` deixou de ser tracked; gitignore alargado.
- `VITE_INTERNAL_API_SECRET` removido do CI/bundle; proxy PHP `/api/quotes` com `PIMO_INTERNAL_API_SECRET`.

## 4. Security problems fixed

| Problema | Estado |
|----------|--------|
| JWT fallback hardcoded | Corrigido |
| `.env.production` no git index | Untracked (histórico ainda contém — ver §8) |
| Defaults UI admin123 | Removidos |
| Seed admin em production | Bloqueado |
| K/K em production | Bloqueado (DEV + backend) |
| Secret mail no bundle Vite | Removido; proxy server-side |

## 5. K/K local development behavior

1. `npm run dev` → Vite middleware `POST /api/auth/dev-local` aceita K/K.  
2. Frontend só tenta K/K se `import.meta.env.DEV`.  
3. Sessão `local-dev-token` **não** é JWT válido em `/me`/users/settings.  
4. Hostinger com `PIMO_APP_ENV=production` (ou ausente) → `/auth/dev-local` = 403.  
5. Removível no futuro sem alterar o fluxo JWT real.

## 6–7. Tests executed / results

| Teste | Resultado |
|-------|-----------|
| `vitest run src/local-auth.test.ts` | **PASS** (3/3) |
| `tsc -b` | **PASS** (exit 0) |
| PHP CLI lint | **SKIP** — `php` não instalado nesta máquina |
| Grep fallback `pimo-hostinger-mudar` em `api/auth` | **PASS** (ausente) |
| Grep `VITE_INTERNAL` em `sendQuoteRequestEmail.ts` | **PASS** (ausente) |

## 8. Secrets still requiring rotation (ops — NÃO executado)

| Secret | Acção recomendada |
|--------|-------------------|
| `PIMO_JWT_SECRET` no Hostinger | **Definir/verificar AGORA** antes do deploy deste código (senão login 503). Se era o fallback antigo → rodar e forçar re-login. |
| `VITE_SUPABASE_ANON_KEY` (histórico git) | Rodar **após** Phase 1 RLS; actualizar GitHub Secret. |
| Antigo `VITE_INTERNAL_API_SECRET` | Rodar valor no mail service; configurar `PIMO_INTERNAL_API_SECRET` no Hostinger. |
| Conta `admin@pimo.local` em prod (se existir) | Mudar password ou remover. |
| Git history rewrite | **NÃO feito** — requer autorização explícita. |

## 9. Known limitations

- PHP não testável localmente nesta workstation (sem binário `php`).  
- Orçamentos falham com 503 até `PIMO_INTERNAL_API_SECRET` estar no Hostinger.  
- Anon Supabase ainda no histórico git; RLS anon write continua (Phase 1).  
- SPA: `localStorage` spoof continua possível no browser — mitigado por APIs rejeitarem `local-dev-token`.

## 10. Pre-existing changes preserved

Não tocados: `scripts/cnc-examples-output/*`, `cube.css`, tema HTML, docs de auditoria/spec/plano anteriores (excepto este relatório novo).

## 11. PHASE 1 intentionally NOT changed

- Projects API ACL / IDOR  
- Industrial RLS migration 013  
- Gate `/admin`  
- Organizations / RBAC completo / Entitlements / Subscriptions  

---

### Deploy checklist (ops)

1. Hostinger: `PIMO_APP_ENV=production`  
2. Hostinger: `PIMO_JWT_SECRET=<≥32 chars aleatórios>`  
3. Hostinger: `PIMO_INTERNAL_API_SECRET=<mesmo valor do mail service>`  
4. Deploy PHP + frontend  
5. Validar login real; validar que K/K falha em produção  

**STOP — aguardar autorização para Phase 1.**
