import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { verifyEmailRemote } from "../api/authApi";
import Card from "../components/ui/Card";
import Loader from "../components/ui/Loader";
import PageContainer from "../components/ui/PageContainer";
import PageHeader from "../components/ui/PageHeader";
import "../components/ui/ui.css";

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = (params.get("token") ?? "").trim();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Link inválido (token em falta).");
      setLoading(false);
      return;
    }
    verifyEmailRemote(token)
      .then((res) => setMessage(res.message))
      .catch((e) => setError(e instanceof Error ? e.message : "Falha ao confirmar email"))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <PageContainer>
      <Card className="ui-register-card">
        <PageHeader title="Confirmação de email" />
        {loading ? (
          <Loader label="A confirmar…" />
        ) : error ? (
          <p className="ui-text-danger" style={{ margin: 0 }}>
            {error}
          </p>
        ) : (
          <p style={{ margin: 0 }}>{message ?? "Email confirmado."}</p>
        )}
        {!loading ? (
          <p style={{ marginTop: 20, marginBottom: 0 }}>
            <Link to="/login" style={{ fontWeight: 600 }}>
              Ir para Login
            </Link>
          </p>
        ) : null}
      </Card>
    </PageContainer>
  );
}
