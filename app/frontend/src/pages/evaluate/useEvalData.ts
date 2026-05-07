import { useMemo } from 'react';
import { useAgent } from '../../context/AgentContext';
import { BucketStats, EvalSet, EvalConfig, EvalVerdict } from './types';
import { DEMO_EVAL_SETS, DEMO_EVAL_CONFIG } from './demoData';

export function useEvalData() {
  const { agentConfig } = useAgent();

  // Use agent's real evalSets if available, otherwise fall back to demo data
  const evalSets: EvalSet[] = (agentConfig as any).evalSets
    ?? (agentConfig as any).specData?.evalSets
    ?? DEMO_EVAL_SETS;

  const evalConfig: EvalConfig | null = (agentConfig as any).evalConfig
    ?? (agentConfig as any).specData?.evalConfig
    ?? DEMO_EVAL_CONFIG;

  const bucketStats: BucketStats[] = useMemo(() => {
    return evalSets.map(set => {
      const testedTests = set.tests.filter(t => t.lastResult !== null);
      const passCount = testedTests.filter(t => t.lastResult!.pass).length;
      const testedCount = testedTests.length;
      const passRate = testedCount > 0 ? Math.round((passCount / testedCount) * 100) : 0;
      return {
        name: set.name,
        description: set.description,
        passThreshold: set.passThreshold,
        totalTests: set.tests.length,
        testedCount,
        passCount,
        failCount: testedCount - passCount,
        passRate,
        meetsThreshold: testedCount > 0 && passRate >= set.passThreshold,
        methods: set.methods,
        tests: set.tests,
      };
    });
  }, [evalSets]);

  const hasEvalSets = evalSets.length > 0;
  const hasResults = bucketStats.some(b => b.testedCount > 0);
  const lastVerdict: EvalVerdict | null = evalConfig?.lastVerdict ?? null;
  const lastVerdictAt: string | null = evalConfig?.lastVerdictAt ?? null;

  const overallStats = useMemo(() => {
    const totalTests = bucketStats.reduce((sum, b) => sum + b.totalTests, 0);
    const totalTested = bucketStats.reduce((sum, b) => sum + b.testedCount, 0);
    const totalPass = bucketStats.reduce((sum, b) => sum + b.passCount, 0);
    const totalFail = totalTested - totalPass;
    const overallRate = totalTested > 0 ? Math.round((totalPass / totalTested) * 100) : 0;
    return { totalTests, totalTested, totalPass, totalFail, overallRate };
  }, [bucketStats]);

  return {
    evalSets,
    evalConfig,
    bucketStats,
    hasEvalSets,
    hasResults,
    lastVerdict,
    lastVerdictAt,
    overallStats,
    agentName: agentConfig.name,
  };
}
