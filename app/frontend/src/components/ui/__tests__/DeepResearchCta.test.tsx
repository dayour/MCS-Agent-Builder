/**
 * Component tests for DeepResearchCta.
 *
 * Covers the four state renderings — idle / running / completed / failed —
 * plus the click path that fires POST /api/skill/start and hands the job
 * to PipelineActivityContext.trackJob.
 *
 * We stub PipelineActivityContext directly via React context so the test
 * doesn't depend on the provider's SSE wiring. The fetch call is stubbed
 * on globalThis.
 */

import React from 'react';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// The component imports usePipelineActivity from this path; we rewrite the
// module via vi.mock so every render sees our stub state.
import type { PipelineJob } from '../../../context/PipelineActivityContext';

const mockActivity = {
  jobs:         [] as PipelineJob[],
  activeJobs:   [] as PipelineJob[],
  recentJobs:   [] as PipelineJob[],
  trackJob:     vi.fn(),
  dismissJob:   vi.fn(),
  clearCompleted: vi.fn(),
  isExpanded:   false,
  setIsExpanded: vi.fn(),
};

vi.mock('../../../context/PipelineActivityContext', () => ({
  usePipelineActivity: () => mockActivity,
}));

// Import after the mock is set up.
import { DeepResearchCta } from '../DeepResearchCta';

function renderCta() {
  return render(
    <MemoryRouter>
      <DeepResearchCta projectId="proj-1" agentId="agent-1" />
    </MemoryRouter>,
  );
}

function makeJob(status: 'running' | 'completed' | 'failed', overrides: Partial<PipelineJob> = {}): PipelineJob {
  return {
    id:          'job-1',
    skillType:   'analyze',
    projectId:   'proj-1',
    agentId:     'agent-1',
    status,
    steps:       [],
    errors:      [],
    startedAt:   new Date().toISOString(),
    completedAt: status === 'running' ? null : new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------

describe('DeepResearchCta', () => {
  beforeEach(() => {
    mockActivity.jobs = [];
    mockActivity.activeJobs = [];
    mockActivity.recentJobs = [];
    mockActivity.trackJob = vi.fn();
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('idle state renders the Run Deep Research button', () => {
    renderCta();
    expect(screen.getByRole('button', { name: /Run Deep Research/i })).toBeInTheDocument();
  });

  test('click fires POST /api/skill/start with the right body and calls trackJob', async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ jobId: 'new-job-123', status: 'running' }), { status: 200 }),
    );

    renderCta();
    fireEvent.click(screen.getByRole('button', { name: /Run Deep Research/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/skill/start',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ skillType: 'analyze', projectId: 'proj-1', agentId: 'agent-1' }),
        }),
      );
    });

    await waitFor(() => {
      expect(mockActivity.trackJob).toHaveBeenCalledWith('new-job-123', {
        skillType: 'analyze',
        projectId: 'proj-1',
        agentId:   'agent-1',
      });
    });
  });

  test('click surfaces server error text without crashing', async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'project locked' }), { status: 409 }),
    );

    renderCta();
    fireEvent.click(screen.getByRole('button', { name: /Run Deep Research/i }));

    await waitFor(() => {
      expect(screen.getByText(/project locked/i)).toBeInTheDocument();
    });
    expect(mockActivity.trackJob).not.toHaveBeenCalled();
  });

  test('running state renders the progress pill with percent', () => {
    mockActivity.jobs = [
      makeJob('running', {
        steps: [
          { id: 's1', label: 'a', status: 'completed', detail: null },
          { id: 's2', label: 'b', status: 'running',   detail: null },
          { id: 's3', label: 'c', status: 'pending',   detail: null },
          { id: 's4', label: 'd', status: 'pending',   detail: null },
        ],
      }),
    ];

    renderCta();
    expect(screen.getByText(/Deep Research running/i)).toBeInTheDocument();
    expect(screen.getByText(/25%/)).toBeInTheDocument();
    // Button should be gone while running.
    expect(screen.queryByRole('button', { name: /Run Deep Research/i })).toBeNull();
  });

  test('completed state renders View spec link', () => {
    mockActivity.jobs = [makeJob('completed', { steps: [] })];

    renderCta();
    expect(screen.getByText(/Deep Research complete/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /View spec/i })).toBeInTheDocument();
  });

  test('failed state renders Analysis failed badge and Retry button', () => {
    mockActivity.jobs = [makeJob('failed', { steps: [] })];

    renderCta();
    expect(screen.getByText(/Analysis failed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });

  test('idempotency: matching running job scopes to THIS (projectId, agentId)', () => {
    // A running job for a DIFFERENT project should not suppress this CTA.
    mockActivity.jobs = [
      makeJob('running', { projectId: 'other-proj', agentId: 'other-agent', steps: [] }),
    ];
    renderCta();
    expect(screen.getByRole('button', { name: /Run Deep Research/i })).toBeInTheDocument();
  });
});
