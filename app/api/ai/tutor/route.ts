import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { createClient } from "@/lib/supabase/server";
import { checkDailyLimit, incrementUsage, saveTutorMessage } from "@/lib/supabase/queries";
import { isProUser, subscriptionRequiredResponse } from "@/lib/supabase/access";

export const maxDuration = 30;

const BASE_PROMPT = `You are an expert IELTS tutor helping students from Russia, Kazakhstan, and other CIS countries.
You are knowledgeable about all 4 IELTS modules: Reading, Listening, Writing, and Speaking.
You speak Russian fluently and switch between Russian and English as needed.
Keep responses concise (3-5 sentences) and always end with a practical tip or example.
If the student asks about grammar, vocabulary, or test strategy — give specific IELTS-focused advice.

IMPORTANT — Use the student context below to give PERSONALIZED advice:
- When the student asks "how am I doing" / "что мне делать" / "where do I stand" — refer to their actual bands and weakest skill.
- When discussing a specific skill — mention their current band and recent attempt patterns.
- When relevant, quote the student's own essay/transcript examples from their latest AI feedback.
- If they have an exam date — factor in the time left.
- If a field is "не указано" / "no data yet" — say so politely and suggest a path to fill it.`;

/* eslint-disable @typescript-eslint/no-explicit-any */
async function buildStudentContext(sb: any, userId: string): Promise<string> {
  try {
    // Profile + subscription summary from view
    const { data: summary } = await sb
      .from("v_user_summary")
      .select("name, target_band, exam_date, exam_type, band_reading, band_listening, band_writing, band_speaking, streak, plan")
      .eq("id", userId)
      .single();

    // Last 10 attempts with AI feedback for color
    const { data: attempts } = await sb
      .from("user_test_attempts")
      .select("content_type, band_score, raw_score, total_questions, ai_feedback, completed_at")
      .eq("user_id", userId)
      .order("completed_at", { ascending: false })
      .limit(10);

    if (!summary && (!attempts || attempts.length === 0)) {
      return "STUDENT CONTEXT: New user — no data yet. Suggest the diagnostic test (/diagnostic) as first step.";
    }

    const lines: string[] = ["=== STUDENT CONTEXT ==="];
    if (summary) {
      lines.push(`Name: ${summary.name ?? "Студент"}`);
      lines.push(`Target band: ${summary.target_band ?? "не указано"}`);
      lines.push(`Exam type: ${summary.exam_type ?? "unknown"}`);
      if (summary.exam_date) {
        const days = Math.max(0, Math.ceil((new Date(summary.exam_date).getTime() - Date.now()) / 86_400_000));
        lines.push(`Exam date: ${summary.exam_date} (${days} days left)`);
      } else {
        lines.push(`Exam date: not set`);
      }
      lines.push(`Plan: ${summary.plan ?? "free"} · Streak: ${summary.streak ?? 0} days`);
      lines.push(`Current bands:`);
      lines.push(`  - Reading: ${summary.band_reading ?? "no data"}`);
      lines.push(`  - Listening: ${summary.band_listening ?? "no data"}`);
      lines.push(`  - Writing: ${summary.band_writing ?? "no data"}`);
      lines.push(`  - Speaking: ${summary.band_speaking ?? "no data"}`);

      // Identify weakest skill
      const skillBands: [string, number | null][] = [
        ["Reading", summary.band_reading],
        ["Listening", summary.band_listening],
        ["Writing", summary.band_writing],
        ["Speaking", summary.band_speaking],
      ];
      const filled = skillBands.filter(([, b]) => typeof b === "number" && b > 0) as [string, number][];
      if (filled.length > 0) {
        const weakest = filled.sort((a, b) => a[1] - b[1])[0];
        lines.push(`Weakest skill: ${weakest[0]} (${weakest[1]})`);
      }
    }

    if (attempts && attempts.length > 0) {
      lines.push(`\nRecent attempts (last ${attempts.length}):`);
      for (const a of attempts as any[]) {
        const date = new Date(a.completed_at).toLocaleDateString("en-CA");
        let line = `  - ${date} · ${a.content_type} · band ${a.band_score ?? "—"}`;
        if (a.raw_score !== null && a.total_questions) {
          line += ` (${a.raw_score}/${a.total_questions})`;
        }
        lines.push(line);
      }

      // Pull the most recent AI feedback summary for context
      const latestWithFeedback = (attempts as any[]).find(
        (a) => a.ai_feedback && typeof a.ai_feedback === "object"
      );
      if (latestWithFeedback) {
        const fb = latestWithFeedback.ai_feedback as Record<string, unknown>;
        const summary_text = (fb.summary as string) ?? "";
        const improvements = fb.improvements as Array<{ issue?: string; suggestion?: string }> | undefined;
        if (summary_text) {
          lines.push(`\nLatest AI feedback (${latestWithFeedback.content_type}):`);
          lines.push(`  Summary: ${summary_text.slice(0, 300)}`);
        }
        if (Array.isArray(improvements) && improvements.length > 0) {
          lines.push(`  Top issues:`);
          for (const imp of improvements.slice(0, 3)) {
            if (imp.issue) lines.push(`    - ${imp.issue}: ${(imp.suggestion ?? "").slice(0, 150)}`);
          }
        }
      }
    }

    lines.push("=== END CONTEXT ===");
    return lines.join("\n");
  } catch (err) {
    console.error("[tutor context]", err);
    return "";
  }
}

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

    if (!(await isProUser(sb, user.id))) {
      return subscriptionRequiredResponse();
    }

    const allowed = await checkDailyLimit(sb, user.id, "ai_tutor");
    if (!allowed) {
      return new Response(
        JSON.stringify({
          error: "limit_reached",
          message: "AI-тьютор доступен только по подписке Pro.",
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

    // Build personalized context from user's tests and profile
    const studentContext = await buildStudentContext(sb, user.id);
    const systemPrompt = studentContext
      ? `${BASE_PROMPT}\n\n${studentContext}`
      : BASE_PROMPT;

    const result = streamText({
      model: openai("gpt-4o-mini"),
      system: systemPrompt,
      messages,
      temperature: 0.7,
      maxOutputTokens: 500,
      onFinish: async ({ text }) => {
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
