import React from 'react';
import { useAgent } from '../context/AgentContext';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogContent,
  DialogFooter,
  CopilotButton,
} from './ui';
import { AgentIcon } from './ui';

interface SaveSnapshotDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAgent: (agentId: string) => void;
}

export function SaveSnapshotDialog({ isOpen, onClose, onSelectAgent }: SaveSnapshotDialogProps) {
  const { agents } = useAgent();
  const agentList = agents.filter(a => a.type === 'agent');

  const handleSelect = (agentId: string) => {
    onSelectAgent(agentId);
    onClose();
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} maxWidth="md">
      <DialogHeader onClose={onClose}>
        <DialogTitle>New Snapshot — Choose Agent</DialogTitle>
      </DialogHeader>

      <DialogContent>
        {agentList.length === 0 ? (
          <p className="text-body-2 text-[var(--colorNeutralForeground2)] py-2">
            No agents found. Create an agent first, then come back to snapshot it.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {agentList.map(agent => (
              <button
                key={agent.id}
                type="button"
                onClick={() => handleSelect(agent.id)}
                className="flex items-center gap-3 p-3 rounded-lg text-left hover:bg-[var(--colorNeutralBackground2)] transition-colors"
              >
                <div className="shrink-0">
                  <AgentIcon agent={agent} size={32} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-body-2 font-medium text-[var(--colorNeutralForeground1)] truncate">
                    {agent.name}
                  </p>
                  {agent.description && (
                    <p className="text-caption text-[var(--colorNeutralForeground3)] truncate mt-0.5">
                      {agent.description}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </DialogContent>

      <DialogFooter>
        <CopilotButton variant="secondary" onClick={onClose} size="md">
          Cancel
        </CopilotButton>
      </DialogFooter>
    </Dialog>
  );
}
