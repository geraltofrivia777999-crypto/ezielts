import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { createClient } from "@/lib/supabase/server";
import { checkDailyLimit, incrementUsage } from "@/lib/supabase/queries";
import { isProUser, subscriptionRequiredResponse } from "@/lib/supabase/access";

export const maxDuration = 30;

export async function POST() {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthenticated" }), { status: 401 });
    }

    if (!(await isProUser(sb, user.id))) {
      return subscriptionRequiredResponse();
    }

    // Rate-limit: study-plan generation calls GPT — must be gated like other AI features
    // to prevent unlimited token burn per user.
    const allowed = await checkDailyLimit(sb, user.id, "study_plan");
    if (!allowed) {
      return new Response(
        JSON.stringify({
          error: "limit_reached",
          message: "Лимит генераций плана исчерпан на сегодня. Обновитесь до Pro.",
        }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const { data: profile } = await (sb as any)
      .from("profiles")
      .select("target_band, band_reading, band_listening, band_writing, band_speaking, exam_date, exam_type")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "profile_not_found" }), { status: 404 });
    }

    const daysLeft = profile.exam_date
      ? Math.max(0, Math.ceil((new Date(profile.exam_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : null;

    const userPrompt = `Generate a personalized 14-day IELTS study plan in JSON.

Student profile:
- Target band: ${profile.target_band ?? 7.0}
- Current Reading: ${profile.band_reading ?? "unknown"}
- Current Listening: ${profile.band_listening ?? "unknown"}
- Current Writing: ${profile.band_writing ?? "unknown"}
- Current Speaking: ${profile.band_speaking ?? "unknown"}
- Days until exam: ${daysLeft ?? "not set"}
- Exam type: ${profile.exam_type ?? "academic"}

Return ONLY valid JSON in this schema:
{
  "focus_skills": ["<weakest 2 skills>"],
  "overall_strategy": "<2-3 sentences in Russian explaining the strategy>",
  "days": [
    {
      "day": 1,
      "title": "<short task title in Russian>",
      "skill": "reading" | "listening" | "writing" | "speaking" | "mixed",
      "duration_min": <number 15-60>,
      "focus_area": "<specific topic e.g. 'True/False/Not Given' or 'Task 1 Pie Charts'>",
      "exercise_suggestion": "<1 sentence specific exercise tip in Russian>"
    }
  ]
}

Rules:
- 14 days total
- 60% time on 2 weakest skills, 40% on remaining
- Day 7 and 14: full mock test ("mixed")
- For Writing/Speaking: 30-45 min sessions
- For Reading/Listening: 20-30 min
- Be specific in focus_area (e.g. "Sentence Completion", not just "Reading")`;

    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      messages: [{ role: "user", content: userPrompt }],
      temperature: 0.4,
    });

    const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    let plan;
    try {
      plan = JSON.parse(clean);
    } catch {
      return new Response(JSON.stringify({ error: "parse_error" }), { status: 500 });
    }

    // AI succeeded → charge quota.
    try { await incrementUsage(sb, user.id, "study_plan"); } catch { /* non-fatal */ }

    return Response.json(plan);
  } catch (err) {
    console.error("[study-plan-api]", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}
