#!/usr/bin/env python3
"""MCS Agent Builder — Lightweight CRUD Backend

FastAPI server that serves the dashboard, provides project/agent/doc CRUD APIs,
handles file uploads with conversion, and launches the node-pty terminal sidecar.

All AI work (analysis, spec generation, builds) happens in the Claude Code terminal.

Usage:
    pip install fastapi uvicorn
    python app/server.py
"""
from __future__ import annotations  # PEP 604 union types on Python <3.10

import asyncio
import copy
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
import zipfile
from datetime import datetime
from pathlib import Path
from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).parent.resolve()
BASE_DIR = SCRIPT_DIR.parent
BUILD_GUIDES = BASE_DIR / "Build-Guides"
DIST_DIR = SCRIPT_DIR / "dist"

# File types shown in the dashboard document list
DOC_EXTENSIONS = {
    ".md", ".csv", ".json", ".txt",
    ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".webp",
    ".pdf",
    ".docx", ".pptx", ".xlsx", ".xls",
}

# Binary Office formats that Claude Code can't read natively — need text extraction
NEEDS_CONVERSION = {".docx", ".pptx", ".xlsx", ".xls"}

# Formats Claude Code reads natively (no conversion needed)
# Text files, images (multimodal), PDFs (with pages param), notebooks
NATIVE_READABLE = {
    ".md", ".csv", ".json", ".txt",
    ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".webp",
    ".pdf", ".ipynb",
}

# ---------------------------------------------------------------------------
# Import shared utilities
# ---------------------------------------------------------------------------
from lib.readiness_calc import (
    scan_project, humanize_name, determine_stage, calc_readiness,
    is_build_ready, PROJECT_FILE_MAP, AGENT_FILE_MAP, SKIP_FOLDERS,
)

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
app = FastAPI(title="MCS Agent Builder", version="3.0")
# CORS: restricted to localhost origins (server binds to 127.0.0.1).
_port = int(os.environ.get("PORT", 8000))
app.add_middleware(
    CORSMiddleware,
    allow_origins=[f"http://localhost:{_port}", f"http://127.0.0.1:{_port}"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Helpers — folder structure: docs/ + agents/{name}/
# ---------------------------------------------------------------------------

def _ensure_dirs(folder: Path):
    """Ensure docs/ subfolder exists."""
    (folder / "docs").mkdir(exist_ok=True)


def _file_sha256(fp: Path) -> str:
    """Compute SHA-256 hex digest of a file."""
    h = hashlib.sha256()
    with open(fp, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def _load_manifest(folder: Path) -> dict | None:
    """Load doc-manifest.json if it exists."""
    manifest_path = folder / "doc-manifest.json"
    if manifest_path.exists():
        try:
            return json.loads(manifest_path.read_text(encoding="utf-8-sig"))
        except Exception:
            pass
    return None


def _scan_docs(folder: Path) -> list[dict]:
    """Scan docs/ folder for documents. Uses filename as the unique key.

    Only shows files Claude Code can read: text, images, PDFs.
    Binary Office files (docx/pptx/xlsx) are converted at upload time
    and the originals deleted — so only readable files remain.

    Change detection uses (mtime, size) for speed. SHA256 is only computed
    during /mcs-research when the manifest is created — not on every page load.
    """
    docs_dir = folder / "docs"
    docs = []

    manifest = _load_manifest(folder)
    manifest_entries = {}
    if manifest:
        for entry in manifest.get("docsProcessed", []):
            manifest_entries[entry["filename"]] = entry

    if docs_dir.exists():
        for fp in sorted(docs_dir.iterdir()):
            if not fp.is_file() or fp.suffix not in DOC_EXTENSIONS:
                continue
            stat = fp.stat()
            is_new = True
            is_modified = False
            if manifest is not None:
                known = manifest_entries.get(fp.name)
                if known is not None:
                    is_new = False
                    # Fast change detection: compare size + mtime instead of SHA256.
                    # If manifest has size/mtime, use those. Fall back to "not modified"
                    # if manifest only has sha256 (old format) — avoids expensive rehash.
                    known_size = known.get("size")
                    known_mtime = known.get("mtime")
                    if known_size is not None and known_mtime is not None:
                        is_modified = stat.st_size != known_size or abs(stat.st_mtime - known_mtime) > 1.0
                    elif known.get("sha256"):
                        # Old manifest without mtime — can't compare cheaply.
                        # Assume unmodified to avoid blocking SHA256 on page load.
                        is_modified = False
            docs.append({
                "filename": fp.name,
                "size": stat.st_size,
                "isNew": is_new,
                "isModified": is_modified,
            })
    return docs


def _migrate_brief(brief: dict) -> dict:
    """Migrate v1 brief (step1-4) to v2 (named sections). Returns brief unchanged if already v2."""
    if brief.get("_schema") == "2.0" or "agent" in brief:
        return brief  # Already v2

    # Deep-copy to avoid mutating the original on partial failure
    brief = copy.deepcopy(brief)

    s1 = brief.pop("step1", {})
    s2 = brief.pop("step2", {})
    s3 = brief.pop("step3", {})
    s4 = brief.pop("step4", {})
    old_mvp = brief.pop("mvp", {})

    # Section 1: business (new — seed from old problem)
    brief.setdefault("business", {
        "useCase": "",
        "problemStatement": s1.get("problem", ""),
        "challenges": [],
        "benefits": [],
        "successCriteria": [],
        "stakeholders": {"sponsor": "", "owner": "", "users": ""},
    })

    # Section 2: agent
    brief["agent"] = {
        "name": s1.get("agentName", ""),
        "description": "",  # Left blank — this is the MCS agent description, not the problem statement
        "persona": "",
        "responseFormat": "",
        "primaryUsers": (s1.get("users") or {}).get("primary", ""),
        "secondaryUsers": (s1.get("users") or {}).get("secondary", ""),
    }

    # Section 3: capabilities (from s2.capabilities text + scenarios)
    caps_text = s2.get("capabilities", "")
    caps = []
    if caps_text:
        for line in caps_text.strip().split("\n"):
            line = line.strip().lstrip("- ").strip()
            if line:
                caps.append({"name": line, "phase": "mvp", "reason": "", "dataSources": []})
    brief["capabilities"] = caps

    # Section 4: integrations (from s3.systems)
    brief["integrations"] = [
        {
            "name": s.get("name", ""),
            "type": s.get("toolType", "connector"),
            "purpose": s.get("purpose", ""),
            "dataProvided": "",
            "authMethod": "",
            "status": s.get("status", "available"),
            "phase": "mvp",
            "notes": s.get("notes", ""),
        }
        for s in s3.get("systems", [])
    ]

    # Section 5: knowledge (from s3.knowledge)
    brief["knowledge"] = [
        {
            "name": k.get("name", ""),
            "type": k.get("type", "SharePoint"),
            "purpose": "",
            "scope": k.get("scope", ""),
            "status": k.get("status", "available"),
            "phase": "mvp",
        }
        for k in s3.get("knowledge", [])
    ]

    # Section 6: conversations (from s3.topics)
    brief["conversations"] = {
        "topics": [
            {
                "name": t.get("name", ""),
                "schemaName": "",
                "description": t.get("description", ""),
                "triggerType": t.get("triggerType", "agent-chooses"),
                "triggerPhrases": [],
                "topicType": "custom",
                "phase": "mvp",
                "implements": [],
                "variables": [],
                "connectedIntegrations": [],
                "outputFormat": "text",
                "yaml": t.get("yaml"),
            }
            for t in s3.get("topics", [])
        ]
    }

    # Section 7: boundaries (from s2)
    handle = s2.get("handle", "")
    brief["boundaries"] = {
        "handle": [h.strip() for h in handle.split("\n") if h.strip()] if isinstance(handle, str) else (handle or []),
        "decline": [{"topic": d, "redirect": ""} for d in (s2.get("decline", "").split("\n") if isinstance(s2.get("decline"), str) else [])] if s2.get("decline") else [],
        "refuse": [{"topic": r, "reason": ""} for r in (s2.get("refuse", "").split("\n") if isinstance(s2.get("refuse"), str) else [])] if s2.get("refuse") else [],
    }

    # Section 8: architecture (from s4)
    brief["architecture"] = {
        "type": s4.get("architectureRecommendation", ""),
        "reason": s4.get("architectureReason", ""),
        "score": s4.get("architectureScore", 0),
        "model": s4.get("model", ""),
        "modelReason": s4.get("modelReason", ""),
        "triggers": [{"type": t, "description": ""} for t in (s4.get("triggers") or [])],
        "channels": [{"name": c, "reason": ""} for c in (s4.get("channels") or [])],
        "children": s4.get("children", []),
    }

    # Section 9: scenarios (from s2.scenarios — now top-level)
    brief["scenarios"] = [
        {
            "name": f"Scenario {i+1}",
            "category": "happy-path",
            "userSays": sc.get("userSays", ""),
            "agentDoes": sc.get("agentShould", ""),
            "capabilities": [],
        }
        for i, sc in enumerate(s2.get("scenarios", []))
    ]

    # mvpSummary (computed from old mvp)
    brief["mvpSummary"] = {
        "now": old_mvp.get("now", []),
        "future": old_mvp.get("later", []),
        "blockers": [],
    }

    brief["_schema"] = "2.0"
    return brief


def _calc_readiness(brief: dict | None) -> int:
    """Calculate brief readiness as a percentage (0-100).

    Auto-migrates v1 briefs before calculation.
    Delegates to shared calc_readiness() from lib.readiness_calc.
    """
    if not brief:
        return 0
    # Auto-migrate if v1
    if "step1" in brief and "agent" not in brief:
        brief = _migrate_brief(brief)
    return calc_readiness(brief)


def _is_build_ready(brief: dict | None) -> bool:
    """All 10 pre-build design checks must pass before build is allowed.

    Auto-migrates v1 briefs before checking.
    Delegates to shared is_build_ready() from lib.readiness_calc.
    """
    if not brief:
        return False
    if "step1" in brief and "agent" not in brief:
        brief = _migrate_brief(brief)
    return is_build_ready(brief)


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
                    brief = json.loads(brief_file.read_text(encoding="utf-8-sig"))
                except Exception:
                    pass
            # Support both v1 (step1) and v2 (agent) schemas
            if brief and "step1" in brief and "agent" not in brief:
                agent_name = brief.get("step1", {}).get("agentName", humanize_name(agent_dir.name))
                agent_desc = brief.get("step1", {}).get("problem", "")[:150]
            elif brief:
                agent_name = brief.get("agent", {}).get("name", humanize_name(agent_dir.name))
                agent_desc = (brief.get("agent", {}).get("description") or brief.get("business", {}).get("useCase") or "")[:150]
            else:
                agent_name = humanize_name(agent_dir.name)
                agent_desc = ""
            # Extract eval pass rate from evalSets (new) or evalResults (legacy)
            eval_pass_rate = None
            if brief:
                # New schema: compute from evalSets[].tests[].lastResult
                total_tested = 0
                total_passed = 0
                for es in brief.get("evalSets", []):
                    for t in es.get("tests", []):
                        lr = t.get("lastResult")
                        if lr:
                            total_tested += 1
                            if lr.get("pass"):
                                total_passed += 1
                if total_tested > 0:
                    eval_pass_rate = round(total_passed / total_tested * 100)
                else:
                    # Legacy fallback: evalResults
                    er = brief.get("evalResults", {})
                    if isinstance(er, dict):
                        summary = er.get("summary", {})
                        if summary.get("total", 0) > 0:
                            pr = summary.get("passRate", "")
                            if isinstance(pr, str) and pr.endswith("%"):
                                try:
                                    eval_pass_rate = float(pr.rstrip("%"))
                                except ValueError:
                                    pass
                            if eval_pass_rate is None:
                                total = summary.get("total", 0)
                                passed = summary.get("passed", 0)
                                if total > 0:
                                    eval_pass_rate = round(passed / total * 100)

            # Extract architecture metadata for hierarchy display
            arch_type = ""
            arch_children = []
            if brief:
                arch = brief.get("architecture", {})
                if isinstance(arch, dict):
                    arch_type = arch.get("type", "")
                    for child in arch.get("children", []):
                        fid = child.get("agentFolderId", "")
                        if fid:
                            arch_children.append(fid)

            # Extract workflow phase for 3-phase workflow progression
            workflow_phase = None
            if brief:
                wf = brief.get("workflow", {})
                if isinstance(wf, dict) and wf.get("phase"):
                    workflow_phase = wf.get("phase")

            agents.append({
                "id": agent_dir.name,
                "name": agent_name,
                "description": agent_desc,
                "has_brief": brief is not None,
                "has_instructions": bool(brief.get("instructions")) if brief else False,
                "has_evals": (agent_dir / "evals.csv").exists(),
                "has_build_report": (agent_dir / "build-report.md").exists(),
                "readiness": _calc_readiness(brief),
                "build_ready": _is_build_ready(brief),
                "eval_pass_rate": eval_pass_rate,
                "folder": str(agent_dir.relative_to(folder)),
                "architecture_type": arch_type,
                "architecture_children": arch_children,
                "workflow_phase": workflow_phase,
                "_brief": brief,  # internal — used for stage detection, stripped before response
            })
    return agents


def _list_projects() -> list[dict]:
    """Live scan of Build-Guides/ folders.

    Performance: uses _scan_agents + determine_stage instead of scan_project()
    to avoid scanning agents twice per project. Doc count uses lightweight
    directory listing instead of full _scan_docs (skips SHA256/mtime checks).
    """
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

            # Compute stage from already-scanned agents (no duplicate scan)
            stage = determine_stage(agents)

            # Strip internal _brief before sending to client
            for a in agents:
                a.pop("_brief", None)

            # Lightweight doc count — just count files, skip change detection
            docs_dir = item / "docs"
            doc_count = 0
            if docs_dir.exists():
                doc_count = sum(1 for fp in docs_dir.iterdir()
                                if fp.is_file() and fp.suffix in DOC_EXTENSIONS)

            projects.append({
                "id": item.name,
                "name": humanize_name(item.name),
                "path": f"Build-Guides/{item.name}",
                "agents": agents,
                "doc_count": doc_count,
                "stage": stage,
                "created_at": datetime.fromtimestamp(created_ts).strftime("%b %d, %Y"),
            })
    return projects


def _get_project(project_id: str) -> dict:
    """Get full project data.

    Performance: uses _scan_agents + determine_stage instead of scan_project()
    to avoid a second full agent scan. Doc content is NOT eagerly loaded —
    fetch individual docs via /docs/{filename}/content on demand.
    """
    folder = BUILD_GUIDES / project_id
    if not folder.is_dir():
        raise HTTPException(404, f"Project '{project_id}' not found")

    _ensure_dirs(folder)

    docs = _scan_docs(folder)
    agents = _scan_agents(folder)

    # Compute stage from already-scanned agents (avoids duplicate scan_project call)
    stage = determine_stage(agents)

    # Strip internal _brief before sending to client
    for a in agents:
        a.pop("_brief", None)

    return {
        "id": folder.name,
        "name": humanize_name(folder.name),
        "path": f"Build-Guides/{folder.name}",
        "agents": agents,
        "docs": docs,
        "doc_content": {},
        "stage": stage,
    }


# ---------------------------------------------------------------------------
# API Routes — CRUD only, no Claude calls
# ---------------------------------------------------------------------------

@app.get("/", response_class=HTMLResponse)
async def serve_index():
    """Serve the SPA index.html."""
    index = DIST_DIR / "index.html"
    if not index.exists():
        return HTMLResponse(
            "<h2>Frontend not built</h2>"
            "<p>Run <code>npm run frontend:build</code> from the repo root, then refresh.</p>",
            status_code=200,
        )
    return HTMLResponse(index.read_text(encoding="utf-8"))


@app.get("/health")
@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    terminal_running = _terminal_server_proc is not None and _terminal_server_proc.poll() is None
    return {"status": "ok", "terminal": terminal_running}


@app.get("/api/config")
async def get_config():
    """Return runtime config (ports) so the frontend can discover the terminal WS URL."""
    terminal_port = int(os.environ.get("TERMINAL_PORT", _port + 1))
    return {"terminalWsUrl": f"ws://localhost:{terminal_port}/ws"}


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
        # Idempotent: return the existing project instead of erroring
        return {"id": folder_name, "name": humanize_name(folder_name), "path": f"Build-Guides/{folder_name}", "existed": True}

    folder.mkdir(parents=True, exist_ok=True)
    (folder / "docs").mkdir(exist_ok=True)

    return {"id": folder_name, "name": humanize_name(folder_name), "path": f"Build-Guides/{folder_name}", "existed": False}


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
            brief = json.loads(brief_file.read_text(encoding="utf-8-sig"))
            # Auto-migrate v1 → v2 on read
            if brief and "step1" in brief and "agent" not in brief:
                brief = _migrate_brief(brief)
                brief_file.write_text(json.dumps(brief, indent=2), encoding="utf-8")
        except Exception:
            pass
    # Support both v1 and v2 for name extraction
    if brief and brief.get("agent", {}).get("name"):
        name = brief["agent"]["name"]
    elif brief and brief.get("step1", {}).get("agentName"):
        name = brief["step1"]["agentName"]
    else:
        name = humanize_name(agent_id)
    # Include file mtime so the client poll detects external edits
    # (e.g. Claude editing brief.json directly) even when updated_at unchanged
    file_mtime = None
    if brief_file.exists():
        file_mtime = datetime.fromtimestamp(brief_file.stat().st_mtime).isoformat()

    return {
        "id": agent_id,
        "name": name,
        "brief": brief,
        "_file_mtime": file_mtime,
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
            existing = json.loads(state_file.read_text(encoding="utf-8-sig"))
        except Exception:
            pass

    existing.update(body)
    existing["updated_at"] = datetime.now().isoformat()

    state_file.write_text(json.dumps(existing, indent=2), encoding="utf-8")

    return {"saved": True}


@app.post("/api/projects/{project_id}/agents/{agent_id}/scaffold-children")
async def scaffold_children(project_id: str, agent_id: str):
    """Create agent folders for each unlinked child in the parent's architecture.

    For each child in architecture.children without an agentFolderId:
    1. Generate folder name from child name (kebab-case)
    2. Create agents/{folder}/brief.json with minimal v2 brief
    3. Set agentFolderId on the child entry in the parent's brief
    Returns list of created folders.
    """
    folder = BUILD_GUIDES / project_id
    if not folder.is_dir():
        raise HTTPException(404, f"Project '{project_id}' not found")

    agent_dir = folder / "agents" / agent_id
    brief_file = agent_dir / "brief.json"
    if not brief_file.exists():
        raise HTTPException(404, f"Agent '{agent_id}' has no brief.json")

    try:
        brief = json.loads(brief_file.read_text(encoding="utf-8-sig"))
    except Exception as e:
        raise HTTPException(500, f"Failed to read brief: {e}")

    children = brief.get("architecture", {}).get("children", [])
    if not children:
        return {"created": [], "message": "No children defined in architecture"}

    created = []
    agents_dir = folder / "agents"
    agents_dir.mkdir(exist_ok=True)

    for child in children:
        if child.get("agentFolderId"):
            continue  # Already linked

        child_name = child.get("name", "").strip()
        if not child_name:
            continue

        # Generate kebab-case folder name
        folder_name = re.sub(r"[^\w\-]", "", child_name.lower().replace(" ", "-"))
        if not folder_name:
            folder_name = f"agent-{len(created) + 1}"

        # Avoid collision with existing folders
        base_name = folder_name
        counter = 1
        while (agents_dir / folder_name).exists():
            folder_name = f"{base_name}-{counter}"
            counter += 1

        child_dir = agents_dir / folder_name
        child_dir.mkdir(parents=True, exist_ok=True)

        # Create minimal v2 brief
        child_brief = {
            "_schema": "2.0",
            "agent": {
                "name": child_name,
                "description": child.get("role", ""),
                "persona": "",
                "responseFormat": "",
                "primaryUsers": "",
                "secondaryUsers": "",
            },
            "business": {
                "useCase": child.get("role", ""),
                "problemStatement": "",
                "challenges": [],
                "benefits": [],
                "successCriteria": [],
                "stakeholders": {"sponsor": "", "owner": "", "users": ""},
            },
            "architecture": {
                "type": "single-agent",
                "reason": f"Specialist agent — child of {brief.get('agent', {}).get('name', agent_id)}",
            },
            "updated_at": datetime.now().isoformat(),
        }
        child_brief_file = child_dir / "brief.json"
        child_brief_file.write_text(json.dumps(child_brief, indent=2), encoding="utf-8")

        # Link the child back to the parent
        child["agentFolderId"] = folder_name
        created.append(folder_name)

    # Save updated parent brief with agentFolderIds
    brief["updated_at"] = datetime.now().isoformat()
    brief_file.write_text(json.dumps(brief, indent=2), encoding="utf-8")

    return {"created": created, "message": f"Created {len(created)} agent folder(s)"}


@app.post("/api/projects/{project_id}/upload")
async def upload_document(
    project_id: str,
    file: UploadFile = File(...),
):
    """Upload a document to the project's docs/ folder.

    - Text, images, PDFs: saved as-is (Claude Code reads them natively)
    - Office files (docx/pptx/xlsx): saved as-is + converted to .md via MarkItDown
      so Claude Code can read the text content during /mcs-research

    The original file is always kept. The .md is a text extraction for readability.
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

    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(413, "File too large (max 50 MB)")

    # Save the file. For binary Office files, convert to a readable format
    # and delete the original (Claude Code can't read docx/pptx/xlsx).
    raw_name = f"{safe_base}{suffix}"
    raw_path = docs_dir / raw_name
    raw_path.write_bytes(content)

    final_name = raw_name  # what ends up in docs/ (may change after conversion)
    conversion_error = None

    if suffix in NEEDS_CONVERSION:
        # Detect encrypted / MIP-protected Office files before attempting conversion.
        # Normal .docx/.pptx/.xlsx are ZIP archives. Encrypted ones are OLE2 containers
        # that tools like MarkItDown and python-docx can't read.
        if suffix in {".docx", ".pptx", ".xlsx"} and not zipfile.is_zipfile(str(raw_path)):
            raw_path.unlink()
            raise HTTPException(
                422,
                "This file appears to be encrypted or protected (e.g. Microsoft Information "
                "Protection). Please remove the protection in the original application and "
                "re-upload, or paste the content as text instead."
            )

        try:
            from markitdown import MarkItDown
            converter = MarkItDown()
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(None, converter.convert, str(raw_path))

            if result.text_content and result.text_content.strip():
                if suffix in {".xlsx", ".xls"}:
                    # Excel → CSV (preserves tabular structure)
                    out_name = f"{safe_base}.csv"
                    text = result.text_content.strip()
                    csv_lines = []
                    for line in text.split("\n"):
                        line = line.strip()
                        if not line or line.startswith("|--") or line.startswith("| --"):
                            continue
                        if line.startswith("|") and line.endswith("|"):
                            cells = [c.strip() for c in line.strip("|").split("|")]
                            csv_lines.append(",".join(f'"{c}"' for c in cells))
                    if csv_lines:
                        (docs_dir / out_name).write_text("\n".join(csv_lines), encoding="utf-8")
                    else:
                        # Fallback: save as .md if table parsing failed
                        out_name = f"{safe_base}.md"
                        (docs_dir / out_name).write_text(text, encoding="utf-8")
                else:
                    # docx/pptx → .md
                    out_name = f"{safe_base}.md"
                    (docs_dir / out_name).write_text(result.text_content, encoding="utf-8")

                # Delete original binary — only the readable version stays
                raw_path.unlink()
                final_name = out_name
                print(f"  [upload] Converted {raw_name} → {out_name}")
            else:
                conversion_error = "No text extracted (file may be empty or password-protected)"
                print(f"  [upload] Empty extraction for {raw_name} — keeping original")
        except ImportError:
            conversion_error = "markitdown not installed — run: pip install 'markitdown[all]'"
            print(f"  [upload] markitdown not installed — keeping original {raw_name}")
        except Exception as e:
            conversion_error = f"Text extraction failed: {str(e)[:200]}"
            print(f"  [upload] Conversion error for {raw_name}: {e} — keeping original")

    brief_outdated = (folder / "doc-manifest.json").exists()

    return {
        "uploaded": True,
        "filename": final_name,
        "conversionError": conversion_error,
        "size": len(content),
        "path": f"Build-Guides/{project_id}/docs/{final_name}",
        "briefOutdated": brief_outdated,
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


@app.get("/api/projects/{project_id}/doc-status")
async def doc_status(project_id: str):
    """Compare current docs/ against doc-manifest.json to find new/changed/deleted docs.

    Returns whether an incremental update is needed (for the dashboard badge/button).
    """
    folder = BUILD_GUIDES / project_id
    if not folder.is_dir():
        raise HTTPException(404, f"Project '{project_id}' not found")

    manifest = _load_manifest(folder)
    if not manifest:
        return {
            "hasManifest": False,
            "lastResearchAt": None,
            "newDocs": [],
            "changedDocs": [],
            "deletedDocs": [],
            "needsUpdate": False,
        }

    # Build lookup of manifest entries by filename
    manifest_entries = {}
    for entry in manifest.get("docsProcessed", []):
        manifest_entries[entry["filename"]] = entry

    docs_dir = folder / "docs"
    new_docs = []
    changed_docs = []
    current_filenames = set()

    if docs_dir.exists():
        for fp in sorted(docs_dir.iterdir()):
            if not fp.is_file():
                continue
            if fp.suffix not in DOC_EXTENSIONS:
                continue
            current_filenames.add(fp.name)
            entry = manifest_entries.get(fp.name)
            if entry is None:
                new_docs.append(fp.name)
            else:
                current_hash = _file_sha256(fp)
                if current_hash != (entry.get("sha256") or "").lower():
                    changed_docs.append(fp.name)

    deleted_docs = [
        name for name in manifest_entries
        if name not in current_filenames
    ]

    needs_update = len(new_docs) > 0 or len(changed_docs) > 0

    return {
        "hasManifest": True,
        "lastResearchAt": manifest.get("lastResearchAt"),
        "newDocs": new_docs,
        "changedDocs": changed_docs,
        "deletedDocs": deleted_docs,
        "needsUpdate": needs_update,
    }


@app.delete("/api/projects/{project_id}")
async def delete_project(project_id: str):
    """Delete an entire project and all its contents."""
    folder = BUILD_GUIDES / project_id
    if not folder.is_dir():
        raise HTTPException(404, f"Project '{project_id}' not found")
    shutil.rmtree(str(folder))
    return {"deleted": True, "project_id": project_id}


@app.delete("/api/projects/{project_id}/agents/{agent_id}")
async def delete_agent(project_id: str, agent_id: str):
    """Delete an agent and all its files."""
    folder = BUILD_GUIDES / project_id
    agent_dir = folder / "agents" / agent_id
    if not agent_dir.is_dir():
        raise HTTPException(404, f"Agent '{agent_id}' not found")
    shutil.rmtree(str(agent_dir))
    return {"deleted": True, "agent_id": agent_id}


@app.get("/api/projects/{project_id}/docs/{filename}/raw")
async def serve_doc_raw(project_id: str, filename: str):
    """Serve a raw document file (images, PDFs, etc.) from docs/."""
    folder = BUILD_GUIDES / project_id
    if not folder.is_dir():
        raise HTTPException(404, f"Project '{project_id}' not found")

    safe = re.sub(r"[^\w\-.]", "_", filename)
    docs_dir = folder / "docs"
    target = docs_dir / safe
    if not target.exists():
        # Also check project root (some files saved there)
        target = folder / safe
    if not target.exists():
        raise HTTPException(404, f"File '{safe}' not found")

    # Verify resolved path stays within project folder (defense in depth)
    if not target.resolve().is_relative_to(folder.resolve()):
        raise HTTPException(400, "Invalid file path")

    return FileResponse(target)


@app.delete("/api/projects/{project_id}/docs/{filename}")
async def delete_doc(project_id: str, filename: str):
    """Delete a document from the project's docs/ folder."""
    folder = BUILD_GUIDES / project_id
    if not folder.is_dir():
        raise HTTPException(404, f"Project '{project_id}' not found")

    safe = re.sub(r"[^\w\-.]", "_", filename)
    docs_dir = folder / "docs"
    target = docs_dir / safe
    if not target.exists():
        raise HTTPException(404, f"File '{safe}' not found in docs/")

    if not target.resolve().is_relative_to(docs_dir.resolve()):
        raise HTTPException(400, "Invalid file path")

    target.unlink()
    return {"deleted": True, "filename": safe}


@app.get("/api/projects/{project_id}/docs/{filename}/content")
async def get_doc_content(project_id: str, filename: str):
    """Extract text content from a document for preview.

    Text files return content directly. Binary docs (docx/pptx/xlsx) are
    extracted via MarkItDown on demand. PDFs and images should use the /raw
    endpoint for native browser rendering instead.
    """
    folder = BUILD_GUIDES / project_id
    if not folder.is_dir():
        raise HTTPException(404, f"Project '{project_id}' not found")

    safe = re.sub(r"[^\w\-.]", "_", filename)
    target = folder / "docs" / safe
    if not target.exists():
        raise HTTPException(404, f"File '{safe}' not found")

    if not target.resolve().is_relative_to((folder / "docs").resolve()):
        raise HTTPException(400, "Invalid file path")

    # Text files: read directly
    if target.suffix in {".md", ".csv", ".txt", ".json"}:
        return {"filename": safe, "content": target.read_text(encoding="utf-8")}

    # Binary docs: extract via MarkItDown
    if target.suffix in {".docx", ".pptx", ".xlsx", ".xls"}:
        # Check for encrypted / MIP-protected files first
        if target.suffix in {".docx", ".pptx", ".xlsx"} and not zipfile.is_zipfile(str(target)):
            return {
                "filename": safe,
                "content": "",
                "error": "This file is encrypted or protected and cannot be previewed.",
            }
        try:
            from markitdown import MarkItDown
            converter = MarkItDown(enable_plugins=False)
            result = converter.convert(str(target))
            if result.text_content and result.text_content.strip():
                return {"filename": safe, "content": result.text_content}
        except ImportError:
            raise HTTPException(501, "Install markitdown for document preview: pip install 'markitdown[all]'")
        except Exception as e:
            return {"filename": safe, "content": "", "error": f"Extraction failed: {str(e)[:200]}"}
        return {"filename": safe, "content": ""}

    return {"filename": safe, "content": ""}


# ---------------------------------------------------------------------------
# Terminal — node-pty sidecar (proper ConPTY on Windows)
# ---------------------------------------------------------------------------

_terminal_server_proc = None


def _kill_stale_terminal_server(terminal_port: int):
    """Kill any leftover node process on the terminal port from a previous run."""
    try:
        result = subprocess.run(
            ["netstat", "-ano", "-p", "TCP"],
            capture_output=True, text=True, timeout=5,
        )
        killed = set()
        for line in result.stdout.splitlines():
            if f":{terminal_port}" in line and ("LISTENING" in line or "TIME_WAIT" in line or "CLOSE_WAIT" in line):
                pid = line.strip().split()[-1]
                if pid.isdigit() and pid not in killed:
                    subprocess.run(["taskkill", "/F", "/PID", pid],
                                   capture_output=True, timeout=5)
                    print(f"  Killed stale terminal server (pid {pid})")
                    killed.add(pid)
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

    terminal_port = int(os.environ.get("TERMINAL_PORT", _port + 1))

    # Kill any orphaned process from a previous run
    _kill_stale_terminal_server(terminal_port)

    time.sleep(0.5)  # Let OS release the socket after killing stale process

    try:
        _terminal_server_proc = subprocess.Popen(
            ["node", str(terminal_js)],
            cwd=str(BASE_DIR),
            env={**os.environ, "TERMINAL_PORT": str(terminal_port)},
        )
        print(f"  Terminal server started on ws://localhost:{terminal_port} (pid {_terminal_server_proc.pid})")
    except Exception as e:
        print(f"  WARNING: Failed to start terminal server: {e}")


# ---------------------------------------------------------------------------
# Static file serving — SPA with catch-all
# ---------------------------------------------------------------------------

# Mount dist/assets/ for JS/CSS bundles (must come before SPA catch-all)
if DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")


@app.get("/{full_path:path}")
async def spa_catchall(full_path: str):
    """SPA catch-all — serve static file if it exists, else index.html."""
    # Try serving a static file from dist/
    static_file = DIST_DIR / full_path
    if static_file.is_file() and DIST_DIR.exists():
        return FileResponse(str(static_file))
    # Fall back to index.html for client-side routing
    index = DIST_DIR / "index.html"
    if index.exists():
        return HTMLResponse(index.read_text(encoding="utf-8"))
    return HTMLResponse("<h2>Frontend not built</h2>", status_code=200)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    terminal_port = int(os.environ.get("TERMINAL_PORT", port + 1))
    print(f"MCS Agent Builder — starting on http://localhost:{port}")
    print(f"  Base dir: {BASE_DIR}")
    print(f"  Build Guides: {BUILD_GUIDES}")
    print(f"  Engine: Claude Code terminal (ws://localhost:{terminal_port})")
    _ensure_terminal_server()
    try:
        uvicorn.run(app, host="127.0.0.1", port=port)
    finally:
        if _terminal_server_proc and _terminal_server_proc.poll() is None:
            _terminal_server_proc.terminate()
            print("Terminal server stopped")
