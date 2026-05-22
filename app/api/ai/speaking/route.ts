import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { createClient } from "@/lib/supabase/server";
import { checkDailyLimit, incrementUsage, saveAttempt } from "@/lib/supabase/queries";
import { isProUser, subscriptionRequiredResponse } from "@/lib/supabase/access";
import { clampBand } from "@/lib/utils";
import { SPEAKING_MIN_AUDIO_BYTES, SPEAKING_MIN_TRANSCRIPT_WORDS } from "@/lib/api-constants";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audioBlob = formData.get("audio") as File | null;
    const topicText = formData.get("topic") as string;
    const part = formData.get("part") as string;
    const contentId = formData.get("contentId") as string | null;

    if (!audioBlob || !topicText) {
      return new Response("Missing audio or topic", { status: 400 });
    }

    // Auth check
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();

    if (!user) {
      return new Response(
        JSON.stringify({ error: "unauthenticated", message: "Войдите в аккаунт, чтобы получить AI Speaking оценку." }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!(await isProUser(sb, user.id))) {
      return subscriptionRequiredResponse();
    }

    if (user) {
      const allowed = await checkDailyLimit(sb, user.id, "speaking");
      if (!allowed) {
        return new Response(
          JSON.stringify({ error: "limit_reached", message: "AI Speaking доступен только по подписке Pro." }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        );
      }
      // incrementUsage deferred to after successful AI evaluation
    }

    // Validate audio blob (must be > SPEAKING_MIN_AUDIO_BYTES to be real recording)
    if (audioBlob.size < SPEAKING_MIN_AUDIO_BYTES) {
      return new Response(
        JSON.stringify({ error: "no_audio", message: "Запись пустая или слишком короткая. Нажмите 'Запись' и говорите минимум 5 секунд." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Step 1: Transcribe with Whisper via OpenAI API
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: "config", message: "OPENAI_API_KEY не настроен на сервере." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Pick filename extension by mime type (Whisper supports webm/mp4/ogg/m4a/mp3/wav)
    const mime = audioBlob.type || "audio/webm";
    const ext = mime.includes("mp4") ? "mp4"
      : mime.includes("ogg") ? "ogg"
      : mime.includes("wav") ? "wav"
      : mime.includes("mpeg") ? "mp3"
      : "webm";

    const whisperForm = new FormData();
    whisperForm.append("file", audioBlob, `audio.${ext}`);
    whisperForm.append("model", "whisper-1");
    whisperForm.append("language", "en");
    whisperForm.append("response_format", "json");

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: whisperForm,
    });

    let transcript = "";
    if (whisperRes.ok) {
      const whisperData = await whisperRes.json();
      transcript = (whisperData.text ?? "").trim();
    } else {
      const errText = await whisperRes.text();
      console.error("[speaking-api] Whisper error:", whisperRes.status, errText.slice(0, 200));
    }

    if (!transcript) {
      return new Response(
        JSON.stringify({ error: "no_audio", message: "Не удалось распознать речь. Говорите чётко и убедитесь что микрофон работает." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Word count check
    const wordCount = transcript.split(/\s+/).filter(Boolean).length;
    if (wordCount < SPEAKING_MIN_TRANSCRIPT_WORDS) {
      return new Response(
        JSON.stringify({ error: "too_short", message: `Распознано только ${wordCount} слов. Говорите дольше для оценки.` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Step 2: GPT-4o assessment based on real transcript
    const systemPrompt = `You are an expert IELTS Speaking examiner with 15+ years of experience.
Assess speaking responses using official IELTS Speaking band descriptors (0-9 scale, multiples of 0.5).
Evaluate four criteria:
- Fluency & Coherence (FC)
- Lexical Resource (LR)
- Grammatical Range & Accuracy (GRA)
- Pronunciation (PR — assess from transcript: word stress patterns, complex sounds, intonation cues)
Always respond with valid JSON only — no markdown, no extra text.`;

    const userPrompt = `IELTS Speaking — Part ${part}

TOPIC:
${topicText}

CANDIDATE'S TRANSCRIBED RESPONSE (${wordCount} words):
"""
${transcript}
"""

Return ONLY valid JSON in this exact schema:
{
  "overall_band": <number 0-9, multiple of 0.5, average of 4 criteria>,
  "fluency_coherence": <number 0-9>,
  "lexical_resource": <number 0-9>,
  "grammatical_range": <number 0-9>,
  "pronunciation": <number 0-9>,
  "transcript": <full transcript text as string>,
  "summary": "<2-3 sentences in Russian: overall impression and main areas>",
  "criteria_comments": {
    "fluency_coherence": "<2 sentences in Russian with concrete reason for FC score>",
    "lexical_resource": "<2 sentences in Russian with concrete reason for LR score>",
    "grammatical_range": "<2 sentences in Russian with concrete reason for GRA score>",
    "pronunciation": "<2 sentences in Russian with concrete reason for PR score>"
  },
  "strengths": ["<Russian strength 1>", "<Russian strength 2>"],
  "improvements": [
    { "category": "grammar", "issue": "<short Russian label>", "example": "<exact quote from transcript>", "correction": "<improved replacement in English>", "suggestion": "<specific explanation in Russian>", "severity": "major", "from_band": 4, "to_band": 6 },
    { "category": "vocabulary", "issue": "<short Russian label>", "example": "<exact quote from transcript>", "correction": "<better IELTS phrase in English>", "suggestion": "<specific explanation in Russian>", "severity": "minor", "from_band": 5, "to_band": 7 },
    { "category": "fluency", "issue": "<short Russian label>", "example": "<exact quote from transcript>", "correction": "<more fluent version in English>", "suggestion": "<specific explanation in Russian>", "severity": "major" },
    { "category": "pronunciation", "issue": "<short Russian label>", "example": "<word or phrase from transcript>", "correction": "<IPA or pronunciation hint>", "suggestion": "<specific explanation in Russian>", "severity": "minor" }
  ],
  "model_phrases": ["<better English phrase 1>", "<better English phrase 2>", "<better English phrase 3>"]
}

Rules:
- Be specific, cite exact words/phrases from the transcript
- For every improvement, "example" must be copied exactly from the transcript when possible
- "correction" must be a direct replacement or pronunciation hint, not a long explanation
- Use category only from: fluency, vocabulary, grammar, pronunciation
- Band scores must be multiples of 0.5
- If transcript is very short (< 30 words), reflect that in lower fluency band
- Pronunciation: infer from spelling patterns and word choice complexity`;

    const { text } = await generateText({
      model: openai("gpt-4o"),
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      temperature: 0.3,
    });

    // Strip markdown code fences if model wrapped the JSON
    const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    let feedback;
    try {
      feedback = JSON.parse(clean);
    } catch (parseErr) {
      console.error("[speaking-api] JSON parse error:", parseErr, "\nRaw text:", text.slice(0, 300));
      return new Response(
        JSON.stringify({ error: "parse_error", message: "Не удалось разобрать ответ AI." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Clamp all band scores to the IELTS scale [0, 9] in 0.5 steps.
    feedback.overall_band = clampBand(feedback.overall_band);
    feedback.fluency_coherence = clampBand(feedback.fluency_coherence);
    feedback.lexical_resource = clampBand(feedback.lexical_resource);
    feedback.grammatical_range = clampBand(feedback.grammatical_range);
    feedback.pronunciation = clampBand(feedback.pronunciation);

    // AI succeeded → charge quota now (not before).
    if (user) {
      try { await incrementUsage(sb, user.id, "speaking"); } catch { /* non-fatal */ }
    }

    // Save attempt
    if (user && contentId) {
      try {
        await saveAttempt(sb, {
          user_id: user.id,
          content_type: "speaking",
          content_id: contentId,
          answers: { transcript },
          band_score: feedback.overall_band,
          raw_score: null,
          total_questions: null,
          time_spent: null,
          ai_feedback: feedback,
          completed_at: new Date().toISOString(),
        });
      } catch {
        // Non-fatal
      }
    }

    return Response.json(feedback);
  } catch (err) {
    console.error("[speaking-api] Unhandled error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
