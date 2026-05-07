import React from 'react'
import {
  Avatar,
} from '@fluentui/react-components'
import { CopilotTable } from '../../../components/ui/CopilotTable'
import { mockEvaluations, mockDatasets, mockCustomTestMethods, mockDatasetsByType } from '../data/mockData'

// DEV-ONLY: Debug tool for inspecting raw mock data.
// Hidden in production builds (returns null). Visible only in development mode.
function MockDataViewer() {
  if (process.env.NODE_ENV === 'production') return null

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1600px] mx-auto w-full px-8 py-5">
        <h3 className="text-xl font-semibold text-gray-900" style={{ marginBottom: '32px' }}>Mock Data Viewer</h3>

        {/* Evaluations */}
        <section style={{ marginBottom: '48px' }}>
          <h4 className="text-base font-semibold text-gray-900" style={{ marginBottom: '16px' }}>Evaluations ({mockEvaluations.length})</h4>
          <CopilotTable
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'evaluatedItem', label: 'Type', render: (_, row) => row.evaluatedItem.type },
              { key: 'evaluatedItem', label: 'Item', render: (_, row) => row.evaluatedItem.name },
              { key: 'overallScore', label: 'Score', render: (_, row) => `${row.overallScore}/${row.maxScore}` },
              { key: 'dataset', label: 'Dataset' },
            ]}
            data={mockEvaluations}
            size="sm"
          />
        </section>

        {/* Datasets */}
        <section style={{ marginBottom: '48px' }}>
          <h4 className="text-base font-semibold text-gray-900" style={{ marginBottom: '16px' }}>Datasets ({mockDatasets.length})</h4>
          <CopilotTable
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'amount', label: 'Amount' },
              { key: 'dataType', label: 'Data Type' },
              { key: 'lastModifiedBy', label: 'Last Modified', render: (_, row) => row.lastModifiedBy.name },
            ]}
            data={mockDatasets}
            size="sm"
          />
        </section>

        {/* Datasets by Type */}
        <section style={{ marginBottom: '48px' }}>
          <h4 className="text-base font-semibold text-gray-900" style={{ marginBottom: '16px' }}>Datasets by Type</h4>
          {Object.entries(mockDatasetsByType).map(([type, datasets]) => (
            <div key={type} style={{ marginBottom: '24px' }}>
              <span style={{ display: 'block', marginBottom: '12px', textTransform: 'capitalize', fontWeight: '600', fontSize: '14px' }}>{type} ({datasets.length})</span>
              <CopilotTable
                columns={[
                  { key: 'id', label: 'ID' },
                  { key: 'name', label: 'Name' },
                  { key: 'amount', label: 'Amount' },
                  { key: 'dataType', label: 'Data Type' },
                  { key: 'lastModified', label: 'Last Modified', render: (_, row) => `${row.lastModified.by}, ${row.lastModified.time}` },
                ]}
                data={datasets}
                size="sm"
              />
            </div>
          ))}
        </section>

        {/* Dataset Cases */}
        <section style={{ marginBottom: '48px' }}>
          <h4 className="text-base font-semibold text-gray-900" style={{ marginBottom: '16px' }}>Dataset Cases</h4>
          {mockDatasets.map((dataset) => {
            const firstCase = dataset.cases[0]
            const isAgentStructure = firstCase && 'question' in firstCase
            const isPromptStructure = firstCase && 'inputs' in firstCase

            let inputKeys: string[] = []
            if (isPromptStructure) {
              inputKeys = Object.keys((firstCase as any).inputs)
            }

            const indexedCases = dataset.cases.map((c, i) => ({ ...c, _index: i + 1 }))

            const columns: { key: string; label: string; width?: string; render?: (v: any, row?: any) => React.ReactElement | null }[] = [
              { key: '_index', label: '#', width: '5%' },
            ]

            if (isAgentStructure) {
              columns.push(
                { key: 'question', label: 'Question', width: '30%', render: (v) => <span className="text-xs">{v}</span> },
                { key: 'expectedResponse', label: 'Expected Response', width: '35%', render: (v) => <span className="text-xs">{v}</span> },
                {
                  key: 'keywords', label: 'Keywords', width: '15%',
                  render: (v) => v && v.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {v.map((keyword: string, kIdx: number) => (
                        <span key={kIdx} className="inline-flex items-center px-2 py-0.5 rounded border border-[rgba(0,0,0,0.09)] text-xs">{keyword}</span>
                      ))}
                    </div>
                  ) : null,
                },
                {
                  key: 'toolUse', label: 'Tool Use', width: '15%',
                  render: (v) => v && v.length > 0 ? (
                    <div className="flex flex-col gap-0.5">
                      {v.map((tool: any, tIdx: number) => (
                        <span key={tIdx} className="text-[10px]">{typeof tool === 'string' ? tool : tool.name}</span>
                      ))}
                    </div>
                  ) : null,
                },
              )
            }

            if (isPromptStructure) {
              inputKeys.forEach((key) => {
                columns.push({
                  key: `inputs.${key}`,
                  label: key.charAt(0).toUpperCase() + key.slice(1),
                  render: (_, row) => (
                    <span className="text-xs">
                      {Array.isArray(row.inputs[key]) ? row.inputs[key].join(', ') : row.inputs[key]}
                    </span>
                  ),
                })
              })
              columns.push({
                key: 'expectedResponse',
                label: 'Expected Response',
                render: (v) => <span className="text-xs">{v}</span>,
              })
            }

            return (
              <div key={dataset.id} style={{ marginBottom: '32px' }}>
                <span style={{ display: 'block', marginBottom: '12px', fontWeight: '600', fontSize: '14px' }}>
                  {dataset.name} ({dataset.cases.length} cases)
                </span>
                <CopilotTable
                  columns={columns}
                  data={indexedCases}
                  size="sm"
                />
              </div>
            )
          })}
        </section>

        {/* Custom Test Methods */}
        <section style={{ marginBottom: '48px' }}>
          <h4 className="text-base font-semibold text-gray-900" style={{ marginBottom: '16px' }}>Custom Test Methods ({mockCustomTestMethods.length})</h4>
          <CopilotTable
            columns={[
              { key: 'title', label: 'Title' },
              { key: 'type', label: 'Type' },
              { key: 'description', label: 'Description' },
            ]}
            data={mockCustomTestMethods}
            size="sm"
          />
        </section>

        {/* Users */}
        <section>
          <h4 className="text-base font-semibold text-gray-900" style={{ marginBottom: '16px' }}>Users</h4>
          <div className="flex gap-4 flex-wrap">
            {[
              { name: 'Mona Kane', avatar: '/Mona Kane.png' },
              { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' },
              { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' },
            ].map((user) => (
              <div key={user.name} className="flex items-center gap-3 p-4 rounded-xl border border-[rgba(0,0,0,0.09)] bg-white">
                <Avatar name={user.name} image={{ src: user.avatar }} />
                <span className="text-sm text-gray-900">{user.name}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default MockDataViewer
