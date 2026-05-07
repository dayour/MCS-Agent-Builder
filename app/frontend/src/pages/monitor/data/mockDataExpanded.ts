// =============================================================================
// EXPANDED MOCK DATA WITH RUN DETAILS
// =============================================================================
// This file contains expanded mock data with agent responses, actual tool use,
// keywords used, and scores for each test method across multiple runs.

import { mockDatasetCases, MockCase, ToolUseItem } from './mockDatasetCases'

export interface RunResult {
  caseIndex: number
  question: string
  agentResponse: string
  keywordsUsed: string[]
  actualToolsUsed: ToolUseItem[]
  testScores: Record<string, 'Pass' | 'Fail'>
  answered: boolean
  reaction: 'up' | 'down' | null
  comment: string | null
  knowledgeSources: string[]
  date: string
}

export interface TestMethodScore {
  score: number
  maxScore: number
}

export interface EvaluationRunEntry {
  id: string
  name: string
  user: { name: string; avatar: string }
  testMethodScores: Record<string, TestMethodScore>
}

type QualityLevel = 'excellent' | 'good' | 'poor' | 'bad'

interface QualityDistribution {
  excellent: number
  good: number
  poor: number
  bad: number
}

// Helper function to generate agent responses with variations
const generateAgentResponse = (expectedResponse: string, quality: QualityLevel = 'good'): string => {
  const variations: Record<QualityLevel, (response: string) => string> = {
    good: (response) => response, // Keep as is
    excellent: (response) => response + " I'm here to help if you have any other questions.",
    poor: (response) => {
      // Make response shorter or slightly off-topic
      const sentences = response.split('. ')
      return sentences.slice(0, Math.max(1, sentences.length - 2)).join('. ') + '.'
    },
    bad: (response) => {
      // Very short, missing key information
      const sentences = response.split('. ')
      return sentences[0] + '.'
    },
  }

  return variations[quality] ? variations[quality](expectedResponse) : expectedResponse
}

// Helper to check which keywords are used in response
const getUsedKeywords = (response: string, keywords: string[], matchRate: number = 0.8): string[] => {
  const used: string[] = []
  keywords.forEach(keyword => {
    const shouldMatch = Math.random() < matchRate
    if (shouldMatch && response.toLowerCase().includes(keyword.toLowerCase())) {
      used.push(keyword)
    }
  })
  return used
}

// Helper to get actual tools used (80% match with expected)
const getActualToolsUsed = (expectedTools: ToolUseItem[], matchRate: number = 0.8): ToolUseItem[] => {
  if (!expectedTools || expectedTools.length === 0) return []

  const shouldMatch = Math.random() < matchRate
  if (shouldMatch) {
    return expectedTools // Use expected tools
  } else {
    // Use different tool occasionally
    const alternativeTools: ToolUseItem[] = [
      { name: 'General inquiry', type: 'topic', icon: '/ChatMultiple.svg' },
      { name: 'Documentation', type: 'tool', icon: '/Sharepoint.svg' },
    ]
    return [alternativeTools[Math.floor(Math.random() * alternativeTools.length)]]
  }
}

// Helper to generate test scores based on test method and response quality
const generateTestScore = (testMethod: string, quality: QualityLevel, caseData: MockCase, agentResponse: string, keywordsUsed: string[], actualToolsUsed: ToolUseItem[]): 'Pass' | 'Fail' => {
  const qualityScores: Record<QualityLevel, number> = {
    excellent: 1.0,
    good: 0.85,
    poor: 0.6,
    bad: 0.3,
  }

  const baseScore = qualityScores[quality] || 0.7

  switch (testMethod) {
    case 'General quality':
      // Relevant and coherent response
      return Math.random() > 0.3 ? 'Pass' : 'Fail'

    case 'Compare meaning':
    case 'Text similarity':
      // Compare agent response to expected response
      const similarity = baseScore + (Math.random() * 0.2 - 0.1)
      return similarity > 0.7 ? 'Pass' : 'Fail'

    case 'Keyword match':
      // Check if required keywords are present
      const keywordMatchRate = keywordsUsed.length / (caseData.keywords?.length || 1)
      return keywordMatchRate > 0.5 ? 'Pass' : 'Fail'

    case 'Tool use':
      // Check if correct tool/topic was used
      if (!caseData.toolUse || caseData.toolUse.length === 0) return 'Pass'
      const expectedNames = caseData.toolUse.map(t => t.name)
      const actualNames = actualToolsUsed.map(t => t.name)
      const toolMatch = expectedNames.some(name => actualNames.includes(name))
      return toolMatch ? 'Pass' : 'Fail'

    case 'Tone of voice':
    case 'Sentiment appropriateness':
      // Professional and appropriate tone
      return baseScore > 0.7 ? 'Pass' : 'Fail'

    case 'Response accuracy':
    case 'Policy compliance':
    case 'HR policy adherence':
      // Factually correct and policy-compliant
      return baseScore > 0.75 ? 'Pass' : 'Fail'

    default:
      return Math.random() > 0.3 ? 'Pass' : 'Fail'
  }
}

// Quality distribution for realistic results
const qualityDistributions: Record<string, QualityDistribution> = {
  'run-1-1': { excellent: 0.70, good: 0.25, poor: 0.04, bad: 0.01 }, // Best run
  'run-1-2': { excellent: 0.50, good: 0.35, poor: 0.10, bad: 0.05 },
  'run-1-3': { excellent: 0.15, good: 0.25, poor: 0.35, bad: 0.25 }, // Worst run
  'run-1-4': { excellent: 0.50, good: 0.35, poor: 0.10, bad: 0.05 },
  'run-1-5': { excellent: 0.30, good: 0.35, poor: 0.25, bad: 0.10 },
  'run-1-6': { excellent: 0.70, good: 0.25, poor: 0.04, bad: 0.01 }, // Best run
  'run-1-7': { excellent: 0.20, good: 0.30, poor: 0.30, bad: 0.20 },
  'run-1-8': { excellent: 0.40, good: 0.35, poor: 0.20, bad: 0.05 },
  'run-1-9': { excellent: 0.10, good: 0.15, poor: 0.35, bad: 0.40 }, // Very poor run
}

// Default quality distribution for runs not specified above
const defaultQualityDistribution: QualityDistribution = { excellent: 0.50, good: 0.35, poor: 0.10, bad: 0.05 }

// Helper to pick quality based on distribution
const pickQuality = (distribution: QualityDistribution): QualityLevel => {
  const rand = Math.random()
  let cumulative = 0
  for (const [quality, probability] of Object.entries(distribution)) {
    cumulative += probability
    if (rand < cumulative) return quality as QualityLevel
  }
  return 'good'
}

// Knowledge source pools for mock data
const knowledgeSourcePool: string[] = [
  'Policy handbook.pdf',
  'FAQ reference.pdf',
  'Employee guide.docx',
  'www.contoso.com',
  'Benefits overview.pdf',
  'Travel policy.docx',
  'Compliance manual.pdf',
  'contoso.sharepoint.com',
]

// Generate run results for a dataset
export const generateRunResults = (datasetCases: MockCase[], runId: string, testMethods: string[]): RunResult[] => {
  const qualityDist = qualityDistributions[runId] || defaultQualityDistribution

  return datasetCases.map((caseData, index) => {
    const quality = pickQuality(qualityDist)
    const agentResponse = generateAgentResponse(caseData.expectedResponse, quality)
    const keywordsUsed = getUsedKeywords(agentResponse, caseData.keywords || [], quality === 'excellent' || quality === 'good' ? 0.8 : 0.4)
    const actualToolsUsed = getActualToolsUsed(caseData.toolUse, quality === 'bad' ? 0.5 : 0.85)

    // Generate scores for each test method
    const testScores: Record<string, 'Pass' | 'Fail'> = {}
    testMethods.forEach(method => {
      testScores[method] = generateTestScore(method, quality, caseData, agentResponse, keywordsUsed, actualToolsUsed)
    })

    // Generate per-question reaction and knowledge sources
    const seed = (index * 7 + runId.charCodeAt(runId.length - 1)) % 100
    const answered = quality === 'excellent' || quality === 'good' ? seed > 10 : (quality as string) === 'mediocre' ? seed > 35 : seed > 55
    const reaction: 'up' | 'down' | null = !answered ? null : seed < 35 ? 'up' : seed < 55 ? 'down' : null
    const comment: string | null = reaction === 'down' && seed % 3 === 0 ? 'Could be more detailed' : reaction === 'up' && seed % 4 === 0 ? 'Very helpful!' : null
    const sourceCount = answered ? 1 + (seed % 3) : 0
    const knowledgeSources = knowledgeSourcePool.slice(seed % knowledgeSourcePool.length, (seed % knowledgeSourcePool.length) + sourceCount)
    // Generate a date within the last 30 days
    const daysAgo = (seed + index * 3) % 30
    const dateObj = new Date(2026, 1, 23 - daysAgo)
    const date = `${String(dateObj.getMonth() + 1).padStart(2, '0')}/${String(dateObj.getDate()).padStart(2, '0')}/${dateObj.getFullYear()}`

    return {
      caseIndex: index,
      question: caseData.question,
      agentResponse,
      keywordsUsed,
      actualToolsUsed,
      testScores,
      answered,
      reaction,
      comment,
      knowledgeSources,
      date,
    }
  })
}

// =============================================================================
// PRE-GENERATED RUN RESULTS FOR EACH EVALUATION
// =============================================================================

// Evaluation 1: Weekly full agent eval (Home claims full set, 9 runs, 3 test methods)
export const evaluation1RunResults: Record<string, RunResult[]> = {
  'run-1-1': generateRunResults(mockDatasetCases.homeClaimsFullSet, 'run-1-1', ['General quality', 'Compare meaning', 'Tone of voice']),
  'run-1-2': generateRunResults(mockDatasetCases.homeClaimsFullSet, 'run-1-2', ['General quality', 'Compare meaning', 'Tone of voice']),
  'run-1-3': generateRunResults(mockDatasetCases.homeClaimsFullSet, 'run-1-3', ['General quality', 'Compare meaning', 'Tone of voice']),
  'run-1-4': generateRunResults(mockDatasetCases.homeClaimsFullSet, 'run-1-4', ['General quality', 'Compare meaning', 'Tone of voice']),
  'run-1-5': generateRunResults(mockDatasetCases.homeClaimsFullSet, 'run-1-5', ['General quality', 'Compare meaning', 'Tone of voice']),
  'run-1-6': generateRunResults(mockDatasetCases.homeClaimsFullSet, 'run-1-6', ['General quality', 'Compare meaning', 'Tone of voice']),
  'run-1-7': generateRunResults(mockDatasetCases.homeClaimsFullSet, 'run-1-7', ['General quality', 'Compare meaning', 'Tone of voice']),
  'run-1-8': generateRunResults(mockDatasetCases.homeClaimsFullSet, 'run-1-8', ['General quality', 'Compare meaning', 'Tone of voice']),
  'run-1-9': generateRunResults(mockDatasetCases.homeClaimsFullSet, 'run-1-9', ['General quality', 'Compare meaning', 'Tone of voice']),
}

// Evaluation 2: Flow eval (Home claims full set, 5 runs, 2 test methods)
export const evaluation2RunResults: Record<string, RunResult[]> = {
  'run-2-1': generateRunResults(mockDatasetCases.homeClaimsFullSet, 'run-1-1', ['Tool use', 'Keyword match']),
  'run-2-2': generateRunResults(mockDatasetCases.homeClaimsFullSet, 'run-1-2', ['Tool use', 'Keyword match']),
  'run-2-3': generateRunResults(mockDatasetCases.homeClaimsFullSet, 'run-1-4', ['Tool use', 'Keyword match']),
  'run-2-4': generateRunResults(mockDatasetCases.homeClaimsFullSet, 'run-1-5', ['Tool use', 'Keyword match']),
  'run-2-5': generateRunResults(mockDatasetCases.homeClaimsFullSet, 'run-1-7', ['Tool use', 'Keyword match']),
}

// Evaluation 3: Quick eval (Home claims full set, 3 runs, 2 test methods)
export const evaluation3RunResults: Record<string, RunResult[]> = {
  'run-3-1': generateRunResults(mockDatasetCases.homeClaimsFullSet, 'run-1-1', ['HR policy adherence', 'Compare meaning']),
  'run-3-2': generateRunResults(mockDatasetCases.homeClaimsFullSet, 'run-1-4', ['HR policy adherence', 'Compare meaning']),
  'run-3-3': generateRunResults(mockDatasetCases.homeClaimsFullSet, 'run-1-7', ['HR policy adherence', 'Compare meaning']),
}

// Evaluation 4: Safety eval (Safety check dataset, 7 runs, 2 test methods)
export const evaluation4RunResults: Record<string, RunResult[]> = {
  'run-4-1': generateRunResults(mockDatasetCases.safetyCheck, 'run-1-1', ['Sentiment appropriateness', 'Keyword match']),
  'run-4-2': generateRunResults(mockDatasetCases.safetyCheck, 'run-1-2', ['Sentiment appropriateness', 'Keyword match']),
  'run-4-3': generateRunResults(mockDatasetCases.safetyCheck, 'run-1-4', ['Sentiment appropriateness', 'Keyword match']),
  'run-4-4': generateRunResults(mockDatasetCases.safetyCheck, 'run-1-5', ['Sentiment appropriateness', 'Keyword match']),
  'run-4-5': generateRunResults(mockDatasetCases.safetyCheck, 'run-1-7', ['Sentiment appropriateness', 'Keyword match']),
  'run-4-6': generateRunResults(mockDatasetCases.safetyCheck, 'run-1-8', ['Sentiment appropriateness', 'Keyword match']),
  'run-4-7': generateRunResults(mockDatasetCases.safetyCheck, 'run-1-9', ['Sentiment appropriateness', 'Keyword match']),
}

// Evaluation 5: Returns eval (Home claims full set, 4 runs, 2 test methods)
export const evaluation5RunResults: Record<string, RunResult[]> = {
  'run-5-1': generateRunResults(mockDatasetCases.homeClaimsFullSet, 'run-1-1', ['Text similarity', 'Response accuracy']),
  'run-5-2': generateRunResults(mockDatasetCases.homeClaimsFullSet, 'run-1-2', ['Text similarity', 'Response accuracy']),
  'run-5-3': generateRunResults(mockDatasetCases.homeClaimsFullSet, 'run-1-4', ['Text similarity', 'Response accuracy']),
  'run-5-4': generateRunResults(mockDatasetCases.homeClaimsFullSet, 'run-1-7', ['Text similarity', 'Response accuracy']),
}

// Evaluation 6: Customer satisfaction eval (Safety check, 6 runs, 2 test methods)
export const evaluation6RunResults: Record<string, RunResult[]> = {
  'run-6-1': generateRunResults(mockDatasetCases.safetyCheck, 'run-1-1', ['General quality', 'Sentiment appropriateness']),
  'run-6-2': generateRunResults(mockDatasetCases.safetyCheck, 'run-1-2', ['General quality', 'Sentiment appropriateness']),
  'run-6-3': generateRunResults(mockDatasetCases.safetyCheck, 'run-1-4', ['General quality', 'Sentiment appropriateness']),
  'run-6-4': generateRunResults(mockDatasetCases.safetyCheck, 'run-1-5', ['General quality', 'Sentiment appropriateness']),
  'run-6-5': generateRunResults(mockDatasetCases.safetyCheck, 'run-1-7', ['General quality', 'Sentiment appropriateness']),
  'run-6-6': generateRunResults(mockDatasetCases.safetyCheck, 'run-1-8', ['General quality', 'Sentiment appropriateness']),
}

// Evaluation 7: Response time eval (Safety check, 2 runs, 2 test methods)
export const evaluation7RunResults: Record<string, RunResult[]> = {
  'run-7-1': generateRunResults(mockDatasetCases.safetyCheck, 'run-1-1', ['Tool use', 'Keyword match']),
  'run-7-2': generateRunResults(mockDatasetCases.safetyCheck, 'run-1-4', ['Tool use', 'Keyword match']),
}

// Evaluation 8: Accuracy test (Home claims full set, 8 runs, 2 test methods)
export const evaluation8RunResults: Record<string, RunResult[]> = {
  'run-8-1': generateRunResults(mockDatasetCases.homeClaimsFullSet, 'run-1-1', ['Response accuracy', 'Compare meaning']),
  'run-8-2': generateRunResults(mockDatasetCases.homeClaimsFullSet, 'run-1-2', ['Response accuracy', 'Compare meaning']),
  'run-8-3': generateRunResults(mockDatasetCases.homeClaimsFullSet, 'run-1-4', ['Response accuracy', 'Compare meaning']),
  'run-8-4': generateRunResults(mockDatasetCases.homeClaimsFullSet, 'run-1-5', ['Response accuracy', 'Compare meaning']),
  'run-8-5': generateRunResults(mockDatasetCases.homeClaimsFullSet, 'run-1-7', ['Response accuracy', 'Compare meaning']),
  'run-8-6': generateRunResults(mockDatasetCases.homeClaimsFullSet, 'run-1-8', ['Response accuracy', 'Compare meaning']),
  'run-8-7': generateRunResults(mockDatasetCases.homeClaimsFullSet, 'run-1-9', ['Response accuracy', 'Compare meaning']),
  'run-8-8': generateRunResults(mockDatasetCases.homeClaimsFullSet, 'run-1-9', ['Response accuracy', 'Compare meaning']),
}

// Evaluation 9: Integration test (Safety check, 10 runs, 2 test methods)
export const evaluation9RunResults: Record<string, RunResult[]> = {
  'run-9-1': generateRunResults(mockDatasetCases.safetyCheck, 'run-1-1', ['Tool use', 'Tone of voice']),
  'run-9-2': generateRunResults(mockDatasetCases.safetyCheck, 'run-1-2', ['Tool use', 'Tone of voice']),
  'run-9-3': generateRunResults(mockDatasetCases.safetyCheck, 'run-1-4', ['Tool use', 'Tone of voice']),
  'run-9-4': generateRunResults(mockDatasetCases.safetyCheck, 'run-1-5', ['Tool use', 'Tone of voice']),
  'run-9-5': generateRunResults(mockDatasetCases.safetyCheck, 'run-1-6', ['Tool use', 'Tone of voice']),
  'run-9-6': generateRunResults(mockDatasetCases.safetyCheck, 'run-1-7', ['Tool use', 'Tone of voice']),
  'run-9-7': generateRunResults(mockDatasetCases.safetyCheck, 'run-1-8', ['Tool use', 'Tone of voice']),
  'run-9-8': generateRunResults(mockDatasetCases.safetyCheck, 'run-1-9', ['Tool use', 'Tone of voice']),
  'run-9-9': generateRunResults(mockDatasetCases.safetyCheck, 'run-1-9', ['Tool use', 'Tone of voice']),
  'run-9-10': generateRunResults(mockDatasetCases.safetyCheck, 'run-1-9', ['Tool use', 'Tone of voice']),
}

// Evaluation 10: Policy compliance eval (Home claims full set, 1 run, 2 test methods)
export const evaluation10RunResults: Record<string, RunResult[]> = {
  'run-10-1': generateRunResults(mockDatasetCases.homeClaimsFullSet, 'run-1-1', ['Policy compliance', 'Text similarity']),
}

// Evaluation 11: Daily agent check (Safety check, 5 runs, 3 test methods)
export const evaluation11RunResults: Record<string, RunResult[]> = {
  'run-11-1': generateRunResults(mockDatasetCases.safetyCheck, 'run-1-1', ['General quality', 'Text similarity', 'Tone of voice']),
  'run-11-2': generateRunResults(mockDatasetCases.safetyCheck, 'run-1-2', ['General quality', 'Text similarity', 'Tone of voice']),
  'run-11-3': generateRunResults(mockDatasetCases.safetyCheck, 'run-1-4', ['General quality', 'Text similarity', 'Tone of voice']),
  'run-11-4': generateRunResults(mockDatasetCases.safetyCheck, 'run-1-5', ['General quality', 'Text similarity', 'Tone of voice']),
  'run-11-5': generateRunResults(mockDatasetCases.safetyCheck, 'run-1-7', ['General quality', 'Text similarity', 'Tone of voice']),
}

// Evaluation 12: Workflow validation (Home claims full set, 4 runs, 2 test methods)
export const evaluation12RunResults: Record<string, RunResult[]> = {
  'run-12-1': generateRunResults(mockDatasetCases.homeClaimsFullSet, 'run-1-1', ['Tool use', 'Compare meaning']),
  'run-12-2': generateRunResults(mockDatasetCases.homeClaimsFullSet, 'run-1-2', ['Tool use', 'Compare meaning']),
  'run-12-3': generateRunResults(mockDatasetCases.homeClaimsFullSet, 'run-1-5', ['Tool use', 'Compare meaning']),
  'run-12-4': generateRunResults(mockDatasetCases.homeClaimsFullSet, 'run-1-7', ['Tool use', 'Compare meaning']),
}

// Evaluation 13: Message quality eval (Safety check, 6 runs, 2 test methods)
export const evaluation13RunResults: Record<string, RunResult[]> = {
  'run-13-1': generateRunResults(mockDatasetCases.safetyCheck, 'run-1-1', ['Sentiment appropriateness', 'Keyword match']),
  'run-13-2': generateRunResults(mockDatasetCases.safetyCheck, 'run-1-2', ['Sentiment appropriateness', 'Keyword match']),
  'run-13-3': generateRunResults(mockDatasetCases.safetyCheck, 'run-1-4', ['Sentiment appropriateness', 'Keyword match']),
  'run-13-4': generateRunResults(mockDatasetCases.safetyCheck, 'run-1-5', ['Sentiment appropriateness', 'Keyword match']),
  'run-13-5': generateRunResults(mockDatasetCases.safetyCheck, 'run-1-7', ['Sentiment appropriateness', 'Keyword match']),
  'run-13-6': generateRunResults(mockDatasetCases.safetyCheck, 'run-1-8', ['Sentiment appropriateness', 'Keyword match']),
}

// Evaluation 14: Prompt effectiveness eval (Home claims full set, 3 runs, 2 test methods)
export const evaluation14RunResults: Record<string, RunResult[]> = {
  'run-14-1': generateRunResults(mockDatasetCases.homeClaimsFullSet, 'run-1-1', ['Text similarity', 'Response accuracy']),
  'run-14-2': generateRunResults(mockDatasetCases.homeClaimsFullSet, 'run-1-2', ['Text similarity', 'Response accuracy']),
  'run-14-3': generateRunResults(mockDatasetCases.homeClaimsFullSet, 'run-1-5', ['Text similarity', 'Response accuracy']),
}

// Export all run results indexed by evaluation ID
export const allEvaluationRunResults: Record<string, Record<string, RunResult[]>> = {
  '1': evaluation1RunResults,
  '2': evaluation2RunResults,
  '3': evaluation3RunResults,
  '4': evaluation4RunResults,
  '5': evaluation5RunResults,
  '6': evaluation6RunResults,
  '7': evaluation7RunResults,
  '8': evaluation8RunResults,
  '9': evaluation9RunResults,
  '10': evaluation10RunResults,
  '11': evaluation11RunResults,
  '12': evaluation12RunResults,
  '13': evaluation13RunResults,
  '14': evaluation14RunResults,
}

// Helper function to get run results for a specific evaluation and run
export const getRunResults = (evaluationId: string, runId: string): RunResult[] => {
  return allEvaluationRunResults[evaluationId]?.[runId] || []
}

// Helper function to get a specific case result from a run
export const getCaseResult = (evaluationId: string, runId: string, caseIndex: number): RunResult | null => {
  const runResults = getRunResults(evaluationId, runId)
  return runResults[caseIndex] || null
}

// =============================================================================
// CALCULATE AGGREGATE SCORES FROM DETAILED CASE RESULTS
// =============================================================================

// Helper to calculate aggregate test method scores from case results
const calculateAggregateScores = (runResults: RunResult[], testMethods: string[], totalCases: number, maxScorePerMethod: number = 200): Record<string, TestMethodScore> => {
  const aggregateScores: Record<string, TestMethodScore> = {}

  testMethods.forEach(method => {
    const passCount = runResults.filter(result =>
      result.testScores[method] === 'Pass'
    ).length

    // Calculate score proportionally
    // If 45 out of 55 cases pass, and max score is 200, then score = (45/55) * 200
    const score = Math.round((passCount / totalCases) * maxScorePerMethod)

    aggregateScores[method] = {
      score,
      maxScore: maxScorePerMethod
    }
  })

  return aggregateScores
}

// Generate updated evaluation runs with consistent aggregate scores
export const generateEvaluationRuns = (): Record<string, EvaluationRunEntry[]> => {
  const runs: Record<string, EvaluationRunEntry[]> = {}

  // Evaluation 1: Weekly full agent eval
  runs['1'] = [
    { id: 'run-1-1', name: 'Weekly full agent eval • 01/8/26', user: { name: 'Mona Kane', avatar: '/Mona Kane.png' }},
    { id: 'run-1-2', name: 'Weekly full agent eval • 01/1/26', user: { name: 'Mona Kane', avatar: '/Mona Kane.png' }},
    { id: 'run-1-3', name: 'Weekly full agent eval • 12/23/25', user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' }},
    { id: 'run-1-4', name: 'Weekly full agent eval • 12/14/25', user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' }},
    { id: 'run-1-5', name: 'Weekly full agent eval • 12/7/25', user: { name: 'Mona Kane', avatar: '/Mona Kane.png' }},
    { id: 'run-1-6', name: 'Weekly full agent eval • 11/30/25', user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' }},
    { id: 'run-1-7', name: 'Weekly full agent eval • 11/23/25', user: { name: 'Mona Kane', avatar: '/Mona Kane.png' }},
    { id: 'run-1-8', name: 'Weekly full agent eval • 11/16/25', user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' }},
    { id: 'run-1-9', name: 'Weekly full agent eval • 11/9/25', user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' }},
  ].map(run => ({
    ...run,
    testMethodScores: calculateAggregateScores(
      evaluation1RunResults[run.id],
      ['General quality', 'Compare meaning', 'Tone of voice'],
      55
    )
  }))

  // Evaluation 2: Flow eval
  runs['2'] = [
    { id: 'run-2-1', name: 'Flow eval • 01/8/26', user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' }},
    { id: 'run-2-2', name: 'Flow eval • 12/15/25', user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' }},
    { id: 'run-2-3', name: 'Flow eval • 11/22/25', user: { name: 'Mona Kane', avatar: '/Mona Kane.png' }},
    { id: 'run-2-4', name: 'Flow eval • 11/1/25', user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' }},
    { id: 'run-2-5', name: 'Flow eval • 10/10/25', user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' }},
  ].map(run => ({
    ...run,
    testMethodScores: calculateAggregateScores(
      evaluation2RunResults[run.id],
      ['Tool use', 'Keyword match'],
      55,
      50
    )
  }))

  // Evaluation 3: Quick eval
  runs['3'] = [
    { id: 'run-3-1', name: 'Quick eval • 01/7/26', user: { name: 'Mona Kane', avatar: '/Mona Kane.png' }},
    { id: 'run-3-2', name: 'Quick eval • 12/20/25', user: { name: 'Mona Kane', avatar: '/Mona Kane.png' }},
    { id: 'run-3-3', name: 'Quick eval • 11/15/25', user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' }},
  ].map(run => ({
    ...run,
    testMethodScores: calculateAggregateScores(
      evaluation3RunResults[run.id],
      ['HR policy adherence', 'Compare meaning'],
      55,
      20
    )
  }))

  // Evaluation 4: Safety eval
  runs['4'] = [
    { id: 'run-4-1', name: 'Safety eval • 01/7/26', user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' }},
    { id: 'run-4-2', name: 'Safety eval • 12/28/25', user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' }},
    { id: 'run-4-3', name: 'Safety eval • 12/14/25', user: { name: 'Mona Kane', avatar: '/Mona Kane.png' }},
    { id: 'run-4-4', name: 'Safety eval • 11/30/25', user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' }},
    { id: 'run-4-5', name: 'Safety eval • 11/16/25', user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' }},
    { id: 'run-4-6', name: 'Safety eval • 11/2/25', user: { name: 'Mona Kane', avatar: '/Mona Kane.png' }},
    { id: 'run-4-7', name: 'Safety eval • 10/19/25', user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' }},
  ].map(run => ({
    ...run,
    testMethodScores: calculateAggregateScores(
      evaluation4RunResults[run.id],
      ['Sentiment appropriateness', 'Keyword match'],
      20,
      40
    )
  }))

  // Evaluation 5: Returns eval
  runs['5'] = [
    { id: 'run-5-1', name: 'Returns eval • 01/6/26', user: { name: 'Mona Kane', avatar: '/Mona Kane.png' }},
    { id: 'run-5-2', name: 'Returns eval • 12/18/25', user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' }},
    { id: 'run-5-3', name: 'Returns eval • 11/25/25', user: { name: 'Mona Kane', avatar: '/Mona Kane.png' }},
    { id: 'run-5-4', name: 'Returns eval • 11/5/25', user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' }},
  ].map(run => ({
    ...run,
    testMethodScores: calculateAggregateScores(
      evaluation5RunResults[run.id],
      ['Text similarity', 'Response accuracy'],
      55
    )
  }))

  // Evaluation 6: Customer satisfaction eval
  runs['6'] = [
    { id: 'run-6-1', name: 'Customer satisfaction eval • 01/6/26', user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' }},
    { id: 'run-6-2', name: 'Customer satisfaction eval • 12/22/25', user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' }},
    { id: 'run-6-3', name: 'Customer satisfaction eval • 12/5/25', user: { name: 'Mona Kane', avatar: '/Mona Kane.png' }},
    { id: 'run-6-4', name: 'Customer satisfaction eval • 11/18/25', user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' }},
    { id: 'run-6-5', name: 'Customer satisfaction eval • 11/1/25', user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' }},
    { id: 'run-6-6', name: 'Customer satisfaction eval • 10/15/25', user: { name: 'Mona Kane', avatar: '/Mona Kane.png' }},
  ].map(run => ({
    ...run,
    testMethodScores: calculateAggregateScores(
      evaluation6RunResults[run.id],
      ['General quality', 'Sentiment appropriateness'],
      20
    )
  }))

  // Evaluation 7: Response time eval
  runs['7'] = [
    { id: 'run-7-1', name: 'Response time eval • 01/5/26', user: { name: 'Mona Kane', avatar: '/Mona Kane.png' }},
    { id: 'run-7-2', name: 'Response time eval • 12/10/25', user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' }},
  ].map(run => ({
    ...run,
    testMethodScores: calculateAggregateScores(
      evaluation7RunResults[run.id],
      ['Tool use', 'Keyword match'],
      20,
      50
    )
  }))

  // Evaluation 8: Accuracy test
  runs['8'] = [
    { id: 'run-8-1', name: 'Accuracy test • 01/5/26', user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' }},
    { id: 'run-8-2', name: 'Accuracy test • 12/28/25', user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' }},
    { id: 'run-8-3', name: 'Accuracy test • 12/14/25', user: { name: 'Mona Kane', avatar: '/Mona Kane.png' }},
    { id: 'run-8-4', name: 'Accuracy test • 11/28/25', user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' }},
    { id: 'run-8-5', name: 'Accuracy test • 11/12/25', user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' }},
    { id: 'run-8-6', name: 'Accuracy test • 10/25/25', user: { name: 'Mona Kane', avatar: '/Mona Kane.png' }},
    { id: 'run-8-7', name: 'Accuracy test • 10/8/25', user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' }},
    { id: 'run-8-8', name: 'Accuracy test • 09/20/25', user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' }},
  ].map(run => ({
    ...run,
    testMethodScores: calculateAggregateScores(
      evaluation8RunResults[run.id],
      ['Response accuracy', 'Compare meaning'],
      55
    )
  }))

  // Evaluation 9: Integration test
  runs['9'] = [
    { id: 'run-9-1', name: 'Integration test • 01/4/26', user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' }},
    { id: 'run-9-2', name: 'Integration test • 12/25/25', user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' }},
    { id: 'run-9-3', name: 'Integration test • 12/10/25', user: { name: 'Mona Kane', avatar: '/Mona Kane.png' }},
    { id: 'run-9-4', name: 'Integration test • 11/25/25', user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' }},
    { id: 'run-9-5', name: 'Integration test • 11/10/25', user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' }},
    { id: 'run-9-6', name: 'Integration test • 10/26/25', user: { name: 'Mona Kane', avatar: '/Mona Kane.png' }},
    { id: 'run-9-7', name: 'Integration test • 10/11/25', user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' }},
    { id: 'run-9-8', name: 'Integration test • 09/26/25', user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' }},
    { id: 'run-9-9', name: 'Integration test • 09/11/25', user: { name: 'Mona Kane', avatar: '/Mona Kane.png' }},
    { id: 'run-9-10', name: 'Integration test • 08/27/25', user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' }},
  ].map(run => ({
    ...run,
    testMethodScores: calculateAggregateScores(
      evaluation9RunResults[run.id],
      ['Tool use', 'Tone of voice'],
      20,
      40
    )
  }))

  // Evaluation 10: Policy compliance eval
  runs['10'] = [
    { id: 'run-10-1', name: 'Policy compliance eval • 01/3/26', user: { name: 'Mona Kane', avatar: '/Mona Kane.png' }},
  ].map(run => ({
    ...run,
    testMethodScores: calculateAggregateScores(
      evaluation10RunResults[run.id],
      ['Policy compliance', 'Text similarity'],
      55
    )
  }))

  // Evaluation 11: Daily agent check
  runs['11'] = [
    { id: 'run-11-1', name: 'Daily agent check • 01/3/26', user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' }},
    { id: 'run-11-2', name: 'Daily agent check • 12/18/25', user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' }},
    { id: 'run-11-3', name: 'Daily agent check • 12/2/25', user: { name: 'Mona Kane', avatar: '/Mona Kane.png' }},
    { id: 'run-11-4', name: 'Daily agent check • 11/16/25', user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' }},
    { id: 'run-11-5', name: 'Daily agent check • 10/30/25', user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' }},
  ].map(run => ({
    ...run,
    testMethodScores: calculateAggregateScores(
      evaluation11RunResults[run.id],
      ['General quality', 'Text similarity', 'Tone of voice'],
      20
    )
  }))

  // Evaluation 12: Workflow validation
  runs['12'] = [
    { id: 'run-12-1', name: 'Workflow validation • 01/2/26', user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' }},
    { id: 'run-12-2', name: 'Workflow validation • 12/12/25', user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' }},
    { id: 'run-12-3', name: 'Workflow validation • 11/22/25', user: { name: 'Mona Kane', avatar: '/Mona Kane.png' }},
    { id: 'run-12-4', name: 'Workflow validation • 11/2/25', user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' }},
  ].map(run => ({
    ...run,
    testMethodScores: calculateAggregateScores(
      evaluation12RunResults[run.id],
      ['Tool use', 'Compare meaning'],
      55,
      50
    )
  }))

  // Evaluation 13: Message quality eval
  runs['13'] = [
    { id: 'run-13-1', name: 'Message quality eval • 01/2/26', user: { name: 'Mona Kane', avatar: '/Mona Kane.png' }},
    { id: 'run-13-2', name: 'Message quality eval • 12/16/25', user: { name: 'Mona Kane', avatar: '/Mona Kane.png' }},
    { id: 'run-13-3', name: 'Message quality eval • 11/30/25', user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' }},
    { id: 'run-13-4', name: 'Message quality eval • 11/14/25', user: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png' }},
    { id: 'run-13-5', name: 'Message quality eval • 10/29/25', user: { name: 'Mona Kane', avatar: '/Mona Kane.png' }},
    { id: 'run-13-6', name: 'Message quality eval • 10/13/25', user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' }},
  ].map(run => ({
    ...run,
    testMethodScores: calculateAggregateScores(
      evaluation13RunResults[run.id],
      ['Sentiment appropriateness', 'Keyword match'],
      20,
      40
    )
  }))

  // Evaluation 14: Prompt effectiveness eval
  runs['14'] = [
    { id: 'run-14-1', name: 'Prompt effectiveness eval • 01/1/26', user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' }},
    { id: 'run-14-2', name: 'Prompt effectiveness eval • 12/8/25', user: { name: 'Alberto Burgos', avatar: '/Alberto Burgos.png' }},
    { id: 'run-14-3', name: 'Prompt effectiveness eval • 11/15/25', user: { name: 'Mona Kane', avatar: '/Mona Kane.png' }},
  ].map(run => ({
    ...run,
    testMethodScores: calculateAggregateScores(
      evaluation14RunResults[run.id],
      ['Text similarity', 'Response accuracy'],
      55
    )
  }))

  return runs
}

// Export updated evaluation runs
export const updatedMockEvaluationRuns: Record<string, EvaluationRunEntry[]> = generateEvaluationRuns()
