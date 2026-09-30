import logoPimo from "../../../assets/logo-pi.png";
import { useContext, useRef, type ChangeEvent, type MouseEvent, type ReactNode } from "react";
import { useTheme } from "../../../context/ThemeContext";
import { ProjectContext } from "../../../context/projectContext";
import { useToast } from "../../../context/ToastContext";
import { Icon } from "@/components/icons";
import HeaderUndoRedoButtons from "./HeaderUndoRedoButtons";
import HeaderIndustrialMenu from "./HeaderIndustrialMenu";
import HeaderProjectsSwitcher from "./HeaderProjectsSwitcher";
import InvariantNotificationBell from "../../invariants/InvariantNotificationBell";
import {
  loadPimoProjectState,
  readPimoImportFilesFromDirectoryHandle,
  readPimoImportFilesFromFileList,
} from "../../../industrial/import/importPimoProjectFromFiles";
import { buildImportedPimoProjectPayload } from "../../../industrial/import/loadImportedPimoProject";
import { storePendingImportedProject } from "../../../workspace/pendingImportedProjectUtils";

type HeaderActionButtonProps = {
  title: string;
  ariaLabel: string;
  onClick?: (_event: MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
};

function HeaderActionButton({ title, ariaLabel, onClick, children }: HeaderActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        minHeight: 29,
        padding: "0 10px",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        background: "var(--button-ghost-bg)",
        color: "var(--text-main)",
        cursor: "pointer",
        fontSize: 13,
      }}
    >
      {children}
    </button>
  );
}

export default function Header() {
  const { theme, toggleTheme } = useTheme();
  const projectContext = useContext(ProjectContext);
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const navigateInternal = (path: string) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const openImportedProject = async (payload: ReturnType<typeof buildImportedPimoProjectPayload>) => {
    if (!payload) {
      showToast("Não foi possível ler o projeto PIMO a partir do ficheiro.", "error");
      return;
    }
    storePendingImportedProject({
      slug: payload.projectNameSlug,
      snapshot: payload.snapshot,
      projectName: payload.projectName,
    });
    navigateInternal(`/${payload.projectNameSlug}`);
  };

  const ingestImportFiles = async (files: FileList | File[]) => {
    const importFiles = await readPimoImportFilesFromFileList(files);
    const loaded = loadPimoProjectState(importFiles);
    if (!loaded) {
      showToast("Ficheiro não reconhecido como projeto PIMO.", "error");
      return;
    }
    const payload = buildImportedPimoProjectPayload(loaded.snapshot, loaded.projectName);
    await openImportedProject(payload);
  };

  const handleLanguageControl = () => {
    // @PIMO-SOON: Troca de idioma (atualmente fixo em PT).
  };

  const handleProjectUpload = async (event: MouseEvent<HTMLButtonElement>) => {
    if (event.shiftKey) {
      if (typeof window !== "undefined" && "showDirectoryPicker" in window) {
        try {
          const dirHandle = await (
            window as Window & { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }
          ).showDirectoryPicker();
          const importFiles = await readPimoImportFilesFromDirectoryHandle(dirHandle);
          const loaded = loadPimoProjectState(importFiles);
          if (!loaded) {
            showToast("Pasta não reconhecida como projeto PIMO.", "error");
            return;
          }
          const payload = buildImportedPimoProjectPayload(loaded.snapshot, loaded.projectName);
          await openImportedProject(payload);
        } catch (err: unknown) {
          if (err instanceof DOMException && err.name === "AbortError") return;
          const msg = err instanceof Error ? err.message : String(err);
          showToast(`Erro ao ler pasta do projeto: ${msg}`, "error");
        }
        return;
      }
      folderInputRef.current?.click();
      return;
    }
    fileInputRef.current?.click();
  };

  const handleProjectFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const files = input.files;
    input.value = "";
    if (!files?.length) return;
    if (!projectContext?.actions.loadImportedPimoProject) {
      showToast("Importação indisponível nesta página.", "error");
      return;
    }
    try {
      await ingestImportFiles(files);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Erro ao importar projeto: ${msg}`, "error");
    }
  };

  const handleProjectFolderChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const files = input.files;
    input.value = "";
    if (!files?.length) return;
    if (!projectContext?.actions.loadImportedPimoProject) {
      showToast("Importação indisponível nesta página.", "error");
      return;
    }
    try {
      await ingestImportFiles(files);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Erro ao importar pasta do projeto: ${msg}`, "error");
    }
  };

  return (
    <header
      style={{
        flexShrink: 0,
        height: "var(--top-toolbar-height)",
        background: `linear-gradient(90deg, var(--black), var(--navy))`,
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        padding: "0 20px",
      }}
    >
      {/* Logótipo + título + desfazer/refazer (handlers registados pelo Workspace no LegacyApp) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            cursor: "pointer",
            background: "transparent",
            border: "none",
            boxShadow: "none",
            outline: "none",
          }}
          onClick={() => {
            window.history.pushState({}, "", "/");
            window.dispatchEvent(new PopStateEvent("popstate"));
          }}
        >
          <img
            src={logoPimo}
            alt="PIMO"
            style={{
              height: 42,
              width: "auto",
              display: "block",
              objectFit: "contain",
              background: "transparent",
              border: "none",
              boxShadow: "none",
              outline: "none",
            }}
          />
          <div style={{ background: "transparent", border: "none", boxShadow: "none", outline: "none" }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>PiMo Studio</div>
          </div>
        </div>
        <HeaderProjectsSwitcher />
        <HeaderUndoRedoButtons />
      </div>

      {/* Área Direita — da direita p/ esquerda: Notificações → Idioma → Tema → Industrial → … → Upload */}
      <div
        style={{
          marginLeft: "auto",
          display: "flex",
          alignItems: "center",
          gap: "16px",
          fontSize: 13,
        }}
      >
        <HeaderActionButton
          onClick={handleProjectUpload}
          title="Selecionar ficheiro de projeto"
          ariaLabel="Selecionar ficheiro de projeto"
        >
          <Icon name="upload" size={18} aria-hidden />
        </HeaderActionButton>
        <HeaderActionButton
          onClick={() => navigateInternal("/meus-projetos")}
          title="Abrir meus projetos"
          ariaLabel="Abrir meus projetos"
        >
          <Icon name="projects" size={18} aria-hidden />
        </HeaderActionButton>
        <HeaderActionButton
          onClick={() => navigateInternal("/definicoes")}
          title="Abrir definições"
          ariaLabel="Abrir definições"
        >
          <Icon name="settings" size={18} aria-hidden />
        </HeaderActionButton>
        <HeaderActionButton
          onClick={() => navigateInternal("/login")}
          title="Abrir página de login"
          ariaLabel="Abrir página de login"
        >
          <Icon name="user" size={18} aria-hidden />
        </HeaderActionButton>
        <HeaderIndustrialMenu />
        <HeaderActionButton
          onClick={toggleTheme}
          title={theme === "dark" ? "Usar tema claro" : "Usar tema escuro"}
          ariaLabel={theme === "dark" ? "Alternar para tema claro" : "Alternar para tema escuro"}
        >
          {theme === "dark" ? <Icon name="themeSun" size={18} aria-hidden /> : <Icon name="themeMoon" size={18} aria-hidden />}
        </HeaderActionButton>
        <HeaderActionButton
          onClick={handleLanguageControl}
          title="Idioma atual: PT"
          ariaLabel="Idioma atual PT"
        >
          🌐 PT
        </HeaderActionButton>
        <InvariantNotificationBell />
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.zip,application/json,application/zip"
        style={{ display: "none" }}
        aria-hidden
        tabIndex={-1}
        onChange={handleProjectFileChange}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        // @ts-expect-error webkitdirectory não está nos tipos DOM padrão
        webkitdirectory=""
        style={{ display: "none" }}
        aria-hidden
        tabIndex={-1}
        onChange={handleProjectFolderChange}
      />
    </header>
  );
}
