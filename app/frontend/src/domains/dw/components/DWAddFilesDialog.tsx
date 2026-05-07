import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '../../../components/ui/Dialog';
import { CopilotButton } from '../../../components/ui/CopilotButton';
import { CopilotInput } from '../../../components/ui/CopilotInput';
import { CopilotTabs } from '../../../components/ui/CopilotTabs';
import { CopilotCheckbox } from '../../../components/ui/CopilotCheckbox';
import { Search20Regular, Cloud20Regular, FolderOpen20Regular } from '@fluentui/react-icons';
import { getConnectorIcon } from '../../../utils/agentIcons';
import { ALL_FILES, Deliverable } from './DWContentTab';

interface DWAddFilesDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd?: (files: Deliverable[]) => void;
}

const TABS = [
  { label: 'Recent', value: 'recent' },
  { label: 'OneDrive', value: 'onedrive' },
  { label: 'SharePoint', value: 'sharepoint' },
];

function appToExt(app: string): string {
  const map: Record<string, string> = {
    word: 'docx', excel: 'xlsx', powerpoint: 'pptx',
    pdf: 'pdf', sharepoint: 'docx', file: 'file', onenote: 'one',
  };
  return map[app] ?? 'file';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export const DWAddFilesDialog: React.FC<DWAddFilesDialogProps> = ({ open, onClose, onAdd }) => {
  const [activeTab, setActiveTab] = useState('recent');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setSearch('');
      setActiveTab('recent');
    }
  }, [open]);

  const files = useMemo(() => {
    const filtered = ALL_FILES.filter(f => {
      if (activeTab === 'onedrive') return f.location === 'OneDrive';
      if (activeTab === 'sharepoint') return f.location === 'SharePoint';
      return true; // recent = all
    });
    if (!search.trim()) return filtered;
    const q = search.toLowerCase();
    return filtered.filter(f => f.name.toLowerCase().includes(q));
  }, [activeTab, search]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAdd = () => {
    const picked = ALL_FILES.filter(f => selected.has(f.id));
    onAdd?.(picked);
    setSelected(new Set());
    setSearch('');
    onClose();
  };

  const handleClose = () => {
    setSelected(new Set());
    setSearch('');
    onClose();
  };

  return (
    <Dialog isOpen={open} onClose={handleClose} maxWidth="lg">
      <DialogHeader>
        <div className="flex items-center gap-2">
          <Cloud20Regular className="w-5 h-5 text-[#0F6CBD]" />
          <DialogTitle>Add files</DialogTitle>
        </div>
      </DialogHeader>

      <DialogContent>
        <div className="flex flex-col gap-3 min-h-[420px]">
          {/* Search */}
          <CopilotInput
            size="md"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search files..."
            contentBefore={<Search20Regular className="w-4 h-4 text-neutral-400" />}
          />

          {/* Tabs */}
          <CopilotTabs
            tabs={TABS}
            value={activeTab}
            onChange={setActiveTab}
          />

          {/* File list */}
          <div className="border border-neutral-200 rounded-lg overflow-hidden flex-1">
            {/* Header row */}
            <div className="grid text-xs font-semibold text-neutral-500 bg-neutral-50 border-b border-neutral-200 px-3 py-2.5"
              style={{ gridTemplateColumns: '32px 1fr 120px 90px 90px' }}>
              <span />
              <span>Name</span>
              <span>Location</span>
              <span>Modified</span>
              <span>Size</span>
            </div>

            {/* Rows */}
            <div className="overflow-y-auto max-h-[280px]">
              {files.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-neutral-400">
                  <FolderOpen20Regular className="w-8 h-8" />
                  <p className="text-sm">No files found</p>
                </div>
              ) : files.map(file => {
                const ext = appToExt(file.app);
                const icon = getConnectorIcon(file.app, 'w-5 h-5');
                const isChecked = selected.has(file.id);
                return (
                  <div
                    key={file.id}
                    className={`grid items-center px-3 py-2.5 cursor-pointer border-b border-neutral-100 last:border-0 hover:bg-[#F5F5FF] transition-colors ${isChecked ? 'bg-[#EFF6FF]' : ''}`}
                    style={{ gridTemplateColumns: '32px 1fr 120px 90px 90px' }}
                    onClick={() => toggle(file.id)}
                  >
                    <CopilotCheckbox
                      checked={isChecked}
                      onChange={() => toggle(file.id)}
                      label=""
                    />
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex-shrink-0">{icon}</span>
                      <div className="min-w-0">
                        <p className="text-sm text-neutral-900 truncate">{file.name}</p>
                        {file.taskName && (
                          <p className="text-xs text-neutral-400 truncate">{file.taskName}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-neutral-500 truncate">{file.location}</span>
                    <span className="text-xs text-neutral-500">{formatDate(file.date)}</span>
                    <span className="text-xs text-neutral-500">—</span>
                  </div>
                );
              })}
            </div>
          </div>

          {selected.size > 0 && (
            <p className="text-xs text-neutral-500">{selected.size} file{selected.size !== 1 ? 's' : ''} selected</p>
          )}
        </div>
      </DialogContent>

      <DialogFooter>
        <CopilotButton variant="secondary" size="md" onClick={handleClose}>Cancel</CopilotButton>
        <CopilotButton variant="primary" size="md" onClick={handleAdd} disabled={selected.size === 0}>
          Add {selected.size > 0 ? `(${selected.size})` : ''}
        </CopilotButton>
      </DialogFooter>
    </Dialog>
  );
};
