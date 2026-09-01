/**
 * Registo dos handlers undo/redo definidos no Workspace, consumíveis pelo Header (irmão na árvore).
 * Quando o Workspace não está montado, os cliques são no-op até haver registo.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

export type WorkspaceUndoRedoHandlers = {
  handleUndo: () => void;
  handleRedo: () => void;
};

type RegistryContextValue = {
  handleUndo: () => void;
  handleRedo: () => void;
  registerWorkspaceUndoRedo: Dispatch<SetStateAction<WorkspaceUndoRedoHandlers | null>>;
};

const WorkspaceUndoRedoRegistryContext = createContext<RegistryContextValue | null>(null);

export function WorkspaceUndoRedoRegistryProvider({ children }: { children: ReactNode }) {
  const [registered, setRegistered] = useState<WorkspaceUndoRedoHandlers | null>(null);

  const handleUndo = useCallback(() => {
    registered?.handleUndo();
  }, [registered]);

  const handleRedo = useCallback(() => {
    registered?.handleRedo();
  }, [registered]);

  const value = useMemo(
    () => ({
      handleUndo,
      handleRedo,
      registerWorkspaceUndoRedo: setRegistered,
    }),
    [handleUndo, handleRedo]
  );

  return (
    <WorkspaceUndoRedoRegistryContext.Provider value={value}>{children}</WorkspaceUndoRedoRegistryContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWorkspaceUndoRedoRegistry(): RegistryContextValue {
  const ctx = useContext(WorkspaceUndoRedoRegistryContext);
  if (!ctx) {
    throw new Error("useWorkspaceUndoRedoRegistry deve ser usado dentro de WorkspaceUndoRedoRegistryProvider");
  }
  return ctx;
}

/** Mesmo contexto, sem erro fora do provider (Header partilhado entre LegacyApp e rotas sem registry). */
// eslint-disable-next-line react-refresh/only-export-components
export function useWorkspaceUndoRedoRegistryOptional(): RegistryContextValue | null {
  return useContext(WorkspaceUndoRedoRegistryContext);
}
