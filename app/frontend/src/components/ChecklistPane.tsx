import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Circle20Regular, CheckmarkCircle20Regular, CheckmarkCircle20Filled, Dismiss16Regular } from '@fluentui/react-icons';
import { useAgent } from '../context/AgentContext';
import { getAgentStorage, setAgentStorage } from '../utils/agentStorage';
import { CopilotButton } from './ui/CopilotButton';
import { AgentConfig } from '../types';

interface StructuralItem {
  label: string;
  complete: boolean;
}

function getStructuralItems(agentConfig: AgentConfig, hasPreviewMessage: boolean): StructuralItem[] {
  const { type, name, description, instructions, channel, knowledge, workflowNodes } = agentConfig;

  const knowledgeCount =
    (knowledge?.files?.length ?? 0) +
    (knowledge?.customAPIs?.length ?? 0) +
    (knowledge?.webSearch ? 1 : 0) +
    (knowledge?.specificSources ? 1 : 0) +
    (knowledge?.referenceOrgChart ? 1 : 0) +
    (agentConfig.capabilities?.filter(c => c.type === 'knowledge').length ?? 0);
  const hasKnowledge = knowledgeCount >= 3;

  const instructionTrigger = instructions.match(/\[\[(.+?)\]\]/)?.[1];
  const hasChannel = !!channel
    || (agentConfig.capabilities?.some(c => c.type === 'trigger') ?? false)
    || (!!instructionTrigger && instructionTrigger !== 'Add a trigger');

  if (type === 'placeholder') {
    return [
      { label: 'Define goals and functionality', complete: instructions.length > 0 },
      { label: 'Do we need an agent or a workflow?', complete: false },
      { label: 'Add name and description', complete: name.length > 0 && description.length > 0 },
    ];
  }

  if (type === 'workflow') {
    return [
      { label: 'Add name and description', complete: name.length > 0 && description.length > 0 },
      { label: 'Add a trigger', complete: workflowNodes?.some(n => n.type === 'trigger' && !n.placeholder) ?? false },
      { label: 'Define the workflow steps', complete: workflowNodes?.some(n => n.type !== 'trigger') ?? false },
      { label: 'Test your workflow', complete: false },
    ];
  }

  // type === 'agent'
  const agentItems = [
    { label: 'Define goals and functionality', complete: instructions.length > 0 },
    { label: 'Add name and description', complete: name.length > 0 && description.length > 0 },
    { label: 'Choose where to deploy', complete: hasChannel },
    { label: 'Add knowledge sources', complete: hasKnowledge },
    { label: 'Test your agent', complete: hasPreviewMessage },
  ];
  if (agentConfig.agentType === 'DW') {
    return agentItems.map(item => ({ ...item, complete: true }));
  }
  return agentItems;
}

type CelebrationPhase = 'celebrating' | 'fading';

export const ChecklistPane: React.FC = () => {
  const { agentConfig, previewMessages, hasTestedAgent } = useAgent();
  const agentId = agentConfig.id;
  const [dismissed, setDismissed] = useState(
    () => getAgentStorage(agentId, 'checklistDismissed') === 'true'
  );
  const [animatingIn, setAnimatingIn] = useState(true);
  const [animatingOut, setAnimatingOut] = useState(false);
  const [celebrationStates, setCelebrationStates] = useState<Map<string, CelebrationPhase>>(new Map());
  // Initialized with items already complete on mount so they don't trigger celebration
  const prevCompleteLabelsRef = useRef<Set<string>>(
    new Set(
      getStructuralItems(agentConfig, previewMessages.some(m => m.role === 'user'))
        .filter(i => i.complete)
        .map(i => i.label)
    )
  );
  // Tracks done-section order: index 0 = most recently completed. Initially-complete items
  // are appended at the end in their original order; session-completed items are prepended.
  const completionOrderRef = useRef<string[]>(
    getStructuralItems(agentConfig, previewMessages.some(m => m.role === 'user'))
      .filter(i => i.complete)
      .map(i => i.label)
  );
  const itemRefsMap = useRef<Map<string, HTMLLIElement>>(new Map());
  const prevYPositionsRef = useRef<Map<string, number>>(new Map());
  const timer1Ref = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const timer2Ref = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const prevTypeRef = useRef<string>(agentConfig.type);
  // Set to true once the user has transitioned from placeholder to agent/workflow
  const hasTransitionedFromPlaceholderRef = useRef(false);
  const [leavingItems, setLeavingItems] = useState<Map<string, StructuralItem>>(new Map());
  const leavingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const ulRef = useRef<HTMLUListElement>(null);
  const ulHeightRef = useRef<number | null>(null);
  const prevDisplayItemsRef = useRef<StructuralItem[]>([]);

  if (prevTypeRef.current === 'placeholder' && agentConfig.type !== 'placeholder') {
    hasTransitionedFromPlaceholderRef.current = true;
  }
  prevTypeRef.current = agentConfig.type;

  // Placeholder-exclusive items (labels not present in the current type's list), computed
  // dynamically every render so completion state always reflects the latest agentConfig.
  const hasPreview = hasTestedAgent || previewMessages.some(m => m.role === 'user');
  const currentTypeLabels = new Set(getStructuralItems(agentConfig, hasPreview).map(i => i.label));
  const extraItems = (hasTransitionedFromPlaceholderRef.current && agentConfig.type !== 'placeholder')
    ? getStructuralItems({ ...agentConfig, type: 'placeholder' }, hasPreview)
        .filter(i => !currentTypeLabels.has(i.label))
        .filter(i => agentConfig.type !== 'workflow' || i.label === 'Do we need an agent or a workflow?')
        .map(i => i.label === 'Do we need an agent or a workflow?' ? { ...i, complete: true } : i)
    : [];

  const allItems = getStructuralItems(agentConfig, hasPreview).map(item => ({ ...item }));

  const nonTestItems = allItems.filter(i => i.label !== 'Test your agent' && i.label !== 'Test your workflow');
  const incompleteNonTestCount = nonTestItems.filter(i => !i.complete).length;
  const showTestItem = agentConfig.agentType !== 'DW' && (incompleteNonTestCount === 0 || (agentConfig.type === 'agent' && incompleteNonTestCount === 1));
  const items = showTestItem ? allItems : nonTestItems;

  // Extra placeholder-exclusive items first, then current-type items
  const allDisplayItems = [...extraItems, ...items];
  const allComplete = allDisplayItems.length > 0 && allDisplayItems.every(i => i.complete);
  const labelsKey = allDisplayItems.map(i => i.label).join(',');
  const heightKey = `${labelsKey}|${leavingItems.size}`;

  // Initialize prevDisplayItemsRef on first render so initial items don't animate in
  if (prevDisplayItemsRef.current.length === 0 && allDisplayItems.length > 0) {
    prevDisplayItemsRef.current = [...allDisplayItems];
  }

  // Detect newly completed items and start celebration timers
  const itemsKey = [...extraItems, ...allItems].map(i => `${i.label}:${i.complete}`).join(',');
  useEffect(() => {
    const startCelebration = (label: string) => {
      setCelebrationStates(prev => new Map(prev).set(label, 'celebrating'));
      const t1 = setTimeout(() => {
        completionOrderRef.current = [label, ...completionOrderRef.current.filter(l => l !== label)];
        setCelebrationStates(prev => new Map(prev).set(label, 'fading'));
      }, 1000);
      const t2 = setTimeout(() => {
        setCelebrationStates(prev => { const m = new Map(prev); m.delete(label); return m; });
        timer1Ref.current.delete(label);
        timer2Ref.current.delete(label);
      }, 1200);
      timer1Ref.current.set(label, t1);
      timer2Ref.current.set(label, t2);
    };

    [...extraItems, ...allItems].forEach(item => {
      if (item.complete && !prevCompleteLabelsRef.current.has(item.label)) {
        startCelebration(item.label);
      }
    });

    prevCompleteLabelsRef.current = new Set(
      [...extraItems, ...allItems].filter(i => i.complete).map(i => i.label)
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey]);

  // Cleanup timers on unmount
  useEffect(() => {
    const t1s = timer1Ref.current;
    const t2s = timer2Ref.current;
    const leavingTs = leavingTimersRef.current;
    return () => {
      t1s.forEach(t => clearTimeout(t));
      t2s.forEach(t => clearTimeout(t));
      leavingTs.forEach(t => clearTimeout(t));
    };
  }, []);

  // FLIP: animate items to their new position after reorder
  useLayoutEffect(() => {
    itemRefsMap.current.forEach(el => { el.style.transition = 'none'; el.style.transform = ''; });
    const flips: { el: HTMLLIElement; delta: number }[] = [];
    itemRefsMap.current.forEach((el, label) => {
      const newY = el.offsetTop;
      const prevY = prevYPositionsRef.current.get(label);
      if (prevY !== undefined && Math.abs(prevY - newY) > 1) flips.push({ el, delta: prevY - newY });
      prevYPositionsRef.current.set(label, newY);
    });
    if (flips.length === 0) return;
    flips.forEach(({ el, delta }) => { el.style.transform = `translateY(${delta}px)`; });
    requestAnimationFrame(() => {
      flips.forEach(({ el }) => { el.style.transition = 'transform 0.2s ease-out'; el.style.transform = ''; });
    });
  });

  // Detect when items leave allDisplayItems and keep them visible briefly for fade-out
  useLayoutEffect(() => {
    const currentLabels = new Set(allDisplayItems.map(i => i.label));
    const toAdd: StructuralItem[] = [];
    prevDisplayItemsRef.current.forEach(item => {
      if (!currentLabels.has(item.label) && !leavingTimersRef.current.has(item.label)) {
        toAdd.push(item);
        const t = setTimeout(() => {
          setLeavingItems(prev => { const m = new Map(prev); m.delete(item.label); return m; });
          leavingTimersRef.current.delete(item.label);
        }, 250);
        leavingTimersRef.current.set(item.label, t);
      }
    });
    prevDisplayItemsRef.current = [...allDisplayItems];
    if (toAdd.length > 0) {
      setLeavingItems(prev => {
        const m = new Map(prev);
        toAdd.forEach(item => m.set(item.label, item));
        return m;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labelsKey]);

  // Animate container height when items are added or removed
  useLayoutEffect(() => {
    const ul = ulRef.current;
    if (!ul) return;
    ul.style.transition = 'none';
    ul.style.height = 'auto';
    const newHeight = ul.scrollHeight;
    const oldHeight = ulHeightRef.current;
    ulHeightRef.current = newHeight;
    if (oldHeight !== null && oldHeight !== newHeight) {
      ul.style.height = `${oldHeight}px`;
      void ul.offsetHeight; // force reflow
      ul.style.transition = 'height 0.2s ease-out';
      ul.style.height = `${newHeight}px`;
      const t = setTimeout(() => {
        ul.style.height = 'auto';
        ul.style.transition = '';
      }, 210);
      return () => clearTimeout(t);
    }
   
  }, [heightKey]);

  useEffect(() => {
    if (!allComplete || animatingOut) return;
    // Freeze celebrating items in their brand state — cancel the fading/complete timers
    timer1Ref.current.forEach(t => clearTimeout(t));
    timer1Ref.current.clear();
    timer2Ref.current.forEach(t => clearTimeout(t));
    timer2Ref.current.clear();
    // Dismiss the pane at the moment items would normally go to complete (gray)
    const timer = setTimeout(() => setAnimatingOut(true), 1000);
    return () => clearTimeout(timer);
  }, [allComplete, animatingOut]);

  useEffect(() => {
    if (!animatingOut) return;
    const timer = setTimeout(() => {
      setAgentStorage(agentId, 'checklistDismissed', 'true');
      setDismissed(true);
    }, 200);
    return () => clearTimeout(timer);
  }, [animatingOut, agentId]);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatingIn(false), 400);
    return () => clearTimeout(timer);
  }, []);

  if (dismissed) return null;

  // Checks celebrationStates first; falls back to "newly complete this render" to avoid
  // an intermediate gray frame before the useEffect fires.
  const getEffectivePhase = (label: string, isComplete: boolean): CelebrationPhase | undefined =>
    celebrationStates.get(label) ??
    (isComplete && !prevCompleteLabelsRef.current.has(label) ? 'celebrating' : undefined);

  // Items stay in their original position until celebration fully completes.
  // Preserving allDisplayItems order is critical — splitting into two arrays would reorder celebrating items.
  const pendingItems = allDisplayItems.filter(i => !i.complete || !!getEffectivePhase(i.label, i.complete));
  const done = allDisplayItems
    .filter(i => i.complete && !getEffectivePhase(i.label, i.complete))
    .sort((a, b) => {
      const ai = completionOrderRef.current.indexOf(a.label);
      const bi = completionOrderRef.current.indexOf(b.label);
      return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
    });
  const ordered = [...pendingItems, ...done];

  const isNewLabel = (label: string) => !prevDisplayItemsRef.current.some(i => i.label === label);
  const setItemRef = (label: string) => (el: HTMLLIElement | null) => {
    if (el) itemRefsMap.current.set(label, el); else itemRefsMap.current.delete(label);
  };

  const renderItem = (label: string, isComplete: boolean) => {
    const phase = getEffectivePhase(label, isComplete);
    const isNew = isNewLabel(label);
    if (phase) {
      return (
        <li key={label} ref={setItemRef(label)} className={`flex items-center gap-1 px-4 py-2.5 relative overflow-hidden${isNew ? ' animate-item-enter' : ''}`}>
          {/* Base: incomplete during celebrate (hidden under overlay), complete gray during fading */}
          {phase === 'fading' ? (
            <>
              <CheckmarkCircle20Regular className="flex-shrink-0 text-[hsl(var(--text-disabled))]" />
              <span className="text-sm text-[hsl(var(--text-disabled))]">{label}</span>
            </>
          ) : (
            <>
              <Circle20Regular className="flex-shrink-0 text-[hsl(var(--text-tertiary))]" />
              <span className="text-sm text-[hsl(var(--text-secondary))]">{label}</span>
            </>
          )}
          {/* Overlay: brand colored, fades in then fades out */}
          <div
            className={`absolute inset-0 flex items-center gap-1 px-4 bg-white ${
              phase === 'fading' ? 'animate-quick-fade-out' : 'animate-brand-sweep'
            }`}
          >
            <CheckmarkCircle20Filled className="flex-shrink-0 text-[hsl(var(--primary))]" />
            <span className="text-sm text-[hsl(var(--primary))]">{label}</span>
          </div>
        </li>
      );
    }

    return (
      <li
        key={label}
        ref={setItemRef(label)}
        className={`flex items-center gap-1 px-4 py-2.5${isNew ? ' animate-item-enter' : ''}`}
      >
        {isComplete ? (
          <CheckmarkCircle20Regular className="flex-shrink-0 text-[hsl(var(--text-disabled))]" />
        ) : (
          <Circle20Regular className="flex-shrink-0 text-[hsl(var(--text-tertiary))]" />
        )}
        <span className={`text-sm ${isComplete ? 'text-[hsl(var(--text-disabled))]' : 'text-[hsl(var(--text-secondary))]'}`}>
          {label}
        </span>
      </li>
    );
  };

  return (
    <div
      className={`absolute bottom-12 z-40 right-9 ${animatingIn ? 'animate-slide-up-fade' : animatingOut ? 'animate-slide-down-fade' : ''}`}
      style={{
        background: 'white',
        borderRadius: '16px',
        boxShadow: '0 0 8px rgba(0,0,0,0.12), 0 14px 28px rgba(0,0,0,0.14)',
        minWidth: '292px',
        maxWidth: '332px',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-2 pb-2">
        <span className="text-sm font-semibold text-gray-900">Checklist</span>
        <CopilotButton
          variant="icon-subtle"
          size="sm"
          onClick={() => setAnimatingOut(true)}
          aria-label="Dismiss"
          className="mr-[-12px] hover:!bg-transparent"
        >
          <Dismiss16Regular />
        </CopilotButton>
      </div>

      <ul ref={ulRef} className="pb-2" style={{ overflow: 'hidden' }}>
        {ordered.map(item => renderItem(item.label, item.complete))}
        {Array.from(leavingItems.values()).map(item => (
          <li key={`leaving-${item.label}`} className="flex items-center gap-1 px-4 py-2.5 animate-item-exit">
            {item.complete ? (
              <CheckmarkCircle20Regular className="flex-shrink-0 text-[hsl(var(--text-disabled))]" />
            ) : (
              <Circle20Regular className="flex-shrink-0 text-[hsl(var(--text-tertiary))]" />
            )}
            <span className={`text-sm ${item.complete ? 'text-[hsl(var(--text-disabled))]' : 'text-[hsl(var(--text-secondary))]'}`}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ChecklistPane;
