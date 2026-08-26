import { Link, Navigate, useNavigate } from "react-router-dom";

import { createAccountRemote } from "../api/authApi";
import { useAuth } from "../auth/useAuth";
import RegisterUserForm, {
  mapAccountCategoryToPublicRole,
  type RegisterFormValues,
} from "../components/admin/RegisterUserForm";
import { initialInviteCodes } from "../components/admin/inviteCodesMock";
import Card from "../components/ui/Card";
import PageHeader from "../components/ui/PageHeader";
import PageContainer from "../components/ui/PageContainer";
import "../components/ui/ui.css";

export default function RegisterPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();

  if (isAuthenticated()) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (values: RegisterFormValues) => {
    await createAccountRemote({
      username: values.username.trim(),
      email: values.email.trim(),
      password: values.senha,
      role: mapAccountCategoryToPublicRole(values.accountCategory),
      accountCategory: values.accountCategory,
    });
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

        <PageHeader title="Registrar" subtitle="Crie seu acesso e configure seu perfil inicial." />

        <RegisterUserForm
          submitLabel="Criar conta"
          onSubmit={handleSubmit}
          inviteCodes={initialInviteCodes}
        />
      </Card>
    </PageContainer>
  );
}
