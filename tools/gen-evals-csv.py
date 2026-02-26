"""Generate evals.csv from brief.json evalSets.
Usage: python tools/gen-evals-csv.py <brief.json> <output.csv>
"""
import json
import csv
import sys

if len(sys.argv) != 3:
    print(f"Usage: {sys.argv[0]} <brief.json> <output.csv>")
    sys.exit(1)

brief_path = sys.argv[1]
csv_path = sys.argv[2]

with open(brief_path, "r", encoding="utf-8") as f:
    brief = json.load(f)

# Method display name -> CSV PascalCase mapping
METHOD_MAP = {
    "General quality": "GeneralQuality",
    "Compare meaning": "CompareMeaning",
    "Keyword match": "KeywordMatch",
    "Text similarity": "TextSimilarity",
    "Exact match": "ExactMatch",
    "Capability use": "CapabilityUse",
}

rows = []
for eval_set in brief.get("evalSets", []):
    set_methods = eval_set.get("methods", [])
    # Default: first method from set
    set_first = set_methods[0] if set_methods else {}
    set_method_type = METHOD_MAP.get(set_first.get("type", ""), set_first.get("type", ""))
    set_passing_score = str(set_first.get("score", "")) if "score" in set_first else ""

    for test in eval_set.get("tests", []):
        # Per-test method override: use test.methods if present
        test_methods = test.get("methods") or None
        if test_methods:
            first_test_method = test_methods[0] if test_methods else {}
            method_type = METHOD_MAP.get(first_test_method.get("type", ""), first_test_method.get("type", ""))
            passing_score = str(first_test_method.get("score", "")) if "score" in first_test_method else ""
        else:
            method_type = set_method_type
            passing_score = set_passing_score

        rows.append({
            "question": test["question"],
            "expectedResponse": test["expected"],
            "testMethodType": method_type,
            "passingScore": passing_score,
        })

with open(csv_path, "w", encoding="utf-8", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=["question", "expectedResponse", "testMethodType", "passingScore"], quoting=csv.QUOTE_ALL)
    writer.writeheader()
    writer.writerows(rows)

print(f"OK - Wrote {len(rows)} rows to {csv_path}")
