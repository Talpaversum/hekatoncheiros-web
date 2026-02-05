import { useEffect, useMemo, useState } from "react";

import { getStoredTheme, getSystemTheme, setStoredTheme, type ThemeMode } from "./theme-storage";

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(() => getStoredTheme() ?? getSystemTheme());

  useEffect(() => {
    applyTheme(theme);
    setStoredTheme(theme);
  }, [theme]);

  const isDark = theme === "dark";
  const toggle = () => setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  const setExplicit = (next: ThemeMode) => setTheme(next);

  return useMemo(
    () => ({ theme, isDark, toggle, setTheme: setExplicit }),
    [theme, isDark],
  );
}
