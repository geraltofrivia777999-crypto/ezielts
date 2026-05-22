import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { createClient } from "@/lib/supabase/server";
import { checkDailyLimit, incrementUsage, saveAttempt } from "@/lib/supabase/queries";
import { isProUser, subscriptionRequiredResponse } from "@/lib/supabase/access";
import { clampBand } from "@/lib/utils";
import { WRITING_ABSOLUTE_MIN_WORDS, WRITING_TASK1_MIN_WORDS, WRITING_TASK2_MIN_WORDS } from "@/lib/api-constants";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { essay, prompt, taskType, contentId } = await req.json();

    if (typeof essay !== "string" || typeof prompt !== "string" || !essay.trim() || !prompt.trim()) {
      return new Response(
        JSON.stringify({ error: "missing_fields", message: "Не указано задание или эссе." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const wordCount = essay.trim().split(/\s+/).filter(Boolean).length;
    const minWords = taskType === "task1" ? WRITING_TASK1_MIN_WORDS : WRITING_TASK2_MIN_WORDS;
    const taskLabel = taskType === "task1" ? "Task 1" : "Task 2 (Essay)";

    // Refuse trivially short submissions BEFORE touching OpenAI / daily quota.
    if (wordCount < WRITING_ABSOLUTE_MIN_WORDS) {
      return new Response(
        JSON.stringify({
          error: "too_short",
          message: `Эссе слишком короткое (${wordCount} слов). Минимум для оценки — ${WRITING_ABSOLUTE_MIN_WORDS} слов; для IELTS ${taskLabel} требуется ${minWords}.`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();

    if (!user) {
      return new Response(
        JSON.stringify({ error: "unauthenticated", message: "Войдите в аккаунт, чтобы получить AI Feedback." }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!(await isProUser(sb, user.id))) {
      return subscriptionRequiredResponse();
    }

    if (user) {
      const allowed = await checkDailyLimit(sb, user.id, "writing");
      if (!allowed) {
        return new Response(
          JSON.stringify({ error: "limit_reached", message: "AI Writing доступен только по подписке Pro." }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        );
      }
      // NOTE: incrementUsage moved to AFTER successful AI evaluation so that
      // failed OpenAI calls do not burn the user's daily quota.
    }

    const systemPrompt = `You are an expert IELTS examiner with 15+ years of experience.
Evaluate writing using official IELTS band descriptors (0–9 scale, multiples of 0.5).
Always respond with valid JSON only — no markdown, no extra text.`;

    const userPrompt = `IELTS Writing ${taskLabel} — ${wordCount} words

TASK PROMPT:
${prompt}

ESSAY:
${essay}

Return ONLY valid JSON matching this exact schema:
{
  "overall_band": <number>,
  "criteria": {
    "task_achievement": { "band": <number>, "comment": "<2 sentences in Russian>" },
    "coherence_cohesion": { "band": <number>, "comment": "<2 sentences in Russian>" },
    "lexical_resource": { "band": <number>, "comment": "<2 sentences in Russian>" },
    "grammatical_range": { "band": <number>, "comment": "<2 sentences in Russian>" }
  },
  "summary": "<2–3 sentence overall comment in Russian>",
  "strengths": ["<Russian>", "<Russian>", "<Russian>"],
  "improvements": [
    { "issue": "<short Russian label>", "example": "<exact quote from essay>", "suggestion": "<specific fix in Russian>" },
    { "issue": "<short Russian label>", "example": "<exact quote from essay>", "suggestion": "<specific fix in Russian>" },
    { "issue": "<short Russian label>", "example": "<exact quote from essay>", "suggestion": "<specific fix in Russian>" }
  ],
  "corrected_intro": "<rewrite the first paragraph showing improvements>"
}

Rules:
- overall_band = average of 4 criteria rounded to nearest 0.5
- All band scores must be multiples of 0.5
- Word count minimum is ${minWords}; note in summary if under
- Be specific, cite exact phrases from the essay`;

    const { text } = await generateText({
      model: openai("gpt-4o"),
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      temperature: 0.3,
    });

    // Strip markdown code fences if model wrapped the JSON
    const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      return new Response(
        JSON.stringify({ error: "parse_error", message: "Не удалось разобрать ответ AI. Попробуйте ещё раз." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Clamp band scores server-side: GPT can hallucinate values outside the
    // IELTS scale (e.g. 9.5, 12). Never persist or return invalid bands.
    parsed.overall_band = clampBand(parsed.overall_band);
    if (parsed.criteria && typeof parsed.criteria === "object") {
      for (const key of Object.keys(parsed.criteria)) {
        const c = parsed.criteria[key];
        if (c && typeof c === "object") c.band = clampBand(c.band);
      }
    }

    // AI evaluation succeeded — NOW charge the daily quota.
    if (user) {
      try { await incrementUsage(sb, user.id, "writing"); } catch { /* non-fatal */ }
    }

    // Save attempt
    if (user && contentId) {
      try {
        await saveAttempt(sb, {
          user_id: user.id,
          content_type: "writing",
          content_id: contentId,
          answers: { essay },
          band_score: parsed.overall_band,
          raw_score: null,
          total_questions: null,
          time_spent: null,
          ai_feedback: parsed,
          completed_at: new Date().toISOString(),
        });
      } catch { /* Non-fatal */ }
    }

    return Response.json(parsed);
  } catch (err) {
    console.error("[writing-api]", err);
    return new Response("Internal server error", { status: 500 });
  }
}
