export interface PlanStep {
  id: string;
  action: string;
  details?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
}

export interface Plan {
  id: string;
  title: string;
  summary: string;
  steps: PlanStep[];
  expectedOutcome: string;
  status: 'pending_approval' | 'approved' | 'rejected' | 'executing' | 'completed';
  createdAt: Date;
}

export interface PlanApprovalResponse {
  approved: boolean;
  feedback?: string;
}
