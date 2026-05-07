import { Moon, Sun } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

export function ThemeToggle() {
  const { t } = useT();
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  const Icon = dark ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex h-9 items-center gap-2 rounded-full border border-border px-3 text-xs font-medium shadow-card glass hover:bg-secondary/80 transition-colors"
      aria-label={dark ? t("theme.light") : t("theme.dark")}
      title={dark ? t("theme.light") : t("theme.dark")}
    >
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="hidden sm:inline">{dark ? t("theme.light") : t("theme.dark")}</span>
    </button>
  );
}
