import React, { useState, useRef, useEffect, useCallback } from 'react'
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
  Checkbox,
} from '@fluentui/react-components'
import { CopilotInput } from '../../../components/ui/CopilotInput'
import {
  Add20Regular,
  Search20Regular,
  Dismiss12Regular,
  Delete20Regular,
  ArrowUp16Filled,
  ArrowDown16Filled,
  ArrowUp16Regular,
  ArrowDown16Regular,
  Edit20Regular,
} from '@fluentui/react-icons'
import { CopilotButton } from '../../../components/ui/CopilotButton'
import { CopilotTextarea } from '../../../components/ui/CopilotTextarea'
import { COLORS } from '../constants'
import type { ToolUseItem, DatasetCase, Agent, CheckboxState } from '../types'
const toolIcons = ['/D365.svg','/DataVerse.svg','/Sharepoint.svg','/ServiceNow.svg','/Salesforce.svg']

interface ToolUseCellProps {
  tools: ToolUseItem[]
  caseItem: DatasetCase
  casesData: DatasetCase[]
  setCasesData: (data: DatasetCase[]) => void
  index: number
  isRowEditing: boolean
  isFilling: boolean
  fillingRows: Set<number>
}

function ToolUseCell({ tools, caseItem, casesData, setCasesData, index, isRowEditing, isFilling, fillingRows }: ToolUseCellProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(tools.length)
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedView, setSelectedView] = useState('tools') // 'tools' or 'topics'
  const [editableTools, setEditableTools] = useState<ToolUseItem[]>([])
  const [selectedTools, setSelectedTools] = useState(new Set(tools.map(t => t.name)))
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const container = containerRef.current
    const measureContainer = measureRef.current
    if (!container || !measureContainer || tools.length === 0) return

    const updateVisibleCount = () => {
      const containerWidth = container.offsetWidth
      const buttonWidth = 60
      const gap = 4
      const safetyMargin = 8

      const tags = measureContainer.querySelectorAll<HTMLElement>('[data-tag]')
      let totalWidth = 0
      let count = 0

      for (let i = 0; i < tags.length; i++) {
        const tagWidth = tags[i].offsetWidth
        const needsButton = i < tools.length - 1

        const widthWithGap = totalWidth + (count > 0 ? gap : 0) + tagWidth
        const totalNeeded = widthWithGap + (needsButton ? buttonWidth + gap : 0) + safetyMargin

        if (totalNeeded <= containerWidth) {
          totalWidth = widthWithGap
          count++
        } else {
          break
        }
      }

      setVisibleCount(count)
    }

    const debouncedUpdate = () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
      updateTimeoutRef.current = setTimeout(() => {
        updateVisibleCount()
      }, 150)
    }

    setTimeout(() => {
      updateVisibleCount()
    }, 100)

    const resizeObserver = new ResizeObserver(debouncedUpdate)
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
    }
  }, [tools])

  const handleDismiss = (toolIndex: number) => {
    const itemIndex = casesData.findIndex(item => item === caseItem)
    if (itemIndex !== -1) {
      const newCases = [...casesData]
      newCases[itemIndex].toolUse = newCases[itemIndex].toolUse.filter((_, i) => i !== toolIndex)
      setCasesData(newCases)
    }
  }

  const getAllTools = () => {
    const allTools = new Map()
    casesData.forEach(item => {
      item.toolUse.forEach(tool => {
        if (!allTools.has(tool.name)) {
          allTools.set(tool.name, { name: tool.name, icon: tool.icon, type: tool.type })
        }
      })
    })
    return Array.from(allTools.values())
  }

  const handleOpenDialog = () => {
    const allTools = getAllTools()
    setEditableTools(allTools)
    setSelectedTools(new Set(tools.map(t => t.name)))
    setIsDialogOpen(true)
  }

  const handleToggleTool = (toolName: string) => {
    const newSelected = new Set(selectedTools)
    if (newSelected.has(toolName)) {
      newSelected.delete(toolName)
    } else {
      newSelected.add(toolName)
    }
    setSelectedTools(newSelected)

    const itemIndex = casesData.findIndex(item => item === caseItem)
    if (itemIndex !== -1) {
      const newCases = [...casesData]
      newCases[itemIndex].toolUse = Array.from(newSelected)
        .filter(name => name !== '')
        .map(name => {
          const tool = editableTools.find(t => t.name === name)
          return tool || { name, type: 'tool', icon: toolIcons[0] }
        })
      setCasesData(newCases)
    }
  }

  const visibleTags = isRowEditing ? tools : tools.slice(0, visibleCount)
  const hiddenTags = isRowEditing ? [] : tools.slice(visibleCount)

  const originalIndex = casesData.indexOf(caseItem)
  const isThisRowFilling = fillingRows && fillingRows.has(originalIndex)

  if (tools.length === 0 && isThisRowFilling) {
    return (
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          padding: '12px 16px 12px 8px',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'flex-start'
        }}
      >
        <div className="animate-pulse bg-gray-200 rounded" style={{ width: '100px', height: '16px' }} />
      </div>
    )
  }

  return (
    <>
      <div
        ref={measureRef}
        style={{
          position: 'absolute',
          visibility: 'hidden',
          display: 'flex',
          gap: '4px',
          pointerEvents: 'none',
          left: '-9999px'
        }}
      >
        {tools.map((tool, idx) => (
          <span key={idx} data-tag className="inline-flex items-center h-6 px-2.5 rounded-full border border-[rgba(0,0,0,0.06)] text-xs text-gray-600">
            <img src={tool.icon} alt="" style={{ width: '16px', height: '16px', marginRight: '4px' }} />
            {tool.name}
          </span>
        ))}
      </div>

      <Menu open={isDialogOpen} onOpenChange={(e, data) => setIsDialogOpen(data.open)}>
        <MenuTrigger disableButtonEnhancement>
          <div
            ref={containerRef}
            onClick={handleOpenDialog}
            style={{
              display: 'flex',
              gap: '4px',
              alignItems: isRowEditing ? 'flex-start' : 'center',
              alignContent: isRowEditing ? 'flex-start' : 'center',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              padding: '12px 16px 12px 8px',
              flexWrap: isRowEditing ? 'wrap' : 'nowrap',
              cursor: 'pointer',
              minHeight: '24px'
            }}
          >
            {visibleTags.map((tool, toolIndex) => (
              <Tooltip key={toolIndex} content={tool.type === 'tool' ? 'Tool' : 'Topic'} relationship="label">
                <span
                  className="inline-flex items-center h-6 px-2.5 rounded-md border border-[rgba(0,0,0,0.06)] text-xs text-gray-600 shrink-0"
                  style={{ position: 'relative' }}
                >
                  <img src={tool.icon} alt="" style={{ width: '16px', height: '16px', marginRight: '4px' }} />
                  {tool.name}
                  <CopilotButton
                    variant="icon-subtle"
                    size="xs"
                    aria-label="Close"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDismiss(toolIndex)
                    }}
                  >
                    <Dismiss12Regular />
                  </CopilotButton>
                </span>
              </Tooltip>
            ))}
            {hiddenTags.length > 0 && (
              <Menu>
                <MenuTrigger disableButtonEnhancement>
                  <button
                    type="button"
                    className="shrink-0 inline-flex items-center justify-center border-none cursor-pointer"
                    style={{
                      minWidth: 'auto',
                      padding: '1px 6px',
                      height: '24px',
                      borderRadius: '9999px',
                      fontSize: '12px',
                      fontWeight: '400',
                      lineHeight: '16px',
                      backgroundColor: 'hsl(var(--surface-quaternary))',
                      color: COLORS.textSecondary,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    +{hiddenTags.length}
                  </button>
                </MenuTrigger>
                <MenuPopover>
                  <MenuList>
                    {hiddenTags.map((tool, idx) => {
                      const actualIndex = visibleCount + idx
                      return (
                        <MenuItem key={actualIndex}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            width: '100%',
                            gap: '8px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                              <img src={tool.icon} alt="" style={{ width: '16px', height: '16px' }} />
                              <span>{tool.name}</span>
                            </div>
                            <CopilotButton
                              variant="icon-subtle"
                              size="xs"
                              aria-label="Close"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDismiss(actualIndex)
                              }}
                            >
                              <Dismiss12Regular />
                            </CopilotButton>
                          </div>
                        </MenuItem>
                      )
                    })}
                  </MenuList>
                </MenuPopover>
              </Menu>
            )}
          </div>
        </MenuTrigger>

        <MenuPopover style={{ minWidth: '280px' }}>
          <MenuList>
            <MenuGroup>
              <MenuGroupHeader>Select a tool or topic</MenuGroupHeader>
              <div style={{ padding: '8px' }}>
                <div style={{
                  display: 'flex',
                  gap: '4px',
                  backgroundColor: COLORS.bg3,
                  padding: '2px',
                  borderRadius: '12px'
                }}>
                  <CopilotButton
                    variant="ghost"
                    size="xs"
                    onClick={() => setSelectedView('tools')}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: '28px',
                      padding: '0 12px',
                      borderRadius: '12px',
                      fontSize: '14px',
                      lineHeight: '20px',
                      fontWeight: selectedView === 'tools' ? 600 : 400,
                      color: COLORS.textPrimary,
                      backgroundColor: selectedView === 'tools' ? COLORS.white : 'transparent',
                      boxShadow: selectedView === 'tools' ? `0 1px 2px ${COLORS.shadow}` : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Tools
                  </CopilotButton>
                  <CopilotButton
                    variant="ghost"
                    size="xs"
                    onClick={() => setSelectedView('topics')}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: '28px',
                      padding: '0 12px',
                      borderRadius: '12px',
                      fontSize: '14px',
                      lineHeight: '20px',
                      fontWeight: selectedView === 'topics' ? 600 : 400,
                      color: COLORS.textPrimary,
                      backgroundColor: selectedView === 'topics' ? COLORS.white : 'transparent',
                      boxShadow: selectedView === 'topics' ? `0 1px 2px ${COLORS.shadow}` : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Topics
                  </CopilotButton>
                </div>
              </div>
              <div style={{ padding: '0 8px 8px 8px' }}>
                <CopilotInput
                  size="sm"
                  appearance="filled-darker"
                  contentBefore={<Search20Regular />}
                  placeholder={selectedView === 'tools' ? 'Search for a tool' : 'Search for a topic'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%', height: '32px' }}
                />
              </div>
              <MenuDivider />
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {editableTools
                  .filter(tool => tool.type === selectedView.slice(0, -1)) // 'tools' -> 'tool', 'topics' -> 'topic'
                  .filter(tool => tool.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((tool, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleToggleTool(tool.name)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '8px',
                        cursor: 'pointer',
                        borderRadius: '6px',
                        transition: 'background-color 0.1s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'hsl(var(--surface-tertiary))'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }}
                    >
                      <Checkbox
                        checked={selectedTools.has(tool.name)}
                        style={{ marginRight: '8px' }}
                      />
                      <img src={tool.icon} alt="" style={{ width: '16px', height: '16px', marginRight: '8px' }} />
                      <span>{tool.name}</span>
                    </div>
                  ))}
              </div>
            </MenuGroup>
          </MenuList>
        </MenuPopover>
      </Menu>
    </>
  )
}

interface KeywordsCellProps {
  keywords: string[]
  caseItem: DatasetCase
  casesData: DatasetCase[]
  setCasesData: (data: DatasetCase[]) => void
  index: number
  setIsColumnKeywordDialogOpen: (open: boolean) => void
  isRowEditing: boolean
  isFilling: boolean
  fillingRows: Set<number>
}

function KeywordsCell({ keywords, caseItem, casesData, setCasesData, index, setIsColumnKeywordDialogOpen, isRowEditing, isFilling, fillingRows }: KeywordsCellProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(keywords.length)
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editableKeywords, setEditableKeywords] = useState<string[]>([])
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set(keywords))
  const originalKeywordsRef = useRef<string[]>([])

  useEffect(() => {
    const container = containerRef.current
    const measureContainer = measureRef.current
    if (!container || !measureContainer || keywords.length === 0) return

    const updateVisibleCount = () => {
      const containerWidth = container.offsetWidth
      const buttonWidth = 60 // Width for "+N" button
      const gap = 4
      const safetyMargin = 8 // Safety margin to prevent overflow

      const tags = measureContainer.querySelectorAll<HTMLElement>('[data-tag]')
      let totalWidth = 0
      let count = 0

      for (let i = 0; i < tags.length; i++) {
        const tagWidth = tags[i].offsetWidth
        const needsButton = i < keywords.length - 1

        const widthWithGap = totalWidth + (count > 0 ? gap : 0) + tagWidth
        const totalNeeded = widthWithGap + (needsButton ? buttonWidth + gap : 0) + safetyMargin

        if (totalNeeded <= containerWidth) {
          totalWidth = widthWithGap
          count++
        } else {
          break
        }
      }

      setVisibleCount(count)
    }

    const debouncedUpdate = () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
      updateTimeoutRef.current = setTimeout(() => {
        updateVisibleCount()
      }, 150)
    }

    setTimeout(() => {
      updateVisibleCount()
    }, 100)

    const resizeObserver = new ResizeObserver(debouncedUpdate)
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
    }
  }, [keywords])

  const handleDismiss = (keywordIndex: number) => {
    const itemIndex = casesData.findIndex(item => item === caseItem)
    if (itemIndex !== -1) {
      const newCases = [...casesData]
      newCases[itemIndex].keywords = newCases[itemIndex].keywords.filter((_, i) => i !== keywordIndex)
      setCasesData(newCases)
    }
  }

  const getAllKeywords = () => {
    const allKeywords = new Set<string>()
    casesData.forEach(item => {
      item.keywords.forEach(kw => allKeywords.add(kw))
    })
    return Array.from(allKeywords)
  }

  const handleOpenDialog = () => {
    if (setIsColumnKeywordDialogOpen) {
      setIsColumnKeywordDialogOpen(false)
    }

    const allKw = getAllKeywords()
    setEditableKeywords(allKw)
    originalKeywordsRef.current = [...allKw]
    setSelectedKeywords(new Set(keywords))
    setIsDialogOpen(true)
  }

  const handleAddKeyword = () => {
    setEditableKeywords(['', ...editableKeywords])
    originalKeywordsRef.current = ['', ...originalKeywordsRef.current]
    setSelectedKeywords(new Set([...Array.from(selectedKeywords), '']))

    setTimeout(() => {
      const menuPopover = document.querySelector('[role="menu"]')
      if (menuPopover) {
        const firstInput = menuPopover.querySelector<HTMLInputElement>('input[type="text"]')
        if (firstInput) {
          firstInput.focus()
        }
      }
    }, 10)
  }

  const handleDeleteKeyword = (keyword: string) => {
    const newCases = casesData.map(item => ({
      ...item,
      keywords: item.keywords.filter(kw => kw !== keyword)
    }))
    setCasesData(newCases)
    setEditableKeywords(editableKeywords.filter(kw => kw !== keyword))
    const newSelected = new Set(selectedKeywords)
    newSelected.delete(keyword)
    setSelectedKeywords(newSelected)
  }

  const handleKeywordChange = (idx: number, newKeyword: string) => {
    const updated = [...editableKeywords]
    const oldKeyword = updated[idx]
    updated[idx] = newKeyword
    setEditableKeywords(updated)

    if (selectedKeywords.has(oldKeyword)) {
      const newSelected = new Set(selectedKeywords)
      newSelected.delete(oldKeyword)
      newSelected.add(newKeyword)
      setSelectedKeywords(newSelected)

      const itemIndex = casesData.findIndex(item => item === caseItem)
      if (itemIndex !== -1) {
        const newCases = [...casesData]
        newCases[itemIndex].keywords = Array.from(newSelected).filter(kw => kw !== '')
        setCasesData(newCases)
      }
    }
  }

  const handleKeywordBlur = (idx: number, newKeyword: string) => {
    const oldKeyword = originalKeywordsRef.current[idx]
    if (oldKeyword !== newKeyword && oldKeyword !== '') {
      const newCases = casesData.map(item => ({
        ...item,
        keywords: item.keywords.map(kw => kw === oldKeyword ? newKeyword : kw)
      }))
      setCasesData(newCases)
      originalKeywordsRef.current[idx] = newKeyword
    }
  }

  const handleToggleKeyword = (keyword: string) => {
    const newSelected = new Set(selectedKeywords)
    if (newSelected.has(keyword)) {
      newSelected.delete(keyword)
    } else {
      newSelected.add(keyword)
    }
    setSelectedKeywords(newSelected)

    const itemIndex = casesData.findIndex(item => item === caseItem)
    if (itemIndex !== -1) {
      const newCases = [...casesData]
      newCases[itemIndex].keywords = Array.from(newSelected).filter(kw => kw !== '')
      setCasesData(newCases)
    }
  }

  const visibleTags = isRowEditing ? keywords : keywords.slice(0, visibleCount)
  const hiddenTags = isRowEditing ? [] : keywords.slice(visibleCount)

  const originalIndex = casesData.indexOf(caseItem)
  const isThisRowFilling = fillingRows && fillingRows.has(originalIndex)

  if (keywords.length === 0 && isThisRowFilling) {
    return (
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          padding: '12px 16px 12px 8px',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'flex-start'
        }}
      >
        <div className="animate-pulse bg-gray-200 rounded" style={{ width: '100px', height: '16px' }} />
      </div>
    )
  }

  return (
    <>
      {/* Hidden measurement container */}
        <div
          ref={measureRef}
          style={{
            position: 'absolute',
            visibility: 'hidden',
            display: 'flex',
            gap: '4px',
            pointerEvents: 'none',
            left: '-9999px'
          }}
        >
          {keywords.map((keyword, idx) => (
            <span key={idx} data-tag className="inline-flex items-center h-6 px-2.5 rounded-full border border-[rgba(0,0,0,0.06)] text-xs text-gray-600">{keyword}</span>
          ))}
        </div>

        {/* Visible container - clickable */}
        <Menu open={isDialogOpen} onOpenChange={(e, data) => setIsDialogOpen(data.open)}>
          <MenuTrigger disableButtonEnhancement>
            <div
              ref={containerRef}
              onClick={handleOpenDialog}
              style={{
                display: 'flex',
                gap: '4px',
                alignItems: isRowEditing ? 'flex-start' : 'center',
                alignContent: isRowEditing ? 'flex-start' : 'center',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                padding: '12px 16px 12px 8px',
                flexWrap: isRowEditing ? 'wrap' : 'nowrap',
                cursor: 'pointer',
                minHeight: '24px'
              }}
            >
          {visibleTags.map((keyword, keywordIndex) => (
            <span
              key={keywordIndex}
              className="inline-flex items-center h-6 px-2.5 rounded-md border border-[rgba(0,0,0,0.06)] text-xs text-gray-600 shrink-0"
            >
              {keyword}
              <CopilotButton
                variant="icon-subtle"
                size="xs"
                aria-label="Close"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDismiss(keywordIndex)
                }}
              >
                <Dismiss12Regular />
              </CopilotButton>
            </span>
          ))}
          {hiddenTags.length > 0 && (
            <Menu>
              <MenuTrigger disableButtonEnhancement>
                <button
                  type="button"
                  className="shrink-0 inline-flex items-center justify-center border-none cursor-pointer transition-all duration-100"
                  style={{
                    minWidth: 'auto',
                    padding: '1px 6px',
                    height: '24px',
                    borderRadius: '9999px',
                    fontSize: '12px',
                    fontWeight: '400',
                    lineHeight: '16px',
                    backgroundColor: 'hsl(var(--surface-quaternary))',
                    color: COLORS.textSecondary,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'hsl(var(--stroke-default))'
                    e.currentTarget.style.color = 'hsl(var(--text-primary))'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'hsl(var(--surface-quaternary))'
                    e.currentTarget.style.color = COLORS.textSecondary
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.backgroundColor = 'hsl(var(--stroke-default))'
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.backgroundColor = 'hsl(var(--stroke-default))'
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                  }}
                >
                  +{hiddenTags.length}
                </button>
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  {hiddenTags.map((keyword, idx) => {
                    const actualIndex = visibleCount + idx
                    return (
                      <MenuItem
                        key={actualIndex}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          paddingRight: '4px',
                        }}
                      >
                        <span style={{ flex: 1 }}>{keyword}</span>
                        <CopilotButton
                          variant="icon-subtle"
                          size="xs"
                          aria-label={`Remove ${keyword}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDismiss(actualIndex)
                          }}
                        >
                          <Dismiss12Regular />
                        </CopilotButton>
                      </MenuItem>
                    )
                  })}
                </MenuList>
              </MenuPopover>
            </Menu>
          )}
        </div>
          </MenuTrigger>
          <MenuPopover style={{ maxHeight: '488px', overflowY: 'auto' }}>
            <MenuList>
              <MenuGroup>
                <div style={{ position: 'sticky', top: 0, backgroundColor: 'hsl(var(--background))', zIndex: 1 }}>
                  <MenuGroupHeader>Edit keywords</MenuGroupHeader>
                  <div
                    onClick={handleAddKeyword}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '6px',
                      cursor: 'pointer',
                      borderRadius: '6px',
                      transition: 'background-color 0.1s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'hsl(var(--surface-tertiary))'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    <Add20Regular style={{ width: '20px', height: '20px' }} />
                    <span style={{ paddingLeft: '2px' }}>Add keyword</span>
                  </div>
                  <MenuDivider />
                </div>
                {editableKeywords.map((keyword, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      minHeight: '32px',
                      paddingLeft: 0,
                      paddingRight: 0,
                      paddingTop: '4px',
                      paddingBottom: '4px',
                      marginBottom: '4px',
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      flex: 1,
                      gap: 0,
                      paddingRight: '2px'
                    }}>
                      <Checkbox
                        checked={selectedKeywords.has(keyword)}
                        onChange={() => handleToggleKeyword(keyword)}
                      />
                      <CopilotInput
                        appearance="filled-darker"
                        size="sm"
                        value={keyword}
                        onChange={(e) => handleKeywordChange(idx, e.target.value)}
                        onBlur={(e) => handleKeywordBlur(idx, e.target.value)}
                        style={{
                          flex: 1,
                          height: '32px'
                        }}
                        contentAfter={
                          <CopilotButton
                            variant="icon-subtle"
                            size="xs"
                            aria-label="Delete keyword"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteKeyword(keyword)
                            }}
                          >
                            <Delete20Regular />
                          </CopilotButton>
                        }
                      />
                    </div>
                  </div>
                ))}
              </MenuGroup>
            </MenuList>
          </MenuPopover>
        </Menu>
    </>
  )
}

interface KeywordRowProps {
  keyword: string
  state: CheckboxState
  onToggle: () => void
  onChange: (value: string) => void
  onBlur: (value: string) => void
  onDelete: () => void
}

function KeywordRow({ keyword, state, onToggle, onChange, onBlur, onDelete }: KeywordRowProps) {
  const checkboxRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (checkboxRef.current) {
      const input = checkboxRef.current.querySelector<HTMLInputElement>('input[type="checkbox"]')
      if (input) {
        input.indeterminate = state === 'some'
      }
    }
  }, [state, keyword])

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        minHeight: '32px',
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: '4px',
        paddingBottom: '4px',
        marginBottom: '4px',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        flex: 1,
        gap: 0,
        paddingRight: '2px'
      }}>
        <div ref={checkboxRef} style={{ position: 'relative' }}>
          <Checkbox
            checked={state === 'all'}
            onChange={onToggle}
          />
          {state === 'some' && (
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none'
              }}
            >
              <mask id="path-1-inside-1_264_41160" fill="white">
                <path d="M0 2C0 0.895431 0.895431 0 2 0H14C15.1046 0 16 0.895431 16 2V14C16 15.1046 15.1046 16 14 16H2C0.895431 16 0 15.1046 0 14V2Z"/>
              </mask>
              <path d="M2 0V1H14V0V-1H2V0ZM16 2H15V14H16H17V2H16ZM14 16V15H2V16V17H14V16ZM0 14H1V2H0H-1V14H0ZM2 16V15C1.44772 15 1 14.5523 1 14H0H-1C-1 15.6569 0.343146 17 2 17V16ZM16 14H15C15 14.5523 14.5523 15 14 15V16V17C15.6569 17 17 15.6569 17 14H16ZM14 0V1C14.5523 1 15 1.44772 15 2H16H17C17 0.343146 15.6569 -1 14 -1V0ZM2 0V-1C0.343146 -1 -1 0.343146 -1 2H0H1C1 1.44772 1.44772 1 2 1V0Z" fill="#464FEB" mask="url(#path-1-inside-1_264_41160)"/>
              <path d="M4 6C4 4.89543 4.89543 4 6 4H10C11.1046 4 12 4.89543 12 6V10C12 11.1046 11.1046 12 10 12H6C4.89543 12 4 11.1046 4 10V6Z" fill="#464FEB"/>
            </svg>
          )}
        </div>
        <CopilotInput
          appearance="filled-darker"
          size="sm"
          value={keyword}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onBlur(e.target.value)}
          style={{
            flex: 1,
            height: '32px'
          }}
          contentAfter={
            <CopilotButton
              variant="icon-subtle"
              size="xs"
              aria-label="Delete keyword"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
            >
              <Delete20Regular />
            </CopilotButton>
          }
        />
      </div>
    </div>
  )
}

interface ToolRowProps {
  tool: ToolUseItem
  state: CheckboxState
  onToggle: () => void
}

function ToolRow({ tool, state, onToggle }: ToolRowProps) {
  const checkboxRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (checkboxRef.current) {
      const input = checkboxRef.current.querySelector<HTMLInputElement>('input[type="checkbox"]')
      if (input) {
        input.indeterminate = state === 'some'
      }
    }
  }, [state, tool.name])

  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px',
        cursor: 'pointer',
        borderRadius: '6px',
        transition: 'background-color 0.1s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'hsl(var(--surface-tertiary))'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent'
      }}
    >
      <div ref={checkboxRef} style={{ position: 'relative', marginRight: '8px' }}>
        <Checkbox
          checked={state === 'all'}
          style={{ marginRight: 0 }}
        />
        {state === 'some' && (
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none'
            }}
          >
            <mask id="path-1-inside-1_264_41160" fill="white">
              <path d="M0 2C0 0.895431 0.895431 0 2 0H14C15.1046 0 16 0.895431 16 2V14C16 15.1046 15.1046 16 14 16H2C0.895431 16 0 15.1046 0 14V2Z"/>
            </mask>
            <path d="M2 0V1H14V0V-1H2V0ZM16 2H15V14H16H17V2H16ZM14 16V15H2V16V17H14V16ZM0 14H1V2H0H-1V14H0ZM2 16V15C1.44772 15 1 14.5523 1 14H0H-1C-1 15.6569 0.343146 17 2 17V16ZM16 14H15C15 14.5523 14.5523 15 14 15V16V17C15.6569 17 17 15.6569 17 14H16ZM14 0V1C14.5523 1 15 1.44772 15 2H16H17C17 0.343146 15.6569 -1 14 -1V0ZM2 0V-1C0.343146 -1 -1 0.343146 -1 2H0H1C1 1.44772 1.44772 1 2 1V0Z" fill="#464FEB" mask="url(#path-1-inside-1_264_41160)"/>
            <path d="M4 6C4 4.89543 4.89543 4 6 4H10C11.1046 4 12 4.89543 12 6V10C12 11.1046 11.1046 12 10 12H6C4.89543 12 4 11.1046 4 10V6Z" fill="#464FEB"/>
          </svg>
        )}
      </div>
      <img src={tool.icon} alt="" style={{ width: '16px', height: '16px', marginRight: '8px' }} />
      <span>{tool.name}</span>
    </div>
  )
}

interface AgentSingleResponseGridProps {
  cases: DatasetCase[]
  setCasesData: (data: DatasetCase[]) => void
  selectedRows: Set<DatasetCase>
  setSelectedRows: (rows: Set<DatasetCase>) => void
  isFilling: boolean
  fillingRows: Set<number>
  filledCells: Map<number, Set<string>>
  setFilledCells: (cells: Map<number, Set<string>>) => void
  rowHeight: string
  contextAgent: Agent | null
}

function AgentSingleResponseGrid({ cases: casesData, setCasesData, selectedRows, setSelectedRows, isFilling, fillingRows, filledCells, setFilledCells, rowHeight, contextAgent }: AgentSingleResponseGridProps) {
  const [editingCell, setEditingCell] = useState<{ caseItem: DatasetCase; column: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState('asc')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [isColumnKeywordDialogOpen, setIsColumnKeywordDialogOpen] = useState(false)
  const [columnEditableKeywords, setColumnEditableKeywords] = useState<string[]>([])
  const [columnKeywordStates, setColumnKeywordStates] = useState<Record<string, CheckboxState>>({})
  const originalColumnKeywordsRef = useRef<string[]>([])

  const [isColumnToolDialogOpen, setIsColumnToolDialogOpen] = useState(false)
  const [columnEditableTools, setColumnEditableTools] = useState<ToolUseItem[]>([])
  const [columnToolStates, setColumnToolStates] = useState<Record<string, CheckboxState>>({})
  const [selectedColumnView, setSelectedColumnView] = useState('tools') // 'tools' or 'topics'
  const [columnSearchQuery, setColumnSearchQuery] = useState('')

  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null)
  const [hoveredNumberCell, setHoveredNumberCell] = useState<number | null>(null)
  const [hoveredHandle, setHoveredHandle] = useState<string | null>(null)
  const [hoveredFilledCell, setHoveredFilledCell] = useState<{ caseItem: DatasetCase; column: string } | null>(null)

  const handleRowSelect = (caseItem: DatasetCase, checked: boolean) => {
    const newSelected = new Set(selectedRows)
    if (checked) {
      newSelected.add(caseItem)
    } else {
      newSelected.delete(caseItem)
    }
    setSelectedRows(newSelected)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(new Set(casesData))
    } else {
      setSelectedRows(new Set())
    }
  }

  const allSelected = casesData.length > 0 && selectedRows.size === casesData.length
  const someSelected = selectedRows.size > 0 && selectedRows.size < casesData.length

  const handleInsertRow = (insertIndex: number) => {
    const newCase = {
      question: '',
      expectedResponse: '',
      keywords: [],
      toolUse: []
    }

    const newCases = [...casesData]
    newCases.splice(insertIndex, 0, newCase)
    setCasesData(newCases)

    setTimeout(() => {
      setEditingCell({ caseItem: newCase, column: 'question' })
      setEditValue('')
    }, 50)
  }

  const handleCellClick = (caseItem: DatasetCase, column: string, currentValue: string) => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current)
      blurTimeoutRef.current = null
    }

    const caseIndex = casesData.indexOf(caseItem)
    if (filledCells && filledCells.has(caseIndex)) {
      const fields = filledCells.get(caseIndex)
      if (fields?.has(column)) {
        const newFilledCells = new Map(filledCells)
        const updatedFields = new Set(fields)
        updatedFields.delete(column)

        if (updatedFields.size === 0) {
          newFilledCells.delete(caseIndex)
        } else {
          newFilledCells.set(caseIndex, updatedFields)
        }

        setFilledCells(newFilledCells)
      }
    }

    setEditingCell({ caseItem, column })
    setEditValue(currentValue)
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditValue(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = e.target.scrollHeight + 'px'
  }

  useEffect(() => {
    if (textareaRef.current && editingCell) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [editingCell])

  const handleCellBlur = () => {
    blurTimeoutRef.current = setTimeout(() => {
      if (editingCell) {
        const itemIndex = casesData.findIndex(item => item === editingCell.caseItem)
        if (itemIndex !== -1) {
          const newCases = [...casesData]
          if (editingCell.column === 'question') {
            newCases[itemIndex].question = editValue
          } else if (editingCell.column === 'expectedResponse') {
            newCases[itemIndex].expectedResponse = editValue
          }
          setCasesData(newCases)
        }
        setEditingCell(null)
        setEditValue('')
      }
    }, 150)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleCellBlur()
    } else if (e.key === 'Escape') {
      setEditingCell(null)
      setEditValue('')
    }
  }

  const isEditing = (caseItem: DatasetCase, column: string) => {
    return editingCell?.caseItem === caseItem && editingCell?.column === column
  }

  const isRowEditing = (caseItem: DatasetCase) => {
    return editingCell?.caseItem === caseItem
  }

  const isRowExpanded = (caseItem: DatasetCase) => {
    return rowHeight === 'Tall' || isRowEditing(caseItem)
  }

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const handleOpenColumnKeywordDialog = () => {
    const allKeywords = new Set<string>()
    casesData.forEach(item => {
      if (item.keywords && Array.isArray(item.keywords)) {
        item.keywords.forEach(kw => {
          if (kw && kw.trim() !== '') {
            allKeywords.add(kw)
          }
        })
      }
    })

    const states: Record<string, CheckboxState> = {}
    Array.from(allKeywords).forEach((keyword: string) => {
      const casesWithKeyword = casesData.filter(item =>
        item.keywords && Array.isArray(item.keywords) && item.keywords.includes(keyword)
      ).length

      if (casesWithKeyword === casesData.length) {
        states[keyword] = 'all'
      } else if (casesWithKeyword > 0) {
        states[keyword] = 'some'
      } else {
        states[keyword] = 'none'
      }
    })

    const keywordsArray = Array.from(allKeywords)
    setColumnEditableKeywords(keywordsArray)
    originalColumnKeywordsRef.current = [...keywordsArray]
    setColumnKeywordStates(states)
    setIsColumnKeywordDialogOpen(true)
  }

  const handleColumnAddKeyword = () => {
    setColumnEditableKeywords(['', ...columnEditableKeywords])
    originalColumnKeywordsRef.current = ['', ...originalColumnKeywordsRef.current]
    setColumnKeywordStates({ ...columnKeywordStates, '': 'none' })

    setTimeout(() => {
      const menuPopover = document.querySelector('[role="menu"]')
      if (menuPopover) {
        const firstInput = menuPopover.querySelector<HTMLInputElement>('input[type="text"]')
        if (firstInput) {
          firstInput.focus()
        }
      }
    }, 10)
  }

  const handleColumnDeleteKeyword = (keyword: string) => {
    const newCases = casesData.map(item => ({
      ...item,
      keywords: item.keywords.filter(kw => kw !== keyword)
    }))
    setCasesData(newCases)

    setColumnEditableKeywords(columnEditableKeywords.filter(kw => kw !== keyword))
    const newStates = { ...columnKeywordStates }
    delete newStates[keyword]
    setColumnKeywordStates(newStates)
  }

  const handleColumnKeywordChange = (idx: number, newKeyword: string) => {
    const updated = [...columnEditableKeywords]
    const oldKeyword = updated[idx]
    updated[idx] = newKeyword
    setColumnEditableKeywords(updated)

    const newStates = { ...columnKeywordStates }
    if (oldKeyword !== newKeyword) {
      newStates[newKeyword] = newStates[oldKeyword] || 'none'
      delete newStates[oldKeyword]
      setColumnKeywordStates(newStates)
    }
  }

  const handleColumnKeywordBlur = (idx: number, newKeyword: string) => {
    const oldKeyword = originalColumnKeywordsRef.current[idx]
    if (oldKeyword !== newKeyword && oldKeyword !== '') {
      const newCases = casesData.map(item => ({
        ...item,
        keywords: item.keywords.map(kw => kw === oldKeyword ? newKeyword : kw)
      }))
      setCasesData(newCases)
      originalColumnKeywordsRef.current[idx] = newKeyword
    }
  }

  const handleColumnToggleKeyword = (keyword: string) => {
    const currentState = columnKeywordStates[keyword] || 'none'
    const newStates = { ...columnKeywordStates }

    let newState: CheckboxState
    if (currentState === 'none' || currentState === 'some') {
      newState = 'all'
    } else {
      newState = 'none'
    }
    newStates[keyword] = newState

    setColumnKeywordStates(newStates)

    const newCases = casesData.map(caseItem => {
      let newKeywords = [...(caseItem.keywords || [])]
      const hasKeyword = newKeywords.includes(keyword)

      if (newState === 'all' && !hasKeyword) {
        newKeywords.push(keyword)
      } else if (newState === 'none' && hasKeyword) {
        newKeywords = newKeywords.filter(k => k !== keyword)
      }

      return {
        ...caseItem,
        keywords: newKeywords
      }
    })

    setCasesData(newCases)
  }

  const handleOpenColumnToolDialog = () => {
    const allTools = new Map()
    casesData.forEach(item => {
      if (item.toolUse && Array.isArray(item.toolUse)) {
        item.toolUse.forEach(tool => {
          if (tool && tool.name && tool.name.trim() !== '') {
            if (!allTools.has(tool.name)) {
              allTools.set(tool.name, { name: tool.name, icon: tool.icon, type: tool.type })
            }
          }
        })
      }
    })

    const states: Record<string, CheckboxState> = {}
    Array.from(allTools.values()).forEach((tool: ToolUseItem) => {
      const casesWithTool = casesData.filter(item =>
        item.toolUse && Array.isArray(item.toolUse) && item.toolUse.some(t => t.name === tool.name)
      ).length

      if (casesWithTool === casesData.length) {
        states[tool.name] = 'all'
      } else if (casesWithTool > 0) {
        states[tool.name] = 'some'
      } else {
        states[tool.name] = 'none'
      }
    })

    setColumnEditableTools(Array.from(allTools.values()))
    setColumnToolStates(states)
    setIsColumnToolDialogOpen(true)
  }

  const handleColumnToggleTool = (toolName: string) => {
    const currentState = columnToolStates[toolName] || 'none'
    const newStates = { ...columnToolStates }

    let newState: CheckboxState
    if (currentState === 'none' || currentState === 'some') {
      newState = 'all'
    } else {
      newState = 'none'
    }
    newStates[toolName] = newState

    setColumnToolStates(newStates)

    const newCases = casesData.map(caseItem => {
      let newToolUse = [...(caseItem.toolUse || [])]
      const hasTool = newToolUse.some(t => t.name === toolName)
      const tool = columnEditableTools.find(t => t.name === toolName)

      if (newState === 'all' && !hasTool && tool) {
        newToolUse.push(tool)
      } else if (newState === 'none' && hasTool) {
        newToolUse = newToolUse.filter(t => t.name !== toolName)
      }

      return {
        ...caseItem,
        toolUse: newToolUse
      }
    })

    setCasesData(newCases)
  }

  const handleColumnDeleteTool = (toolName: string) => {
    const newCases = casesData.map(item => ({
      ...item,
      toolUse: item.toolUse.filter(t => t.name !== toolName)
    }))
    setCasesData(newCases)

    setColumnEditableTools(columnEditableTools.filter(t => t.name !== toolName))
    const newStates = { ...columnToolStates }
    delete newStates[toolName]
    setColumnToolStates(newStates)
  }

  const isCellFilled = (caseItem: DatasetCase, column: string) => {
    if (!filledCells) return false
    const originalIndex = casesData.indexOf(caseItem)
    if (!filledCells.has(originalIndex)) return false
    return filledCells.get(originalIndex)?.has(column) ?? false
  }

  const getFilledCellStyle = (caseItem: DatasetCase, column: string, isHovered = false) => {
    if (!isCellFilled(caseItem, column)) return {}

    return {
      boxShadow: `inset 0 0 0 1px ${isHovered ? 'hsl(var(--primary) / 0.6)' : 'hsl(var(--primary) / 0.35)'}`,
      borderRadius: '4px',
      outline: 'none',
      outlineOffset: '0',
    }
  }

  const sortedCasesData = [...casesData].sort((a, b) => {
    if (!sortColumn) return 0

    let aValue: string | number = '', bValue: string | number = ''

    if (sortColumn === 'rowNumber') {
      aValue = casesData.indexOf(a)
      bValue = casesData.indexOf(b)
    } else if (sortColumn === 'question') {
      aValue = a.question.toLowerCase()
      bValue = b.question.toLowerCase()
    } else if (sortColumn === 'expectedResponse') {
      aValue = a.expectedResponse.toLowerCase()
      bValue = b.expectedResponse.toLowerCase()
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  const activeCellStyle = {
    outline: '2px solid #0F6CBD',
    borderRadius: '4px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.14)',
  }

  const gridTemplate = contextAgent ? '44px 48px 2fr 2fr 1.5fr 1.2fr' : '44px 48px 2fr 2fr 1.5fr'

  return (
    <div className="overflow-hidden dataset-grid-container">
      {/* Header */}
      <div className="flex bg-[hsl(var(--surface-secondary))] h-9 items-center border-t border-[rgba(0,0,0,0.06)]" style={{ display: 'grid', gridTemplateColumns: gridTemplate, minWidth: 'auto' }}>
        {/* Checkbox Column */}
        <div
          className="flex-1 min-w-[128px] px-2 text-xs leading-4 text-[hsl(var(--text-disabled))] border-b border-[rgba(0,0,0,0.06)] h-full flex items-center box-border first:pl-3 first:border-l-0"
          style={{ flex: '0 0 44px', minWidth: '44px', maxWidth: '44px', justifyContent: 'center', alignItems: 'center', paddingLeft: '8px', paddingRight: '8px' }}
        >
          <Checkbox
            checked={someSelected ? 'mixed' : allSelected}
            onChange={(_e, data) => handleSelectAll(!!data.checked)}
          />
        </div>
        <div
          className="flex-1 min-w-[128px] px-2 text-xs leading-4 text-[hsl(var(--text-disabled))] border-b border-l border-[rgba(0,0,0,0.06)] h-full flex items-center box-border"
          style={{
            flex: '0 0 48px',
            minWidth: '48px',
            maxWidth: '48px',
            cursor: 'pointer',
            userSelect: 'none',
            justifyContent: sortColumn === 'rowNumber' ? 'flex-start' : 'center'
          }}
          onClick={() => handleSort('rowNumber')}
        >
          #
          {sortColumn === 'rowNumber' && (
            sortDirection === 'asc' ? <ArrowUp16Regular style={{ marginLeft: '4px', width: '16px', height: '16px' }} /> : <ArrowDown16Regular style={{ marginLeft: '4px', width: '16px', height: '16px' }} />
          )}
        </div>
        <div
          className="flex-1 min-w-[128px] px-2 text-xs leading-4 text-[hsl(var(--text-disabled))] border-b border-l border-[rgba(0,0,0,0.06)] h-full flex items-center box-border cursor-pointer select-none"
          style={{ minWidth: '200px' }}
          onClick={() => handleSort('question')}
        >
          Question
          {sortColumn === 'question' && (
            sortDirection === 'asc' ? <ArrowUp16Regular style={{ marginLeft: '4px' }} /> : <ArrowDown16Regular style={{ marginLeft: '4px' }} />
          )}
        </div>
        <div
          className="flex-1 min-w-[128px] px-2 text-xs leading-4 text-[hsl(var(--text-disabled))] border-b border-l border-[rgba(0,0,0,0.06)] h-full flex items-center box-border cursor-pointer select-none"
          style={{ minWidth: '200px' }}
          onClick={() => handleSort('expectedResponse')}
        >
          Expected response
          {sortColumn === 'expectedResponse' && (
            sortDirection === 'asc' ? <ArrowUp16Regular style={{ marginLeft: '4px' }} /> : <ArrowDown16Regular style={{ marginLeft: '4px' }} />
          )}
        </div>
        <div
          className="flex-1 min-w-[128px] px-2 text-xs leading-4 text-[hsl(var(--text-disabled))] border-b border-l border-[rgba(0,0,0,0.06)] h-full flex items-center box-border select-none gap-2"
          style={{ minWidth: '150px' }}
        >
          Keywords
          <Menu open={isColumnKeywordDialogOpen} onOpenChange={(e, data) => setIsColumnKeywordDialogOpen(data.open)}>
            <MenuTrigger disableButtonEnhancement>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs text-gray-600 bg-transparent border-none cursor-pointer hover:bg-gray-100"
                onClick={(e) => {
                  e.stopPropagation()
                  handleOpenColumnKeywordDialog()
                }}
              >
                <Edit20Regular />
              </button>
            </MenuTrigger>
            <MenuPopover style={{ maxHeight: '488px', overflowY: 'auto' }}>
              <MenuList>
                <MenuGroup>
                  <div style={{ position: 'sticky', top: 0, backgroundColor: 'hsl(var(--background))', zIndex: 1 }}>
                    <MenuGroupHeader>Edit keywords for all cases</MenuGroupHeader>
                    <div
                      onClick={handleColumnAddKeyword}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '6px',
                        cursor: 'pointer',
                        borderRadius: '6px',
                        transition: 'background-color 0.1s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'hsl(var(--surface-tertiary))'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }}
                    >
                      <Add20Regular style={{ width: '20px', height: '20px' }} />
                      <span style={{ paddingLeft: '2px' }}>Add keyword</span>
                    </div>
                    <MenuDivider />
                  </div>
                  {columnEditableKeywords.map((keyword, idx) => (
                    <KeywordRow
                      key={idx}
                      keyword={keyword}
                      state={(columnKeywordStates[keyword] || 'none') as CheckboxState}
                      onToggle={() => handleColumnToggleKeyword(keyword)}
                      onChange={(value) => handleColumnKeywordChange(idx, value)}
                      onBlur={(value) => handleColumnKeywordBlur(idx, value)}
                      onDelete={() => handleColumnDeleteKeyword(keyword)}
                    />
                  ))}
                </MenuGroup>
              </MenuList>
            </MenuPopover>
          </Menu>
        </div>
        {contextAgent && (
          <div
            className="flex-1 min-w-[128px] px-2 text-xs leading-4 text-[hsl(var(--text-disabled))] border-b border-l border-[rgba(0,0,0,0.06)] h-full flex items-center box-border select-none gap-2"
            style={{ minWidth: '120px' }}
          >
            Tool use
            <Menu open={isColumnToolDialogOpen} onOpenChange={(e, data) => setIsColumnToolDialogOpen(data.open)}>
            <MenuTrigger disableButtonEnhancement>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs text-gray-600 bg-transparent border-none cursor-pointer hover:bg-gray-100"
                onClick={(e) => {
                  e.stopPropagation()
                  handleOpenColumnToolDialog()
                }}
              >
                <Edit20Regular />
              </button>
            </MenuTrigger>
            <MenuPopover style={{ minWidth: '280px' }}>
              <MenuList>
                <MenuGroup>
                  <MenuGroupHeader>Select a tool or topic</MenuGroupHeader>
                  <div style={{ padding: '8px' }}>
                    <div style={{
                      display: 'flex',
                      gap: '4px',
                      backgroundColor: COLORS.bg3,
                      padding: '2px',
                      borderRadius: '12px'
                    }}>
                      <CopilotButton
                        variant="ghost"
                        size="xs"
                        onClick={() => setSelectedColumnView('tools')}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minHeight: '28px',
                          padding: '0 12px',
                          borderRadius: '12px',
                          fontSize: '14px',
                          lineHeight: '20px',
                          fontWeight: selectedColumnView === 'tools' ? 600 : 400,
                          color: COLORS.textPrimary,
                          backgroundColor: selectedColumnView === 'tools' ? COLORS.white : 'transparent',
                          boxShadow: selectedColumnView === 'tools' ? `0 1px 2px ${COLORS.shadow}` : 'none',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        Tools
                      </CopilotButton>
                      <CopilotButton
                        variant="ghost"
                        size="xs"
                        onClick={() => setSelectedColumnView('topics')}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minHeight: '28px',
                          padding: '0 12px',
                          borderRadius: '12px',
                          fontSize: '14px',
                          lineHeight: '20px',
                          fontWeight: selectedColumnView === 'topics' ? 600 : 400,
                          color: COLORS.textPrimary,
                          backgroundColor: selectedColumnView === 'topics' ? COLORS.white : 'transparent',
                          boxShadow: selectedColumnView === 'topics' ? `0 1px 2px ${COLORS.shadow}` : 'none',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        Topics
                      </CopilotButton>
                    </div>
                  </div>
                  <div style={{ padding: '0 8px 8px 8px' }}>
                    <CopilotInput
                      size="sm"
                      appearance="filled-darker"
                      contentBefore={<Search20Regular />}
                      placeholder={selectedColumnView === 'tools' ? 'Search for a tool' : 'Search for a topic'}
                      value={columnSearchQuery}
                      onChange={(e) => setColumnSearchQuery(e.target.value)}
                      style={{ width: '100%', height: '32px' }}
                    />
                  </div>
                  <MenuDivider />
                  <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {columnEditableTools
                      .filter(tool => tool.type === selectedColumnView.slice(0, -1)) // 'tools' -> 'tool', 'topics' -> 'topic'
                      .filter(tool => tool.name.toLowerCase().includes(columnSearchQuery.toLowerCase()))
                      .map((tool, idx) => (
                        <ToolRow
                          key={idx}
                          tool={tool}
                          state={(columnToolStates[tool.name] || 'none') as CheckboxState}
                          onToggle={() => handleColumnToggleTool(tool.name)}
                        />
                      ))}
                  </div>
                </MenuGroup>
              </MenuList>
            </MenuPopover>
          </Menu>
          </div>
        )}
      </div>

      {/* Rows */}
      {sortedCasesData.map((caseItem, index) => (
        <div
          key={index}
          className="flex items-stretch bg-white min-h-[48px] hover:bg-[hsl(var(--surface-tertiary))]"
          style={{
            display: 'grid',
            gridTemplateColumns: gridTemplate,
            minWidth: 'auto',
            ...(isRowExpanded(caseItem) ? { height: 'auto' } : {}),
            ...(hoveredHandle === 'top' && hoveredRowIndex === index && {
              boxShadow: 'inset 0 2px 0 0 hsl(var(--primary))',
            }),
            ...(hoveredHandle === 'bottom' && hoveredRowIndex === index && {
              boxShadow: 'inset 0 -2px 0 0 hsl(var(--primary))',
            }),
          }}
          onMouseEnter={() => setHoveredRowIndex(index)}
          onMouseLeave={() => {
            setHoveredRowIndex(null)
            setHoveredNumberCell(null)
            setHoveredHandle(null)
          }}
        >
          {/* Checkbox Column */}
          <div className="flex-1 min-w-[128px] py-3 pr-3 pl-2 text-sm leading-5 text-[hsl(var(--text-primary))] border-b border-[rgba(0,0,0,0.06)] flex items-start overflow-hidden box-border first:pl-3 first:border-l-0" style={{ flex: '0 0 44px', minWidth: '44px', maxWidth: '44px', justifyContent: 'center', alignItems: 'flex-start', padding: '8px' }}>
            <Checkbox
              checked={selectedRows.has(caseItem)}
              onChange={(_e, data) => handleRowSelect(caseItem, !!data.checked)}
            />
          </div>
          {/* Row Number Column */}
          <div
            className="flex-1 min-w-[128px] py-3 pr-3 pl-2 text-sm leading-5 text-[hsl(var(--text-primary))] border-b border-l border-[rgba(0,0,0,0.06)] flex items-start overflow-hidden box-border"
            style={{
              flex: '0 0 48px',
              minWidth: '48px',
              maxWidth: '48px',
              justifyContent: 'center',
              paddingLeft: '16px',
              paddingRight: '16px',
              position: 'relative',
              overflow: 'visible',
            }}
            onMouseEnter={() => setHoveredNumberCell(index)}
            onMouseLeave={() => {
              setHoveredNumberCell(null)
              setHoveredHandle(null)
            }}
          >
            {/* Top insert handle - positioned relative to cell, not wrapper */}
            {hoveredRowIndex === index && (
              <div
                className="absolute left-1/2 w-5 h-5 flex items-center justify-center cursor-pointer z-[100] top-0 -translate-x-1/2 -translate-y-1/2"
                onMouseEnter={() => setHoveredHandle('top')}
                onMouseLeave={() => setHoveredHandle(null)}
                onClick={() => handleInsertRow(index)}
              >
                {hoveredHandle === 'top' ? (
                  <div className="w-4 h-4 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center text-white text-[10px] font-semibold transition-all duration-150 hover:bg-[hsl(var(--brand-700))]">+</div>
                ) : hoveredNumberCell === index ? (
                  <div className="w-1.5 h-1.5 rounded-full bg-white border border-[rgba(0,0,0,0.06)] transition-all duration-150" />
                ) : (
                  <div className="w-1 h-1 rounded-full bg-[rgba(0,0,0,0.09)] transition-all duration-150" />
                )}
              </div>
            )}

            {/* Row number */}
            {casesData.indexOf(caseItem) + 1}

            {/* Bottom insert handle - positioned relative to cell, not wrapper */}
            {hoveredRowIndex === index && (
              <div
                className="absolute left-1/2 w-5 h-5 flex items-center justify-center cursor-pointer z-[100] bottom-0 -translate-x-1/2 translate-y-1/2"
                onMouseEnter={() => setHoveredHandle('bottom')}
                onMouseLeave={() => setHoveredHandle(null)}
                onClick={() => handleInsertRow(index + 1)}
              >
                {hoveredHandle === 'bottom' ? (
                  <div className="w-4 h-4 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center text-white text-[10px] font-semibold transition-all duration-150 hover:bg-[hsl(var(--brand-700))]">+</div>
                ) : hoveredNumberCell === index ? (
                  <div className="w-1.5 h-1.5 rounded-full bg-white border border-[rgba(0,0,0,0.06)] transition-all duration-150" />
                ) : (
                  <div className="w-1 h-1 rounded-full bg-[rgba(0,0,0,0.09)] transition-all duration-150" />
                )}
              </div>
            )}
          </div>

          {/* Question Column - Editable */}
          <div
            className="flex-1 min-w-[128px] py-3 pr-3 pl-2 text-sm leading-5 text-[hsl(var(--text-primary))] border-b border-l border-[rgba(0,0,0,0.06)] flex items-start overflow-hidden box-border [&:not(:has(textarea))]:hover:outline [&:not(:has(textarea))]:hover:outline-1 [&:not(:has(textarea))]:hover:outline-[rgba(0,0,0,0.14)] [&:not(:has(textarea))]:hover:-outline-offset-1 [&:not(:has(textarea))]:hover:rounded"
            style={{
              minWidth: '200px',
              alignItems: 'stretch',
              cursor: isEditing(caseItem, 'question') ? 'default' : 'pointer',
              ...(isEditing(caseItem, 'question') && {
                paddingTop: '2px',
                paddingBottom: '2px',
              }),
              ...getFilledCellStyle(caseItem, 'question', hoveredFilledCell?.caseItem === caseItem && hoveredFilledCell?.column === 'question'),
            }}
            onClick={() => !isEditing(caseItem, 'question') && handleCellClick(caseItem, 'question', caseItem.question)}
            onMouseEnter={() => isCellFilled(caseItem, 'question') && setHoveredFilledCell({ caseItem, column: 'question' })}
            onMouseLeave={() => hoveredFilledCell?.caseItem === caseItem && hoveredFilledCell?.column === 'question' && setHoveredFilledCell(null)}
          >
            {isEditing(caseItem, 'question') ? (
              <CopilotTextarea
                ref={textareaRef}
                value={editValue}
                onChange={handleTextareaChange}
                onBlur={handleCellBlur}
                onKeyDown={handleKeyDown}
                autoFocus
                style={{
                  ...activeCellStyle,
                  width: 'calc(100% + 20px)',
                  height: 'auto',
                  minHeight: '44px',
                  border: 'none',
                  marginLeft: '-6px',
                  marginRight: '-14px',
                  lineHeight: '20px',
                  padding: '12px 14px 10px 6px',
                  overflow: 'hidden',
                  boxSizing: 'border-box',
                }}
              />
            ) : (
              <div
                style={{
                  cursor: 'pointer',
                  width: '100%',
                  height: '100%',
                  display: 'block',
                  borderRadius: '4px',
                  transition: 'all 0.2s ease',
                  overflow: isRowExpanded(caseItem) ? 'visible' : 'hidden',
                  whiteSpace: isRowExpanded(caseItem) ? 'normal' : 'nowrap',
                  textOverflow: isRowExpanded(caseItem) ? 'clip' : 'ellipsis',
                }}
                title={caseItem.question}
              >
                {caseItem.question}
              </div>
            )}
          </div>

          {/* Expected Response Column - Editable */}
          <div
            className="flex-1 min-w-[128px] py-3 pr-3 pl-2 text-sm leading-5 text-[hsl(var(--text-primary))] border-b border-l border-[rgba(0,0,0,0.06)] flex items-start overflow-hidden box-border [&:not(:has(textarea))]:hover:outline [&:not(:has(textarea))]:hover:outline-1 [&:not(:has(textarea))]:hover:outline-[rgba(0,0,0,0.14)] [&:not(:has(textarea))]:hover:-outline-offset-1 [&:not(:has(textarea))]:hover:rounded"
            style={{
              minWidth: '200px',
              alignItems: 'stretch',
              cursor: isEditing(caseItem, 'expectedResponse') ? 'default' : 'pointer',
              ...(isEditing(caseItem, 'expectedResponse') && {
                paddingTop: '2px',
                paddingBottom: '2px',
              }),
              ...getFilledCellStyle(caseItem, 'expectedResponse', hoveredFilledCell?.caseItem === caseItem && hoveredFilledCell?.column === 'expectedResponse'),
            }}
            onClick={() => !isEditing(caseItem, 'expectedResponse') && handleCellClick(caseItem, 'expectedResponse', caseItem.expectedResponse)}
            onMouseEnter={() => isCellFilled(caseItem, 'expectedResponse') && setHoveredFilledCell({ caseItem, column: 'expectedResponse' })}
            onMouseLeave={() => hoveredFilledCell?.caseItem === caseItem && hoveredFilledCell?.column === 'expectedResponse' && setHoveredFilledCell(null)}
          >
            {isEditing(caseItem, 'expectedResponse') ? (
              <CopilotTextarea
                ref={textareaRef}
                value={editValue}
                onChange={handleTextareaChange}
                onBlur={handleCellBlur}
                onKeyDown={handleKeyDown}
                autoFocus
                style={{
                  ...activeCellStyle,
                  width: 'calc(100% + 20px)',
                  height: 'auto',
                  minHeight: '44px',
                  border: 'none',
                  marginLeft: '-6px',
                  marginRight: '-14px',
                  lineHeight: '20px',
                  padding: '12px 14px 10px 6px',
                  overflow: 'hidden',
                  boxSizing: 'border-box',
                }}
              />
            ) : (
              <div
                style={{
                  cursor: 'pointer',
                  width: '100%',
                  height: '100%',
                  display: 'block',
                  borderRadius: '4px',
                  transition: 'all 0.2s ease',
                  overflow: isRowExpanded(caseItem) ? 'visible' : 'hidden',
                  whiteSpace: isRowExpanded(caseItem) ? 'normal' : 'nowrap',
                  textOverflow: isRowExpanded(caseItem) ? 'clip' : 'ellipsis',
                }}
                title={caseItem.expectedResponse}
              >
                {!caseItem.expectedResponse && fillingRows && fillingRows.has(casesData.indexOf(caseItem)) ? (
                  <div className="animate-pulse bg-gray-200 rounded" style={{ height: '16px', width: '100%' }} />
                ) : (
                  caseItem.expectedResponse
                )}
              </div>
            )}
          </div>

          {/* Keywords Column */}
          <div
            className="flex-1 min-w-[128px] py-3 pr-3 pl-2 text-sm leading-5 text-[hsl(var(--text-primary))] border-b border-l border-[rgba(0,0,0,0.06)] flex items-start overflow-hidden box-border hover:outline hover:outline-1 hover:outline-[rgba(0,0,0,0.14)] hover:-outline-offset-1 hover:rounded"
            style={{
              minWidth: '150px',
              overflow: isRowExpanded(caseItem) ? 'visible' : 'hidden',
              padding: '12px 16px 12px 8px',
              cursor: 'pointer',
              position: 'relative',
              ...getFilledCellStyle(caseItem, 'keywords', hoveredFilledCell?.caseItem === caseItem && hoveredFilledCell?.column === 'keywords'),
            }}
            onMouseEnter={() => isCellFilled(caseItem, 'keywords') && setHoveredFilledCell({ caseItem, column: 'keywords' })}
            onMouseLeave={() => hoveredFilledCell?.caseItem === caseItem && hoveredFilledCell?.column === 'keywords' && setHoveredFilledCell(null)}
            onClick={() => {
              const originalIndex = casesData.indexOf(caseItem)
              if (filledCells && filledCells.has(originalIndex)) {
                const fields = filledCells.get(originalIndex)
                if (fields?.has('keywords')) {
                  const newFilledCells = new Map(filledCells)
                  const updatedFields = new Set(fields)
                  updatedFields.delete('keywords')

                  if (updatedFields.size === 0) {
                    newFilledCells.delete(originalIndex)
                  } else {
                    newFilledCells.set(originalIndex, updatedFields)
                  }

                  setFilledCells(newFilledCells)
                }
              }
            }}
          >
            <KeywordsCell
              keywords={caseItem.keywords}
              caseItem={caseItem}
              casesData={casesData}
              setCasesData={setCasesData}
              index={index}
              setIsColumnKeywordDialogOpen={setIsColumnKeywordDialogOpen}
              isRowEditing={isRowExpanded(caseItem)}
              isFilling={isFilling}
              fillingRows={fillingRows}
            />
          </div>

          {/* Tool Use Column */}
          {contextAgent && (
            <div
              className="flex-1 min-w-[128px] py-3 pr-3 pl-2 text-sm leading-5 text-[hsl(var(--text-primary))] border-b border-l border-[rgba(0,0,0,0.06)] flex items-start overflow-hidden box-border hover:outline hover:outline-1 hover:outline-[rgba(0,0,0,0.14)] hover:-outline-offset-1 hover:rounded"
              style={{
                minWidth: '120px',
                overflow: isRowExpanded(caseItem) ? 'visible' : 'hidden',
                padding: '12px 16px 12px 8px',
                cursor: 'pointer',
                position: 'relative',
                ...getFilledCellStyle(caseItem, 'toolUse', hoveredFilledCell?.caseItem === caseItem && hoveredFilledCell?.column === 'toolUse'),
              }}
              onMouseEnter={() => isCellFilled(caseItem, 'toolUse') && setHoveredFilledCell({ caseItem, column: 'toolUse' })}
              onMouseLeave={() => hoveredFilledCell?.caseItem === caseItem && hoveredFilledCell?.column === 'toolUse' && setHoveredFilledCell(null)}
              onClick={() => {
                const originalIndex = casesData.indexOf(caseItem)
                if (filledCells && filledCells.has(originalIndex)) {
                  const fields = filledCells.get(originalIndex)
                  if (fields?.has('toolUse')) {
                    const newFilledCells = new Map(filledCells)
                    const updatedFields = new Set(fields)
                    updatedFields.delete('toolUse')

                    if (updatedFields.size === 0) {
                      newFilledCells.delete(originalIndex)
                    } else {
                      newFilledCells.set(originalIndex, updatedFields)
                    }

                    setFilledCells(newFilledCells)
                  }
                }
              }}
            >
              <ToolUseCell
                tools={caseItem.toolUse || []}
                caseItem={caseItem}
                casesData={casesData}
                setCasesData={setCasesData}
                index={index}
                isRowEditing={isRowExpanded(caseItem)}
                isFilling={isFilling}
                fillingRows={fillingRows}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export { ToolUseCell, KeywordsCell, KeywordRow, ToolRow }
export default AgentSingleResponseGrid
