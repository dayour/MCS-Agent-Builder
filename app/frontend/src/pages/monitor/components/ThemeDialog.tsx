import React, { useState } from 'react'
import { Dismiss12Regular } from '@fluentui/react-icons'
import { Dialog, DialogHeader, DialogContent, DialogFooter, DialogTitle } from '../../../components/ui/Dialog'
import { CopilotButton } from '../../../components/ui/CopilotButton'
import { CopilotInput } from '../../../components/ui/CopilotInput'
import { CopilotTextarea } from '../../../components/ui/CopilotTextarea'
import { COLORS } from '../constants'

interface ThemeDialogProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  name: string
  setName: (name: string) => void
  description: string
  setDescription: (desc: string) => void
  categories: string[]
  setCategories: (cats: string[]) => void
  allExistingCategories: string[]
  onSave: () => void
  saveLabel?: string
}

export default function ThemeDialog({
  open,
  onClose,
  title,
  subtitle,
  name,
  setName,
  description,
  setDescription,
  categories,
  setCategories,
  allExistingCategories,
  onSave,
  saveLabel = 'Create',
}: ThemeDialogProps) {
  const [categoryInput, setCategoryInput] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)

  return (
    <Dialog isOpen={open} onClose={onClose} maxWidth="md">
      <DialogHeader onClose={onClose}>
        <div>
          <DialogTitle>{title}</DialogTitle>
          {subtitle && <p className="text-xs text-text-secondary mt-0.5">{subtitle}</p>}
        </div>
      </DialogHeader>
      <DialogContent>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'visible' }}>
          <CopilotInput
            label="Theme name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter theme name"
          />
          <CopilotTextarea
            label="Description"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A precise and comprehensive description is important, as it directly impacts the ability to correctly classify user questions under this theme"
            rows={3}
          />
          <div style={{ position: 'relative' }}>
            <CopilotInput
              label="Category (optional)"
              value={categoryInput}
              onChange={(e) => setCategoryInput(e.target.value)}
              onFocus={() => setDropdownOpen(true)}
              onBlur={() => setDropdownOpen(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const trimmed = categoryInput.trim()
                  if (trimmed) {
                    setCategories([trimmed])
                    setCategoryInput('')
                    setDropdownOpen(false)
                  }
                }
                if (e.key === 'Backspace' && !categoryInput && categories.length > 0) {
                  setCategories([])
                }
              }}
              placeholder={categories.length === 0 ? 'Type to search or add a category' : ''}
              contentBefore={categories.length > 0 ? (
                <span className="inline-flex items-center gap-1 h-5 px-2 rounded-md border border-[rgba(0,0,0,0.06)] text-[11px] text-gray-500 whitespace-nowrap">
                  {categories[0]}
                  <CopilotButton
                    variant="ghost"
                    size="xs"
                    icon={<Dismiss12Regular style={{ width: '12px', height: '12px' }} />}
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); setCategories([]) }}
                    onMouseDown={(e) => { e.stopPropagation(); e.preventDefault() }}
                    aria-label="Remove category"
                    className="p-0.5 rounded-full"
                  />
                </span>
              ) : undefined}
            />
            {dropdownOpen && (() => {
              const filtered = allExistingCategories
                .filter(cat => !categories.includes(cat))
                .filter(cat => !categoryInput || cat.toLowerCase().includes(categoryInput.toLowerCase()))
              if (filtered.length === 0) return null
              return (
                <div className="absolute left-0 right-0 bg-white border border-[rgba(0,0,0,0.06)] rounded-lg z-10 max-h-40 overflow-y-auto"
                  style={{ top: '100%', marginTop: '4px', boxShadow: `0 4px 12px ${COLORS.shadow}` }}>
                  {filtered.map((cat, i) => (
                    <div
                      key={i}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        setCategories([cat])
                        setCategoryInput('')
                      }}
                      className="px-3 py-2 cursor-pointer text-xs text-gray-600 hover:bg-gray-50"
                    >
                      {cat}
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        </div>
      </DialogContent>
      <DialogFooter>
        <CopilotButton
          variant="primary"
          size="md"
          onClick={onSave}
          disabled={!name.trim() || !description.trim()}
        >{saveLabel}</CopilotButton>
      </DialogFooter>
    </Dialog>
  )
}
