import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { createClient } from "@/lib/supabase/server";
import { checkDailyLimit, incrementUsage, saveTutorMessage } from "@/lib/supabase/queries";

export const maxDuration = 30;

const SYSTEM_PROMPT = `You are an expert IELTS tutor helping students from Russia, Kazakhstan, and other CIS countries.
You are knowledgeable about all 4 IELTS modules: Reading, Listening, Writing, and Speaking.
You speak Russian fluently and switch between Russian and English as needed.
Keep responses concise (3-5 sentences) and always end with a practical tip or example.
If the student asks about grammar, vocabulary, or test strategy — give specific IELTS-focused advice.
Current date context: students are actively preparing for the IELTS exam.`;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response("Invalid messages", { status: 400 });
    }

    // Auth & limit check
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();

    if (!user) {
      return new Response(
        JSON.stringify({ error: "unauthenticated" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const allowed = await checkDailyLimit(sb, user.id, "ai_tutor");
    if (!allowed) {
      return new Response(
        JSON.stringify({
          error: "limit_reached",
          message: "Вы использовали все 3 бесплатных вопроса. Обновитесь до Pro для неограниченного доступа к AI-тьютору.",
        }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    // Save user message
    const lastUserMsg = messages[messages.length - 1];
    if (lastUserMsg?.role === "user") {
      await saveTutorMessage(sb, {
        user_id: user.id,
        role: "user",
        content: lastUserMsg.content,
      });
      await incrementUsage(sb, user.id, "ai_tutor");
    }

    const result = streamText({
      model: openai("gpt-4o-mini"),
      system: SYSTEM_PROMPT,
      messages,
      temperature: 0.7,
      maxOutputTokens: 400,
      onFinish: async ({ text }) => {
        // Save assistant response
        await saveTutorMessage(sb, {
          user_id: user.id,
          role: "assistant",
          content: text,
        });
      },
    });

    return result.toTextStreamResponse();
  } catch (err) {
    console.error("[tutor-api]", err);
    return new Response("Internal server error", { status: 500 });
  }
}
