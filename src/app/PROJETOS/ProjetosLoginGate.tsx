import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

import { useAuth } from "@/auth/useAuth";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Loader from "@/components/ui/Loader";
import PageContainer from "@/components/ui/PageContainer";
import { canUseRemoteProjectsApi } from "@/core/projects/remoteApiAuth";

type Props = {
  /** Título mostrado quando não há sessão remota válida. */
  title: string;
  /** Caminho para voltar após login (default: URL actual). */
  fromPath?: string;
  children: ReactNode;
};

/**
 * Gate de sessão para /PROJETOS: sem JWT remoto válido mostra CTA de login
 * (não ProtectedRoute genérico — mensagem explícita).
 */
export default function ProjetosLoginGate({ title, fromPath, children }: Props) {
  const { loading } = useAuth();
  const location = useLocation();
  const from =
    fromPath ??
    (`${location.pathname}${location.search}${location.hash}` || "/PROJETOS");
  const canRemote = canUseRemoteProjectsApi();

  if (loading) {
    return (
      <PageContainer centered>
        <Card maxWidth={420}>
          <Loader label="A carregar sessão…" />
        </Card>
      </PageContainer>
    );
  }

  if (!canRemote) {
    return (
      <PageContainer>
        <Card className="ui-projects-shell" maxWidth={640}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              padding: "40px 24px",
              textAlign: "center",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 600,
                color: "var(--ui-color-text, #18181b)",
              }}
            >
              {title}
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                color: "var(--ui-color-muted, #71717a)",
                maxWidth: 360,
              }}
            >
              Os projectos no servidor só estão disponíveis com sessão iniciada.
            </p>
            <Link to="/login" state={{ from }} style={{ textDecoration: "none" }}>
              <Button type="button" variant="primary">
                Iniciar sessão
              </Button>
            </Link>
          </div>
        </Card>
      </PageContainer>
    );
  }

  return <>{children}</>;
}
