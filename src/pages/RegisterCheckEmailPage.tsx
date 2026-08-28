import { Link, useLocation, Navigate } from "react-router-dom";

import Card from "../components/ui/Card";
import PageContainer from "../components/ui/PageContainer";
import PageHeader from "../components/ui/PageHeader";
import "../components/ui/ui.css";

type LocationState = {
  email?: string;
  inviteCodeApplied?: boolean;
  inviteCodeWarning?: string | null;
};

export default function RegisterCheckEmailPage() {
  const location = useLocation();
  const state = (location.state ?? {}) as LocationState;
  const email = (state.email ?? "").trim();
  const inviteApplied = state.inviteCodeApplied === true;
  const inviteWarning = (state.inviteCodeWarning ?? "").trim();

  if (!email) {
    return <Navigate to="/register" replace />;
  }

  const subtitle = inviteApplied
    ? "Enviamos um link de confirmação. Após confirmar o email, poderá fazer login com o plano atribuído pelo convite."
    : "Enviamos um link de confirmação. Só depois poderá fazer login (a conta ficará pendente de aprovação pelo administrador).";

  return (
    <PageContainer>
      <Card className="ui-register-card">
        <PageHeader title="Confirme o seu email" subtitle={subtitle} />
        {inviteWarning ? (
          <p className="ui-text-danger" style={{ marginTop: 0, marginBottom: 16 }}>
            {inviteWarning}
          </p>
        ) : null}
        <p style={{ margin: 0, fontSize: 15 }}>
          Email: <strong>{email}</strong>
        </p>
        <p style={{ marginTop: 16, marginBottom: 0, fontSize: 14, color: "var(--text-muted, #71717a)" }}>
          Verifique também a pasta de spam. Quando confirmar, use{" "}
          <Link to="/login" style={{ fontWeight: 600 }}>
            Login
          </Link>
          .
        </p>
      </Card>
    </PageContainer>
  );
}
