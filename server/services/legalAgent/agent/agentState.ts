/**
 * e-CASEVAULT Agent State
 * Tracks operational lifecycle of a query execution
 */

import { QueryAnalysis } from '../query/queryAnalyzer';
import { ExecutionPlan } from './planner';

export interface AgentExecutionState {
  traceId: string;
  startTime: number;
  user: {
    userId: string;
    badgeNo: string;
    role: string;
    station: string;
  };
  queryAnalysis?: QueryAnalysis;
  plan?: ExecutionPlan;
  executedSteps: string[];
  toolsCalled: string[];
  piiRedactedCount: number;
  isAccessDenied: boolean;
  accessDeniedReason?: string;
}
