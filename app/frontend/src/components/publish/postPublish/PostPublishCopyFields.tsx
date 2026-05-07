/**
 * Renders post-publish copy fields as read-only CopilotInput components
 * with copy-to-clipboard buttons.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Copy20Regular, Checkmark20Regular } from '@fluentui/react-icons';
import { CopilotInput, CopilotButton } from '../../ui';
import type { PostPublishCopyField } from './messageComposer';

interface PostPublishCopyFieldsProps {
  fields: PostPublishCopyField[];
  className?: string;
}

export const PostPublishCopyFields: React.FC<PostPublishCopyFieldsProps> = ({ fields, className }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = useCallback(async (value: string, index: number) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedIndex(index);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      // Clipboard write failed (permissions or non-HTTPS) — no visual feedback
    }
  }, []);

  if (!fields || fields.length === 0) return null;

  return (
    <div className={className}>
      {fields.map((field, i) => (
        <div key={field.label} className="mt-2">
          <CopilotInput
            label={field.label}
            value={field.value}
            readOnly
            size="sm"
            contentAfter={
              <CopilotButton
                variant="icon-subtle"
                size="sm"
                icon={copiedIndex === i ? <Checkmark20Regular className="text-green-600" /> : <Copy20Regular />}
                title={copiedIndex === i ? 'Copied!' : `Copy ${field.label}`}
                onClick={() => handleCopy(field.value, i)}
              />
            }
          />
        </div>
      ))}
    </div>
  );
};

export default PostPublishCopyFields;
