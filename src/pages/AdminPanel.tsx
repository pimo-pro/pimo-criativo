import { Suspense, lazy, useState } from "react";
import { Icon } from "@/components/icons";
import { IconGallery } from "@/components/icons";
import TemplatesManager from "../components/admin/TemplatesManager";
import RulesManager from "../components/admin/RulesManager";
import FileManager from "../components/admin/FileManager";
import RulesAdminPage from "../components/admin/RulesAdminPage";
import RulesProfilesPage from "../components/admin/RulesProfilesPage";
import DeployAdminPage from "../components/admin/DeployAdminPage";
import ComponentTypesAdminPage from "../components/admin/ComponentTypesAdminPage";
import FerragensAdminPage from "../components/admin/FerragensAdminPage";
import SystemSettingsBase from "../components/admin/SystemSettingsBase";
import DrawerRulesAdminPage from "../components/admin/DrawerRulesAdminPage";
import DrawerSystemUnifiedAdminPage from "../components/admin/DrawerSystemUnifiedAdminPage";
import { DivSepRulesAdminPage } from "../admin/rules/divSepRules/DivSepRulesAdminPage";
import { InvariantRulesAdminPage } from "../admin/invariants/InvariantRulesAdminPage";
import { DoorRulesAdminPage } from "../admin/rules/doorRules/DoorRulesAdminPage";
import AdminRulesPage from "../components/admin/AdminRulesPage";
import LabelConfigPage from "../components/admin/LabelConfigPage";
import McDimensionsAdminPage from "../components/admin/McDimensionsAdminPage";
import IndustrialSectionsAdminPage from "../components/admin/IndustrialSectionsAdminPage";
import SavedProjectsAdminPage from "../components/admin/SavedProjectsAdminPage";
import ThemeTemplatesAdminPage from "../components/admin/ThemeTemplatesAdminPage";
import GestaoMateriaisPage from "./admin/materials/GestaoMateriaisPage";
import FinanceiroAdminSettings from "./admin/FinanceiroAdminSettings";
import OrcamentosAdminSettings from "./admin/OrcamentosAdminSettings";
import DeployInfoPage from "./admin/DeployInfoPage";
import EmailStatusPage from "./admin/EmailStatusPage";
import { useAuth } from "../auth/useAuth";
import { hasFullAccess } from "../auth/rbac";

const HubDocumentacaoInterna = lazy(() => import("./documentacao/HubDocumentacaoInterna"));

type AdminTab =
  | "Gestão de Materiais"
  | "Ferragens"
  | "Templates"
  | "Configuração de Regras"
  | "Sistema de Regras"
  | "Perfis de Regras"
  | "Component Types"
  | "Gestor de Ficheiros"
  | "Deploy"
  | "Project Progress"
  | "Painel Referência"
  | "System Settings"
  | "Regras das Gavetas"
  | "Configurações das Gavetas (Sistema Unificado)"
  | "DIV/SEP Rules"
  | "Invariant Rules"
  | "Regras da Porta"
  | "Configuração de Etiquetas (v5)"
  | "Dimensões Técnicas (MC Overlay)"
  | "Projetos Salvos"
  | "Secções Industriais (Viewer)"
  | "Temas (Aparência)"
  | "Orçamentos"
  | "Financeiro (ADM / Montagem / Portes)"
  | "Deploy Info"
  | "Estado do email"
  | "icons";

type AdminMenuEntry =
  | { type: "group"; label: string }
  | { type: "item"; id: AdminTab; label: string; badge?: string; disabled?: boolean; adminOnly?: boolean };

const ADMIN_ACTIVE_TAB_STORAGE_KEY = "pimo_admin_active_tab";
const DEFAULT_ADMIN_TAB: AdminTab = "Gestão de Materiais";

const adminMenu: AdminMenuEntry[] = [
  { type: "group", label: "Produtos" },
  {
    type: "item",
    id: "Configurações das Gavetas (Sistema Unificado)",
    label: "Configurações das Gavetas (Sistema Unificado)",
  },
  { type: "item", id: "DIV/SEP Rules", label: "DIV/SEP Rules" },
  { type: "item", id: "Invariant Rules", label: "Invariant Rules" },
  { type: "item", id: "Gestão de Materiais", label: "Gestão de Materiais" },
  { type: "item", id: "Ferragens", label: "Ferragens" },
  { type: "item", id: "Regras da Porta", label: "Regras da Porta" },
  { type: "item", id: "Regras das Gavetas", label: "Regras das Gavetas" },
  {
    type: "item",
    id: "Configuração de Etiquetas (v5)",
    label: "Configuração de Etiquetas (v5)",
    adminOnly: true,
  },
  { type: "group", label: "Configuração" },
  { type: "item", id: "Component Types", label: "Component Types" },
  { type: "item", id: "Configuração de Regras", label: "Configuração de Regras" },
  { type: "item", id: "Sistema de Regras", label: "Sistema de Regras (Rules System)" },
  { type: "item", id: "Perfis de Regras", label: "Perfis de Regras" },
  { type: "group", label: "Catálogo / Modelos" },
  { type: "item", id: "Templates", label: "Templates" },
  { type: "group", label: "Operações / Diagnóstico" },
  { type: "item", id: "Gestor de Ficheiros", label: "Gestor de Ficheiros" },
  { type: "item", id: "Deploy", label: "Deploy", badge: "Experimental" },
  { type: "item", id: "System Settings", label: "System Settings" },
  { type: "item", id: "Dimensões Técnicas (MC Overlay)", label: "Dimensões Técnicas (MC Overlay)", adminOnly: true },
  { type: "item", id: "Projetos Salvos", label: "Projetos Salvos" },
  { type: "item", id: "Secções Industriais (Viewer)", label: "Secções Industriais (Viewer)" },
  { type: "item", id: "Project Progress", label: "Project Progress" },
  { type: "item", id: "Painel Referência", label: "Painel Referência" },
  { type: "group", label: "Sistema" },
  { type: "item", id: "Temas (Aparência)", label: "Temas (Aparência)" },
  {
    type: "item",
    id: "Financeiro (ADM / Montagem / Portes)",
    label: "Financeiro (ADM / Montagem / Portes)",
    adminOnly: true,
  },
  { type: "item", id: "Orçamentos", label: "Orçamentos", adminOnly: true },
  { type: "item", id: "Deploy Info", label: "Deploy Info", adminOnly: true },
  { type: "item", id: "Estado do email", label: "Estado do email", adminOnly: true },
  { type: "item", id: "icons", label: "Biblioteca de Ícones" },
];

const menuIconByTab: Partial<Record<AdminTab, Parameters<typeof Icon>[0]["name"]>> = {
  "Gestão de Materiais": "adminChecklist",
  "Ferragens": "adminScrew",
  "Component Types": "adminPuzzle",
  "Configuração de Regras": "adminSettings",
  "Sistema de Regras": "adminTools",
  "Perfis de Regras": "adminBook",
  "Templates": "adminFolder",
  "Gestor de Ficheiros": "adminArchive",
  "Deploy": "adminLab",
  "System Settings": "adminTools",
  "Regras das Gavetas": "adminRuler",
  "Configurações das Gavetas (Sistema Unificado)": "adminRuler",
  "DIV/SEP Rules": "adminRuler",
  "Invariant Rules": "alertWarning",
  "Regras da Porta": "adminRuler",
  "Configuração de Etiquetas (v5)": "adminTag",
  "Dimensões Técnicas (MC Overlay)": "adminRuler",
  "Projetos Salvos": "adminSave",
  "Secções Industriais (Viewer)": "adminChecklist",
  "Financeiro (ADM / Montagem / Portes)": "adminTools",
  "Project Progress": "adminChart",
  "Painel Referência": "adminDocs",
  "Temas (Aparência)": "adminTools",
  Orçamentos: "adminTools",
  "Deploy Info": "adminLab",
  "Estado do email": "adminLab",
  icons: "projects",
};

function getAdminVisibleTabs(canSeeAdminOnlyMenus: boolean): Set<AdminTab> {
  return new Set(
    adminMenu
      .filter(
        (entry): entry is Extract<AdminMenuEntry, { type: "item" }> =>
          entry.type === "item" && (!entry.adminOnly || canSeeAdminOnlyMenus)
      )
      .map((entry) => entry.id)
  );
}

// Módulos planeados (futuro): manter fora do menu até fluxo real.
// Dashboard, Pricing e Users permanecem ocultos por enquanto.
const ADMIN_PLANNED_HIDDEN_MODULES = ["Dashboard", "Pricing", "Users"] as const;
void ADMIN_PLANNED_HIDDEN_MODULES;

export default function AdminPanel() {
  const { hasPermission } = useAuth();
  const canSeeAdminOnlyMenus = hasFullAccess(hasPermission);
  const adminVisibleTabs = getAdminVisibleTabs(canSeeAdminOnlyMenus);

  const [active, setActive] = useState<AdminTab>(() => {
    const saved = localStorage.getItem(ADMIN_ACTIVE_TAB_STORAGE_KEY) as AdminTab | string | null;
    if (saved === "Etiqueta / QR N") {
      const migrated: AdminTab = "Configuração de Etiquetas (v5)";
      return adminVisibleTabs.has(migrated) ? migrated : DEFAULT_ADMIN_TAB;
    }
    return saved && adminVisibleTabs.has(saved as AdminTab) ? (saved as AdminTab) : DEFAULT_ADMIN_TAB;
  });

  const setActiveTab = (next: AdminTab) => {
    setActive(next);
    localStorage.setItem(ADMIN_ACTIVE_TAB_STORAGE_KEY, next);
  };

  return (
    <main className="admin-panel-root">
      <aside className="admin-panel-sidebar">
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--admin-text)", marginBottom: 8 }}>
          Admin Panel
        </div>
        {adminMenu
          .filter((entry) => entry.type === "group" || !entry.adminOnly || canSeeAdminOnlyMenus)
          .map((entry, index) => {
          if (entry.type === "group") {
            return (
              <div
                key={`group-${entry.label}-${index}`}
                style={{
                  marginTop: index === 0 ? 4 : 10,
                  marginBottom: 4,
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                  color: "var(--text-muted)",
                  fontWeight: 700,
                }}
              >
                {entry.label}
              </div>
            );
          }

          const isActive = active === entry.id;
          const isDisabled = entry.disabled === true;
          return (
            <button
              key={entry.id}
              onClick={() => !isDisabled && setActiveTab(entry.id)}
              className={`admin-panel-nav-btn${isActive ? " admin-panel-nav-btn--active" : ""}`}
              style={{
                cursor: isDisabled ? "not-allowed" : "pointer",
                opacity: isDisabled ? 0.4 : 1,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span aria-hidden>
                  {menuIconByTab[entry.id] ? <Icon name={menuIconByTab[entry.id]} size={16} aria-hidden /> : "•"}
                </span>
                <span>{entry.label}</span>
              </span>
              {entry.badge ? (
                <span
                  style={{
                    fontSize: 10,
                    padding: "2px 6px",
                    borderRadius: 999,
                    background: "rgba(245, 158, 11, 0.2)",
                    border: "1px solid rgba(245, 158, 11, 0.35)",
                    color: "var(--text-main)",
                  }}
                >
                  {entry.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </aside>

      <section className="admin-panel-content">
        <div className="admin-panel-card">
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--admin-text)", marginBottom: 12 }}>
            {active}
          </div>

          {active === "Gestão de Materiais" ? (
            <GestaoMateriaisPage />
          ) : active === "Ferragens" ? (
            <FerragensAdminPage />
          ) : active === "Templates" ? (
            <TemplatesManager />
          ) : active === "Configuração de Regras" ? (
            <div className="stack" style={{ gap: 20 }}>
              <RulesAdminPage />
              <RulesManager />
            </div>
          ) : active === "Sistema de Regras" ? (
            <AdminRulesPage />
          ) : active === "Perfis de Regras" ? (
            <RulesProfilesPage />
          ) : active === "Component Types" ? (
            <ComponentTypesAdminPage />
          ) : active === "Gestor de Ficheiros" ? (
            <FileManager />
          ) : active === "Deploy" ? (
            <DeployAdminPage />
          ) : active === "System Settings" ? (
            <SystemSettingsBase />
          ) : active === "Regras das Gavetas" ? (
            <DrawerRulesAdminPage />
          ) : active === "Configurações das Gavetas (Sistema Unificado)" ? (
            <DrawerSystemUnifiedAdminPage />
          ) : active === "DIV/SEP Rules" ? (
            <DivSepRulesAdminPage />
          ) : active === "Invariant Rules" ? (
            <InvariantRulesAdminPage />
          ) : active === "Regras da Porta" ? (
            <DoorRulesAdminPage />
          ) : active === "Project Progress" ? (
            <Suspense fallback={<div style={{ fontSize: 12, color: "var(--text-muted)" }}>Carregando…</div>}>
              <HubDocumentacaoInterna embedded defaultSection="progresso" />
            </Suspense>
          ) : active === "Configuração de Etiquetas (v5)" ? (
            canSeeAdminOnlyMenus ? (
              <LabelConfigPage />
            ) : (
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Acesso restrito a administradores.
              </div>
            )
          ) : active === "Dimensões Técnicas (MC Overlay)" ? (
            canSeeAdminOnlyMenus ? (
              <McDimensionsAdminPage />
            ) : (
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Acesso restrito a administradores.
              </div>
            )
          ) : active === "Projetos Salvos" ? (
            <SavedProjectsAdminPage />
          ) : active === "Secções Industriais (Viewer)" ? (
            <IndustrialSectionsAdminPage />
          ) : active === "Financeiro (ADM / Montagem / Portes)" ? (
            canSeeAdminOnlyMenus ? (
              <FinanceiroAdminSettings />
            ) : (
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Acesso restrito a administradores.
              </div>
            )
          ) : active === "Temas (Aparência)" ? (
            <ThemeTemplatesAdminPage />
          ) : active === "Orçamentos" ? (
            canSeeAdminOnlyMenus ? (
              <OrcamentosAdminSettings />
            ) : (
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Acesso restrito a administradores.
              </div>
            )
          ) : active === "Deploy Info" ? (
            canSeeAdminOnlyMenus ? (
              <DeployInfoPage />
            ) : (
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Acesso restrito a administradores.
              </div>
            )
          ) : active === "Estado do email" ? (
            canSeeAdminOnlyMenus ? (
              <EmailStatusPage />
            ) : (
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Acesso restrito a administradores.
              </div>
            )
          ) : active === "Painel Referência" ? (
            <Suspense fallback={<div style={{ fontSize: 12, color: "var(--text-muted)" }}>Carregando…</div>}>
              <HubDocumentacaoInterna embedded defaultSection="refs" />
            </Suspense>
          ) : active === "icons" ? (
            <IconGallery />
          ) : (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Módulo em construção.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
