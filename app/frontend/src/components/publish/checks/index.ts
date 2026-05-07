import { PublishCheck } from '../types';
import { agentSetupCheck } from './agentSetup';
import { testResultsCheck } from './testResultsCheck';
import { deploymentAppsCheck } from './deploymentAppsCheck';
import { policyCheck } from './policyCheck';

/**
 * Ordered registry of all publish checks.
 *
 * To add a check: import it and append to this array.
 * To remove a check: delete the import and remove from the array.
 * No other files need to change.
 */
export const publishChecks: PublishCheck[] = [
  agentSetupCheck,
  testResultsCheck,
  deploymentAppsCheck,
  policyCheck,
];

export { agentSetupCheck, testResultsCheck, deploymentAppsCheck, policyCheck };
