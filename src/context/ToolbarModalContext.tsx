/**
 * Contexto para modais da toolbar do Viewer.
 * Permite que ViewerToolbar (no topo do Viewer) abra modais
 * que são renderizados por RightToolsBar (coluna direita).
 */

import { createContext, useCallback, useContext, useState } from "react";

export type ToolbarModalType = "projects" | "2d" | "image" | "send" | "integration" | "room" | "validation" | null;

type ToolbarModalContextValue = {
  modal: ToolbarModalType;
  openModal: (type: ToolbarModalType) => void;
  closeModal: () => void;
};

const ToolbarModalContext = createContext<ToolbarModalContextValue | null>(null);

export function ToolbarModalProvider({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = useState<ToolbarModalType>(null);
  const openModal = useCallback((type: ToolbarModalType) => setModal(type), []);
  const closeModal = useCallback(() => setModal(null), []);
  return (
    <ToolbarModalContext.Provider value={{ modal, openModal, closeModal }}>
      {children}
    </ToolbarModalContext.Provider>
  );
}

export function useToolbarModal() {
  const ctx = useContext(ToolbarModalContext);
  if (!ctx) throw new Error("useToolbarModal must be used within ToolbarModalProvider");
  return ctx;
}
