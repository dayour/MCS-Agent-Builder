import { authOracle } from './auth.oracle';
import { navigationOracle } from './navigation.oracle';
import { agentManagementOracle } from './agent-management.oracle';
import { buildOracle } from './build.oracle';
import { evaluationOracle } from './evaluation.oracle';
import { type Oracle } from './types';

export { type Oracle, type OracleContext } from './types';

export const ORACLES: Record<string, Oracle> = {
  auth: authOracle,
  navigation: navigationOracle,
  'agent-management': agentManagementOracle,
  build: buildOracle,
  evaluation: evaluationOracle,
};

export function getOracle(key: string): Oracle | undefined {
  return ORACLES[key];
}

export function listOracles(): string[] {
  return Object.keys(ORACLES);
}
