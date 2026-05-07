import { createFileRoute } from "@tanstack/react-router";
import { Phone, Flame, Shield, Ambulance, HeartPulse, AlertTriangle, Baby, Users } from "lucide-react";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/emergency")({
  head: () => ({
    meta: [
      { title: "Emergency Contacts — CommunityHub" },
      { name: "description", content: "Quick-dial emergency numbers for South Africa." },
    ],
  }),
  component: EmergencyPage,
});

const contacts = [
  { key: "police", name: { en: "Police (SAPS)", xh: "Amapolisa (SAPS)", zu: "Amaphoyisa (SAPS)", af: "Polisie (SAPS)" }, number: "10111", icon: Shield, cls: "bg-blue-500/15 text-blue-600" },
  { key: "ambulance", name: { en: "Ambulance / Medical", xh: "I-Ambulensi / Ezonyango", zu: "I-ambulensi / Ezokwelapha", af: "Ambulans / Mediese" }, number: "10177", icon: Ambulance, cls: "bg-red-500/15 text-red-600" },
  { key: "fire", name: { en: "Fire Brigade", xh: "Abacimi-mlilo", zu: "Abezicishamlilo", af: "Brandweer" }, number: "10177", icon: Flame, cls: "bg-orange-500/15 text-orange-600" },
  { key: "all", name: { en: "All Emergencies (cell)", xh: "Zonke Iingxamiseko (iselula)", zu: "Zonke izimo eziphuthumayo (iselula)", af: "Alle Noodgevalle (sel)" }, number: "112", icon: AlertTriangle, cls: "bg-yellow-500/20 text-yellow-700" },
  { key: "gbv", name: { en: "GBV Command Centre", xh: "Iziko le-GBV", zu: "Isikhungo se-GBV", af: "GBV Bevel Sentrum" }, number: "0800428428", icon: HeartPulse, cls: "bg-pink-500/15 text-pink-600" },
  { key: "child", name: { en: "Childline SA", xh: "Childline SA", zu: "Childline SA", af: "Childline SA" }, number: "116", icon: Baby, cls: "bg-purple-500/15 text-purple-600" },
  { key: "suicide", name: { en: "SADAG Suicide Crisis", xh: "I-SADAG Ingxaki Yokuzibulala", zu: "Inkinga Yokuzibulala ye-SADAG", af: "SADAG Selfmoord Krisis" }, number: "0800567567", icon: HeartPulse, cls: "bg-rose-500/15 text-rose-600" },
  { key: "disaster", name: { en: "Disaster Management", xh: "Ulawulo Lwentlekele", zu: "Ukuphathwa Kwezinhlekelele", af: "Rampbestuur" }, number: "107", icon: Users, cls: "bg-emerald-500/15 text-emerald-600" },
];

function EmergencyPage() {
  const { t, lang } = useT();
  return (
    <div className="px-4 md:px-10 py-8 md:py-10 max-w-5xl mx-auto">
      <section className="rounded-3xl mb-6 p-8 text-white shadow-elegant" style={{ background: "linear-gradient(135deg, #dc2626, #b91c1c)" }}>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-xs font-medium">
          <AlertTriangle className="h-3.5 w-3.5" /> SOS
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-bold mt-3">{t("emergency.title")}</h1>
        <p className="text-white/90 mt-2 max-w-xl">{t("emergency.subtitle")}</p>
      </section>

      <div className="mb-6 p-4 rounded-2xl bg-warning/15 border border-warning/30">
        <div className="font-semibold text-sm">{t("emergency.tip.title")}</div>
        <div className="text-sm text-muted-foreground mt-1">{t("emergency.tip.body")}</div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {contacts.map((c) => {
          const Icon = c.icon;
          return (
            <a
              key={c.key}
              href={`tel:${c.number}`}
              className="group bg-card border border-border rounded-2xl p-5 flex items-center gap-4 hover:shadow-elegant hover:-translate-y-0.5 hover:border-primary/30 transition-all"
            >
              <span className={`h-12 w-12 grid place-items-center rounded-xl ${c.cls}`}>
                <Icon className="h-6 w-6" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-display font-semibold text-base">{c.name[lang]}</div>
                <div className="text-2xl font-bold tracking-tight tabular-nums mt-0.5">{c.number}</div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-primary-foreground shadow-elegant" style={{ background: "var(--gradient-primary)" }}>
                <Phone className="h-3.5 w-3.5" /> {t("emergency.callNow")}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
