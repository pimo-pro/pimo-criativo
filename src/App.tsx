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
import { ThemeProvider } from "./theme/ThemeProvider";
import { ProjectProvider } from "./context/ProjectProvider";
import { MaterialProvider } from "./context/materialContext";
import { useEffect, useRef, useState } from "react";

export default function App() {
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [leftWidth, setLeftWidth] = useState(260);
  const [showBottom, setShowBottom] = useState(true);
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

  useEffect(() => {
    const syncRoute = () => {
      const isAbout = window.location.pathname === "/sobre-nos";
      const isSystemDocs = window.location.pathname === "/documentacao";
      const isAdmin = window.location.pathname === "/admin";
      const isRoadmap = window.location.pathname === "/roadmap";
      setShowAbout(isAbout);
      setShowSystemDocs(isSystemDocs);
      setShowAdmin(isAdmin);
      setShowRoadmap(isRoadmap);
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

  const navigateToApp = () => {
    window.history.pushState({}, "", "/");
    setShowAbout(false);
    setShowSystemDocs(false);
    setShowAdmin(false);
    setShowRoadmap(false);
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

        <a
          href="https://wa.me/351913822283?text=Olá%20Khaled,%20vim%20do%20PIMO%20Studio"
          target="_blank"
          rel="noreferrer"
          style={{
            position: "fixed",
            right: 20,
            bottom: 20,
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.14)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#25D366",
            zIndex: 1000,
            backdropFilter: "blur(6px)",
            boxShadow: "0 12px 24px rgba(0,0,0,0.25)",
          }}
          aria-label="WhatsApp"
          title="WhatsApp"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M12 2C6.477 2 2 6.477 2 12c0 1.86.51 3.65 1.47 5.22L2 22l4.93-1.42A9.94 9.94 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2Z"
              stroke="#25D366"
              strokeWidth="1.6"
            />
            <path
              d="M9.3 7.9c-.18-.4-.37-.41-.54-.41h-.46c-.16 0-.42.06-.64.31-.22.25-.85.83-.85 2.03 0 1.2.88 2.36 1 2.52.12.16 1.7 2.72 4.17 3.7 2.05.81 2.47.65 2.91.61.44-.04 1.43-.58 1.63-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28-.24-.12-1.43-.7-1.65-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.95-1.2-.72-.65-1.2-1.46-1.34-1.7-.14-.24-.01-.36.11-.48.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.52-1.28-.72-1.74Z"
              fill="#25D366"
            />
          </svg>
        </a>

        {/* TOGGLE BUTTONS */}
        {!showDocs && !showAbout && !showSystemDocs && !showAdmin && (
          <>
            <button
              onClick={() => setLeftOpen(!leftOpen)}
              style={{
                position: "fixed",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                zIndex: 999,
              }}
            >
              ⟨
            </button>

            <button
              onClick={() => setRightOpen(!rightOpen)}
              style={{
                position: "fixed",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                zIndex: 999,
              }}
            >
              ⟩
            </button>

            <button
              onClick={() => setShowBottom(!showBottom)}
              style={{
                position: "fixed",
                bottom: 10,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 999,
              }}
            >
              ▼
            </button>
          </>
        )}
          </div>
        </MaterialProvider>
      </ProjectProvider>
    </ThemeProvider>
  );
}