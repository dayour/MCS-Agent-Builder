import React from 'react';
import { Radio, RadioGroup } from '@fluentui/react-components';
import type { RadioGroupOnChangeData } from '@fluentui/react-components';

/**
 * CopilotRadio — Fluent v9 Radio with optional description text
 *
 * Wraps the Fluent v9 Radio/RadioGroup components, adding support for a
 * description line beneath each option label and adapting the onChange
 * signature to (value: string).
 *
 * Usage:
 *   <CopilotRadioGroup
 *     name="plan"
 *     value={selected}
 *     onChange={(value) => setSelected(value)}
 *     options={[
 *       { value: 'free', label: 'Free tier', description: 'Up to 100 messages/month' },
 *       { value: 'pro', label: 'Pro', description: 'Unlimited messages', disabled: true },
 *     ]}
 *   />
 */

export interface CopilotRadioOption {
  /** Value for this radio option */
  value: string;
  /** Primary label shown next to the radio */
  label: string;
  /** Optional helper text shown below the label */
  description?: string;
  /** Whether this option is disabled */
  disabled?: boolean;
}

export interface CopilotRadioGroupProps {
  /** Radio group name (shared across all options) */
  name?: string;
  /** Currently selected value */
  value?: string;
  /** Called with the new value when selection changes */
  onChange?: (value: string) => void;
  /** Radio options to render */
  options: CopilotRadioOption[];
  /** Optional className on the wrapper */
  className?: string;
  /** Layout direction — 'vertical' (default) or 'horizontal' */
  layout?: 'vertical' | 'horizontal';
}

export const CopilotRadioGroup: React.FC<CopilotRadioGroupProps> = ({
  name,
  value,
  onChange,
  options,
  className,
  layout = 'vertical',
}) => {
  const handleChange = React.useCallback(
    (_ev: React.FormEvent<HTMLDivElement>, data: RadioGroupOnChangeData) => {
      onChange?.(data.value);
    },
    [onChange]
  );

  return (
    <RadioGroup
      name={name}
      value={value}
      onChange={handleChange}
      layout={layout}
      className={className}
    >
      {options.map((opt) => {
        const labelContent = opt.description ? (
          <span>
            <span className="text-sm font-medium text-gray-900">{opt.label}</span>
            <span className="block text-xs text-gray-500 mt-0.5">{opt.description}</span>
          </span>
        ) : (
          <span className="text-sm font-medium text-gray-900">{opt.label}</span>
        );

        return (
          <Radio
            key={opt.value}
            value={opt.value}
            label={labelContent}
            disabled={opt.disabled}
          />
        );
      })}
    </RadioGroup>
  );
};

export default CopilotRadioGroup;
