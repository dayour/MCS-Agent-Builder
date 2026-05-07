/**
 * chatUploads.ts — Helpers for sending file attachments through /api/chat.
 *
 * The unified chat backend expects attachments as `{name, kind}` referring
 * to files already on disk under `Build-Guides/{projectId}/docs/`. This
 * module pushes the actual file content to the existing
 * /api/projects/:id/upload endpoint and returns the server-assigned final
 * names (which may differ from the client name once .docx → .md conversion
 * runs server-side).
 */

export interface UploadedAttachment {
  /** Final filename on disk (post-conversion). */
  name: string;
  /** MIME-ish kind hint, useful for the brain to understand the doc. */
  kind?: string;
  /** Bytes after conversion. */
  size?: number;
  /** Server-side path for debugging. */
  path?: string;
  /** Conversion error message, if any (file may still be usable as raw). */
  conversionError?: string | null;
}

export interface EnsureProjectResult {
  projectId: string;
  created: boolean;
}

/**
 * Create a project if `existingProjectId` is null/empty. Returns the slug
 * the server assigned. The default name is derived from the first user
 * message; if none is available we fall back to a timestamped slug.
 */
export async function ensureProject(args: {
  existingProjectId?: string;
  seedMessage?: string;
}): Promise<EnsureProjectResult> {
  if (args.existingProjectId && args.existingProjectId.trim()) {
    return { projectId: args.existingProjectId, created: false };
  }

  const seed = (args.seedMessage || '').trim();
  const slug = seed
    ? seed.split(/\s+/).slice(0, 4).join('-').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40)
    : '';
  const fallback = `chat-${Date.now().toString(36)}`;
  const name = slug || fallback;

  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    throw new Error(`failed to create project: ${res.status}`);
  }
  const data = await res.json();
  return { projectId: data.id, created: !data.existed };
}

/**
 * Upload one File to the project's docs/ folder. Returns the
 * post-conversion filename + metadata.
 */
export async function uploadOne(projectId: string, file: File): Promise<UploadedAttachment> {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/upload`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let detail = text;
    try { detail = JSON.parse(text)?.detail || text; } catch { /* ignore */ }
    throw new Error(`upload failed (${res.status}): ${detail || file.name}`);
  }

  const data = await res.json();
  return {
    name: data.filename,
    kind: file.type || undefined,
    size: data.size,
    path: data.path,
    conversionError: data.conversionError ?? null,
  };
}

/**
 * Upload many files in parallel. Returns one entry per file in the same
 * order; throws on any failure unless `continueOnError` is set, in which
 * case failed entries are returned with `name === ''` and `conversionError`
 * carrying the error message.
 */
export async function uploadAll(
  projectId: string,
  files: File[],
  opts?: { continueOnError?: boolean }
): Promise<UploadedAttachment[]> {
  if (files.length === 0) return [];
  const continueOnError = !!opts?.continueOnError;

  const settled = await Promise.allSettled(files.map(f => uploadOne(projectId, f)));
  const out: UploadedAttachment[] = [];
  for (let i = 0; i < settled.length; i++) {
    const r = settled[i];
    if (r.status === 'fulfilled') {
      out.push(r.value);
    } else if (continueOnError) {
      out.push({
        name: '',
        kind: files[i].type || undefined,
        conversionError: (r.reason && r.reason.message) ? String(r.reason.message) : 'upload failed',
      });
    } else {
      throw r.reason instanceof Error ? r.reason : new Error(String(r.reason));
    }
  }
  return out;
}
