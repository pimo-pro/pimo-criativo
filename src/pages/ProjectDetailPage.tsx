import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { industrialProjectsUrl } from "../config/industrialApp";
import Card from "../components/ui/Card";
import Loader from "../components/ui/Loader";
import PageContainer from "../components/ui/PageContainer";
import PageHeader from "../components/ui/PageHeader";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [projectName, setProjectName] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setProjectName(id ? `Projeto ${id}` : null);
      setLoading(false);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [id]);

  return (
    <PageContainer>
      <Card>
        <PageHeader title={projectName ? projectName : `Projeto ${id}`} />
        {loading ? <Loader label={`Carregando projeto ${id}...`} /> : null}
        {!loading ? (
          <div style={{ display: "grid", gap: 16 }}>
            <p>Placeholder da FASE 4 (editor não implementado).</p>
            <p style={{ margin: 0, color: "#64748b" }}>
              Tracking e work orders estão no{" "}
              <a href={industrialProjectsUrl()} target="_blank" rel="noreferrer">
                PIMO Industrial (MES)
              </a>
              .
            </p>
            <Link to="/projects">← Voltar aos projetos</Link>
          </div>
        ) : null}
      </Card>
    </PageContainer>
  );
}
