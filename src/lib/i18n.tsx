import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "xh" | "af";

const dict = {
  en: {
    "nav.resources": "Resources",
    "nav.availability": "Availability",
    "nav.insights": "Insights",
    "nav.assistant": "Assistant",
    "nav.emergency": "Emergency",
    "lang.label": "Language",
    "emergency.title": "Emergency Contacts",
    "emergency.subtitle": "Tap any number to call. Save these for quick access.",
    "emergency.callNow": "Call now",
    "emergency.tip.title": "In an emergency",
    "emergency.tip.body": "Stay calm. State your location clearly. Don't hang up until told to.",
    "home.heroBadge": "Live community intelligence",
    "home.heroTitle": "Find clinics, NGOs, jobs & alerts — anywhere.",
    "home.heroSub": "Real-time results from across the web. One search, four resource types, zero noise.",
    "search.placeholder": "Keyword (e.g. mental health, food bank)",
    "location.placeholder": "Location (city or area)",
    "search.button": "Search",
    "filter.all": "All",
    "filter.clinic": "Clinics",
    "filter.ngo": "NGOs",
    "filter.job": "Jobs",
    "filter.alert": "Alerts",
    "state.empty": "Enter a location and keyword to find real community resources.",
    "state.noResults": "No results — try a different keyword or location.",
  },
  xh: {
    "nav.resources": "Izixhobo",
    "nav.availability": "Ukufumaneka",
    "nav.insights": "Iingcebiso",
    "nav.assistant": "Umncedi",
    "nav.emergency": "Ungxamiseko",
    "lang.label": "Ulwimi",
    "emergency.title": "Iinombolo Zongxamiseko",
    "emergency.subtitle": "Cofa nayiphi inombolo ukutsalela. Yigcine ukuze ufikelele ngokukhawuleza.",
    "emergency.callNow": "Tsalela ngoku",
    "emergency.tip.title": "Kwingxamiseko",
    "emergency.tip.body": "Yiba nokuzola. Chaza indawo okuyo ngokucacileyo. Ungayivali ifowuni de uxelelwe.",
    "home.heroBadge": "Iingcebiso zoluntu zangoku",
    "home.heroTitle": "Fumana iikliniki, ii-NGO, imisebenzi nezilumkiso — naphi na.",
    "home.heroSub": "Iziphumo zexesha lokwenyani kwi-intanethi yonke. Khangelo enye, iindidi ezine zezixhobo.",
    "search.placeholder": "Igama eliphambili (umz. impilo yengqondo)",
    "location.placeholder": "Indawo (isixeko okanye ummandla)",
    "search.button": "Khangela",
    "filter.all": "Konke",
    "filter.clinic": "Iikliniki",
    "filter.ngo": "Ii-NGO",
    "filter.job": "Imisebenzi",
    "filter.alert": "Izilumkiso",
    "state.empty": "Faka indawo nebinzana ukuze ufumane izixhobo zoluntu.",
    "state.noResults": "Akukho ziphumo — zama elinye igama okanye indawo.",
  },
  af: {
    "nav.resources": "Hulpbronne",
    "nav.availability": "Beskikbaarheid",
    "nav.insights": "Insigte",
    "nav.assistant": "Assistent",
    "nav.emergency": "Noodgeval",
    "lang.label": "Taal",
    "emergency.title": "Noodkontakte",
    "emergency.subtitle": "Tik enige nommer om te bel. Stoor dit vir vinnige toegang.",
    "emergency.callNow": "Bel nou",
    "emergency.tip.title": "In 'n noodgeval",
    "emergency.tip.body": "Bly kalm. Sê jou ligging duidelik. Moenie afsit tot jy gesê word nie.",
    "home.heroBadge": "Lewendige gemeenskapsinligting",
    "home.heroTitle": "Vind klinieke, NRO's, werk & waarskuwings — oral.",
    "home.heroSub": "Intydse resultate van regoor die web. Een soektog, vier hulpbron-tipes, geen geraas.",
    "search.placeholder": "Sleutelwoord (bv. geestesgesondheid, voedselbank)",
    "location.placeholder": "Ligging (stad of gebied)",
    "search.button": "Soek",
    "filter.all": "Alles",
    "filter.clinic": "Klinieke",
    "filter.ngo": "NRO's",
    "filter.job": "Werk",
    "filter.alert": "Waarskuwings",
    "state.empty": "Gee 'n ligging en sleutelwoord in om hulpbronne te vind.",
    "state.noResults": "Geen resultate — probeer 'n ander sleutelwoord of ligging.",
  },
} as const;

type Key = keyof (typeof dict)["en"];

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string }>({
  lang: "en",
  setLang: () => {},
  t: (k) => k,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = (typeof window !== "undefined" && (localStorage.getItem("lang") as Lang)) || null;
    if (saved && ["en", "xh", "af"].includes(saved)) setLangState(saved);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("lang", l);
  };

  const t = (k: Key) => (dict[lang] as Record<string, string>)[k] ?? (dict.en as Record<string, string>)[k] ?? k;

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export const useT = () => useContext(Ctx);

export const LANG_OPTIONS: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "xh", label: "isiXhosa" },
  { code: "af", label: "Afrikaans" },
];
