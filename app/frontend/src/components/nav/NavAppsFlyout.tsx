import React from 'react';
import { AppsNavIcon } from './NavConstants';
import {
  Bot24Regular,
  Apps24Regular,
  Flow24Regular,
  DataArea24Regular,
  Settings24Regular,
  Globe24Regular,
  BrainCircuit24Regular,
  Code24Regular,
} from '@fluentui/react-icons';

interface NavAppsFlyoutProps {
  isOpen: boolean;
  position: { bottom: number; left: number } | null;
  onClose: () => void;
}

export const NavAppsFlyout: React.FC<NavAppsFlyoutProps> = ({ isOpen, position, onClose }) => {
  if (!isOpen || !position) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 bg-white rounded-lg flex flex-col gap-6"
        style={{ bottom: position.bottom, left: position.left, padding: 24, boxShadow: '0 8px 16px rgba(0,0,0,0.14), 0 0 2px rgba(0,0,0,0.12)' }}
      >
        {/* Row 1: M365 + Power suite */}
        <div className="flex gap-2 items-start">
          {[
            { label: 'M365 Copilot', icon: <Bot24Regular className="w-8 h-8 text-[#0078D4]" /> },
            { label: 'Power Apps', icon: <Apps24Regular className="w-8 h-8 text-[#742774]" /> },
            { label: 'Power Automate', icon: <Flow24Regular className="w-8 h-8 text-[#0066FF]" /> },
            { label: 'Power BI', icon: <DataArea24Regular className="w-8 h-8 text-[#F2C811]" /> },
          ].map(({ label, icon }) => (
            <button key={label} className="flex flex-col gap-2 items-center w-[88px] hover:bg-gray-50 rounded-lg p-1 transition-colors">
              <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">{icon}</div>
              <span className="text-[12px] text-gray-900 text-center leading-4 w-full">{label}</span>
            </button>
          ))}
        </div>

        <div className="border-t border-gray-200 -mx-6" />

        {/* Row 2: Admin + Azure */}
        <div className="flex gap-2 items-start">
          {[
            { label: 'Power Platform Admin Center', icon: <Settings24Regular className="w-8 h-8 text-[#0078D4]" /> },
            { label: 'Power Pages', icon: <Globe24Regular className="w-8 h-8 text-[#0078D4]" /> },
            { label: 'Azure Cognitive Service', icon: <BrainCircuit24Regular className="w-8 h-8 text-[#0078D4]" /> },
            { label: 'Azure Open AI', icon: <BrainCircuit24Regular className="w-8 h-8 text-[#6B2F7C]" /> },
          ].map(({ label, icon }) => (
            <button key={label} className="flex flex-col gap-2 items-center w-[88px] hover:bg-gray-50 rounded-lg p-1 transition-colors">
              <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">{icon}</div>
              <span className="text-[12px] text-gray-900 text-center leading-4 w-full">{label}</span>
            </button>
          ))}
        </div>

        <div className="border-t border-gray-200 -mx-6" />

        {/* Row 3: SDK + More */}
        <div className="flex gap-2 items-start">
          <button className="flex flex-col gap-2 items-center w-[88px] hover:bg-gray-50 rounded-lg p-1 transition-colors">
            <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
              <Code24Regular className="w-8 h-8 text-[#0078D4]" />
            </div>
            <span className="text-[12px] text-gray-900 text-center leading-4 w-full">Microsoft 365 Agent SDK</span>
          </button>
          <button className="flex flex-col gap-2 items-center w-[88px] hover:bg-gray-50 rounded-lg p-1 transition-colors">
            <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
              <AppsNavIcon className="w-8 h-8" />
            </div>
            <span className="text-[12px] text-gray-900 text-center leading-4 w-full">More apps</span>
          </button>
        </div>
      </div>
    </>
  );
};
