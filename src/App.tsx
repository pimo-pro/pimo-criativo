import Header from "./components/layout/header/Header";
import LeftToolbar from "./components/layout/left-toolbar/LeftToolbar";
import LeftPanel from "./components/layout/left-panel/LeftPanel";
import RightPanel from "./components/layout/right-panel/RightPanel";
import RightToolsBar from "./components/layout/right-tools/RightToolsBar";
import BottomPanel from "./components/layout/bottom-panel/BottomPanel";
import Workspace from "./components/layout/workspace/Workspace";
import Footer from "./components/layout/footer/Footer";
import Documentation from "./pages/Documentation";
import SobreNos from "./pages/SobreNos";
import Documentacao from "./pages/Documentacao";
import AdminPanel from "./pages/AdminPanel";
import ProjectRoadmap from "./pages/ProjectRoadmap";
import TestViewer from "./pages/test-viewer";
import { ThemeProvider } from "./theme/ThemeProvider";
import { ProjectProvider } from "./context/ProjectProvider";
import { MaterialProvider } from "./context/materialContext";
import { useEffect, useRef, useState } from "react";

export default function App() {
  const [leftOpen, setLeftOpen] = useState(true);
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
  const [showDocs, setShowDocs] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showSystemDocs, setShowSystemDocs] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showRoadmap, setShowRoadmap] = useState(false);
  const [showTestViewer, setShowTestViewer] = useState(false);

  useEffect(() => {
    const syncRoute = () => {
      const isAbout = window.location.pathname === "/sobre-nos";
      const isSystemDocs = window.location.pathname === "/documentacao";
      const isAdmin = window.location.pathname === "/admin";
      const isRoadmap = window.location.pathname === "/roadmap";
      const isTestViewer = window.location.pathname === "/test-viewer";
      setShowAbout(isAbout);
      setShowSystemDocs(isSystemDocs);
      setShowAdmin(isAdmin);
      setShowRoadmap(isRoadmap);
      setShowTestViewer(isTestViewer);
      if (isAbout) {
        setShowDocs(false);
      }
      if (isSystemDocs) {
        setShowDocs(false);
      }
      if (isAdmin) {
        setShowDocs(false);
      }
      if (isRoadmap) {
        setShowDocs(false);
      }
      if (isTestViewer) {
        setShowDocs(false);
      }
    };
    syncRoute();
    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, []);

  const navigateToAbout = () => {
    window.history.pushState({}, "", "/sobre-nos");
    setShowAbout(true);
    setShowDocs(false);
    setShowSystemDocs(false);
  };

  const navigateToSystemDocs = () => {
    window.history.pushState({}, "", "/documentacao");
    setShowSystemDocs(true);
    setShowDocs(false);
    setShowAbout(false);
    setShowAdmin(false);
  };

  const navigateToAdmin = () => {
    window.history.pushState({}, "", "/admin");
    setShowAdmin(true);
    setShowDocs(false);
    setShowAbout(false);
    setShowSystemDocs(false);
    setShowRoadmap(false);
  };

  const navigateToRoadmap = () => {
    window.history.pushState({}, "", "/roadmap");
    setShowRoadmap(true);
    setShowDocs(false);
    setShowAbout(false);
    setShowSystemDocs(false);
    setShowAdmin(false);
  };

  const navigateToTestViewer = () => {
    window.history.pushState({}, "", "/test-viewer");
    setShowTestViewer(true);
    setShowDocs(false);
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
    setShowTestViewer(false);
  };

  return (
    <ThemeProvider>
      <ProjectProvider>
        <MaterialProvider>
          <div className="app-root">
        <Header
          onToggleDocs={() => {
            if (showAbout || showSystemDocs || showAdmin || showRoadmap) {
              navigateToApp();
            }
            setShowDocs((prev) => !prev);
          }}
          docsOpen={showDocs}
          onShowRoadmap={() => {
            if (showRoadmap) {
              navigateToApp();
              return;
            }
            navigateToRoadmap();
          }}
          roadmapOpen={showRoadmap}
          onShowTestViewer={() => {
            if (showTestViewer) {
              navigateToApp();
              return;
            }
            navigateToTestViewer();
          }}
        />

        {/* MAIN AREA */}
        <div className="app-main">
          {showDocs ? (
            <Documentation />
          ) : showSystemDocs ? (
            <Documentacao />
          ) : showAdmin ? (
            <AdminPanel />
          ) : showRoadmap ? (
            <ProjectRoadmap />
          ) : showTestViewer ? (
            <TestViewer />
          ) : showAbout ? (
            <SobreNos />
          ) : (
            <div className="app-panels">
              <LeftToolbar
                onSelect={() => {
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
                <LeftPanel />
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
              <Workspace />

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
          )}
        </div>

        {/* BOTTOM PANEL */}
        {!showDocs && !showAbout && !showSystemDocs && !showAdmin && !showRoadmap && (
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

          </div>
        </MaterialProvider>
      </ProjectProvider>
    </ThemeProvider>
  );
}