import type { SavedProjectRecord } from "@/core/projects/types";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";

import ProjetosLoginGate from "../ProjetosLoginGate";
import ProjetosShowroomPanel, { type ProjetosFocusLevel } from "../ProjetosShowroomPanel";
import ProjetosElementSections from "../ProjetosElementSections";
import ProjetosIndustrialPanel from "../industrial/ProjetosIndustrialPanel";
import {
  getProjetosSnapshot,
  setProjetosSnapshot,
} from "../projetosSnapshotCache";
import {
  loadProjectRecordByPageSlug,
} from "../projetosProjectLoader";
import {
  snapshotMatchesProjetosPageSlug,
  toProjetosPageSlug,
} from "../projetosPageSlug";
import { resolveProjetosFocusFromSegments } from "../projetosFocusSlug";

function resolveFocusLevel(boxSegment?: string, pieceSegment?: string): ProjetosFocusLevel {
  if (pieceSegment) return "piece";
  if (boxSegment) return "box";
  return "project";
}

function snapshotMatchesProject(snapshot: SavedProjectRecord | null, pageSlug: string | undefined) {
  return snapshotMatchesProjetosPageSlug(snapshot, pageSlug);
}

function ProjetosHubLayoutContent({ children }: { children?: ReactNode }) {
  const { project: pageSlug, box: boxSegment, piece: pieceSegment } = useParams();
  const focusLevel = useMemo(
    () => resolveFocusLevel(boxSegment, pieceSegment),
    [boxSegment, pieceSegment]
  );

  const slugError = pageSlug ? null : "Projeto nao especificado na URL.";

  const cachedSnapshot = useMemo(() => {
    if (!pageSlug) return null;
    const cached = getProjetosSnapshot();
    return snapshotMatchesProject(cached, pageSlug) ? cached : null;
  }, [pageSlug]);

  const [loadedSnapshot, setLoadedSnapshot] = useState<SavedProjectRecord | null>(null);
  const [loadedForSlug, setLoadedForSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const snapshot = cachedSnapshot ?? (loadedForSlug === pageSlug ? loadedSnapshot : null);
  const fetchError = loadedForSlug === pageSlug ? error : null;
  const displayError = slugError ?? fetchError;
  const displayLoading = Boolean(pageSlug && !cachedSnapshot && loadedForSlug !== pageSlug);

  useEffect(() => {
    if (!pageSlug || cachedSnapshot) return;

    let cancelled = false;

    void loadProjectRecordByPageSlug(pageSlug).then((record) => {
      if (cancelled) return;

      setLoadedForSlug(pageSlug);

      if (!record) {
        setLoadedSnapshot(null);
        setError("Projeto nao encontrado.");
        return;
      }

      setProjetosSnapshot(record);
      setLoadedSnapshot(record);
      setError(null);
    });

    return () => {
      cancelled = true;
    };
  }, [pageSlug, cachedSnapshot]);

  const resolvedFocus = useMemo(
    () => resolveProjetosFocusFromSegments(snapshot, boxSegment, pieceSegment),
    [snapshot, boxSegment, pieceSegment]
  );

  const reportProjectSlug = snapshot?.name ? toProjetosPageSlug(snapshot.name) : "";

  return (
    <div className="ui-projetos-hub">
      <aside
        className="ui-projetos-hub__sidebar"
        style={{
          width: 280,
          minWidth: 240,
          maxWidth: 320,
          background: "#f4f4f5",
          borderRight: "1px solid #e4e4e7",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {!displayLoading && !displayError ? (
          <ProjetosElementSections snapshot={snapshot} />
        ) : (
          <div style={{ padding: 12, fontSize: 12, color: "#71717a" }}>
            {displayLoading ? "A carregar…" : displayError}
          </div>
        )}
      </aside>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header
          style={{
            height: 48,
            padding: "0 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 12,
            background: "#fafafa",
            borderBottom: "1px solid #e4e4e7",
            fontSize: 13,
            fontWeight: 600,
            color: "#3f3f46",
          }}
        >
          {reportProjectSlug ? (
            <Link
              to={`/relatorio-final/${encodeURIComponent(reportProjectSlug)}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid #e4e4e7",
                background: "#fff",
                color: "#18181b",
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Relat{"\u00f3"}rio Final
            </Link>
          ) : (
            <span style={{ color: "#a1a1aa", fontWeight: 500 }}>Relat{"\u00f3"}rio Final</span>
          )}
        </header>
        <main style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "row", overflow: "hidden" }}>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            {displayLoading && <div style={{ padding: 16 }}>A carregar projeto…</div>}
            {!displayLoading && displayError && <div style={{ padding: 16 }}>{displayError}</div>}
            {!displayLoading && !displayError && (
              <ProjetosShowroomPanel
                snapshot={snapshot}
                focusLevel={focusLevel}
                projectPageSlug={pageSlug}
                boxId={resolvedFocus.boxId}
                pieceId={resolvedFocus.pieceId}
              />
            )}
            {children}
          </div>
          {!displayLoading && !displayError ? (
            <ProjetosIndustrialPanel
              snapshot={snapshot}
              focusLevel={focusLevel}
              pageSlug={pageSlug}
              boxSegment={boxSegment}
              pieceSegment={pieceSegment}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}

export default function ProjetosHubLayout({ children }: { children?: ReactNode }) {
  return (
    <ProjetosLoginGate title="Inicia sessão para veres este projeto">
      <ProjetosHubLayoutContent>{children}</ProjetosHubLayoutContent>
    </ProjetosLoginGate>
  );
}
