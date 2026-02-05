const THEME_KEY = "hc_theme";

export type ThemeMode = "light" | "dark";

export function getStoredTheme(): ThemeMode | null {
  const value = localStorage.getItem(THEME_KEY);
  if (value === "light" || value === "dark") {
    return value;
  }
  return null;
}

export function setStoredTheme(theme: ThemeMode) {
  localStorage.setItem(THEME_KEY, theme);
}

export function getSystemTheme(): ThemeMode {
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyInitialTheme() {
  const stored = getStoredTheme();
  const theme = stored ?? getSystemTheme();
  document.documentElement.dataset.theme = theme;
}
