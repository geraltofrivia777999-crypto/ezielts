import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { createClient } from "@/lib/supabase/server";
import { checkDailyLimit, incrementUsage, saveAttempt } from "@/lib/supabase/queries";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { essay, prompt, taskType, contentId } = await req.json();

    if (!essay || !prompt) {
      return new Response("Missing essay or prompt", { status: 400 });
    }

    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();

    if (user) {
      const allowed = await checkDailyLimit(sb, user.id, "writing");
      if (!allowed) {
        return new Response(
          JSON.stringify({ error: "limit_reached", message: "Лимит Writing исчерпан. Обновитесь до Pro." }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        );
      }
      await incrementUsage(sb, user.id, "writing");
    }

    const wordCount = essay.trim().split(/\s+/).filter(Boolean).length;
    const minWords = taskType === "task1" ? 150 : 250;
    const taskLabel = taskType === "task1" ? "Task 1" : "Task 2 (Essay)";

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
      return new Response("Failed to parse AI response", { status: 500 });
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
