import type { SimulationReport, TestResult } from './types.js';

const PERFORMANCE_THRESHOLDS_MS: Record<string, number> = {
  login: 2000,
  feed_load: 3000,
  post_create: 2000,
  comment_create: 2000,
  health: 500,
};

export function computeHealthScore(report: Omit<SimulationReport, 'overallHealthScore' | 'productionReadinessScore'>): number {
  if (report.testsExecuted === 0) return 0;

  const passRate = report.passedTests / report.testsExecuted;
  let score = passRate * 70;

  const criticalPenalty = report.criticalBugs.length * 15;
  const highPenalty = report.highPriorityBugs.length * 8;
  const mediumPenalty = report.mediumPriorityBugs.length * 3;
  score -= criticalPenalty + highPenalty + mediumPenalty;

  const regressions = report.performanceFindings.filter((p) => p.regression).length;
  score -= regressions * 5;

  const dbIssues = report.databaseFindings.filter((d) => !d.passed).length;
  score -= dbIssues * 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function computeProductionReadinessScore(
  report: Omit<SimulationReport, 'overallHealthScore' | 'productionReadinessScore'>,
): number {
  let score = computeHealthScore(report);

  if (report.criticalBugs.length > 0) score = Math.min(score, 40);
  if (report.securityFindings.some((f) => !f.passed && f.severity === 'critical')) {
    score = Math.min(score, 30);
  }

  const manualCount = report.manualTestingRequirements.length;
  score -= Math.min(manualCount * 2, 20);

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function buildReport(
  runId: string,
  startedAt: Date,
  finishedAt: Date,
  config: SimulationReport['config'],
  results: TestResult[],
  performance: SimulationReport['performanceFindings'],
  consoleErrors: string[],
  workerErrors: string[],
  manualRequirements: SimulationReport['manualTestingRequirements'],
): SimulationReport {
  const failed = results.filter((r) => !r.passed && !r.manual);
  const passed = results.filter((r) => r.passed || r.manual);
  const skippedManual = results.filter((r) => r.manual).length;

  const criticalBugs = failed.filter((r) => r.severity === 'critical');
  const highPriorityBugs = failed.filter((r) => r.severity === 'high');
  const mediumPriorityBugs = failed.filter((r) => r.severity === 'medium');
  const lowPriorityBugs = failed.filter((r) => r.severity === 'low');

  const securityFindings = results.filter((r) => r.category === 'security');
  const databaseFindings = results.filter((r) => r.category === 'database');
  const apiFindings = results.filter((r) => r.category === 'api');
  const uiFindings = results.filter((r) => r.category === 'ui');

  const performanceWithRegression = performance.map((p) => ({
    ...p,
    thresholdMs: p.thresholdMs ?? PERFORMANCE_THRESHOLDS_MS[p.name],
    regression:
      p.regression ??
      (p.thresholdMs !== undefined
        ? p.durationMs > p.thresholdMs
        : PERFORMANCE_THRESHOLDS_MS[p.name] !== undefined &&
          p.durationMs > PERFORMANCE_THRESHOLDS_MS[p.name]),
  }));

  const suggestedImprovements: string[] = [];
  if (criticalBugs.length > 0) {
    suggestedImprovements.push('Resolve critical failures before deployment.');
  }
  if (manualRequirements.length > 5) {
    suggestedImprovements.push('Implement missing API features to increase automated coverage.');
  }
  if (performanceWithRegression.some((p) => p.regression)) {
    suggestedImprovements.push('Investigate performance regressions flagged in this run.');
  }
  if (securityFindings.some((f) => !f.passed)) {
    suggestedImprovements.push('Review failed security probes — potential authorization gaps.');
  }

  const partial: Omit<SimulationReport, 'overallHealthScore' | 'productionReadinessScore' | 'executiveSummary'> = {
    runId,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    config,
    testsExecuted: results.length,
    passedTests: passed.length,
    failedTests: failed.length,
    skippedManualTests: skippedManual,
    results,
    criticalBugs,
    highPriorityBugs,
    mediumPriorityBugs,
    lowPriorityBugs,
    securityFindings,
    performanceFindings: performanceWithRegression,
    databaseFindings,
    apiFindings,
    uiFindings,
    consoleErrors,
    workerErrors,
    manualTestingRequirements: manualRequirements,
    suggestedImprovements,
  };

  const overallHealthScore = computeHealthScore(partial);
  const productionReadinessScore = computeProductionReadinessScore(partial);

  const executiveSummary = [
    `Executed ${results.length} tests across ${config.concurrentUsers} simulated users in ${Math.round(partial.durationMs / 1000)}s.`,
    `${passed.length - skippedManual} passed, ${failed.length} failed, ${skippedManual} manual-only.`,
    criticalBugs.length > 0
      ? `${criticalBugs.length} critical issue(s) require immediate attention.`
      : 'No critical issues detected.',
    `Overall health: ${overallHealthScore}/100. Production readiness: ${productionReadinessScore}/100.`,
  ].join(' ');

  return {
    ...partial,
    executiveSummary,
    overallHealthScore,
    productionReadinessScore,
  };
}

export function formatReportMarkdown(report: SimulationReport): string {
  const lines: string[] = [
    '# MLetras Connect — Simulation Test Report',
    '',
    `**Run ID:** ${report.runId}`,
    `**Started:** ${report.startedAt}`,
    `**Finished:** ${report.finishedAt}`,
    `**Duration:** ${Math.round(report.durationMs / 1000)}s`,
    '',
    '## Executive Summary',
    '',
    report.executiveSummary,
    '',
    '## Scores',
    '',
    `| Metric | Score |`,
    `|--------|-------|`,
    `| Overall Health | ${report.overallHealthScore}/100 |`,
    `| Production Readiness | ${report.productionReadinessScore}/100 |`,
    '',
    '## Tests Executed',
    '',
    `- Total: ${report.testsExecuted}`,
    `- Passed: ${report.passedTests}`,
    `- Failed: ${report.failedTests}`,
    `- Manual-only: ${report.skippedManualTests}`,
    '',
  ];

  const section = (title: string, items: TestResult[]) => {
    if (items.length === 0) return;
    lines.push(`## ${title}`, '');
    for (const item of items) {
      lines.push(`- **${item.name}** (${item.category}) — ${item.message ?? (item.passed ? 'OK' : 'FAILED')}`);
    }
    lines.push('');
  };

  section('Critical Bugs', report.criticalBugs);
  section('High Priority Bugs', report.highPriorityBugs);
  section('Medium Priority Bugs', report.mediumPriorityBugs);
  section('Low Priority Bugs', report.lowPriorityBugs);

  if (report.securityFindings.filter((f) => !f.passed).length > 0) {
    lines.push('## Security Findings', '');
    for (const f of report.securityFindings.filter((x) => !x.passed)) {
      lines.push(`- ${f.name}: ${f.message}`);
    }
    lines.push('');
  }

  if (report.performanceFindings.length > 0) {
    lines.push('## Performance Findings', '');
    lines.push('| Operation | Duration (ms) | Threshold | Regression |');
    lines.push('|-----------|---------------|-----------|------------|');
    for (const p of report.performanceFindings) {
      lines.push(
        `| ${p.name} | ${Math.round(p.durationMs)} | ${p.thresholdMs ?? '—'} | ${p.regression ? 'YES' : 'no'} |`,
      );
    }
    lines.push('');
  }

  if (report.databaseFindings.filter((d) => !d.passed).length > 0) {
    lines.push('## Database Findings', '');
    for (const d of report.databaseFindings.filter((x) => !x.passed)) {
      lines.push(`- ${d.name}: ${d.message}`);
    }
    lines.push('');
  }

  if (report.manualTestingRequirements.length > 0) {
    lines.push('## Manual Testing Requirements', '');
    for (const m of report.manualTestingRequirements) {
      lines.push(`- **${m.feature}:** ${m.reason}`);
    }
    lines.push('');
  }

  if (report.suggestedImprovements.length > 0) {
    lines.push('## Suggested Improvements', '');
    for (const s of report.suggestedImprovements) {
      lines.push(`- ${s}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
