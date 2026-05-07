import React, { useState } from 'react';
import { EvalRating, MessageEval } from '../types';
import { CopilotButton } from './ui/CopilotButton';
import { CopilotTextarea } from './ui/CopilotTextarea';
import { Beaker20Regular, CheckmarkCircle20Filled } from '@fluentui/react-icons';

interface InlineMessageRatingProps {
  messageId: string;
  messageContent: string;
  userPrompt: string;
  sessionId: string;
  agentId?: string;
  agentName?: string;
  existingEval?: MessageEval;
  onSave: (evalData: MessageEval) => Promise<void>;
}

const RATING_OPTIONS: EvalRating[] = ['poor', 'ok', 'good'];
const RATING_LABELS: Record<EvalRating, string> = { poor: 'Poor', ok: 'OK', good: 'Great' };

const RatingRow: React.FC<{
  label: string;
  value: EvalRating | null;
  onChange: (v: EvalRating) => void;
}> = ({ label, value, onChange }) => (
  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
    <span className="text-xs text-text-subtle w-36 shrink-0">{label}</span>
    <div className="flex gap-1 flex-wrap">
      {RATING_OPTIONS.map(r => (
        <CopilotButton
          key={r}
          size="sm"
          variant="secondary"
          checked={value === r}
          onClick={() => onChange(r)}
          className="min-w-[52px]"
        >
          {RATING_LABELS[r]}
        </CopilotButton>
      ))}
    </div>
  </div>
);

const InlineMessageRating: React.FC<InlineMessageRatingProps> = ({
  messageId,
  messageContent,
  userPrompt,
  sessionId,
  agentId,
  agentName,
  existingEval,
  onSave,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [accuracy, setAccuracy] = useState<boolean | null>(existingEval?.accuracy ?? null);
  const [relevance, setRelevance] = useState<EvalRating | null>(existingEval?.relevance ?? null);
  const [completeness, setCompleteness] = useState<EvalRating | null>(existingEval?.completeness ?? null);
  const [clarity, setClarity] = useState<EvalRating | null>(existingEval?.clarity ?? null);
  const [actionCorrectness, setActionCorrectness] = useState<EvalRating | null>(existingEval?.actionCorrectness ?? null);
  const [comment, setComment] = useState(existingEval?.comment ?? '');
  const [rated, setRated] = useState(!!existingEval);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        messageId,
        messageContent,
        userPrompt,
        sessionId,
        agentId,
        agentName,
        accuracy,
        relevance,
        completeness,
        clarity,
        actionCorrectness,
        comment,
        evaluatedAt: new Date().toISOString(),
      });
      setRated(true);
      setExpanded(false);
    } finally {
      setSaving(false);
    }
  };

  if (!expanded) {
    return (
      <div className="mt-1.5 pl-10">
        <CopilotButton
          variant="ghost"
          size="sm"
          icon={rated ? <CheckmarkCircle20Filled className="w-3.5 h-3.5 text-green-600" /> : <Beaker20Regular className="w-3.5 h-3.5" />}
          onClick={() => setExpanded(true)}
          className="!text-xs !text-text-subtle !px-1.5 !gap-1"
        >
          {rated ? 'Rated ✓' : 'Rate'}
        </CopilotButton>
      </div>
    );
  }

  return (
    <div className="mt-2 pl-10">
      <div className="border border-border rounded-lg p-3 bg-[hsl(var(--secondary))]">
        <p className="text-sm font-semibold text-text-primary mb-3">Rate this response</p>
        {/* Accuracy */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
          <span className="text-xs text-text-subtle w-36 shrink-0">Accuracy</span>
          <div className="flex gap-1 flex-wrap">
            <CopilotButton
              size="sm"
              variant="secondary"
              checked={accuracy === false}
              onClick={() => setAccuracy(accuracy === false ? null : false)}
              className="min-w-[80px]"
            >
              Inaccurate
            </CopilotButton>
            <CopilotButton
              size="sm"
              variant="secondary"
              checked={accuracy === true}
              onClick={() => setAccuracy(accuracy === true ? null : true)}
              className="min-w-[72px]"
            >
              Accurate
            </CopilotButton>
          </div>
        </div>

        <RatingRow label="Relevance" value={relevance} onChange={setRelevance} />
        <RatingRow label="Completeness" value={completeness} onChange={setCompleteness} />
        <RatingRow label="Clarity" value={clarity} onChange={setClarity} />
        <RatingRow label="Execution" value={actionCorrectness} onChange={setActionCorrectness} />

        {/* Comment */}
        <div className="mt-3 mb-3">
          <CopilotTextarea
            value={comment}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setComment(e.target.value)}
            placeholder="Comment (optional)"
            rows={2}
            size="sm"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <CopilotButton
            size="sm"
            variant="primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </CopilotButton>
          <CopilotButton
            size="sm"
            variant="ghost"
            onClick={() => setExpanded(false)}
          >
            Cancel
          </CopilotButton>
        </div>
      </div>
    </div>
  );
};

export default InlineMessageRating;
