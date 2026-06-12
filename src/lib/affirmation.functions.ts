import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

export const getAffirmation = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");

  const gateway = createLovableAiGatewayProvider(key);
  const model = gateway("google/gemini-3-flash-preview");

  const { text } = await generateText({
    model,
    prompt:
      "Generate one short, powerful workplace motivational quote for today. Maximum 20 words. Make it original, actionable, and professional. Return only the quote, no author name, no quotation marks, no preamble.",
  });

  return { quote: text.trim().replace(/^["'""]|["'""]$/g, "") };
});