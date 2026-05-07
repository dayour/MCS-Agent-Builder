import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAgent } from '../../context/AgentContext';
import { CopilotButton } from '../ui/CopilotButton';
import { CopilotInput } from '../ui/CopilotInput';
import { CopilotDropdown } from '../ui/CopilotDropdown';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '../ui/Dialog';
import {
  Camera24Regular,
  ArrowClockwise20Regular,
} from '@fluentui/react-icons';

const FIGMA_LAST_PAGE_KEY = 'figmaLastPageName';
// Sentinel value for the "＋ New page…" dropdown option. The \0 prefix is
// stripped by Figma from all page names, so this can never collide with a
// real page name regardless of what the user calls their pages.
const NEW_PAGE_SENTINEL = '\0__new__';

type Phase =
  | 'idle'
  | 'setup'
  | 'active-manual'
  | 'active-auto'
  | 'upload-dialog';

interface CapturedScreenshot {
  dataUrl: string;
  width: number;
  height: number;
  index: number;
}

interface AvailableFlow {
  id: string;
  name: string;
}

export const FlowCaptureOverlay: React.FC = () => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const uploadDialogInnerRef = useRef<HTMLDivElement>(null);
  const { userName } = useAgent();

  // Session state
  const [phase, setPhase] = useState<Phase>('idle');
  const [flowName, setFlowName] = useState('');
  const [screenshots, setScreenshots] = useState<CapturedScreenshot[]>([]);

  // Setup form
  const [setupFlowName, setSetupFlowName] = useState('');
  const [setupMode, setSetupMode] = useState<'manual' | 'auto'>('manual');
  const [setupAutoFlowId, setSetupAutoFlowId] = useState('');
  const [availableFlows, setAvailableFlows] = useState<AvailableFlow[]>([]);
  const [loadingFlows, setLoadingFlows] = useState(false);

  // CDP fast-mode status
  const [cdpAvailable, setCdpAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/capture/cdp-status')
      .then(r => r.json())
      .then(d => setCdpAvailable(d.available))
      .catch(() => setCdpAvailable(false));
  }, []);

  // Debug timing
  const [lastShotMs, setLastShotMs] = useState<number | null>(null);
  const timingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (timingTimeoutRef.current) clearTimeout(timingTimeoutRef.current); };
  }, []);

  // Upload dialog
  const [figmaPageName, setFigmaPageName] = useState('Flows');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [pluginConnected, setPluginConnected] = useState<boolean | null>(null);
  const [figmaPages, setFigmaPages] = useState<string[]>([]);
  const [isNewPage, setIsNewPage] = useState(false);

  // Inline confirmations (replaces window.confirm) and inline error/status messages
  const [confirmAction, setConfirmAction] = useState<'cancel-session' | 'cancel-auto' | 'discard' | null>(null);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const [saveLocalMessage, setSaveLocalMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // Animated height for the upload dialog — measured via ResizeObserver on inner content
  const [uploadDialogHeight, setUploadDialogHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (phase !== 'upload-dialog') return;
    const inner = uploadDialogInnerRef.current;
    if (!inner) return;
    const observer = new ResizeObserver(() => {
      setUploadDialogHeight(inner.offsetHeight);
    });
    observer.observe(inner);
    return () => observer.disconnect();
  }, [phase]);

  // Load available flows when setup opens
  useEffect(() => {
    if (phase === 'setup') {
      setLoadingFlows(true);
      fetch('/api/capture/flows')
        .then(r => r.json())
        .then(data => setAvailableFlows(data.flows || []))
        .catch(() => setAvailableFlows([]))
        .finally(() => setLoadingFlows(false));
    }
  }, [phase]);

  const checkPluginConnection = useCallback(async () => {
    setPluginConnected(null);
    try {
      const [statusRes, pagesRes] = await Promise.all([
        fetch('/api/figma/plugin-status'),
        fetch('/api/figma/pages'),
      ]);
      const statusData = await statusRes.json();
      const pagesData = await pagesRes.json();
      setPluginConnected(statusData.connected);
      const pages: string[] = pagesData.pages || [];
      setFigmaPages(pages);
      if (pages.length > 0) {
        // Default to last-used page (if still in the list), otherwise first page
        const lastUsed = localStorage.getItem(FIGMA_LAST_PAGE_KEY);
        const defaultPage = (lastUsed && pages.includes(lastUsed)) ? lastUsed : pages[0];
        setFigmaPageName(defaultPage);
        setIsNewPage(false);
      }
    } catch {
      setPluginConnected(false);
      setFigmaPages([]);
    }
  }, []);

  // Check plugin connection when upload dialog opens
  useEffect(() => {
    if (phase === 'upload-dialog') {
      checkPluginConnection();
    }
  }, [phase, checkPluginConnection]);

  const startSession = () => {
    const name = setupFlowName.trim();
    if (!name) return;
    setFlowName(name);
    setScreenshots([]);

    if (setupMode === 'manual') {
      setPhase('active-manual');
    } else {
      setPhase('active-auto');
      runAutoFlow(setupAutoFlowId);
    }
  };

  const takeScreenshot = useCallback(async () => {
    if (!overlayRef.current) return;

    // Hide overlay completely before the screenshot.
    // display:none + getBoundingClientRect() forces a synchronous reflow so
    // the style is flushed to the compositor immediately. Double RAF + a
    // setTimeout(0) then guarantees the GPU has composited the hidden frame
    // before the fetch goes out (important for CDP, which screenshots the
    // live compositor state).
    overlayRef.current.style.display = 'none';
    void overlayRef.current.getBoundingClientRect(); // force sync reflow
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 0))));

    const startMs = performance.now();

    try {
      // Collect localStorage so Playwright can reproduce the same app state
      const localStorageData: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) localStorageData[key] = localStorage.getItem(key) ?? '';
      }

      const res = await fetch('/api/capture/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: window.location.href, localStorageData }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Screenshot failed');

      const elapsedMs = Math.round(performance.now() - startMs);
      setLastShotMs(elapsedMs);
      if (timingTimeoutRef.current) clearTimeout(timingTimeoutRef.current);
      timingTimeoutRef.current = setTimeout(() => setLastShotMs(null), 4000);

      setScreenshots(prev => [
        ...prev,
        { dataUrl: data.dataUrl, width: data.width, height: data.height, index: prev.length + 1 },
      ]);
    } catch (err) {
      setScreenshotError(err instanceof Error ? err.message : String(err));
    } finally {
      if (overlayRef.current) overlayRef.current.style.display = '';
    }
  }, []);

  const runAutoFlow = async (flowId: string) => {
    try {
      const res = await fetch('/api/capture/run-flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flowId }),
      });
      const data = await res.json();
      if (Array.isArray(data.screenshots)) {
        setScreenshots(
          data.screenshots.map((s: Omit<CapturedScreenshot, 'index'>, i: number) => ({ ...s, index: i + 1 }))
        );
        setPhase('upload-dialog');
      } else {
        throw new Error(data.error || 'Flow failed');
      }
    } catch (err) {
      setPhase('idle');
      setFlowName('');
      setScreenshots([]);
      setScreenshotError(`Auto flow failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const resetCapture = () => {
    setPhase('idle');
    setFlowName('');
    setScreenshots([]);

    setSetupFlowName('');
    setSetupMode('manual');
    setSetupAutoFlowId('');
    setUploadError(null);
    setUploadSuccess(false);
    setIsNewPage(false);
    setFigmaPages([]);
    setConfirmAction(null);
    setScreenshotError(null);
    setSaveLocalMessage(null);
  };

  const handleUploadToFigma = async () => {
    setIsUploading(true);
    setUploadError(null);
    const effectivePage = figmaPageName.trim() || 'Flows';
    try {
      const res = await fetch('/api/figma/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flowName,
          figmaPageName: effectivePage,
          userName: userName || '',
          screenshots: screenshots.map(s => ({
            label: `Screen ${s.index}`,
            dataUrl: s.dataUrl,
            width: s.width,
            height: s.height,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      localStorage.setItem(FIGMA_LAST_PAGE_KEY, effectivePage);
      if (data.sentToPlugin === false) {
        setUploadError('Screenshots queued — open the Figma Transposer plugin in Figma to complete the upload.');
      } else {
        setUploadSuccess(true);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveLocally = async () => {
    try {
      const res = await fetch('/api/figma/save-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flowName,
          screenshots: screenshots.map(s => ({
            label: `Screen ${s.index}`,
            dataUrl: s.dataUrl,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setSaveLocalMessage({ ok: true, text: `Saved ${screenshots.length} screenshot${screenshots.length !== 1 ? 's' : ''} to Downloads/${flowName}` });
    } catch (err) {
      setSaveLocalMessage({ ok: false, text: `Failed to save: ${err instanceof Error ? err.message : String(err)}` });
    }
  };

  return (
    <>
      {lastShotMs !== null && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[10000] pointer-events-none">
          <div className="bg-black/70 text-white text-xs font-mono px-3 py-1.5 rounded-full shadow-lg">
            ⏱ Screenshot took {lastShotMs}ms
          </div>
        </div>
      )}

      <div ref={overlayRef} data-flow-capture-overlay className="fixed bottom-6 right-6 z-[9999]" style={{ pointerEvents: 'none' }}>
        {/* ── IDLE: Trigger button ── */}
        {phase === 'idle' && (
          // Designer tool only — intentional raw <button>. This overlay is an
          // internal capture utility, not product UI. The floating pill shape
          // (rounded-full, shadow-lg, active:scale-95) has no CopilotButton
          // equivalent and is not subject to the shared component rules.
          <button
            onClick={() => setPhase('setup')}
            style={{ pointerEvents: 'all' }}
            className="flex items-center gap-2 px-4 py-2.5 bg-[hsl(var(--primary))] text-white rounded-full shadow-lg hover:bg-[hsl(var(--brand-700))] active:scale-95 transition-all text-sm font-medium select-none"
          >
            <Camera24Regular style={{ width: 16, height: 16 }} />
            Capture flow
          </button>
        )}

        {/* ── ACTIVE MANUAL: Session controls ── */}
        {phase === 'active-manual' && (
          <div
            className="bg-white rounded-2xl shadow-xl border border-gray-200 p-4 w-52"
            style={{ pointerEvents: 'all' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
              <span className="text-xs font-semibold text-gray-700 truncate">{flowName}</span>
            </div>
            <p className="text-xs text-gray-400 mb-1">
              {screenshots.length} screenshot{screenshots.length !== 1 ? 's' : ''} captured
            </p>
            <p className="text-xs mb-3">
              {cdpAvailable === null ? (
                <span className="text-gray-400">Checking speed…</span>
              ) : cdpAvailable ? (
                <span className="text-green-600">⚡ Fast mode (CDP)</span>
              ) : (
                <span className="text-amber-500">🐢 Slow mode — see Setup instructions to enable ⚡ fast mode</span>
              )}
            </p>

            <div className="flex flex-col gap-2">
              <CopilotButton
                onClick={() => { setScreenshotError(null); takeScreenshot(); }}
                variant="primary"
                size="sm"
                className="w-full"
                icon={<Camera24Regular style={{ width: 15, height: 15 }} />}
              >
                Take screenshot
              </CopilotButton>
              {screenshotError && (
                <p className="text-xs text-red-500 leading-snug">{screenshotError}</p>
              )}
              {screenshots.length > 0 && (
                <CopilotButton
                  onClick={() => {
                    setUploadError(null);
                    setUploadSuccess(false);
                    setScreenshotError(null);
                    setPhase('upload-dialog');
                  }}
                  variant="outline"
                  size="sm"
                  className="w-full text-[hsl(var(--primary))]"
                >
                  Done
                </CopilotButton>
              )}
              {confirmAction === 'cancel-session' ? (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs text-gray-500 text-center">Lose {screenshots.length} screenshot{screenshots.length !== 1 ? 's' : ''}?</p>
                  <div className="flex gap-1.5">
                    <CopilotButton onClick={resetCapture} variant="primary" size="sm" className="flex-1 bg-red-600 hover:bg-red-700">Yes</CopilotButton>
                    <CopilotButton onClick={() => setConfirmAction(null)} variant="secondary" size="sm" className="flex-1">Keep going</CopilotButton>
                  </div>
                </div>
              ) : (
                <CopilotButton
                  onClick={() => setConfirmAction('cancel-session')}
                  variant="secondary"
                  size="sm"
                  className="w-full"
                >
                  Cancel session
                </CopilotButton>
              )}
            </div>
          </div>
        )}

        {/* ── ACTIVE AUTO: Progress ── */}
        {phase === 'active-auto' && (
          <div
            className="bg-white rounded-2xl shadow-xl border border-gray-200 p-4 w-52"
            style={{ pointerEvents: 'all' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
              <span className="text-xs font-semibold text-gray-700">Running…</span>
            </div>
            <p className="text-xs text-gray-400 mb-3 truncate">{flowName}</p>
            <div className="w-full bg-gray-100 rounded-full h-1 mb-3 overflow-hidden">
              <div className="bg-[hsl(var(--primary))] h-1 rounded-full animate-pulse w-1/3" />
            </div>
            {confirmAction === 'cancel-auto' ? (
              <div className="flex gap-1.5">
                <CopilotButton onClick={resetCapture} variant="primary" size="sm" className="flex-1 bg-red-600 hover:bg-red-700">Yes, cancel</CopilotButton>
                <CopilotButton onClick={() => setConfirmAction(null)} variant="secondary" size="sm" className="flex-1">Keep</CopilotButton>
              </div>
            ) : (
              <CopilotButton
                onClick={() => setConfirmAction('cancel-auto')}
                variant="transparent"
                size="sm"
                className="w-full text-red-500"
              >
                Cancel
              </CopilotButton>
            )}
          </div>
        )}
      </div>

      {/* ── SETUP DIALOG ── */}
      <Dialog isOpen={phase === 'setup'} onClose={resetCapture} maxWidth="md">
        <DialogHeader onClose={resetCapture}>
          <DialogTitle>📸 Capture a flow</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <p className="text-body-2 text-text-secondary mb-5">
            Document a UI flow as a series of screenshots, then send them to Figma.
          </p>

          <CopilotInput
            label="Flow name"
            value={setupFlowName}
            onChange={e => setSetupFlowName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && startSession()}
            placeholder="e.g. Create Agent Flow"
            autoFocus
            size="md"
            className="w-full mb-5"
          />

          <label id="capture-mode-label" className="block text-sm font-medium text-gray-700 mb-2">Capture mode</label>
          <div role="radiogroup" aria-labelledby="capture-mode-label" className="flex gap-3 mb-5">
            {(['manual', 'auto'] as const).map(mode => (
              // Selection card — not a CopilotButton (not a semantic action
              // button; it selects between two modes like a radio group)
              <div
                key={mode}
                role="radio"
                aria-checked={setupMode === mode}
                tabIndex={0}
                onClick={() => setSetupMode(mode)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSetupMode(mode); } }}
                className={`flex-1 px-4 py-3 rounded-xl border-2 text-left transition-colors cursor-pointer ${
                  setupMode === mode
                    ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`text-sm font-semibold mb-0.5 ${setupMode === mode ? 'text-[hsl(var(--primary))]' : 'text-gray-700'}`}>
                  {mode === 'manual' ? '🐭 Manual' : '🤖 Automated'}
                </div>
                <div className="text-xs text-gray-500 font-normal leading-snug">
                  {mode === 'manual'
                    ? 'You click through and take screenshots when ready'
                    : 'Playwright navigates and captures screens automatically'}
                </div>
              </div>
            ))}
          </div>

          {setupMode === 'auto' && (
            loadingFlows ? (
              <div className="text-sm text-gray-400 py-2">Loading flows…</div>
            ) : availableFlows.length === 0 ? (
              <div className="text-sm text-gray-500 bg-gray-50 rounded-lg px-4 py-3 leading-relaxed">
                No automated flows defined yet. A developer can add flows in{' '}
                <code className="text-xs bg-gray-200 px-1 rounded">server/captureRoutes.js</code>.
              </div>
            ) : (
              <CopilotDropdown
                label="Select flow"
                options={[
                  { value: '', label: 'Choose a flow…' },
                  ...availableFlows.map(f => ({ value: f.id, label: f.name })),
                ]}
                value={setupAutoFlowId}
                onChange={val => setSetupAutoFlowId(val)}
                variant="form-field"
                size="md"
                fullWidth
              />
            )
          )}
        </DialogContent>
        <DialogFooter>
          <CopilotButton
            onClick={startSession}
            variant="primary"
            size="md"
            disabled={
              !setupFlowName.trim() ||
              (setupMode === 'auto' && (!setupAutoFlowId || availableFlows.length === 0))
            }
          >
            Start capture
          </CopilotButton>
        </DialogFooter>
      </Dialog>

      {/* ── UPLOAD / DISCARD DIALOG ──
           Single dialog whose content swaps between the upload form, the discard
           confirmation, and the success state. The inner div is measured by a
           ResizeObserver so the outer wrapper can animate its height via CSS
           transition whenever the view changes. */}
      <Dialog
        isOpen={phase === 'upload-dialog'}
        onClose={
          confirmAction === 'discard'
            ? () => setConfirmAction(null)
            : uploadSuccess
            ? resetCapture
            : () => setConfirmAction('discard')
        }
        maxWidth="md"
      >
        {/* Animated height wrapper */}
        <div
          style={{
            height: uploadDialogHeight !== undefined ? uploadDialogHeight : undefined,
            transition: 'height 0.25s ease',
            overflow: 'hidden',
          }}
        >
          <div ref={uploadDialogInnerRef}>
            {confirmAction === 'discard' ? (
              <>
                <DialogHeader onClose={() => setConfirmAction(null)}>
                  <DialogTitle>Confirm discard</DialogTitle>
                </DialogHeader>
                <DialogContent>
                  <p className="text-body-2 text-text-secondary">
                    {screenshots.length === 1
                      ? 'Discard your screenshot?'
                      : `Discard your ${screenshots.length} screenshots?`}
                  </p>
                </DialogContent>
                <DialogFooter>
                  <CopilotButton variant="secondary" size="md" onClick={() => setConfirmAction(null)}>
                    Back
                  </CopilotButton>
                  <CopilotButton
                    variant="primary"
                    size="md"
                    onClick={resetCapture}
                    className="bg-red-600 hover:bg-red-700 active:bg-red-800"
                  >
                    Discard
                  </CopilotButton>
                </DialogFooter>
              </>
            ) : uploadSuccess ? (
              <>
                <DialogHeader onClose={resetCapture}>
                  <DialogTitle>Uploaded to Figma!</DialogTitle>
                </DialogHeader>
                <DialogContent>
                  <p className="text-body-2 text-text-secondary">
                    Your screenshots have been added to the "{figmaPageName}" page.
                  </p>
                </DialogContent>
                <DialogFooter>
                  <CopilotButton onClick={resetCapture} variant="secondary" size="md">
                    Done
                  </CopilotButton>
                  <CopilotButton onClick={() => { resetCapture(); setPhase('setup'); }} variant="primary" size="md">
                    Capture another
                  </CopilotButton>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader onClose={() => setConfirmAction('discard')}>
                  <DialogTitle>Upload to Figma</DialogTitle>
                </DialogHeader>
                <DialogContent>
                  <p className="text-body-2 text-text-secondary mb-5">
                    {screenshots.length} screenshot{screenshots.length !== 1 ? 's' : ''} will be placed
                    in your Figma file via the Figma Transposer plugin.
                  </p>

                  {/* Plugin connection status */}
                  <div
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg mb-4 text-xs ${
                      pluginConnected === null
                        ? 'bg-gray-50 text-gray-500'
                        : pluginConnected
                        ? 'bg-green-50 text-green-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    <span>
                      {pluginConnected === null ? '⏳' : pluginConnected ? '🟢' : '🟡'}
                    </span>
                    <span className="flex-1">
                      {pluginConnected === null
                        ? 'Checking connection…'
                        : pluginConnected
                        ? 'Figma Transposer plugin is connected'
                        : 'Plugin not detected — open the Figma Transposer plugin in Figma first'}
                    </span>
                    <CopilotButton
                      onClick={checkPluginConnection}
                      variant="transparent"
                      size="sm"
                      icon={<ArrowClockwise20Regular style={{ width: 12, height: 12 }} />}
                    >
                      Refresh
                    </CopilotButton>
                  </div>

                  {figmaPages.length > 0 && !isNewPage ? (
                    <CopilotDropdown
                      label="Figma page name"
                      options={[
                        ...figmaPages.map(p => ({ value: p, label: p })),
                        { value: NEW_PAGE_SENTINEL, label: '＋ New page…' },
                      ]}
                      value={figmaPageName}
                      onChange={val => {
                        if (val === NEW_PAGE_SENTINEL) {
                          setIsNewPage(true);
                          setFigmaPageName('');
                        } else {
                          setFigmaPageName(val);
                        }
                      }}
                      variant="form-field"
                      size="md"
                      fullWidth
                    />
                  ) : (
                    <div className="flex gap-2">
                      <CopilotInput
                        label="Figma page name"
                        value={figmaPageName}
                        onChange={e => setFigmaPageName(e.target.value)}
                        placeholder="Flows"
                        autoFocus={isNewPage}
                        size="md"
                        className="flex-1"
                      />
                      {figmaPages.length > 0 && (
                        <CopilotButton
                          onClick={() => {
                            const lastUsed = localStorage.getItem(FIGMA_LAST_PAGE_KEY);
                            const defaultPage = (lastUsed && figmaPages.includes(lastUsed)) ? lastUsed : figmaPages[0];
                            setIsNewPage(false);
                            setFigmaPageName(defaultPage);
                          }}
                          variant="outline"
                          size="md"
                          className="self-end"
                        >
                          ← Existing pages
                        </CopilotButton>
                      )}
                    </div>
                  )}

                  {uploadError && (
                    <div className="bg-red-50 border border-red-100 text-red-700 text-xs px-4 py-3 rounded-lg mt-4 leading-relaxed">
                      <div className="font-medium mb-1">Upload failed: {uploadError}</div>
                      <CopilotButton
                        onClick={handleSaveLocally}
                        variant="transparent"
                        size="sm"
                        className="underline hover:no-underline p-0 h-auto text-red-700"
                      >
                        Save screenshots locally to Downloads instead →
                      </CopilotButton>
                    </div>
                  )}

                  {saveLocalMessage && (
                    <p className={`text-xs px-1 mt-3 ${saveLocalMessage.ok ? 'text-green-600' : 'text-red-500'}`}>
                      {saveLocalMessage.text}
                    </p>
                  )}
                </DialogContent>
                <DialogFooter>
                  <CopilotButton
                    onClick={() => setConfirmAction('discard')}
                    variant="secondary"
                    size="md"
                  >
                    Discard
                  </CopilotButton>
                  <CopilotButton
                    onClick={handleUploadToFigma}
                    variant="primary"
                    size="md"
                    disabled={isUploading || !pluginConnected}
                    icon={isUploading ? (
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : undefined}
                  >
                    {isUploading ? 'Uploading…' : 'Upload to Figma'}
                  </CopilotButton>
                </DialogFooter>
              </>
            )}
          </div>
        </div>
      </Dialog>
    </>
  );
};
