import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
export function ThemeToggle() { const { theme, toggle } = useTheme(); return <button className="nav-item theme-toggle" onClick={toggle}><span className="nav-icon">{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</span><span>{theme === "dark" ? "Mode terang" : "Mode gelap"}</span></button>; }
