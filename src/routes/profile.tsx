import { Link, createFileRoute } from "@tanstack/react-router";
import { Camera, Info, LifeBuoy, Mail, MapPin, Save, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { LocationPicker } from "@/components/LocationPicker";
import { useAuth, type UserLocation } from "@/lib/auth";
import { detectCapeTownRegion } from "@/lib/community";
import type { AdminTicket, TicketPriority } from "@/lib/server/admin-store";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile - Community Compass" },
      { name: "description", content: "Manage your Community Compass account and locations." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, loading, error, logout, clearError } = useAuth();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-10 md:py-10">
      <section className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Account security
            </div>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">Profile</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Your permanent location personalizes local alerts and the default community feed. You can still browse and post anywhere.
            </p>
          </div>
          {user && (
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-xl border border-border bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground hover:bg-muted"
            >
              Sign out
            </button>
          )}
        </div>
      </section>

      {error && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span>{error}</span>
          <button type="button" onClick={clearError} className="font-semibold">Dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-card">Loading your session...</div>
      ) : user ? (
        <ProfileEditor />
      ) : (
        <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-card">
          <UserRound className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-3 font-display text-xl font-semibold">Sign in to manage your profile</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Profile settings are available after you sign in. New users can create an account on the sign up page.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link to="/signin" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
              Sign in
            </Link>
            <Link to="/signup" className="rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-semibold text-secondary-foreground hover:bg-muted">
              Create account
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileEditor() {
  const { user, updateProfile } = useAuth();
  const [username, setUsername] = useState(user?.username ?? "");
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [currentLocation, setCurrentLocation] = useState<UserLocation | null>(user?.currentLocation ?? null);
  const [currentLocationQuery, setCurrentLocationQuery] = useState(user?.currentLocation?.label ?? "");
  const [profilePicture, setProfilePicture] = useState(user?.profilePicture ?? "");
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketCategory, setTicketCategory] = useState<AdminTicket["category"]>("Bug");
  const [ticketPriority, setTicketPriority] = useState<TicketPriority>("Medium");
  const [ticketMessage, setTicketMessage] = useState("");
  const [ticketNotice, setTicketNotice] = useState<string | null>(null);
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [showTickets, setShowTickets] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setUsername(user?.username ?? "");
    setFullName(user?.fullName ?? "");
    setCurrentLocation(user?.currentLocation ?? null);
    setCurrentLocationQuery(user?.currentLocation?.label ?? "");
    setProfilePicture(user?.profilePicture ?? "");
  }, [user]);

  useEffect(() => {
    const loadTickets = async () => {
      const response = await fetch("/api/tickets", { credentials: "include" }).catch(() => null);
      if (!response?.ok) return;
      const data = (await response.json().catch(() => ({}))) as { tickets?: AdminTicket[] };
      setTickets(data.tickets ?? []);
    };
    void loadTickets();
  }, []);

  if (!user) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaved(false);
    setBusy(true);
    const manualCurrentLocation =
      currentLocationQuery.trim().length >= 2 && currentLocationQuery.trim() !== currentLocation?.label
        ? { label: currentLocationQuery.trim(), region: detectCapeTownRegion(currentLocationQuery) }
        : currentLocation;
    const ok = await updateProfile({ username, fullName, currentLocation: manualCurrentLocation, profilePicture });
    setSaved(ok);
    setBusy(false);
  };

  const handlePicture = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setProfilePicture(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  };

  const submitTicket = async (event: React.FormEvent) => {
    event.preventDefault();
    setTicketNotice(null);
    const response = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ subject: ticketSubject, category: ticketCategory, priority: ticketPriority, message: ticketMessage }),
    }).catch(() => null);
    const result = (await response?.json().catch(() => ({}))) as { ticket?: AdminTicket; error?: string };
    if (!response?.ok || !result.ticket) {
      setTicketNotice(result.error || "Unable to submit ticket.");
      return;
    }
    setTickets((current) => [result.ticket!, ...current]);
    setTicketSubject("");
    setTicketMessage("");
    setTicketNotice("Ticket submitted. Admins can now track and respond to it.");
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="mx-auto h-32 w-32 overflow-hidden rounded-full border border-border bg-secondary">
          {profilePicture ? (
            <img src={profilePicture} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-muted-foreground">
              <UserRound className="h-12 w-12" />
            </div>
          )}
        </div>
        <label className="mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-semibold text-secondary-foreground hover:bg-muted">
          <Camera className="h-4 w-4" /> Profile picture
          <input type="file" accept="image/*" className="hidden" onChange={(event) => handlePicture(event.target.files?.[0])} />
        </label>
      </section>

      <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput value={username} onChange={setUsername} label="Username" autoComplete="username" required />
          <TextInput value={fullName} onChange={setFullName} label="Full name" autoComplete="name" />
          <ReadOnly label="Email" value={user.email} icon={Mail} />
          <ReadOnly label="Created" value={new Date(user.createdAt).toLocaleString()} icon={ShieldCheck} />
          <div className="md:col-span-2">
            <ReadOnly label="Permanent location" value={`${user.permanentLocation.region} - ${user.permanentLocation.label}`} icon={MapPin} />
          </div>
          <div className="md:col-span-2">
            <LocationPicker
              value={currentLocation}
              onChange={setCurrentLocation}
              onQueryChange={setCurrentLocationQuery}
              label="Current location"
            />
          </div>
        </div>
        {saved && (
          <div className="mt-4 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm font-semibold text-success">
            Profile saved.
          </div>
        )}
        <button
          type="submit"
          disabled={busy}
          className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          <Save className="h-4 w-4" /> {busy ? "Saving..." : "Save profile"}
        </button>
      </form>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-card lg:col-span-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <LifeBuoy className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold">Support tickets</h2>
              <p className="text-sm text-muted-foreground">Log system issues, account warnings, bans, and appeals for admins to resolve.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowTickets((current) => !current)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-secondary text-primary hover:bg-muted"
            aria-label="Open support tickets"
            title="Open support tickets"
          >
            <LifeBuoy className="h-5 w-5" />
          </button>
        </div>
        {showTickets && (
          <>
            <form onSubmit={submitTicket} className="mt-4 grid gap-3 md:grid-cols-4">
              <input value={ticketSubject} onChange={(event) => setTicketSubject(event.target.value)} required placeholder="Subject" className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm md:col-span-2" />
              <select value={ticketCategory} onChange={(event) => setTicketCategory(event.target.value as AdminTicket["category"])} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
                {["Account", "Appeal", "Safety", "Bug", "Other"].map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select value={ticketPriority} onChange={(event) => setTicketPriority(event.target.value as TicketPriority)} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
                {["Low", "Medium", "High", "Urgent"].map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <textarea value={ticketMessage} onChange={(event) => setTicketMessage(event.target.value)} required placeholder="What happened?" className="min-h-28 rounded-xl border border-border bg-background p-3 text-sm md:col-span-4" />
              <button type="submit" className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
                <LifeBuoy className="h-4 w-4" /> Submit ticket
              </button>
              {ticketNotice && <div className="self-center text-sm font-semibold text-muted-foreground md:col-span-3">{ticketNotice}</div>}
            </form>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {tickets.map((ticket) => (
                <div key={ticket.id} className="rounded-xl border border-border bg-background/60 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{ticket.subject}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{ticket.category} - {ticket.priority} - {ticket.status}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedTicket((current) => (current === ticket.id ? null : ticket.id))}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="View ticket details"
                      title="View details"
                    >
                      <Info className="h-4 w-4" />
                    </button>
                  </div>
                  {expandedTicket === ticket.id && (
                    <div className="mt-3 rounded-lg border border-border bg-card p-3">
                      <div className="text-[11px] font-semibold text-muted-foreground">{new Date(ticket.updatedAt).toLocaleString()}</div>
                      <p className="mt-2 text-sm text-muted-foreground">{ticket.message}</p>
                      {ticket.adminResponse && <div className="mt-3 rounded-lg bg-secondary p-3 text-sm">Admin: {ticket.adminResponse}</div>}
                    </div>
                  )}
                </div>
              ))}
              {tickets.length === 0 && <p className="text-sm text-muted-foreground">No tickets yet.</p>}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function TextInput({
  value,
  onChange,
  label,
  type = "text",
  autoComplete,
  required = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-muted-foreground">{label}{required ? " *" : ""}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        autoComplete={autoComplete}
        required={required}
        className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}

function ReadOnly({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Mail }) {
  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="mt-1.5 flex min-h-10 items-center gap-2 rounded-xl border border-border bg-secondary/45 px-3 py-2 text-sm">
        <Icon className="h-4 w-4 text-primary" />
        <span>{value}</span>
      </div>
    </div>
  );
}
