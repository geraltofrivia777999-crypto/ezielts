#!/usr/bin/env python3
"""Generate IELTS Writing Task 1 prompts via AI.

Task 1 Academic: describe a chart/graph/table/diagram/map/process (150+ words, 20 min).
Task 1 General: write a letter (formal/semi-formal/informal) (150+ words).
"""
import os
import json
import uuid
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client
from openai import OpenAI
from tqdm import tqdm

load_dotenv(Path(__file__).parent.parent / ".env.local")
SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
OPENAI_KEY = os.environ["OPENAI_API_KEY"]

sb = create_client(SUPABASE_URL, SUPABASE_KEY)
ai = OpenAI(api_key=OPENAI_KEY)

# How many of each type to generate
N_ACADEMIC = 30  # bar/line/pie chart, table, diagram, map, process
N_GENERAL = 20   # formal/semi/informal letters


def generate_academic_batch(n: int) -> list[dict]:
    """Generate Academic Task 1 prompts (chart description)."""
    response = ai.chat.completions.create(
        model="gpt-4o",
        temperature=0.8,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an IELTS examiner generating Writing Task 1 (Academic) prompts.\n"
                    "Each prompt MUST describe a specific visual (chart/graph/table/diagram/map/process) with concrete data.\n"
                    "Examples of good prompts:\n"
                    "- 'The bar chart below shows the percentage of households with internet access in 5 countries from 2010 to 2020. Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.'\n"
                    "- 'The diagrams below show how the process of glass recycling works. Summarise the information by selecting and reporting the main features. Write at least 150 words.'\n"
                    "- 'The map below shows changes to the town of Linton between 1985 and 2020. Summarise...'\n\n"
                    "Return JSON: {\"prompts\": [{\"type\": \"bar_chart\"|\"line_chart\"|\"pie_chart\"|\"table\"|\"diagram\"|\"map\"|\"process\", \"prompt\": \"...\", \"sample_answer\": \"...\"}]}\n"
                    "sample_answer should be a Band 8+ model answer (180-200 words)."
                ),
            },
            {"role": "user", "content": f"Generate {n} diverse Task 1 Academic prompts. Mix all 7 types. Make data realistic and varied (different topics: education, transport, energy, demographics, environment, etc.)."},
        ],
        response_format={"type": "json_object"},
    )
    data = json.loads(response.choices[0].message.content)
    return data.get("prompts", [])


def generate_general_batch(n: int) -> list[dict]:
    """Generate General Task 1 prompts (letter writing)."""
    response = ai.chat.completions.create(
        model="gpt-4o",
        temperature=0.8,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an IELTS examiner generating Writing Task 1 (General Training) prompts.\n"
                    "Each prompt is a letter task. Include 3 bullet points of what to address.\n"
                    "Example:\n"
                    "'You recently bought an item online but received the wrong product.\n"
                    "Write a letter to the company. In your letter:\n"
                    "- describe what you ordered and what you received\n"
                    "- explain how this has affected you\n"
                    "- say what you would like them to do\n"
                    "Write at least 150 words. You do NOT need to write any addresses.'\n\n"
                    "Return JSON: {\"prompts\": [{\"tone\": \"formal\"|\"semi_formal\"|\"informal\", \"prompt\": \"...\", \"sample_answer\": \"...\"}]}\n"
                    "sample_answer should be a Band 8+ model letter (170-200 words)."
                ),
            },
            {"role": "user", "content": f"Generate {n} diverse General Training Task 1 letter prompts. Mix formal (complaints/requests to companies), semi-formal (to managers/landlords), and informal (to friends/family). Different topics: complaints, invitations, apologies, requests, advice."},
        ],
        response_format={"type": "json_object"},
    )
    data = json.loads(response.choices[0].message.content)
    return data.get("prompts", [])


def insert_task(prompt_text: str, sample: str, exam_type: str, ext_id: str):
    sb.table("writing_tasks").upsert({
        "external_id":  ext_id,
        "source":       "ai_generated",
        "task_type":    "task1",
        "exam_type":    exam_type,
        "prompt_text":  prompt_text,
        "sample_answer": sample,
        "min_words":    150,
        "image_url":    None,
    }, on_conflict="external_id").execute()


def main():
    print(f"Generating {N_ACADEMIC} Academic + {N_GENERAL} General Task 1 prompts...\n")

    # Academic
    BATCH = 5
    for i in tqdm(range(0, N_ACADEMIC, BATCH), desc="Academic"):
        n = min(BATCH, N_ACADEMIC - i)
        try:
            prompts = generate_academic_batch(n)
            for p in prompts:
                ext_id = f"ai_t1_academic_{uuid.uuid4().hex[:8]}"
                insert_task(p.get("prompt", ""), p.get("sample_answer", ""), "academic", ext_id)
        except Exception as e:
            print(f"  Batch failed: {e}")

    # General
    for i in tqdm(range(0, N_GENERAL, BATCH), desc="General"):
        n = min(BATCH, N_GENERAL - i)
        try:
            prompts = generate_general_batch(n)
            for p in prompts:
                ext_id = f"ai_t1_general_{uuid.uuid4().hex[:8]}"
                insert_task(p.get("prompt", ""), p.get("sample_answer", ""), "general", ext_id)
        except Exception as e:
            print(f"  Batch failed: {e}")

    print(f"\n✅ Done")


if __name__ == "__main__":
    main()
