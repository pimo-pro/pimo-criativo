import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getMe, type MeResponse } from "../api/authApi";
import { canAccessAdminPanel, hasFullAccess } from "../auth/rbac";
import { useAuth } from "../auth/useAuth";
import Card from "../components/ui/Card";
import Loader from "../components/ui/Loader";
import PageContainer from "../components/ui/PageContainer";
import PageHeader from "../components/ui/PageHeader";
import Section from "../components/ui/Section";
import "../components/ui/ui.css";

export default function MePage() {
  const { hasPermission } = useAuth();
  const full = hasFullAccess(hasPermission);
  const adminPanel = canAccessAdminPanel(hasPermission);
  const [data, setData] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMe()
      .then((result) => setData(result))
      .catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar /me"));
  }, []);

  if (error) {
    return (
      <PageContainer>
        <Card maxWidth={640}>
          <p className="ui-text-danger">{error}</p>
        </Card>
      </PageContainer>
    );
  }
  if (!data) {
    return (
      <PageContainer>
        <Card maxWidth={640}>
          <Loader label="Carregando /me..." />
        </Card>
      </PageContainer>
    );
  }

  const permissions = data.user.permissions ?? [];

  return (
    <PageContainer>
      <Card maxWidth={640}>
        <PageHeader title="Me" />
        <Section title="Dados do utilizador">
          <p>ID: {data.user.id}</p>
          <p>Username: {data.user.username}</p>
          <p>Role efectivo: {data.user.effectiveRole ?? data.user.role}</p>
          {data.user.accountStatus === "pending" ? (
            <p style={{ color: "var(--ui-color-warning, #b45309)", marginTop: 8 }}>
              Conta pendente de aprovação
              {data.user.requestedRole ? ` (pedido: ${data.user.requestedRole})` : ""}.
              Enquanto aguarda, tem acesso de Visitor.
            </p>
          ) : (
            <p>Estado da conta: {data.user.accountStatus ?? "approved"}</p>
          )}
        </Section>
        <Section title="Permissions">
          <ul>
            {permissions.map((permission) => (
              <li key={permission}>{permission}</li>
            ))}
          </ul>
        </Section>
        {full || adminPanel ? (
          <Section title="Área administrativa">
            {full ? (
              <>
                <p style={{ marginTop: 0, fontSize: 13 }}>
                  <Link to="/admin/users">Gestão de utilizadores (API online)</Link>
                </p>
                <p style={{ marginTop: 0, fontSize: 13 }}>
                  <Link to="/admin/project-shares">Partilhas de projectos</Link>
                </p>
              </>
            ) : null}
            {adminPanel ? (
              <p style={{ marginTop: 0, fontSize: 13 }}>
                <Link to="/admin/roles">Painel administração (roles, permissões, ícones)</Link>
              </p>
            ) : null}
          </Section>
        ) : null}
      </Card>
    </PageContainer>
  );
}
