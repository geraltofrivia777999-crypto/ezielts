import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { createClient } from "@/lib/supabase/server";
import { checkDailyLimit, incrementUsage } from "@/lib/supabase/queries";
import { isProUser, subscriptionRequiredResponse } from "@/lib/supabase/access";

export const maxDuration = 30;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function cleanText(value: unknown, max = 4000): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const questionNumber = Number(body.questionNumber);
    const questionText = cleanText(body.questionText, 800);
    const correctAnswer = cleanText(body.correctAnswer, 300);
    const userAnswer = cleanText(body.userAnswer, 300);
    const sectionPrompt = cleanText(body.sectionPrompt, 3000);
    const messages = Array.isArray(body.messages) ? body.messages as ChatMessage[] : [];

    if (!questionNumber || !correctAnswer) {
      return Response.json(
        { error: "missing_fields", message: "Не хватает номера вопроса или правильного ответа." },
        { status: 400 }
      );
    }

    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();

    if (!user) {
      return Response.json({ error: "unauthenticated" }, { status: 401 });
    }

    if (!(await isProUser(sb, user.id))) {
      return subscriptionRequiredResponse();
    }

    const allowed = await checkDailyLimit(sb, user.id, "ai_tutor");
    if (!allowed) {
      return Response.json(
        {
          error: "limit_reached",
          message: "AI-разбор доступен только по подписке Pro.",
        },
        { status: 429 }
      );
    }

    const previousDialogue = messages
      .slice(-6)
      .map((m) => `${m.role === "user" ? "Student" : "Tutor"}: ${cleanText(m.content, 700)}`)
      .join("\n");

    const system = `You are an IELTS Listening tutor.
Explain answers in Russian, with English examples when useful.
Be concise, practical, and specific to the provided question.
Never invent audio transcript details that are not in the prompt.`;

    const prompt = `IELTS Listening question ${questionNumber}

QUESTION LABEL:
${questionText || `Question ${questionNumber}`}

SECTION QUESTION PAPER:
${sectionPrompt}

STUDENT ANSWER:
${userAnswer || "(empty)"}

CORRECT ANSWER:
${correctAnswer}

${previousDialogue ? `PREVIOUS DIALOGUE:\n${previousDialogue}\n` : ""}

Explain:
1. Why the correct answer is "${correctAnswer}".
2. Whether the student's answer is acceptable.
3. What signal words or grammar pattern the student should listen for next time.

Answer in Russian in 4-7 short sentences.`;

    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      system,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      maxOutputTokens: 450,
    });

    try { await incrementUsage(sb, user.id, "ai_tutor"); } catch { /* non-fatal */ }

    return Response.json({ explanation: text.trim() });
  } catch (err) {
    console.error("[listening-explain-api]", err);
    return Response.json(
      { error: "internal", message: "Не удалось получить объяснение. Попробуйте ещё раз." },
      { status: 500 }
    );
  }
}
