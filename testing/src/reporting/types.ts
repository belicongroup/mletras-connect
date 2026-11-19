export type BugSeverity = 'critical' | 'high' | 'medium' | 'low';

export type TestCategory =
  | 'auth'
  | 'profile'
  | 'feed'
  | 'posts'
  | 'comments'
  | 'notifications'
  | 'search'
  | 'security'
  | 'performance'
  | 'database'
  | 'api'
  | 'ui'
  | 'stress'
  | 'edge-case'
  | 'manual';

export interface TestResult {
  id: string;
  name: string;
  category: TestCategory;
  passed: boolean;
  severity: BugSeverity;
  durationMs: number;
  message?: string;
  expected?: unknown;
  actual?: unknown;
  persona?: string;
  endpoint?: string;
  statusCode?: number;
  manual?: boolean;
  manualReason?: string;
}

export interface PerformanceMetric {
  name: string;
  durationMs: number;
  thresholdMs?: number;
  regression?: boolean;
}

export interface SimulationReport {
  runId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  config: {
    apiUrl: string;
    concurrentUsers: number;
    durationSeconds: number;
    scenarios: string[] | 'all';
    seed: number;
  };
  executiveSummary: string;
  testsExecuted: number;
  passedTests: number;
  failedTests: number;
  skippedManualTests: number;
  results: TestResult[];
  criticalBugs: TestResult[];
  highPriorityBugs: TestResult[];
  mediumPriorityBugs: TestResult[];
  lowPriorityBugs: TestResult[];
  securityFindings: TestResult[];
  performanceFindings: PerformanceMetric[];
  databaseFindings: TestResult[];
  apiFindings: TestResult[];
  uiFindings: TestResult[];
  consoleErrors: string[];
  workerErrors: string[];
  manualTestingRequirements: Array<{ feature: string; reason: string }>;
  suggestedImprovements: string[];
  overallHealthScore: number;
  productionReadinessScore: number;
}

export class TestCollector {
  private results: TestResult[] = [];
  private performance: PerformanceMetric[] = [];
  private consoleErrors: string[] = [];
  private workerErrors: string[] = [];
  private manualRequirements: Array<{ feature: string; reason: string }> = [];
  private counter = 0;

  record(result: Omit<TestResult, 'id'>): TestResult {
    const entry: TestResult = { ...result, id: `test-${++this.counter}` };
    this.results.push(entry);
    return entry;
  }

  pass(
    name: string,
    category: TestCategory,
    durationMs: number,
    extras?: Partial<TestResult>,
  ): TestResult {
    return this.record({
      name,
      category,
      passed: true,
      severity: 'low',
      durationMs,
      ...extras,
    });
  }

  fail(
    name: string,
    category: TestCategory,
    severity: BugSeverity,
    durationMs: number,
    message: string,
    extras?: Partial<TestResult>,
  ): TestResult {
    return this.record({
      name,
      category,
      passed: false,
      severity,
      durationMs,
      message,
      ...extras,
    });
  }

  manual(feature: string, reason: string): void {
    this.manualRequirements.push({ feature, reason });
    this.record({
      name: `Manual: ${feature}`,
      category: 'manual',
      passed: true,
      severity: 'low',
      durationMs: 0,
      manual: true,
      manualReason: reason,
    });
  }

  recordPerformance(metric: PerformanceMetric): void {
    this.performance.push(metric);
  }

  addConsoleError(error: string): void {
    this.consoleErrors.push(error);
  }

  addWorkerError(error: string): void {
    this.workerErrors.push(error);
  }

  getResults(): TestResult[] {
    return [...this.results];
  }

  getPerformance(): PerformanceMetric[] {
    return [...this.performance];
  }

  getConsoleErrors(): string[] {
    return [...this.consoleErrors];
  }

  getWorkerErrors(): string[] {
    return [...this.workerErrors];
  }

  getManualRequirements(): Array<{ feature: string; reason: string }> {
    return [...this.manualRequirements];
  }
}
