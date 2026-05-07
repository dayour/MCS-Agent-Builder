import { useState } from 'react';
import { CopilotButton } from '../../../components/ui/CopilotButton';
import { CopilotInput } from '../../../components/ui/CopilotInput';
import { CopilotCheckbox } from '../../../components/ui/CopilotCheckbox';
import {
  ChevronDown16Regular,
  ChevronRight16Regular,
  ChevronUp16Regular,
  Copy20Regular,
} from '@fluentui/react-icons';

export interface TeamsSettingsSectionProps {
  appId: string;
}

/**
 * Teams Settings card -- shown only for the 'teams' channel.
 * Manages its own local state for Teams-specific settings.
 */
export function TeamsSettingsSection({ appId }: TeamsSettingsSectionProps) {
  const [teamsSettingsOpen, setTeamsSettingsOpen] = useState(true);
  const [teamsSettingsExpanded, setTeamsSettingsExpanded] = useState(false);
  const [addToTeam, setAddToTeam] = useState(false);
  const [groupMeetingChats, setGroupMeetingChats] = useState(false);
  const [developerName, setDeveloperName] = useState('');
  const [website, setWebsite] = useState('');
  const [privacyStatement, setPrivacyStatement] = useState('');
  const [termsOfUse, setTermsOfUse] = useState('');
  const [mpnId, setMpnId] = useState('');
  const [aadClientId, setAadClientId] = useState('');
  const [resourceUri, setResourceUri] = useState('');

  return (
    <div className="border border-gray-200 rounded-2xl">
      <CopilotButton
        variant="transparent"
        onClick={() => setTeamsSettingsOpen(v => !v)}
        className="w-full flex items-start gap-2 px-6 py-4 text-left"
        aria-expanded={teamsSettingsOpen}
        style={{ height: 'auto', borderRadius: 0, justifyContent: 'flex-start', minHeight: 0, borderTopLeftRadius: '1rem', borderTopRightRadius: '1rem' }}
      >
        <span className="mt-0.5 flex-shrink-0">
          {teamsSettingsOpen ? (
            <ChevronDown16Regular style={{ color: '#6B7280' }} />
          ) : (
            <ChevronRight16Regular style={{ color: '#6B7280' }} />
          )}
        </span>
        <span>
          <span className="text-sm font-semibold text-gray-900">Teams settings</span>
          <span className="block text-xs text-gray-500 mt-0.5">
            Decide where and how your agent should function in Teams.
          </span>
        </span>
      </CopilotButton>

      {teamsSettingsOpen && (
        <div className="px-6 pb-6 space-y-5">

          {/* Teams behavior */}
          <div>
            <p className="text-xs text-gray-500 leading-relaxed">
              <a href="#" className="text-blue-600 hover:underline" onClick={e => e.preventDefault()}>
                Learn more
              </a>
              {' '}about agent behavior and limitations in Teams.
            </p>
            <div className="mt-3 space-y-2">
              <CopilotCheckbox
                label="Users can add this agent to a team"
                checked={addToTeam}
                onChange={setAddToTeam}
              />
              <CopilotCheckbox
                label="Use this agent for group and meeting chats"
                checked={groupMeetingChats}
                onChange={setGroupMeetingChats}
              />
            </div>
          </div>

          {/* Less / More toggle */}
          <CopilotButton
            variant="transparent"
            size="sm"
            onClick={() => setTeamsSettingsExpanded(v => !v)}
            style={{ padding: 0 }}
          >
            <span className="text-blue-600 text-sm flex items-center gap-1">
              {teamsSettingsExpanded ? 'Less' : 'More'}
              {teamsSettingsExpanded
                ? <ChevronUp16Regular style={{ color: '#2563EB' }} />
                : <ChevronDown16Regular style={{ color: '#2563EB' }} />
              }
            </span>
          </CopilotButton>

          {teamsSettingsExpanded && (
            <div className="space-y-5">
              {/* Developer name */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">Developer name</label>
                <CopilotInput
                  appearance="outline"
                  size="sm"
                  value={developerName}
                  onChange={e => setDeveloperName(e.target.value.slice(0, 32))}
                  placeholder="Your developer name"
                  className="w-full"
                />
                <p className="text-xs text-gray-400 mt-1">Up to 32 characters</p>
              </div>

              {/* Website */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">Website</label>
                <CopilotInput
                  appearance="outline"
                  size="sm"
                  value={website}
                  onChange={e => setWebsite(e.target.value)}
                  placeholder="go.microsoft.com/fwlink/?linkid=2138949"
                  className="w-full"
                />
              </div>

              {/* Privacy statement */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">Privacy statement</label>
                <CopilotInput
                  appearance="outline"
                  size="sm"
                  value={privacyStatement}
                  onChange={e => setPrivacyStatement(e.target.value)}
                  placeholder="go.microsoft.com/fwlink/?linkid=2138950"
                  className="w-full"
                />
              </div>

              {/* Terms of use */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">Terms of use</label>
                <CopilotInput
                  appearance="outline"
                  size="sm"
                  value={termsOfUse}
                  onChange={e => setTermsOfUse(e.target.value)}
                  placeholder="go.microsoft.com/fwlink/?linkid=2138865"
                  className="w-full"
                />
              </div>

              {/* Partner ID */}
              <div>
                <p className="text-sm font-semibold text-gray-900">Add a partner ID (optional)</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Track your app's usage by adding a Microsoft Partner Network ID.{' '}
                  <a href="#" className="text-blue-600 hover:underline" onClick={e => e.preventDefault()}>
                    Learn more
                  </a>
                </p>
                <label className="block text-sm font-semibold text-gray-900 mt-3 mb-1">MPN ID</label>
                <CopilotInput
                  appearance="outline"
                  size="sm"
                  value={mpnId}
                  onChange={e => setMpnId(e.target.value)}
                  placeholder="0000000"
                  className="w-full"
                />
              </div>

              {/* Teams channel SSO */}
              <div className="border-t border-gray-200 pt-5">
                <p className="text-sm font-semibold text-gray-900">Teams channel SSO</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Configure single sign-on information for Teams.{' '}
                  <a href="#" className="text-blue-600 hover:underline" onClick={e => e.preventDefault()}>
                    Learn more
                  </a>
                </p>

                <div className="mt-4 space-y-4">
                  {/* AAD client ID */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1">
                      AAD application's client ID
                    </label>
                    <CopilotInput
                      appearance="outline"
                      size="sm"
                      value={aadClientId}
                      onChange={e => setAadClientId(e.target.value)}
                      placeholder="00000000-0000-0000-0000-000000000000"
                      className="w-full"
                    />
                  </div>

                  {/* Resource URI */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1">Resource URI</label>
                    <CopilotInput
                      appearance="outline"
                      size="sm"
                      value={resourceUri}
                      onChange={e => setResourceUri(e.target.value)}
                      placeholder="Enter URI"
                      className="w-full"
                    />
                  </div>

                  {/* App ID */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1">App ID</label>
                    <div className="flex items-center gap-2">
                      <CopilotInput
                        appearance="outline"
                        size="sm"
                        value={appId}
                        readOnly
                        className="flex-1"
                      />
                      <CopilotButton
                        variant="transparent"
                        size="sm"
                        icon={<Copy20Regular />}
                        onClick={() => navigator.clipboard.writeText(appId)}
                      >
                        Copy
                      </CopilotButton>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
