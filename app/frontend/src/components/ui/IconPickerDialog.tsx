import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { SquircleIcon } from './SquircleIcon';
import { Dialog } from './Dialog';
import { CopilotButton } from './CopilotButton';
import {
  domainIconMap,
  templateIconMap,
  domainMeta,
  gradientPalette,
  getAgentIcon,
  getGradientByKey,
} from '../../utils/agentIcons';
import { SYSTEM_COLOR_ICONS } from '../../utils/systemColorIcons';
import { generateIcon } from '../../utils/iconGenerator';
import {
  Dismiss20Regular,
  Sparkle20Regular,
  ImageAdd20Regular,
  Color20Regular,
  ImageSparkle20Regular,
  ArrowUp20Filled,
} from '@fluentui/react-icons';

type Tab = 'generate' | 'browse' | 'upload';
type BrowseSubTab = 'filled' | 'colored';

interface IconPickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentIconKey: string;
  currentGradientKey: string;
  onSelect: (iconKey: string, gradientKey: string, imageData?: string) => void;
  /** Optional: used for "Generate from agent details" */
  agentName?: string;
  agentDescription?: string;
  /** Optional: current custom icon image (generated or uploaded) */
  currentImageData?: string;
}

export const IconPickerDialog: React.FC<IconPickerDialogProps> = ({
  isOpen,
  onClose,
  currentIconKey,
  currentGradientKey,
  onSelect,
  agentName,
  agentDescription,
  currentImageData,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('browse');
  const [browseSubTab, setBrowseSubTab] = useState<BrowseSubTab>('colored');
  const [selectedIconKey, setSelectedIconKey] = useState(currentIconKey);
  const [selectedGradientKey, setSelectedGradientKey] = useState(currentGradientKey);

  // Generate tab state
  const [generatePrompt, setGeneratePrompt] = useState('');
  const [isGeneratingDetails, setIsGeneratingDetails] = useState(false);
  const [isGeneratingDescribe, setIsGeneratingDescribe] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generatedSvgs, setGeneratedSvgs] = useState<string[]>([]);
  const [selectedGeneratedIndex, setSelectedGeneratedIndex] = useState<number>(0);
  const isGenerating = isGeneratingDetails || isGeneratingDescribe;

  // Upload tab state
  const [uploadedImageData, setUploadedImageData] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showAccentColorPicker, setShowAccentColorPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ref for scrolling to selected icon
  const selectedIconRef = useRef<HTMLButtonElement>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      // Strip syscolor: prefix if present
      const cleanKey = currentIconKey?.startsWith('syscolor:') ? currentIconKey.slice(9) : (currentIconKey || '');
      setSelectedIconKey(cleanKey);
      setSelectedGradientKey(currentGradientKey);
      setActiveTab('browse');
      // Auto-select correct sub-tab based on current icon
      const isCurrentColored = SYSTEM_COLOR_ICONS.some(i => i.key === cleanKey);
      setBrowseSubTab(isCurrentColored ? 'colored' : 'filled');
      setGeneratePrompt('');
      setIsGeneratingDetails(false); setIsGeneratingDescribe(false);
      setHasGenerated(false);
      setGeneratedSvgs([]);
      setSelectedGeneratedIndex(0);
      setGenerateError(null);
      setUploadedImageData(null);
      setIsDragOver(false);
      setShowAccentColorPicker(false);
    }
  }, [isOpen, currentIconKey, currentGradientKey]);

  // Scroll selected icon into view without animation when dialog opens
  useEffect(() => {
    if (isOpen) {
      // Wait for state update + re-render before scrolling
      const timer = setTimeout(() => {
        const el = selectedIconRef.current;
        if (!el) return;
        const container = el.closest('.overflow-y-auto');
        if (container) {
          const elRect = el.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          const offset = elRect.top - containerRect.top - containerRect.height / 2 + elRect.height / 2;
          container.scrollTop += offset;
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, browseSubTab]);

  // Build unified icon list
  const allIcons = useMemo(() => {
    const icons: { key: string; label: string; type: 'domain' | 'template' }[] = [];
    Object.keys(domainIconMap).forEach(key => {
      const meta = domainMeta.find(m => m.domain === key);
      icons.push({ key, label: meta?.label || key, type: 'domain' });
    });
    Object.entries(templateIconMap).forEach(([key, value]) => {
      icons.push({ key: `tpl:${key}`, label: value.label, type: 'template' });
    });
    return icons;
  }, []);

  const handleApply = () => {
    if (activeTab === 'generate' && generatedSvgs.length > 0) {
      const selected = generatedSvgs[selectedGeneratedIndex];
      if (selected) {
        onSelect(selectedIconKey, selectedGradientKey, selected);
      }
    } else if (activeTab === 'upload' && uploadedImageData) {
      onSelect(selectedIconKey, selectedGradientKey, uploadedImageData);
    } else if (isColoredIcon) {
      onSelect(`syscolor:${selectedIconKey}`, selectedGradientKey);
    } else {
      onSelect(selectedIconKey, selectedGradientKey);
    }
    onClose();
  };

  const isApplyEnabled =
    activeTab === 'browse' ||
    (activeTab === 'generate' && generatedSvgs.length > 0) ||
    (activeTab === 'upload' && !!uploadedImageData);

  // AI icon generation — generates colored SVGs on the fly

  // Generate a single colored SVG from a prompt
  const runGenerate = async (prompt: string, setter: (v: boolean) => void) => {
    setter(true);
    setGeneratedSvgs([]);
    setSelectedGeneratedIndex(0);
    setGenerateError(null);
    try {
      const dataUrl = await generateIcon(prompt);
      if (dataUrl) {
        setGeneratedSvgs([dataUrl]);
        setSelectedGeneratedIndex(0);
        setHasGenerated(true);
      } else {
        setGenerateError('No icon was generated. Try a different description.');
      }
    } catch {
      setGenerateError('Could not generate icon. Check your API key in Settings.');
    } finally {
      setter(false);
    }
  };

  const handleGenerateFromDetails = () => {
    const prompt = [agentName, agentDescription].filter(Boolean).join(' — ') || 'workflow automation';
    if (isGenerating) return;
    runGenerate(prompt, setIsGeneratingDetails);
  };

  const handleDescribeSuggest = () => {
    if (!generatePrompt.trim() || isGenerating) return;
    runGenerate(generatePrompt, setIsGeneratingDescribe);
  };

  // File upload handling
  const handleFile = (file: File) => {
    if (!file.type.includes('png') && !file.type.includes('image')) return;
    if (file.size > 5 * 1024 * 1024) return; // 5MB max
    const reader = new FileReader();
    reader.onload = e => {
      const data = e.target?.result as string;
      if (data) setUploadedImageData(data);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  // Render grid icon (gray outline for non-selected)
  const renderGridIcon = (item: { key: string; type: 'domain' | 'template' }) => {
    if (item.type === 'template') {
      const templateKey = item.key.slice(4);
      const template = templateIconMap[templateKey];
      if (template) {
        const TemplateIcon = template.icon as React.ComponentType<any>;
        return (
          <div style={{ width: 32, height: 32, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', filter: 'brightness(0) opacity(0.4)' }}>
            <TemplateIcon width={48} height={48} style={{ flexShrink: 0 }} />
          </div>
        );
      }
    }
    const iconSet = domainIconMap[item.key] || domainIconMap['generic'];
    const IconComponent = iconSet.regular;
    return <IconComponent style={{ width: 32, height: 32, color: 'hsl(var(--text-secondary))' }} />;
  };

  const selectedGradient = getGradientByKey(selectedGradientKey);

  // Check if current selection is a system color icon
  const isColoredIcon = SYSTEM_COLOR_ICONS.some(i => i.key === selectedIconKey);

  // Preview content
  const generatedPreview = activeTab === 'generate' ? generatedSvgs[selectedGeneratedIndex] : undefined;
  const hasCustomImage = !generatedPreview && !uploadedImageData && currentImageData && !hasGenerated;
  const previewContent = generatedPreview
    ? <img src={generatedPreview} style={{ width: 72, height: 72, objectFit: 'contain' }} alt="Generated icon" />
    : activeTab === 'upload' && uploadedImageData
    ? <img src={uploadedImageData} style={{ width: 72, height: 72, objectFit: 'contain' }} alt="Custom icon" />
    : hasCustomImage
    ? <img src={currentImageData} style={{ width: 72, height: 72, objectFit: 'contain' }} alt="Current icon" />
    : isColoredIcon
    ? <img src={`${process.env.PUBLIC_URL || ''}/icons/system-color/${selectedIconKey}.svg`} style={{ width: 72, height: 72 }} alt={selectedIconKey} />
    : getAgentIcon(selectedIconKey, 72);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'generate', label: 'Generate' },
    { id: 'browse', label: 'Browse' },
    { id: 'upload', label: 'Upload' },
  ];

  const footerDisclaimers: Record<Tab, string> = {
    generate: 'AI-generated icons in the Fluent color style.',
    browse: 'Displayed icons are suggestions based on usage trends and may not fit all scenarios.',
    upload: 'Upload a new icon. The icon must be in PNG format. Images larger than 5 MB will not be accepted.',
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} maxWidth="lg">
      {/* Custom header: X close + centered pill tabs */}
      <div className="relative px-6 pt-5 pb-0 flex-shrink-0">
        {/* X close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          aria-label="Close"
        >
          <Dismiss20Regular style={{ width: 20, height: 20 }} />
        </button>

        {/* Pill segmented tabs */}
        <div className="flex justify-center">
          <div className="inline-flex rounded-full border border-gray-200 p-0.5 gap-0.5">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-1.5 rounded-full text-body-2 font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white text-[hsl(var(--primary))] shadow-sm font-semibold'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content: preview + tab body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
        {/* Large preview — always visible */}
        <div className="flex justify-center mb-5">
          <div
            className={activeTab === 'generate' && isGenerating ? 'animate-icon-reveal-pulse' : generatedPreview ? 'animate-icon-reveal' : ''}
            style={activeTab === 'generate' && isGenerating ? { filter: 'blur(8px)', opacity: 0.5, transition: 'filter 0.3s, opacity 0.3s' } : undefined}
          >
            {(isColoredIcon || hasCustomImage || generatedPreview) ? (
              <SquircleIcon size={120} cornerRadius={28} gradient="linear-gradient(138deg, #ffffff, #ffffff)" stroke="#D1D5DB" strokeWidth={1.5}>
                {previewContent}
              </SquircleIcon>
            ) : (
              <SquircleIcon size={120} cornerRadius={28} gradient={selectedGradient}>
                {previewContent}
              </SquircleIcon>
            )}
          </div>
        </div>
        <style>{`
          @keyframes iconReveal {
            from { filter: blur(12px); opacity: 0.3; transform: scale(0.95); }
            to { filter: blur(0); opacity: 1; transform: scale(1); }
          }
          @keyframes iconRevealPulse {
            0%, 100% { filter: blur(8px); opacity: 0.4; }
            50% { filter: blur(12px); opacity: 0.3; }
          }
          .animate-icon-reveal { animation: iconReveal 0.6s ease-out forwards; }
          .animate-icon-reveal-pulse { animation: iconRevealPulse 1.5s ease-in-out infinite; }
        `}</style>

        {/* ─── Generate tab ─── */}
        {activeTab === 'generate' && (
          <div className="space-y-3">
            <button
              onClick={handleGenerateFromDetails}
              disabled={isGenerating}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-left disabled:opacity-50"
            >
              {isGeneratingDetails ? (
                <Sparkle20Regular style={{ width: 20, height: 20, color: 'hsl(var(--primary))' }} className="animate-spin" />
              ) : (
                <ImageSparkle20Regular style={{ width: 20, height: 20, color: '#374151' }} />
              )}
              <span className="text-body-2 font-medium text-gray-800">
                {isGeneratingDetails ? 'Finding best icon…' : 'Generate from agent details'}
              </span>
            </button>

            <div className={`relative rounded-xl border transition-colors ${isGenerating ? 'border-gray-200 opacity-50' : 'border-gray-200 focus-within:border-[hsl(var(--primary))]'}`}>
              <textarea
                value={generatePrompt}
                onChange={e => setGeneratePrompt(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleDescribeSuggest();
                  }
                }}
                placeholder="Describe your icon…"
                rows={2}
                disabled={isGenerating}
                className="w-full rounded-xl px-4 pt-3 pb-10 text-body-2 text-gray-700 placeholder:text-gray-400 resize-none focus:outline-none bg-transparent"
              />
              {generatePrompt.trim() && !isGenerating && (
                <button
                  onClick={handleDescribeSuggest}
                  className="absolute bottom-2.5 right-3 w-8 h-8 flex items-center justify-center bg-primary text-primary-foreground rounded-full hover:bg-[hsl(var(--primary-hover))] transition-colors"
                >
                  <ArrowUp20Filled className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Error state */}
            {generateError && !isGenerating && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200">
                <span className="text-body-2 text-red-700">{generateError}</span>
              </div>
            )}

          </div>
        )}

        {/* ─── Browse tab ─── */}
        {activeTab === 'browse' && (
          <div>
            {/* Sub-tabs: Filled | Colored */}
            <div className="flex gap-6 border-b border-gray-200 mb-4">
              {([{ id: 'colored' as BrowseSubTab, label: 'Colored', icon: <Color20Regular style={{ width: 18, height: 18 }} /> },
                 { id: 'filled' as BrowseSubTab, label: 'Filled', icon: <ImageAdd20Regular style={{ width: 18, height: 18 }} /> }]).map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setBrowseSubTab(sub.id)}
                  className={`flex items-center gap-1.5 pb-2.5 text-body-2 font-medium border-b-2 transition-colors -mb-px ${
                    browseSubTab === sub.id
                      ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {sub.icon}
                  {sub.label}
                </button>
              ))}
            </div>

            {/* Fixed height content area to prevent dialog shift */}
            <div style={{ minHeight: 310 }}>
            {/* Filled: scrollable icon grid + pinned background color row */}
            {browseSubTab === 'filled' && (
              <div className="flex flex-col">
                <div className="grid grid-cols-7 gap-2 overflow-y-auto p-1 max-h-[240px]">
                  {allIcons.map(item => {
                    const isSelected = item.key === selectedIconKey;
                    return (
                      <button
                        key={item.key}
                        ref={isSelected ? selectedIconRef : undefined}
                        onClick={() => setSelectedIconKey(item.key)}
                        title={item.label}
                        className={`relative aspect-square rounded-xl flex items-center justify-center transition-all hover:bg-gray-100 ${
                          isSelected ? 'ring-2 ring-[hsl(var(--primary))] bg-[hsl(237_81%_96%)]' : ''
                        }`}
                      >
                        {renderGridIcon(item)}
                      </button>
                    );
                  })}
                </div>
                {/* Pinned background color row */}
                <div className="border-t border-gray-200 mt-3" />
                <div className="flex-shrink-0 pt-3">
                  <p className="text-xs font-medium text-gray-500 mb-2">Background color</p>
                  <div className="flex flex-wrap gap-3">
                    {gradientPalette.map(gradient => {
                      const isGradientSelected = !isColoredIcon && gradient.name.toLowerCase() === selectedGradientKey.toLowerCase();
                      return (
                        <button
                          key={`bg-${gradient.name}`}
                          onClick={() => setSelectedGradientKey(gradient.name.toLowerCase())}
                          title={gradient.name}
                          className="relative flex-shrink-0 transition-transform hover:scale-105"
                          style={{ width: 32, height: 32 }}
                        >
                          <div
                            className="w-full h-full rounded-full"
                            style={{ background: gradient.css }}
                          />
                          {isGradientSelected && (
                            <div
                              className="absolute inset-0 rounded-full"
                              style={{ boxShadow: '0 0 0 2px white, 0 0 0 3.5px #1e1e1e' }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Colored: full-color system icon grid */}
            {browseSubTab === 'colored' && (
              <div className="grid grid-cols-7 gap-2 max-h-[310px] overflow-y-auto p-1">
                {SYSTEM_COLOR_ICONS.map(icon => {
                  const isSelected = icon.key === selectedIconKey;
                  return (
                    <button
                      key={icon.key}
                      ref={isSelected ? selectedIconRef : undefined}
                      onClick={() => setSelectedIconKey(icon.key)}
                      title={icon.label}
                      className={`relative aspect-square rounded-xl flex items-center justify-center transition-all hover:bg-gray-100 ${
                        isSelected ? 'ring-2 ring-[hsl(var(--primary))] bg-[hsl(237_81%_96%)]' : ''
                      }`}
                    >
                      <img
                        src={`${process.env.PUBLIC_URL || ''}/icons/system-color/${icon.key}.svg`}
                        alt={icon.label}
                        style={{ width: 32, height: 32 }}
                        loading="lazy"
                      />
                    </button>
                  );
                })}
              </div>
            )}
            </div>
          </div>
        )}

        {/* ─── Upload tab ─── */}
        {activeTab === 'upload' && (
          <div className="space-y-4">
            {/* Accent color controls */}
            <div className="flex items-center gap-5">
              <button
                onClick={() => setShowAccentColorPicker(v => !v)}
                className="flex items-center gap-1.5 text-body-2 text-gray-700 hover:text-gray-900 transition-colors"
              >
                <Color20Regular style={{ width: 18, height: 18 }} />
                Set accent color
              </button>
              <button
                onClick={() => setSelectedGradientKey('grey')}
                className="flex items-center gap-1.5 text-body-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                Remove accent color
              </button>
            </div>

            {/* Inline accent color picker */}
            {showAccentColorPicker && (
              <div className="flex flex-wrap gap-3 py-1">
                {gradientPalette.map(gradient => {
                  const isSelected = gradient.name.toLowerCase() === selectedGradientKey.toLowerCase();
                  return (
                    <button
                      key={gradient.name}
                      onClick={() => {
                        setSelectedGradientKey(gradient.name.toLowerCase());
                        setShowAccentColorPicker(false);
                      }}
                      title={gradient.name}
                      className="relative flex-shrink-0 transition-transform hover:scale-105"
                      style={{ width: 36, height: 36 }}
                    >
                      <div className="w-full h-full rounded-full" style={{ background: gradient.css }} />
                      {isSelected && (
                        <div
                          className="absolute inset-0 rounded-full"
                          style={{ boxShadow: '0 0 0 2px white, 0 0 0 3.5px #1e1e1e' }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Drag/drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={() => setIsDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed cursor-pointer transition-colors py-8 ${
                isDragOver
                  ? 'border-[hsl(var(--primary))] bg-blue-50'
                  : uploadedImageData
                  ? 'border-green-400 bg-green-50'
                  : 'border-gray-300 bg-gray-50 hover:border-gray-400'
              }`}
            >
              <ImageAdd20Regular style={{ width: 28, height: 28, color: 'hsl(var(--text-secondary))' }} />
              <span className="text-body-2 text-gray-600">
                {uploadedImageData ? 'Image uploaded — click to replace' : 'Click or drag your PNG here to upload'}
              </span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/*"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-gray-200 px-6 py-4 flex items-center gap-3">
        <p className="flex-1 text-caption-1 text-gray-400">{footerDisclaimers[activeTab]}</p>
        <CopilotButton variant="secondary" size="sm" onClick={onClose}>Close</CopilotButton>
        <CopilotButton
          variant="primary"
          size="sm"
          onClick={handleApply}
          disabled={!isApplyEnabled}
        >
          Apply
        </CopilotButton>
      </div>
    </Dialog>
  );
};
