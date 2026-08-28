import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  getUsersRemote,
  rejectUserRemote,
  type RemoteUserPublic,
} from "../../api/usersApi";
import UserApproveModal from "../../components/admin/users/UserApproveModal";
import UserDeleteConfirm from "../../components/admin/users/UserDeleteConfirm";
import UserFormModal from "../../components/admin/users/UserFormModal";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import PageContainer from "../../components/ui/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import Section from "../../components/ui/Section";
import { useToast } from "../../context/ToastContext";
import "../../components/ui/ui.css";

function shortId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function isPending(user: RemoteUserPublic): boolean {
  return user.accountStatus === "pending";
}

export default function UsersAdminPage() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<RemoteUserPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingUser, setEditingUser] = useState<RemoteUserPublic | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<RemoteUserPublic | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [approvingUser, setApprovingUser] = useState<RemoteUserPublic | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getUsersRemote();
      setUsers(list);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Falha ao carregar utilizadores", "error");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const pendingUsers = useMemo(() => users.filter(isPending), [users]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const base = users.filter((u) => !isPending(u));
    if (!q) return base;
    return base.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        (u.accountCategory ?? "").toLowerCase().includes(q)
    );
  }, [users, filter]);

  const openCreate = () => {
    setFormMode("create");
    setEditingUser(null);
    setFormOpen(true);
  };

  const openEdit = (u: RemoteUserPublic) => {
    setFormMode("edit");
    setEditingUser(u);
    setFormOpen(true);
  };

  const openDelete = (u: RemoteUserPublic) => {
    setDeletingUser(u);
    setDeleteOpen(true);
  };

  const openApprove = (u: RemoteUserPublic) => {
    setApprovingUser(u);
    setApproveOpen(true);
  };

  const handleReject = async (u: RemoteUserPublic) => {
    setRejectingId(u.id);
    try {
      await rejectUserRemote(u.id);
      showToast(`Conta ${u.username} rejeitada — permanece como Visitor aprovado.`, "info");
      await loadUsers();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Erro ao rejeitar", "error");
    } finally {
      setRejectingId(null);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Gestão de utilizadores"
        subtitle="Aprovação manual de contas, CRUD e partilha de projectos (sem e-mails nesta fase)."
      />

      <Card>
        <Section title={`Contas pendentes (${pendingUsers.length})`}>
          {loading ? (
            <p style={{ margin: 0, color: "var(--text-muted, #71717a)" }}>A carregar…</p>
          ) : pendingUsers.length === 0 ? (
            <p style={{ margin: 0 }}>Nenhuma conta pendente.</p>
          ) : (
            <div className="ui-table-wrapper">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Categoria</th>
                    <th>Pedido</th>
                    <th>Criado</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingUsers.map((u) => (
                    <tr key={u.id}>
                      <td>{u.username}</td>
                      <td>{u.email}</td>
                      <td>{u.accountCategory ?? "—"}</td>
                      <td>
                        <code>{u.requestedRole ?? "pro"}</code>
                      </td>
                      <td style={{ fontSize: 13, color: "var(--text-muted, #71717a)" }}>{u.createdAt || "—"}</td>
                      <td>
                        <div className="ui-inline-actions">
                          <Button type="button" variant="primary" onClick={() => openApprove(u)}>
                            Aprovar
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={rejectingId === u.id}
                            onClick={() => void handleReject(u)}
                          >
                            {rejectingId === u.id ? "A rejeitar…" : "Rejeitar"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title="Filtro">
          <Input
            label="Pesquisar utilizadores aprovados"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            disabled={loading}
          />
        </Section>

        <Section title="Ações">
          <div className="ui-inline-actions">
            <Button type="button" variant="primary" disabled={loading} onClick={openCreate}>
              Criar utilizador
            </Button>
            <Link to="/admin/project-shares">
              <Button type="button" variant="outline">
                Partilhas de projectos
              </Button>
            </Link>
          </div>
        </Section>

        <Section title="Utilizadores aprovados">
          {loading ? (
            <p style={{ margin: 0, color: "var(--text-muted, #71717a)" }}>A carregar…</p>
          ) : filtered.length === 0 ? (
            <p style={{ margin: 0 }}>Nenhum utilizador encontrado.</p>
          ) : (
            <div className="ui-table-wrapper">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Estado</th>
                    <th>Criado</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.id}>
                      <td title={u.id}>
                        <code style={{ fontSize: 12 }}>{shortId(u.id)}</code>
                      </td>
                      <td>{u.username}</td>
                      <td>{u.email}</td>
                      <td>
                        <code>{u.effectiveRole ?? u.role}</code>
                      </td>
                      <td>{u.accountStatus ?? "approved"}</td>
                      <td style={{ fontSize: 13, color: "var(--text-muted, #71717a)" }}>{u.createdAt || "—"}</td>
                      <td>
                        <div className="ui-inline-actions">
                          <Button type="button" variant="outline" onClick={() => openEdit(u)}>
                            Editar
                          </Button>
                          <Button type="button" variant="danger" onClick={() => openDelete(u)}>
                            Remover
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <p style={{ marginBottom: 0, marginTop: 20 }}>
          <Link to="/me" style={{ fontWeight: 600 }}>
            Voltar ao Me
          </Link>
        </p>
      </Card>

      <UserApproveModal
        open={approveOpen}
        user={approvingUser}
        onClose={() => {
          setApproveOpen(false);
          setApprovingUser(null);
        }}
        onSaved={() => void loadUsers()}
        onError={(msg) => showToast(msg, "error")}
        onSuccess={(msg) => showToast(msg, "info")}
      />

      <UserFormModal
        open={formOpen}
        mode={formMode}
        user={editingUser}
        onClose={() => {
          setFormOpen(false);
          setEditingUser(null);
        }}
        onSaved={() => void loadUsers()}
        onError={(msg) => showToast(msg, "error")}
        onSuccess={(msg) => showToast(msg, "info")}
      />

      <UserDeleteConfirm
        open={deleteOpen}
        user={deletingUser}
        onClose={() => {
          setDeleteOpen(false);
          setDeletingUser(null);
        }}
        onDeleted={() => void loadUsers()}
        onError={(msg) => showToast(msg, "error")}
        onSuccess={(msg) => showToast(msg, "info")}
      />
    </PageContainer>
  );
}
