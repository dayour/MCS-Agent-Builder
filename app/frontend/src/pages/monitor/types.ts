// =============================================================================
// SHARED TYPE DEFINITIONS FOR MONITOR TAB
// =============================================================================

export interface User {
  id?: string
  name: string
  avatar: string
  time?: string
}

export interface EvaluatedItem {
  type: string
  name: string
  icon: string
}

export interface Evaluation {
  id: string
  name: string
  evaluatedItem: EvaluatedItem
  dataType?: string
  description?: string
  categories?: string[]
  overallScore?: number
  maxScore?: number
  totalTestCases?: number
  answeredQuestions?: string
  responseQuality?: string
  thumbsUp?: number
  thumbsDown?: number
  testMethods?: string
  lastRunBy?: User
  dataset?: string
  lastUpdated?: string
  detailMode?: string
  hideOverview?: boolean
  initialQualityFilter?: string
  initialReactionFilter?: string
  topicData?: Topic
}

export interface TestMethodScore {
  score: number
  maxScore: number
}

export interface EvaluationRun {
  id: string
  name: string
  user: User
  testMethodScores: Record<string, TestMethodScore>
}

export interface ToolUseItem {
  name: string
  type: string
  icon: string
}

export interface DatasetCase {
  question: string
  expectedResponse: string
  keywords: string[]
  toolUse: ToolUseItem[]
}

export interface PromptDatasetCase {
  inputs: Record<string, string>
  expectedResponse: string
}

export interface Dataset {
  id: string
  name: string
  amount: number
  cases: DatasetCase[] | PromptDatasetCase[]
  dataType: string
  lastModifiedBy: { name: string; time: string }
  prompt?: string
}

export interface Agent {
  id: string
  name: string
  type: string
  typeName: string
  icon?: string
  calls: number
  successRate: number
  status: string
}

export interface KnowledgeSource {
  id: number
  name: string
  type: string
  totalQuestions: number
  responseQuality: string
  thumbsUp: number
  thumbsDown: number
}

export interface Question {
  question: string
  answered: boolean
  testScores: Record<string, string>
  reaction: string | null
  comment: string | null
  date: string
  responseQuality: number
  userQuery?: string
  agentResponse?: string
  knowledgeSources?: string[]
}

export interface Topic {
  id: string
  name: string
  sessions: number
  resolution: number
  avgDuration: string
  trend: { pct: string; up: boolean }
  description: string
  topQuestions: string[]
}

export interface Session {
  id: number
  startTime: string
  duration: string
  messages: number
  outcome: string
  reason: string
  channel: string
  conversation: ConversationMessage[]
}

export interface ConversationMessage {
  role: string
  text: string
}

export interface CustomMetric {
  id?: string
  metricName: string
  measureDescription?: string
  categories?: { id: number; description: string }[]
}

export type CheckboxState = 'all' | 'some' | 'none'
