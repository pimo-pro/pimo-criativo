Deploy no Hostinger

1. Copie esta pasta para `public_html/api/projects/` no servidor.
2. Garanta que o diretório permanente existe:
   - `/public_html/pimo_storage/projects/`
3. Garanta permissões de escrita para PHP em:
   - `/public_html/pimo_storage/projects/`
4. Formato final de persistência:
   - `ID_NomeDoProjeto.pimo.json` (um ficheiro por projeto)
   - sem `index.json`
   - sem miniaturas separadas (base64 dentro do JSON)
5. Migração automática:
   - converte legados `index.json` + `<id>.json` para `.pimo.json`
   - remove os ficheiros antigos após migrar
6. Endpoints disponíveis:
   - `GET /api/projects?scope=mine&ownerId=...`
   - `GET /api/projects?scope=all`
   - `POST /api/projects`
   - `GET /api/projects/{id}`
   - `PUT /api/projects/{id}`
   - `DELETE /api/projects/{id}`
7. Arquivo GitHub (opcional, best-effort):
   - Após save/rename/delete, sync para `pimo-pro/pimo-projetos`
   - Config: copiar `githubSyncConfig.example.php` → `githubSyncConfig.php`
   - Documentação: `docs/PIMO-ARQUIVO-GITHUB-PROJETOS.md`
