import Header from "./components/layout/header/Header";
import LeftToolbar from "./components/layout/left-toolbar/LeftToolbar";
import LeftPanel from "./components/layout/left-panel/LeftPanel";
import RightPanel from "./components/layout/right-panel/RightPanel";
import RightToolsBar from "./components/layout/right-tools/RightToolsBar";
import BottomPanel from "./components/layout/bottom-panel/BottomPanel";
import Workspace from "./components/layout/workspace/Workspace";
import Footer from "./components/layout/footer/Footer";
import WhatsAppButton from "./components/layout/WhatsAppButton";
import PainelReferencia from "./pages/PainelReferencia";
import SobreNos from "./pages/SobreNos";
import Documentacao from "./pages/Documentacao";
import AdminPanel from "./pages/AdminPanel";
import ProjectRoadmap from "./pages/ProjectRoadmap";
import DevPimoTest from "./pages/DevPimoTest";
import DevActionsTest from "./pages/DevActionsTest";
import { PimoViewerProvider } from "./context/PimoViewerContext";
import { ProjectProvider } from "./context/ProjectProvider";
import { MaterialProvider } from "./context/materialContext";
import { ToolbarModalProvider } from "./context/ToolbarModalContext";
import { ToastProvider } from "./context/ToastContext";
import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_VIEWER_OPTIONS, VIEWER_BACKGROUND } from "./constants/viewerOptions";

export default function App() {
  const [leftOpen, setLeftOpen] = useState(true);
  const [leftPanelTab, setLeftPanelTab] = useState("home");
  const [rightOpen] = useState(true);
  const [leftWidth, setLeftWidth] = useState(260);
  const [showBottom] = useState(true);
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
  const [showAbout, setShowAbout] = useState(false);
  const [showSystemDocs, setShowSystemDocs] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showRoadmap, setShowRoadmap] = useState(false);
  const [showDevTest, setShowDevTest] = useState(false);
  const [showDevActions, setShowDevActions] = useState(false);
  const viewerOptions = useMemo(() => DEFAULT_VIEWER_OPTIONS, []);

  useEffect(() => {
    const syncRoute = () => {
      const isAbout = window.location.pathname === "/sobre-nos";
      const isSystemDocs = window.location.pathname === "/documentacao";
      const isAdmin = window.location.pathname === "/admin";
      const isRoadmap = window.location.pathname === "/roadmap";
      const isDevTest = window.location.pathname === "/dev-test";
      const isDevActions = window.location.pathname === "/dev-actions";
      const isPainelReferencia = window.location.pathname === "/painel-referencia";
      setShowAbout(isAbout);
      setShowSystemDocs(isSystemDocs);
      setShowAdmin(isAdmin);
      setShowRoadmap(isRoadmap);
      setShowDevTest(isDevTest);
      setShowDevActions(isDevActions);
      setShowPainelReferencia(isPainelReferencia);
    };
    syncRoute();
    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, []);

  const navigateToAbout = () => {
    window.history.pushState({}, "", "/sobre-nos");
    setShowAbout(true);
    setShowSystemDocs(false);
  };

  const navigateToSystemDocs = () => {
    window.history.pushState({}, "", "/documentacao");
    setShowSystemDocs(true);
    setShowAbout(false);
    setShowAdmin(false);
  };

  const navigateToAdmin = () => {
    window.history.pushState({}, "", "/admin");
    setShowAdmin(true);
    setShowAbout(false);
    setShowSystemDocs(false);
    setShowRoadmap(false);
  };

  const navigateToRoadmap = () => {
    window.history.pushState({}, "", "/roadmap");
    setShowRoadmap(true);
    setShowAbout(false);
    setShowSystemDocs(false);
    setShowAdmin(false);
  };

  const navigateToPainelReferencia = () => {
    window.history.pushState({}, "", "/painel-referencia");
    setShowPainelReferencia(true);
    setShowAbout(false);
    setShowSystemDocs(false);
    setShowAdmin(false);
    setShowRoadmap(false);
  };

  const navigateToApp = () => {
    window.history.pushState({}, "", "/");
    setShowAbout(false);
    setShowSystemDocs(false);
    setShowAdmin(false);
    setShowRoadmap(false);
    setShowDevTest(false);
    setShowDevActions(false);
    setShowPainelReferencia(false);
  };

  return (
    <ProjectProvider>
        <MaterialProvider>
          <ToastProvider>
            <PimoViewerProvider>
            <div className="app-root">
        <Header
          onTogglePainelReferencia={() => {
            if (showPainelReferencia) {
              navigateToApp();
            } else {
              navigateToPainelReferencia();
            }
          }}
          painelReferenciaOpen={showPainelReferencia}
          onShowRoadmap={() => {
            if (showRoadmap) {
              navigateToApp();
              return;
            }
            navigateToRoadmap();
          }}
          roadmapOpen={showRoadmap}
        />

        {/* MAIN AREA */}
        <div className="app-main">
          {showPainelReferencia ? (
            <PainelReferencia />
          ) : showSystemDocs ? (
            <Documentacao />
          ) : showAdmin ? (
            <AdminPanel />
          ) : showRoadmap ? (
            <ProjectRoadmap />
          ) : showDevTest ? (
            <DevPimoTest />
          ) : showDevActions ? (
            <DevActionsTest />
          ) : showAbout ? (
            <SobreNos />
          ) : (
            <ToolbarModalProvider>
            <div className="app-panels">
              <LeftToolbar
                selectedId={leftPanelTab}
                onSelect={(id) => {
                  setLeftPanelTab(id);
                  if (!leftOpen) setLeftOpen(true);
                }}
              />
              {/* LEFT PANEL */}
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

              {/* WORKSPACE */}
              <Workspace
                viewerBackground={VIEWER_BACKGROUND}
                viewerHeight="100%"
                viewerOptions={viewerOptions}
              />

              {/* RIGHT PANEL */}
              <div
                className="panel panel-shell panel-shell--side right-panel panel-shell-right"
                style={{
                  width: rightOpen ? 260 : 0,
                  minWidth: rightOpen ? 260 : 0,
                  overflow: "hidden",
                  transition: "width 0.2s ease",
                }}
              >
                <div className="right-panel-stack">
                  <RightPanel />
                  <RightToolsBar />
                </div>
              </div>
            </div>
            </ToolbarModalProvider>
          )}
        </div>

        {/* BOTTOM PANEL */}
        {!showPainelReferencia && !showAbout && !showSystemDocs && !showAdmin && !showRoadmap && (
          <div
            className={
              showBottom
                ? "panel panel-shell panel-shell--bottom bottom-panel-shell"
                : "panel panel-shell panel-shell--bottom bottom-panel-shell bottom-panel-hidden"
            }
          >
            <BottomPanel />
          </div>
        )}

        <Footer
          onShowAbout={navigateToAbout}
          onShowSystemDocs={navigateToSystemDocs}
          onShowAdmin={navigateToAdmin}
        />

        <WhatsAppButton />

            </div>
            </PimoViewerProvider>
          </ToastProvider>
        </MaterialProvider>
    </ProjectProvider>
  );
}