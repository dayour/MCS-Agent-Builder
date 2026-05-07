import React from 'react';
import { Checkbox } from '@fluentui/react-components';
import type { CheckboxProps, CheckboxOnChangeData } from '@fluentui/react-components';

/**
 * CopilotCheckbox — Fluent v9 Checkbox with optional description text
 *
 * Wraps the Fluent v9 Checkbox component, adding support for a description
 * line beneath the label and adapting the onChange signature to (boolean).
 *
 * Usage:
 *   <CopilotCheckbox
 *     checked={value}
 *     onChange={(checked) => setValue(checked)}
 *     label="Allow agent to decide dynamically"
 *     description="If unchecked, only used when explicitly referenced."
 *   />
 */

export interface CopilotCheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'checked' | 'defaultChecked' | 'disabled' | 'id'> {
  /** Primary label shown next to the checkbox */
  label: string;
  /** Optional helper text shown below the label */
  description?: string;
  /** Controlled checked state */
  checked?: boolean;
  /** Uncontrolled default checked state */
  defaultChecked?: boolean;
  /** Called with the new boolean value when the checkbox changes */
  onChange?: (checked: boolean) => void;
  /** Whether the checkbox is disabled */
  disabled?: boolean;
  /** Optional id */
  id?: string;
  /** Optional className on the wrapper */
  className?: string;
}

export const CopilotCheckbox: React.FC<CopilotCheckboxProps> = ({
  label,
  description,
  checked,
  defaultChecked,
  onChange,
  disabled,
  id,
  className,
  ...rest
}) => {
  const handleChange = React.useCallback(
    (_ev: React.ChangeEvent<HTMLInputElement>, data: CheckboxOnChangeData) => {
      onChange?.(!!data.checked);
    },
    [onChange]
  );

  const labelContent = description ? (
    <span>
      <span className="text-sm font-medium text-gray-900">{label}</span>
      <span className="block text-xs text-gray-500 mt-0.5">{description}</span>
    </span>
  ) : (
    <span className="text-sm font-medium text-gray-900">{label}</span>
  );

  return (
    <div className={className} {...rest}>
      <Checkbox
        id={id}
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={handleChange}
        disabled={disabled}
        label={labelContent}
      />
    </div>
  );
};

export default CopilotCheckbox;
