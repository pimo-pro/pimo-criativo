# PHASE 1 — Staging Migration 015 + Security Verification Report

**Data:** 24 de Agosto de 2026  
**Tipo:** STAGING DATABASE VERIFICATION ONLY  
**Veredicto:** **STAGING NOT VERIFIED**

---

## 1. Target environment

| Campo | Valor |
|-------|--------|
| Target pretendido | STAGING Supabase (industrial) |
| Target efectivamente confirmado | **NENHUM** |
| Migration 015 aplicada? | **NÃO** (bloqueada pela regra de segurança) |

---

## 2. How target was verified

### Método oficial do projeto (identificado)

| Elemento | Evidência |
|----------|-----------|
| Script oficial | `scripts/applyMigrationsPg.mjs` — aplica **todos** os `supabase/migrations/*.sql` via Postgres directo; tracking em `public._pimo_schema_migrations` |
| CI oficial | `.github/workflows/supabase-migrations.yml` — `workflow_dispatch` + push a `main` em paths de migrations; usa secrets `DATABASE_URL` / `SUPABASE_DB_PASSWORD` + `VITE_SUPABASE_URL` / `SUPABASE_PROJECT_REF` |
| Supabase CLI | `supabase/config.toml` existe com `project_id = ""` (vazio); CLI não é o caminho primário no CI |
| package.json | Sem script npm dedicado a migrations (só dependência `@supabase/supabase-js`) |

### Tentativa de confirmar STAGING

| Check | Resultado |
|-------|-----------|
| Ficheiro `.env.staging` | **Ausente** |
| `supabase/config.toml` `project_id` | **Vazio** (`""`) |
| Labels `staging` / `production` no workflow de migrations | **Ausentes** — um único conjunto de secrets sem distinção de ambiente |
| Documentação de project ref STAGING vs PROD | **Não encontrada** no repo como mapeamento inequívoco |
| Leitura de credenciais `.env` para classificar URL | **Não realizada** nesta sessão (bloqueio de exposição de secrets / sem marcador STAGING no filesystem) |

### Decisão (regra absoluta)

> Se não for possível determinar com **100% de segurança** que o ambiente é STAGING: **PARA. Não executes a migration.**

**Ambiguidades críticas:**

1. O workflow oficial aplica migrations aos secrets GitHub **sem rótulo STAGING** — o mesmo pipeline corre em `push` a `main`, o que tipicamente aponta para o projecto **de produção / canónico**, não para um staging separado.  
2. Não existe no repo um segundo projecto Supabase documentado como staging.  
3. Aplicar `applyMigrationsPg.mjs` localmente contra `.env` **poderia** atingir produção sem o agente o saber.

**Consequência:** Migration **015 não foi aplicada**.

---

## 3. Migration 015 status

| Item | Estado |
|------|--------|
| Ficheiro | `supabase/migrations/015_revoke_industrial_anon_write.sql` (inalterado) |
| Conteúdo | DROP POLICY IF EXISTS `"anon write …"` e `"anon read …"` em 11 tabelas |
| Cria policies? | Não |
| DROP TABLE / DELETE / TRUNCATE? | **Não** |
| Destrutivo de dados? | **Não** (só remove policies) |
| Dependência lógica | Corrige efeito da `013_industrial_anon_rls.sql` |
| Ordem no repo | Após `014_…`; filename `015_…` |
| Aplicada em staging? | **NOT APPLIED** |
| Aplicada em production (esta tarefa)? | **NOT TOUCHED** |

### Compatibilidade (análise estática apenas)

- `DROP POLICY IF EXISTS` é idempotente se a policy não existir.  
- Se 013 nunca correu no target, 015 é no-op seguro.  
- Se 013 correu, 015 remove o bypass anon.  
- **Risco operacional (não de perda de dados):** após 015, o cliente browser com anon key deixa de conseguir SELECT/ALL nas tabelas listadas até existir BFF/policies autenticadas — esperado pelo plano Phase 1.

---

## 4. Migration execution result

| Passo | Resultado |
|-------|-----------|
| Identificar método oficial | **OK** (`applyMigrationsPg.mjs` + workflow) |
| Confirmar target = STAGING | **FAIL** — ambiguidade |
| Aplicar 015 | **SKIPPED** |
| Exit code / SQL success | N/A |

**Nenhuma** conexão Postgres/Supabase foi aberta para aplicar SQL nesta tarefa.

---

## 5. RLS verification

**NOT VERIFIED** — sem acesso confirmado a uma DB STAGING.

Estado esperado *após* 015 bem-sucedida (documentação do ficheiro, não evidência live):

- Policies `"anon read %"` e `"anon write %"` das 11 tabelas: **removidas**
- RLS enabled nas tabelas: **não alterado** por 015 (presume-se já ON)

---

## 6. Anonymous access verification

**NOT VERIFIED** (sem target staging confirmado; testes anon REST não executados).

---

## 7. Authenticated access verification

**NOT VERIFIED.**

---

## 8. IDOR verification

**NOT VERIFIED** nesta tarefa (Projects IDOR = Hostinger/PHP, fora do âmbito DB 015; tests contra staging não corridos).

---

## 9. Industrial access verification

**NOT VERIFIED** live.

Nota: o bypass da auditoria (anon ALL via 013) **permanece presumivelmente activo** em qualquer DB onde 013 esteja aplicada e 015 não.

---

## 10. Evidence

| Evidência | Tipo |
|-----------|------|
| `.github/workflows/supabase-migrations.yml` | Método CI oficial, secrets únicos, sem label staging |
| `scripts/applyMigrationsPg.mjs` | Aplica *todas* as migrations; tabela `_pimo_schema_migrations` |
| `supabase/config.toml` | `project_id = ""` |
| Ausência de `.env.staging` | Sem perfil staging local |
| Conteúdo estático de `015_*.sql` | Só DROP POLICY IF EXISTS |
| Esta sessão | **ZERO** apply SQL; **ZERO** queries de policies remotas |

---

## 11. Tests executed

| Teste | Executado? |
|-------|------------|
| Apply 015 staging | **NÃO** |
| Query `pg_policies` staging | **NÃO** |
| Anon SELECT/INSERT/UPDATE/DELETE | **NÃO** |
| Authenticated own/other | **NÃO** |
| Projects User A/B | **NÃO** (fora DB; Hostinger pendente) |
| Suite unitária Phase 1 (24) | Não re-executada nesta tarefa (já PASS em verificação anterior) |

---

## 12. Test results

N/A — nenhum teste de segurança contra staging DB foi possível sem target confirmado.

---

## 13. Production status

**NOT TOUCHED**

- Sem apply em production  
- Sem deploy  
- Sem alteração de secrets  
- Sem alteração de Hostinger  
- Migration 015 no repo **não** modificada  

---

## 14. Hostinger status

HTTP smoke tests do relatório final Phase 1 **continuam pendentes**.

**NOT VERIFIED — HOSTINGER** (fora do âmbito desta tarefa; nenhuma alteração Hostinger).

---

## 15. Remaining risks

| Risco | Severidade | Notas |
|-------|------------|-------|
| Policies anon 013 ainda activas no projecto remoto canónico | **P0** | 015 não aplicada |
| CI `main` pode aplicar migrations ao projecto “real” sem staging separado | **P1 ops** | Falta isolamento STAGING vs PROD documentado |
| Aplicar `applyMigrationsPg.mjs` local sem confirmação de ref | **P0 se errado** | Por isso STOP |
| Após futura 015: industrial browser quebra reads | **P1 operacional** | Esperado até BFF |

### O que o utilizador precisa fornecer para desbloquear

Para uma próxima tentativa atingir **STAGING VERIFIED**, é necessário **pelo menos um** dos seguintes, de forma inequívoca:

1. Project ref / URL Supabase **explicitamente rotulado STAGING** (ex.: secret `STAGING_SUPABASE_*` ou `.env.staging` com confirmação escrita), **e**  
2. Credenciais DB (`DATABASE_URL` ou `SUPABASE_DB_PASSWORD`) **só** desse projecto staging, **e**  
3. Confirmação humana: “este project ref X é STAGING, não production”.

Até lá, **não** se deve correr o workflow de migrations em `main` apenas para “aplicar a 015”, sem saber se o secret aponta para staging.

---

## 16. Final verdict

# STAGING NOT VERIFIED

### Porquê

1. O target STAGING **não** foi confirmado a 100%.  
2. A regra absoluta obrigou **STOP** antes de qualquer apply.  
3. Sem apply, não há evidência de RLS/anon na database.  
4. Production e Hostinger: **NOT TOUCHED** / smoke ainda pendente.

### Relação com Phase 1 overall

Mantém-se:

**PHASE 1 PARTIALLY VERIFIED**  
(CODE + TEST local OK; STAGING DB **NOT VERIFIED**; Hostinger **NOT VERIFIED**)

---

## 17. Git

Sem commit / push / reset / clean.  
Migration 015 **inalterada**.  
Único artefacto novo esperado desta tarefa: este relatório.

---

*STOP — aguardar instruções. Sem Phase 2, sem correção de código, sem Production, sem deploy.*
