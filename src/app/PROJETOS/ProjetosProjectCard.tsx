import { Link } from "react-router-dom";
import { useState } from "react";

import Button from "@/components/ui/Button";
import { useAuthenticatedProjectThumbnailSrc } from "@/core/projects/projectThumbnail";
import type { SavedProjectMeta } from "@/core/projects/types";

import { buildProjetosPagePath } from "./projetosPageSlug";

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso || "—";
    return d.toLocaleString("pt-PT");
  } catch {
    return iso || "—";
  }
}

function ThumbnailFallback() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--ui-color-surface, #f4f4f5)",
        borderRadius: 8,
      }}
    >
      <svg
        width={40}
        height={40}
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--ui-color-muted, #a1a1aa)"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </svg>
    </div>
  );
}

type Props = {
  project: SavedProjectMeta;
};

export default function ProjetosProjectCard({ project }: Props) {
  const displayName = project.name?.trim() || "Projeto sem nome";
  const href = buildProjetosPagePath(project);
  const [thumbBroken, setThumbBroken] = useState(false);

  const resolvedSrc = useAuthenticatedProjectThumbnailSrc(
    project.name,
    project.thumbnailDataUrl,
    project.updatedAt
  );
  const thumbnailSrc = thumbBroken ? null : resolvedSrc;

  return (
    <Link
      to={href}
      style={{
        textDecoration: "none",
        color: "inherit",
        display: "block",
      }}
    >
      <div
        style={{
          border: project.corrupted
            ? "1.5px solid var(--ui-color-danger, #ef4444)"
            : "1px solid var(--border, #e4e4e7)",
          borderRadius: 12,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          background: "var(--ui-color-bg, #fff)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          transition: "box-shadow 0.15s, border-color 0.15s, transform 0.15s",
          minHeight: 260,
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = "0 4px 14px rgba(0,0,0,0.1)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)";
        }}
      >
        <div style={{ height: 120, overflow: "hidden", position: "relative", flexShrink: 0 }}>
          {thumbnailSrc ? (
            <img
              src={thumbnailSrc}
              alt={`Thumbnail de ${displayName}`}
              loading="lazy"
              decoding="async"
              onError={() => setThumbBroken(true)}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            <ThumbnailFallback />
          )}

          {project.corrupted ? (
            <span
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                background: "var(--ui-color-danger, #ef4444)",
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: 4,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              Corrompido
            </span>
          ) : null}
        </div>

        <div style={{ padding: "12px 14px", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <p
            style={{
              margin: 0,
              fontWeight: 600,
              fontSize: 14,
              color: "var(--ui-color-text, #18181b)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={displayName}
          >
            {displayName}
          </p>
          <p style={{ margin: 0, fontSize: 11, color: "var(--ui-color-muted, #71717a)" }}>
            <span style={{ opacity: 0.7 }}>Atualizado: </span>
            {formatDate(project.updatedAt ?? "")}
          </p>
          <p style={{ margin: 0, fontSize: 11, color: "var(--ui-color-muted, #71717a)" }}>
            <span style={{ opacity: 0.7 }}>Criado: </span>
            {formatDate(project.createdAt ?? "")}
          </p>
          {project.ownerName ? (
            <p style={{ margin: 0, fontSize: 11, color: "var(--ui-color-muted, #71717a)" }}>
              <span style={{ opacity: 0.7 }}>Owner: </span>
              {project.ownerName}
            </p>
          ) : null}
        </div>

        <div
          style={{
            padding: "10px 14px",
            borderTop: "1px solid var(--border, #e4e4e7)",
            display: "flex",
            gap: 8,
          }}
        >
          <Button variant="primary" style={{ width: "100%", fontSize: 13 }} tabIndex={-1}>
            Abrir
          </Button>
        </div>
      </div>
    </Link>
  );
}
