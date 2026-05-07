import React, { useState, useEffect } from 'react'
import {
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  MenuGroup,
  MenuGroupHeader,
  MenuDivider,
  Tooltip,
} from '@fluentui/react-components'
import { Dialog, DialogHeader, DialogContent, DialogFooter, DialogTitle } from '../../../components/ui/Dialog'
import { CopilotButton } from '../../../components/ui/CopilotButton'
import {
  Delete20Regular,
  Copy20Regular,
  MoreHorizontal20Regular,
  Add20Regular,
  ArrowExport20Regular,
  Checkmark20Regular,
  Sparkle20Regular,
  ArrowHookUpLeft20Regular,
  ScanTable20Regular,
  Dismiss12Regular,
} from '@fluentui/react-icons'
import { MorseCode } from '@fluentui-copilot/react-morse-code'
import { COLORS, CLS } from '../constants'
import { DetailPageHeader } from './SharedComponents'
import { ArrowAutofitHeightInIcon, ArrowAutofitIcon } from './LeftNav'
import AgentSingleResponseGrid from './AgentSingleResponseGrid'
import PromptDatasetGrid from './PromptDatasetGrid'
import { mockEvaluations } from '../data/mockData'
import type { Dataset, Agent, DatasetCase, PromptDatasetCase } from '../types'

function detectDatasetType(dataset: Dataset) {
  if (!dataset || !dataset.cases || dataset.cases.length === 0) {
    return 'unknown'
  }

  const firstCase = dataset.cases[0]

  if ('inputs' in firstCase) {
    return 'prompt'
  }

  if ('question' in firstCase) {
    if (dataset.dataType === 'Conversation') {
      return 'conversation'
    }
    return 'agent-single'
  }

  if ('steps' in firstCase) {
    return 'workflow'
  }

  return 'unknown'
}


/**
 * Fill strategy for Agent Single Response datasets
 * Defines how to detect, fill, and revert data for agent datasets
 */
const AgentSingleResponseFillStrategy = {
  /**
   * Detect which fields are empty and need filling
   * @param {Object} caseItem - Current case data
   * @param {Object} originalCase - Original case data with all fields
   * @returns {Set<string>} - Set of field names that need filling
   */
  detectEmptyCells(caseItem: DatasetCase, originalCase: DatasetCase) {
    const filledFields = new Set<string>()

    if (!caseItem.expectedResponse && originalCase.expectedResponse) {
      filledFields.add('expectedResponse')
    }
    if ((!caseItem.keywords || caseItem.keywords.length === 0) &&
        originalCase.keywords && originalCase.keywords.length > 0) {
      filledFields.add('keywords')
    }
    if ((!caseItem.toolUse || caseItem.toolUse.length === 0) &&
        originalCase.toolUse && originalCase.toolUse.length > 0) {
      filledFields.add('toolUse')
    }

    return filledFields
  },

  /**
   * Fill a specific field from original data
   * @param {Object} caseItem - Case to fill
   * @param {Object} originalCase - Original case with complete data
   * @param {string} fieldName - Field to fill
   * @returns {Object} - Updated case with filled field
   */
  fillField(caseItem: DatasetCase, originalCase: DatasetCase, fieldName: string) {
    return {
      ...caseItem,
      [fieldName]: (originalCase as any)[fieldName]
    }
  },

  revertField(caseItem: DatasetCase, fieldName: string) {
    const reverted = { ...caseItem }
    if (fieldName === 'expectedResponse') {
      reverted.expectedResponse = ''
    } else if (fieldName === 'keywords') {
      reverted.keywords = []
    } else if (fieldName === 'toolUse') {
      reverted.toolUse = []
    }
    return reverted
  }
}

const PromptDatasetFillStrategy = {
  detectEmptyCells(caseItem: PromptDatasetCase, originalCase: PromptDatasetCase) {
    const filledFields = new Set<string>()

    if (!caseItem.expectedResponse && originalCase.expectedResponse) {
      filledFields.add('expectedResponse')
    }

    if (caseItem.inputs && originalCase.inputs) {
      Object.keys(originalCase.inputs).forEach(key => {
        const currentValue = caseItem.inputs[key]
        const originalValue = originalCase.inputs[key]

        const isEmpty = !currentValue ||
                       (typeof currentValue === 'string' && currentValue.trim() === '') ||
                       (Array.isArray(currentValue) && currentValue.length === 0)

        const hasOriginal = originalValue &&
                          (typeof originalValue === 'string' ? originalValue.trim() !== '' : true) &&
                          (!Array.isArray(originalValue) || originalValue.length > 0)

        if (isEmpty && hasOriginal) {
          filledFields.add(key)
        }
      })
    }

    return filledFields
  },

  /**
   * Fill a specific field from original data
   * @param {Object} caseItem - Case to fill
   * @param {Object} originalCase - Original case with complete data
   * @param {string} fieldName - Field to fill
   * @returns {Object} - Updated case with filled field
   */
  fillField(caseItem: PromptDatasetCase, originalCase: PromptDatasetCase, fieldName: string) {
    if (fieldName === 'expectedResponse') {
      return {
        ...caseItem,
        expectedResponse: originalCase.expectedResponse
      }
    } else {
      return {
        ...caseItem,
        inputs: {
          ...caseItem.inputs,
          [fieldName]: originalCase.inputs[fieldName]
        }
      }
    }
  },

  revertField(caseItem: PromptDatasetCase, fieldName: string) {
    if (fieldName === 'expectedResponse') {
      return {
        ...caseItem,
        expectedResponse: ''
      }
    } else {
      const originalValue = caseItem.inputs[fieldName]
      const emptyValue = Array.isArray(originalValue) ? [] : ''

      return {
        ...caseItem,
        inputs: {
          ...caseItem.inputs,
          [fieldName]: emptyValue
        }
      }
    }
  }
}

interface DatasetDetailPageProps {
  dataset: Dataset
  onBack: () => void
  initialAgent?: Agent | null
}

function DatasetDetailPage({ dataset, onBack, initialAgent = null }: DatasetDetailPageProps) {
  const datasetType = detectDatasetType(dataset)

  const fillStrategy = datasetType === 'prompt' ? PromptDatasetFillStrategy : AgentSingleResponseFillStrategy

  const [rowHeight, setRowHeight] = useState(() => {
    const saved = localStorage.getItem('datasetRowHeight')
    return saved || 'Short'
  })
  const [selectedRows, setSelectedRows] = useState<Set<any>>(new Set())
  const [isFilling, setIsFilling] = useState(false)
  const [fillingRows, setFillingRows] = useState<Set<number>>(new Set())
  const [showFillActions, setShowFillActions] = useState(false)
  const [filledCells, setFilledCells] = useState<Map<number, Set<string>>>(new Map())
  const [originalCases] = useState(dataset.cases)

  const [contextAgent, setContextAgent] = useState(initialAgent) // Single agent object that is in context
  const [isContextLocked] = useState(!!initialAgent) // Lock context when coming from evaluation
  const [isAddContextDialogOpen, setIsAddContextDialogOpen] = useState(false)

  const [casesData, setCasesData] = useState(() => {
    return dataset.cases.map((caseItem, index) => {
      const remainder = index % 12

      if (remainder === 1) {
        return { ...caseItem, expectedResponse: '' }
      } else if (remainder === 4) {
        return { ...caseItem, keywords: [] }
      } else if (remainder === 7) {
        return { ...caseItem, toolUse: [] }
      } else if (remainder === 10) {
        return { ...caseItem, expectedResponse: '', keywords: [] }
      }

      return caseItem
    })
  })

  useEffect(() => {
    localStorage.setItem('datasetRowHeight', rowHeight)
  }, [rowHeight])

  const handleDeleteSelected = () => {
    const newCases = casesData.filter(caseItem => !selectedRows.has(caseItem))
    setCasesData(newCases)
    setSelectedRows(new Set())
  }

  const handleCopySelected = () => {
    const selectedCases = Array.from(selectedRows)
    const textToCopy = selectedCases.map(caseItem => {
      return `Question: ${caseItem.question}\nExpected Response: ${caseItem.expectedResponse}\nKeywords: ${caseItem.keywords.join(', ')}\nTools: ${caseItem.toolUse.map((t: any) => t.name).join(', ')}`
    }).join('\n\n---\n\n')

    navigator.clipboard.writeText(textToCopy)
  }

  const handleFillData = () => {
    setIsFilling(true)

    const rowsToFill: number[] = []
    const newFilledCells = new Map<number, Set<string>>()

    casesData.forEach((caseItem, index) => {
      const originalCase = originalCases[index]

      const filledFields = fillStrategy.detectEmptyCells(caseItem as any, originalCase as any)

      if (filledFields.size > 0) {
        rowsToFill.push(index)
        newFilledCells.set(index, filledFields)
      }
    })

    setFillingRows(new Set(rowsToFill))

    setTimeout(() => {
      rowsToFill.forEach((rowIndex, i) => {
        setTimeout(() => {
          setCasesData(prevData => {
            const newData = [...prevData]
            newData[rowIndex] = originalCases[rowIndex]
            return newData
          })

          setFillingRows(prev => {
            const newSet = new Set(prev)
            newSet.delete(rowIndex)
            return newSet
          })

          setFilledCells(prev => {
            const newMap = new Map(prev)
            newMap.set(rowIndex, newFilledCells.get(rowIndex) || new Set<string>())
            return newMap
          })

          if (i === rowsToFill.length - 1) {
            setTimeout(() => {
              setIsFilling(false)
              setShowFillActions(true)
            }, 100)
          }
        }, i * 600)
      })

      if (rowsToFill.length === 0) {
        setIsFilling(false)
      }
    }, 800)
  }

  const handleKeepFilled = () => {
    setFilledCells(new Map())
    setShowFillActions(false)
  }

  const handleUndoFill = () => {
    setCasesData(prevData => {
      return prevData.map((caseItem, index) => {
        const fieldsToRevert = filledCells.get(index)
        if (!fieldsToRevert) return caseItem

        let revertedCase: any = caseItem
        fieldsToRevert.forEach((fieldName: string) => {
          revertedCase = fillStrategy.revertField(revertedCase, fieldName)
        })

        return revertedCase
      })
    })
    setFilledCells(new Map())
    setShowFillActions(false)
  }

  const agentsUsingDataset = mockEvaluations
    .filter(e => e.evaluatedItem.type === 'Agent' && e.dataset === dataset.name)
    .reduce((acc: any[], curr) => {
      if (!acc.find(a => a.name === curr.evaluatedItem.name)) {
        acc.push(curr.evaluatedItem)
      }
      return acc
    }, [])

  const agentsInContextMenu = [...agentsUsingDataset]
  if (contextAgent && !agentsInContextMenu.find(a => a.name === contextAgent.name)) {
    agentsInContextMenu.push(contextAgent)
  }

  const allAvailableAgents = mockEvaluations
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

  const handleAddContext = (agent: Agent) => {
    setContextAgent(agent)
    setIsAddContextDialogOpen(false)
  }

  const handleRemoveContext = () => {
    setContextAgent(null)
  }

  const handleOpenAddContextDialog = () => {
    setTimeout(() => {
      setIsAddContextDialogOpen(true)
    }, 100)
  }

  if (!dataset) {
    return null
  }

  return (
    <div className={CLS.pageRoot}>
      <div className={`${CLS.pageInner} pt-2.5`}>
        <div className="max-w-full mx-auto">
        {/* Dataset Header */}
        <DetailPageHeader title={dataset.name} onBack={onBack}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {selectedRows.size > 0 ? (
              <>
                <CopilotButton variant="ghost" size="xs" onClick={handleDeleteSelected}>
                  <Delete20Regular />
                  Delete
                </CopilotButton>
                <CopilotButton variant="ghost" size="xs" onClick={handleCopySelected}>
                  <Copy20Regular />
                  Copy
                </CopilotButton>
              </>
            ) : (
              <>
                <Menu>
                  <MenuTrigger disableButtonEnhancement>
                    <button
                      type="button"
                      className={CLS.ghostBtn}
                      aria-label="More options"
                    >
                      <MoreHorizontal20Regular />
                    </button>
                  </MenuTrigger>
                  <MenuPopover>
                    <MenuList hasIcons hasCheckmarks>
                      <Menu>
                        <MenuTrigger disableButtonEnhancement>
                          <MenuItem hasSubmenu>Row height</MenuItem>
                        </MenuTrigger>
                        <MenuPopover>
                          <MenuList hasIcons hasCheckmarks>
                            <MenuGroup>
                              <MenuGroupHeader>Select row height</MenuGroupHeader>
                              <MenuItem
                                icon={rowHeight === 'Short' ? <Checkmark20Regular /> : <span style={{ width: '20px' }} />}
                                onClick={() => setRowHeight('Short')}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <ArrowAutofitHeightInIcon />
                                  <span>Short</span>
                                </div>
                              </MenuItem>
                              <MenuItem
                                icon={rowHeight === 'Tall' ? <Checkmark20Regular /> : <span style={{ width: '20px' }} />}
                                onClick={() => setRowHeight('Tall')}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <ArrowAutofitIcon />
                                  <span>Tall</span>
                                </div>
                              </MenuItem>
                            </MenuGroup>
                          </MenuList>
                        </MenuPopover>
                      </Menu>
                      <MenuDivider />
                      <MenuItem icon={<ArrowExport20Regular />}>Export</MenuItem>
                      <MenuDivider />
                      <MenuItem>Delete</MenuItem>
                    </MenuList>
                  </MenuPopover>
                </Menu>
                {isFilling ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '200px', height: '32px', position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '180px' }}>
                      <MorseCode />
                    </div>
                  </div>
                ) : showFillActions ? (
                  <>
                    <CopilotButton variant="ghost" size="xs" onClick={handleUndoFill}>
                      <ArrowHookUpLeft20Regular />
                      Undo
                    </CopilotButton>
                    <CopilotButton variant="ghost" size="xs" onClick={handleKeepFilled}>
                      <Checkmark20Regular />
                      Keep
                    </CopilotButton>
                  </>
                ) : (
                  <CopilotButton variant="ghost" size="xs" onClick={handleFillData}>
                    <Sparkle20Regular />
                    Fill data
                  </CopilotButton>
                )}
                <CopilotButton variant="primary" size="sm">
                  <Add20Regular />
                  Add
                </CopilotButton>
              </>
            )}
          </div>
        </DetailPageHeader>

        <div className="mb-2.5" style={{ marginTop: '-4px' }}>
          {/* Tags Row */}
          <div className="flex items-center gap-2 mt-2">
            <Tooltip content={`Data type: ${dataset.dataType}`} relationship="label">
              <span className="inline-flex items-center gap-1 h-5 px-1.5 bg-gray-100 border border-[rgba(0,0,0,0.09)] rounded-md text-[11px] text-gray-500">Data type: {dataset.dataType}</span>
            </Tooltip>

            {/* Contextual Data - Hide entirely for prompt datasets (may bring back later) */}
            {datasetType !== 'prompt' && (
              <>
                {!contextAgent ? (
                  <>
                    <Menu>
                      <MenuTrigger disableButtonEnhancement>
                        <button type="button" className={CLS.ghostBtn}>
                          <ScanTable20Regular />
                          show agent context
                        </button>
                      </MenuTrigger>
                      <MenuPopover>
                        <MenuList>
                          {agentsInContextMenu.length > 0 && (
                            <>
                              <MenuGroup>
                                <MenuGroupHeader>Available agent context</MenuGroupHeader>
                                {agentsInContextMenu.map((agent, index) => (
                                  <MenuItem key={index} onClick={() => handleAddContext(agent)}>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                      <img
                                        src={agent.icon}
                                        alt={agent.name}
                                        style={{
                                          width: '16px',
                                          height: '16px',
                                          borderRadius: '6px',
                                        }}
                                      />
                                      <span>{agent.name}</span>
                                    </div>
                                  </MenuItem>
                                ))}
                              </MenuGroup>
                              <MenuDivider />
                            </>
                          )}
                          <MenuItem onClick={handleOpenAddContextDialog}>Add context</MenuItem>
                        </MenuList>
                      </MenuPopover>
                    </Menu>
                  </>
                ) : isContextLocked ? (
                  /* Read-only Contextual Data Tag - No dismiss or menu when locked */
                  <span className="inline-flex items-center gap-1 h-5 px-1.5 bg-gray-100 border border-[rgba(0,0,0,0.09)] rounded-md text-[11px] text-gray-500">
                    <img src={contextAgent.icon} alt={contextAgent.name} width="16" height="16" />
                    Context: {contextAgent.name}
                  </span>
                ) : (
                  /* Editable Contextual Data Tag - Clickable to open menu, with dismiss button */
                  <Menu>
                    <MenuTrigger disableButtonEnhancement>
                      <span className="inline-flex items-center gap-1 h-5 px-1.5 bg-gray-100 border border-[rgba(0,0,0,0.09)] rounded-md text-[11px] text-gray-500 cursor-pointer">
                        <img src={contextAgent.icon} alt={contextAgent.name} width="16" height="16" />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>Context: {contextAgent.name}</span>
                          <div
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveContext()
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              cursor: 'pointer',
                              padding: '2px',
                            }}
                          >
                            <Dismiss12Regular style={{ fontSize: '12px' }} />
                          </div>
                        </div>
                      </span>
                    </MenuTrigger>
                    <MenuPopover>
                      <MenuList>
                        {agentsInContextMenu.length > 0 && (
                          <>
                            <MenuGroup>
                              <MenuGroupHeader>Agents as context</MenuGroupHeader>
                              {agentsInContextMenu.map((agent, index) => (
                                <MenuItem
                                  key={index}
                                  onClick={() => handleAddContext(agent)}
                                >
                                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <img
                                      src={agent.icon}
                                      alt={agent.name}
                                      style={{
                                        width: '16px',
                                        height: '16px',
                                        borderRadius: '6px',
                                      }}
                                    />
                                    <span>{agent.name}</span>
                                    {contextAgent?.name === agent.name && (
                                      <Checkmark20Regular style={{ marginLeft: 'auto', color: '#0F6CBD' }} />
                                    )}
                                  </div>
                                </MenuItem>
                              ))}
                            </MenuGroup>
                            <MenuDivider />
                          </>
                        )}
                        <MenuItem onClick={handleOpenAddContextDialog}>Add context</MenuItem>
                      </MenuList>
                    </MenuPopover>
                  </Menu>
                )}
              </>
            )}

            {/* Add Context Dialog - Always rendered so it works regardless of context state */}
            <Dialog isOpen={isAddContextDialogOpen} onClose={() => setIsAddContextDialogOpen(false)} maxWidth="md">
              <DialogHeader onClose={() => setIsAddContextDialogOpen(false)}>
                <DialogTitle>Add agent context</DialogTitle>
              </DialogHeader>
              <DialogContent>
                <div className="flex flex-col gap-1">
                  {allAvailableAgents.map((agent, index) => {
                    const isInUse = agentsUsingDataset.find(a => a.name === agent.name)
                    return (
                      <CopilotButton
                        variant="ghost"
                        size="xs"
                        key={index}
                        onClick={() => handleAddContext(agent)}
                        className="flex items-center gap-3 p-3 rounded-lg text-left hover:bg-[var(--colorNeutralBackground2)] transition-colors relative"
                      >
                        {isInUse && (
                          <span className="inline-flex items-center h-5 px-2 rounded-md border border-[rgba(0,0,0,0.09)] text-[11px] text-gray-500 absolute top-3 right-3">
                            In use
                          </span>
                        )}
                        <img src={agent.icon} alt={agent.name} className="shrink-0" style={{ width: '32px', height: '32px', borderRadius: '12px' }} />
                        <div className="flex-1 min-w-0" style={{ paddingRight: isInUse ? '50px' : 0 }}>
                          <p className="text-body-2 font-medium truncate">{agent.name}</p>
                          <p className="text-caption text-[var(--colorNeutralForeground3)] mt-0.5" style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}>
                            {agentDescriptions[agent.name] || 'AI-powered agent designed to assist with various tasks and workflows.'}
                          </p>
                        </div>
                      </CopilotButton>
                    )
                  })}
                </div>
              </DialogContent>
              <DialogFooter>
                <CopilotButton variant="secondary" size="md" onClick={() => setIsAddContextDialogOpen(false)}>Close</CopilotButton>
              </DialogFooter>
            </Dialog>
          </div>
        </div>

        {/* Render appropriate grid based on dataset type */}
        {datasetType === 'prompt' ? (
          <PromptDatasetGrid
            cases={casesData as any}
            setCasesData={setCasesData}
            selectedRows={selectedRows}
            setSelectedRows={setSelectedRows}
            isFilling={isFilling}
            fillingRows={fillingRows}
            filledCells={filledCells}
            setFilledCells={setFilledCells}
            rowHeight={rowHeight}
          />
        ) : (
          <AgentSingleResponseGrid
            cases={casesData as any}
            setCasesData={setCasesData}
            selectedRows={selectedRows}
            setSelectedRows={setSelectedRows}
            isFilling={isFilling}
            fillingRows={fillingRows}
            filledCells={filledCells}
            setFilledCells={setFilledCells}
            rowHeight={rowHeight}
            contextAgent={contextAgent}
          />
        )}
        </div>
      </div>
    </div>
  )
}

export { detectDatasetType, AgentSingleResponseFillStrategy, PromptDatasetFillStrategy }
export default DatasetDetailPage
