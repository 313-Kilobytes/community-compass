import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { resources } from "@/data/resources";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Assistant — CommunityHub" },
      { name: "description", content: "Ask the community assistant about clinics, NGOs, jobs and alerts." },
    ],
  }),
  component: ChatPage,
});

interface Msg { role: "user" | "assistant"; text: string }

const INTRO: Msg = {
  role: "assistant",
  text: "Hi! Ask me about clinics, NGOs, jobs, or municipal alerts. Try: \"free clinic\" or \"jobs for beginners\".",
};

// Cache repeated queries
const cache = new Map<string, string>();

function retrieve(query: string) {
  const q = query.toLowerCase();
  const tokens = q.split(/\s+/).filter((t) => t.length > 2);
  const scored = resources
    .map((r) => {
      const hay = `${r.name} ${r.description} ${r.tags.join(" ")} ${r.type}`.toLowerCase();
      let s = 0;
      for (const t of tokens) if (hay.includes(t)) s++;
      if (q.includes(r.type)) s += 2;
      return { r, s };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
  return scored.slice(0, 3).map((x) => x.r);
}

function reply(query: string): string {
  const cached = cache.get(query);
  if (cached) return cached;

  const q = query.toLowerCase().trim();
  let answer: string;

  if (!q) answer = "Please type a question.";
  else if (/^(hi|hello|hey)/.test(q)) answer = "Hello! What kind of community resource are you looking for?";
  else if (q.includes("thank")) answer = "You're welcome! Anything else I can help with?";
  else {
    const hits = retrieve(q);
    if (hits.length === 0) {
      answer = "I couldn't find a match. Try keywords like 'clinic', 'youth NGO', 'jobs', or 'outage'.";
    } else {
      const top = hits[0];
      const more = hits.slice(1).map((r) => r.name).join(", ");
      answer = `Try ${top.name} — ${top.description} (${top.location}).${more ? ` Also: ${more}.` : ""}`;
    }
  }

  cache.set(query, answer);
  return answer;
}

function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([INTRO]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    const next: Msg[] = [...messages, { role: "user", text }];
    setMessages([...next, { role: "assistant", text: reply(text) }]);
    setInput("");
  };

  const suggestions = ["Free clinic", "NGOs for youth", "Entry-level jobs", "Power outage"];

  return (
    <div className="flex flex-col h-[calc(100vh-0px)] md:h-screen max-w-3xl mx-auto px-4 md:px-8 py-6">
      <header className="mb-4">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Community Assistant</h1>
        <p className="text-muted-foreground text-sm">Lightweight retrieval — short, focused answers.</p>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto bg-card border border-border rounded-xl p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
              m.role === "user"
                ? "bg-primary text-primary-foreground rounded-br-sm"
                : "bg-secondary text-secondary-foreground rounded-bl-sm"
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => { setInput(s); }}
            className="text-xs px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground hover:bg-muted"
          >
            {s}
          </button>
        ))}
      </div>

      <form onSubmit={send} className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about a resource…"
          className="flex-1 px-4 py-2.5 rounded-lg bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 inline-flex items-center gap-1.5 text-sm font-medium">
          <Send className="h-4 w-4" /> Send
        </button>
      </form>
    </div>
  );
}
