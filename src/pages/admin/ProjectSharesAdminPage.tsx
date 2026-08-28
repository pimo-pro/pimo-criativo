import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import {
  createProjectShareRemote,
  deleteProjectShareRemote,
  getProjectSharesRemote,
  type ProjectShareRecord,
} from "../../api/projectSharesApi";
import { getUsersRemote, type RemoteUserPublic } from "../../api/usersApi";
import { apiClient } from "../../api/apiClient";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import PageContainer from "../../components/ui/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import Section from "../../components/ui/Section";
import { useToast } from "../../context/ToastContext";
import "../../components/ui/ui.css";

type ProjectOption = { id: string; name: string; ownerName?: string };

export default function ProjectSharesAdminPage() {
  const { showToast } = useToast();
  const [shares, setShares] = useState<ProjectShareRecord[]>([]);
  const [users, setUsers] = useState<RemoteUserPublic[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState("");
  const [userId, setUserId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [shareList, userList, projectsRes] = await Promise.all([
        getProjectSharesRemote(),
        getUsersRemote(),
        apiClient.get<{ status: string; projects?: Array<{ id: string; name: string; ownerName?: string }> }>(
          "/projects?scope=all"
        ),
      ]);
      setShares(shareList);
      setUsers(userList.filter((u) => u.accountStatus !== "pending"));
      const rows = projectsRes.data?.projects ?? [];
      setProjects(
        rows.map((p) => ({
          id: p.id,
          name: p.name,
          ownerName: p.ownerName,
        }))
      );
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Falha ao carregar dados", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const userLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users) {
      map.set(u.id, `${u.username} (${u.role})`);
    }
    return map;
  }, [users]);

  const projectLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) {
      map.set(p.id, `${p.name}${p.ownerName ? ` — ${p.ownerName}` : ""}`);
    }
    return map;
  }, [projects]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!projectId || !userId) {
      showToast("Seleccione projecto e utilizador", "error");
      return;
    }
    setSubmitting(true);
    try {
      await createProjectShareRemote({ projectId, userId });
      showToast("Partilha criada.", "info");
      setProjectId("");
      setUserId("");
      await loadAll();
    } catch (er) {
      showToast(er instanceof Error ? er.message : "Erro ao criar partilha", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProjectShareRemote(id);
      showToast("Partilha removida.", "info");
      await loadAll();
    } catch (er) {
      showToast(er instanceof Error ? er.message : "Erro ao remover", "error");
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Partilhas de projectos"
        subtitle="Ligar um projecto específico a um utilizador aprovado (ver + editar)."
      />

      <Card>
        <Section title="Nova partilha">
          <form onSubmit={(e) => void handleCreate(e)}>
            <div className="ui-grid ui-grid--2" style={{ gap: 12 }}>
              <label className="ui-form-group">
                <span className="ui-input__label">Projecto</span>
                <select
                  className="ui-input"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  disabled={loading || submitting}
                  style={{ width: "100%", padding: "10px 12px" }}
                >
                  <option value="">— Seleccionar —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {projectLabelById.get(p.id) ?? p.id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ui-form-group">
                <span className="ui-input__label">Utilizador (aprovado)</span>
                <select
                  className="ui-input"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  disabled={loading || submitting}
                  style={{ width: "100%", padding: "10px 12px" }}
                >
                  <option value="">— Seleccionar —</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {userLabelById.get(u.id) ?? u.username}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <Button type="submit" variant="primary" disabled={loading || submitting} style={{ marginTop: 12 }}>
              {submitting ? "A criar…" : "Criar partilha"}
            </Button>
          </form>
        </Section>

        <Section title={`Partilhas activas (${shares.length})`}>
          {loading ? (
            <p style={{ margin: 0 }}>A carregar…</p>
          ) : shares.length === 0 ? (
            <p style={{ margin: 0 }}>Nenhuma partilha.</p>
          ) : (
            <div className="ui-table-wrapper">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Projecto</th>
                    <th>Utilizador</th>
                    <th>Criado</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {shares.map((s) => (
                    <tr key={s.id}>
                      <td>{projectLabelById.get(s.projectId) ?? s.projectId}</td>
                      <td>{userLabelById.get(s.userId) ?? s.userId}</td>
                      <td style={{ fontSize: 13, color: "var(--text-muted, #71717a)" }}>{s.createdAt || "—"}</td>
                      <td>
                        <Button type="button" variant="danger" onClick={() => void handleDelete(s.id)}>
                          Remover
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <p style={{ marginBottom: 0, marginTop: 20 }}>
          <Link to="/admin/users" style={{ fontWeight: 600 }}>
            Voltar a utilizadores
          </Link>
        </p>
      </Card>
    </PageContainer>
  );
}
