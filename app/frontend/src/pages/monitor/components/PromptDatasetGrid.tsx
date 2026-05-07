import React, { useState, useRef, useEffect } from 'react'
import {
  Checkbox,
} from '@fluentui/react-components'
import { CopilotTextarea } from '../../../components/ui/CopilotTextarea'
import {
  Add20Regular,
  ArrowUp16Filled,
  ArrowDown16Filled,
  ArrowUp16Regular,
  ArrowDown16Regular,
} from '@fluentui/react-icons'
import type { PromptDatasetCase } from '../types'

interface PromptDatasetGridProps {
  cases: PromptDatasetCase[]
  setCasesData: (cases: PromptDatasetCase[]) => void
  selectedRows: Set<PromptDatasetCase>
  setSelectedRows: (rows: Set<PromptDatasetCase>) => void
  isFilling: boolean
  fillingRows: Set<number>
  filledCells: Map<number, Set<string>>
  setFilledCells: (cells: Map<number, Set<string>>) => void
  rowHeight: string
}

function PromptDatasetGrid({ cases: casesData, setCasesData, selectedRows, setSelectedRows, isFilling, fillingRows, filledCells, setFilledCells, rowHeight }: PromptDatasetGridProps) {
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<string>('asc')
  const [hoveredFilledCell, setHoveredFilledCell] = useState<{ caseItem: PromptDatasetCase; column: string } | null>(null)

  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null) // Any cell in this row is hovered
  const [hoveredNumberCell, setHoveredNumberCell] = useState<number | null>(null) // The # cell itself is hovered
  const [hoveredHandle, setHoveredHandle] = useState<string | null>(null) // 'top' or 'bottom' handle is hovered

  const [editingCell, setEditingCell] = useState<{ rowIndex: number; column: string } | null>(null)
  const [editValue, setEditValue] = useState<any>('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const firstCase = casesData[0]
  const inputKeys = firstCase ? Object.keys(firstCase.inputs) : []

  /**
   * Start editing a cell
   * @param {number} rowIndex - Index in casesData array
   * @param {string} column - Column name (input key or 'expectedResponse')
   * @param {*} currentValue - Current cell value
   */
  const handleStartEdit = (rowIndex: number, column: string, currentValue: any) => {
    setEditingCell({ rowIndex, column })
    setEditValue(currentValue || (Array.isArray(currentValue) ? [] : ''))
  }

  /**
   * Save the edit with delay to allow smooth cell transitions
   */
  const handleSaveEdit = () => {
    if (!editingCell) return

    blurTimeoutRef.current = setTimeout(() => {
      if (!editingCell) return

      const { rowIndex, column } = editingCell
      const newData = [...casesData]
      const caseItem = newData[rowIndex]

      if (column === 'expectedResponse') {
        newData[rowIndex] = {
          ...caseItem,
          expectedResponse: editValue
        }
      } else {
        newData[rowIndex] = {
          ...caseItem,
          inputs: {
            ...caseItem.inputs,
            [column]: editValue
          }
        }
      }

      setCasesData(newData)
      setEditingCell(null)
      setEditValue('')
    }, 150)
  }

  /**
   * Cancel editing
   */
  const handleCancelEdit = () => {
    setEditingCell(null)
    setEditValue('')
  }

  /**
   * Auto-resize textarea using scrollHeight
   */
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value

    if (editingCell) {
      const { rowIndex, column } = editingCell
      const caseItem = casesData[rowIndex]
      const currentValue = column === 'expectedResponse' ? caseItem.expectedResponse : caseItem.inputs[column]

      if (Array.isArray(currentValue)) {
        setEditValue(val.split(',').map(s => s.trim()).filter(Boolean))
      } else {
        setEditValue(val)
      }
    }

    e.target.style.height = 'auto'
    e.target.style.height = e.target.scrollHeight + 'px'
  }

  /**
   * Set initial textarea height when entering edit mode
   */
  useEffect(() => {
    if (textareaRef.current && editingCell) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [editingCell])

  /**
   * Check if a cell is currently being edited
   */
  const isCellEditing = (rowIndex: number, column: string) => {
    return editingCell &&
           editingCell.rowIndex === rowIndex &&
           editingCell.column === column
  }

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const sortedCases = [...casesData].sort((a, b) => {
    if (!sortColumn) return 0

    let aValue, bValue

    if (sortColumn === 'rowNumber') {
      aValue = casesData.indexOf(a)
      bValue = casesData.indexOf(b)
    } else if (sortColumn === 'expectedResponse') {
      aValue = a.expectedResponse || ''
      bValue = b.expectedResponse || ''
    } else {
      aValue = a.inputs[sortColumn] || ''
      bValue = b.inputs[sortColumn] || ''

      if (Array.isArray(aValue)) aValue = aValue.join(', ')
      if (Array.isArray(bValue)) bValue = bValue.join(', ')
    }

    if (typeof aValue === 'string') aValue = aValue.toLowerCase()
    if (typeof bValue === 'string') bValue = bValue.toLowerCase()

    if (sortDirection === 'asc') {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
    }
  })

  const handleRowSelect = (caseItem: PromptDatasetCase) => {
    const newSelected = new Set(selectedRows)
    if (newSelected.has(caseItem)) {
      newSelected.delete(caseItem)
    } else {
      newSelected.add(caseItem)
    }
    setSelectedRows(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedRows.size === casesData.length) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(casesData))
    }
  }

  const handleInsertRow = (insertIndex: number) => {
    const newCase = {
      inputs: Object.fromEntries(inputKeys.map(key => [key, ''])),
      expectedResponse: ''
    }

    const newCases = [...casesData]
    newCases.splice(insertIndex, 0, newCase)
    setCasesData(newCases)

    if (inputKeys.length > 0) {
      setTimeout(() => {
        setEditingCell({ rowIndex: insertIndex, column: inputKeys[0] })
        setEditValue('')
      }, 50)
    }
  }

  const isCellFilled = (caseItem: PromptDatasetCase, column: string) => {
    const caseIndex = casesData.indexOf(caseItem)
    if (filledCells && filledCells.has(caseIndex)) {
      const fields = filledCells.get(caseIndex)
      return fields?.has(column) ?? false
    }
    return false
  }

  const renderCellContent = (value: any) => {
    if (Array.isArray(value)) {
      return value.join(', ')
    }
    return value || ''
  }

  const rowHeightConfigs = {
    Short: { minHeight: '44px', padding: '8px 12px' },
    Medium: { minHeight: '60px', padding: '12px 12px' },
    Tall: { minHeight: '80px', padding: '16px 12px' }
  }

  const currentRowConfig = rowHeightConfigs[rowHeight as keyof typeof rowHeightConfigs] || rowHeightConfigs.Short

  const getFilledCellStyle = (caseItem: PromptDatasetCase, column: string, isHovered = false) => {
    if (!isCellFilled(caseItem, column)) return {}

    return {
      boxShadow: `inset 0 0 0 1px ${isHovered ? '#a3b1ff' : '#c8cdff'}`,
      borderRadius: '4px',
      outline: 'none',
      outlineOffset: '0',
    }
  }

  const activeCellStyle = {
    outline: '2px solid #0F6CBD',
    borderRadius: '4px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.14)',
  }

  const isEditing = (caseItem: PromptDatasetCase, column: string) => {
    const index = casesData.indexOf(caseItem)
    return editingCell?.rowIndex === index && editingCell?.column === column
  }

  const isRowEditing = (caseItem: PromptDatasetCase) => {
    const index = casesData.indexOf(caseItem)
    return editingCell?.rowIndex === index
  }

  const isRowExpanded = (caseItem: PromptDatasetCase) => {
    return rowHeight === 'Tall' || isRowEditing(caseItem)
  }

  const inputColumnWidths = inputKeys.map(() => '2fr').join(' ')
  const gridTemplate = `44px 48px ${inputColumnWidths} 2fr`

  const handleCellClick = (caseItem: PromptDatasetCase, column: string, currentValue: any) => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current)
      blurTimeoutRef.current = null
    }

    const rowIndex = casesData.indexOf(caseItem)
    handleStartEdit(rowIndex, column, currentValue)
  }

  return (
    <div className="overflow-hidden dataset-grid-container">
      {/* Header Row */}
      <div
        className="flex bg-[hsl(var(--surface-secondary))] h-9 items-center border-t border-[rgba(0,0,0,0.06)]"
        style={{
          display: 'grid',
          gridTemplateColumns: gridTemplate,
          minWidth: 'auto'
        }}
      >
        <div
          className="flex-1 min-w-[128px] px-2 text-xs leading-4 text-[hsl(var(--text-disabled))] border-b border-[rgba(0,0,0,0.06)] h-full flex items-center box-border first:pl-3 first:border-l-0"
          style={{ flex: '0 0 44px', minWidth: '44px', maxWidth: '44px', justifyContent: 'center', alignItems: 'center', paddingLeft: '8px', paddingRight: '8px' }}
        >
          <Checkbox
            checked={selectedRows.size === casesData.length && casesData.length > 0}
            onChange={handleSelectAll}
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
        </div>
        {inputKeys.map((key) => (
          <div
            key={key}
            className="flex-1 min-w-[128px] px-2 text-xs leading-4 text-[hsl(var(--text-disabled))] border-b border-l border-[rgba(0,0,0,0.06)] h-full flex items-center box-border cursor-pointer select-none"
            onClick={() => handleSort(key)}
            style={{ minWidth: '200px' }}
          >
            {key.charAt(0).toUpperCase() + key.slice(1)}
            {sortColumn === key && (
              sortDirection === 'asc' ? <ArrowUp16Regular style={{ marginLeft: '4px' }} /> : <ArrowDown16Regular style={{ marginLeft: '4px' }} />
            )}
          </div>
        ))}
        <div
          className="flex-1 min-w-[128px] px-2 text-xs leading-4 text-[hsl(var(--text-disabled))] border-b border-l border-[rgba(0,0,0,0.06)] h-full flex items-center box-border cursor-pointer select-none"
          onClick={() => handleSort('expectedResponse')}
          style={{ minWidth: '200px' }}
        >
          Expected response
          {sortColumn === 'expectedResponse' && (
            sortDirection === 'asc' ? <ArrowUp16Regular style={{ marginLeft: '4px' }} /> : <ArrowDown16Regular style={{ marginLeft: '4px' }} />
          )}
        </div>
      </div>

      {/* Data Rows */}
      {sortedCases.map((caseItem, idx) => {
        const rowIndex = casesData.indexOf(caseItem)
        const isRowFilling = isFilling && fillingRows.has(rowIndex)

        return (
          <div
            key={rowIndex}
            className="flex items-stretch bg-white min-h-[48px] hover:bg-[hsl(var(--surface-secondary))]"
            style={{
              display: 'grid',
              gridTemplateColumns: gridTemplate,
              minWidth: 'auto',
              ...(isRowExpanded(caseItem) ? { height: 'auto' } : {}),
              ...(hoveredHandle === 'top' && hoveredRowIndex === rowIndex && {
                boxShadow: 'inset 0 2px 0 0 hsl(var(--primary))',
              }),
              ...(hoveredHandle === 'bottom' && hoveredRowIndex === rowIndex && {
                boxShadow: 'inset 0 -2px 0 0 hsl(var(--primary))',
              }),
            }}
            onMouseEnter={() => setHoveredRowIndex(rowIndex)}
            onMouseLeave={() => {
              setHoveredRowIndex(null)
              setHoveredNumberCell(null)
              setHoveredHandle(null)
            }}
          >
            {/* Checkbox */}
            <div className="flex-1 min-w-[128px] py-3 pr-3 pl-2 text-sm leading-5 text-[hsl(var(--text-primary))] border-b border-[rgba(0,0,0,0.06)] flex items-start overflow-hidden box-border first:pl-3 first:border-l-0" style={{ flex: '0 0 44px', minWidth: '44px', maxWidth: '44px', justifyContent: 'center', alignItems: 'flex-start', padding: '8px' }}>
              <Checkbox
                checked={selectedRows.has(caseItem)}
                onChange={() => handleRowSelect(caseItem)}
              />
            </div>

            {/* Row Number */}
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
              onMouseEnter={() => setHoveredNumberCell(rowIndex)}
              onMouseLeave={() => {
                setHoveredNumberCell(null)
                setHoveredHandle(null)
              }}
            >
              {/* Top insert handle */}
              {hoveredRowIndex === rowIndex && (
                <div
                  className="absolute left-1/2 w-5 h-5 flex items-center justify-center cursor-pointer z-[100] top-0 -translate-x-1/2 -translate-y-1/2"
                  onMouseEnter={() => setHoveredHandle('top')}
                  onMouseLeave={() => setHoveredHandle(null)}
                  onClick={() => handleInsertRow(rowIndex)}
                >
                  {hoveredHandle === 'top' ? (
                    <div className="w-4 h-4 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center text-white text-[10px] font-semibold transition-all duration-150 hover:bg-[hsl(var(--brand-700))]">+</div>
                  ) : hoveredNumberCell === rowIndex ? (
                    <div className="w-1.5 h-1.5 rounded-full bg-white border border-[rgba(0,0,0,0.06)] transition-all duration-150" />
                  ) : (
                    <div className="w-1 h-1 rounded-full bg-[rgba(0,0,0,0.09)] transition-all duration-150" />
                  )}
                </div>
              )}

              {/* Row number */}
              {rowIndex + 1}

              {/* Bottom insert handle */}
              {hoveredRowIndex === rowIndex && (
                <div
                  className="absolute left-1/2 w-5 h-5 flex items-center justify-center cursor-pointer z-[100] bottom-0 -translate-x-1/2 translate-y-1/2"
                  onMouseEnter={() => setHoveredHandle('bottom')}
                  onMouseLeave={() => setHoveredHandle(null)}
                  onClick={() => handleInsertRow(rowIndex + 1)}
                >
                  {hoveredHandle === 'bottom' ? (
                    <div className="w-4 h-4 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center text-white text-[10px] font-semibold transition-all duration-150 hover:bg-[hsl(var(--brand-700))]">+</div>
                  ) : hoveredNumberCell === rowIndex ? (
                    <div className="w-1.5 h-1.5 rounded-full bg-white border border-[rgba(0,0,0,0.06)] transition-all duration-150" />
                  ) : (
                    <div className="w-1 h-1 rounded-full bg-[rgba(0,0,0,0.09)] transition-all duration-150" />
                  )}
                </div>
              )}
            </div>

            {/* Input Columns */}
            {inputKeys.map((key) => {
              const currentValue = caseItem.inputs[key]
              const editing = isEditing(caseItem, key)
              const filled = isCellFilled(caseItem, key)

              return (
                <div
                  key={key}
                  className="flex-1 min-w-[128px] py-3 pr-3 pl-2 text-sm leading-5 text-[hsl(var(--text-primary))] border-b border-l border-[rgba(0,0,0,0.06)] flex items-start overflow-hidden box-border [&:not(:has(textarea))]:hover:outline [&:not(:has(textarea))]:hover:outline-1 [&:not(:has(textarea))]:hover:outline-[rgba(0,0,0,0.14)] [&:not(:has(textarea))]:hover:-outline-offset-1 [&:not(:has(textarea))]:hover:rounded"
                  onClick={() => !editing && handleCellClick(caseItem, key, currentValue)}
                  onMouseEnter={() => filled && setHoveredFilledCell({ caseItem, column: key })}
                  onMouseLeave={() => setHoveredFilledCell(null)}
                  style={{
                    minWidth: '200px',
                    alignItems: 'stretch',
                    cursor: editing ? 'default' : 'pointer',
                    ...(editing && {
                      paddingTop: '2px',
                      paddingBottom: '2px',
                    }),
                    ...getFilledCellStyle(
                      caseItem,
                      key,
                      hoveredFilledCell?.caseItem === caseItem &&
                        hoveredFilledCell?.column === key
                    ),
                  }}
                >
                  {editing ? (
                    <CopilotTextarea
                      ref={textareaRef}
                      value={Array.isArray(editValue) ? editValue.join(', ') : editValue}
                      onChange={handleTextareaChange}
                      onBlur={handleSaveEdit}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          e.preventDefault()
                          handleCancelEdit()
                        }
                      }}
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
                      title={renderCellContent(currentValue)}
                    >
                      {renderCellContent(currentValue)}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Expected Response Column */}
            {(() => {
              const currentValue = caseItem.expectedResponse
              const editing = isEditing(caseItem, 'expectedResponse')
              const filled = isCellFilled(caseItem, 'expectedResponse')

              return (
                <div
                  className="flex-1 min-w-[128px] py-3 pr-3 pl-2 text-sm leading-5 text-[hsl(var(--text-primary))] border-b border-l border-[rgba(0,0,0,0.06)] flex items-start overflow-hidden box-border [&:not(:has(textarea))]:hover:outline [&:not(:has(textarea))]:hover:outline-1 [&:not(:has(textarea))]:hover:outline-[rgba(0,0,0,0.14)] [&:not(:has(textarea))]:hover:-outline-offset-1 [&:not(:has(textarea))]:hover:rounded"
                  onClick={() =>
                    !editing && handleCellClick(caseItem, 'expectedResponse', currentValue)
                  }
                  onMouseEnter={() =>
                    filled && setHoveredFilledCell({ caseItem, column: 'expectedResponse' })
                  }
                  onMouseLeave={() => setHoveredFilledCell(null)}
                  style={{
                    minWidth: '200px',
                    alignItems: 'stretch',
                    cursor: editing ? 'default' : 'pointer',
                    ...(editing && {
                      paddingTop: '2px',
                      paddingBottom: '2px',
                    }),
                    ...getFilledCellStyle(
                      caseItem,
                      'expectedResponse',
                      hoveredFilledCell?.caseItem === caseItem &&
                        hoveredFilledCell?.column === 'expectedResponse'
                    ),
                  }}
                >
                  {editing ? (
                    <CopilotTextarea
                      ref={textareaRef}
                      value={editValue || ''}
                      onChange={handleTextareaChange}
                      onBlur={handleSaveEdit}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          e.preventDefault()
                          handleCancelEdit()
                        }
                      }}
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
                      title={currentValue || ''}
                    >
                      {currentValue || ''}
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        )
      })}
    </div>
  )
}

export default PromptDatasetGrid
