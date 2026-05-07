import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { createLightTheme, BrandVariants } from '@fluentui/react-components';
import { CopilotProvider, CopilotTheme } from '@fluentui-copilot/react-copilot';
import { AgentProvider } from './context/AgentContext';
import { FeatureToggleProvider, useFeatureToggles } from './context/FeatureToggleContext';
import { DWProvider } from './domains/dw/context/DWContext';
import { WorkflowProvider } from './context/WorkflowContext';
import { DexterMsalBridge } from './auth/DexterMsalBridge';
import { DexterWorkerProfileProvider } from './context/DexterWorkerProfileContext';
import { Layout } from './components/Layout';
import { ToastProvider } from './context/ToastContext';
import { ToastContainer } from './components/ui/CopilotToast';
import { PipelineActivityProvider } from './context/PipelineActivityContext';
import { SpecSessionProvider } from './context/SpecSessionContext';

// ── Lazy-loaded pages (code-split per route) ────────────────────────────────
const HomePage = React.lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));
const BuildPageDispatcher = React.lazy(() => import('./pages/BuildPageDispatcher').then(m => ({ default: m.BuildPageDispatcher })));
const PreviewPage = React.lazy(() => import('./pages/PreviewPage').then(m => ({ default: m.PreviewPage })));
const EvaluatePage = React.lazy(() => import('./pages/EvaluatePage').then(m => ({ default: m.EvaluatePage })));
const DistributePage = React.lazy(() => import('./pages/DistributePage').then(m => ({ default: m.DistributePage })));
const ComponentShowcaseWeb = React.lazy(() => import('./pages/ComponentShowcaseWeb').then(m => ({ default: m.ComponentShowcaseWeb })));
const SnapshotsPage = React.lazy(() => import('./pages/SnapshotsPage').then(m => ({ default: m.SnapshotsPage })));
const MyStuffPage = React.lazy(() => import('./pages/MyStuffPage').then(m => ({ default: m.MyStuffPage })));
const DiscoverPage = React.lazy(() => import('./pages/DiscoverPage').then(m => ({ default: m.DiscoverPage })));
const ScrollTestPage = React.lazy(() => import('./pages/ScrollTestPage').then(m => ({ default: m.ScrollTestPage })));

const ToolsPage = React.lazy(() => import('./pages/ToolsPage').then(m => ({ default: m.ToolsPage })));
const FlowsPage = React.lazy(() => import('./pages/FlowsPage').then(m => ({ default: m.FlowsPage })));
const AgentSettingsPageSimplified = React.lazy(() => import('./pages/AgentSettingsPageSimplified').then(m => ({ default: m.AgentSettingsPageSimplified })));
const MonitorPage = React.lazy(() => import('./pages/MonitorPage').then(m => ({ default: m.MonitorPage })));
const DexterMachinesPage = React.lazy(() => import('./domains/dw/pages/dexter/DexterMachinesPage').then(m => ({ default: m.DexterMachinesPage })));
const DexterWorkerDetailPage = React.lazy(() => import('./domains/dw/pages/dexter/DexterWorkerDetailPage').then(m => ({ default: m.DexterWorkerDetailPage })));
const TeamsPreviewPage = React.lazy(() => import('./pages/TeamsPreviewPage').then(m => ({ default: m.TeamsPreviewPage })));
const SpecPage = React.lazy(() => import('./pages/SpecPage').then(m => ({ default: m.SpecPage })));

// Custom brand color #464FEB
const customBrand: BrandVariants = {
  10: "#020207",
  20: "#0A0B1A",
  30: "#12142A",
  40: "#1A1D3A",
  50: "#22264A",
  60: "#2A2F5A",
  70: "#32386A",
  80: "#464FEB",  // Primary interactive color
  90: "#5A62EF",
  100: "#6E75F2",
  110: "#8289F5",
  120: "#969CF8",
  130: "#AAB0FA",
  140: "#BEC3FC",
  150: "#D2D5FD",
  160: "#E6E8FE"
};

const customTheme = createLightTheme(customBrand);

const SettingsRoute: React.FC = () => {
  return <AgentSettingsPageSimplified />;
};

const L1NavGate: React.FC<{ element: React.ReactElement }> = ({ element }) => {
  const { isL1NavJuneProposal } = useFeatureToggles();
  return isL1NavJuneProposal ? element : <Navigate to="/" replace />;
};


function App() {
  return (
    <CopilotProvider theme={customTheme} {...CopilotTheme}>
      <FeatureToggleProvider>
      <AgentProvider>
      <DWProvider>
      <WorkflowProvider>
        <DexterMsalBridge>
        <ToastProvider>
        <ToastContainer />
        <PipelineActivityProvider>
        <HashRouter>
          <SpecSessionProvider>
          <React.Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<DexterWorkerProfileProvider><Layout /></DexterWorkerProfileProvider>}>
              <Route index element={<HomePage />} />
              <Route path="mystuff" element={<MyStuffPage />} />
              <Route path="discover" element={<DiscoverPage />} />
              <Route path="build" element={<BuildPageDispatcher />} />
              <Route path="preview" element={<PreviewPage />} />
              <Route path="triggerlab" element={<Navigate to="/preview" replace />} />
              <Route path="evaluate" element={<EvaluatePage />} />
              <Route path="monitor" element={<MonitorPage />} />
              <Route path="distribute" element={<DistributePage />} />
              <Route path="project" element={<Navigate to="/" replace />} />
              <Route path="settings" element={<SettingsRoute />} />
              <Route path="components" element={<ComponentShowcaseWeb />} />
              <Route path="snapshots" element={<SnapshotsPage />} />
              <Route path="tools" element={<L1NavGate element={<ToolsPage />} />} />
              <Route path="flows" element={<L1NavGate element={<FlowsPage />} />} />
              <Route path="spec" element={<SpecPage />} />
            </Route>
            {/* Standalone admin pages — intentionally outside Layout (no nav chrome) */}
            <Route path="dexter-machines">
              <Route index element={<DexterMachinesPage />} />
              <Route path=":workerId" element={<DexterWorkerDetailPage />} />
            </Route>
            {/* Teams chat shell — standalone page, no Layout chrome */}
            <Route path="teams-chat/:workerId" element={<TeamsPreviewPage />} />
            {process.env.NODE_ENV === 'development' && (
              <Route path="scrolltest" element={<ScrollTestPage />} />
            )}
          </Routes>
          </React.Suspense>
          </SpecSessionProvider>
        </HashRouter>
        </PipelineActivityProvider>
        </ToastProvider>

        </DexterMsalBridge>
      </WorkflowProvider>
      </DWProvider>
      </AgentProvider>
      </FeatureToggleProvider>
    </CopilotProvider>
  );
}

export default App;
