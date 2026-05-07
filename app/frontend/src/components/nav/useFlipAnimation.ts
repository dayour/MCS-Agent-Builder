import { useState, useRef, useEffect, useMemo } from 'react';
import { AgentConfig } from '../../types';

/**
 * Tracks most-recently-opened agent order with a FLIP animation
 * when the list reorders.
 */
export function useFlipAnimation(agents: AgentConfig[]) {
  const [recentAgentIds, setRecentAgentIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('recentAgentIds') || '[]'); } catch { return []; }
  });

  const agentItemRefs = useRef<Map<string, HTMLElement>>(new Map());
  const prevAgentPositions = useRef<Map<string, number>>(new Map());
  const pendingFlip = useRef(false);

  const recordAgentOpened = (id: string) => {
    agentItemRefs.current.forEach((el, agentId) => {
      prevAgentPositions.current.set(agentId, el.getBoundingClientRect().top);
    });
    pendingFlip.current = true;
    setRecentAgentIds(prev => {
      const updated = [id, ...prev.filter(x => x !== id)];
      localStorage.setItem('recentAgentIds', JSON.stringify(updated));
      return updated;
    });
  };

  useEffect(() => {
    if (!pendingFlip.current || prevAgentPositions.current.size === 0) return;
    pendingFlip.current = false;

    const toAnimate: Array<{ el: HTMLElement; delta: number }> = [];
    agentItemRefs.current.forEach((el, agentId) => {
      const prevTop = prevAgentPositions.current.get(agentId);
      if (prevTop === undefined) return;
      const delta = prevTop - el.getBoundingClientRect().top;
      if (Math.abs(delta) > 0.5) toAnimate.push({ el, delta });
    });
    prevAgentPositions.current.clear();
    if (toAnimate.length === 0) return;

    toAnimate.forEach(({ el, delta }) => {
      el.style.transition = 'none';
      el.style.transform = `translateY(${delta}px)`;
    });
    toAnimate[0].el.getBoundingClientRect(); // force reflow
    requestAnimationFrame(() => {
      toAnimate.forEach(({ el }) => {
        el.style.transition = 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
        el.style.transform = '';
        el.addEventListener('transitionend', () => { el.style.transition = ''; }, { once: true });
      });
    });
  }, [recentAgentIds]);

  const sortedAgents = useMemo(() => {
    return [...agents].sort((a, b) => {
      const ai = recentAgentIds.indexOf(a.id);
      const bi = recentAgentIds.indexOf(b.id);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [agents, recentAgentIds]);

  return { sortedAgents, recordAgentOpened, agentItemRefs };
}
