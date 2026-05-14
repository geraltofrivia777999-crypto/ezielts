#!/usr/bin/env python3
"""Use AI to reclassify writing_tasks into Task 1 vs Task 2.

IELTS Writing:
- Task 1 (Academic): describe a chart/graph/diagram/map/process (150+ words)
- Task 1 (General): write a letter (formal/semi-formal/informal) (150+ words)
- Task 2: essay on a topic (opinion/discuss/problem-solution/compare) (250+ words)
"""
import os
import json
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


def classify_batch(tasks: list[dict]) -> list[dict]:
    """Returns list of {task_type, exam_type, min_words} per task in order."""
    items = "\n\n".join(
        f"[{i+1}] {t['prompt_text'][:500]}" for i, t in enumerate(tasks)
    )
    response = ai.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0.1,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an IELTS Writing examiner. Classify each task prompt.\n"
                    "Return JSON: {\"items\": [{\"task_type\": \"task1\"|\"task2\", \"exam_type\": \"academic\"|\"general\", \"min_words\": 150|250}, ...]}\n\n"
                    "Rules:\n"
                    "- task1 academic: describes a chart/graph/diagram/map/process. Keywords: 'the chart shows', 'the graph', 'the diagram', 'the table', 'the map shows', 'summarise the information'.\n"
                    "- task1 general: a letter request. Keywords: 'write a letter', 'you should explain'.\n"
                    "- task2 (any): an essay topic. Keywords: 'discuss', 'to what extent do you agree', 'some people believe', 'in your opinion', 'advantages and disadvantages'.\n"
                    "- task1 → min_words: 150. task2 → min_words: 250."
                ),
            },
            {"role": "user", "content": items},
        ],
        response_format={"type": "json_object"},
    )
    data = json.loads(response.choices[0].message.content)
    return data.get("items", [])


def main():
    tasks = sb.table("writing_tasks").select("id, task_type, exam_type, prompt_text, min_words").execute().data
    print(f"Total writing tasks: {len(tasks)}")

    BATCH = 8
    counts = {"task1_academic": 0, "task1_general": 0, "task2_academic": 0, "task2_general": 0}

    for i in tqdm(range(0, len(tasks), BATCH), desc="Classifying"):
        chunk = tasks[i:i + BATCH]
        try:
            results = classify_batch(chunk)
        except Exception as e:
            print(f"  Batch {i} failed: {e}")
            continue

        for task, result in zip(chunk, results):
            task_type = result.get("task_type", "task2")
            exam_type = result.get("exam_type", "academic")
            min_words = int(result.get("min_words", 150 if task_type == "task1" else 250))

            if task_type not in ("task1", "task2"):
                task_type = "task2"
            if exam_type not in ("academic", "general"):
                exam_type = "academic"

            updates = {}
            if task_type != task["task_type"]:
                updates["task_type"] = task_type
            if exam_type != task["exam_type"]:
                updates["exam_type"] = exam_type
            if min_words != (task["min_words"] or 0):
                updates["min_words"] = min_words

            if updates:
                try:
                    sb.table("writing_tasks").update(updates).eq("id", task["id"]).execute()
                except Exception as e:
                    print(f"  Update failed for {task['id']}: {e}")

            counts[f"{task_type}_{exam_type}"] += 1

    print(f"\nFinal distribution:")
    for k, v in counts.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
