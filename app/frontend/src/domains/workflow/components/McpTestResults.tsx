// ── MCP Test Results viewer ─────────────────────────────────────────────────
// Extracted from WorkflowCanvas.tsx — renders parsed JSON output in
// Schema / Table / JSON views alongside a chain-of-thought reasoning panel.

import React from 'react';
import { DAActivityCoT, DANode } from '../../../components/ui/DAActivityCoT';
import { CopilotButton, CopilotTable } from '../../../components/ui';

type OutputViewType = 'schema' | 'table' | 'json';

const renderOutputValue = (val: unknown): React.ReactNode => {
  if (val === null) return <span className="text-gray-400 italic">null</span>;
  if (typeof val === 'boolean') return <span className={val ? 'text-green-600' : 'text-red-500'}>{String(val)}</span>;
  if (typeof val === 'number') return <span className="text-blue-600">{String(val)}</span>;
  if (typeof val === 'string') return <span className="text-gray-800">{val}</span>;
  if (Array.isArray(val)) return <span className="text-gray-500 italic">[{val.length} items]</span>;
  if (typeof val === 'object') return <span className="text-gray-500 italic">{'{ object }'}</span>;
  return <span>{String(val)}</span>;
};

const getTypeName = (val: unknown): string => {
  if (val === null) return 'null';
  if (Array.isArray(val)) return 'array';
  return typeof val;
};

const SchemaView: React.FC<{ response: string }> = ({ response }) => {
  let parsed: unknown = null;
  try { parsed = JSON.parse(response); } catch { /* not JSON */ }

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const entries = Object.entries(parsed as Record<string, unknown>);
    return (
      <div className="rounded-lg border border-gray-100 overflow-hidden divide-y divide-gray-50">
        {entries.map(([key, val]) => (
          <div key={key} className="flex items-start gap-3 px-3 py-2 bg-white hover:bg-gray-50 transition-colors">
            <span className="text-caption-1 font-mono text-gray-400 flex-shrink-0 pt-px min-w-[80px]">{key}</span>
            <span className="text-caption-1 font-mono break-all">{renderOutputValue(val)}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-100 p-3 bg-white">
      <pre className="text-caption-1 font-mono text-gray-700 whitespace-pre-wrap break-all">{response}</pre>
    </div>
  );
};

const TableView: React.FC<{ response: string }> = ({ response }) => {
  let parsed: unknown = null;
  try { parsed = JSON.parse(response); } catch { /* not JSON */ }

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const entries = Object.entries(parsed as Record<string, unknown>);
    const columns = [
      { key: 'key', label: 'Key', className: 'text-gray-500 font-mono w-1/3' },
      { key: 'value', label: 'Value', className: 'font-mono break-all' },
      { key: 'type', label: 'Type', className: 'text-gray-400 font-mono w-16' },
    ];
    const data = entries.map(([key, val]) => ({
      key,
      value: renderOutputValue(val),
      type: getTypeName(val),
    }));
    return (
      <div className="rounded-lg border border-gray-100 overflow-hidden">
        <CopilotTable columns={columns} data={data} className="w-full text-caption-1" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-100 p-3 bg-white">
      <pre className="text-caption-1 font-mono text-gray-700 whitespace-pre-wrap break-all">{response}</pre>
    </div>
  );
};

const escapeHtml = (str: string) =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const JsonView: React.FC<{ response: string }> = ({ response }) => {
  let formatted = response;
  try { formatted = JSON.stringify(JSON.parse(response), null, 2); } catch { /* use raw */ }

  const lines = formatted.split('\n');
  const renderLine = (line: string, idx: number) => {
    const escaped = escapeHtml(line);
    const withKey = escaped.replace(/^(\s*)(&quot;[\w-]+&quot;)\s*:/, (_, indent, key) =>
      `${indent}<span class="text-purple-600">${key}</span>:`
    );
    const withStr = withKey.replace(/:\s*(&quot;.*?&quot;)(,?)$/, (_, str, comma) =>
      `: <span class="text-green-700">${str}</span>${comma}`
    );
    const withPrim = withStr.replace(/:\s*(true|false|null|\d[\d.]*)(,?)$/, (_, prim, comma) =>
      `: <span class="text-blue-600">${prim}</span>${comma}`
    );
    return <div key={idx} dangerouslySetInnerHTML={{ __html: withPrim }} />;
  };

  return (
    <div className="rounded-lg border border-gray-100 p-3 bg-white overflow-x-auto">
      <pre className="text-caption-1 font-mono text-gray-700 whitespace-pre leading-relaxed">
        {lines.map(renderLine)}
      </pre>
    </div>
  );
};

export interface McpTestResultsProps {
  testState: { loading: boolean; nodes: DANode[]; response: string | null; success?: boolean };
  agentName: string;
  onNodeAsk?: (node: DANode) => void;
}

const McpTestResults: React.FC<McpTestResultsProps> = ({ testState, agentName, onNodeAsk }) => {
  const isDone = !testState.loading && (testState.response !== null || testState.success === false);
  const isSuccess = testState.success === true;
  const [outputView, setOutputView] = React.useState<OutputViewType>('schema');
  const [reasoningExpanded, setReasoningExpanded] = React.useState(true);
  const [outputExpanded, setOutputExpanded] = React.useState(true);

  const outputViews: { id: OutputViewType; label: string }[] = [
    { id: 'schema', label: 'Schema' },
    { id: 'table', label: 'Table' },
    { id: 'json', label: 'JSON' },
  ];

  const sectionToggle = (label: string, expanded: boolean, onToggle: () => void, right?: React.ReactNode) => (
    <CopilotButton variant="ghost" size="sm" className="flex items-center justify-between w-full group mb-2" onClick={onToggle}>
      <div className="flex items-center gap-1.5">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`text-gray-400 transition-transform flex-shrink-0 ${expanded ? 'rotate-90' : ''}`}>
          <path d="M4 2.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="text-caption-1-strong text-gray-500 group-hover:text-gray-700 transition-colors">{label}</span>
      </div>
      {right}
    </CopilotButton>
  );

  return (
    <div className="flex flex-col gap-3 mt-2">
      {/* Reasoning */}
      <div>
        {sectionToggle('Reasoning', reasoningExpanded, () => setReasoningExpanded(v => !v))}
        {reasoningExpanded && (
          <div className="rounded-lg border border-gray-100 overflow-hidden">
            <DAActivityCoT nodes={testState.nodes} agentName={agentName} onNodeAsk={onNodeAsk} />
          </div>
        )}
      </div>

      {/* Output — with Schema / Table / JSON view switcher */}
      {isDone && isSuccess && testState.response && (
        <div className="animate-slide-up-fade">
          {sectionToggle('Output', outputExpanded, () => setOutputExpanded(v => !v),
            outputExpanded && (
              <div className="flex items-center bg-gray-100 rounded-md p-0.5" onClick={e => e.stopPropagation()}>
                {outputViews.map(({ id, label }) => (
                  <CopilotButton
                    key={id}
                    variant="ghost"
                    size="sm"
                    onClick={() => setOutputView(id)}
                    className={`text-caption-1 px-2 py-0.5 rounded transition-colors ${outputView === id ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    {label}
                  </CopilotButton>
                ))}
              </div>
            )
          )}
          {outputExpanded && (
            <>
              {outputView === 'schema' && <SchemaView response={testState.response} />}
              {outputView === 'table' && <TableView response={testState.response} />}
              {outputView === 'json' && <JsonView response={testState.response} />}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default McpTestResults;
export { SchemaView, TableView, JsonView };
export type { OutputViewType };
