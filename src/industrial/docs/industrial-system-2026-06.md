# Sistema Industrial PIMO — Estado Junho 2026 (pós Fase 4)

**Versão:** 2026.06  
**Complementa:** [industrial-feature-overview.md](./industrial-feature-overview.md) (visão funcional v1.0)  
**Audiência:** Gestão, supervisores, devs industriais  
**Última actualização:** 23 de Junho de 2026

---

## 1. Resumo executivo

Após as **Fases 0–4** do plano PIMO, o sistema industrial mantém:

| Garantia | Estado |
|----------|--------|
| Formato TCN / CNC | **Inalterado** |
| Render etiquetas (`pdfEtiquetas`, UEE) | **Inalterado** |
| Geração WO por estação | **Inalterada** |
| Tabelas `industrial_*` em produção | **Activas** |

**Melhorias estruturais (sem mudar formato de export):**

- SSOT Work Orders e etiquetas (Fase 2)
- Tracking PIMO-TRAK lê `industrial_*` primeiro (Fase 4)
- Feature flags industriais em `industrial/config/` (Fase 4)
- Boundaries documentados entre viewer, core e industrial (Fase 3)

---

## 2. Fluxo industrial actual

```
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Projeto   │───▶│   Cutlist    │───▶│  Peças (QR)     │
│  (offline)  │    │  + nesting   │    │  industrial_*   │
└─────────────┘    └──────┬───────┘    └────────┬────────┘
                          │                      │
                          ▼                      ▼
                   ┌──────────────┐    ┌─────────────────┐
                   │ TCN / CNC    │    │ Work Orders     │
                   │ (core/cnc)   │    │ 6 estações      │
                   └──────────────┘    └────────┬────────┘
                          │                      │
                          ▼                      ▼
                   ┌──────────────┐    ┌─────────────────┐
                   │  Etiquetas   │    │  PIMO-TRAK      │
                   │  PDF + QR    │    │ estações + peça │
                   └──────────────┘    └────────┬────────┘
                                                 │
                                                 ▼
                                        ┌─────────────────┐
                                        │   Supervisor    │
                                        │  KPIs + RTO     │
                                        └─────────────────┘
```

**Estações WO (ordem fixa):** warehouse → nesting → drill → orlar → montagem → embalagem

---

## 3. Onde vive cada responsabilidade

| Responsabilidade | Caminho | Tabelas / notas |
|------------------|---------|-----------------|
| Cutlayout / nesting | `core/cutlayout/`, `nesting-v3/` | Offline + export |
| TCN / CNC | `core/cnc/`, `core/drill/` | Zona protegida |
| Etiquetas | `core/etiquetas/` | `pdfEtiquetas.ts`, UEE |
| WO produção | `industrial/work-orders/` | `industrial_work_orders*` |
| Persistência peça | `industrial/persistence/piece/` | `industrial_piece_*` |
| UI operador | `app/industrial/work-orders/`, `piece/` | Rotas activas |
| Supervisor | `app/industrial/supervisor/` | `loadSupervisorData` |
| Tracking unificado | `industrial/tracking/` | Industrial → legado |
| Feature flags | `industrial/config/featureFlags.ts` | SSOT Fase 4 |

---

## 4. Documentação de arquitectura (referências)

| Documento | Conteúdo |
|-----------|----------|
| [pimo-trak-flow.md](../../../../docs/architecture/pimo-trak-flow.md) | Fluxo de dados PIMO-TRAK |
| [industrial-boundaries.md](../../../../docs/architecture/industrial-boundaries.md) | Separação core / industrial / app |
| [industrial-operations-map.md](../../../../docs/architecture/industrial-operations-map.md) | Chaves warehouse/nesting/cnc |
| [industrial-feature-flags.md](../../../../docs/architecture/industrial-feature-flags.md) | Flags e thresholds RTO |
| [etiquetas-ssot.md](../../../../docs/architecture/etiquetas-ssot.md) | SSOT etiquetas (Fase 2) |
| [api-php-map-fase-3.md](../../../../docs/architecture/api-php-map-fase-3.md) | API PHP triplicada |

---

## 5. Release e fases

| Fase | Foco | Relatório |
|------|------|-----------|
| 0 | Baseline, ADRs, gates | [RELATORIO_FASE_0.md](../../../../RELATORIO_FASE_0.md) |
| 1 | Limpeza código morto | [RELATORIO_FASE_1.md](../../../../RELATORIO_FASE_1.md) |
| 2 | WO + etiquetas SSOT | [RELATORIO_FASE_2.md](../../../../RELATORIO_FASE_2.md) |
| 3 | ViewerCore + boundaries | [RELATORIO_FASE_3.md](../../../../RELATORIO_FASE_3.md) |
| 4 | PIMO-TRAK tracking | [RELATORIO_FASE_4.md](../../../../RELATORIO_FASE_4.md) |
| 5 | Docs oficiais | [RELEASE-2026-06](../../../../docs/release-notes/RELEASE-2026-06-pimo-industrial.md) |

---

## 6. Débitos técnicos conhecidos (Pendente Khaled)

| Tema | Estado | Referência |
|------|--------|------------|
| Operações divergentes (`cnc` vs `nesting`) | Documentado — Opção C | `industrial-operations-map.md` |
| Idempotência WO | `warnOnDuplicate` only | `woIdempotencyConfig.ts` |
| `workOrderId` no snapshot offline | Pode divergir do industrial | `RELATORIO_FASE_4.md` |
| API PHP SSOT | Mapeado, não migrado | ADR-004 |
| Metrics legado (`work_orders`) | Ainda activo em core | `pimo-trak-flow.md` |
| ViewerCore −20% LOC | Parcial (~111 LOC) | ADR-001 |
| Smoke manual industrial | Pendente | `docs/checklists/smoke-test-industrial.md` |

---

## 7. Guias operacionais

| Público | Guia |
|---------|------|
| Operador | [industrial-operator-guide.md](../../../../docs/guides/industrial-operator-guide.md) |
| Supervisor | [industrial-supervisor-guide.md](../../../../docs/guides/industrial-supervisor-guide.md) |
| Dev industrial | [industrial-dev-guide.md](../../../../docs/guides/industrial-dev-guide.md) |

---

## 8. ADRs activos

Índice completo: [docs/adr/README.md](../../../../docs/adr/README.md)

| ADR | Tema | Estado |
|-----|------|--------|
| ADR-001 | ViewerCore | Aceite parcial (Fase 3) |
| ADR-002 | Work Orders | Aceite parcial (Fase 2) |
| ADR-003 | Etiquetas | Aceite parcial (Fase 2) |
| ADR-004 | API PHP | Proposto (mapeado) |
| ADR-005 | Nesting V3 vs nesting3 | Proposto |
| ADR-006 | work-whatsapp | Proposto |
| ADR-007 | Viewer v4 | Adiado |
