import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from "react-router-dom";
import { applyThemeToDocument, readStoredTheme } from './context/ThemeContext'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from "./auth/AuthProvider";

(window as Window & { PIMO_VERSION?: string }).PIMO_VERSION = __PIMO_VERSION__;

if (import.meta.env.DEV) {
  import("./core/manufacturing/industrialProductionPurge").then((mod) => {
    (
      window as Window & {
        __PIMO_INDUSTRIAL_PURGE__?: {
          batchPurgeOfflineProductionProjects: typeof mod.batchPurgeOfflineProductionProjects;
          applyIndustrialLoadPurge: typeof mod.applyIndustrialLoadPurge;
          clearNestingV3SessionCache: typeof mod.clearNestingV3SessionCache;
        };
      }
    ).__PIMO_INDUSTRIAL_PURGE__ = {
      batchPurgeOfflineProductionProjects: mod.batchPurgeOfflineProductionProjects,
      applyIndustrialLoadPurge: mod.applyIndustrialLoadPurge,
      clearNestingV3SessionCache: mod.clearNestingV3SessionCache,
    };
  });
  import("./3d/viewer-engine/highlight/viewerHighlightVisualAudit").then((mod) => {
    mod.registerHighlightVisualAuditOnWindow();
  });
}

applyThemeToDocument(readStoredTheme());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
