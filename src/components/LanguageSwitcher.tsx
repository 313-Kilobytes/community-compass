import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Languages } from "lucide-react";
import { useT, LANG_OPTIONS, type Lang } from "@/lib/i18n";

export function LanguageSwitcher() {
  const { lang, setLang } = useT();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const activeOption = LANG_OPTIONS.find((option) => option.code === lang) ?? LANG_OPTIONS[0];

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const selectLanguage = (next: Lang) => {
    setLang(next);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-9 min-w-28 items-center justify-between gap-2 rounded-full border border-border bg-card px-3 text-xs font-medium text-foreground shadow-card transition-colors hover:bg-secondary dark:bg-popover dark:text-popover-foreground dark:hover:bg-secondary"
        aria-label="Language"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="inline-flex items-center gap-2">
          <Languages className="h-3.5 w-3.5 text-muted-foreground" />
          {activeOption.label}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-11 z-50 w-44 overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-elegant"
        >
          {LANG_OPTIONS.map((option) => {
            const active = option.code === lang;
            return (
              <button
                key={option.code}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => selectLanguage(option.code)}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  active
                    ? "bg-primary/12 text-foreground dark:text-popover-foreground"
                    : "text-popover-foreground hover:bg-secondary"
                }`}
              >
                <span>{option.label}</span>
                {active && <Check className="h-4 w-4 text-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
