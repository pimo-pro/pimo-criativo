import Header from "./components/layout/header/Header";
import LeftToolbar from "./components/layout/left-toolbar/LeftToolbar";
import LeftPanel from "./components/layout/left-panel/LeftPanel";
import ToolbarModals from "./components/layout/ToolbarModals";
import Workspace from "./components/layout/workspace/Workspace";
import Footer from "./components/layout/footer/Footer";
import BottomInfoToolbar from "./components/layout/bottom-info-toolbar/BottomInfoToolbar";
import BottomInfoPanelsOverlay from "./components/layout/bottom-info-toolbar/BottomInfoPanelsOverlay";
import { BottomInfoProvider } from "./context/BottomInfoContext";
import { PimoViewerProvider } from "./context/PimoViewerContext";
import { ProjectProvider } from "./context/ProjectProvider";
import { WorkspaceUndoRedoRegistryProvider } from "./context/WorkspaceUndoRedoRegistryContext";
import { MaterialProvider } from "./context/materialContext";
import { ToolbarModalProvider } from "./context/ToolbarModalContext";
import { ToastProvider } from "./context/ToastContext";
import { PendingWorkspaceMergeEffect } from "./context/PendingWorkspaceMergeEffect";
import { PendingSingleLoadEffect } from "./workspace/PendingSingleLoadEffect";
import { PendingImportedProjectEffect } from "./workspace/PendingImportedProjectEffect";
import MateriaisSsotBootstrap from "./core/catalog/MateriaisSsotBootstrap";
import { SettingsProvider } from "./context/SettingsContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ThemeTemplateProvider } from "./context/ThemeTemplateContext";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { DEFAULT_VIEWER_OPTIONS, VIEWER_BACKGROUND } from "./constants/viewerOptions";
import { useUiStore } from "./stores/uiStore";
import HelpPage from "./pages/HelpPage";
import LandingPage from "./pages/LandingPage";
import UserProjectsPage from "./pages/UserProjectsPage";
import SettingsPage from "./pages/SettingsPage";
import ProtectedRoute from "./components/ProtectedRoute";
import Navbar from "./components/Navbar";
import TopBarTrak from "./components/TopBarTrak";
import { resolveAppChrome } from "./chrome/resolveAppChrome";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import MePage from "./pages/MePage";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectsViewerPage from "./pages/ProjectsViewerPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import UsersAdminPage from "./pages/admin/UsersAdminPage";
import ManageRolesPage from "./pages/admin/ManageRolesPage";
import ManagePermissionsPage from "./pages/admin/ManagePermissionsPage";
import GlobalSettingsAdminPage from "./pages/admin/GlobalSettingsAdminPage";
import DeployInfoPage from "./pages/admin/DeployInfoPage";
import { canAccessAdminPanel, canOpenProjectsShowroom, hasFullAccess } from "./auth/rbac";
import { useAuth } from "./auth/useAuth";
import Card from "./components/ui/Card";
import PageContainer from "./components/ui/PageContainer";
import { IconGallery } from "@/components/icons";
import "./components/ui/ui.css";
import type { V3Piece } from "./nesting-v3/nestingV3Types";
import IndustrialHomePage from "./app/industrial/index";
import IndustrialWorkOrdersPage from "./app/industrial/work-orders/index";
import WorkOrderOrProjectOrderPage from "./app/industrial/work-orders/WorkOrderOrProjectOrderPage";
import StationExecutionPage from "./app/industrial/work-orders/StationExecutionPage";
import StationProjectPage from "./app/industrial/work-orders/StationProjectPage";
import WarehouseWorkOrderPage from "./app/industrial/work-orders/warehouse";
import NestingWorkOrderPage from "./app/industrial/work-orders/nesting";
import DrillWorkOrderPage from "./app/industrial/work-orders/drill";
import OrlarWorkOrderPage from "./app/industrial/work-orders/orlar";
import MontagemWorkOrderPage from "./app/industrial/work-orders/montagem";
import EmbalagemWorkOrderPage from "./app/industrial/work-orders/embalagem";
import IndustrialTrackingPage from "./app/industrial/tracking/index";
import IndustrialEventsPage from "./app/industrial/events/index";
import IndustrialQualityPage from "./app/industrial/quality/index";
import IndustrialReworkPage from "./app/industrial/rework/index";
import IndustrialTimeTrackingPage from "./app/industrial/time-tracking/index";
import IndustrialOperationsPage from "./app/industrial/operations/index";
import IndustrialCncPage from "./app/industrial/operations/cnc/index";
import IndustrialNestingPage from "./app/industrial/operations/nesting/index";
import IndustrialDrillPage from "./app/industrial/operations/drill/index";
import IndustrialOrlarPage from "./app/industrial/operations/orlar/index";
import IndustrialMontagemPage from "./app/industrial/operations/montagem/index";
import IndustrialEmbalagemPage from "./app/industrial/operations/embalagem/index";
import IndustrialAdminSettingsPage from "./app/admin/settings/industrial/index";
import RealtimeAlertsAdminPage from "./app/admin/system-settings/industrial/realtime-alerts";
import {
  INDUSTRIAL_ADMIN_MODELS_PATH,
  IndustrialModelsPage,
  PIPRO_WORKSPACE_PATH,
} from "./ui/routes/industrialAdminRoutes";
import { PIPRO_MODELS_PUBLIC_PATH, PIPRO_WORKSPACE_V2_PATH } from "./ui/routes/piproPaths";
import { AdminSidebar } from "./ui/layout/AdminSidebar";
import PieceMainView from "./app/industrial/piece/PieceMainView";
import IndustrialSupervisorDashboardPage from "./app/industrial/supervisor/index";
import SupervisorProjectPage from "./app/industrial/supervisor/SupervisorProjectPage";
import IndustrialOperadorPage from "./app/industrial/operador/index";
import IndustrialReleaseNotesPage from "./app/industrial/release-notes/IndustrialReleaseNotesPage";
import RelatorioFinalRoute from "./pages/relatorio-final/RelatorioFinalRoute";
import ProjetosIndexPage from "./app/PROJETOS/page";
import ProjetosProjectPage from "./app/PROJETOS/[project]/page";
import ProjetosBoxPage from "./app/PROJETOS/[project]/[box]/page";
import ProjetosPiecePage from "./app/PROJETOS/[project]/[box]/[piece]/page";
import ProjetosAnaliseIndexPage from "./app/PROJETOS/[project]/analise/page";
import ProjetosAnaliseDocPage from "./app/PROJETOS/[project]/analise/[docId]/page";
import { ajudaRoutes } from "./routes/ajudaRoutes";

/** Lazy: evita ciclos TDZ (routes ↔ páginas) e mantém motor/viewer fora do chunk inicial. */
const PiproModelsPage = lazy(() => import("./ui/pipro/PiproModelsPage"));
const WorkspaceDesignModePage = lazy(() => import("./ui/pipro/WorkspaceDesignModePage"));
const PiproDesignShellPage = lazy(() => import("./ui/pipro/PiproDesignShellPage"));
const Documentacao = lazy(() => import("./pages/Documentacao"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const V4Page = lazy(() => import("./pages/V4Page"));
const NestingV3RoutePage = lazy(() => import("./app/nesting-v3/NestingV3RoutePage"));
const DevPimoTest = import.meta.env.DEV
  ? lazy(() => import("./__dev__/DevPimoTest"))
  : null;

function LegacyApp() {
  const [leftOpen, setLeftOpen] = useState(true);
  const leftPanelTab = useUiStore((state) => state.selectedTool);
  const setLeftPanelTab = useUiStore((state) => state.setSelectedTool);
  const clearSelection = useUiStore((state) => state.clearSelection);
  const photoModePanelOpen = useUiStore((state) => state.photoModePanelOpen);
  const setPhotoModePanelOpen = useUiStore((state) => state.setPhotoModePanelOpen);
  const [leftWidth, setLeftWidth] = useState(260);
  const resizeState = useRef({
    active: false,
    startX: 0,
    startWidth: 260,
  });

  const clampLeftWidth = (value: number) => Math.min(420, Math.max(220, value));

  const handleResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!leftOpen) return;
    resizeState.current = {
      active: true,
      startX: event.clientX,
      startWidth: leftWidth,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleResizeMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!resizeState.current.active) return;
    const delta = event.clientX - resizeState.current.startX;
    setLeftWidth(clampLeftWidth(resizeState.current.startWidth + delta));
  };

  const handleResizeEnd = () => {
    resizeState.current.active = false;
  };
  const [showSystemDocs, setShowSystemDocs] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showDevTest, setShowDevTest] = useState(false);
  const [showAjuda, setShowAjuda] = useState(false);
  const [showLanding, setShowLanding] = useState(false);
  const [showUserProjects, setShowUserProjects] = useState(false);
  const navigate = useNavigate();
  const viewerOptions = useMemo(() => DEFAULT_VIEWER_OPTIONS, []);
  const location = useLocation();

  const syncRoute = useCallback(() => {
    let pathname = window.location.pathname;

    // Fase 8 — redirects das rotas antigas → Hub /documentacao
    if (pathname === "/painel-referencia") {
      window.history.replaceState({}, "", "/documentacao#refs");
      pathname = "/documentacao";
    } else if (pathname === "/project-progress") {
      window.history.replaceState({}, "", "/documentacao#progresso");
      pathname = "/documentacao";
    }

    const isSystemDocs = pathname === "/documentacao";
    const isAdmin = pathname === "/admin";
    if (!import.meta.env.DEV && pathname === "/dev-test") {
      window.history.replaceState({}, "", "/");
    }
    const isDevTest = import.meta.env.DEV && pathname === "/dev-test";
    const isAjuda = pathname === "/ajuda";
    const isLanding = pathname === "/landing" || pathname === "/apresentacao";
    const isUserProjects = pathname === "/meus-projetos";
    setShowSystemDocs(isSystemDocs);
    setShowAdmin(isAdmin);
    setShowDevTest(isDevTest);
    setShowAjuda(isAjuda);
    setShowLanding(isLanding);
    setShowUserProjects(isUserProjects);
  }, []);

  useEffect(() => {
    syncRoute();
    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, [syncRoute]);

  useEffect(() => {
    syncRoute();
  }, [location.pathname, syncRoute]);

  const navigateToAjuda = () => {
    navigate("/ajuda");
  };

  const navigateToLanding = () => {
    window.history.pushState({}, "", "/apresentacao");
    setShowLanding(true);
    setShowAjuda(false);
    setShowSystemDocs(false);
    setShowAdmin(false);
    setShowDevTest(false);
    setShowUserProjects(false);
  };

  const navigateToUserProjects = () => {
    window.history.pushState({}, "", "/meus-projetos");
    setShowUserProjects(true);
    setShowAjuda(false);
    setShowSystemDocs(false);
    setShowAdmin(false);
    setShowDevTest(false);
    setShowLanding(false);
  };

  const navigateToNestingV3 = (payload?: { pieces?: V3Piece[]; projectId?: string; projectName?: string }) => {
    navigate("/nesting_v3", {
      state: {
        openNestingV3: true,
        pieces: payload?.pieces,
        projectId: payload?.projectId,
        projectName: payload?.projectName,
      },
    });
  };

  // Listen for Nesting V3 open event (dispatched from UnifiedTopToolbar)
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail : undefined;
      navigateToNestingV3(detail);
    };
    window.addEventListener("pimo:open-nesting-v3", handler);
    return () => window.removeEventListener("pimo:open-nesting-v3", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ProjectProvider>
      <WorkspaceUndoRedoRegistryProvider>
      <SettingsProvider>
        <MaterialProvider>
          <ToastProvider>
            <MateriaisSsotBootstrap />
            <PendingWorkspaceMergeEffect />
            <PendingSingleLoadEffect />
            <PendingImportedProjectEffect />
            <PimoViewerProvider>
            <div className="app-root">
        <Header />

        {/* MAIN AREA */}
        <div className="app-main">
          {showSystemDocs || showAdmin || showDevTest || showAjuda || showLanding || showUserProjects ? (
            <Suspense fallback={<div style={{ padding: 20, color: "var(--text-muted)" }}>Carregando…</div>}>
              {showSystemDocs ? (
                <Documentacao />
              ) : showAdmin ? (
                <AdminPanel />
              ) : showDevTest && DevPimoTest ? (
                <DevPimoTest />
              ) : showAjuda ? (
                <HelpPage />
              ) : showLanding ? (
                <LandingPage />
              ) : showUserProjects ? (
                <UserProjectsPage />
              ) : (
                <Documentacao />
              )}
            </Suspense>
          ) : (
            <BottomInfoProvider>
              <ToolbarModalProvider>
                <div
                  className="app-main-content-fixed"
                  style={{
                    flex: 1,
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      flex: 1,
                      minHeight: 0,
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <div className="app-panels" style={{ flex: 1, minHeight: 0 }}>
                      <div style={{ position: "relative", zIndex: 20 }}>
                        <LeftToolbar
                          selectedId={leftPanelTab}
                          onSelect={(id) => {
                            if (photoModePanelOpen) {
                              setPhotoModePanelOpen(false);
                            }
                            setLeftPanelTab(id);
                            clearSelection();
                            if (!leftOpen) setLeftOpen(true);
                          }}
                        />
                      </div>
                      <div
                        className="panel panel-shell panel-shell--side left-panel panel-shell-left"
                        style={{
                          width: leftOpen ? leftWidth : 0,
                          minWidth: leftOpen ? leftWidth : 0,
                          maxWidth: leftOpen ? leftWidth : 0,
                          overflow: "hidden",
                          transition: "width 0.2s ease",
                          position: "relative",
                        }}
                      >
                        <LeftPanel activeTab={leftPanelTab} />
                        {leftOpen && (
                          <div
                            className="panel-resizer"
                            onPointerDown={handleResizeStart}
                            onPointerMove={handleResizeMove}
                            onPointerUp={handleResizeEnd}
                            onPointerCancel={handleResizeEnd}
                          />
                        )}
                      </div>
                      <Workspace
                        viewerBackground={VIEWER_BACKGROUND}
                        viewerHeight="100%"
                        viewerOptions={viewerOptions}
                      />
                      <ToolbarModals />
                    </div>
                    <BottomInfoPanelsOverlay />
                  </div>
                  <BottomInfoToolbar />
                </div>
              </ToolbarModalProvider>
            </BottomInfoProvider>
          )}
        </div>

        <Footer
          onShowAjuda={navigateToAjuda}
          onShowUserProjects={navigateToUserProjects}
          onShowLanding={navigateToLanding}
        />

            </div>
            </PimoViewerProvider>
          </ToastProvider>
        </MaterialProvider>
      </SettingsProvider>
      </WorkspaceUndoRedoRegistryProvider>
    </ProjectProvider>
  );
}

function ProtectedLayout() {
  const { pathname } = useLocation();
  const chrome = resolveAppChrome(pathname);
  return (
    <ProtectedRoute>
      <ToastProvider>
        <SettingsProvider>
          {chrome.topBar === "trak" ? <TopBarTrak /> : null}
          {chrome.topBar === "navbar" ? <Navbar /> : null}
          <Outlet />
        </SettingsProvider>
      </ToastProvider>
    </ProtectedRoute>
  );
}

function AppChromeLayout() {
  return (
    <div className="ui-app-frame">
      <Header />
      <main className="ui-app-frame__content">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

function PieceAliasRedirect() {
  const { id } = useParams();
  if (!id) return <Navigate to="/industrial" replace />;
  return <Navigate to={`/industrial/piece/${id}`} replace />;
}

function PermissionRoute({
  children,
  check,
}: {
  children: ReactElement;
  check: (_hasPermission: (permission: string) => boolean) => boolean;
}) {
  const { hasPermission, loading } = useAuth();
  if (loading) {
    return (
      <PageContainer centered>
        <Card maxWidth={420}>
          <p style={{ margin: 0 }}>A carregar sessão…</p>
        </Card>
      </PageContainer>
    );
  }
  if (!check(hasPermission)) {
    return (
      <PageContainer centered>
        <Card maxWidth={480}>
          <p className="ui-text-danger" style={{ marginTop: 0 }}>
            Não tem permissão para aceder a esta área.
          </p>
          <p style={{ fontSize: 13, color: "var(--text-muted, #71717a)" }}>
            Se precisar de acesso, contacte um administrador.
          </p>
          <Link
            to="/dashboard"
            style={{ marginTop: 14, display: "inline-block", fontWeight: 600 }}
          >
            Voltar ao Dashboard
          </Link>
        </Card>
      </PageContainer>
    );
  }
  return children;
}

export default function App() {
  return (
    <ThemeProvider>
      <ThemeTemplateProvider>
      <Routes>
        <Route element={<AppChromeLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/definicoes"
            element={
              <ProjectProvider>
                <SettingsProvider>
                  <SettingsPage />
                </SettingsProvider>
              </ProjectProvider>
            }
          />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route
            path={PIPRO_MODELS_PUBLIC_PATH}
            element={
              <Suspense fallback={<PageContainer><Card>A carregar móveis…</Card></PageContainer>}>
                <PiproModelsPage />
              </Suspense>
            }
          />
          {ajudaRoutes.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
          <Route path="/pieces/:id" element={<PieceAliasRedirect />} />
          <Route path="/studio/piece/:id" element={<PieceAliasRedirect />} />
          <Route path="/PROJETOS" element={<ProjetosIndexPage />} />
          <Route path="/PROJETOS/:project/analise/:docId" element={<ProjetosAnaliseDocPage />} />
          <Route path="/PROJETOS/:project/analise" element={<ProjetosAnaliseIndexPage />} />
          <Route path="/PROJETOS/:project" element={<ProjetosProjectPage />} />
          <Route path="/PROJETOS/:project/:box" element={<ProjetosBoxPage />} />
          <Route path="/PROJETOS/:project/:box/:piece" element={<ProjetosPiecePage />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/me" element={<MePage />} />
            <Route
              path="/projects/viewer"
              element={
                <ProjectProvider>
                  <PermissionRoute check={canOpenProjectsShowroom}>
                    <ProjectsViewerPage />
                  </PermissionRoute>
                </ProjectProvider>
              }
            />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
            <Route
              path="/relatorio-final/:project"
              element={
                <Suspense fallback={<PageContainer><Card>A carregar relatorio...</Card></PageContainer>}>
                  <RelatorioFinalRoute />
                </Suspense>
              }
            />
            <Route
              path="/admin/users"
              element={
                <PermissionRoute check={hasFullAccess}>
                  <UsersAdminPage />
                </PermissionRoute>
              }
            />
            <Route
              path="/admin/roles"
              element={
                <PermissionRoute check={canAccessAdminPanel}>
                  <ManageRolesPage />
                </PermissionRoute>
              }
            />
            <Route
              path="/admin/permissions"
              element={
                <PermissionRoute check={canAccessAdminPanel}>
                  <ManagePermissionsPage />
                </PermissionRoute>
              }
            />
            <Route
              path="/admin/icons"
              element={
                <PermissionRoute check={canAccessAdminPanel}>
                  <IconGallery />
                </PermissionRoute>
              }
            />
            <Route
              path="/admin/global-settings"
              element={
                <PermissionRoute check={hasFullAccess}>
                  <GlobalSettingsAdminPage />
                </PermissionRoute>
              }
            />
            <Route
              path="/admin/system/deploy-info"
              element={
                <PermissionRoute check={canAccessAdminPanel}>
                  <DeployInfoPage />
                </PermissionRoute>
              }
            />
            <Route path="/nesting_v3" element={<NestingV3RoutePage />} />
            <Route path="/industrial/release-notes" element={<IndustrialReleaseNotesPage />} />
            <Route path="/industrial" element={<IndustrialHomePage />} />
            <Route path="/industrial/supervisor" element={<IndustrialSupervisorDashboardPage />} />
            <Route path="/industrial/supervisor/:project" element={<SupervisorProjectPage />} />
            <Route path="/industrial/operador" element={<IndustrialOperadorPage />} />
            <Route path="/industrial/work-orders" element={<IndustrialWorkOrdersPage />} />
            {/* Ordem: UUID → execução WO | slug → hub por projecto + anchors */}
            <Route
              path="/industrial/work-orders/order/:orderOrProject"
              element={<WorkOrderOrProjectOrderPage />}
            />
            {/* Estações com projecto (novo) — antes das rotas sem projecto */}
            <Route path="/industrial/work-orders/:station/:project" element={<StationProjectPage />} />
            {/* Legado sem projecto (transição) */}
            <Route path="/industrial/work-orders/warehouse" element={<WarehouseWorkOrderPage />} />
            <Route path="/industrial/work-orders/nesting" element={<NestingWorkOrderPage />} />
            <Route path="/industrial/work-orders/drill" element={<DrillWorkOrderPage />} />
            <Route path="/industrial/work-orders/orlar" element={<OrlarWorkOrderPage />} />
            <Route path="/industrial/work-orders/montagem" element={<MontagemWorkOrderPage />} />
            <Route path="/industrial/work-orders/embalagem" element={<EmbalagemWorkOrderPage />} />
            <Route path="/industrial/stations/:station" element={<StationExecutionPage />} />
            <Route path="/industrial/tracking" element={<IndustrialTrackingPage />} />
            <Route path="/industrial/events" element={<IndustrialEventsPage />} />
            <Route path="/industrial/quality" element={<IndustrialQualityPage />} />
            <Route path="/industrial/rework" element={<IndustrialReworkPage />} />
            <Route path="/industrial/time-tracking" element={<IndustrialTimeTrackingPage />} />
            <Route path="/industrial/piece/:pieceId" element={<PieceMainView />} />
            <Route path="/industrial/operations" element={<IndustrialOperationsPage />} />
            <Route path="/industrial/operations/cnc" element={<IndustrialCncPage />} />
            <Route path="/industrial/operations/nesting" element={<IndustrialNestingPage />} />
            <Route path="/industrial/operations/drill" element={<IndustrialDrillPage />} />
            <Route path="/industrial/operations/orlar" element={<IndustrialOrlarPage />} />
            <Route path="/industrial/operations/montagem" element={<IndustrialMontagemPage />} />
            <Route path="/industrial/operations/embalagem" element={<IndustrialEmbalagemPage />} />
            <Route path="/admin/settings/industrial" element={<IndustrialAdminSettingsPage />} />
            <Route path="/admin/system-settings/industrial/realtime-alerts" element={<RealtimeAlertsAdminPage />} />
            <Route
              path={INDUSTRIAL_ADMIN_MODELS_PATH}
              element={
                <PermissionRoute check={canAccessAdminPanel}>
                  <div
                    style={{
                      display: "flex",
                      gap: 16,
                      minHeight: "100vh",
                      padding: 16,
                      boxSizing: "border-box",
                    }}
                  >
                    <aside style={{ width: 220, flexShrink: 0 }}>
                      <AdminSidebar activePath={INDUSTRIAL_ADMIN_MODELS_PATH} />
                    </aside>
                    <main style={{ flex: 1, minWidth: 0 }}>
                      <IndustrialModelsPage />
                    </main>
                  </div>
                </PermissionRoute>
              }
            />
            <Route
              path={PIPRO_WORKSPACE_PATH}
              element={
                <PermissionRoute check={canAccessAdminPanel}>
                  <Suspense fallback={<PageContainer><Card>A carregar Workspace…</Card></PageContainer>}>
                    <WorkspaceDesignModePage />
                  </Suspense>
                </PermissionRoute>
              }
            />
            <Route
              path={PIPRO_WORKSPACE_V2_PATH}
              element={
                <PermissionRoute check={canAccessAdminPanel}>
                  <Suspense fallback={<PageContainer><Card>A carregar Workspace v2…</Card></PageContainer>}>
                    <PiproDesignShellPage />
                  </Suspense>
                </PermissionRoute>
              }
            />
          </Route>
          <Route path="/v4" element={<V4Page />} /> {/* TEMPORARY — remove before production */}
        </Route>
        <Route path="/" element={<LegacyApp />} />
        {/* Fase 8 — redirects → Hub /documentacao */}
        <Route path="/painel-referencia" element={<Navigate to="/documentacao#refs" replace />} />
        <Route path="/project-progress" element={<Navigate to="/documentacao#progresso" replace />} />
        {/* Painel legacy (AdminPanel): mesmo shell que / — syncRoute em LegacyApp lê pathname /admin */}
        <Route path="/admin" element={<LegacyApp />} />
        {/* Projeto importado de ficheiro — workspace completo em /{slug} */}
        <Route path="/:projectSlug" element={<LegacyApp />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </ThemeTemplateProvider>
    </ThemeProvider>
  );
}