declare module '@fluentui-copilot/react-copilot' {
  import React from 'react';
  export const CopilotProvider: React.FC<{ theme?: unknown; children?: React.ReactNode; [key: string]: unknown }>;
  export const CopilotTheme: Record<string, unknown>;
}
