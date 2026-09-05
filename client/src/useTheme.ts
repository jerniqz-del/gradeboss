import { useCallback, useEffect, useState } from "react";
import {
  applyTheme,
  loadThemePreference,
  resolveTheme,
  saveThemePreference,
  type ThemePreference,
} from "./theme";

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(() =>
    loadThemePreference(),
  );
  const [resolved, setResolved] = useState<"light" | "dark">(() =>
    resolveTheme(loadThemePreference()),
  );

  useEffect(() => {
    const next = applyTheme(preference);
    setResolved(next);
    saveThemePreference(preference);
  }, [preference]);

  useEffect(() => {
    if (preference !== "system") return;

    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      const next = applyTheme("system");
      setResolved(next);
    };

    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference]);

  const setTheme = useCallback((next: ThemePreference) => {
    setPreference(next);
  }, []);

  return { preference, resolved, setTheme };
}
