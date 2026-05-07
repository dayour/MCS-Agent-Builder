import React, { useRef, useState, useEffect } from 'react';
import { useAgent } from '../context/AgentContext';
import { AgentIcon } from './ui';


export const PlaceholderCanvas: React.FC = () => {
  const { agentConfig } = useAgent();
  const containerRef = useRef<HTMLDivElement>(null);
  const [cw, setCw] = useState(900);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const initialWidth = el.getBoundingClientRect().width || el.clientWidth;
    if (initialWidth) {
      setCw(prev => (prev === initialWidth ? prev : initialWidth));
    }

    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const newWidth = entry.contentRect.width;
      if (!newWidth) return;
      setCw(prev => (prev === newWidth ? prev : newWidth));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // For a linear-gradient at angle θ, the pixel stop value P that places the iso-line
  // at a desired x position in image coords is: P = (x_image - startX) / sin(θ)
  // where startX = W/2 - (gradientLineLength/2) * sin(θ)
  const SIN110 = Math.sin(110 * Math.PI / 180); // ≈ 0.9397
  const COS110 = Math.abs(Math.cos(110 * Math.PI / 180)); // ≈ 0.342

  // Agent (1028×878, left-aligned — image x == canvas x)
  const agentGradLen = 1028 * SIN110 + 878 * COS110;
  const agentStartX = 514 - (agentGradLen / 2) * SIN110;
  const agentStop = (frac: number) => (cw * frac - agentStartX) / SIN110;
  const agentMask = `linear-gradient(110deg, black ${agentStop(0.30)}px, transparent ${agentStop(0.60)}px)`;

  // Workflow (1144×792, centred)
  const wfW = 1144;
  const wfImageOffset = (cw - wfW) / 2; // negative when image wider than canvas
  const wfGradLen = wfW * SIN110 + 792 * COS110;
  const wfStartX = wfW / 2 - (wfGradLen / 2) * SIN110;
  const wfStop = (frac: number) => (cw * frac - wfImageOffset - wfStartX) / SIN110;
  const workflowMask = `linear-gradient(110deg, transparent ${wfStop(0.50)}px, black ${wfStop(0.80)}px)`;

  return (
    <div className="flex flex-col gap-6 h-full items-start px-0 2xl:px-8 py-8 bg-white">
      {/* Header Section - Matches agent canvas layout */}
      <div className="flex-shrink-0 flex items-start gap-4 mb-8" style={{ overflow: 'visible' }}>
        {/* Agent Icon */}
        <AgentIcon agent={agentConfig} size={80} withSquircle />

        {/* Content */}
        <div className="flex-1" style={{ overflow: 'visible', minWidth: 0 }}>
          {/* Title */}
          <h1
            className="font-bold text-gray-900 px-2 py-1 rounded text-3xl flex-1 cursor-text"
            style={{
              minHeight: '48px',
              lineHeight: '1.2'
            }}
          >
            {agentConfig.name || 'New agent or workflow'}
          </h1>

          {/* Description */}
          <div className="relative mt-1 w-full">
            <p
              className="text-sm text-gray-600 px-2 py-1 rounded whitespace-nowrap overflow-hidden text-ellipsis w-full"
              style={{
                lineHeight: '1.5',
                minHeight: '28px',
                display: 'block',
                maxWidth: '100%'
              }}
            >
              {agentConfig.description || 'Description of what this does.'}
            </p>
          </div>
        </div>
      </div>

      {/* Placeholder content — agent left, workflow centred, overlapping */}
      <div ref={containerRef} className="relative flex-1 w-full overflow-visible">
        <img src="/placeholder-content-agent.png" alt="" className="absolute top-0 left-0 max-w-none pointer-events-none select-none" width={1028} height={878} style={{ maskImage: agentMask, WebkitMaskImage: agentMask }} />
        <img src="/placeholder-content-workflow.png" alt="" className="absolute top-0 left-1/2 -translate-x-1/2 max-w-none pointer-events-none select-none" width={1144} height={792} style={{ maskImage: workflowMask, WebkitMaskImage: workflowMask }} />
      </div>
    </div>
  );
};

export default PlaceholderCanvas;
