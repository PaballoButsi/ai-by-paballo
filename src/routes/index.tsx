import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, MessageSquare, Calendar, BookOpen, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SmartWork AI — Your AI-powered workplace productivity assistant" },
      { name: "description", content: "SmartWork AI helps you plan your day, summarize research, and boost productivity with an intelligent workplace assistant." },
      { property: "og:title", content: "SmartWork AI" },
      { property: "og:description", content: "Your AI-powered workplace productivity assistant." },
    ],
  }),
  component: LandingPage,
});

const FEATURES = [
  {
    icon: MessageSquare,
    title: "Chat",
    description:
      "Ask anything about work, focus, or productivity. Get concise, actionable advice tailored to your goals.",
  },
  {
    icon: Calendar,
    title: "Task Planner",
    description:
      "Drop your to-do list and get a time-blocked daily schedule with priorities, breaks, and tips.",
  },
  {
    icon: BookOpen,
    title: "Research",
    description:
      "Summarize any topic in seconds with structured overviews, key points, opportunities, and recommendations.",
  },
];

function LandingPage() {
  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-6 pt-24 pb-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-8 shadow-[0_0_0_1px_rgba(96,165,250,0.06),0_8px_24px_-12px_rgba(37,99,235,0.35)]">
          <Sparkles className="h-7 w-7" />
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight bg-gradient-to-r from-foreground via-accent to-primary bg-clip-text text-transparent">
          SmartWork AI
        </h1>
        <p className="mt-4 text-lg sm:text-xl text-muted-foreground max-w-xl">
          Your AI-powered workplace productivity assistant
        </p>
        <div className="mt-8">
          <Link
            to="/chat"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-base font-medium text-primary-foreground shadow-md shadow-primary/20 transition-colors hover:bg-primary/90"
          >
            Get Started
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="flex-1 px-6 pb-24">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-6 sm:grid-cols-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-glow)] transition hover:border-primary/40"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {f.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted-foreground">
        Powered by Lovable AI
      </footer>
    </div>
  );
}
