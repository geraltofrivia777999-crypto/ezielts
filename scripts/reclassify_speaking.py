#!/usr/bin/env python3
"""Reclassify all speaking_topics into Part 1/2/3 using GPT-4o-mini.

Rules used by the classifier:
- Part 1: short personal questions ("Where do you live?", "Do you like music?")
- Part 2: cue cards (long-turn, "Describe a person/place/event/...")
- Part 3: discussion questions ("Why do people...?", "How has X changed...?")
"""
import os
import json
import time
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


def classify_batch(topics: list[dict]) -> list[int]:
    """Classify a batch of topics. Returns list of parts (1/2/3) in same order."""
    prompt_items = "\n".join(
        f"{i+1}. {t['topic_text'][:300]}" for i, t in enumerate(topics)
    )
    response = ai.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0.1,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an IELTS Speaking examiner. Classify each topic into Part 1, 2, or 3.\n"
                    "Part 1: short personal questions (e.g. 'Where do you live?', 'Do you cook?').\n"
                    "Part 2: cue cards — long-turn descriptions (e.g. 'Describe a person who...', 'Talk about a time when...').\n"
                    "Part 3: abstract/discussion questions (e.g. 'Why do people...?', 'How has X changed in your country?').\n"
                    "Return ONLY a JSON object: {\"parts\": [1, 2, 3, ...]} — list of integers in input order."
                ),
            },
            {"role": "user", "content": prompt_items},
        ],
        response_format={"type": "json_object"},
    )
    data = json.loads(response.choices[0].message.content)
    parts = data.get("parts", [])
    if len(parts) != len(topics):
        # Fallback: pad with 2
        parts = (parts + [2] * len(topics))[:len(topics)]
    return parts


def main():
    print("Fetching speaking_topics...")
    topics = sb.table("speaking_topics").select("id, topic_text, part").execute().data
    print(f"Total: {len(topics)}")

    BATCH = 15
    updated = {1: 0, 2: 0, 3: 0}

    for i in tqdm(range(0, len(topics), BATCH), desc="Classifying"):
        chunk = topics[i:i + BATCH]
        try:
            parts = classify_batch(chunk)
        except Exception as e:
            print(f"Batch {i} failed: {e}")
            time.sleep(2)
            continue

        for topic, new_part in zip(chunk, parts):
            new_part = int(new_part) if new_part in (1, 2, 3) else 2
            if new_part != topic["part"]:
                sb.table("speaking_topics").update({"part": new_part}).eq("id", topic["id"]).execute()
            updated[new_part] += 1

    print(f"\nFinal distribution:")
    for p in (1, 2, 3):
        print(f"  Part {p}: {updated[p]}")


if __name__ == "__main__":
    main()
