/**
 * Secção Adicionados — entradas type=feature (news.json via loadWhatsNewNews).
 * Layout editorial (A) + grelha de cards (C), sem alterar o chrome do hub.
 */

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { AJUDA_PAGE_TOKENS as C } from "../ajuda/ajudaPageTokens";
import {
  formatHubPublishedAt,
  loadHubWhatsNew,
  type WhatsNewEntry,
} from "./loadHubWhatsNew";

export default function HubAdicionadosContent() {
  const [entries, setEntries] = useState<WhatsNewEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadHubWhatsNew("adicionados")
      .then((list) => {
        if (!cancelled) setEntries(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro ao carregar novidades.");
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
    <div data-hub-adicionados style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%" }}>
      <p style={{ margin: 0, fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
        Funcionalidades publicadas (`feature`) a partir de Novidades do Sistema
        {loading ? "" : `  ${entries.length} entradas`}.
      </p>

      {loading ? (
        <p style={{ margin: 0, fontSize: 12, color: C.muted }}>A carregar</p>
      ) : null}
      {error ? <p style={{ margin: 0, fontSize: 12, color: C.muted }}>{error}</p> : null}
      {!loading && !error && entries.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: C.muted }}>
          Sem features publicadas em news.json.
        </p>
      ) : null}

      {!loading && !error && entries.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 240px), 1fr))",
            gap: 10,
          }}
        >
          {entries.map((entry, index) => (
            <article
              key={`${entry.version}-${entry.publishedAt}-${index}`}
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                background: C.bg,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <Icon name={entry.icon ?? "highlight"} size={16} aria-hidden />
                <strong style={{ fontSize: 13, color: C.text }}>{entry.version}</strong>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: C.accent,
                  }}
                >
                  feature
                </span>
              </div>
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.4 }}>
                {entry.title}
              </h3>
              {entry.description && entry.description !== entry.title ? (
                <p style={{ margin: 0, fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
                  {entry.description}
                </p>
              ) : null}
              <div style={{ fontSize: 11, color: C.muted }}>
                {formatHubPublishedAt(entry.publishedAt)}
                {entry.commit ? `  ${entry.commit}` : ""}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
