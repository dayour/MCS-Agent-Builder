import React, { useState } from 'react'
import {
  Checkbox,
  Switch,
  Slider,
  RadioGroup,
  Radio,
} from '@fluentui/react-components'
import {
  ChevronLeft24Regular,
  Search20Regular,
  Dismiss12Regular,
  Checkmark16Regular,
  Checkmark20Regular,
} from '@fluentui/react-icons'
import { mockEvaluations, mockDatasetsByType } from '../data/mockData'
import { CopilotButton } from '../../../components/ui/CopilotButton'
import { CopilotInput } from '../../../components/ui/CopilotInput'

interface NewEvaluationWizardProps {
  onBack: () => void
}

function NewEvaluationWizard({ onBack }: NewEvaluationWizardProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [evaluationType, setEvaluationType] = useState('agent')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [dataSourceType, setDataSourceType] = useState('existing')
  const [selectedDataset, setSelectedDataset] = useState<string | null>(null)
  const [numberOfQuestions, setNumberOfQuestions] = useState(25)
  const [useSpecificKnowledge, setUseSpecificKnowledge] = useState(false)
  const [selectedKnowledgeSources, setSelectedKnowledgeSources] = useState<Set<string>>(new Set())

  return (
    <div className="flex-1 overflow-y-auto min-w-0">
      <div className="max-w-[1200px] mx-auto w-full px-6 py-5">
        {/* Page Header */}
        <div className="flex items-start gap-2 mb-6">
          <CopilotButton
            variant="icon-subtle"
            size="xs"
            onClick={onBack}
            aria-label="Back"
          >
            <ChevronLeft24Regular />
          </CopilotButton>
          <h3 className="text-xl font-semibold text-gray-900">Create evaluation</h3>
        </div>

        {/* Main Content */}
        <div className="flex gap-6">
          {/* Left Navigation Pane */}
          <div className="w-[320px] flex-shrink-0">
            {/* Step 1: Evaluation type */}
            <div className="mb-4 pb-4 border-b border-[rgba(0,0,0,0.06)]">
              <div
                className="flex items-start gap-3"
                onClick={() => currentStep > 1 && setCurrentStep(1)}
                style={{ cursor: currentStep > 1 ? 'pointer' : 'default' }}
              >
                <div className="flex-shrink-0">
                  {currentStep === 1 ? (
                    <div className="w-6 h-6 rounded-full bg-[hsl(var(--primary))] text-white text-xs font-semibold flex items-center justify-center">1</div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-[hsl(var(--status-success))] text-white text-xs flex items-center justify-center">
                      <Checkmark16Regular />
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-900 block mb-3">
                    Evaluation type
                  </label>
                  <span className="text-[11px] text-gray-500">
                    {currentStep > 1 ? Array.from(selectedItems).join(', ') : 'Tell us what you\'d like to evaluate'}
                  </span>
                </div>
              </div>

              {currentStep === 1 && (
                <div className="mt-3">
                  <RadioGroup value={evaluationType} onChange={(_, data) => {
                    setEvaluationType(data.value)
                    setSelectedItems(new Set())
                  }} className="flex flex-col gap-2 pl-9">
                    <Radio
                      value="agent"
                      label={
                        <div className="flex items-center gap-2">
                          <img src="/agents.svg" alt="Agent" className="w-5 h-5" />
                          <span>Agent</span>
                        </div>
                      }
                    />
                    <Radio
                      value="prompt"
                      label={
                        <div className="flex items-center gap-2">
                          <img src="/Prompt.svg" alt="Prompt" className="w-4 h-4" />
                          <span>Prompt</span>
                        </div>
                      }
                    />
                    <Radio
                      value="workflow"
                      label={
                        <div className="flex items-center gap-2">
                          <img src="/Flowchart.svg" alt="Workflow" className="w-4 h-4" />
                          <span>Workflow</span>
                        </div>
                      }
                    />
                  </RadioGroup>
                  <div className="pl-10 mt-3">
                    <CopilotButton
                      variant="primary"
                      size="sm"
                      onClick={() => setCurrentStep(2)}
                      disabled={selectedItems.size === 0}
                      style={{ minWidth: 'auto' }}
                    >
                      Continue
                    </CopilotButton>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Data type */}
            <div className={`mb-4 pb-4 border-b border-[rgba(0,0,0,0.06)] ${currentStep < 2 ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  {currentStep === 2 ? (
                    <div className="w-6 h-6 rounded-full bg-[hsl(var(--primary))] text-white text-xs font-semibold flex items-center justify-center">2</div>
                  ) : currentStep > 2 ? (
                    <div className="w-6 h-6 rounded-full bg-[hsl(var(--status-success))] text-white text-xs flex items-center justify-center">
                      <Checkmark20Regular />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-500 text-xs flex items-center justify-center">2</div>
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-[2px]" style={{ color: currentStep < 2 ? 'hsl(var(--text-disabled))' : 'hsl(var(--text-primary))' }}>
                    Data type
                  </label>
                  {currentStep >= 2 && (
                    <span className="text-[11px]" style={{ color: currentStep < 2 ? 'hsl(var(--text-disabled))' : 'hsl(var(--text-tertiary))' }}>
                      How would you like to evaluate
                    </span>
                  )}
                </div>
              </div>
              {currentStep === 2 && (
                <div className="mt-3">
                  <RadioGroup
                    value={dataSourceType}
                    onChange={(_, data) => {
                      setDataSourceType(data.value)
                      setSelectedDataset(null)
                    }}
                    className="flex flex-col gap-2 pl-9"
                  >
                    <Radio value="existing" label="Use existing data set" />
                    <Radio value="generate" label="Generate data" />
                    <Radio value="import" label="Import data" />
                  </RadioGroup>
                  <div className="pl-10 mt-3 flex gap-2">
                    <CopilotButton
                      variant="secondary"
                      size="sm"
                      onClick={() => setCurrentStep(1)}
                      style={{ minWidth: 'auto' }}
                    >
                      Back
                    </CopilotButton>
                    <CopilotButton
                      variant="primary"
                      size="sm"
                      onClick={() => setCurrentStep(3)}
                      disabled={dataSourceType === 'existing' && !selectedDataset}
                      style={{ minWidth: 'auto' }}
                    >
                      Continue
                    </CopilotButton>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Main Content Area */}
          <div className="flex-1 min-w-0">
            {currentStep === 1 && evaluationType === 'agent' && (
              <div>
                <div className="flex items-center justify-between mb-5 px-4">
                  <label className="text-sm font-semibold text-gray-900">Agents</label>
                  <div className="relative w-[280px]">
                    <CopilotInput
                      type="text"
                      placeholder="Search for agent"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      size="sm"
                      contentBefore={<Search20Regular className="text-gray-400" />}
                      contentAfter={searchQuery ? (
                        <CopilotButton
                          variant="icon-subtle"
                          size="xs"
                          onClick={() => setSearchQuery('')}
                          aria-label="Clear search"
                        >
                          <Dismiss12Regular />
                        </CopilotButton>
                      ) : undefined}
                      className="w-full"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {/* Get unique agents from evaluations */}
                  {(() => {
                    const uniqueAgents = mockEvaluations
                      .filter(e => e.evaluatedItem.type === 'Agent')
                      .reduce((acc: any[], curr) => {
                        if (!acc.find(a => a.name === curr.evaluatedItem.name)) {
                          acc.push(curr.evaluatedItem)
                        }
                        return acc
                      }, [])

                    const agentDescriptions: Record<string, string> = {
                      'Home claims support': 'Utilizes advanced machine learning techniques to streamline the automation of claim routing, validation, and fraud detection specifically for auto insurance claims.',
                      'Customer service agent': 'Provides comprehensive customer support across multiple channels, handling inquiries, complaints, and service requests with empathy and efficiency.',
                      'Slackbot': 'Internal communication assistant that helps teams collaborate effectively, manages notifications, and automates common workplace tasks.',
                      'Technical support': 'Specialized in troubleshooting technical issues, providing detailed solutions, and guiding users through complex technical processes.',
                      'Sales assistant': 'Helps customers find the right products, answers questions about features and pricing, and assists with the purchase process.',
                      'Help desk agent': 'First point of contact for IT support, handles ticket management, and resolves common technical issues for employees.',
                      'Product support': 'Provides expert guidance on product features, usage, and best practices to help customers get the most value from their purchases.'
                    }

                    const filteredAgents = uniqueAgents.filter(agent =>
                      agent.name.toLowerCase().includes(searchQuery.toLowerCase())
                    )

                    return filteredAgents.map((agent, index) => {
                      const isSelected = selectedItems.has(agent.name)
                      return (
                        <div
                          key={index}
                          className="bg-white rounded-xl border border-[hsl(var(--stroke-default))] p-4 cursor-pointer relative hover:border-gray-400 transition-colors"
                          onClick={() => {
                            const newSelected = new Set(selectedItems)
                            if (isSelected) {
                              newSelected.delete(agent.name)
                            } else {
                              newSelected.add(agent.name)
                            }
                            setSelectedItems(newSelected)
                          }}
                        >
                          <Checkbox
                            checked={isSelected}
                            className="absolute top-2 right-2"
                            style={{ opacity: isSelected ? 1 : 0 }}
                          />
                          <div className="flex gap-3 items-start">
                            <img
                              src={agent.icon}
                              alt={agent.name}
                              className="w-8 h-8 rounded-xl flex-shrink-0"
                            />
                            <div className="flex-1">
                              <span className="font-semibold block mb-1">
                                {agent.name}
                              </span>
                              <span className="text-[11px] text-gray-500">
                                {agentDescriptions[agent.name] || 'AI-powered agent designed to assist with various tasks and workflows.'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              </div>
            )}

            {currentStep === 1 && evaluationType === 'prompt' && (
              <div>
                <div className="flex items-center justify-between mb-5 px-4">
                  <label className="text-sm font-semibold text-gray-900">Prompts</label>
                  <div className="relative w-[280px]">
                    <CopilotInput
                      type="text"
                      placeholder="Search for prompt"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      size="sm"
                      contentBefore={<Search20Regular className="text-gray-400" />}
                      contentAfter={searchQuery ? (
                        <CopilotButton
                          variant="icon-subtle"
                          size="xs"
                          onClick={() => setSearchQuery('')}
                          aria-label="Clear search"
                        >
                          <Dismiss12Regular />
                        </CopilotButton>
                      ) : undefined}
                      className="w-full"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {/* Get unique prompts from evaluations */}
                  {(() => {
                    const uniquePrompts = mockEvaluations
                      .filter(e => e.evaluatedItem.type === 'Prompt')
                      .reduce((acc: any[], curr) => {
                        if (!acc.find(p => p.name === curr.evaluatedItem.name)) {
                          acc.push(curr.evaluatedItem)
                        }
                        return acc
                      }, [])

                    const promptMetadata: Record<string, { lastModifiedBy: string; lastModifiedTime: string }> = {
                      'Returns inquiries': { lastModifiedBy: 'Mona Kane', lastModifiedTime: '12 days ago' },
                      'Product description': { lastModifiedBy: 'Alex Rivera', lastModifiedTime: '8 days ago' },
                      'Email response': { lastModifiedBy: 'Jordan Lee', lastModifiedTime: '3 days ago' }
                    }

                    const filteredPrompts = uniquePrompts.filter(prompt =>
                      prompt.name.toLowerCase().includes(searchQuery.toLowerCase())
                    )

                    return filteredPrompts.map((prompt, index) => {
                      const isSelected = selectedItems.has(prompt.name)
                      return (
                        <div
                          key={index}
                          className="bg-white rounded-xl border border-[hsl(var(--stroke-default))] p-4 cursor-pointer relative hover:border-gray-400 transition-colors"
                          onClick={() => {
                            const newSelected = new Set(selectedItems)
                            if (isSelected) {
                              newSelected.delete(prompt.name)
                            } else {
                              newSelected.add(prompt.name)
                            }
                            setSelectedItems(newSelected)
                          }}
                        >
                          <Checkbox
                            checked={isSelected}
                            className="absolute top-2 right-2"
                            style={{ opacity: isSelected ? 1 : 0 }}
                          />
                          <div className="flex gap-3 items-start">
                            <img
                              src={prompt.icon}
                              alt={prompt.name}
                              className="w-8 h-8 rounded-xl flex-shrink-0"
                            />
                            <div className="flex-1">
                              <span className="font-semibold block mb-1">
                                {prompt.name}
                              </span>
                              <span className="text-[11px] text-gray-500">
                                Last modified: {promptMetadata[prompt.name]?.lastModifiedBy}, {promptMetadata[prompt.name]?.lastModifiedTime}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              </div>
            )}

            {currentStep === 1 && evaluationType === 'workflow' && (
              <div>
                <div className="flex items-center justify-between mb-5 px-4">
                  <label className="text-sm font-semibold text-gray-900">Workflows</label>
                  <div className="relative w-[280px]">
                    <CopilotInput
                      type="text"
                      placeholder="Search for workflow"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      size="sm"
                      contentBefore={<Search20Regular className="text-gray-400" />}
                      contentAfter={searchQuery ? (
                        <CopilotButton
                          variant="icon-subtle"
                          size="xs"
                          onClick={() => setSearchQuery('')}
                          aria-label="Clear search"
                        >
                          <Dismiss12Regular />
                        </CopilotButton>
                      ) : undefined}
                      className="w-full"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {/* Get unique workflows from evaluations */}
                  {(() => {
                    const uniqueWorkflows = mockEvaluations
                      .filter(e => e.evaluatedItem.type === 'Workflow')
                      .reduce((acc: any[], curr) => {
                        if (!acc.find(w => w.name === curr.evaluatedItem.name)) {
                          acc.push(curr.evaluatedItem)
                        }
                        return acc
                      }, [])

                    const workflowMetadata: Record<string, { lastModifiedBy: string; lastModifiedTime: string }> = {
                      'Equipment order': { lastModifiedBy: 'Sam Chen', lastModifiedTime: '5 days ago' },
                      'Approval process': { lastModifiedBy: 'Taylor Swift', lastModifiedTime: '15 days ago' },
                      'Claim routing': { lastModifiedBy: 'Casey Morgan', lastModifiedTime: '7 days ago' },
                      'Ticket assignment': { lastModifiedBy: 'Jamie Parker', lastModifiedTime: '10 days ago' }
                    }

                    const filteredWorkflows = uniqueWorkflows.filter(workflow =>
                      workflow.name.toLowerCase().includes(searchQuery.toLowerCase())
                    )

                    return filteredWorkflows.map((workflow, index) => {
                      const isSelected = selectedItems.has(workflow.name)
                      return (
                        <div
                          key={index}
                          className="bg-white rounded-xl border border-[hsl(var(--stroke-default))] p-4 cursor-pointer relative hover:border-gray-400 transition-colors"
                          onClick={() => {
                            const newSelected = new Set(selectedItems)
                            if (isSelected) {
                              newSelected.delete(workflow.name)
                            } else {
                              newSelected.add(workflow.name)
                            }
                            setSelectedItems(newSelected)
                          }}
                        >
                          <Checkbox
                            checked={isSelected}
                            className="absolute top-2 right-2"
                            style={{ opacity: isSelected ? 1 : 0 }}
                          />
                          <div className="flex gap-3 items-start">
                            <img
                              src={workflow.icon}
                              alt={workflow.name}
                              className="w-8 h-8 rounded-xl flex-shrink-0"
                            />
                            <div className="flex-1">
                              <span className="font-semibold block mb-1">
                                {workflow.name}
                              </span>
                              <span className="text-[11px] text-gray-500">
                                Last modified: {workflowMetadata[workflow.name]?.lastModifiedBy}, {workflowMetadata[workflow.name]?.lastModifiedTime}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              </div>
            )}

            {/* Step 2: Data source selection */}
            {currentStep === 2 && dataSourceType === 'existing' && (
              <div>
                <div className="px-4 mb-5">
                  <label className="text-sm font-semibold text-gray-900">Available datasets</label>
                </div>
                <div className="flex flex-col gap-2">
                  {mockDatasetsByType[evaluationType]?.map((dataset, index) => {
                    const isSelected = selectedDataset === dataset.id
                    return (
                      <div
                        key={index}
                        className="bg-white rounded-xl border border-[hsl(var(--stroke-default))] p-4 cursor-pointer relative hover:border-gray-400 transition-colors"
                        onClick={() => setSelectedDataset(dataset.id)}
                      >
                        <Checkbox
                          checked={isSelected}
                          className="absolute top-2 right-2"
                          style={{ opacity: isSelected ? 1 : 0 }}
                        />
                        <div className="flex-1">
                          <span className="font-semibold block mb-1">
                            {dataset.name}
                          </span>
                          <div className="flex gap-3 mt-2">
                            <span className="text-[11px] text-gray-500">
                              {dataset.amount} cases
                            </span>
                            <span className="text-[11px] text-gray-500">
                              •
                            </span>
                            <span className="text-[11px] text-gray-500">
                              {dataset.dataType}
                            </span>
                          </div>
                          <span className="text-[11px] text-gray-500 mt-1 block">
                            Last modified: {dataset.lastModified.by}, {dataset.lastModified.time}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {currentStep === 2 && dataSourceType === 'generate' && (
              <div className="px-4">
                <label className="text-sm font-semibold text-gray-900 block mb-5">
                  Generation settings
                </label>

                {/* Number of questions slider - moved to top */}
                <div className="mb-6">
                  <label className="text-xs font-semibold text-gray-900 block mb-3">
                    Number of questions to generate: {numberOfQuestions}
                  </label>
                  <div className="flex items-center gap-1">
                    <Slider
                      value={numberOfQuestions}
                      onChange={(e, data) => setNumberOfQuestions(data.value)}
                      min={1}
                      max={100}
                      style={{ width: '50%', minWidth: '320px' }}
                    />
                    <span className="text-[11px] text-gray-500">
                      100
                    </span>
                  </div>
                </div>

                {/* Toggle for specific knowledge */}
                <div className="mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-sm text-gray-900">Uses specific knowledge</span>
                    <Switch
                      checked={useSpecificKnowledge}
                      onChange={(e, data) => setUseSpecificKnowledge(data.checked)}
                    />
                  </label>
                </div>

                {/* Knowledge sources data grid - shown when toggle is on */}
                {useSpecificKnowledge && (() => {
                  const knowledgeSources = [
                    { id: '1', name: 'Product documentation.docx', type: 'Word', icon: '/Word.svg', size: '2.4 MB' },
                    { id: '2', name: 'Policy handbook.pdf', type: 'PDF', icon: '/Document PDF.svg', size: '1.8 MB' },
                    { id: '3', name: 'FAQ database', type: 'SharePoint', icon: '/SharePoint-new.svg', size: '156 KB' },
                    { id: '4', name: 'Training materials.pptx', type: 'PowerPoint', icon: '/PowerPoint.svg', size: '5.2 MB' },
                    { id: '5', name: 'Onboarding guide.txt', type: 'Text', icon: '/Document Text.svg', size: '24 KB' },
                    { id: '6', name: 'Sales playbook.docx', type: 'Word', icon: '/Word.svg', size: '890 KB' },
                    { id: '7', name: 'Support articles', type: 'SharePoint', icon: '/SharePoint-new.svg', size: '3.1 MB' },
                  ]

                  const allSelected = knowledgeSources.every(source => selectedKnowledgeSources.has(source.id))
                  const someSelected = knowledgeSources.some(source => selectedKnowledgeSources.has(source.id)) && !allSelected

                  return (
                    <div className="mb-6">
                      <div className="border border-[rgba(0,0,0,0.09)] rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                          {/* Header */}
                          <div className="grid grid-cols-[48px_2fr_1fr_1fr] bg-[hsl(var(--surface-secondary))] border-b border-[rgba(0,0,0,0.09)]">
                            <div className="pl-4 flex items-center py-2">
                              <Checkbox
                                checked={someSelected ? 'mixed' : allSelected}
                                onChange={(e, data) => {
                                  if (data.checked) {
                                    setSelectedKnowledgeSources(new Set(knowledgeSources.map(s => s.id)))
                                  } else {
                                    setSelectedKnowledgeSources(new Set())
                                  }
                                }}
                              />
                            </div>
                            <div className="py-2 px-3 text-xs font-semibold text-gray-600">Name</div>
                            <div className="py-2 px-3 text-xs font-semibold text-gray-600">Type</div>
                            <div className="py-2 px-3 pr-6 text-xs font-semibold text-gray-600">Size</div>
                          </div>

                          {/* Rows */}
                          {knowledgeSources.map((source) => {
                            const isSelected = selectedKnowledgeSources.has(source.id)
                            return (
                              <div
                                key={source.id}
                                className="grid grid-cols-[48px_2fr_1fr_1fr] border-b border-[rgba(0,0,0,0.06)] cursor-pointer hover:bg-gray-50 transition-colors"
                                onClick={() => {
                                  const newSelected = new Set(selectedKnowledgeSources)
                                  if (isSelected) {
                                    newSelected.delete(source.id)
                                  } else {
                                    newSelected.add(source.id)
                                  }
                                  setSelectedKnowledgeSources(newSelected)
                                }}
                                style={{
                                  backgroundColor: isSelected ? 'hsl(var(--surface-secondary))' : 'hsl(var(--background))',
                                }}
                              >
                                <div className="pl-4 flex items-center py-2">
                                  <Checkbox checked={isSelected} />
                                </div>
                                <div className="py-2 px-3 flex items-center gap-2">
                                  <img src={source.icon} alt={source.type} className="w-5 h-5" />
                                  <span className="text-xs text-gray-900 truncate">{source.name}</span>
                                </div>
                                <div className="py-2 px-3 text-xs text-gray-600 flex items-center">
                                  {source.type}
                                </div>
                                <div className="py-2 px-3 pr-6 text-xs text-gray-600 flex items-center">
                                  {source.size}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            {currentStep === 2 && dataSourceType === 'import' && (
              <div className="px-4">
                <label className="text-sm font-semibold text-gray-900 block mb-5">
                  Import data
                </label>

                {/* Dropzone */}
                <div
                  className="bg-white rounded-xl border-2 border-dashed border-[rgba(0,0,0,0.09)] bg-[hsl(var(--surface-secondary))] cursor-pointer mb-6 text-center py-10 px-6"
                >
                  <div className="mb-4">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M24 16V32M16 24H32" stroke="#707070" strokeWidth="2" strokeLinecap="round" />
                      <path d="M38 24C38 31.732 31.732 38 24 38C16.268 38 10 31.732 10 24C10 16.268 16.268 10 24 10C31.732 10 38 16.268 38 24Z" stroke="#707070" strokeWidth="2" />
                    </svg>
                  </div>
                  <span className="font-semibold block mb-2">
                    Drag and drop your CSV file here
                  </span>
                  <span className="text-[11px] text-gray-500 mb-4 block">
                    or
                  </span>
                  <CopilotButton variant="primary" size="sm">
                    Browse files
                  </CopilotButton>
                  <span className="text-[11px] text-gray-500 mt-4 block">
                    Maximum file size: 10MB
                  </span>
                </div>

                {/* Template link and instructions */}
                <div className="mb-6">
                  <a href="#" className="text-[#0F6CBD] text-sm hover:underline">Download CSV template</a>
                  <span className="text-[11px] text-gray-500 mt-2 block">
                    Use our template to ensure your data is formatted correctly
                  </span>
                </div>

                {/* Instructions */}
                <div>
                  <label className="text-xs font-semibold text-gray-900 block mb-3">
                    CSV format requirements
                  </label>
                  <ul className="m-0 pl-5">
                    <li className="text-[11px] text-gray-500 mb-2">
                      First column: Question or input prompt
                    </li>
                    <li className="text-[11px] text-gray-500 mb-2">
                      Second column: Expected response or output
                    </li>
                    <li className="text-[11px] text-gray-500 mb-2">
                      Additional columns: Optional metadata (keywords, categories, etc.)
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default NewEvaluationWizard
