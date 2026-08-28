# Plano — Hierarquia de contas, convites e licenciamento manual

**STATUS: BACKLOG — NÃO IMPLEMENTADO — plano para execução futura**

**Data do plano:** 2026-08-28  
**Escopo deste documento:** apenas intenção e direcção; **nenhum código deste plano deve ser implementado** enquanto a fase simples (aprovação pendente + ultra+ admin + partilha individual) não estiver fechada e validada.  
**Contexto:** diagnóstico de contas/permissões realizado em 2026-08-28; fase imediata documentada separadamente no plano de diff de implementação (aprovação manual + `project-shares.json`).

---

## Nota obrigatória (ler antes de implementar)

O projecto PIMO-Criativo está em **desenvolvimento contínuo**. Este ficheiro é um **plano de intenção**, não uma especificação técnica congelada.

**No dia em que se decidir avançar com a implementação deste backlog:**

1. Fazer um **novo diagnóstico** do estado do código nessa altura (auth PHP, `users.json`, partilhas, admin UI, testes).
2. Confirmar que a fase simples (pendente + ultra+ ligado ao admin + partilha por projecto) já está em produção e estável.
3. Validar se `users.json` / JSON sidecars ainda são adequados ou se já existe migração PostgreSQL (ver `docs/SPEC-ARQUITETURA-AUTH-AUTHZ-SUBSCRIPTIONS.md`).
4. Só então redigir diffs e pedir aprovação explícita antes de gravar qualquer alteração (regra permanente do repositório).

---

## 1. Visão de produto (hierarquia)

### 1.1 Três níveis comerciais

| Plano | Role técnica alvo | Quem é | Capacidades previstas |
|-------|-------------------|--------|------------------------|
| **PIMO Free** | `visitor` (ou variante «free») | Visitante / utilizador convidado | Vê **só os próprios** projectos; pode **associar-se** a um PIMO Ultra via código de convite |
| **PIMO Ultra** | `ultra` | Lojas de mobiliário, fábricas pequenas | CRUD nos próprios projectos; **gera códigos de convite** para ligar contas Free à sua «organização» |
| **PIMO Ultra+** | `ultra+` | Fábricas / lojas / showrooms grandes | Gere utilizadores **ou** códigos de convite; vê projectos das contas **ligadas a ela** (não necessariamente todos os do admin) |

### 1.2 Transição face à fase simples actual

Na **fase simples** (2026-08):

- Ultra+ está **hardcoded** ao **único admin** da plataforma (ver + editar todos os projectos do admin).
- Partilha é **manual** projecto-a-projecto via admin (`project-shares.json`).
- Aprovação de contas Pro/Ultra/Ultra+ é **manual** pelo admin.

Este backlog **substitui gradualmente** o hardcode admin por **relações explícitas** (convite → `principalUserId` / `organizationId`).

---

## 2. Sistema de códigos de convite

### 2.1 Objectivo

Contas **Ultra** e **Ultra+** podem **gerar códigos de convite**. Quando outro utilizador se regista (ou activa um código numa conta existente), fica **automaticamente ligado** à conta que gerou o código — em vez de ficar ligado ao admin fixo.

### 2.2 Modelo de dados (proposta)

Ficheiro ou tabela `invite-codes.json` (ou PostgreSQL futuro):

```json
{
  "id": "uuid",
  "code": "PIMO-XXXX-YYYY",
  "createdByUserId": "ultra-or-ultra+-id",
  "targetRole": "visitor",
  "maxUses": 1,
  "usesCount": 0,
  "expiresAt": "ISO8601 | null",
  "permissionsPreset": [],
  "createdAt": "ISO8601"
}
```

Campo novo em `users.json`:

```json
{
  "principalUserId": "id-da-conta-ultra-que-convidou",
  "invitedViaCodeId": "..."
}
```

### 2.3 Fluxos

1. Ultra/Ultra+ gera código no painel (UI dedicada ou secção em `/admin` / `/me`).
2. Registo público: campo «Código de convite» (hoje mock em `inviteCodesMock.ts`) passa a validar no servidor.
3. Conta criada fica `principalUserId = criador do código`; role inicial conforme política (Free → visitor aprovado, ou pendente se aplicável).

### 2.4 Relação com aprovação manual

O admin pode continuar a aprovar contas **sem** convite. Convite é um **atalho de ligação hierárquica**, não substitui obrigatoriamente a aprovação de planos pagos (quando existir pagamento).

---

## 3. Estrutura hierárquica de contas

### 3.1 Árvore lógica

```
Admin (plataforma)
 └── Ultra+ (showroom / fábrica grande)
      ├── Ultra (loja / fábrica pequena) — via convite ou criação directa
      │    └── Free (visitor) — via convite
      └── Free (visitor) — via convite directo Ultra+
```

### 3.2 Regras de visibilidade (futuro)

- **Free:** `project.view.self` + projectos partilhados + (opcional) leitura limitada na org do principal — **não** implementado na fase simples.
- **Ultra:** projectos próprios + projectos de Free ligados ao mesmo principal.
- **Ultra+:** projectos da sub-árvore (contas com `principalUserId` recursivo ou `organizationId` comum).
- **Admin:** `project.view.all` (inalterado).

### 3.3 Migração desde ultra+ → admin

Quando a hierarquia estiver activa:

- Contas Ultra+ **novas** deixam de herdar automaticamente todos os projectos do admin.
- Contas Ultra+ **existentes** na fase simples: ver secção 5 (toggle de transição).

---

## 4. Painel Admin melhorado — proveniência de projectos

### 4.1 Objectivo

Junto de cada projecto/design na listagem admin, mostrar:

- **Nome da conta** (`ownerName` / username)
- **Role / plano** efectivo (`role`, `accountCategory`, `accountStatus`)
- **Principal** (se ligado via convite: «debaixo de Ultra X»)

### 4.2 Onde encaixa

- Extensão de `ProjectsPage` (modo admin / scope=all) ou nova vista `/admin/projects`.
- API: enriquecer listagem com lookup em `users.json` por `ownerId` (cache em memória no PHP).

### 4.3 Benefício

Permite ao admin perceber **quem criou** cada projecto na hierarquia emergente, sem abrir o JSON do projecto.

---

## 5. Concessão manual de licenças / permissões

### 5.1 Objectivo

O admin pode, **sem pagamento**:

- Atribuir **role/licença** a qualquer utilizador (já parcialmente existente em `/admin/users`).
- **Gerar código de convite** com permissões/role pré-definidas (ex.: «3 meses Pro», «Ultra trial» — metadata only até existir billing).

### 5.2 Extensões sobre a fase simples

| Já na fase simples | Backlog |
|--------------------|---------|
| Aprovar pendente + escolher role | Códigos reutilizáveis com role preset |
| PUT `/users` altera role | Histórico de alterações (`roleHistory[]`) |
| — | `extraPermissions` / `removedPermissions` (Master Plan Fase 5) |

---

## 6. Toggle de visibilidade Ultra+ (span de transição)

### 6.1 Problema

Na fase simples, Ultra+ vê **todos** os projectos do admin. Quando a hierarquia por convite estiver activa, Ultra+ novas devem ver **só** projectos das contas ligadas — não os do admin global.

### 6.2 Proposta

Campo em `users.json` (ou settings do utilizador):

```json
{
  "ultraPlusSeeAdminProjects": true
}
```

- **Default `true`** para contas Ultra+ criadas **antes** da activação da hierarquia (retrocompat / transição).
- **Default `false`** para Ultra+ **novas** após activação do módulo de convites.
- UI: definição em `/admin/users` (editar Ultra+) ou `/me` para Ultra+: «Ver projectos do administrador da plataforma».

### 6.3 Implementação authz

`pimo_authz_can_view_project` para Ultra+:

```
if ultraPlusSeeAdminProjects && project.ownerId === platformAdminId:
  allow
else if project.ownerId in descendantUserIds(ultra+):
  allow
...
```

---

## 7. Dependências e ordem sugerida de implementação (futuro)

1. **Convites reais** (substituir mock) + `principalUserId` em utilizadores.
2. **Listagem hierárquica** (Ultra+ vê sub-árvore; API `scope=organization`).
3. **Painel admin enriquecido** (owner + role na listagem).
4. **Toggle ultra+ / admin projects** + migração de contas existentes.
5. **extraPermissions / billing** (SPEC subscriptions) — só após base estável.

---

## 8. Riscos e decisões em aberto (para o diagnóstico futuro)

| Tema | Pergunta em aberto |
|------|-------------------|
| Persistência | Manter JSON sidecars vs migrar PostgreSQL |
| Convite vs aprovação | Registo com convite Ultra bypassa `pending`? |
| Ultra+ cria users | Reutilizar `/users` com `user.manage.below` ou endpoint dedicado |
| Industrial Supabase | Roles `operador/worker` mantêm-se isoladas do platform RBAC |
| Offline / guest | Contas guest locais nunca entram na hierarquia remota |
| Eventos | `FACTORY_USER_ADDED`, `USER_ROLE_CHANGED` (Events System, feature flag off) |

---

## 9. Referências no repositório

| Documento / código | Relação |
|--------------------|---------|
| `docs/PIMO-CRIATIVO-MASTER-PLAN.md` | Roles fixos, fábrica, permissões efectivas |
| `docs/SPEC-ARQUITETURA-AUTH-AUTHZ-SUBSCRIPTIONS.md` | Arquitectura alvo (orgs, subscriptions) |
| `docs/PHASE-1-IMPLEMENTATION-REPORT.md` | Gap ultra+ / `project.view.factory` |
| `src/components/admin/inviteCodesMock.ts` | Mock actual de convites (substituir) |
| `api/auth/index.php` | SSOT roles + `/me` |
| `api/authz/resourceAccess.php` | ACL projectos |
| Fase simples (2026-08) | `accountStatus`, `project-shares.json`, ultra+ → admin único |

---

## 10. Critérios de aceitação (quando este backlog for implementado)

- [ ] Ultra/Ultra+ gera convite; registo com convite liga `principalUserId` correctamente.
- [ ] Free ligado a Ultra vê apenas projectos permitidos pela hierarquia (não todos do admin).
- [ ] Ultra+ novas não veem projectos do admin unless toggle activo.
- [ ] Admin vê role + principal em cada linha da listagem de projectos.
- [ ] Admin gera convite com role preset; código expira / limite de usos respeitado.
- [ ] Testes TS espelho + testes de integração authz actualizados.
- [ ] Novo diagnóstico documentado antes do merge.

---

*Fim do plano — BACKLOG only. Não implementar sem aprovação explícita e novo diagnóstico.*
