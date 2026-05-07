/**
 * SpecPage — historically a tab-based full-screen spec editor. Now a thin
 * redirect: the unified canvas at "/" is the single working surface, with
 * chat on the left and the spec document on the right. Existing deep-links
 * (/spec?project=X) continue to work and land users on the canvas with
 * their project loaded.
 */

import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';

export const SpecPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  // Preserve every query param (project, agent, view, …) so deep-links from
  // the legacy /spec route land users on the canvas with the same scope.
  const qs = searchParams.toString();
  const target = qs ? `/?${qs}` : '/';
  return <Navigate to={target} replace />;
};

export default SpecPage;
