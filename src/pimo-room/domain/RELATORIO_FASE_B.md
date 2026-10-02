# RoomEngine — Fase B

**Data:** 2026-09-19  
**Âmbito:** só `pimo-alfa`

## Entregues

| Item | Estado |
|------|--------|
| Multi-level (`RoomLevelState`, `RoomLevelGeometry`, `RoomLevelManager`) | Sim |
| `SlabEngine` (espessura, material, offset, holes) | Sim |
| `WalkthroughCamera` + host ViewerCore | Sim |
| RoomBridge multi-level / slabs / camera | Sim |
| UI PainelSala (Walkthrough, Adicionar Nível, Editar Laje) | Sim |
| Fantasmas de níveis no viewer | Sim (planos translúcidos) |

## Comportamento

- **Nível activo** → `ProjectRoomConfig` → sync ViewerCore (como Fase A).
- **Outros níveis** → fantasmas empilhados em Y; troca de nível reconstrói a sala activa.
- **Walkthrough** → desactiva OrbitControls, pointer lock, WASD + mouse, colisão AABB.
- **Laje** → domínio RoomState; normalização ProjectRoomConfig continua só no nível activo (sem schema industrial).

## Testes

`tests/room-engine/roomEnginePhaseB.test.ts`
