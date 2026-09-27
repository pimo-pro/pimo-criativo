# Relatório Fase 1 — Integração Aedifex → pimo-alfa

**Data:** 2026-09-18  
**Modo:** análise + plano (sem fusão de runtime ainda)  
**Escrita:** apenas `pimo-alfa/src/integration/aedifex/`  
**Leitura:** `external/aedifex` (inalterado)

---

## O que foi feito nesta fase

1. Análise completa do monorepo Aedifex (~2.6k ficheiros fonte).
2. Mapeamento do viewer/workspace/tema do pimo-alfa e do **pimo-room v4** (já inspirado em Aedifex).
3. Classificação útil / descartável / a reescrever.
4. Plano de fusão por fases (2–5) com boundary industrial.
5. Criação da pasta de integração e documentos base.

## O que NÃO foi feito (propositadamente)

- Não se embutiu o `<Editor>` / `<Viewer>` Aedifex.
- Não se adicionaram dependências npm novas.
- Não se alterou `pimo-criativo` nem `external/aedifex`.
- Não se executou deploy/publish.

---

## Achado crítico

O pimo-alfa **já absorveu parcialmente** a lógica Aedifex em `pimo-room v4` (WebGL/ViewerCore + UI Salão).  
A fusão “um único projeto com cara pimo” deve **completar capacidades em falta** nesse pipeline — não montar um segundo produto WebGPU/Next/Tailwind.

---

## Integrar (próximas fases)

| Capacidade | Origem Aedifex | Destino pimo |
|------------|----------------|--------------|
| Bridge scene ↔ room SSOT | core schemas | `bridge/` + `setProjectRoom` |
| Multi-level, slab, roof | nodes | RoomManager + PainelSala |
| Walkthrough | viewer BVH | ViewerCore controls |
| Catálogo items | editor catalog | public/ + placement pimo |
| IFC | ifc-converter | vendor + import UI pimo |
| Export GLB cena | editor export | API pimo |
| AI tools (opcional) | editor AI | painel estilo pimo + `.env.local` |

## Reescrever

- Toda a UI (sidebar, tools chrome, AI panel visual).
- Tools interativas → eventos ViewerCore + painéis pimo.
- Materiais/HUD → tokens CSS e ícones `IconName`.
- Persistência → ProjectProvider (não SQLite Pascal).

## Remover / não trazer

- Shell Next.js, Tailwind/Radix skin Aedifex, `@repo/ui`.
- Compass/theme HUD Aedifex.
- Peer `next`, Turbo/Bun como requisito de runtime.
- WebGPU como renderer principal do Workspace.
- Auth SaaS / storage `~/.pascal` default.

## Ainda falta para completar a fusão

Ver `PLAN_FASE1.md` Fases 2–5. Próximo passo imediato: **Fase 2 — scaffold bridge + import JSON + botão PainelSala**.

---

## Isolamento confirmado

| Projeto | Estado |
|---------|--------|
| pimo-alfa | Pasta `src/integration/aedifex` criada |
| pimo-criativo | Não tocado |
| external/aedifex | Não tocado |
| pimo-mail-service / PIMO-WORDPRESS | Não tocados |
