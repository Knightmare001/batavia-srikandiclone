import {
  createContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
type Theme = "light" | "dark";
export const ThemeContext = createContext<{
  theme: Theme;
  toggle: () => void;
} | null>(null);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() =>
    localStorage.getItem("ear:theme") === "dark" ? "dark" : "light",
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("ear:theme", theme);
  }, [theme]);
  const value = useMemo(
    () => ({
      theme,
      toggle: () =>
        setTheme((current) => (current === "dark" ? "light" : "dark")),
    }),
    [theme],
  );
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
