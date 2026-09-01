/**
 * Documentação Interna — híbrido A+C.
 * Rota: /documentacao. Layout full-width / full-height responsivo.
 */

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import {
  AJUDA_PAGE_TOKENS as C,
  ajudaPageFont as font,
} from "../ajuda/ajudaPageTokens";
import {
  DEFAULT_HUB_SECTION,
  HUB_SECTIONS,
  parseHubSectionHash,
  type HubSectionId,
} from "./hubSections";
import HubHistoricoContent from "./HubHistoricoContent";
import HubAdicionadosContent from "./HubAdicionadosContent";
import HubLogsContent from "./HubLogsContent";
import HubRemovidosContent from "./HubRemovidosContent";
import HubRefsContent from "./HubRefsContent";
import HubProgressoContent from "./HubProgressoContent";
import HubStatsContent from "./HubStatsContent";
import HubPlaneamentoContent from "./HubPlaneamentoContent";
import HubAtualContent from "./HubAtualContent";
import HubDashboardContent from "./HubDashboardContent";
import HubPimoSoonContent from "./HubPimoSoonContent";

type HubDocumentacaoInternaProps = {
  /** Secção inicial. Alias: defaultSection. */
  initialSection?: HubSectionId;
  /** Alias Admin embeds (equiv. a initialSection). */
  defaultSection?: HubSectionId;
  /**
   * Embed no Admin: respeita defaultSection/initialSection no mount
   * (não deixa um hash residual de outra página sobrescrever).
   * Continua a atualizar hash via replaceState ao navegar nas secções.
   */
  embedded?: boolean;
};

function resolveStartSection(
  embedded: boolean,
  defaultSection?: HubSectionId,
  initialSection?: HubSectionId
): HubSectionId {
  const fallback = defaultSection ?? initialSection ?? DEFAULT_HUB_SECTION;
  if (embedded) return fallback;
  if (typeof window === "undefined") return fallback;
  const fromHash = parseHubSectionHash(window.location.hash);
  return fromHash ?? fallback;
}

export default function HubDocumentacaoInterna({
  initialSection,
  defaultSection,
  embedded = false,
}: HubDocumentacaoInternaProps) {
  const startSection = resolveStartSection(embedded, defaultSection, initialSection);
  const [active, setActive] = useState<HubSectionId>(startSection);
  const [syncedStartSection, setSyncedStartSection] = useState(startSection);
  if (embedded && startSection !== syncedStartSection) {
    setSyncedStartSection(startSection);
    setActive(startSection);
  }

  useEffect(() => {
    if (embedded) {
      const next = `#${startSection}`;
      if (window.location.hash !== next) {
        window.history.replaceState(null, "", `${window.location.pathname}${next}`);
      }
      return;
    }
    const fromHash = parseHubSectionHash(window.location.hash);
    if (!fromHash) {
      const next = `#${DEFAULT_HUB_SECTION}`;
      if (window.location.hash !== next) {
        window.history.replaceState(null, "", `${window.location.pathname}${next}`);
      }
    }
  }, [embedded, startSection]);

  useEffect(() => {
    if (embedded) return;
    const onHashChange = () => {
      const fromHash = parseHubSectionHash(window.location.hash);
      if (fromHash) setActive(fromHash);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [embedded]);

  const selectSection = useCallback((id: HubSectionId) => {
    setActive(id);
    const next = `#${id}`;
    if (window.location.hash !== next) {
      window.history.replaceState(null, "", `${window.location.pathname}${next}`);
    }
  }, []);

  const activeDef = HUB_SECTIONS.find((s) => s.id === active) ?? HUB_SECTIONS[0];

  return (
    <main
      style={{
        flex: 1,
        width: "100%",
        maxWidth: "none",
        minHeight: "100%",
        height: "100%",
        boxSizing: "border-box",
        overflowY: "auto",
        scrollBehavior: "smooth",
        background: C.bg,
        color: C.text,
        fontFamily: font,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "none",
          margin: 0,
          padding: "0 clamp(12px, 2vw, 28px) 48px",
          boxSizing: "border-box",
          minHeight: "100%",
        }}
      >
        <header
          style={{
            padding: "clamp(24px, 4vw, 40px) 0 24px",
            borderBottom: `1px solid ${C.border}`,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 12,
              padding: "3px 10px",
              borderRadius: 999,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              background: C.accentBg,
              color: C.accent,
              border: `1px solid ${C.accentBd}`,
            }}
          >
            Documentação avançada
          </div>
          <h1
            style={{
              fontSize: "clamp(1.6rem, 3.5vw, 2.1rem)",
              fontWeight: 800,
              margin: "0 0 8px",
              letterSpacing: "-0.02em",
            }}
          >
            Documentação Interna
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: C.muted, maxWidth: "72ch", lineHeight: 1.55 }}>
            Hub A+C — mapa de secções e leitura editorial. Conteúdo ligado a
            histórico, novidades, refs e progresso.
          </p>
        </header>

        {active === "atual" ? <HubStatsContent /> : null}

        <section
          aria-label="Mapa de secções"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 220px), 1fr))",
            gap: 10,
            marginBottom: 28,
            width: "100%",
          }}
        >
          {HUB_SECTIONS.map((sec) => {
            const isActive = sec.id === active;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => selectSection(sec.id)}
                aria-pressed={isActive}
                style={{
                  textAlign: "left",
                  padding: "14px 14px 12px",
                  borderRadius: 10,
                  border: `1px solid ${isActive ? C.accentBd : C.border}`,
                  background: isActive ? C.accentBg : C.surface,
                  color: C.text,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  width: "100%",
                  boxSizing: "border-box",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <Icon name={sec.icon} size={16} aria-hidden />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{sec.label}</span>
                </span>
                <span style={{ fontSize: 11, color: C.muted, lineHeight: 1.4 }}>{sec.blurb}</span>
              </button>
            );
          })}
        </section>

        <div
          className="hub-doc-body"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(160px, 220px) minmax(0, 1fr)",
            gap: "clamp(12px, 2vw, 28px)",
            alignItems: "start",
            width: "100%",
          }}
        >
          <nav
            aria-label="Índice do hub"
            style={{
              position: "sticky",
              top: 12,
              padding: 10,
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              background: C.surface,
              display: "flex",
              flexDirection: "column",
              gap: 2,
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            {HUB_SECTIONS.map((sec) => {
              const isActive = sec.id === active;
              return (
                <button
                  key={`nav-${sec.id}`}
                  type="button"
                  onClick={() => selectSection(sec.id)}
                  aria-current={isActive ? "page" : undefined}
                  style={{
                    textAlign: "left",
                    padding: "8px 10px",
                    border: "none",
                    borderRadius: 6,
                    background: isActive ? C.accentBg : "transparent",
                    color: isActive ? C.text : C.muted,
                    fontSize: 12,
                    fontWeight: isActive ? 700 : 500,
                    cursor: "pointer",
                    width: "100%",
                  }}
                >
                  {sec.label}
                </button>
              );
            })}
          </nav>

          <section
            id={active}
            aria-labelledby={`hub-section-title-${active}`}
            style={{
              padding: "clamp(14px, 2vw, 22px)",
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              background: C.surface,
              minHeight: 220,
              width: "100%",
              boxSizing: "border-box",
              minWidth: 0,
            }}
          >
            <h2
              id={`hub-section-title-${active}`}
              style={{
                margin: "0 0 8px",
                fontSize: 16,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Icon name={activeDef.icon} size={18} aria-hidden />
              {activeDef.label}
            </h2>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
              {activeDef.blurb}
            </p>
            {active === "atual" ? (
              <HubAtualContent />
            ) : active === "historico" ? (
              <HubHistoricoContent />
            ) : active === "adicionados" ? (
              <HubAdicionadosContent />
            ) : active === "logs" ? (
              <HubLogsContent />
            ) : active === "removidos" ? (
              <HubRemovidosContent />
            ) : active === "refs" ? (
              <HubRefsContent />
            ) : active === "progresso" ? (
              <HubProgressoContent />
            ) : active === "planeamento" ? (
              <HubPlaneamentoContent />
            ) : active === "dashboard" ? (
              <HubDashboardContent />
            ) : active === "pimo-soon" ? (
              <HubPimoSoonContent />
            ) : (
              <div
                data-hub-placeholder={active}
                style={{
                  padding: "20px 16px",
                  borderRadius: 8,
                  border: `1px dashed ${C.border}`,
                  fontSize: 12,
                  color: C.muted,
                  lineHeight: 1.55,
                }}
              >
                Placeholder — conteúdo desta secção será ligado nas fases seguintes
                (documentação atual). Sem dados nesta fase.
              </div>
            )}
          </section>
        </div>
      </div>
      <style>{`
        @media (max-width: 820px) {
          .hub-doc-body {
            grid-template-columns: 1fr !important;
          }
          .hub-doc-body > nav {
            position: static !important;
            flex-direction: row !important;
            flex-wrap: wrap !important;
          }
          .hub-doc-body > nav button {
            width: auto !important;
          }
        }
      `}</style>
    </main>
  );
}
