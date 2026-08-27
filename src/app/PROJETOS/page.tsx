import { useCallback, useEffect, useMemo, useState } from "react";

import Card from "@/components/ui/Card";
import Loader from "@/components/ui/Loader";
import PageContainer from "@/components/ui/PageContainer";
import PageHeader from "@/components/ui/PageHeader";
import Section from "@/components/ui/Section";
import "@/components/ui/ui.css";
import type { SavedProjectMeta } from "@/core/projects/types";

import ProjetosLoginGate from "./ProjetosLoginGate";
import ProjetosProjectCard from "./ProjetosProjectCard";
import { listProjetosPageProjects } from "./projetosPagesClient";

function EmptyState() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        padding: "48px 24px",
        textAlign: "center",
        color: "var(--ui-color-muted, #71717a)",
      }}
    >
      <svg
        width={48}
        height={48}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </svg>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>Nenhum projeto industrial encontrado.</p>
      <p style={{ margin: 0, fontSize: 13, maxWidth: 360 }}>
        Aparecem aqui projectos com página PROJETOS guardada no servidor ({`{nome}.json`}).
      </p>
    </div>
  );
}

function ProjetosIndexContent() {
  const [projects, setProjects] = useState<SavedProjectMeta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listProjetosPageProjects("all");
      const sorted = Array.isArray(list)
        ? [...list].sort((a, b) => {
            const ta = new Date(a.updatedAt ?? "").getTime();
            const tb = new Date(b.updatedAt ?? "").getTime();
            return tb - ta;
          })
        : [];
      setProjects(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar projetos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const stats = useMemo(() => {
    const total = projects.length;
    const corrupted = projects.filter((p) => p.corrupted).length;
    const withThumb = projects.filter((p) => !!p.thumbnailDataUrl).length;
    return { total, corrupted, withThumb };
  }, [projects]);

  if (error) {
    return (
      <PageContainer>
        <Card className="ui-projects-shell">
          <PageHeader title="PROJETOS" subtitle="Falha ao carregar projetos industriais." />
          <Card>
            <p className="ui-text-danger">{error}</p>
          </Card>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Card className="ui-projects-shell">
        <PageHeader
          title="PROJETOS"
          subtitle="Hub de projectos industriais com página PROJETOS activa."
        />

        {!loading ? (
          <div
            style={{
              display: "flex",
              gap: 16,
              flexWrap: "wrap",
              marginBottom: 20,
              padding: "12px 16px",
              background: "var(--ui-color-surface, #f4f4f5)",
              borderRadius: 10,
              border: "1px solid var(--border, #e4e4e7)",
              alignItems: "center",
            }}
          >
            <StatPill label="Total" value={stats.total} />
            <StatPill label="Corrompidos" value={stats.corrupted} danger={stats.corrupted > 0} />
            <StatPill label="Com thumbnail" value={stats.withThumb} />
          </div>
        ) : null}

        <Section title="Projectos industriais">
          {loading ? <Loader label="Carregando projetos..." /> : null}

          {!loading && projects.length === 0 ? <EmptyState /> : null}

          {!loading && projects.length > 0 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 16,
              }}
            >
              {projects.map((project) => (
                <ProjetosProjectCard key={project.id} project={project} />
              ))}
            </div>
          ) : null}
        </Section>
      </Card>
    </PageContainer>
  );
}

function StatPill({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: danger ? "var(--ui-color-danger, #ef4444)" : "var(--ui-color-text, #18181b)",
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span style={{ fontSize: 12, color: "var(--ui-color-muted, #71717a)" }}>{label}</span>
    </div>
  );
}

export default function ProjetosIndexPage() {
  return (
    <ProjetosLoginGate title="Inicia sessão para veres os teus projetos" fromPath="/PROJETOS">
      <ProjetosIndexContent />
    </ProjetosLoginGate>
  );
}
