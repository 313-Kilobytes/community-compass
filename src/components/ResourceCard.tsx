import { MapPin, Phone, Calendar, Stethoscope, HeartHandshake, AlertTriangle } from "lucide-react";
import type { Resource, ResourceType } from "@/data/resources";

const typeMeta: Record<ResourceType, { label: string; icon: typeof MapPin; cls: string }> = {
  clinic: { label: "Clinic", icon: Stethoscope, cls: "bg-primary/10 text-primary" },
  ngo: { label: "NGO", icon: HeartHandshake, cls: "bg-success/15 text-[color:var(--success)]" },
  alert: { label: "Alert", icon: AlertTriangle, cls: "bg-warning/20 text-[color:var(--foreground)]" },
};

export function ResourceCard({ r }: { r: Resource }) {
  const meta = typeMeta[r.type];
  const Icon = meta.icon;
  return (
    <div className="bg-card text-card-foreground rounded-xl border border-border p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.cls}`}>
            <Icon className="h-3 w-3" /> {meta.label}
          </span>
        </div>
      </div>
      <h3 className="font-semibold text-base leading-snug">{r.name}</h3>
      <p className="text-sm text-muted-foreground mt-1">{r.description}</p>
      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {r.location}</div>
        {r.contact && <div className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {r.contact}</div>}
        {r.date && <div className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {r.date}</div>}
      </div>
    </div>
  );
}
