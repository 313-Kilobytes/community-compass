import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Bot, ExternalLink, Loader2 } from "lucide-react";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Assistant - CommunityHub" },
      { name: "description", content: "Chat with the CommunityHub assistant." },
    ],
  }),
  component: ChatPage,
});

type VoiceflowChat = {
  load: (config: VoiceflowConfig) => Promise<void> | void;
  open?: () => void;
  close?: () => void;
  destroy?: () => void;
};

type VoiceflowConfig = {
  verify: { projectID: string };
  url: string;
  versionID?: string;
  voice?: { url: string };
  render?: {
    mode: "embedded" | "overlay";
    target?: HTMLElement | null;
  };
  assistant?: {
    title?: string;
    description?: string;
    color?: string;
    persistence?: "localStorage" | "sessionStorage" | "memory";
  };
};

declare global {
  interface Window {
    voiceflow?: {
      chat?: VoiceflowChat;
    };
  }
}

const VOICEFLOW_SCRIPT_ID = "voiceflow-webchat";
const VOICEFLOW_SCRIPT_SRC = "https://cdn.voiceflow.com/widget-next/bundle.mjs";
const VOICEFLOW_PROJECT_ID = import.meta.env.VITE_VOICEFLOW_PROJECT_ID ?? "69fd9a85370afbde9ec3224c";
const VOICEFLOW_VERSION_ID = import.meta.env.VITE_VOICEFLOW_VERSION_ID;

function loadVoiceflowScript() {
  const existingScript = document.getElementById(VOICEFLOW_SCRIPT_ID);

  if (existingScript) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = VOICEFLOW_SCRIPT_ID;
    script.src = VOICEFLOW_SCRIPT_SRC;
    script.type = "text/javascript";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load the Voiceflow webchat script."));
    document.body.appendChild(script);
  });
}

function ChatPage() {
  const chatTargetRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "missing-project">(
    VOICEFLOW_PROJECT_ID ? "loading" : "missing-project",
  );

  useEffect(() => {
    if (!VOICEFLOW_PROJECT_ID) return;

    let cancelled = false;

    async function initializeVoiceflow() {
      try {
        await loadVoiceflowScript();

        if (cancelled) return;

        const config: VoiceflowConfig = {
          verify: { projectID: VOICEFLOW_PROJECT_ID },
          url: "https://general-runtime.voiceflow.com",
          voice: { url: "https://runtime-api.voiceflow.com" },
          render: {
            mode: "embedded",
            target: chatTargetRef.current,
          },
          assistant: {
            title: "CommunityHub Assistant",
            description: "Ask about clinics, NGOs, alerts, and local support.",
            color: "#7C3AED",
            persistence: "localStorage",
          },
        };

        if (VOICEFLOW_VERSION_ID) {
          config.versionID = VOICEFLOW_VERSION_ID;
        }

        await window.voiceflow?.chat?.load(config);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    initializeVoiceflow();

    return () => {
      cancelled = true;
      window.voiceflow?.chat?.close?.();
    };
  }, []);

  return (
    <div className="mx-auto flex h-[calc(100vh-5rem)] max-w-4xl flex-col overflow-hidden px-4 py-6 md:h-screen md:px-8">
      <header className="mb-6 shrink-0 pr-24">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Bot className="h-5 w-5" />
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight md:text-3xl">Community Assistant</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Chat with the CommunityHub Voiceflow assistant for local resource guidance.
        </p>
      </header>

      <section className="voiceflow-light-surface relative flex min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-white text-slate-950">
        <div ref={chatTargetRef} className="h-full min-h-0 w-full overflow-hidden" />

        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-card p-6 text-center">
            <div className="max-w-sm">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <h2 className="mt-4 text-lg font-semibold">Loading assistant</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                The Voiceflow chat will open here in a moment.
              </p>
            </div>
          </div>
        )}

        {status === "missing-project" && (
          <div className="absolute inset-0 flex items-center justify-center bg-card p-6 text-center">
            <div className="max-w-md">
              <h2 className="text-lg font-semibold">Add your Voiceflow project ID</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Set <code className="rounded bg-muted px-1.5 py-0.5">VITE_VOICEFLOW_PROJECT_ID</code> in your local
                environment, then restart the dev server.
              </p>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center bg-card p-6 text-center">
            <div className="max-w-md">
              <h2 className="text-lg font-semibold">Assistant could not load</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Check the Voiceflow project ID, approved domains, and network access.
              </p>
              <a
                href="https://docs.voiceflow.com/docs/proactive-messages"
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Voiceflow docs
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
