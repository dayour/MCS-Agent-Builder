import React, { useState, useEffect } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '../../../components/ui/Dialog';
import { CopilotButton } from '../../../components/ui/CopilotButton';
import { CopilotTextarea } from '../../../components/ui/CopilotTextarea';
import { CopilotDropdown } from '../../../components/ui/CopilotDropdown';
import { useAgent } from '../../../context/AgentContext';
import { useDW } from '../context/DWContext';
import { DWTask } from '../../../types';

interface DWAddTaskDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called with the created task so the parent can navigate to it without reading state */
  onCreated?: (task: DWTask) => void;
}

const SCHEDULE_OPTIONS = [
  { label: 'Immediately', value: 'Immediately' },
  { label: 'Today', value: 'Today' },
  { label: 'Tomorrow', value: 'Tomorrow' },
  { label: 'This week', value: 'This week' },
  { label: 'Next week', value: 'Next week' },
  { label: 'No date', value: '' },
];

export const DWAddTaskDialog: React.FC<DWAddTaskDialogProps> = ({ open, onClose, onCreated }) => {
  const { agentConfig } = useAgent();
  const { addDwTask } = useDW();
  const [description, setDescription] = useState('');
  const [schedule, setSchedule] = useState('Immediately');

  useEffect(() => {
    if (open) {
      setDescription('');
      setSchedule('Immediately');
    }
  }, [open]);

  const canSubmit = description.trim().length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const task: DWTask = {
      id: crypto.randomUUID(),
      name: description.trim().slice(0, 120),
      subtitle: '',
      status: 'upcoming',
      lastUpdated: 'Just now',
      when: schedule || undefined,
      objective: description.trim() || undefined,
      date: new Date().toISOString(),
    };
    addDwTask(agentConfig.id, task);
    onClose();
    onCreated?.(task);
  };

  return (
    <Dialog isOpen={open} onClose={onClose} maxWidth="sm">
      <DialogHeader>
        <DialogTitle>Add Task</DialogTitle>
      </DialogHeader>
      <DialogContent>
        <div className="space-y-4">
          <div>
            <label htmlFor="dw-task-description" className="block text-sm font-medium text-neutral-700 mb-1.5">
              Describe task <span className="text-red-500">*</span>
            </label>
            <CopilotTextarea
              id="dw-task-description"
              autoFocus
              size="md"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What should the AI Teammate achieve with this task?"
              rows={4}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Schedule</label>
            <CopilotDropdown
              variant="dropdown"
              size="md"
              value={schedule}
              options={SCHEDULE_OPTIONS}
              onChange={val => setSchedule(val as string)}
            />
          </div>
        </div>
      </DialogContent>
      <DialogFooter>
        <CopilotButton variant="secondary" size="md" onClick={onClose}>Cancel</CopilotButton>
        <CopilotButton variant="primary" size="md" onClick={handleSubmit} disabled={!canSubmit}>Create Task</CopilotButton>
      </DialogFooter>
    </Dialog>
  );
};
