import { AlertTriangle, Calendar, ExternalLink, HeartHandshake, MapPin, Phone, Stethoscope, Tag } from "lucide-react";
import type { Resource, ResourceType } from "@/data/resources";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const typeMeta: Record<ResourceType, { label: string; icon: typeof MapPin; cls: string }> = {
  clinic: { label: "Clinic", icon: Stethoscope, cls: "bg-primary/10 text-primary" },
  ngo: { label: "NGO", icon: HeartHandshake, cls: "bg-success/15 text-[color:var(--success)]" },
  alert: { label: "Alert", icon: AlertTriangle, cls: "bg-warning/20 text-[color:var(--foreground)]" },
};

export function ResourceCard({ r }: { r: Resource }) {
  const meta = typeMeta[r.type];
  const Icon = meta.icon;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="w-full rounded-xl border border-border bg-card p-4 text-left text-card-foreground transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring">
          <div className="mb-2 flex items-start justify-between gap-3">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.cls}`}>
              <Icon className="h-3 w-3" /> {meta.label}
            </span>
            <span className="text-[11px] font-semibold text-primary">Details</span>
          </div>
          <h3 className="font-semibold text-base leading-snug">{r.name}</h3>
          <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{r.description}</p>
          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {r.location}</div>
            {r.contact && <div className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {r.contact}</div>}
            {r.date && <div className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {r.date}</div>}
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,420px)] rounded-xl p-0" align="start" sideOffset={10}>
        <div className="border-b border-border p-4">
          <div className="flex items-start justify-between gap-3">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.cls}`}>
              <Icon className="h-3 w-3" /> {meta.label}
            </span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
              {r.type === "alert" ? "Notice" : "Resource"}
            </span>
          </div>
          <h3 className="mt-3 font-display text-lg font-semibold leading-tight">{r.name}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.description}</p>
        </div>
        <div className="space-y-3 p-4">
          <DetailRow icon={MapPin} label="Location" value={r.location} />
          {r.contact && <DetailRow icon={Phone} label="Contact" value={r.contact} />}
          {r.date && <DetailRow icon={Calendar} label="Date" value={r.date} />}
          {r.tags.length > 0 && (
            <div>
              <div className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Tag className="h-3.5 w-3.5" /> Tags
              </div>
              <div className="flex flex-wrap gap-1.5">
                {r.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-border bg-secondary px-2 py-1 text-[11px] font-medium text-secondary-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="rounded-lg border border-border bg-secondary/45 px-3 py-2 text-xs text-muted-foreground">
            Confirm availability with the provider before travelling. Community Compass shows the latest saved community information.
          </div>
          {r.contact && (
            <a
              href={contactHref(r.contact)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              <ExternalLink className="h-4 w-4" /> Contact resource
            </a>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase text-muted-foreground">{label}</div>
        <div className="break-words text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}

function contactHref(contact: string) {
  if (contact.includes("@")) return `mailto:${contact}`;
  const phone = contact.replace(/[^\d+]/g, "");
  return phone ? `tel:${phone}` : "#";
}
