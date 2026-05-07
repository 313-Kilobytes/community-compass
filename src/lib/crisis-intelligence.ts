export type IncidentCategory = "Crime" | "Infrastructure" | "Medical" | "Weather" | "Scam" | "Fire" | "Community";
export type IncidentSeverity = "High" | "Medium" | "Low";

export type IncidentAnalysis = {
  category: IncidentCategory;
  severity: IncidentSeverity;
  trust: number;
  panic: number;
  summary: string;
  action: string;
  matchedSignals: string[];
};

const categorySignals: Record<Exclude<IncidentCategory, "Community">, string[]> = {
  Crime: ["crime", "robbed", "robbery", "stolen", "theft", "break-in", "shooting", "gun", "hijack", "attack", "unsafe"],
  Infrastructure: ["water", "outage", "electricity", "power", "load shedding", "burst pipe", "road closed", "traffic lights", "sewer", "taps"],
  Medical: ["clinic", "ambulance", "injured", "sick", "medicine", "shortage", "hospital", "trapped", "bleeding", "emergency"],
  Weather: ["flood", "storm", "rain", "wind", "weather", "hail", "lightning", "river", "bridge", "washed away"],
  Scam: ["scam", "fraud", "fake", "phishing", "otp", "sassa", "bank", "link", "password"],
  Fire: ["fire", "smoke", "burning", "flames", "gas", "explosion", "burn", "evacuate"],
};

const urgentSignals = ["trapped", "fire", "shooting", "gun", "bleeding", "flood", "explosion", "missing", "danger", "evacuate", "ambulance"];
const mediumSignals = ["outage", "closed", "shortage", "stolen", "robbed", "burst", "accident", "unsafe", "scam", "fraud"];
const panicSignals = ["help", "urgent", "please", "now", "panic", "danger", "children", "elderly", "trapped", "people"];

const actionByCategory: Record<IncidentCategory, string> = {
  Crime: "Avoid the area, move to a safe public place, and contact police or local security.",
  Infrastructure: "Check official updates, conserve supplies, and share verified details with nearby residents.",
  Medical: "Call emergency medical services, keep the person stable, and direct responders to the exact location.",
  Weather: "Avoid low-lying routes, move away from flood or storm risk, and monitor official weather alerts.",
  Scam: "Do not click links or share personal details. Warn neighbors and report the scam source.",
  Fire: "Move away from smoke or flames, call emergency services, and keep access routes open.",
  Community: "Share clear details, location, and any helpful next steps for neighbors.",
};

function hits(text: string, signals: string[]) {
  return signals.filter((signal) => text.includes(signal));
}

export function analyzeIncident(message: string, hasImage = false): IncidentAnalysis {
  const text = message.toLowerCase();
  const scores = Object.entries(categorySignals).map(([category, signals]) => ({
    category: category as Exclude<IncidentCategory, "Community">,
    matched: hits(text, signals),
  }));

  scores.sort((a, b) => b.matched.length - a.matched.length);
  const best = scores[0];
  const category: IncidentCategory = best && best.matched.length > 0 ? best.category : "Community";
  const matchedSignals = best?.matched ?? [];
  const urgent = hits(text, urgentSignals);
  const medium = hits(text, mediumSignals);
  const panic = Math.min(100, hits(text, panicSignals).length * 18 + urgent.length * 20 + (hasImage ? 10 : 0));

  const severity: IncidentSeverity = urgent.length > 0 || matchedSignals.length >= 3 ? "High" : medium.length > 0 || matchedSignals.length >= 2 ? "Medium" : "Low";
  const trust = Math.min(96, 48 + matchedSignals.length * 9 + urgent.length * 7 + medium.length * 4 + (hasImage ? 12 : 0));
  const summary =
    category === "Community"
      ? "Community update submitted for local awareness."
      : `${severity} priority ${category.toLowerCase()} signal detected from this community report.`;

  return {
    category,
    severity,
    trust,
    panic,
    summary,
    action: actionByCategory[category],
    matchedSignals: [...new Set([...matchedSignals, ...urgent, ...medium])].slice(0, 6),
  };
}

export function severityClass(severity: IncidentSeverity) {
  if (severity === "High") return "bg-red-500 text-white";
  if (severity === "Medium") return "bg-amber-400 text-amber-950";
  return "bg-emerald-500 text-white";
}
