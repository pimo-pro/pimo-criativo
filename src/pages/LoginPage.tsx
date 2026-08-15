import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/useAuth";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import FormGroup from "../components/ui/FormGroup";
import Input from "../components/ui/Input";
import PageContainer from "../components/ui/PageContainer";
import Section from "../components/ui/Section";
import { isLocalAuthSession } from "../local-auth";
import "../components/ui/ui.css";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const [email, setEmail] = useState("admin@pimo.local");
  const [password, setPassword] = useState("admin123");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated()) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(isLocalAuthSession() ? "/industrial/pimo-drill" : "/dashboard", {
        replace: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no login");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageContainer>
      <div className="ui-auth-page">
        <Card className="ui-card--max-640">
          <div className="ui-auth-card">
            <div className="ui-grid ui-grid--2">
              <Link to="/login" className="ui-auth-tab ui-auth-tab--active ui-button--full">
                Login
              </Link>
              <Link to="/register" className="ui-auth-tab ui-button--full">
                Registrar
              </Link>
            </div>

            <Section title="Acesso por email e senha">
              <form onSubmit={handleSubmit} className="ui-form-group">
                <FormGroup>
                  <Input
                    type="text"
                    label="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </FormGroup>
                <FormGroup>
                  <label className="ui-form-group" style={{ display: "block", width: "100%" }}>
                    <span className="ui-input__label">Password</span>
                    <div style={{ position: "relative", width: "100%" }}>
                      <input
                        type={showPassword ? "text" : "password"}
                        className="ui-input"
                        style={{
                          width: "100%",
                          boxSizing: "border-box",
                          paddingRight: "2.75rem",
                        }}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        className="ui-password-toggle"
                        aria-label={showPassword ? "Ocultar password" : "Mostrar password"}
                        aria-pressed={showPassword}
                        onClick={() => setShowPassword((v) => !v)}
                        style={{
                          position: "absolute",
                          right: "0.35rem",
                          top: "50%",
                          transform: "translateY(-50%)",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "2.25rem",
                          height: "2.25rem",
                          padding: 0,
                          border: "none",
                          borderRadius: "var(--ui-radius-sm, 6px)",
                          background: "transparent",
                          color: "var(--text-muted, #666)",
                          cursor: "pointer",
                        }}
                      >
                        {showPassword ? (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                          >
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                          >
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </label>
                </FormGroup>
                <div className="ui-form-group ui-auth-divider">
                  {error ? <p className="ui-text-danger">{error}</p> : null}
                  <Button type="submit" variant="primary" disabled={submitting}>
                    {submitting ? "Entrando..." : "Entrar"}
                  </Button>
                  <FormGroup className="ui-auth-divider">
                    <Link to="/forgot-password" className="ui-link ui-link--primary">
                      Esqueci minha senha
                    </Link>
                  </FormGroup>
                </div>
              </form>
            </Section>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}
