import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { createClient } from "@/lib/supabase/server";
import { checkDailyLimit, incrementUsage } from "@/lib/supabase/queries";

export const maxDuration = 30;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function cleanText(value: unknown, max = 5000): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const questionNumber = Number(body.questionNumber);
    const questionText = cleanText(body.questionText, 900);
    const instruction = cleanText(body.instruction, 700);
    const correctAnswer = cleanText(body.correctAnswer, 400);
    const userAnswer = cleanText(body.userAnswer, 400);
    const passageText = cleanText(body.passageText, 5000);
    const options = Array.isArray(body.options)
      ? body.options.map((option: unknown, index: number) => `${String.fromCharCode(65 + index)}. ${cleanText(option, 500)}`).join("\n")
      : "";
    const messages = Array.isArray(body.messages) ? body.messages as ChatMessage[] : [];

    if (!questionNumber || !questionText || !correctAnswer || !passageText) {
      return Response.json(
        { error: "missing_fields", message: "Не хватает текста вопроса, passage или правильного ответа." },
        { status: 400 }
      );
    }

    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();

    if (!user) {
      return Response.json({ error: "unauthenticated" }, { status: 401 });
    }

    const allowed = await checkDailyLimit(sb, user.id, "ai_tutor");
    if (!allowed) {
      return Response.json(
        {
          error: "limit_reached",
          message: "Лимит AI-тьютора исчерпан. Обновитесь до Pro или попробуйте позже.",
        },
        { status: 429 }
      );
    }

    const previousDialogue = messages
      .slice(-6)
      .map((m) => `${m.role === "user" ? "Student" : "Tutor"}: ${cleanText(m.content, 700)}`)
      .join("\n");

    const system = `You are an IELTS Reading tutor.
Explain answers in Russian, with English evidence from the passage when useful.
Be concise, practical, and specific to the provided passage.
Never invent passage details that are not in the provided text.`;

    const prompt = `IELTS Reading question ${questionNumber}

INSTRUCTION:
${instruction}

QUESTION:
${questionText}

OPTIONS:
${options || "(no options)"}

PASSAGE:
${passageText}

STUDENT ANSWER:
${userAnswer || "(empty)"}

CORRECT ANSWER:
${correctAnswer}

${previousDialogue ? `PREVIOUS DIALOGUE:\n${previousDialogue}\n` : ""}

Explain:
1. Why the correct answer is "${correctAnswer}".
2. Which sentence or wording in the passage proves it.
3. Whether the student's answer is acceptable.
4. What IELTS Reading trap or skill is involved.

Answer in Russian in 4-7 short sentences.`;

    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      system,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      maxOutputTokens: 500,
    });

    try { await incrementUsage(sb, user.id, "ai_tutor"); } catch { /* non-fatal */ }

    return Response.json({ explanation: text.trim() });
  } catch (err) {
    console.error("[reading-explain-api]", err);
    return Response.json(
      { error: "internal", message: "Не удалось получить объяснение. Попробуйте ещё раз." },
      { status: 500 }
    );
  }
}
