# Arquivo GitHub de projetos PIMO.PRO

## Objetivo

Cópia de segurança e histórico automático dos projetos guardados no PIMO.PRO, num repositório GitHub **privado** separado do código-fonte:

- Repositório: [pimo-pro/pimo-projetos](https://github.com/pimo-pro/pimo-projetos)
- Código-fonte continua em `pimo-criativo` / site `pimo.pro`
- O formato de armazenamento local do PIMO **não muda** (`data/{nome}.json` no Hostinger + IndexedDB offline)

## Como o PIMO guarda hoje (inalterado)

1. UI «Salvar e Gerar Design» (e outros saves) → `saveProject()`
2. Persistência offline (IndexedDB)
3. Sync → `POST /api/projects/index.php`
4. Gravação em disco: `api/projects/data/{nome}.json`

## Como funciona a sincronização

Após cada gravação local bem-sucedida (POST save, PUT rename, DELETE), o PHP chama `pimo_github_sync_project()`:

```text
write_project_file(...)  →  sucesso
        ↓
pimo_github_sync_project(project, op)
        ↓
GitHub Contents API → pimo-pro/pimo-projetos
```

- Se o token/config estiver ausente ou a API falhar: o **save do PIMO continua OK**; o erro vai para `data/_github_sync_errors.log` e para o error_log do PHP.
- Ficheiros iguais (SHA-256) não são reescritos.
- Delete marca `metadata.json` com `deleted: true` (histórico Git preservado).

### Ficheiros no servidor

| Ficheiro | Função |
|----------|--------|
| `hostinger/api/projects/githubSync.php` | Cliente GitHub + logs |
| `hostinger/api/projects/githubSyncMapper.php` | Fatias JSON (design, medidas, preços, …) |
| `hostinger/api/projects/githubSyncConfig.example.php` | Template de config |
| `hostinger/api/projects/githubSyncConfig.php` | Config real (**não versionado**) |
| Espelho em `public_html/api/projects/` | Deploy Hostinger |

### Estrutura no repositório externo

```text
projects/
  {projectId}/
    metadata.json
    project.json       ← restauração completa
    design.json
    medidas.json
    precos.json
    industrial.json
    viewer.json
    reports/
    sync.log.jsonl
_logs/
  sync-YYYY-MM-DD.jsonl
```

### PDFs / relatórios

O save normal do PIMO não gera PDF no servidor. Só são arquivados em `reports/` se vierem no payload (JSON de relatório ou PDF em base64). A restauração principal usa sempre `project.json`.

## Configuração one-time (Hostinger)

1. Criar um **Fine-grained Personal Access Token** no GitHub:
   - Resource owner: `pimo-pro`
   - Repository access: só `pimo-projetos`
   - Permissions: **Contents: Read and write**
2. No Hostinger, escolher **uma** das opções:

**A — Variável de ambiente (preferido)**

```text
PIMO_GITHUB_PROJECTS_TOKEN=<token>
PIMO_GITHUB_PROJECTS_SYNC=true
```

**B — Ficheiro local (fora do Git)**

Copiar o exemplo e preencher o token:

```bash
cp api/projects/githubSyncConfig.example.php api/projects/githubSyncConfig.php
```

Editar `githubSyncConfig.php`:

```php
return [
    "enabled" => true,
    "owner" => "pimo-pro",
    "repo" => "pimo-projetos",
    "branch" => "main",
    "token" => "<token>",
    "timeoutSeconds" => 12,
];
```

3. Confirmar que `githubSync.php` e `githubSyncMapper.php` estão em `public_html/api/projects/` (deploy normal).
4. Guardar um projeto no PIMO e verificar commits em [pimo-projetos](https://github.com/pimo-pro/pimo-projetos).

Sem token: sync em **no-op** — o PIMO funciona exactamente como antes.

## Como restaurar um projeto

1. Abrir `https://github.com/pimo-pro/pimo-projetos` → `projects/{id}/project.json`
2. Descarregar o ficheiro
3. No PIMO.PRO, usar o fluxo de **importação** existente (Header / import JSON ou ZIP com `project.json`)
4. Alternativa: colocar o JSON de volta em `api/projects/data/{nome}.json` no Hostinger (mesmo formato que a API já usa)

O `project.json` do arquivo é o `PimoProjectData` completo (inclui `settings.projectState`, viewer, etc.).

## Logs

- Por projeto: `projects/{id}/sync.log.jsonl`
- Global diário: `_logs/sync-YYYY-MM-DD.jsonl`
- Fallback local no servidor: `api/projects/data/_github_sync_errors.log` (protegido pelo `.htaccess` de `data/`)

## Segurança

- Token **nunca** no frontend / variáveis Vite
- Repo de projetos **privado**
- Config real no `.gitignore`
- Sync best-effort: não bloqueia nem altera o storage interno do PIMO

## Limitações

- Contents API do GitHub: ficheiros muito grandes (>~50–100 MB) podem falhar; projetos tipicos JSON cabem
- Vários PUTs por save (metadata + fatias + logs) — timeout configurável (12s)
- PDFs só se presentes no payload do save
