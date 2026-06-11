import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

type Mode = "chat" | "planner" | "research";

const SYSTEM_PROMPTS: Record<Mode, string> = {
  chat: `You are SmartWork AI, a professional workplace productivity assistant.
Give short, clear, professional advice with actionable suggestions.
Be concise and practical. Use markdown for formatting when helpful.`,

  planner: `You are SmartWork AI in TASK PLANNER mode.
The user will give you a list of tasks. Generate a structured daily schedule using time-block scheduling.

Always respond using this exact markdown structure:

## 🗓️ Your Daily Schedule

Use a table with columns: Time | Task | Priority (🔴 Urgent / 🟡 Important / 🟢 Normal)
Include short breaks (10-15 min) between deep work blocks and a lunch break.
Order tasks so urgent + important come first in the morning when focus is highest.

## ✅ Priorities
- Bullet list of top 3 priorities for the day

## 💡 Productivity Tips
- 3 short, actionable tips tailored to today's workload`,

  research: `You are SmartWork AI in RESEARCH mode.
The user will give you a topic. Produce a structured research summary.

Always respond using this exact markdown structure:

## 📋 Overview
2-3 sentence summary of the topic.

## 🔑 Key Points
- 4-6 bullet points covering the most important facts.

## 🚀 Opportunities
- 3-4 bullets on opportunities or strengths.

## ⚠️ Risks
- 3-4 bullets on risks, challenges, or limitations.

## 🎯 Recommendations
- 3-4 actionable recommendations.`,
};

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as { messages?: UIMessage[]; mode?: Mode };
        const messages = body.messages;
        const mode: Mode = body.mode ?? "chat";

        if (!Array.isArray(messages)) {
          return new Response("messages required", { status: 400 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        const result = streamText({
          model,
          system: SYSTEM_PROMPTS[mode],
          messages: await convertToModelMessages(messages),
        });

        return result.toUIMessageStreamResponse({ originalMessages: messages });
      },
    },
  },
});