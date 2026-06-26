import Header from "./components/layout/header/Header";
import LeftToolbar from "./components/layout/left-toolbar/LeftToolbar";
import LeftPanel from "./components/layout/left-panel/LeftPanel";
import ToolbarModals from "./components/layout/ToolbarModals";
import Workspace from "./components/layout/workspace/Workspace";
import Footer from "./components/layout/footer/Footer";
import BottomInfoToolbar from "./components/layout/bottom-info-toolbar/BottomInfoToolbar";
import BottomInfoPanelsOverlay from "./components/layout/bottom-info-toolbar/BottomInfoPanelsOverlay";
import { BottomInfoProvider } from "./context/BottomInfoContext";
import WhatsAppButton from "./components/layout/WhatsAppButton";
import { PimoViewerProvider } from "./context/PimoViewerContext";
import { ProjectProvider } from "./context/ProjectProvider";
import { WorkspaceUndoRedoRegistryProvider } from "./context/WorkspaceUndoRedoRegistryContext";
import { MaterialProvider } from "./context/materialContext";
import { ToolbarModalProvider } from "./context/ToolbarModalContext";
import { ToastProvider } from "./context/ToastContext";
import { PendingWorkspaceMergeEffect } from "./context/PendingWorkspaceMergeEffect";
import { PendingSingleLoadEffect } from "./workspace/PendingSingleLoadEffect";
import { SettingsProvider } from "./context/SettingsContext";
import { ThemeProvider } from "./context/ThemeContext";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { DEFAULT_VIEWER_OPTIONS, VIEWER_BACKGROUND } from "./constants/viewerOptions";
import { useUiStore } from "./stores/uiStore";
import PainelReferencia from "./pages/PainelReferencia";
import HelpPage from "./pages/HelpPage";
import LandingPage from "./pages/LandingPage";
import UserProjectsPage from "./pages/UserProjectsPage";
import SettingsPage from "./pages/SettingsPage";
import ProtectedRoute from "./components/ProtectedRoute";
import Navbar from "./components/Navbar";
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
import { canAccessAdminPanel, canOpenProjectsShowroom, hasFullAccess } from "./auth/rbac";
import { useAuth } from "./auth/useAuth";
import Card from "./components/ui/Card";
import PageContainer from "./components/ui/PageContainer";
import { IconGallery } from "@/components/icons";
import "./components/ui/ui.css";
import { industrialProjectsUrl } from "./config/industrialApp";
import type { V3Piece } from "./nesting-v3/nestingV3Types";

const Documentacao = lazy(() => import("./pages/Documentacao"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const ProjectProgress = lazy(() => import("./pages/ProjectProgress"));
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
  const [showPainelReferencia, setShowPainelReferencia] = useState(false);
  const [showSystemDocs, setShowSystemDocs] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showProjectProgress, setShowProjectProgress] = useState(false);
  const [showDevTest, setShowDevTest] = useState(false);
  const [showAjuda, setShowAjuda] = useState(false);
  const [showLanding, setShowLanding] = useState(false);
  const [showUserProjects, setShowUserProjects] = useState(false);
  const navigate = useNavigate();
  const viewerOptions = useMemo(() => DEFAULT_VIEWER_OPTIONS, []);
  const location = useLocation();

  const syncRoute = useCallback(() => {
    const pathname = window.location.pathname;
    const isSystemDocs = pathname === "/documentacao";
    const isAdmin = pathname === "/admin";
    const isProjectProgress = pathname === "/project-progress";
    if (!import.meta.env.DEV && pathname === "/dev-test") {
      window.history.replaceState({}, "", "/");
    }
    const isDevTest = import.meta.env.DEV && pathname === "/dev-test";
    const isPainelReferencia = pathname === "/painel-referencia";
    const isAjuda = pathname === "/ajuda";
    const isLanding = pathname === "/landing" || pathname === "/apresentacao";
    const isUserProjects = pathname === "/meus-projetos";
    setShowSystemDocs(isSystemDocs);
    setShowAdmin(isAdmin);
    setShowProjectProgress(isProjectProgress);
    setShowDevTest(isDevTest);
    setShowPainelReferencia(isPainelReferencia);
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

  const navigateToSystemDocs = () => {
    window.history.pushState({}, "", "/documentacao");
    setShowSystemDocs(true);
    setShowAdmin(false);
    setShowProjectProgress(false);
    setShowPainelReferencia(false);
    setShowAjuda(false);
    setShowDevTest(false);
    setShowUserProjects(false);
  };

  const navigateToProjectProgress = () => {
    window.history.pushState({}, "", "/project-progress");
    setShowProjectProgress(true);
    setShowSystemDocs(false);
    setShowAdmin(false);
    setShowPainelReferencia(false);
    setShowAjuda(false);
    setShowDevTest(false);
    setShowUserProjects(false);
  };

  const navigateToAjuda = () => {
    window.history.pushState({}, "", "/ajuda");
    setShowAjuda(true);
    setShowSystemDocs(false);
    setShowAdmin(false);
    setShowProjectProgress(false);
    setShowDevTest(false);
    setShowPainelReferencia(false);
    setShowUserProjects(false);
  };

  const navigateToPainelReferencia = () => {
    window.history.pushState({}, "", "/painel-referencia");
    setShowPainelReferencia(true);
    setShowSystemDocs(false);
    setShowAdmin(false);
    setShowProjectProgress(false);
    setShowAjuda(false);
    setShowLanding(false);
    setShowDevTest(false);
    setShowUserProjects(false);
  };

  const navigateToLanding = () => {
    window.history.pushState({}, "", "/apresentacao");
    setShowLanding(true);
    setShowAjuda(false);
    setShowSystemDocs(false);
    setShowAdmin(false);
    setShowProjectProgress(false);
    setShowPainelReferencia(false);
    setShowDevTest(false);
    setShowUserProjects(false);
  };

  const navigateToUserProjects = () => {
    window.history.pushState({}, "", "/meus-projetos");
    setShowUserProjects(true);
    setShowAjuda(false);
    setShowSystemDocs(false);
    setShowAdmin(false);
    setShowProjectProgress(false);
    setShowDevTest(false);
    setShowPainelReferencia(false);
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
            <PendingWorkspaceMergeEffect />
            <PendingSingleLoadEffect />
            <PimoViewerProvider>
            <div className="app-root">
        <Header />

        {/* MAIN AREA */}
        <div className="app-main">
          {showPainelReferencia || showSystemDocs || showAdmin || showProjectProgress || showDevTest || showAjuda || showLanding || showUserProjects ? (
            <Suspense fallback={<div style={{ padding: 20, color: "var(--text-muted)" }}>Carregando…</div>}>
              {showPainelReferencia ? (
                <PainelReferencia />
              ) : showSystemDocs ? (
                <Documentacao />
              ) : showAdmin ? (
                <AdminPanel />
              ) : showProjectProgress ? (
                <ProjectProgress />
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
          onShowSystemDocs={navigateToSystemDocs}
          onShowAjuda={navigateToAjuda}
          onShowUserProjects={navigateToUserProjects}
          onShowProjectProgress={navigateToProjectProgress}
          onShowPainelReferencia={navigateToPainelReferencia}
          onShowLanding={navigateToLanding}
        />

        <WhatsAppButton />

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
  return (
    <ProtectedRoute>
      <ToastProvider>
        <SettingsProvider>
          <Navbar />
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
  useEffect(() => {
    if (!id) return;
    window.location.replace(industrialProjectsUrl(`/PROJETOS/${encodeURIComponent(id)}`));
  }, [id]);
  if (!id) return <Navigate to="/" replace />;
  return (
    <PageContainer centered>
      <Card maxWidth={420}>
        <p style={{ margin: 0 }}>A redirecionar para o PIMO Industrial…</p>
      </Card>
    </PageContainer>
  );
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
          <Route path="/pieces/:id" element={<PieceAliasRedirect />} />
          <Route path="/studio/piece/:id" element={<PieceAliasRedirect />} />
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
            <Route path="/nesting_v3" element={<NestingV3RoutePage />} />
          </Route>
          <Route path="/v4" element={<V4Page />} /> {/* TEMPORARY — remove before production */}
        </Route>
        <Route path="/" element={<LegacyApp />} />
        {/* Painel legacy (AdminPanel): mesmo shell que / — syncRoute em LegacyApp lê pathname /admin */}
        <Route path="/admin" element={<LegacyApp />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ThemeProvider>
  );
}