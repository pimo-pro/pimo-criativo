/**
 * Secção Logs — entradas type=fix|update|docs (news.json via loadWhatsNewNews).
 * Lista editorial compacta, ordenada por data (já no loader).
 */

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { AJUDA_PAGE_TOKENS as C } from "../ajuda/ajudaPageTokens";
import {
  formatHubPublishedAt,
  loadHubWhatsNew,
  type WhatsNewEntry,
  type WhatsNewType,
} from "./loadHubWhatsNew";

const TYPE_LABEL: Record<WhatsNewType, string> = {
  feature: "Feature",
  fix: "Fix",
  update: "Update",
  docs: "Docs",
};

const TYPE_COLOR: Record<WhatsNewType, string> = {
  feature: "var(--status-done-color, var(--ci-success, #34d399))",
  fix: "var(--status-progress-color, var(--ci-sienna-400, #fbbf24))",
  update: C.accent,
  docs: "var(--ci-prussian-200, var(--blue-light, #a78bfa))",
};

export default function HubLogsContent() {
  const [entries, setEntries] = useState<WhatsNewEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadHubWhatsNew("logs")
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
    <div data-hub-logs style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
      <p style={{ margin: 0, fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
        Logs internos (`fix` / `update` / `docs`) a partir de Novidades do Sistema
        {loading ? "" : `  ${entries.length} entradas`}.
      </p>

      {loading ? (
        <p style={{ margin: 0, fontSize: 12, color: C.muted }}>A carregar</p>
      ) : null}
      {error ? <p style={{ margin: 0, fontSize: 12, color: C.muted }}>{error}</p> : null}
      {!loading && !error && entries.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: C.muted }}>
          Sem entradas de log em news.json.
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
          {entries.map((entry, index) => (
            <li
              key={`${entry.version}-${entry.publishedAt}-${index}`}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                background: C.bg,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                  marginBottom: 4,
                }}
              >
                <span style={{ display: "inline-flex", color: TYPE_COLOR[entry.type] }}>
                  <Icon name={entry.icon ?? "settings"} size={14} aria-hidden />
                </span>
                <strong style={{ fontSize: 12, color: C.text }}>{entry.version}</strong>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: TYPE_COLOR[entry.type],
                  }}
                >
                  {TYPE_LABEL[entry.type]}
                </span>
                <span style={{ fontSize: 11, color: C.muted, marginLeft: "auto" }}>
                  {formatHubPublishedAt(entry.publishedAt)}
                </span>
              </div>
              <div style={{ fontSize: 12, color: C.text, lineHeight: 1.45 }}>{entry.title}</div>
              {entry.commit ? (
                <div style={{ marginTop: 4, fontSize: 11, color: C.muted }}>{entry.commit}</div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
