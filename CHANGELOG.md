# Changelog — PIMO-ALFA

## [4.0] — 2026-09-23 — RoomEngine Edition

### Added
- **pimo-room v4** (`src/pimo-room-v4/`) — RoomEngine oficial (fases A–E + FINAL)
- `PIMO_ALFA_VERSION = "4.0"`, `ROOM_ENGINE_VERSION = "4.0"`, fase `FINAL`
- API pública: `PimoRoom`, `loadRoom`, `importIfc`, `importGlb`, `exportGlb`, AI helpers
- `RoomIndustrialAdapter` — sync cutlist-safe (sem workspaceBoxes de fabrico)
- Metadados de sala para PDF/nesting (`buildRoomReportMetadata`)
- Admin `/admin/room-settings` + banner em Configuração global
- PainelSala: badge RoomEngine v4, rodapé versão, modal Sobre
- Docs: `PIMO_ROOM_V4_FINAL.md`, `PIMO_ROOM_V4_RELEASE_NOTES.md`
- Testes `tests/pimo-room-v4/` (A–E + integração final + pré-release)

### Changed
- Imports de UI/viewer apontam para `pimo-room-v4`
- `src/room-engine` reduzido a shim de reexport
- UI Importar/Exportar unificada (JSON, IFC, GLB)
- FloorEngine sincroniza piso com RoomGeometry no import
- Portas/janelas: cutout acompanha movimento; teclado (setas, Q/E, Delete, Ctrl+D)
- Remoção de labels/mensagens de integração externa na UI e RoomBridge

### Notes
- Pipeline industrial (cutlist / nesting / CNC) **não** alterado
- ViewerCore WebGL permanece o renderer oficial
- Ambiente local: ver `PIMO-ALFA-LOCAL.txt` (sem deploy remoto)

### Tag
- `v4.0`
