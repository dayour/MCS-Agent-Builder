"""Migrate brief.json from old evals/scenarios format to evalSets format.
Usage: python tools/migrate-evals.py <brief.json> <evalsets.json>
  brief.json - the agent brief to update
  evalsets.json - JSON file with {"evalSets": [...], "evalConfig": {...}}
"""
import json
import sys
from datetime import datetime

if len(sys.argv) != 3:
    print(f"Usage: {sys.argv[0]} <brief.json> <evalsets.json>")
    sys.exit(1)

brief_path = sys.argv[1]
evalsets_path = sys.argv[2]

with open(brief_path, "r", encoding="utf-8") as f:
    brief = json.load(f)

with open(evalsets_path, "r", encoding="utf-8") as f:
    new_data = json.load(f)

# Remove deprecated fields
removed = []
for key in ["scenarios", "evals", "evalResults"]:
    if key in brief:
        removed.append(key)
        del brief[key]

# Add new fields
brief["evalSets"] = new_data["evalSets"]
brief["evalConfig"] = new_data["evalConfig"]
brief["updated_at"] = datetime.now().isoformat()

# Count tests
total_tests = sum(len(s["tests"]) for s in brief["evalSets"])
set_counts = {s["name"]: len(s["tests"]) for s in brief["evalSets"]}

with open(brief_path, "w", encoding="utf-8") as f:
    json.dump(brief, f, indent=2, ensure_ascii=False)

print(f"OK - Updated {brief_path}")
print(f"  Removed: {', '.join(removed) if removed else 'none'}")
print(f"  Added: evalSets ({total_tests} tests), evalConfig")
for name, count in set_counts.items():
    print(f"    {name}: {count} tests")
