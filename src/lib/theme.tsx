import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "light" | "dark";

const ThemeCtx = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}>({
  theme: "light",
  setTheme: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("theme") : null;
    const next = saved === "dark" || saved === "light" ? saved : "light";
    setThemeState(next);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  const setTheme = (next: Theme) => setThemeState(next);
  const toggleTheme = () => setThemeState((current) => (current === "dark" ? "light" : "dark"));

  return <ThemeCtx.Provider value={{ theme, setTheme, toggleTheme }}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
