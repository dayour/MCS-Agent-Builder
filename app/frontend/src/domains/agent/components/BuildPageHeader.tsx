import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAgent } from '../../../context/AgentContext';
import { useDW } from '../../dw/context/DWContext';
import { AgentConfig } from '../../../types';
import { useHAReviewDiff } from '../../../hooks/useHAReviewDiff';
import { EditableIcon } from '../../../components/ui/EditableIcon';
import { IconPickerDialog } from '../../../components/ui/IconPickerDialog';
import { AgentIcon } from '../../../components/ui/AgentIcon';
import { CopilotButton } from '../../../components/ui/CopilotButton';
import { CopilotDropdown } from '../../../components/ui/CopilotDropdown';
import { CopilotInput } from '../../../components/ui/CopilotInput';
import { CopilotTooltip } from '../../../components/ui/CopilotTooltip';
import { ClaudeOpusIcon, ClaudeSonnetIcon, ClaudeHaikuIcon } from '../../../components/ui/ClaudeModelIcons';
import { GPTIcon } from '../../../components/ui/OpenAIModelIcons';
import { EvalGateBadge } from '../../../components/ui/EvalGateBadge';
import { useModelCatalog, isGptModelId } from '../../../hooks/useModelCatalog';
import {
  detectAgentDomain,
  getUniqueGradientKey,
} from '../../../utils/agentIcons';

interface BuildPageHeaderProps {
  // Agent config
  agentConfig: AgentConfig;
  updateAgentConfig: (updates: Partial<AgentConfig>) => void;
  isNarrowPreview: boolean;
  // Name editing
  editableName: string;
  setEditableName: (v: string) => void;
  isEditingName: boolean;
  setIsEditingName: (v: boolean) => void;
  isEditingNameLarge: boolean;
  nameEditRef: React.RefObject<HTMLInputElement | null>;
  nameEditLargeRef: React.RefObject<HTMLDivElement | null>;
  handleNameLargeClick: () => void;
  handleNameLargeBlur: () => void;
  handleNameLargeKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  handleNameInput: (e: React.FormEvent<HTMLDivElement>) => void;
  // Description editing
  editableDescription: string;
  setEditableDescription: (v: string) => void;
  isEditingDescription: boolean;
  isEditingDescriptionLarge: boolean;
  isTruncated: boolean;
  showDescriptionTooltip: boolean;
  setShowDescriptionTooltip: (v: boolean) => void;
  descriptionEditRef: React.RefObject<HTMLDivElement | null>;
  descriptionEditLargeRef: React.RefObject<HTMLDivElement | null>;
  descriptionDisplayRef: React.RefObject<HTMLParagraphElement | null>;
  handleDescriptionClick: (e: React.MouseEvent) => void;
  handleDescriptionBlur: () => void;
  handleDescriptionKeyDown: (e: React.KeyboardEvent) => void;
  handleDescriptionLargeClick: () => void;
  handleDescriptionInput: (e: React.FormEvent<HTMLDivElement>) => void;
  handleDescriptionLargeBlur: () => void;
  handleDescriptionLargeKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  // Model
  isModelDropdownOpen: boolean;
  setIsModelDropdownOpen: (v: boolean) => void;
  handleModelChange: (model: AgentConfig['model']) => void;
  handleModelTileClick: () => void;
  // Icon
  isIconPickerOpen: boolean;
  setIsIconPickerOpen: (v: boolean) => void;
  handleIconSelect: (iconKey: string, gradientKey: string, imageData?: string) => void;
}

export function BuildPageHeader({
  agentConfig,
  updateAgentConfig,
  isNarrowPreview,
  editableName,
  setEditableName,
  isEditingName,
  setIsEditingName,
  isEditingNameLarge,
  nameEditRef,
  nameEditLargeRef,
  handleNameLargeClick,
  handleNameLargeBlur,
  handleNameLargeKeyDown,
  handleNameInput,
  editableDescription,
  setEditableDescription,
  isEditingDescription,
  isEditingDescriptionLarge,
  isTruncated,
  showDescriptionTooltip,
  setShowDescriptionTooltip,
  descriptionEditRef,
  descriptionEditLargeRef,
  descriptionDisplayRef,
  handleDescriptionClick,
  handleDescriptionBlur,
  handleDescriptionKeyDown,
  handleDescriptionLargeClick,
  handleDescriptionInput,
  handleDescriptionLargeBlur,
  handleDescriptionLargeKeyDown,
  isModelDropdownOpen,
  setIsModelDropdownOpen,
  handleModelChange,
  handleModelTileClick,
  isIconPickerOpen,
  setIsIconPickerOpen,
  handleIconSelect,
}: BuildPageHeaderProps) {
  const { isAgentTypeBadge, updateWithHistory, isAgentGlobalUndo, markManualDirty } = useAgent();
  const { isDexter, provisionDexterWorker } = useDW();
  const { changedFields } = useHAReviewDiff();
  const modelCatalog = useModelCatalog();

  // Dropdown selection: any saved gpt-* id collapses to the live family option
  // so the dropdown stays selected after a model bump (saved 'gpt-5.4' still
  // matches when the catalog now offers 'gpt-5.5'). Concrete value sent to
  // backend via onChange is whatever the catalog reports right now.
  const dropdownValue = isGptModelId(agentConfig.model) ? modelCatalog.gpt.id : agentConfig.model;
  const gptOption = {
    label: modelCatalog.gpt.label,
    value: modelCatalog.gpt.id,
    icon: <GPTIcon size={24} label={modelCatalog.gpt.label} />,
    description: 'Advanced reasoning and generation',
    dividerAbove: true as const,
  };
  const reviewHighlight = (field: keyof AgentConfig) =>
    `transition-colors duration-200 ${changedFields.has(field) ? 'bg-brand-background' : 'bg-transparent'}`;

  const AgentTypeBadge = agentConfig.agentType === 'CA' || agentConfig.agentType === 'DA' ? (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${
      agentConfig.agentType === 'DA' ? 'border-purple-300 text-purple-300'
      : 'border-blue-300 text-blue-300'
    }`}>
      {agentConfig.agentType}
    </span>
  ) : null;

  // Eval-gate publish state. Only render when we have backend-driven state
  // (projectId + buildStatusRaw); otherwise the boolean `published` flag
  // drives the Update/Publish dropdown elsewhere in the UI.
  const EvalGatePublishBadge = agentConfig.projectId && agentConfig.buildStatusRaw ? (
    <EvalGateBadge status={agentConfig.buildStatusRaw} evalGate={agentConfig.evalGate} />
  ) : null;

  const [showDexterError, setShowDexterError] = useState(false);
  const dexterErrorRef = useRef<HTMLDivElement>(null);

  // Dismiss error popover on click outside
  useEffect(() => {
    if (!showDexterError) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dexterErrorRef.current && !dexterErrorRef.current.contains(e.target as Node)) {
        setShowDexterError(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDexterError]);

  const toggleDexterError = useCallback(() => setShowDexterError(v => !v), []);
  const handleErrorKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleDexterError();
    }
  }, [toggleDexterError]);

  const DexterLifecycleBadge = isDexter && agentConfig.agentType === 'DW' && agentConfig.lifecycleStatus ? (
    <div className="relative" ref={dexterErrorRef}>
      <span
        className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${
          agentConfig.lifecycleStatus === 'provisioning' ? 'border-blue-300 text-blue-400 bg-blue-50'
          : agentConfig.lifecycleStatus === 'ready' ? 'border-green-300 text-green-600 bg-green-50'
          : 'border-red-300 text-red-500 bg-red-50 cursor-pointer hover:bg-red-100'
        }`}
        {...(agentConfig.lifecycleStatus === 'failed' ? {
          role: 'button',
          tabIndex: 0,
          onClick: toggleDexterError,
          onKeyDown: handleErrorKeyDown,
        } : {})}
      >
        {agentConfig.lifecycleStatus === 'provisioning' ? 'Provisioning...'
          : agentConfig.lifecycleStatus === 'ready' ? 'Dexter Ready'
          : 'Error'}
      </span>
      {showDexterError && agentConfig.lifecycleStatus === 'failed' && agentConfig.lifecycleError && (
        <div className="absolute top-full mt-1 right-0 z-50 max-w-sm bg-white border border-red-200 rounded-lg shadow-lg p-3">
          <p className="text-xs text-red-600 break-words">{agentConfig.lifecycleError}</p>
        </div>
      )}
    </div>
  ) : null;

  return (
    <>
      {isIconPickerOpen && (
        <IconPickerDialog
          isOpen={isIconPickerOpen}
          onClose={() => setIsIconPickerOpen(false)}
          currentIconKey={agentConfig.systemColorIcon || agentConfig.iconKey || detectAgentDomain(agentConfig)}
          currentGradientKey={agentConfig.gradientKey || getUniqueGradientKey(agentConfig.id)}
          onSelect={handleIconSelect}
        />
      )}

      {isNarrowPreview ? (
        /* Narrow preview: description in card style, icon/title moved to header */
        <>
          {/* Combined Name / Model / Description tile */}
          <div
            className="flex-shrink-0 mb-6 border border-gray-300 bg-white rounded-2xl transition-colors relative z-50"
          >
            {/* Name row */}
            <div
              className={`py-3 cursor-text rounded-t-2xl transition-[border-color,box-shadow] ${
                isEditingName ? 'ring-2 ring-brand-purple/10' : reviewHighlight('name')
              }`}
            >
              <div className="flex items-center justify-between pl-4 pr-3 min-h-[36px]">
                <h2 className="text-sm font-bold text-gray-900">Name</h2>
                <div className="flex items-center gap-1.5">
                  <CopilotButton
                    variant="transparent"
                    size="sm"
                    aria-label="Edit agent icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsIconPickerOpen(true);
                    }}
                    className="hover:opacity-70 transition-opacity flex-shrink-0 !p-0"
                  >
                    {(() => {
                      return (
                        <AgentIcon agent={agentConfig} size={20} withSquircle />
                      );
                    })()}
                  </CopilotButton>
                  <div className="relative">
                    {/* Hidden sizer span */}
                    <span className="text-sm font-semibold invisible whitespace-pre">
                      {editableName || 'Untitled Agent'}
                    </span>
                    <CopilotInput
                      ref={nameEditRef}
                      value={editableName}
                      onChange={(e) => setEditableName(e.target.value)}
                      onFocus={() => setIsEditingName(true)}
                      onBlur={() => {
                        setIsEditingName(false);
                        if (editableName.trim() && editableName !== agentConfig.name) {
                          if (isAgentGlobalUndo) { updateWithHistory({ name: editableName.trim() }); } else { updateAgentConfig({ name: editableName.trim() }); markManualDirty(); }
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          nameEditRef.current?.blur();
                        }
                      }}
                      appearance="filled-lighter"
                      size="sm"
                      className="absolute inset-0 w-full !text-sm !font-semibold !text-gray-900 !bg-transparent hover:!bg-transparent focus-within:!bg-transparent"
                      placeholder="Untitled Agent"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Separator */}
            <div className="border-t border-gray-200" />

            {/* Model row */}
            <div
              className="py-3 cursor-pointer hover:bg-gray-50/50 transition-colors"
              onClick={handleModelTileClick}
            >
              <div className="flex items-center justify-between pl-4">
                <h2 className="text-sm font-bold text-gray-900">Model</h2>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {isAgentTypeBadge && AgentTypeBadge}
                  {DexterLifecycleBadge}
                  {EvalGatePublishBadge}
                  <CopilotDropdown
                    value={dropdownValue}
                    onChange={(value) => handleModelChange(value as any)}
                    isOpen={isModelDropdownOpen}
                    onOpenChange={setIsModelDropdownOpen}
                    triggerClassName={changedFields.has('model') ? '!bg-[hsl(var(--brand-background))] hover:!bg-[hsl(var(--brand-background-hover))] active:!bg-[hsl(var(--brand-background-pressed))] !border-primary' : undefined}
                    options={[
                      {
                        label: 'Claude Opus 4.7 (Experimental)',
                        value: 'opus-4.7',
                        icon: <ClaudeOpusIcon size={24} />,
                        description: 'Next-gen deep reasoning — requires admin enablement'
                      },
                      {
                        label: 'Claude Opus 4.6',
                        value: 'opus-4.6',
                        icon: <ClaudeOpusIcon size={24} />,
                        description: 'Most capable model for complex tasks'
                      },
                      {
                        label: 'Claude Sonnet 4.6',
                        value: 'sonnet-4.6',
                        icon: <ClaudeSonnetIcon size={24} />,
                        description: 'Balanced performance and speed'
                      },
                      gptOption,
                    ]}
                    size="md"
                    showSelectedIcon={true}
                    variant="ghost-dropdown"
                    hideChevron={true}
                  />
                </div>
              </div>
            </div>

            {/* Separator */}
            <div className="border-t border-gray-200" />

            {/* Description row */}
            <div
              className={`py-3 px-4 cursor-text rounded-b-2xl transition-[border-color,box-shadow] ${
                isEditingDescription ? 'ring-2 ring-brand-purple/10' : reviewHighlight('description')
              }`}
              onClick={handleDescriptionClick}
            >
              <h2 className="text-sm font-bold text-gray-900 mb-1">Description</h2>
              <div
                ref={descriptionEditRef}
                contentEditable={isEditingDescription}
                suppressContentEditableWarning
                onBlur={handleDescriptionBlur}
                onKeyDown={handleDescriptionKeyDown}
                className="text-sm text-gray-900 outline-none"
              >
                {editableDescription || 'Click to add description'}
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Full mode: Icon, Name, Description, Model selector */
        <div className="flex-shrink-0 flex items-center gap-4 mb-8 px-5" style={{ overflow: 'visible' }}>
          {(() => {
            return (
              <div className="mt-[14px]">
                <EditableIcon onEdit={() => setIsIconPickerOpen(true)} size={88} cornerRadius={28}>
                  <AgentIcon agent={agentConfig} size={88} withSquircle />
                </EditableIcon>
              </div>
            );
          })()}

          <div className="flex-1" style={{ overflow: 'visible', minWidth: 0 }}>
            <div className="flex items-center gap-4" style={{ overflow: 'visible' }}>
              <div className={`relative flex-1 group rounded-lg overflow-hidden ${reviewHighlight('name')}`}>
                <div
                  ref={nameEditLargeRef}
                  role="heading"
                  aria-level={1}
                  aria-label="Agent name"
                  contentEditable={isEditingNameLarge}
                  suppressContentEditableWarning
                  onClick={handleNameLargeClick}
                  onBlur={handleNameLargeBlur}
                  onKeyDown={handleNameLargeKeyDown}
                  onInput={handleNameInput}
                  className="font-bold text-gray-900 px-2 py-1 rounded-lg text-3xl w-full cursor-text hover:bg-gray-50 transition-colors outline-none"
                  style={{ minHeight: '48px', lineHeight: '1.2' }}
                >
                  {!isEditingNameLarge && (agentConfig.name || 'New agent')}
                </div>
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[hsl(var(--brand))] scale-x-0 group-focus-within:scale-x-100 transition-transform duration-200 origin-center rounded-full pointer-events-none" />
                {agentConfig.agentType === 'DW' && (
                  <div className="flex items-center gap-1.5 px-2 -mt-0.5">
                    {agentConfig.model?.includes('opus') ? <ClaudeOpusIcon size={16} /> : agentConfig.model?.includes('haiku') ? <ClaudeHaikuIcon size={16} /> : <ClaudeSonnetIcon size={16} />}
                    <span className="text-sm text-gray-500">{
                      agentConfig.model?.includes('opus') ? 'Claude Opus 4.5' :
                      agentConfig.model?.includes('haiku') ? 'Claude Haiku 4.5' :
                      agentConfig.model?.includes('gpt') ? agentConfig.model :
                      'Claude Sonnet 4.5'
                    }</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0" style={{ overflow: 'visible' }}>
                {isAgentTypeBadge && AgentTypeBadge}
                  {DexterLifecycleBadge}
                  {EvalGatePublishBadge}
                {agentConfig.agentType === 'DW' ? (
                  <CopilotTooltip
                    content="Enable the Dexter feature flag in Feature Toggles to provision workers"
                    placement="bottom"
                    disabled={isDexter}
                  >
                    <CopilotButton
                      variant="primary"
                      size="md"
                      onClick={() => provisionDexterWorker(agentConfig.id, {
                        name: agentConfig.name,
                        description: agentConfig.description,
                        instructions: agentConfig.instructions,
                      })}
                      disabled={!isDexter || agentConfig.lifecycleStatus === 'provisioning' || agentConfig.lifecycleStatus === 'ready'}
                    >
                      {agentConfig.lifecycleStatus === 'provisioning' ? 'Provisioning...' :
                       agentConfig.lifecycleStatus === 'ready' ? 'Added to team' :
                       'Add to my team'}
                    </CopilotButton>
                  </CopilotTooltip>
                ) : (
                  <CopilotDropdown
                    value={dropdownValue}
                    onChange={(value) => handleModelChange(value as any)}
                    triggerClassName={changedFields.has('model') ? '!bg-[hsl(var(--brand-background))] hover:!bg-[hsl(var(--brand-background-hover))] active:!bg-[hsl(var(--brand-background-pressed))] !border-primary' : undefined}
                    options={[
                      { label: 'Claude Opus 4.7 (Experimental)', value: 'opus-4.7', icon: <ClaudeOpusIcon size={24} />, description: 'Next-gen deep reasoning — requires admin enablement' },
                      { label: 'Claude Opus 4.6', value: 'opus-4.6', icon: <ClaudeOpusIcon size={24} />, description: 'Most capable model for complex tasks' },
                      { label: 'Claude Sonnet 4.6', value: 'sonnet-4.6', icon: <ClaudeSonnetIcon size={24} />, description: 'Balanced performance and speed' },
                      gptOption,
                    ]}
                    size="sm"
                    showSelectedIcon={true}
                  />
                )}
              </div>
            </div>
            <div className={`relative w-full group rounded-lg overflow-hidden ${reviewHighlight('description')}`}>
              <div
                ref={descriptionEditLargeRef}
                role="textbox"
                aria-label="Agent description"
                aria-multiline="true"
                contentEditable={isEditingDescriptionLarge}
                suppressContentEditableWarning
                onClick={handleDescriptionLargeClick}
                onBlur={handleDescriptionLargeBlur}
                onKeyDown={handleDescriptionLargeKeyDown}
                onInput={handleDescriptionInput}
                onMouseEnter={() => setShowDescriptionTooltip(true)}
                onMouseLeave={() => setShowDescriptionTooltip(false)}
                className="text-sm text-gray-600 px-2 py-1 rounded-lg cursor-text hover:bg-gray-50 transition-colors outline-none w-full overflow-hidden"
                style={{
                  lineHeight: '1.5',
                  minHeight: '28px',
                  display: isEditingDescriptionLarge ? 'block' : '-webkit-box',
                  WebkitLineClamp: isEditingDescriptionLarge ? undefined : 2,
                  WebkitBoxOrient: isEditingDescriptionLarge ? undefined : 'vertical',
                }}
              >
                {!isEditingDescriptionLarge && (editableDescription || 'Description of what this does.')}
              </div>
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[hsl(var(--brand))] scale-x-0 group-focus-within:scale-x-100 transition-transform duration-200 origin-center rounded-full pointer-events-none" />
              {isTruncated && showDescriptionTooltip && !isEditingDescriptionLarge && (
                <div className="absolute left-0 top-full mt-2 z-50 max-w-md px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg whitespace-normal">
                  {agentConfig.description}
                  <div className="absolute -top-1 left-4 w-2 h-2 bg-gray-900 transform rotate-45"></div>                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
