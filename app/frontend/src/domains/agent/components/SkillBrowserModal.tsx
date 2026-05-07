import React, { useState, useEffect } from 'react';
import { Dismiss20Regular, Checkmark20Filled } from '@fluentui/react-icons';
import { Dialog } from '../../../components/ui/Dialog';
import { CopilotButton } from '../../../components/ui/CopilotButton';
import { CopilotInput } from '../../../components/ui/CopilotInput';
import { toSentenceCase } from '../../../utils/skillUtils';
import { Skill } from '../../../types';

interface GithubSkill {
  slug: string;
  name: string;
  description: string;
  body: string;
}

interface SkillBrowserModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (skills: Omit<Skill, 'id' | 'createdAt'>[]) => void;
  agentId?: string;
}

function parseFrontmatter(raw: string): { name: string; description: string } {
  if (!raw.startsWith('---')) return { name: '', description: '' };
  const end = raw.indexOf('\n---', 3);
  if (end === -1) return { name: '', description: '' };
  const fm = raw.slice(3, end);

  const nameMatch = fm.match(/^name:\s*(.+)$/m);
  // description can be plain or quoted; grab everything after "description:" up to the next key
  const descMatch = fm.match(/^description:\s*["']?([\s\S]*?)["']?\s*(?=\n\w|$)/m);

  return {
    name: nameMatch ? nameMatch[1].trim().replace(/^["']|["']$/g, '') : '',
    description: descMatch ? descMatch[1].trim().replace(/\n/g, ' ').replace(/^["']|["']$/g, '') : '',
  };
}

export const SkillBrowserModal: React.FC<SkillBrowserModalProps> = ({ open, onClose, onImport, agentId }) => {
  const [skills, setSkills] = useState<GithubSkill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const { signal } = controller;

    setLoading(true);
    setError(null);
    setSelected(new Set());
    setSearch('');

    fetch('https://api.github.com/repos/anthropics/skills/contents/skills', { signal })
      .then(r => {
        if (!r.ok) throw new Error(`GitHub API error: ${r.status}`);
        return r.json();
      })
      .then(async (entries: { name: string; type: string }[]) => {
        const folders = entries.filter(e => e.type === 'dir').map(e => e.name);
        const fetched = await Promise.all(
          folders.map(async slug => {
            const raw = await fetch(
              `https://raw.githubusercontent.com/anthropics/skills/main/skills/${slug}/SKILL.md`,
              { signal }
            ).then(r => (r.ok ? r.text() : ''));
            const { name, description } = parseFrontmatter(raw);
            return { slug, name: name || slug, description, body: raw };
          })
        );
        setSkills(fetched.filter(s => s.body));
        setLoading(false);
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        setError('Failed to load skills from GitHub. Check your connection and try again.');
        setLoading(false);
      });

    return () => controller.abort();
  }, [open]);

  const toggle = (slug: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(slug) ? next.delete(slug) : next.add(slug);
      return next;
    });
  };

  const handleImport = () => {
    const toImport = skills
      .filter(s => selected.has(s.slug))
      .map(s => ({ name: s.name, description: s.description, body: s.body, agentId }));
    onImport(toImport);
    onClose();
  };

  const filtered = skills.filter(
    s =>
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog isOpen={open} onClose={onClose} maxWidth="4xl" height="80vh">
      <div className="flex flex-col h-full overflow-hidden">

        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Browse skills</h2>
            <p className="text-sm text-gray-500 mt-0.5">Select skills to add to your agent</p>
          </div>
          <div className="flex items-center gap-3">
            <CopilotInput
              size="sm"
              placeholder="Search skills..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-56"
            />
            <CopilotButton variant="ghost" size="sm" onClick={onClose} aria-label="Close">
              <Dismiss20Regular />
            </CopilotButton>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <div className="flex items-center justify-center h-48 text-sm text-gray-400">
              Loading skills…
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center h-48 text-sm text-red-500">
              {error}
            </div>
          )}
          {!loading && !error && filtered.length === 0 && (
            <div className="flex items-center justify-center h-48 text-sm text-gray-400">
              No skills match your search.
            </div>
          )}
          {!loading && !error && filtered.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {filtered.map(skill => {
                const isSelected = selected.has(skill.slug);
                return (
                  <div
                    key={skill.slug}
                    role="checkbox"
                    aria-checked={isSelected}
                    tabIndex={0}
                    className={`relative flex gap-3 p-4 rounded-xl border cursor-pointer transition-colors select-none ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => toggle(skill.slug)}
                    onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && toggle(skill.slug)}
                  >
                    {/* Icon avatar */}
                    <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500 uppercase">
                      {skill.slug.charAt(0)}
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0 pr-6">
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {toSentenceCase(skill.name)}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                        {skill.description}
                      </div>
                    </div>

                    {/* Selection indicator */}
                    <div className="absolute top-3 right-3">
                      {isSelected ? (
                        <Checkmark20Filled className="text-blue-500" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <span className="text-sm text-gray-500">
            {selected.size > 0
              ? `${selected.size} skill${selected.size !== 1 ? 's' : ''} selected`
              : 'No skills selected'}
          </span>
          <div className="flex gap-2">
            <CopilotButton variant="secondary" size="md" onClick={onClose}>
              Cancel
            </CopilotButton>
            <CopilotButton
              variant="primary"
              size="md"
              onClick={handleImport}
              disabled={selected.size === 0}
            >
              Add {selected.size > 0 ? `${selected.size} ` : ''}skill{selected.size !== 1 ? 's' : ''}
            </CopilotButton>
          </div>
        </div>

      </div>
    </Dialog>
  );
};
