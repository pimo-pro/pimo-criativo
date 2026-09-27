# Aedifex → pimo-alfa — Fase 1: Análise e Plano de Integração

**Data:** 2026-09-18  
**Âmbito:** somente `pimo-alfa` (escrita) + `external/aedifex` (leitura)  
**Proibido:** alterar `pimo-criativo`, `pimo-mail-service`, `PIMO-WORDPRESS`, ou qualquer pasta fora de `pimo-alfa`

---

## 1. Resumo executivo

O Aedifex é um monorepo MIT (Pascal/Aedifex) com editor arquitetónico completo: paredes, portas/janelas, zonas, multi-nível, lajes/tetos/telhados, catálogo de mobiliário, walkthrough, export GLB/STL/OBJ, IFC, AI assistant e MCP.

O **pimo-alfa já contém `pimo-room v4.0.0`**, documentado como lógica de nós/cutouts inspirada em Aedifex, adaptada ao **ViewerCore WebGL** (não WebGPU), com UI nativa (PainelSala, ícones SVG, tokens CSS).

**Conclusão da Fase 1:** a fusão correta **não** é embutir o shell Next.js/Tailwind/R3F-WebGPU do Aedifex. É **absorver capacidades em falta** para o pipeline nativo pimo-alfa (ViewerCore + ProjectRoomConfig + chrome pimo), reescrevendo UI/ferramentas no estilo pimo, e vendorar/adaptar só o código útil sob `src/integration/aedifex/`.

---

## 2. Inventário Aedifex (fonte: `external/aedifex`)

### 2.1 Layout

| Unidade | Papel |
|---------|--------|
| `apps/editor` | Shell Next.js 16 + API AI/scenes |
| `apps/ifc-converter` | Demo IFC |
| `@aedifex/core` | Schema Zod, Zustand+undo, registry, spatial |
| `@aedifex/viewer` | Canvas R3F + **WebGPU**, post-FX, systems |
| `@aedifex/nodes` | ~45 kinds (wall, door, item, slab, roof…) |
| `@aedifex/editor` | UI, ToolManager, floorplan 2D, AI panel |
| `@aedifex/ifc-converter` | IFC→scene (web-ifc) |
| `@aedifex/mcp` | MCP + SQLite scenes |
| `@aedifex/plugin-trees` | Plugin exemplo |
| `@repo/ui` | Primitivos shadcn mínimos |

### 2.2 Stack vs pimo-alfa

| | Aedifex | pimo-alfa |
|---|---------|-----------|
| UI shell | Next.js 16 + Tailwind + Radix | Vite + React Router + CSS vars pimo |
| 3D | R3F + **WebGPU** (`three/webgpu`) | **ViewerCore** + **WebGL** |
| Estado cena | `useScene` (grafo nós) | `ProjectState.room` (mm) + wallStore (cm) |
| Caixas/móveis industriais | Items GLB catálogo | Boxes/cutlist/CNC nativos |
| Temas | Dark/light viewport Aedifex | `.theme-dark` / `.theme-light` + Pi tokens |
| PM | Bun + Turbo | npm + Vite |

### 2.3 Licença

MIT — Pascal Group Inc. + Aedifex Inc. Manter atribuição em código adaptado.

---

## 3. Classificação de módulos

### 3.1 Úteis (integrar / adaptar)

| Módulo | Valor para pimo-alfa | Estratégia |
|--------|----------------------|------------|
| Core schemas (wall/door/window/zone/level) | Completar SSOT além do room v4 | Bridge + extensão `ProjectRoomConfig` |
| Miters / cutouts / zone detection | Já parcialmente no pimo-room | Diff vs Aedifex; portar gaps |
| Multi-level (stack/explode/solo) | Em falta | Nova fase no RoomManager + UI pimo |
| Slab / ceiling / roof | Em falta | Geometria → ViewerCore; painel pimo |
| Item catalog + placement/collision | Em falta (mobiliário arquitetónico) | Catálogo adaptado; **sem** UI Aedifex |
| Walkthrough / street view | Em falta | Controlo 1ª pessoa no ViewerCore |
| Export GLB/STL/OBJ da cena arquitetónica | Parcial (pimo tem exports industriais) | Reutilizar exporters Three sob API pimo |
| IFC converter | Em falta | `ifc-converter` vendored; UI import pimo |
| Spatial grid / snap rules | Parcial | Unificar com smart room snap existente |
| AI tools (lógica) — **fase tardia** | Diferencial | Opcional; UI 100% pimo; API local |

### 3.2 Descártáveis / incompatíveis (não trazer UI/shell)

| Módulo | Motivo |
|--------|--------|
| `apps/editor` (Next shell, Tailwind layout) | Conflito total com chrome pimo |
| `@aedifex/editor` UI (sidebar, AI panel visual, command palette) | Estilo Aedifex — proibido no resultado |
| `@repo/ui` / Radix skin Aedifex | Substituir por componentes pimo |
| Dark/light viewport + compass HUD Aedifex | Usar toolbar/HUD pimo |
| Persistência SQLite `~/.pascal` / MCP storage default | Usar ProjectProvider / persistência pimo |
| Catálogo CDN Supabase hardcoded (como dependência de runtime SaaS) | Espelhar assets localmente ou via `public/` pimo |
| Peer `next` do pacote editor | Não embutir Next |
| WebGPU-only materials/TSL como **renderer principal** | Workspace pimo = WebGL; WebGPU só se feature flag isolada |
| Auth/OAuth vestígios Pascal SaaS | Irrelevante |

### 3.3 Precisam reescrita para o modelo pimo

| Capacidade Aedifex | Destino pimo-alfa |
|--------------------|-------------------|
| `<Viewer>` R3F WebGPU | **Não** substituir ViewerCore; portar geometria/tools |
| `<Editor>` monolítico | Ferramentas em LeftPanel / UnifiedTopToolbar / PainelSala |
| `useScene` como SSOT | Bridge ↔ `ProjectRoomConfig` (+ extensão multi-level) |
| Tools `nodes/*/tool.tsx` | Reimplementar com eventos ViewerCore + PainelSala |
| Floorplan 2D Aedifex | Opcional: painel 2D no estilo pimo (fase posterior) |
| Iconify/Lucide Aedifex | `src/components/icons` (IconName registry) |

---

## 4. Pontos de encaixe no pimo-alfa (já mapeados)

```
Aedifex (lógica útil)
  → src/integration/aedifex/bridge/*
  → useRoomActions.setProjectRoom / extensão SSOT
  → useViewerRoomSync → wallStore → RoomManager
  → UI: PainelSala + LeftToolbar + tokens CSS (sem UI Aedifex)
```

**Boundary obrigatório** (padrão industrial):

- `ViewerCore` **não** importa `integration/aedifex/**`
- Integração passa por `viewerIntegration.ts` + `getActiveViewerCore()`
- Precedente: `src/industrial/viewerIntegration.ts`

**Ficheiros-âncora existentes:**

- `src/3d/room/pimoRoomVersion.ts` (v4 + atribuição Aedifex)
- `src/3d/room/pimoRoomSchema.ts`
- `src/components/layout/workspace/Workspace.tsx`
- `src/hooks/viewer/useViewerRoomSync.ts`
- `src/components/.../PainelSala.tsx`
- `src/index.css` (tokens)

---

## 5. Estratégia de fusão (fases seguintes)

### Princípio

> Um único projeto visual = **pimo-alfa**.  
> Capacidades Aedifex = **código adaptado**, não produto embutido.

### Fase 2 — Fundação (scaffold + bridge)

1. Estrutura `src/integration/aedifex/{bridge,hooks,ui,vendor,types}`
2. Tipos DTO Aedifex ↔ `ProjectRoomConfig`
3. Import/export JSON de cena arquitetónica (subset wall/door/window/zone)
4. Testes Vitest do bridge
5. Botão no PainelSala: “Importar planta (Aedifex)” — UI 100% pimo
6. `NOTICE` / atribuição MIT

### Fase 3 — Capacidades em falta (core)

Ordem sugerida:

1. Gaps de miters/cutouts/zones vs Aedifex atual  
2. Multi-level  
3. Slab / ceiling  
4. Walkthrough 1ª pessoa  
5. Catálogo items + placement (sem UI Aedifex)  
6. Export cena GLB  

### Fase 4 — IFC + ferramentas avançadas

1. Vendor `@aedifex/ifc-converter` + WASM `web-ifc`  
2. Fluxo import IFC → bridge → `setProjectRoom`  
3. Roof / stairs / columns conforme prioridade de negócio  

### Fase 5 — AI / MCP (opcional, local-only)

1. Lógica de tools AI sem painel Aedifex  
2. Painel chat no estilo pimo (tokens, ícones)  
3. Sem publish; API key só em `.env.local`

### Explicitamente fora do caminho crítico

- Substituir ViewerCore por Canvas WebGPU Aedifex  
- Montar `<Editor>` Next dentro do Workspace  
- Copiar Tailwind/Radix skin  

---

## 6. Dependências externas necessárias (quando implementar)

| Dependência | Uso | Nota |
|-------------|-----|------|
| (já) `three`, `three-csg-ts` | Geometria | Manter alinhado ao pimo |
| `web-ifc` (+ WASM) | IFC | Fase 4 |
| Possível `three-mesh-bvh` | Walkthrough/raycast | Avaliar vs código pimo |
| **Não** adicionar Next, Turbo, Bun obrigatório, Tailwind Aedifex | — | Conflito |

**Vendoring:** copiar/adaptar fontes úteis para `src/integration/aedifex/vendor/` (MIT + NOTICE). Evitar `file:` workspace para `external/aedifex` no runtime de produção local, para isolamento.

---

## 7. Riscos

| Risco | Mitigação |
|-------|-----------|
| Dual renderer (WebGPU + WebGL) | Um viewport: ViewerCore |
| Duplicar room v4 | Diff-first; não reintroduzir V4 legado |
| Estilo Aedifex “vazar” | Zero CSS/componentes do editor Aedifex |
| Three version skew (0.185 vs pimo) | Adaptar código; não forçar upgrade cego |
| CDN mobiliário externo | Mirror local em `public/` |
| Tocar pimo-criativo | Trabalho só em `pimo-alfa`; sem remote push |
| Quebrar cutlist/CNC | Room bridge não altera SSOT industrial de caixas |

---

## 8. Critérios de “fusão completa” (Definition of Done)

- [ ] Capacidades Aedifex prioritárias disponíveis no Workspace pimo  
- [ ] Zero componentes UI originais Aedifex visíveis  
- [ ] Cores/ícones/layout = tokens e `Icon` pimo  
- [ ] Navegação via rotas/chrome pimo  
- [ ] `pimo-criativo` intacto  
- [ ] Sem remotes / sem publish na alfa  

---

## 9. Estado após Fase 1

| Item | Estado |
|------|--------|
| Análise Aedifex | Concluída |
| Análise pontos pimo-alfa | Concluída |
| Pasta `src/integration/aedifex` | Criada |
| Código de engine/UI | **Ainda não** (Fases 2+) |
| Relatório | Este ficheiro + `RELATORIO_FASE1.md` |
