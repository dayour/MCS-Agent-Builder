import React, { useState } from 'react';
import {
  ShieldTask20Regular,
  DataTrending20Regular,
  BranchFork20Regular,
  Beaker20Regular,
  Checkmark16Regular,
} from '@fluentui/react-icons';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '../../components/ui';
import { CopilotButton } from '../../components/ui/CopilotButton';
import { CopilotInput } from '../../components/ui/CopilotInput';
import { CopilotCheckbox } from '../../components/ui/CopilotCheckbox';
import { DEFAULT_THRESHOLDS, DEFAULT_METHODS_BY_BUCKET, BUCKET_CONFIG, METHOD_LABELS, METHOD_DESCRIPTIONS } from './constants';

interface CreateEvalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (evalSet: {
    name: string;
    description: string;
    passThreshold: number;
    methods: Array<{ type: string; score?: number; mode?: string }>;
    tests: [];
  }) => void;
  existingBuckets: string[];
}

const BUCKET_ICONS: Record<string, React.ReactNode> = {
  boundaries: <ShieldTask20Regular className="w-5 h-5" />,
  quality: <DataTrending20Regular className="w-5 h-5" />,
  'edge-cases': <BranchFork20Regular className="w-5 h-5" />,
  custom: <Beaker20Regular className="w-5 h-5" />,
};

const BUCKET_OPTIONS = [
  { value: 'boundaries', label: 'Boundaries', description: 'Safety and compliance checks' },
  { value: 'quality', label: 'Quality', description: 'Core business capability tests' },
  { value: 'edge-cases', label: 'Edge Cases', description: 'Unusual inputs and boundary scenarios' },
  { value: 'custom', label: 'Custom', description: 'Define your own category' },
];

const ALL_METHODS = ['GeneralQuality', 'CompareMeaning', 'KeywordMatch', 'TextSimilarity', 'ExactMatch', 'ToolUse', 'PlanValidation'];

export const CreateEvalDialog: React.FC<CreateEvalDialogProps> = ({ isOpen, onClose, onCreate, existingBuckets }) => {
  const [bucketType, setBucketType] = useState('boundaries');
  const [customName, setCustomName] = useState('');
  const [description, setDescription] = useState('');
  const [threshold, setThreshold] = useState(95);
  const [selectedMethods, setSelectedMethods] = useState<Set<string>>(
    new Set(['GeneralQuality', 'KeywordMatch'])
  );

  const handleBucketChange = (value: string) => {
    setBucketType(value);
    if (value !== 'custom') {
      setThreshold(DEFAULT_THRESHOLDS[value] ?? 80);
      setDescription(BUCKET_CONFIG[value]?.description ?? '');
      const defaults = DEFAULT_METHODS_BY_BUCKET[value] ?? [];
      setSelectedMethods(new Set(defaults.map(m => m.type)));
    }
  };

  const toggleMethod = (method: string) => {
    setSelectedMethods(prev => {
      const next = new Set(prev);
      if (next.has(method)) next.delete(method); else next.add(method);
      return next;
    });
  };

  const name = bucketType === 'custom' ? customName.trim() : bucketType;
  const canCreate = name.length > 0 && selectedMethods.size > 0 && !existingBuckets.includes(name);

  const handleCreate = () => {
    const methods = (DEFAULT_METHODS_BY_BUCKET[name] ?? []).filter(m => selectedMethods.has(m.type));
    for (const mt of selectedMethods) {
      if (!methods.find(m => m.type === mt)) {
        methods.push({ type: mt });
      }
    }
    onCreate({
      name,
      description,
      passThreshold: threshold,
      methods,
      tests: [],
    });
    onClose();
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} maxWidth="lg">
      <DialogHeader>
        <DialogTitle>Add eval set</DialogTitle>
      </DialogHeader>
      <DialogContent>
        <div className="space-y-6">
          {/* Category selection — card tiles */}
          <div>
            <label className="text-sm font-semibold text-[hsl(var(--text-primary))] block mb-3">Category</label>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Eval set category">
              {BUCKET_OPTIONS.map(opt => {
                const exists = opt.value !== 'custom' && existingBuckets.includes(opt.value);
                const isSelected = bucketType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-disabled={exists}
                    disabled={exists}
                    onClick={() => !exists && handleBucketChange(opt.value)}
                    className={`
                      relative text-left rounded-xl border px-4 py-3 transition-all
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))] focus-visible:ring-offset-1
                      ${exists
                        ? 'opacity-40 cursor-not-allowed border-gray-200 bg-gray-50'
                        : isSelected
                          ? 'border-[hsl(var(--primary))] shadow-[0_0_0_1px_hsl(var(--primary))] bg-[hsl(var(--primary))]/[0.04] cursor-pointer'
                          : 'border-gray-200 hover:border-gray-400 cursor-pointer hover:shadow-[var(--shadow-sm)]'
                      }
                    `}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[hsl(var(--primary))] text-white flex items-center justify-center">
                        <Checkmark16Regular className="w-2.5 h-2.5" />
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <span className={`flex-shrink-0 mt-0.5 ${isSelected ? 'text-[hsl(var(--primary))]' : 'text-gray-500'}`}>
                        {BUCKET_ICONS[opt.value]}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-[hsl(var(--text-primary))]">
                          {opt.label}
                          {exists && <span className="text-xs font-normal text-gray-400 ml-1.5">(exists)</span>}
                        </div>
                        <div className="text-[11px] text-[hsl(var(--text-subtle))] mt-0.5 leading-snug">{opt.description}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom name */}
          {bucketType === 'custom' && (
            <div>
              <label className="text-sm font-semibold text-[hsl(var(--text-primary))] block mb-1.5">Name</label>
              <CopilotInput
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g., regression, compliance-v2"
              />
            </div>
          )}

          {/* Description */}
          <div>
            <label className="text-sm font-semibold text-[hsl(var(--text-primary))] block mb-1.5">Description</label>
            <CopilotInput
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this eval set verify?"
            />
          </div>

          {/* Threshold */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-semibold text-[hsl(var(--text-primary))]">Pass threshold</label>
              <div className="flex items-center gap-1">
                <CopilotInput
                  type="number"
                  value={String(threshold)}
                  onChange={(e) => setThreshold(Math.min(100, Math.max(0, Number(e.target.value))))}
                  size="sm"
                  className="w-16 text-right"
                />
                <span className="text-sm text-[hsl(var(--text-subtle))]">%</span>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer
                         bg-gray-200 accent-[hsl(var(--primary))]
                         [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                         [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[hsl(var(--primary))]
                         [&::-webkit-slider-thumb]:shadow-[0_1px_3px_rgba(0,0,0,0.2)]
                         [&::-webkit-slider-thumb]:cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>0%</span>
              <span className="text-[hsl(var(--text-subtle))]">Below threshold = BLOCK or ITERATE verdict</span>
              <span>100%</span>
            </div>
          </div>

          {/* Scoring Methods */}
          <div>
            <label className="text-sm font-semibold text-[hsl(var(--text-primary))] block mb-1">Scoring methods</label>
            <p className="text-[11px] text-[hsl(var(--text-subtle))] mb-3">Select how test responses are evaluated. Multiple methods combine for a composite score.</p>
            <div className="space-y-1">
              {ALL_METHODS.map(method => (
                <CopilotCheckbox
                  key={method}
                  checked={selectedMethods.has(method)}
                  onChange={() => toggleMethod(method)}
                  label={METHOD_LABELS[method] ?? method}
                  description={METHOD_DESCRIPTIONS[method]}
                />
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
      <DialogFooter>
        <CopilotButton variant="secondary" onClick={onClose}>Cancel</CopilotButton>
        <CopilotButton variant="primary" onClick={handleCreate} disabled={!canCreate}>
          Create eval set
        </CopilotButton>
      </DialogFooter>
    </Dialog>
  );
};
