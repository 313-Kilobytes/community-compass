import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Send, Trash2 } from "lucide-react";
import { resources } from "@/data/resources";
import { analyzeIncident } from "@/lib/crisis-intelligence";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Assistant - CommunityHub" },
      { name: "description", content: "Ask the community assistant about saved posts, clinics, NGOs, jobs and alerts." },
    ],
  }),
  component: ChatPage,
});

interface Msg { role: "user" | "assistant"; text: string }
type FeedPost = { area: string; message: string; image?: string; createdAt: string };

const CHAT_STORAGE_KEY = "community-chat-history";
const FEED_STORAGE_KEY = "community-feed-posts";

const INTRO: Msg = {
  role: "assistant",
  text: "Hi! I can use saved community posts and local resource data. Ask about an area, incident type, clinic, NGO, job, or outage.",
};

function loadFeedPosts(): FeedPost[] {
  try {
    const saved = localStorage.getItem(FEED_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function retrieveResources(query: string) {
  const q = query.toLowerCase();
  const tokens = q.split(/\s+/).filter((t) => t.length > 2);
  const scored = resources
    .map((r) => {
      const hay = `${r.name} ${r.description} ${r.location} ${r.tags.join(" ")} ${r.type}`.toLowerCase();
      let score = 0;
      for (const token of tokens) if (hay.includes(token)) score++;
      if (q.includes(r.type)) score += 2;
      return { r, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map((item) => item.r);
}

function reply(query: string): string {
  const q = query.toLowerCase().trim();
  if (!q) return "Please type a question.";
  if (/^(hi|hello|hey)/.test(q)) return "Hello! What community information are you looking for?";
  if (q.includes("thank")) return "You're welcome. I saved this chat so you can come back to it.";

  const feedHits = loadFeedPosts()
    .map((post) => ({ post, analysis: analyzeIncident(post.message, Boolean(post.image)) }))
    .filter(({ post, analysis }) => {
      const hay = `${post.area} ${post.message} ${analysis.category} ${analysis.severity}`.toLowerCase();
      return q.split(/\s+/).some((token) => token.length > 2 && hay.includes(token));
    })
    .slice(0, 3);

  if (feedHits.length > 0) {
    return feedHits
      .map(({ post, analysis }) => `${analysis.severity} ${analysis.category} in ${post.area}: ${analysis.summary} Recommended action: ${analysis.action}`)
      .join("\n\n");
  }

  const hits = retrieveResources(q);
  if (hits.length === 0) {
    return "I couldn't find a match in saved community posts or local resource data. Try a specific area, incident type, clinic, NGO, job, or outage keyword.";
  }

  const top = hits[0];
  const more = hits.slice(1).map((r) => r.name).join(", ");
  return `Try ${top.name}: ${top.description} (${top.location}).${more ? ` Also: ${more}.` : ""}`;
}

function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([INTRO]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);
      if (saved) setMessages(JSON.parse(saved));
    } catch {
      setMessages([INTRO]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    const next: Msg[] = [...messages, { role: "user", text }];
    setMessages([...next, { role: "assistant", text: reply(text) }]);
    setInput("");
  };

  const clearHistory = () => setMessages([INTRO]);
  const suggestions = ["Water outage", "High priority alerts", "Clinic shortage", "My area"];

  return (
    <div className="flex flex-col h-[calc(100vh-0px)] md:h-screen max-w-3xl mx-auto px-4 md:px-8 py-6">
      <header className="mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Community Assistant</h1>
            <p className="text-muted-foreground text-sm">Saved chat history with answers from community posts and local resource data.</p>
          </div>
          <button
            type="button"
            onClick={clearHistory}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto bg-card border border-border rounded-xl p-4 space-y-3">
        {messages.map((message, index) => (
          <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                message.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-secondary text-secondary-foreground rounded-bl-sm"
              }`}
            >
              {message.text}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => setInput(suggestion)}
            className="text-xs px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground hover:bg-muted"
          >
            {suggestion}
          </button>
        ))}
      </div>

      <form onSubmit={send} className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about saved reports or resources..."
          className="flex-1 px-4 py-2.5 rounded-lg bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 inline-flex items-center gap-1.5 text-sm font-medium">
          <Send className="h-4 w-4" /> Send
        </button>
      </form>
    </div>
  );
}
