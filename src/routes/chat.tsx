import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Send,
  Sparkles,
  Calendar,
  BookOpen,
  MessageSquare,
  Plus,
  Loader2,
  Menu,
  Trash2,
  Download,
  Copy,
  Check,
  Battery,
  BatteryLow,
  BatteryFull,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "SmartWork AI Assistant" },
      { name: "description", content: "Professional AI workplace assistant for task planning, research summaries, and productivity guidance." },
      { property: "og:title", content: "SmartWork AI Assistant" },
      { property: "og:description", content: "Plan your day, summarize research, and get actionable productivity advice." },
    ],
  }),
  component: ChatPage,
});

type Mode = "chat" | "planner" | "research";
type Energy = "low" | "normal" | "high";

const ENERGY_OPTIONS: { id: Energy; label: string; icon: typeof Battery }[] = [
  { id: "low", label: "Low energy", icon: BatteryLow },
  { id: "normal", label: "Normal", icon: Battery },
  { id: "high", label: "High energy", icon: BatteryFull },
];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// Parse a markdown table from the planner output: returns task rows.
function parsePlannerTasks(text: string): { time: string; task: string; priority: string }[] {
  const lines = text.split("\n");
  const tasks: { time: string; task: string; priority: string }[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t.startsWith("|") || !t.endsWith("|")) continue;
    const cells = t.slice(1, -1).split("|").map((c) => c.trim());
    if (cells.length < 3) continue;
    // Skip header + separator rows
    if (cells.every((c) => /^-+:?$|^:?-+:?$/.test(c.replace(/\s/g, "")))) continue;
    if (/^time$/i.test(cells[0]) && /^task$/i.test(cells[1])) continue;
    if (!cells[0] || !cells[1]) continue;
    tasks.push({ time: cells[0], task: cells[1], priority: cells[2] ?? "" });
  }
  return tasks;
}

// Extract first N bullets under the "Key Points" section.
function parseKeyTakeaways(text: string, n = 3): string[] {
  const lines = text.split("\n");
  const startIdx = lines.findIndex((l) => /^#+\s.*key\s*points/i.test(l));
  if (startIdx === -1) return [];
  const out: string[] = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const l = lines[i].trim();
    if (/^#+\s/.test(l)) break;
    const m = l.match(/^[-*]\s+(.*)$/);
    if (m && m[1]) out.push(m[1]);
    if (out.length >= n) break;
  }
  return out;
}

const MODES: { id: Mode; label: string; icon: typeof MessageSquare; description: string; placeholder: string }[] = [
  {
    id: "chat",
    label: "Chat",
    icon: MessageSquare,
    description: "General productivity Q&A",
    placeholder: "Ask anything about work, focus, or productivity…",
  },
  {
    id: "planner",
    label: "Task Planner",
    icon: Calendar,
    description: "Turn tasks into a daily schedule",
    placeholder: "List your tasks, e.g. report, meeting, presentation…",
  },
  {
    id: "research",
    label: "Research",
    icon: BookOpen,
    description: "Summarize any topic",
    placeholder: "Enter a topic to summarize, e.g. AI in education…",
  },
];

const SUGGESTIONS: Record<Mode, string[]> = {
  chat: [
    "What should I focus on today?",
    "How do I stay focused in long meetings?",
    "Suggest a weekly review routine.",
  ],
  planner: [
    "Plan my day: report, meeting, presentation",
    "Schedule: code review, 1:1, write spec, gym",
    "Plan a deep-work morning then admin afternoon",
  ],
  research: [
    "Summarize AI in education",
    "Summarize remote work productivity trends",
    "Summarize sustainable supply chains",
  ],
};

type Conversation = {
  id: string;
  title: string;
  mode: Mode;
  messages: UIMessage[];
  updatedAt: number;
};

const STORAGE_KEY = "smartwork.conversations.v1";

function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Conversation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function makeTitle(messages: UIMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "New conversation";
  const text = first.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ").trim();
  const words = text.split(/\s+/).slice(0, 6).join(" ");
  return words.length > 40 ? words.slice(0, 40) + "…" : words || "New conversation";
}

function ChatPage() {
  const [mode, setMode] = useState<Mode>("chat");
  const [energy, setEnergy] = useState<Energy>("normal");
  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>(() => loadConversations());
  const [activeId, setActiveId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const transport = useRef(
    new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages, body }) => ({
        body: {
          messages,
          mode: (body as { mode?: Mode } | undefined)?.mode ?? "chat",
          energy: (body as { energy?: Energy } | undefined)?.energy ?? "normal",
        },
      }),
    }),
  ).current;

  const { messages, sendMessage, status, setMessages } = useChat({
    transport,
    onError: (err) => {
      console.error(err);
      toast.error("Something went wrong. Please try again.");
    },
  });

  const isLoading = status === "submitted" || status === "streaming";
  const activeMode = MODES.find((m) => m.id === mode)!;
  const ActiveIcon = activeMode.icon;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    if (!isLoading) inputRef.current?.focus();
  }, [isLoading, mode]);

  // Persist active conversation whenever messages settle.
  useEffect(() => {
    if (isLoading) return;
    if (messages.length === 0) return;
    setConversations((prev) => {
      const id = activeId ?? crypto.randomUUID();
      if (!activeId) setActiveId(id);
      const existing = prev.find((c) => c.id === id);
      const next: Conversation = {
        id,
        title: existing?.title && existing.messages.length > 0 ? existing.title : makeTitle(messages),
        mode,
        messages,
        updatedAt: Date.now(),
      };
      const rest = prev.filter((c) => c.id !== id);
      const updated = [next, ...rest];
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore quota errors
      }
      return updated;
    });
  }, [messages, isLoading, activeId, mode]);

  const handleSend = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || isLoading) return;
    setInput("");
    await sendMessage({ text: content }, { body: { mode, energy } });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const newChat = () => {
    setMessages([]);
    setInput("");
    setActiveId(null);
    inputRef.current?.focus();
  };

  const openConversation = (c: Conversation) => {
    setActiveId(c.id);
    setMode(c.mode);
    setMessages(c.messages);
    setInput("");
    setSidebarOpen(false);
  };

  const deleteConversation = (id: string) => {
    setConversations((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
    if (activeId === id) {
      setActiveId(null);
      setMessages([]);
    }
  };

  return (
    <div className="flex h-screen w-full bg-background text-foreground">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-border bg-card transition-transform md:static md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-2 px-5 py-5 border-b border-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-tight">SmartWork AI</h1>
            <p className="text-xs text-muted-foreground">Workplace Assistant</p>
          </div>
        </div>

        <div className="p-3">
          <Button onClick={newChat} variant="outline" className="w-full justify-start gap-2">
            <Plus className="h-4 w-4" /> New conversation
          </Button>
        </div>

        {conversations.length > 0 && (
          <div className="px-3 pb-2 pt-1">
            <p className="px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              History
            </p>
            <div className="mt-1 flex max-h-64 flex-col gap-0.5 overflow-y-auto">
              {conversations.map((c) => {
                const active = c.id === activeId;
                return (
                  <div
                    key={c.id}
                    className={cn(
                      "group flex items-center gap-1 rounded-lg pr-1 transition-colors",
                      active ? "bg-accent" : "hover:bg-muted",
                    )}
                  >
                    <button
                      onClick={() => openConversation(c)}
                      className="flex-1 truncate px-3 py-2 text-left text-sm"
                      title={c.title}
                    >
                      {c.title}
                    </button>
                    <button
                      onClick={() => deleteConversation(c.id)}
                      className="rounded-md p-1.5 text-muted-foreground opacity-0 hover:bg-background hover:text-foreground group-hover:opacity-100"
                      aria-label="Delete conversation"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="px-3 pb-2 pt-1">
          <p className="px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Modes
          </p>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {MODES.map((m) => {
            const Icon = m.icon;
            const active = m.id === mode;
            return (
              <button
                key={m.id}
                onClick={() => {
                  setMode(m.id);
                  setSidebarOpen(false);
                }}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted text-foreground",
                )}
              >
                <Icon className={cn("mt-0.5 h-4 w-4", active && "text-primary")} />
                <div className="flex-1">
                  <div className="text-sm font-medium">{m.label}</div>
                  <div className="text-xs text-muted-foreground">{m.description}</div>
                </div>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto p-4 text-xs text-muted-foreground border-t border-border">
          <p className="font-medium text-foreground/80">About</p>
          <p className="mt-1">Built by Paballo Buts</p>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="flex flex-1 flex-col min-w-0">
        <header className="flex items-center gap-3 border-b border-border px-4 py-3 bg-background/80 backdrop-blur">
          <button
            className="md:hidden rounded-md p-2 hover:bg-muted"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <ActiveIcon className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{activeMode.label} mode</span>
          </div>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            · {activeMode.description}
          </span>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-smooth">
          <div className="mx-auto max-w-3xl px-4 py-6">
            {messages.length === 0 ? (
              <EmptyState mode={mode} onPick={(s) => void handleSend(s)} />
            ) : (
              <div className="flex flex-col gap-6">
                {messages.map((m) => (
                  <ChatMessage key={m.id} message={m} mode={mode} />
                ))}
                {status === "submitted" && <ThinkingBubble />}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border bg-background">
          <div className="mx-auto max-w-3xl px-4 py-4">
            <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={activeMode.placeholder}
                rows={1}
                className="flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground max-h-40"
                style={{ minHeight: "40px" }}
                disabled={isLoading}
              />
              <Button
                onClick={() => void handleSend()}
                disabled={!input.trim() || isLoading}
                size="icon"
                className="h-9 w-9 shrink-0 rounded-xl"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              SmartWork AI may produce inaccurate information. Verify important details.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function EmptyState({ mode, onPick }: { mode: Mode; onPick: (text: string) => void }) {
  const m = MODES.find((x) => x.id === mode)!;
  const Icon = m.icon;
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
        <Icon className="h-7 w-7" />
      </div>
      <h2 className="text-2xl font-semibold tracking-tight">How can I help you today?</h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-md">
        {mode === "planner"
          ? "List your tasks and I'll build a time-blocked schedule with priorities and breaks."
          : mode === "research"
          ? "Give me any topic and I'll summarize it with key points, opportunities, risks, and recommendations."
          : "Ask me anything about work, focus, or productivity."}
      </p>
      <div className="mt-8 grid w-full max-w-2xl gap-2 sm:grid-cols-3">
        {SUGGESTIONS[mode].map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="rounded-xl border border-border bg-card p-3 text-left text-sm text-foreground hover:border-primary hover:bg-accent/50 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatMessage({ message, mode }: { message: UIMessage; mode: Mode }) {
  const isUser = message.role === "user";
  const text = message.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("");
  const [copied, setCopied] = useState(false);
  const showActions = !isUser && mode === "planner" && text.trim().length > 0;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy");
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const margin = 48;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const maxWidth = pageWidth - margin * 2;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Daily Schedule", margin, margin);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(120);
      doc.text(
        `Generated ${new Date().toLocaleString()} · SmartWork AI`,
        margin,
        margin + 16,
      );
      doc.setTextColor(20);
      doc.setFontSize(11);

      const lines = doc.splitTextToSize(text, maxWidth);
      let y = margin + 40;
      const lineHeight = 15;
      for (const line of lines) {
        if (y > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(line, margin, y);
        y += lineHeight;
      }

      doc.save(`smartwork-schedule-${Date.now()}.pdf`);
      toast.success("PDF downloaded");
    } catch (err) {
      console.error(err);
      toast.error("Could not generate PDF");
    }
  };

  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </div>
      )}
      <div className="flex max-w-[85%] flex-col gap-2">
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isUser
              ? "bg-primary text-primary-foreground rounded-br-sm shadow-md shadow-primary/20"
              : "bg-card text-card-foreground border border-border rounded-bl-sm shadow-[0_0_0_1px_rgba(96,165,250,0.06),0_8px_24px_-12px_rgba(37,99,235,0.35)]",
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{text}</p>
          ) : (
            <div className="prose prose-sm max-w-none prose-headings:mt-3 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-li:my-0.5 prose-table:my-3 prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1 prose-table:border prose-th:border prose-td:border prose-th:bg-accent/40">
              <ReactMarkdown>{text || "…"}</ReactMarkdown>
            </div>
          )}
        </div>
        {showActions && (
          <div className="flex gap-2">
            <Button
              onClick={handleDownloadPdf}
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5" /> Download PDF
            </Button>
            <Button
              onClick={handleCopy}
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-success" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copy
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex gap-3 justify-start">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        AI is thinking…
      </div>
    </div>
  );
}
