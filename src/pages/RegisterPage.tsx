import { Link, Navigate, useNavigate } from "react-router-dom";

import { createAccountRemote } from "../api/authApi";
import { useAuth } from "../auth/useAuth";
import RegisterUserForm, {
  mapAccountCategoryToPublicRole,
  type RegisterFormValues,
} from "../components/admin/RegisterUserForm";
import Card from "../components/ui/Card";
import PageHeader from "../components/ui/PageHeader";
import PageContainer from "../components/ui/PageContainer";
import { useToast } from "../context/ToastContext";
import "../components/ui/ui.css";

export default function RegisterPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  if (isAuthenticated()) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (values: RegisterFormValues) => {
    const result = await createAccountRemote({
      username: values.username.trim(),
      email: values.email.trim(),
      password: values.senha,
      role: mapAccountCategoryToPublicRole(values.accountCategory),
      accountCategory: values.accountCategory,
      inviteCode: values.codigoConvite.trim() || undefined,
    });

    if (result.inviteCodeWarning) {
      showToast(result.inviteCodeWarning, "warning");
    }

    if (result.requiresEmailVerification) {
      navigate("/register/check-email", {
        replace: true,
        state: {
          email: values.email.trim(),
          inviteCodeApplied: result.inviteCodeApplied === true,
          inviteCodeWarning: result.inviteCodeWarning ?? null,
        },
      });
      return;
    }

    await login(values.email.trim(), values.senha);
    navigate("/dashboard", { replace: true });
  };

  return (
    <PageContainer>
      <Card className="ui-register-card">
        <div className="ui-grid ui-grid--2">
          <Link to="/login" className="ui-auth-tab ui-button--full">
            Login
          </Link>
          <Link to="/register" className="ui-auth-tab ui-auth-tab--active ui-button--full">
            Registrar
          </Link>
        </div>

        <PageHeader
          title="Registrar"
          subtitle="Visitor: acesso imediato. Designer/Lojista/Fabricante: confirmação de email e aprovação manual — ou código de convite para plano imediato após confirmar o email."
        />

        <RegisterUserForm submitLabel="Criar conta" onSubmit={handleSubmit} />
      </Card>
    </PageContainer>
  );
}
