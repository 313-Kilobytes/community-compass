import { useT, LANG_OPTIONS, type Lang } from "@/lib/i18n";
import { Languages } from "lucide-react";

export function LanguageSwitcher() {
  const { lang, setLang } = useT();
  return (
    <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-border shadow-card text-xs font-medium cursor-pointer">
      <Languages className="h-3.5 w-3.5 text-muted-foreground" />
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        className="bg-transparent outline-none text-foreground cursor-pointer"
        aria-label="Language"
      >
        {LANG_OPTIONS.map((o) => (
          <option key={o.code} value={o.code}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
