/**
 * Secção Removidos — SSOT public/updates/removed.json.
 */

import { useEffect, useState } from "react";
import { AJUDA_PAGE_TOKENS as C } from "../ajuda/ajudaPageTokens";
import {
  formatRemovedIn,
  loadRemovedRegistry,
  type RemovedRegistryEntry,
} from "./loadRemovedRegistry";

export default function HubRemovidosContent() {
  const [entries, setEntries] = useState<RemovedRegistryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadRemovedRegistry()
      .then((list) => {
        if (!cancelled) setEntries(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro ao carregar removidos.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div data-hub-removidos style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
      <p style={{ margin: 0, fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
        Registry oficial de itens removidos (`/updates/removed.json`)
        {loading ? "" : `  ${entries.length} entradas`}. Separado do arquivo Histórico e de
        Novidades.
      </p>

      {loading ? (
        <p style={{ margin: 0, fontSize: 12, color: C.muted }}>A carregar</p>
      ) : null}
      {error ? <p style={{ margin: 0, fontSize: 12, color: C.muted }}>{error}</p> : null}
      {!loading && !error && entries.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: C.muted }}>
          Registry vazio — ainda sem itens registados.
        </p>
      ) : null}

      {!loading && !error && entries.length > 0 ? (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {entries.map((entry) => (
            <li
              key={entry.id}
              id={entry.id}
              style={{
                padding: "12px 14px",
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                background: C.bg,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                  marginBottom: 6,
                }}
              >
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.text }}>
                  {entry.title}
                </h3>
                <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>
                  removido {formatRemovedIn(entry.removedIn)}
                </span>
              </div>
              {entry.replacedBy ? (
                <p style={{ margin: "0 0 6px", fontSize: 12, color: C.accent, lineHeight: 1.45 }}>
                  Substituído por: {entry.replacedBy}
                </p>
              ) : (
                <p style={{ margin: "0 0 6px", fontSize: 12, color: C.muted, lineHeight: 1.45 }}>
                  Sem substituto directo.
                </p>
              )}
              {entry.notes ? (
                <p style={{ margin: 0, fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
                  {entry.notes}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
