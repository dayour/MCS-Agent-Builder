#!/usr/bin/env python3
"""CAD Agent Builder — Lightweight CRUD Backend

FastAPI server that serves the dashboard, provides project/agent/doc CRUD APIs,
handles file uploads with conversion, and launches the node-pty terminal sidecar.

All AI work (analysis, spec generation, builds) happens in the Claude Code terminal.

Usage:
    pip install fastapi uvicorn
    python app/server.py
"""

import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).parent.resolve()
BASE_DIR = SCRIPT_DIR.parent
BUILD_GUIDES = BASE_DIR / "Build-Guides"
DASHBOARD_HTML = SCRIPT_DIR / "index.html"

# ---------------------------------------------------------------------------
# Import scanner functions from generate-data.py
# ---------------------------------------------------------------------------
sys.path.insert(0, str(SCRIPT_DIR))
from importlib import import_module

_gen = import_module("generate-data")
scan_project = _gen.scan_project
humanize_name = _gen.humanize_name
determine_stage = _gen.determine_stage
calc_readiness = _gen.calc_readiness
PROJECT_FILE_MAP = _gen.PROJECT_FILE_MAP
AGENT_FILE_MAP = _gen.AGENT_FILE_MAP
SKIP_FOLDERS = _gen.SKIP_FOLDERS

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
app = FastAPI(title="CAD Agent Builder", version="3.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Helpers — folder structure: docs/ + agents/{name}/
# ---------------------------------------------------------------------------

def _ensure_dirs(folder: Path):
    """Ensure docs/ subfolder exists."""
    (folder / "docs").mkdir(exist_ok=True)


def _scan_docs(folder: Path) -> list[dict]:
    """Scan docs/ folder for shared customer documents."""
    docs_dir = folder / "docs"
    docs = []
    if docs_dir.exists():
        for fp in sorted(docs_dir.iterdir()):
            if fp.is_file() and fp.suffix in (".md", ".csv", ".json", ".txt", ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".webp"):
                docs.append({
                    "key": fp.stem.replace("-", "_").replace(" ", "_").lower(),
                    "filename": fp.name,
                    "size": fp.stat().st_size,
                })
    # Also check legacy files in project root (backwards compat)
    for fp in sorted(folder.glob("*.md")) + sorted(folder.glob("*.csv")):
        if fp.parent == folder and not fp.name.startswith("build-log"):
            docs.append({
                "key": fp.stem.replace("-", "_").replace(" ", "_").lower(),
                "filename": fp.name,
                "location": "root",  # legacy
            })
    return docs


def _calc_readiness(brief: dict | None) -> int:
    """Calculate brief readiness as a percentage (0-100).

    Uses 12 checks — same as the client-side renderReadinessPanel — so the
    percentage shown on the project page matches the agent design page ring.
    """
    if not brief:
        return 0
    s1 = brief.get("step1", {})
    s2 = brief.get("step2", {})
    s3 = brief.get("step3", {})
    s4 = brief.get("step4", {})
    evals = brief.get("evals", [])
    open_qs = brief.get("openQuestions", [])
    unanswered = [q for q in open_qs if q.get("question") and not q.get("answer")]
    build_status = brief.get("buildStatus", {})
    eval_results = brief.get("evalResults", {})

    checks = [
        bool(s1.get("problem")),                                                        # Problem statement
        bool(s4.get("architectureRecommendation")),                                     # Architecture
        bool(brief.get("instructions")),                                                # Instructions
        len([s for s in s3.get("systems", []) if s.get("name")]) + len(s3.get("topics", [])) > 0,  # Components
        len([k for k in s3.get("knowledge", []) if k.get("name")]) > 0,                # Knowledge
        len([s for s in s2.get("scenarios", []) if s.get("userSays")]) >= 3,            # Scenarios
        len(evals) > 0,                                                                 # Evals defined
        bool(s2.get("handle") or s2.get("decline") or s2.get("refuse")),                # Boundaries
        len(s4.get("channels", [])) > 0,                                                # Channels
        len(unanswered) == 0,                                                           # Questions resolved
        build_status.get("status") == "published",                                      # Build published
        bool(eval_results.get("summary", {}).get("total", 0) > 0),                     # Eval results
    ]
    return round(sum(checks) / len(checks) * 100)


def _is_build_ready(brief: dict | None) -> bool:
    """All 10 pre-build design checks must pass before build is allowed.

    Excludes 'Build published' and 'Eval results' (those happen AFTER build).
    """
    if not brief:
        return False
    s1 = brief.get("step1", {})
    s2 = brief.get("step2", {})
    s3 = brief.get("step3", {})
    s4 = brief.get("step4", {})
    evals = brief.get("evals", [])
    open_qs = brief.get("openQuestions", [])
    unanswered = [q for q in open_qs if q.get("question") and not q.get("answer")]
    return all([
        s1.get("problem"),
        s4.get("architectureRecommendation"),
        brief.get("instructions"),
        len([s for s in s3.get("systems", []) if s.get("name")]) + len(s3.get("topics", [])) > 0,
        len([k for k in s3.get("knowledge", []) if k.get("name")]) > 0,
        len([s for s in s2.get("scenarios", []) if s.get("userSays")]) >= 3,
        len(evals) > 0,
        s2.get("handle") or s2.get("decline") or s2.get("refuse"),
        len(s4.get("channels", [])) > 0,
        len(unanswered) == 0,
    ])


def _scan_agents(folder: Path) -> list[dict]:
    """Scan agents/ folder for per-agent subfolders."""
    agents_dir = folder / "agents"
    agents = []
    if agents_dir.exists():
        for agent_dir in sorted(agents_dir.iterdir()):
            if not agent_dir.is_dir() or agent_dir.name.startswith("."):
                continue
            brief_file = agent_dir / "brief.json"
            brief = None
            if brief_file.exists():
                try:
                    brief = json.loads(brief_file.read_text(encoding="utf-8"))
                except Exception:
                    pass
            agents.append({
                "id": agent_dir.name,
                "name": brief.get("step1", {}).get("agentName", humanize_name(agent_dir.name)) if brief else humanize_name(agent_dir.name),
                "description": brief.get("step1", {}).get("problem", "")[:150] if brief else "",
                "has_brief": brief is not None,
                "has_instructions": bool(brief.get("instructions")) if brief else False,
                "has_evals": (agent_dir / "evals.csv").exists(),
                "has_build_report": (agent_dir / "build-report.md").exists(),
                "readiness": _calc_readiness(brief),
                "build_ready": _is_build_ready(brief),
                "folder": str(agent_dir.relative_to(folder)),
            })
    return agents


def _list_projects() -> list[dict]:
    """Live scan of Build-Guides/ folders."""
    projects = []
    if BUILD_GUIDES.exists():
        for item in sorted(BUILD_GUIDES.iterdir()):
            if not item.is_dir() or item.name in SKIP_FOLDERS or item.name.startswith("."):
                continue
            has_content = (
                (item / "docs").exists()
                or (item / "agents").exists()
                or list(item.glob("*.md"))
                or (item / "session-state.json").exists()
            )
            if not has_content:
                continue

            created_ts = os.path.getctime(str(item))
            agents = _scan_agents(item)
            scanned = scan_project(item)
            projects.append({
                "id": item.name,
                "name": humanize_name(item.name),
                "path": f"Build-Guides/{item.name}",
                "agents": agents,
                "doc_count": len(_scan_docs(item)),
                "stage": scanned.get("stage", "discovery"),
                "created_at": datetime.fromtimestamp(created_ts).strftime("%b %d, %Y"),
            })
    return projects


def _get_project(project_id: str) -> dict:
    """Get full project data."""
    folder = BUILD_GUIDES / project_id
    if not folder.is_dir():
        raise HTTPException(404, f"Project '{project_id}' not found")

    _ensure_dirs(folder)

    docs = _scan_docs(folder)
    agents = _scan_agents(folder)

    # Read document content for the viewer
    doc_content = {}
    for d in docs:
        loc = d.get("location")
        fp = (folder / d["filename"]) if loc == "root" else (folder / "docs" / d["filename"])
        if fp.exists() and fp.suffix in (".md", ".csv"):
            try:
                doc_content[d["key"]] = fp.read_text(encoding="utf-8")
            except Exception:
                pass

    return {
        "id": folder.name,
        "name": humanize_name(folder.name),
        "path": f"Build-Guides/{folder.name}",
        "agents": agents,
        "docs": docs,
        "doc_content": doc_content,
        "stage": scan_project(folder).get("stage", "discovery"),
    }


# ---------------------------------------------------------------------------
# API Routes — CRUD only, no Claude calls
# ---------------------------------------------------------------------------

@app.get("/", response_class=HTMLResponse)
async def serve_dashboard():
    """Serve the dashboard HTML."""
    if not DASHBOARD_HTML.exists():
        raise HTTPException(404, "dashboard.html not found")
    return HTMLResponse(DASHBOARD_HTML.read_text(encoding="utf-8"))


@app.get("/api/projects")
async def list_projects():
    """List all projects with live scan."""
    projects = _list_projects()
    return {
        "generated_at": datetime.now().isoformat(),
        "project_count": len(projects),
        "projects": projects,
    }


@app.get("/api/projects/{project_id}")
async def get_project(project_id: str):
    """Get full project detail."""
    return _get_project(project_id)


@app.post("/api/projects")
async def create_project(request: Request):
    """Create a new project folder."""
    body = await request.json()
    name = body.get("name", "").strip()
    if not name:
        raise HTTPException(400, "Project name required")

    folder_name = re.sub(r"[^\w\-]", "", name.replace(" ", "-"))
    if not folder_name:
        raise HTTPException(400, "Invalid project name")

    folder = BUILD_GUIDES / folder_name
    if folder.exists():
        raise HTTPException(409, f"Project '{folder_name}' already exists")

    folder.mkdir(parents=True, exist_ok=True)
    (folder / "docs").mkdir(exist_ok=True)

    return {"id": folder_name, "name": humanize_name(folder_name), "path": f"Build-Guides/{folder_name}"}


@app.get("/api/projects/{project_id}/agents/{agent_id}")
async def get_agent(project_id: str, agent_id: str):
    """Get agent brief state."""
    agent_dir = BUILD_GUIDES / project_id / "agents" / agent_id
    if not agent_dir.is_dir():
        raise HTTPException(404, f"Agent '{agent_id}' not found")
    brief_file = agent_dir / "brief.json"
    brief = None
    if brief_file.exists():
        try:
            brief = json.loads(brief_file.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {
        "id": agent_id,
        "name": brief.get("step1", {}).get("agentName", humanize_name(agent_id)) if brief else humanize_name(agent_id),
        "brief": brief,
        "has_instructions": bool(brief.get("instructions")) if brief else False,
        "has_evals": (agent_dir / "evals.csv").exists(),
        "has_build_report": (agent_dir / "build-report.md").exists(),
    }


@app.put("/api/projects/{project_id}/agents/{agent_id}/state")
async def save_agent_state(project_id: str, agent_id: str, request: Request):
    """Save agent brief state to agents/{agent_id}/brief.json. Simple file write."""
    folder = BUILD_GUIDES / project_id
    if not folder.is_dir():
        raise HTTPException(404, f"Project '{project_id}' not found")

    agent_dir = folder / "agents" / agent_id
    agent_dir.mkdir(parents=True, exist_ok=True)

    body = await request.json()
    state_file = agent_dir / "brief.json"

    # Merge with existing state
    existing = {}
    if state_file.exists():
        try:
            existing = json.loads(state_file.read_text(encoding="utf-8"))
        except Exception:
            pass

    existing.update(body)
    existing["updated_at"] = datetime.now().isoformat()

    state_file.write_text(json.dumps(existing, indent=2), encoding="utf-8")

    return {"saved": True}


@app.post("/api/projects/{project_id}/upload")
async def upload_document(project_id: str, file: UploadFile = File(...)):
    """Upload a document, convert to markdown via Microsoft MarkItDown.

    Supports: .docx .pdf .pptx .xlsx .xls .csv .json .html .txt .md
              .jpg .jpeg .png .gif .bmp .tiff .wav .mp3 .zip .epub
    """
    folder = BUILD_GUIDES / project_id
    if not folder.is_dir():
        raise HTTPException(404, f"Project '{project_id}' not found")

    _ensure_dirs(folder)
    docs_dir = folder / "docs"

    original_name = file.filename or "upload"
    safe_base = re.sub(r"[^\w\-]", "_", Path(original_name).stem.lower())
    suffix = Path(original_name).suffix.lower()
    content = await file.read()

    # Save the raw file to docs/
    raw_name = f"{safe_base}{suffix}"
    raw_path = docs_dir / raw_name
    raw_path.write_bytes(content)

    converted_name = None
    conversion_error = None

    # Files already in readable format — no conversion needed
    if suffix in (".md", ".csv", ".json", ".txt"):
        converted_name = raw_name

    # Images — save as-is, Claude Code reads them directly (multimodal)
    elif suffix in (".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".webp"):
        converted_name = raw_name  # no conversion needed, Claude reads images

    else:
        # Use Microsoft MarkItDown for documents (docx, pdf, pptx, xlsx, html, etc.)
        try:
            from markitdown import MarkItDown
            converter = MarkItDown(enable_plugins=False)
            result = converter.convert(str(raw_path))

            if result.text_content and result.text_content.strip():
                md_name = f"{safe_base}.md"
                md_path = docs_dir / md_name
                md_path.write_text(result.text_content, encoding="utf-8")
                converted_name = md_name
            else:
                conversion_error = "No text content extracted (file may be empty)"
        except ImportError:
            conversion_error = "markitdown not installed — run: pip install 'markitdown[all]'"
        except Exception as e:
            conversion_error = f"Conversion failed: {str(e)[:200]}"

    return {
        "uploaded": True,
        "filename": raw_name,
        "converted": converted_name,
        "conversion_error": conversion_error,
        "size": len(content),
        "path": f"Build-Guides/{project_id}/docs/{converted_name or raw_name}",
    }


@app.post("/api/projects/{project_id}/paste")
async def paste_text(project_id: str, request: Request):
    """Save pasted text as a markdown file in docs/."""
    folder = BUILD_GUIDES / project_id
    if not folder.is_dir():
        raise HTTPException(404, f"Project '{project_id}' not found")

    _ensure_dirs(folder)
    body = await request.json()
    text = body.get("text", "").strip()
    title = body.get("title", "").strip() or "pasted-context"

    if not text:
        raise HTTPException(400, "No text provided")

    safe_base = re.sub(r"[^\w\-]", "_", title.lower().replace(" ", "-"))
    # Avoid collisions
    md_name = f"{safe_base}.md"
    docs_dir = folder / "docs"
    md_path = docs_dir / md_name
    counter = 1
    while md_path.exists():
        md_name = f"{safe_base}-{counter}.md"
        md_path = docs_dir / md_name
        counter += 1

    heading = title.replace("-", " ").replace("_", " ").title()
    md_path.write_text(f"# {heading}\n\n{text}", encoding="utf-8")

    return {
        "saved": True,
        "filename": md_name,
        "size": len(text),
        "path": f"Build-Guides/{project_id}/docs/{md_name}",
    }


@app.delete("/api/projects/{project_id}/agents/{agent_id}")
async def delete_agent(project_id: str, agent_id: str):
    """Delete an agent and all its files."""
    folder = BUILD_GUIDES / project_id
    agent_dir = folder / "agents" / agent_id
    if not agent_dir.is_dir():
        raise HTTPException(404, f"Agent '{agent_id}' not found")
    import shutil
    shutil.rmtree(str(agent_dir))
    return {"deleted": True, "agent_id": agent_id}


@app.delete("/api/projects/{project_id}/docs/{filename}")
async def delete_doc(project_id: str, filename: str):
    """Delete a document from the project's docs/ folder."""
    folder = BUILD_GUIDES / project_id
    if not folder.is_dir():
        raise HTTPException(404, f"Project '{project_id}' not found")

    safe = re.sub(r"[^\w\-.]", "_", filename)
    target = folder / "docs" / safe
    if not target.exists():
        target = folder / safe
    if not target.exists():
        raise HTTPException(404, f"File '{safe}' not found")

    target.unlink()

    # Also delete the raw counterpart
    stem = Path(safe).stem
    for ext in [".pdf", ".docx", ".txt"]:
        for search_dir in [folder / "docs", folder]:
            raw = search_dir / f"{stem}{ext}"
            if raw.exists():
                raw.unlink()

    return {"deleted": True, "filename": safe}


# ---------------------------------------------------------------------------
# Terminal — node-pty sidecar (proper ConPTY on Windows)
# ---------------------------------------------------------------------------

_terminal_server_proc = None


def _kill_stale_terminal_server():
    """Kill any leftover node process on port 8001 from a previous run."""
    try:
        result = subprocess.run(
            ["netstat", "-ano", "-p", "TCP"],
            capture_output=True, text=True, timeout=5,
        )
        for line in result.stdout.splitlines():
            if ":8001" in line and "LISTENING" in line:
                pid = line.strip().split()[-1]
                if pid.isdigit():
                    subprocess.run(["taskkill", "/F", "/PID", pid],
                                   capture_output=True, timeout=5)
                    print(f"  Killed stale terminal server (pid {pid})")
    except Exception:
        pass


def _ensure_terminal_server():
    """Launch the Node.js terminal server if not already running."""
    global _terminal_server_proc
    if _terminal_server_proc and _terminal_server_proc.poll() is None:
        return  # Already running

    terminal_js = SCRIPT_DIR / "terminal-server.js"
    if not terminal_js.exists():
        print("  WARNING: terminal-server.js not found, terminal panel disabled")
        return

    # Kill any orphaned process from a previous run
    _kill_stale_terminal_server()

    time.sleep(0.5)  # Let OS release the socket after killing stale process

    try:
        _terminal_server_proc = subprocess.Popen(
            ["node", str(terminal_js)],
            cwd=str(BASE_DIR),
        )
        print(f"  Terminal server started on ws://localhost:8001 (pid {_terminal_server_proc.pid})")
    except Exception as e:
        print(f"  WARNING: Failed to start terminal server: {e}")


# ---------------------------------------------------------------------------
# Static file serving
# ---------------------------------------------------------------------------

@app.get("/dashboard-data.js")
async def serve_dashboard_data():
    f = BASE_DIR / "dashboard-data.js"
    if f.exists():
        return FileResponse(str(f), media_type="application/javascript")
    raise HTTPException(404)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"CAD Agent Builder — starting on http://localhost:{port}")
    print(f"  Base dir: {BASE_DIR}")
    print(f"  Build Guides: {BUILD_GUIDES}")
    print(f"  Engine: Claude Code terminal (ws://localhost:8001)")
    _ensure_terminal_server()
    try:
        uvicorn.run(app, host="0.0.0.0", port=port)
    finally:
        if _terminal_server_proc and _terminal_server_proc.poll() is None:
            _terminal_server_proc.terminate()
            print("Terminal server stopped")
