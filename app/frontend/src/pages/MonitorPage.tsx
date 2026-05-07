import React from 'react';
import { useAgent } from '../context/AgentContext';
import MonitorApp from './monitor/MonitorApp';

export function MonitorPage() {
  const { isMonitorV2 } = useAgent();

  if (!isMonitorV2) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#6B7280', fontSize: '14px' }}>
          Monitor V2 is disabled. Enable it in the feature flags panel.
        </p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'hidden', height: '100%' }}>
      <MonitorApp />
    </div>
  );
}
