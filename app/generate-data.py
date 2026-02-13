#!/usr/bin/env python3
"""MCS Engagement Hub — Dashboard Data Generator

Scans Build-Guides/ folders, reads agent brief.json files, and outputs
dashboard-data.js for the dashboard.html to consume.

Usage: python app/generate-data.py
"""

import json
import os
import re
import csv
from datetime import datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
BASE_DIR = SCRIPT_DIR.parent
BUILD_GUIDES = BASE_DIR / "Build-Guides"
OUTPUT_FILE = BASE_DIR / "dashboard-data.js"

# Project-root level files (legacy + current)
PROJECT_FILE_MAP = {
    "sdr_raw": "sdr-raw.md",
    "customer_context": "customer-context.md",
}

# Per-agent files (inside agents/{name}/)
AGENT_FILE_MAP = {
    "brief": "brief.json",
    "evals_csv": "evals.csv",
    "evals_results": "evals-results.json",
    "build_report": "build-report.md",
}

SKIP_FOLDERS = {"topics", ".git", "__pycache__", "node_modules"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def humanize_name(folder_name):
    """Convert folder name to display name."""
    overrides = {
        "CDW": "CDW",
        "RoB-Manager": "RoB Manager",
        "DailyBriefing": "Daily Briefing",
    }
    if folder_name in overrides:
        return overrides[folder_name]
    name = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", folder_name)
    name = name.replace("-", " ").replace("_", " ")
    return name.title()


def _is_v2(brief):
    """Check if brief uses v2 schema (named sections) vs v1 (step1-4)."""
    return brief.get("_schema") == "2.0" or "agent" in brief


def determine_stage(agents):
    """Determine the furthest pipeline stage from agent data.

    Stage progression: discovery → context → research → build → eval → deployed
    Supports both v1 (step1-4) and v2 (named sections) brief schemas.
    """
    if not agents:
        return "discovery"

    best_stage = "discovery"
    stage_order = ["discovery", "context", "research", "build", "eval", "deployed"]

    for agent in agents:
        brief = agent.get("_brief")
        if not brief:
            continue

        # Check eval results
        eval_results = brief.get("evalResults", {})
        if eval_results.get("lastRun"):
            agent_stage = "eval"
        # Check build status
        elif brief.get("buildStatus", {}).get("status") in ("published", "in_progress"):
            agent_stage = "build"
        # Check if fully researched (has instructions + architecture)
        elif _is_v2(brief):
            arch = brief.get("architecture", {})
            if brief.get("instructions") and arch.get("type"):
                agent_stage = "research"
            elif brief.get("business", {}).get("problemStatement") or brief.get("agent", {}).get("name"):
                agent_stage = "context"
            else:
                agent_stage = "discovery"
        else:
            # v1 fallback
            if brief.get("instructions") and brief.get("step4", {}).get("architectureRecommendation"):
                agent_stage = "research"
            elif brief.get("step1", {}).get("problem"):
                agent_stage = "context"
            else:
                agent_stage = "discovery"

        if stage_order.index(agent_stage) > stage_order.index(best_stage):
            best_stage = agent_stage

    return best_stage


def count_csv_rows(filepath):
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            next(reader, None)
            return sum(1 for _ in reader)
    except Exception:
        return 0


# ---------------------------------------------------------------------------
# Agent scanning (from agents/ subfolders)
# ---------------------------------------------------------------------------

def scan_agents(project_folder):
    """Scan agents/ subfolder for per-agent brief.json files.

    Supports both v1 (step1-4) and v2 (named sections) brief schemas.
    """
    agents_dir = project_folder / "agents"
    agents = []

    if not agents_dir.exists():
        return agents

    for agent_dir in sorted(agents_dir.iterdir()):
        if not agent_dir.is_dir() or agent_dir.name.startswith("."):
            continue

        brief = None
        brief_file = agent_dir / "brief.json"
        if brief_file.exists():
            try:
                brief = json.loads(brief_file.read_text(encoding="utf-8"))
            except Exception:
                pass

        # Readiness calculation
        readiness = calc_readiness(brief) if brief else 0

        # Check which agent-level files exist
        agent_files = {}
        for key, filename in AGENT_FILE_MAP.items():
            agent_files[key] = (agent_dir / filename).exists()

        # Eval count from per-agent evals.csv
        eval_count = count_csv_rows(agent_dir / "evals.csv") if agent_files.get("evals_csv") else 0

        # Extract data from v2 or v1 schema
        if brief and _is_v2(brief):
            agent_sec = brief.get("agent", {})
            biz = brief.get("business", {})
            arch = brief.get("architecture", {})
            integ = brief.get("integrations", [])
            know = brief.get("knowledge", [])
            evals = brief.get("evals", [])

            agent_name = agent_sec.get("name", "") or humanize_name(agent_dir.name)
            description = (biz.get("problemStatement", "") or biz.get("useCase", ""))[:300]
            architecture = arch.get("type", "tbd")
            architecture_score = arch.get("score", "TBD")
            model = arch.get("model", "TBD")
            tools = [i.get("name", "") for i in integ if i.get("name")][:10]
            knowledge = [k.get("name", "") for k in know if k.get("name")][:10]
        elif brief:
            # v1 fallback
            s1 = brief.get("step1", {})
            s3 = brief.get("step3", {})
            s4 = brief.get("step4", {})

            agent_name = s1.get("agentName", humanize_name(agent_dir.name))
            description = s1.get("problem", "")[:300]
            architecture = s4.get("architectureRecommendation", "tbd")
            architecture_score = s4.get("architectureScore", "TBD")
            model = s4.get("model", "TBD")
            tools = [s.get("name", "") for s in s3.get("systems", []) if s.get("name")][:10]
            knowledge = [k.get("name", "") for k in s3.get("knowledge", []) if k.get("name")][:10]
        else:
            agent_name = humanize_name(agent_dir.name)
            description = ""
            architecture = "tbd"
            architecture_score = "TBD"
            model = "TBD"
            tools = []
            knowledge = []

        agents.append({
            "id": agent_dir.name,
            "name": agent_name,
            "description": description,
            "architecture": architecture,
            "architecture_score": architecture_score,
            "model": model,
            "tools": tools,
            "knowledge": knowledge,
            "has_brief": brief is not None,
            "has_instructions": bool(brief.get("instructions")) if brief else False,
            "has_evals": agent_files.get("evals_csv", False),
            "has_build_report": agent_files.get("build_report", False),
            "readiness": readiness,
            "eval_count": eval_count,
            "open_questions": len([q for q in brief.get("openQuestions", []) if q.get("question") and not q.get("answer")]) if brief else 0,
            "_brief": brief,  # internal, used by determine_stage, stripped before output
        })

    return agents


def calc_readiness(brief):
    """Calculate brief readiness as a percentage (0-100).

    Supports both v1 (step1-4) and v2 (named sections) brief schemas.
    Matches server.py _calc_readiness() logic.
    """
    if not brief:
        return 0

    evals = brief.get("evals", [])
    open_qs = brief.get("openQuestions", [])
    unanswered = [q for q in open_qs if q.get("question") and not q.get("answer")]
    build_status = brief.get("buildStatus", {})
    eval_results = brief.get("evalResults", {})

    if _is_v2(brief):
        biz = brief.get("business", {})
        arch = brief.get("architecture", {})
        integ = brief.get("integrations", [])
        know = brief.get("knowledge", [])
        convos = brief.get("conversations", {})
        bounds = brief.get("boundaries", {})
        scenarios = brief.get("scenarios", [])

        checks = [
            bool(biz.get("problemStatement") or biz.get("useCase")),
            bool(arch.get("type")),
            bool(brief.get("instructions")),
            len([i for i in integ if i.get("name")]) + len(convos.get("topics", [])) > 0,
            len([k for k in know if k.get("name")]) > 0,
            len([s for s in scenarios if s.get("userSays")]) >= 3,
            len(evals) > 0,
            bool(bounds.get("handle") or bounds.get("decline") or bounds.get("refuse")),
            len([c for c in arch.get("channels", []) if (c.get("name") if isinstance(c, dict) else c)]) > 0,
            len(unanswered) == 0,
            build_status.get("status") == "published",
            bool(eval_results.get("summary", {}).get("total", 0) > 0),
        ]
    else:
        # v1 fallback
        s1 = brief.get("step1", {})
        s2 = brief.get("step2", {})
        s3 = brief.get("step3", {})
        s4 = brief.get("step4", {})

        checks = [
            bool(s1.get("problem")),
            bool(s4.get("architectureRecommendation")),
            len([s for s in s3.get("systems", []) if s.get("name")]) > 0,
            len([k for k in s3.get("knowledge", []) if k.get("name")]) > 0,
            len([s for s in s2.get("scenarios", []) if s.get("userSays")]) >= 3,
            len(evals) > 0,
            bool(s2.get("handle") or s2.get("decline") or s2.get("refuse")),
            len(s4.get("channels", [])) > 0,
            len(unanswered) == 0,
            bool(brief.get("instructions")),
        ]
    return round(sum(checks) / len(checks) * 100)


# ---------------------------------------------------------------------------
# Project scanner
# ---------------------------------------------------------------------------

def scan_project(folder):
    project = {
        "id": folder.name,
        "name": humanize_name(folder.name),
        "path": str(folder.relative_to(BASE_DIR)),
        "files": {},
        "agents": [],
        "stats": {},
    }

    # Check project-root files
    for key, filename in PROJECT_FILE_MAP.items():
        project["files"][key] = (folder / filename).exists()

    # Scan agents from agents/ subfolders (primary source)
    agents = scan_agents(folder)

    # Determine stage from agent data
    project["stage"] = determine_stage(agents)

    # Strip internal _brief from output
    for agent in agents:
        agent.pop("_brief", None)

    project["agents"] = agents

    # If no agents found, check for legacy project-root files
    if not project["agents"]:
        # Check for docs/ folder as minimum project indicator
        docs_dir = folder / "docs"
        has_docs = docs_dir.exists() and any(docs_dir.iterdir()) if docs_dir.exists() else False

        project["agents"] = [{
            "id": folder.name,
            "name": project["name"],
            "description": "",
            "architecture": "tbd",
            "architecture_score": "TBD",
            "model": "TBD",
            "tools": [],
            "knowledge": [],
            "has_brief": False,
            "has_instructions": False,
            "has_evals": False,
            "has_build_report": False,
            "readiness": 0,
            "eval_count": 0,
            "open_questions": 0,
        }]

    # Stats
    project["stats"]["total_agents"] = len(project["agents"])
    project["stats"]["eval_count"] = sum(a.get("eval_count", 0) for a in project["agents"])

    return project


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print(f"Scanning {BUILD_GUIDES} ...")

    projects = []
    if BUILD_GUIDES.exists():
        for item in sorted(BUILD_GUIDES.iterdir()):
            if not item.is_dir():
                continue
            if item.name in SKIP_FOLDERS or item.name.startswith("."):
                continue
            # Include if has agents/ folder, docs/ folder, or any md/csv files
            has_agents = (item / "agents").exists()
            has_docs = (item / "docs").exists()
            has_files = list(item.glob("*.md")) or list(item.glob("*.csv"))
            if has_agents or has_docs or has_files:
                print(f"  + {item.name}")
                projects.append(scan_project(item))

    data = {
        "generated_at": datetime.now().isoformat(),
        "project_count": len(projects),
        "projects": projects,
    }

    header = (
        f"// Auto-generated by generate-data.py — {datetime.now():%Y-%m-%d %H:%M}\n"
        f"// Re-run:  python app/generate-data.py\n\n"
    )
    js = header + "const DASHBOARD_DATA = " + json.dumps(data, indent=2, ensure_ascii=False) + ";\n"

    OUTPUT_FILE.write_text(js, encoding="utf-8")
    print(f"\nDone: {OUTPUT_FILE.name}  ({len(projects)} projects, {sum(p['stats']['total_agents'] for p in projects)} agents)")


if __name__ == "__main__":
    main()
