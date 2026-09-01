/* eslint-disable react-refresh/only-export-components */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";
import { applyThemeVariables } from "../theme/theme";
import { getSettings, saveSettings } from "../core/settings/settingsService";
import { SETTINGS_STORAGE_KEY } from "../core/settings/settingsSchema";

/** Tema resolvido aplicado no DOM (classes theme-dark / theme-light). */
export type ThemeId = "dark" | "light";

/**
 * Preferência do utilizador — espelha `settings.geral.theme`.
 * `system` segue `prefers-color-scheme`.
 */
export type ThemePreference = "dark" | "light" | "system";

/** Tema resolvido (compatível com preload / first paint). */
const STORAGE_KEY = "pimo-theme";
/** Preferência explícita (inclui system). */
const PREFERENCE_KEY = "pimo-theme-preference";

export function resolveThemePreference(preference: ThemePreference): ThemeId {
  if (preference === "light") return "light";
  if (preference === "dark") return "dark";
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return "dark";
}

function readPreferenceFromSettingsBlob(): ThemePreference | null {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { geral?: { theme?: string } };
    const t = parsed?.geral?.theme;
    if (t === "dark" || t === "light" || t === "system") return t;
  } catch {
    /* ignore */
  }
  return null;
}

/** Lê a preferência: settings.geral.theme → pimo-theme-preference → pimo-theme → dark. */
export function readStoredThemePreference(): ThemePreference {
  const fromSettings = readPreferenceFromSettingsBlob();
  if (fromSettings) return fromSettings;
  try {
    const pref = localStorage.getItem(PREFERENCE_KEY);
    if (pref === "dark" || pref === "light" || pref === "system") return pref;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    /* ignore */
  }
  try {
    const t = getSettings().geral?.theme;
    if (t === "dark" || t === "light" || t === "system") return t;
  } catch {
    /* ignore */
  }
  return "dark";
}

/** Tema resolvido para first paint (main.tsx / preload). */
export function readStoredTheme(): ThemeId {
  return resolveThemePreference(readStoredThemePreference());
}

/** Aplica a classe do tema no documento. Só altera o DOM se a classe ainda não for a correta (evita flash no mount). */
export function applyThemeToDocument(theme: ThemeId) {
  const nextClass = `theme-${theme}`;
  if (document.documentElement.classList.contains(nextClass)) return;
  document.documentElement.classList.remove("theme-dark", "theme-light");
  document.documentElement.classList.add(nextClass);
  applyThemeVariables();
}

function persistResolvedTheme(theme: ThemeId) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}

function persistPreference(preference: ThemePreference) {
  try {
    localStorage.setItem(PREFERENCE_KEY, preference);
  } catch {
    /* ignore */
  }
  try {
    const current = getSettings();
    if (current.geral.theme === preference) return;
    saveSettings({
      ...current,
      geral: { ...current.geral, theme: preference },
    });
  } catch {
    /* ignore */
  }
}

type ThemeContextValue = {
  /** Tema resolvido (dark/light) usado por CSS e paleta Pi. */
  theme: ThemeId;
  /** Preferência Settings (dark/light/system). */
  themePreference: ThemePreference;
  /** Define tema explícito dark|light (também atualiza a preferência). */
  setTheme: (_theme: ThemeId) => void;
  /** Define preferência completa, incluindo system. */
  setThemePreference: (_preference: ThemePreference) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function subscribeToSystemTheme(onStoreChange: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: light)");
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getSystemThemeSnapshot(): ThemeId {
  return resolveThemePreference("system");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredThemePreference);
  const systemTheme = useSyncExternalStore(
    subscribeToSystemTheme,
    getSystemThemeSnapshot,
    (): ThemeId => "dark"
  );
  const theme: ThemeId =
    preference === "system" ? systemTheme : (preference as ThemeId);

  useEffect(() => {
    applyThemeToDocument(theme);
    applyThemeVariables();
    persistResolvedTheme(theme);
    persistPreference(preference);
  }, [theme, preference]);

  const setTheme = useCallback((next: ThemeId) => {
    setPreferenceState(next);
  }, []);

  const setThemePreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setPreferenceState((prev) => {
      const current = prev === "system" ? resolveThemePreference("system") : prev;
      return current === "dark" ? "light" : "dark";
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, themePreference: preference, setTheme, setThemePreference, toggleTheme }),
    [theme, preference, setTheme, setThemePreference, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme deve ser usado dentro de ThemeProvider");
  }
  return ctx;
}
