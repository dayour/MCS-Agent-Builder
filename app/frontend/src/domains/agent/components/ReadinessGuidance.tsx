import { CopilotButton } from '../../../components/ui/CopilotButton';
import { CopilotInput } from '../../../components/ui/CopilotInput';
import { Copy20Regular } from '@fluentui/react-icons';

export interface ReadinessGuidanceProps {
  channel: string;
  appId: string;
  submitDisabled: boolean;
  onSubmit?: () => void;
}

/**
 * "Get your agent ready" guidance block with SSO App ID and submit button.
 * Used in both pre-submit and post-submit states of the Distribution section.
 */
export function ReadinessGuidance({ channel, appId, submitDisabled, onSubmit }: ReadinessGuidanceProps) {
  const channelLabel = channel === 'teams' ? 'Microsoft Teams' : 'Microsoft 365';

  return (
    <>
      <div>
        <p className="text-sm font-semibold text-gray-900 mb-2">Get your agent ready</p>
        <p className="text-xs text-gray-600 leading-relaxed">
          Admins can feature your agent prominently as an app in the Built by your org section of {channelLabel}, pre-install for users in your org, and more.{' '}
          <a href="#" className="text-[hsl(var(--primary))] hover:underline" onClick={e => e.preventDefault()}>Learn more</a>
        </p>
        <p className="text-xs text-gray-600 mt-3">Before submitting, make sure to:</p>
        <ul className="mt-1.5 space-y-1.5 text-xs text-gray-600 list-disc pl-5">
          <li>Ensure your agent is ready for release and in compliance with company standards, rules, and policies.</li>
          <li>Coordinate with your teammates. Once the agent is submitted, it can't be resubmitted by others until an admin approves or rejects it.</li>
        </ul>
      </div>

      <div>
        <p className="text-sm font-semibold text-gray-900 mb-2">Teams Authentication SSO Configuration</p>
        <p className="text-xs text-gray-600 leading-relaxed">
          When using Manual authentication with Azure Active Directory options, you can configure Teams for SSO. You will need this App ID to construct the correct configuration information.{' '}
          <a href="#" className="text-[hsl(var(--primary))] hover:underline" onClick={e => e.preventDefault()}>Learn more</a>
        </p>
        <p className="text-xs font-medium text-gray-700 mt-3 mb-1">App ID</p>
        <div className="flex items-center gap-2">
          <CopilotInput appearance="outline" size="sm" value={appId} readOnly className="flex-1" />
          <CopilotButton size="sm" variant="outline" icon={<Copy20Regular />} onClick={() => navigator.clipboard.writeText(appId)}>Copy</CopilotButton>
        </div>
      </div>

      <div className="pt-2">
        <CopilotButton
          size="md"
          variant="primary"
          className="w-full"
          disabled={submitDisabled}
          onClick={onSubmit}
        >
          Submit for admin approval
        </CopilotButton>
      </div>
    </>
  );
}
