# PIMO vNext — Release Notes (M10 Final)

**Versão de lançamento:** PIMO vNext (M10)  
**Data:** 2026-10-02  
**Site:** https://pimo.pro

---

## Anúncio oficial

O **PIMO vNext** está oficialmente concluído e agora é o motor principal do sistema,
com substituição total do legado, nova arquitectura de mesh, domínio unificado,
UI modernizada e sincronização directa com `project.room` (mm).

Este lançamento marca a transição definitiva para a nova geração do PIMO,
com desempenho superior, código limpo, arquitectura sustentável e base sólida
para futuras funcionalidades industriais e de design.

---

## Novo motor de sala — RoomMeshEngine

- Geometria completa de paredes, aberturas, piso e tecto
- Substituição total do RoomManager
- Mesh 100% derivado de `project.room` (mm)
- Builders dedicados: wall, openings, floor, ceiling (`src/pimo-room/mesh/`)

## Novo domínio — pimo-room/domain

- AIHost, IFCHost, CatalogHost, Bridge, Converter migrados
- `pimo-room-v4` removido
- UI, admin e Workspace usam domínio unificado

## UI unificada — uiStore

- Selecção de paredes e elementos via `uiStore`
- PainelSala e Workspace sem dependências antigas
- Estado de painel (`roomPanelOpen`) em `uiStore`

## Sincronização moderna

- `useViewerRoomSync` reescrito para `project.room`
- Remoção de `applyProjectRoomToWallStore`
- `roomSnapshot` mantido para compatibilidade de carregamento

## Remoção completa do legado

- `src/3d/room/**` removido (implementação em `pimo-room/mesh/impl`)
- RoomManager removido (ficam só tipos)
- `pimo-room-v4` removido
- `wallStore` removido
- `roomMeshFromWallStore` removido

## Testes

- 82/82 testes verdes (sala + schema + final)
- Paridade visual confirmada no path vNext

## Industrial / CNC

- Intacto e não modificado nesta linha de trabalho

---

## Estado canónico

| Camada | Estado |
|--------|--------|
| SSOT | `project.room` (mm) |
| Mesh | `RoomMeshEngine` + builders |
| UI | `uiStore` |
| Domínio | `pimo-room/domain` |
| Flag | `features.roomEngineVNext = true` |
