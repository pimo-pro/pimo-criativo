import { useContext, useEffect, useRef } from "react";
import { defaultProjectContext } from "./defaultProjectContext";
import { ProjectContext } from "./projectContext";

export function useProject() {
  const warnedMissingProviderRef = useRef(false);
  const context = useContext(ProjectContext);

  useEffect(() => {
    if (context || warnedMissingProviderRef.current) return;
    console.warn("useProject chamado fora de ProjectProvider");
    warnedMissingProviderRef.current = true;
  }, [context]);

  if (!context) {
    return defaultProjectContext;
  }
  return context;
}
