// =============================================================================
// MOCK DATA DATABASE
// =============================================================================
// Central location for all mock data used across the application

// Import dataset cases from separate file to avoid circular dependencies
import { mockDatasetCases, MockCase, TextClassificationCase, SentimentAnalysisCase } from './mockDatasetCases'
// Import detailed run results with agent responses, keywords used, actual tools used, and test scores
import {
  allEvaluationRunResults,
  getRunResults,
  getCaseResult,
  updatedMockEvaluationRuns
} from './mockDataExpanded'

// Re-export for backward compatibility
export { mockDatasetCases }
export type { MockCase }

export interface MockUser {
  id: string
  name: string
  avatar: string
}

export interface EvaluatedItem {
  type: string
  name: string
  icon: string
}

export interface LastRunBy {
  name: string
  avatar: string
  time: string
}

export interface MockEvaluation {
  id: string
  name: string
  evaluatedItem: EvaluatedItem
  dataType?: string
  description?: string
  categories?: string[]
  overallScore: number
  maxScore: number
  totalTestCases: number
  answeredQuestions?: string
  responseQuality?: string
  thumbsUp?: number
  thumbsDown?: number
  testMethods: string
  lastRunBy: LastRunBy
  dataset: string
  lastUpdated?: string
}

export interface MockDataset {
  id: string
  name: string
  amount: number
  cases: MockCase[] | TextClassificationCase[] | SentimentAnalysisCase[]
  dataType: string
  lastModifiedBy: { name: string; time: string }
  prompt?: string
}

export interface MockDatasetByType {
  id: string
  name: string
  amount: number
  dataType: string
  lastModified: { by: string; time: string }
}

export interface MockCustomTestMethod {
  id: string
  title: string
  type: string
  description: string
}

export interface TestMethodScore {
  score: number
  maxScore: number
}

export interface MockEvaluationRun {
  id: string
  name: string
  user: { name: string; avatar: string }
  testMethodScores: Record<string, TestMethodScore>
}

export interface MockAgent {
  id: string
  name: string
  type: string
  typeName: string
  calls: number
  successRate: number
  status: string
}

// =============================================================================
// USERS DATA
// =============================================================================
export const mockUsers: MockUser[] = [
  {
    id: '1',
    name: 'Mona Kane',
    avatar: '/Mona Kane.png',
  },
  {
    id: '2',
    name: 'Daisy Phillips',
    avatar: '/Daisy Phillips.png',
  },
  {
    id: '3',
    name: 'Alberto Burgos',
    avatar: '/Alberto Burgos.png',
  },
]

// =============================================================================
// EVALUATIONS DATA
// =============================================================================
export const mockEvaluations: MockEvaluation[] = [
  {
    id: '1',
    name: 'Vacations & Leave Inquiries',
    evaluatedItem: { type: 'auto', name: 'Suggested theme', icon: '/Sparkle.svg' },
    dataType: 'Theme',
    description: 'Questions related to vacation policies, leave balances, PTO requests, and time-off approvals.',
    categories: ['HR'],
    overallScore: 198,
    maxScore: 200,
    totalTestCases: 494,
    answeredQuestions: '56%',
    responseQuality: '34%',
    thumbsUp: 76,
    thumbsDown: 207,
    testMethods: 'General quality, Compare meaning, Tone of voice',
    lastRunBy: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png', time: '5 minutes ago' },
    dataset: 'Home claims full set',
    lastUpdated: '02/18/2026',
  },
  {
    id: '2',
    name: 'Working from Home',
    evaluatedItem: { type: 'auto', name: 'Suggested theme', icon: '/Sparkle.svg' },
    description: 'Inquiries about remote work policies, home office setup, and hybrid work arrangements.',
    categories: ['Remote Work'],
    overallScore: 35,
    maxScore: 50,
    totalTestCases: 437,
    answeredQuestions: '87%',
    responseQuality: '63%',
    thumbsUp: 299,
    thumbsDown: 24,
    testMethods: 'Tool use, Keyword match',
    lastRunBy: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png', time: '20 minutes ago' },
    dataset: 'Home claims full set',
    lastUpdated: '02/17/2026',
  },
  {
    id: '3',
    name: 'Employee Records & Personal Data',
    evaluatedItem: { type: 'tracked', name: 'Tracked theme', icon: '/Target.svg' },
    dataType: 'Theme',
    description: 'Questions about personal data updates, employee records access, and data privacy compliance.',
    categories: ['Compliance'],
    overallScore: 5,
    maxScore: 20,
    totalTestCases: 412,
    answeredQuestions: '78%',
    responseQuality: '48%',
    thumbsUp: 137,
    thumbsDown: 43,
    testMethods: 'HR policy adherence, Compare meaning',
    lastRunBy: { name: 'Mona Kane', avatar: '/Mona Kane.png', time: '45 minutes ago' },
    dataset: 'Home claims full set',
    lastUpdated: '02/15/2026',
  },
  {
    id: '4',
    name: 'Travel & Mobility',
    evaluatedItem: { type: 'auto', name: 'Suggested theme', icon: '/Sparkle.svg' },
    dataType: 'Theme',
    description: 'Travel booking requests, expense reimbursements, and corporate travel policy questions.',
    categories: ['Travel'],
    overallScore: 36,
    maxScore: 40,
    totalTestCases: 408,
    answeredQuestions: '60%',
    responseQuality: '78%',
    thumbsUp: 69,
    thumbsDown: 114,
    testMethods: 'Sentiment appropriateness, Keyword match',
    lastRunBy: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png', time: '1 hour ago' },
    dataset: 'Home claims full set',
    lastUpdated: '02/14/2026',
  },
  {
    id: '5',
    name: 'Work Schedule & Attendance',
    evaluatedItem: { type: 'tracked', name: 'Tracked theme', icon: '/Target.svg' },
    description: 'Questions about work schedules, shift timings, attendance tracking, and flexible hours.',
    categories: ['HR'],
    overallScore: 104,
    maxScore: 200,
    totalTestCases: 390,
    answeredQuestions: '78%',
    responseQuality: '44%',
    thumbsUp: 204,
    thumbsDown: 6,
    testMethods: 'Text similarity, Response accuracy',
    lastRunBy: { name: 'Mona Kane', avatar: '/Mona Kane.png', time: '2 hours ago' },
    dataset: 'Text classification',
    lastUpdated: '02/12/2026',
  },
  {
    id: '6',
    name: 'Benefits & Compensation',
    evaluatedItem: { type: 'auto', name: 'Suggested theme', icon: '/Sparkle.svg' },
    dataType: 'Theme',
    description: 'Inquiries about health insurance, retirement plans, salary structure, and employee benefits.',
    categories: ['Finance'],
    overallScore: 175,
    maxScore: 200,
    totalTestCases: 356,
    answeredQuestions: '92%',
    responseQuality: '71%',
    thumbsUp: 245,
    thumbsDown: 18,
    testMethods: 'General quality, Sentiment appropriateness',
    lastRunBy: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png', time: '3 hours ago' },
    dataset: 'Safety check',
    lastUpdated: '02/10/2026',
  },
  {
    id: '7',
    name: 'Performance Reviews',
    evaluatedItem: { type: 'tracked', name: 'Tracked theme', icon: '/Target.svg' },
    description: 'Questions about performance review cycles, feedback processes, and career development goals.',
    categories: ['Management'],
    overallScore: 42,
    maxScore: 50,
    totalTestCases: 298,
    answeredQuestions: '65%',
    responseQuality: '52%',
    thumbsUp: 156,
    thumbsDown: 45,
    testMethods: 'Tool use, Keyword match',
    lastRunBy: { name: 'Mona Kane', avatar: '/Mona Kane.png', time: 'Yesterday 09:30' },
    dataset: 'Safety check',
    lastUpdated: '02/08/2026',
  },
  {
    id: '8',
    name: 'Accuracy test',
    evaluatedItem: { type: 'Agent', name: 'Sales assistant', icon: '/agent 3.svg' },
    dataType: 'Agent: Single response',
    overallScore: 15,
    maxScore: 20,
    totalTestCases: 8,
    testMethods: 'Response accuracy, Compare meaning',
    lastRunBy: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png', time: 'Yesterday 14:15' },
    dataset: 'Home claims full set',
    lastUpdated: '02/07/2026',
  },
  {
    id: '9',
    name: 'Integration test',
    evaluatedItem: { type: 'Agent', name: 'Help desk agent', icon: '/agent 4.svg' },
    dataType: 'Agent: Conversation',
    overallScore: 38,
    maxScore: 40,
    totalTestCases: 20,
    testMethods: 'Tool use, Tone of voice',
    lastRunBy: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png', time: '03.02.2026 16:20' },
    dataset: 'Safety check',
    lastUpdated: '02/03/2026',
  },
  {
    id: '10',
    name: 'Policy compliance eval',
    evaluatedItem: { type: 'Prompt', name: 'Product description', icon: '/Prompt.svg' },
    overallScore: 145,
    maxScore: 200,
    totalTestCases: 45,
    testMethods: 'Policy compliance, Text similarity',
    lastRunBy: { name: 'Mona Kane', avatar: '/Mona Kane.png', time: '02.02.2026 11:45' },
    dataset: 'Text classification',
    lastUpdated: '02/02/2026',
  },
  {
    id: '11',
    name: 'Daily agent check',
    evaluatedItem: { type: 'Agent', name: 'Product support', icon: '/agent 5.svg' },
    dataType: 'Agent: Conversation',
    overallScore: 192,
    maxScore: 200,
    totalTestCases: 55,
    testMethods: 'General quality, Text similarity, Tone of voice',
    lastRunBy: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png', time: '01.02.2026 08:30' },
    dataset: 'Safety check',
    lastUpdated: '02/01/2026',
  },
  {
    id: '12',
    name: 'Workflow validation',
    evaluatedItem: { type: 'Workflow', name: 'Claim routing', icon: '/Flowchart.svg' },
    overallScore: 28,
    maxScore: 50,
    totalTestCases: 18,
    testMethods: 'Tool use, Compare meaning',
    lastRunBy: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png', time: '31.01.2026 15:10' },
    dataset: 'Home claims full set',
    lastUpdated: '01/31/2026',
  },
  {
    id: '13',
    name: 'Message quality eval',
    evaluatedItem: { type: 'Workflow', name: 'Ticket assignment', icon: '/Flowchart.svg' },
    overallScore: 35,
    maxScore: 40,
    totalTestCases: 20,
    testMethods: 'Sentiment appropriateness, Keyword match',
    lastRunBy: { name: 'Mona Kane', avatar: '/Mona Kane.png', time: '30.01.2026 10:25' },
    dataset: 'Safety check',
    lastUpdated: '01/30/2026',
  },
  {
    id: '14',
    name: 'Prompt effectiveness eval',
    evaluatedItem: { type: 'Prompt', name: 'Email response', icon: '/Prompt.svg' },
    overallScore: 165,
    maxScore: 200,
    totalTestCases: 42,
    testMethods: 'Text similarity, Response accuracy',
    lastRunBy: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png', time: '29.01.2026 13:50' },
    dataset: 'Text classification',
    lastUpdated: '01/29/2026',
  },
]

// =============================================================================
// IMPORT EXPANDED RUN RESULTS
// =============================================================================
// (imported at top of file)

export { allEvaluationRunResults, getRunResults, getCaseResult, updatedMockEvaluationRuns }

// =============================================================================
// DATASETS DATA
// =============================================================================
export const mockDatasets: MockDataset[] = [
  {
    id: '1',
    name: 'Home claims full set',
    amount: 55,
    cases: mockDatasetCases.homeClaimsFullSet,
    dataType: 'Agent: Single response',
    lastModifiedBy: { name: 'Mona Kane', time: '2 hours ago' },
  },
  {
    id: '2',
    name: 'Safety check',
    amount: 20,
    cases: mockDatasetCases.safetyCheck,
    dataType: 'Agent: Single response',
    lastModifiedBy: { name: 'Mona Kane', time: '2 hours ago' },
  },
  {
    id: '3',
    name: 'Text classification',
    amount: 15,
    cases: mockDatasetCases.textClassification,
    dataType: 'Prompt',
    lastModifiedBy: { name: 'Daisy Phillips', time: '1 day ago' },
  },
  {
    id: '4',
    name: 'Sentiment analysis',
    amount: 30,
    cases: mockDatasetCases.sentimentAnalysis,
    dataType: 'Prompt',
    lastModifiedBy: { name: 'Alberto Burgos', time: '3 hours ago' },
    prompt: "Evaluate the sentiment of the given [input text], taking into account its emotional tone, subtle language cues, and cultural or contextual factors. Classify the tone of the text into the categories 'positive', 'negative', or 'neutral'. Look for sarcasm, emoticons, or specialized terminology that could affect the sentiment reading. In cases of mixed emotions, identify the most dominant sentiment. Analyze neutral phrases that may have positive or negative undertones, and gauge the message's urgency or significance. Your response may only be one word and should capitalize the first letter. Do NOT add any other explanations.",
  },
]

// Datasets organized by evaluation type for the wizard
export const mockDatasetsByType: Record<string, MockDatasetByType[]> = {
  agent: [
    { id: 'ds-a1', name: 'Customer service scenarios', amount: 42, dataType: 'Agent: Conversation', lastModified: { by: 'Mona Kane', time: '3 days ago' } },
    { id: 'ds-a2', name: 'Technical support cases', amount: 38, dataType: 'Agent: Conversation', lastModified: { by: 'Daisy Phillips', time: '5 days ago' } },
    { id: 'ds-a3', name: 'Sales interactions', amount: 25, dataType: 'Agent: Single response', lastModified: { by: 'Alberto Burgos', time: '1 week ago' } },
    { id: 'ds-a4', name: 'Claims handling eval set', amount: 55, dataType: 'Agent: Conversation', lastModified: { by: 'Mona Kane', time: '2 weeks ago' } },
  ],
  prompt: [
    { id: 'ds-p1', name: 'Email templates test', amount: 30, dataType: 'Prompt', lastModified: { by: 'Alex Rivera', time: '4 days ago' } },
    { id: 'ds-p2', name: 'Product descriptions', amount: 48, dataType: 'Prompt', lastModified: { by: 'Jordan Lee', time: '6 days ago' } },
    { id: 'ds-p3', name: 'Response quality check', amount: 22, dataType: 'Prompt', lastModified: { by: 'Mona Kane', time: '1 week ago' } },
  ],
  workflow: [
    { id: 'ds-w1', name: 'Order processing flows', amount: 18, dataType: 'Workflow', lastModified: { by: 'Sam Chen', time: '2 days ago' } },
    { id: 'ds-w2', name: 'Approval workflow tests', amount: 15, dataType: 'Workflow', lastModified: { by: 'Taylor Swift', time: '5 days ago' } },
    { id: 'ds-w3', name: 'Routing scenarios', amount: 28, dataType: 'Workflow', lastModified: { by: 'Casey Morgan', time: '1 week ago' } },
    { id: 'ds-w4', name: 'Integration test suite', amount: 20, dataType: 'Workflow', lastModified: { by: 'Jamie Parker', time: '2 weeks ago' } },
  ],
}

// =============================================================================
// CUSTOM TEST METHODS DATA
// =============================================================================
export const mockCustomTestMethods: MockCustomTestMethod[] = [
  {
    id: '1',
    title: 'HR policy adherence',
    type: 'Classification',
    description: 'Checks if an agent response adheres to company HR policies. Responses are marked as either "Aligned" or "Misaligned".',
  },
  {
    id: '2',
    title: 'Tone of voice',
    type: 'Code grader',
    description: 'Grades the agent response tone of voice according to company guidelines for professional communication.',
  },
  {
    id: '3',
    title: 'Response accuracy',
    type: 'Code grader',
    description: 'Evaluates the factual accuracy and completeness of agent responses against known correct answers.',
  },
  {
    id: '4',
    title: 'Sentiment appropriateness',
    type: 'Classification',
    description: 'Classifies whether the sentiment of the response matches the context and customer situation.',
  },
  {
    id: '5',
    title: 'Policy compliance',
    type: 'Classification',
    description: 'Verifies that responses comply with company policies and regulatory requirements.',
  },
]

// =============================================================================
// EVALUATION RUNS DATA
// =============================================================================
export const mockEvaluationRuns: Record<string, MockEvaluationRun[]> = {
  '1': [ // Weekly full agent eval - 9 runs, 3 test methods
    {
      id: 'run-1-1',
      name: 'Weekly full agent eval • 01/8/26',
      user: { name: 'Mona Kane', avatar: '/Mona Kane.png' },
      testMethodScores: {
        'General quality': { score: 198, maxScore: 200 },
        'Compare meaning': { score: 150, maxScore: 200 },
        'Tone of voice': { score: 186, maxScore: 200 },
      },
    },
    {
      id: 'run-1-2',
      name: 'Weekly full agent eval • 01/1/26',
      user: { name: 'Mona Kane', avatar: '/Mona Kane.png' },
      testMethodScores: {
        'General quality': { score: 198, maxScore: 200 },
        'Compare meaning': { score: 104, maxScore: 200 },
        'Tone of voice': { score: 104, maxScore: 200 },
      },
    },
    {
      id: 'run-1-3',
      name: 'Weekly full agent eval • 12/23/25',
      user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' },
      testMethodScores: {
        'General quality': { score: 198, maxScore: 200 },
        'Compare meaning': { score: 36, maxScore: 200 },
        'Tone of voice': { score: 50, maxScore: 200 },
      },
    },
    {
      id: 'run-1-4',
      name: 'Weekly full agent eval • 12/14/25',
      user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' },
      testMethodScores: {
        'General quality': { score: 198, maxScore: 200 },
        'Compare meaning': { score: 104, maxScore: 200 },
        'Tone of voice': { score: 186, maxScore: 200 },
      },
    },
    {
      id: 'run-1-5',
      name: 'Weekly full agent eval • 12/7/25',
      user: { name: 'Mona Kane', avatar: '/Mona Kane.png' },
      testMethodScores: {
        'General quality': { score: 198, maxScore: 200 },
        'Compare meaning': { score: 50, maxScore: 200 },
        'Tone of voice': { score: 150, maxScore: 200 },
      },
    },
    {
      id: 'run-1-6',
      name: 'Weekly full agent eval • 11/30/25',
      user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' },
      testMethodScores: {
        'General quality': { score: 198, maxScore: 200 },
        'Compare meaning': { score: 198, maxScore: 200 },
        'Tone of voice': { score: 198, maxScore: 200 },
      },
    },
    {
      id: 'run-1-7',
      name: 'Weekly full agent eval • 11/23/25',
      user: { name: 'Mona Kane', avatar: '/Mona Kane.png' },
      testMethodScores: {
        'General quality': { score: 104, maxScore: 200 },
        'Compare meaning': { score: 104, maxScore: 200 },
        'Tone of voice': { score: 104, maxScore: 200 },
      },
    },
    {
      id: 'run-1-8',
      name: 'Weekly full agent eval • 11/16/25',
      user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' },
      testMethodScores: {
        'General quality': { score: 150, maxScore: 200 },
        'Compare meaning': { score: 150, maxScore: 200 },
        'Tone of voice': { score: 150, maxScore: 200 },
      },
    },
    {
      id: 'run-1-9',
      name: 'Weekly full agent eval • 11/9/25',
      user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' },
      testMethodScores: {
        'General quality': { score: 36, maxScore: 200 },
        'Compare meaning': { score: 36, maxScore: 200 },
        'Tone of voice': { score: 36, maxScore: 200 },
      },
    },
  ],
  '2': [ // Flow eval - 5 runs, 2 test methods
    {
      id: 'run-2-1',
      name: 'Flow eval • 01/8/26',
      user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' },
      testMethodScores: {
        'Tool use': { score: 40, maxScore: 50 },
        'Keyword match': { score: 45, maxScore: 50 },
      },
    },
    {
      id: 'run-2-2',
      name: 'Flow eval • 12/15/25',
      user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' },
      testMethodScores: {
        'Tool use': { score: 35, maxScore: 50 },
        'Keyword match': { score: 40, maxScore: 50 },
      },
    },
    {
      id: 'run-2-3',
      name: 'Flow eval • 11/22/25',
      user: { name: 'Mona Kane', avatar: '/Mona Kane.png' },
      testMethodScores: {
        'Tool use': { score: 30, maxScore: 50 },
        'Keyword match': { score: 35, maxScore: 50 },
      },
    },
    {
      id: 'run-2-4',
      name: 'Flow eval • 11/1/25',
      user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' },
      testMethodScores: {
        'Tool use': { score: 25, maxScore: 50 },
        'Keyword match': { score: 30, maxScore: 50 },
      },
    },
    {
      id: 'run-2-5',
      name: 'Flow eval • 10/10/25',
      user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' },
      testMethodScores: {
        'Tool use': { score: 20, maxScore: 50 },
        'Keyword match': { score: 25, maxScore: 50 },
      },
    },
  ],
  '3': [ // Quick eval - 3 runs, 2 test methods
    {
      id: 'run-3-1',
      name: 'Quick eval • 01/7/26',
      user: { name: 'Mona Kane', avatar: '/Mona Kane.png' },
      testMethodScores: {
        'HR policy adherence': { score: 15, maxScore: 20 },
        'Compare meaning': { score: 18, maxScore: 20 },
      },
    },
    {
      id: 'run-3-2',
      name: 'Quick eval • 12/20/25',
      user: { name: 'Mona Kane', avatar: '/Mona Kane.png' },
      testMethodScores: {
        'HR policy adherence': { score: 12, maxScore: 20 },
        'Compare meaning': { score: 14, maxScore: 20 },
      },
    },
    {
      id: 'run-3-3',
      name: 'Quick eval • 11/15/25',
      user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' },
      testMethodScores: {
        'HR policy adherence': { score: 8, maxScore: 20 },
        'Compare meaning': { score: 10, maxScore: 20 },
      },
    },
  ],
  '4': [ // Safety eval - 7 runs, 2 test methods
    {
      id: 'run-4-1',
      name: 'Safety eval • 01/7/26',
      user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' },
      testMethodScores: {
        'Sentiment appropriateness': { score: 38, maxScore: 40 },
        'Keyword match': { score: 35, maxScore: 40 },
      },
    },
    {
      id: 'run-4-2',
      name: 'Safety eval • 12/28/25',
      user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' },
      testMethodScores: {
        'Sentiment appropriateness': { score: 36, maxScore: 40 },
        'Keyword match': { score: 32, maxScore: 40 },
      },
    },
    {
      id: 'run-4-3',
      name: 'Safety eval • 12/14/25',
      user: { name: 'Mona Kane', avatar: '/Mona Kane.png' },
      testMethodScores: {
        'Sentiment appropriateness': { score: 30, maxScore: 40 },
        'Keyword match': { score: 28, maxScore: 40 },
      },
    },
    {
      id: 'run-4-4',
      name: 'Safety eval • 11/30/25',
      user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' },
      testMethodScores: {
        'Sentiment appropriateness': { score: 25, maxScore: 40 },
        'Keyword match': { score: 22, maxScore: 40 },
      },
    },
    {
      id: 'run-4-5',
      name: 'Safety eval • 11/16/25',
      user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' },
      testMethodScores: {
        'Sentiment appropriateness': { score: 20, maxScore: 40 },
        'Keyword match': { score: 18, maxScore: 40 },
      },
    },
    {
      id: 'run-4-6',
      name: 'Safety eval • 11/2/25',
      user: { name: 'Mona Kane', avatar: '/Mona Kane.png' },
      testMethodScores: {
        'Sentiment appropriateness': { score: 15, maxScore: 40 },
        'Keyword match': { score: 12, maxScore: 40 },
      },
    },
    {
      id: 'run-4-7',
      name: 'Safety eval • 10/19/25',
      user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' },
      testMethodScores: {
        'Sentiment appropriateness': { score: 10, maxScore: 40 },
        'Keyword match': { score: 8, maxScore: 40 },
      },
    },
  ],
  '5': [ // Returns eval - 4 runs, 2 test methods
    {
      id: 'run-5-1',
      name: 'Returns eval • 01/6/26',
      user: { name: 'Mona Kane', avatar: '/Mona Kane.png' },
      testMethodScores: {
        'Text similarity': { score: 180, maxScore: 200 },
        'Response accuracy': { score: 175, maxScore: 200 },
      },
    },
    {
      id: 'run-5-2',
      name: 'Returns eval • 12/18/25',
      user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' },
      testMethodScores: {
        'Text similarity': { score: 150, maxScore: 200 },
        'Response accuracy': { score: 145, maxScore: 200 },
      },
    },
    {
      id: 'run-5-3',
      name: 'Returns eval • 11/25/25',
      user: { name: 'Mona Kane', avatar: '/Mona Kane.png' },
      testMethodScores: {
        'Text similarity': { score: 120, maxScore: 200 },
        'Response accuracy': { score: 115, maxScore: 200 },
      },
    },
    {
      id: 'run-5-4',
      name: 'Returns eval • 11/5/25',
      user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' },
      testMethodScores: {
        'Text similarity': { score: 90, maxScore: 200 },
        'Response accuracy': { score: 85, maxScore: 200 },
      },
    },
  ],
  '6': [ // Customer satisfaction eval - 6 runs, 2 test methods
    {
      id: 'run-6-1',
      name: 'Customer satisfaction eval • 01/6/26',
      user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' },
      testMethodScores: {
        'General quality': { score: 190, maxScore: 200 },
        'Sentiment appropriateness': { score: 185, maxScore: 200 },
      },
    },
    {
      id: 'run-6-2',
      name: 'Customer satisfaction eval • 12/22/25',
      user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' },
      testMethodScores: {
        'General quality': { score: 175, maxScore: 200 },
        'Sentiment appropriateness': { score: 170, maxScore: 200 },
      },
    },
    {
      id: 'run-6-3',
      name: 'Customer satisfaction eval • 12/5/25',
      user: { name: 'Mona Kane', avatar: '/Mona Kane.png' },
      testMethodScores: {
        'General quality': { score: 160, maxScore: 200 },
        'Sentiment appropriateness': { score: 155, maxScore: 200 },
      },
    },
    {
      id: 'run-6-4',
      name: 'Customer satisfaction eval • 11/18/25',
      user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' },
      testMethodScores: {
        'General quality': { score: 145, maxScore: 200 },
        'Sentiment appropriateness': { score: 140, maxScore: 200 },
      },
    },
    {
      id: 'run-6-5',
      name: 'Customer satisfaction eval • 11/1/25',
      user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' },
      testMethodScores: {
        'General quality': { score: 130, maxScore: 200 },
        'Sentiment appropriateness': { score: 125, maxScore: 200 },
      },
    },
    {
      id: 'run-6-6',
      name: 'Customer satisfaction eval • 10/15/25',
      user: { name: 'Mona Kane', avatar: '/Mona Kane.png' },
      testMethodScores: {
        'General quality': { score: 115, maxScore: 200 },
        'Sentiment appropriateness': { score: 110, maxScore: 200 },
      },
    },
  ],
  '7': [ // Response time eval - 2 runs, 2 test methods
    {
      id: 'run-7-1',
      name: 'Response time eval • 01/5/26',
      user: { name: 'Mona Kane', avatar: '/Mona Kane.png' },
      testMethodScores: {
        'Tool use': { score: 45, maxScore: 50 },
        'Keyword match': { score: 48, maxScore: 50 },
      },
    },
    {
      id: 'run-7-2',
      name: 'Response time eval • 12/10/25',
      user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' },
      testMethodScores: {
        'Tool use': { score: 40, maxScore: 50 },
        'Keyword match': { score: 42, maxScore: 50 },
      },
    },
  ],
  '8': [ // Accuracy test - 8 runs, 2 test methods
    {
      id: 'run-8-1',
      name: 'Accuracy test • 01/5/26',
      user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' },
      testMethodScores: {
        'Response accuracy': { score: 18, maxScore: 20 },
        'Compare meaning': { score: 19, maxScore: 20 },
      },
    },
    {
      id: 'run-8-2',
      name: 'Accuracy test • 12/28/25',
      user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' },
      testMethodScores: {
        'Response accuracy': { score: 16, maxScore: 20 },
        'Compare meaning': { score: 17, maxScore: 20 },
      },
    },
    {
      id: 'run-8-3',
      name: 'Accuracy test • 12/14/25',
      user: { name: 'Mona Kane', avatar: '/Mona Kane.png' },
      testMethodScores: {
        'Response accuracy': { score: 14, maxScore: 20 },
        'Compare meaning': { score: 15, maxScore: 20 },
      },
    },
    {
      id: 'run-8-4',
      name: 'Accuracy test • 11/28/25',
      user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' },
      testMethodScores: {
        'Response accuracy': { score: 12, maxScore: 20 },
        'Compare meaning': { score: 13, maxScore: 20 },
      },
    },
    {
      id: 'run-8-5',
      name: 'Accuracy test • 11/12/25',
      user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' },
      testMethodScores: {
        'Response accuracy': { score: 10, maxScore: 20 },
        'Compare meaning': { score: 11, maxScore: 20 },
      },
    },
    {
      id: 'run-8-6',
      name: 'Accuracy test • 10/25/25',
      user: { name: 'Mona Kane', avatar: '/Mona Kane.png' },
      testMethodScores: {
        'Response accuracy': { score: 8, maxScore: 20 },
        'Compare meaning': { score: 9, maxScore: 20 },
      },
    },
    {
      id: 'run-8-7',
      name: 'Accuracy test • 10/8/25',
      user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' },
      testMethodScores: {
        'Response accuracy': { score: 6, maxScore: 20 },
        'Compare meaning': { score: 7, maxScore: 20 },
      },
    },
    {
      id: 'run-8-8',
      name: 'Accuracy test • 09/20/25',
      user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' },
      testMethodScores: {
        'Response accuracy': { score: 4, maxScore: 20 },
        'Compare meaning': { score: 5, maxScore: 20 },
      },
    },
  ],
  '9': [ // Integration test - 10 runs, 2 test methods
    {
      id: 'run-9-1',
      name: 'Integration test • 01/4/26',
      user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' },
      testMethodScores: {
        'Tool use': { score: 38, maxScore: 40 },
        'Tone of voice': { score: 39, maxScore: 40 },
      },
    },
    {
      id: 'run-9-2',
      name: 'Integration test • 12/25/25',
      user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' },
      testMethodScores: {
        'Tool use': { score: 36, maxScore: 40 },
        'Tone of voice': { score: 37, maxScore: 40 },
      },
    },
    {
      id: 'run-9-3',
      name: 'Integration test • 12/10/25',
      user: { name: 'Mona Kane', avatar: '/Mona Kane.png' },
      testMethodScores: {
        'Tool use': { score: 34, maxScore: 40 },
        'Tone of voice': { score: 35, maxScore: 40 },
      },
    },
    {
      id: 'run-9-4',
      name: 'Integration test • 11/25/25',
      user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' },
      testMethodScores: {
        'Tool use': { score: 32, maxScore: 40 },
        'Tone of voice': { score: 33, maxScore: 40 },
      },
    },
    {
      id: 'run-9-5',
      name: 'Integration test • 11/10/25',
      user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' },
      testMethodScores: {
        'Tool use': { score: 30, maxScore: 40 },
        'Tone of voice': { score: 31, maxScore: 40 },
      },
    },
    {
      id: 'run-9-6',
      name: 'Integration test • 10/26/25',
      user: { name: 'Mona Kane', avatar: '/Mona Kane.png' },
      testMethodScores: {
        'Tool use': { score: 28, maxScore: 40 },
        'Tone of voice': { score: 29, maxScore: 40 },
      },
    },
    {
      id: 'run-9-7',
      name: 'Integration test • 10/11/25',
      user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' },
      testMethodScores: {
        'Tool use': { score: 26, maxScore: 40 },
        'Tone of voice': { score: 27, maxScore: 40 },
      },
    },
    {
      id: 'run-9-8',
      name: 'Integration test • 09/26/25',
      user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' },
      testMethodScores: {
        'Tool use': { score: 24, maxScore: 40 },
        'Tone of voice': { score: 25, maxScore: 40 },
      },
    },
    {
      id: 'run-9-9',
      name: 'Integration test • 09/11/25',
      user: { name: 'Mona Kane', avatar: '/Mona Kane.png' },
      testMethodScores: {
        'Tool use': { score: 22, maxScore: 40 },
        'Tone of voice': { score: 23, maxScore: 40 },
      },
    },
    {
      id: 'run-9-10',
      name: 'Integration test • 08/27/25',
      user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' },
      testMethodScores: {
        'Tool use': { score: 20, maxScore: 40 },
        'Tone of voice': { score: 21, maxScore: 40 },
      },
    },
  ],
  '10': [ // Policy compliance eval - 1 run, 2 test methods
    {
      id: 'run-10-1',
      name: 'Policy compliance eval • 01/3/26',
      user: { name: 'Mona Kane', avatar: '/Mona Kane.png' },
      testMethodScores: {
        'Policy compliance': { score: 170, maxScore: 200 },
        'Text similarity': { score: 165, maxScore: 200 },
      },
    },
  ],
  '11': [ // Daily agent check - 5 runs, 3 test methods
    {
      id: 'run-11-1',
      name: 'Daily agent check • 01/3/26',
      user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' },
      testMethodScores: {
        'General quality': { score: 195, maxScore: 200 },
        'Text similarity': { score: 190, maxScore: 200 },
        'Tone of voice': { score: 192, maxScore: 200 },
      },
    },
    {
      id: 'run-11-2',
      name: 'Daily agent check • 12/18/25',
      user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' },
      testMethodScores: {
        'General quality': { score: 180, maxScore: 200 },
        'Text similarity': { score: 175, maxScore: 200 },
        'Tone of voice': { score: 178, maxScore: 200 },
      },
    },
    {
      id: 'run-11-3',
      name: 'Daily agent check • 12/2/25',
      user: { name: 'Mona Kane', avatar: '/Mona Kane.png' },
      testMethodScores: {
        'General quality': { score: 165, maxScore: 200 },
        'Text similarity': { score: 160, maxScore: 200 },
        'Tone of voice': { score: 162, maxScore: 200 },
      },
    },
    {
      id: 'run-11-4',
      name: 'Daily agent check • 11/16/25',
      user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' },
      testMethodScores: {
        'General quality': { score: 150, maxScore: 200 },
        'Text similarity': { score: 145, maxScore: 200 },
        'Tone of voice': { score: 148, maxScore: 200 },
      },
    },
    {
      id: 'run-11-5',
      name: 'Daily agent check • 10/30/25',
      user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' },
      testMethodScores: {
        'General quality': { score: 135, maxScore: 200 },
        'Text similarity': { score: 130, maxScore: 200 },
        'Tone of voice': { score: 132, maxScore: 200 },
      },
    },
  ],
  '12': [ // Workflow validation - 4 runs, 2 test methods
    {
      id: 'run-12-1',
      name: 'Workflow validation • 01/2/26',
      user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' },
      testMethodScores: {
        'Tool use': { score: 42, maxScore: 50 },
        'Compare meaning': { score: 40, maxScore: 50 },
      },
    },
    {
      id: 'run-12-2',
      name: 'Workflow validation • 12/12/25',
      user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' },
      testMethodScores: {
        'Tool use': { score: 35, maxScore: 50 },
        'Compare meaning': { score: 33, maxScore: 50 },
      },
    },
    {
      id: 'run-12-3',
      name: 'Workflow validation • 11/22/25',
      user: { name: 'Mona Kane', avatar: '/Mona Kane.png' },
      testMethodScores: {
        'Tool use': { score: 28, maxScore: 50 },
        'Compare meaning': { score: 26, maxScore: 50 },
      },
    },
    {
      id: 'run-12-4',
      name: 'Workflow validation • 11/2/25',
      user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' },
      testMethodScores: {
        'Tool use': { score: 21, maxScore: 50 },
        'Compare meaning': { score: 19, maxScore: 50 },
      },
    },
  ],
  '13': [ // Message quality eval - 6 runs, 2 test methods
    {
      id: 'run-13-1',
      name: 'Message quality eval • 01/2/26',
      user: { name: 'Mona Kane', avatar: '/Mona Kane.png' },
      testMethodScores: {
        'Sentiment appropriateness': { score: 38, maxScore: 40 },
        'Keyword match': { score: 36, maxScore: 40 },
      },
    },
    {
      id: 'run-13-2',
      name: 'Message quality eval • 12/16/25',
      user: { name: 'Mona Kane', avatar: '/Mona Kane.png' },
      testMethodScores: {
        'Sentiment appropriateness': { score: 35, maxScore: 40 },
        'Keyword match': { score: 33, maxScore: 40 },
      },
    },
    {
      id: 'run-13-3',
      name: 'Message quality eval • 11/30/25',
      user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' },
      testMethodScores: {
        'Sentiment appropriateness': { score: 32, maxScore: 40 },
        'Keyword match': { score: 30, maxScore: 40 },
      },
    },
    {
      id: 'run-13-4',
      name: 'Message quality eval • 11/14/25',
      user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' },
      testMethodScores: {
        'Sentiment appropriateness': { score: 29, maxScore: 40 },
        'Keyword match': { score: 27, maxScore: 40 },
      },
    },
    {
      id: 'run-13-5',
      name: 'Message quality eval • 10/29/25',
      user: { name: 'Mona Kane', avatar: '/Mona Kane.png' },
      testMethodScores: {
        'Sentiment appropriateness': { score: 26, maxScore: 40 },
        'Keyword match': { score: 24, maxScore: 40 },
      },
    },
    {
      id: 'run-13-6',
      name: 'Message quality eval • 10/13/25',
      user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' },
      testMethodScores: {
        'Sentiment appropriateness': { score: 23, maxScore: 40 },
        'Keyword match': { score: 21, maxScore: 40 },
      },
    },
  ],
  '14': [ // Prompt effectiveness eval - 3 runs, 2 test methods
    {
      id: 'run-14-1',
      name: 'Prompt effectiveness eval • 01/1/26',
      user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' },
      testMethodScores: {
        'Text similarity': { score: 185, maxScore: 200 },
        'Response accuracy': { score: 180, maxScore: 200 },
      },
    },
    {
      id: 'run-14-2',
      name: 'Prompt effectiveness eval • 12/8/25',
      user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' },
      testMethodScores: {
        'Text similarity': { score: 165, maxScore: 200 },
        'Response accuracy': { score: 160, maxScore: 200 },
      },
    },
    {
      id: 'run-14-3',
      name: 'Prompt effectiveness eval • 11/15/25',
      user: { name: 'Mona Kane', avatar: '/Mona Kane.png' },
      testMethodScores: {
        'Text similarity': { score: 145, maxScore: 200 },
        'Response accuracy': { score: 140, maxScore: 200 },
      },
    },
  ],
}

export const mockAgents: MockAgent[] = [
  {
    id: '1',
    name: 'Customer Support Agent',
    type: 'copilot-studio',
    typeName: 'Copilot Studio',
    calls: 2847,
    successRate: 94,
    status: 'enabled'
  },
  {
    id: '2',
    name: 'Sales Assistant',
    type: 'child',
    typeName: 'Child',
    calls: 1523,
    successRate: 89,
    status: 'enabled'
  },
  {
    id: '3',
    name: 'HR Helpdesk',
    type: 'azure-ai-foundry',
    typeName: 'Azure AI Foundry',
    calls: 987,
    successRate: 97,
    status: 'enabled'
  },
  {
    id: '4',
    name: 'Product Recommendations',
    type: 'child',
    typeName: 'Child',
    calls: 3421,
    successRate: 92,
    status: 'disabled'
  },
  {
    id: '5',
    name: 'Technical Support Bot',
    type: 'copilot-studio',
    typeName: 'Copilot Studio',
    calls: 654,
    successRate: 88,
    status: 'enabled'
  },
  {
    id: '6',
    name: 'Onboarding Assistant',
    type: 'azure-ai-foundry',
    typeName: 'Azure AI Foundry',
    calls: 1876,
    successRate: 96,
    status: 'enabled'
  }
]

