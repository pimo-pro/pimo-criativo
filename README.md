# PIMO Criativo

![Logótipo PIMO](https://pimo.pro/logo-pi.png)

**[PIMO Criativo](https://pimo.pro)** é a plataforma web para criação de caixas e mobiliário modular com visualização 3D em tempo real. Gera automaticamente lista de corte, ficheiros CNC/TCN, planos de furação e relatórios de preço. Para carpintarias, designers e fábricas — sem instalação.

📖 Documentação completa e guias de utilização: **[pimo.pro/ajuda](https://pimo.pro/ajuda)**

### Funcionalidades principais

- **Visualizador 3D** em tempo real (Three.js / React Three Fiber) com edição direta de caixas, materiais e ferragens (`src/3d`)
- **Lista de corte (cutlist)** gerada automaticamente com dimensões, materiais e custos por peça
- **Nesting / layout de corte** com modos Fast e PRO para otimizar o aproveitamento de chapa (`src/core/nesting3`, `src/nesting-v3`, `src/core/cutlayout`)
- **Plano de furação** paramétrico (cavilhas, corrediças, dobradiças) para exportação CNC (`src/core/drill`, `src/core/drilling`)
- **PIMO-TRAK** — etiquetas com QR code único por peça para rastreio de produção (`src/core/etiquetas`)
- **Planeamento automático de espaço/sala** (`src/core/autoRoomFill`)
- **Exportação industrial**: PDF técnico, ficheiros CNC/TCN, Drill XML e pacote ZIP completo (`src/core/cnc`)
- **Relatórios de preço** com sistema de tarifas e custos industriais configuráveis (Orçamentos)
- **Sistema Industrial**: painéis visuais de chão de fábrica (estação, operador, supervisor) sobre o fluxo de produção já existente

### Screenshots

<!-- TODO: adicionar capturas de ecrã em docs/screenshots/ e atualizar os caminhos abaixo -->
![Visualizador 3D](docs/screenshots/viewer-3d.png)
![Planeador de sala](docs/screenshots/room-planner.png)
![Lista de corte / nesting](docs/screenshots/cutlist-nesting.png)

---

# PIMO v3 — Deploy Frontend (Hostinger) + Backend (Render)

Este repositório contém:

- **Frontend** (Vite/React) na raiz
- **Backend Node.js** em `backend/` (Express) para `/api/projects` e `/api/materials`

## Publicar o backend no Render

### Opção A) Blueprint com `render.yaml`

O ficheiro `backend/render.yaml` já estápreparado com:

- `rootDir: backend`
- `buildCommand: npm install && npm run build`
- `startCommand: npm run start`
- env vars: `PORT`, `PIMO_PROJECTS_DATA_DIR`

No Render:

- Crie um **New → Blueprint**
- Selecione este repositório
- Confirme que o serviço chama **`pimo-backend`**

### Variáveis de ambiente (Render)

- **`PORT`**: o Render injeta automaticamente; pode deixar como está.
- **`PIMO_PROJECTS_DATA_DIR`**: diretório para gravar os projetos em JSON.
  - No Render, use um caminho persistente (ex.: `/var/data/pimo/projects`) e conecte um **Disk** ao serviço.

## Configurar o frontend para usar o backend do Render

O frontend l— a variável `VITE_API_URL` para chamar a API:

- projetos: `VITE_API_URL + /api/projects/index.php`
- materiais: `VITE_API_URL + /api/materials`

### Em produção (Hostinger)

No build do frontend, defina:

- **`VITE_API_URL=https://pimo-backend.onrender.com`**

No repositório, existe um `.env` para desenvolvimento e um `.env.example` como referência.

## Testar o fluxo completo

1. **Backend**: abra `GET /health` no serviço do Render para confirmar que estãonline.
2. **Frontend**: abra o site em `pimo.pro`.
3. DevTools → Network:
   - Abrir modal de materiais → deve fazer `GET {VITE_API_URL}/api/materials`
   - Clicar **«Gerar e Salvar Design”** → deve fazer `POST {VITE_API_URL}/api/projects/index.php`
4. Testar também:
   - listar projetos → `GET .../api/projects/index.php?scope=mine&ownerId=...`
   - carregar projeto → `GET ...?action=load&id=...`
   - renomear → `PUT ...?action=update&id=...`
   - apagar → `DELETE ...?action=delete&id=...`

## Publicar o frontend no Hostinger

- Defina `VITE_API_URL` no ambiente de build (ou no `.env` antes de correr `npm run build`).
- Faça upload de `dist/` para o `public_html` do domínio.

## Arquitetura e Documento Normativo

O arquivo `docs/PIMO-CRIATIVO-MASTER-PLAN.md` — a fonte de verdade arquitetural do projeto pimo-criativo.

Todas as decisões de desenvolvimento (backend, frontend, permissóes, roles, fábricas, fases e demais aspectos estruturais) devem seguir esse documento.

Novas funcionalidades devem ser planejadas e implementadas em alinhamento com as fases definidas no master plan (FASE 0, FASE 1, FASE 2, etc.), mantendo evolução incremental e compatibilidade entre fases.

Módulos avançados, como produção, IA e plugins, não devem ser iniciados antes da conclusóo sólida das fases 0–4.

Consulte `docs/PIMO-CRIATIVO-MASTER-PLAN.md` para detalhes completos de arquitetura, fases e regras do sistema.

## Sistema de Eventos (Events System)

O documento oficial do Sistema de Eventos estáem `docs/PIMO-CRIATIVO-PLANO-EVENTS-SYSTEM.md`.

O Sistema de Eventos faz parte da arquitetura oficial do projeto pimo-criativo e — controlado pela feature flag global `features.eventsSystem`.

O valor padrão da flag — `false`, garantindo que o sistema permaneça inativo até ser explicitamente habilitado.

Com a flag desligada, o comportamento — totalmente no-op, sem impacto no fluxo principal da aplicação.

Nesta fase inicial, nenhuma funcionalidade crítica do sistema depende exclusivamente do Events System.

Toda integração futura com eventos deve uútilizar a função central (ex.: `recordEvent`), conforme definido no plano oficial.

O desenvolvimento do Sistema de Eventos deve seguir as regras e fases definidas no Master Plan (`docs/PIMO-CRIATIVO-MASTER-PLAN.md`), e sua ativação deve ocorrer apenas após a consolidação das fases 0–4, conforme diretrizes arquiteturais.

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
