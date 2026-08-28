/**
 * ADMIN — Estado dos proxies de email (quotes + final-report).
 * Rota: /admin/system/email-status
 * Auth: JWT admin (admin.full_access); nunca usa PIMO_EMAIL_HEALTH_SECRET no browser.
 */

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { buildApiUrl } from "../../config/api";
import { authHeaders } from "../../core/projects/remoteApiAuth";
import Panel from "../../components/ui/Panel";

type HealthPayload = {
  ok: boolean;
  checkedAt?: string;
  serverEnvFileFound?: boolean;
  internalSecretConfigured?: boolean;
  curlAvailable?: boolean;
  proxies?: { quotes?: string; finalReport?: string };
  error?: string;
};

type LastPayload = {
  ok: boolean;
  last: {
    checkedAt?: string;
    ok?: boolean;
    internalSecretConfigured?: boolean;
    source?: string;
  } | null;
};

type ProxyProbe = { ok: boolean; status: number | null; detail: string };

const rowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "200px 1fr",
  gap: 8,
  fontSize: 13,
  padding: "6px 0",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const labelStyle: React.CSSProperties = { color: "var(--text-muted)" };
const valueStyle: React.CSSProperties = {
  color: "var(--text-main)",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  wordBreak: "break-all",
};

async function probeProxy(path: string): Promise<ProxyProbe> {
  try {
    const res = await fetch(buildApiUrl(path), { method: "GET" });
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) detail += ` — ${body.error}`;
    } catch {
      /* ignore */
    }
    return {
      ok: res.status === 405,
      status: res.status,
      detail,
    };
  } catch (e) {
    return {
      ok: false,
      status: null,
      detail: e instanceof Error ? e.message : "Falha de rede",
    };
  }
}

export default function EmailStatusPage() {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [healthHttp, setHealthHttp] = useState<number | null>(null);
  const [lastCi, setLastCi] = useState<LastPayload["last"]>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [quotesProbe, setQuotesProbe] = useState<ProxyProbe | null>(null);
  const [finalProbe, setFinalProbe] = useState<ProxyProbe | null>(null);
  const [busy, setBusy] = useState(false);

  const loadLast = useCallback(async () => {
    setLastError(null);
    try {
      const res = await fetch(buildApiUrl("/api/email-health/index.php?view=last"), {
        method: "GET",
        headers: authHeaders(),
      });
      if (!res.ok) {
        setLastError(`HTTP ${res.status}`);
        setLastCi(null);
        return;
      }
      const data = (await res.json()) as LastPayload;
      setLastCi(data.last ?? null);
    } catch (e) {
      setLastError(e instanceof Error ? e.message : "Falha ao ler última verificação");
      setLastCi(null);
    }
  }, []);

  const runLiveCheck = useCallback(async () => {
    setBusy(true);
    setHealthError(null);
    try {
      const [hRes, q, f] = await Promise.all([
        fetch(buildApiUrl("/api/email-health/index.php"), {
          method: "GET",
          headers: authHeaders(),
        }),
        probeProxy("/api/quotes/index.php"),
        probeProxy("/api/final-report/index.php"),
      ]);
      setHealthHttp(hRes.status);
      setQuotesProbe(q);
      setFinalProbe(f);
      let body: HealthPayload | null = null;
      try {
        body = (await hRes.json()) as HealthPayload;
      } catch {
        body = null;
      }
      setHealth(body);
      if (!hRes.ok && hRes.status !== 503) {
        setHealthError(body?.error ?? `HTTP ${hRes.status}`);
      }
      await loadLast();
    } catch (e) {
      setHealthError(e instanceof Error ? e.message : "Falha na verificação");
      setHealth(null);
    } finally {
      setBusy(false);
    }
  }, [loadLast]);

  useEffect(() => {
    void runLiveCheck();
  }, [runLiveCheck]);

  const secretLabel =
    health?.internalSecretConfigured === true
      ? "OK (configurado)"
      : health?.internalSecretConfigured === false
        ? "Em falta"
        : "—";

  return (
    <div style={{ padding: 24, overflowY: "auto", height: "100%" }}>
      <div style={{ marginBottom: 16 }}>
        <Link to="/admin" style={{ fontSize: 12, color: "var(--text-muted)" }}>
          ← Admin
        </Link>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: "8px 0 0" }}>
          Estado do email
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "6px 0 0" }}>
          Proxies /api/quotes e /api/final-report e configuração do secret no servidor.
          O segredo de CI nunca é usado neste browser.
        </p>
      </div>

      <div style={{ maxWidth: 720, display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void runLiveCheck()}
            style={{
              fontSize: 13,
              padding: "8px 14px",
              cursor: busy ? "wait" : "pointer",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? "A verificar…" : "Verificar agora"}
          </button>
        </div>

        <Panel title="Secret e health">
          {healthError ? (
            <p style={{ fontSize: 12, color: "#f59e0b", margin: "0 0 8px" }}>{healthError}</p>
          ) : null}
          <div style={rowStyle}>
            <span style={labelStyle}>PIMO_INTERNAL_API_SECRET</span>
            <span style={valueStyle}>{secretLabel}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Health HTTP</span>
            <span style={valueStyle}>{healthHttp ?? "—"}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>ok</span>
            <span style={valueStyle}>
              {health ? (health.ok ? "true" : "false") : "—"}
            </span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>serverEnvFileFound</span>
            <span style={valueStyle}>
              {health?.serverEnvFileFound === undefined
                ? "—"
                : health.serverEnvFileFound
                  ? "true"
                  : "false"}
            </span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>curlAvailable</span>
            <span style={valueStyle}>
              {health?.curlAvailable === undefined
                ? "—"
                : health.curlAvailable
                  ? "true"
                  : "false"}
            </span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>checkedAt</span>
            <span style={valueStyle}>{health?.checkedAt ?? "—"}</span>
          </div>
        </Panel>

        <Panel title="Proxies (GET → 405 esperado)">
          <div style={rowStyle}>
            <span style={labelStyle}>/api/quotes</span>
            <span style={valueStyle}>
              {quotesProbe
                ? `${quotesProbe.ok ? "OK" : "FALHA"} — ${quotesProbe.detail}`
                : "—"}
            </span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>/api/final-report</span>
            <span style={valueStyle}>
              {finalProbe
                ? `${finalProbe.ok ? "OK" : "FALHA"} — ${finalProbe.detail}`
                : "—"}
            </span>
          </div>
        </Panel>

        <Panel title="Última verificação automática (CI)">
          {lastError ? (
            <p style={{ fontSize: 12, color: "#f59e0b", margin: "0 0 8px" }}>{lastError}</p>
          ) : null}
          <div style={rowStyle}>
            <span style={labelStyle}>checkedAt</span>
            <span style={valueStyle}>{lastCi?.checkedAt ?? "— (ainda sem corrida CI)"}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>ok</span>
            <span style={valueStyle}>
              {lastCi?.ok === undefined ? "—" : lastCi.ok ? "true" : "false"}
            </span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>internalSecretConfigured</span>
            <span style={valueStyle}>
              {lastCi?.internalSecretConfigured === undefined
                ? "—"
                : lastCi.internalSecretConfigured
                  ? "true"
                  : "false"}
            </span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>source</span>
            <span style={valueStyle}>{lastCi?.source ?? "—"}</span>
          </div>
        </Panel>
      </div>
    </div>
  );
}
