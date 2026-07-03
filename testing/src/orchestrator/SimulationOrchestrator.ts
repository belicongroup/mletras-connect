import type { SimulationConfig } from '../config/environment.js';
import { PERSONA_DEFINITIONS, pickPersonaForIndex } from '../config/personas.js';
import { buildReport, formatReportMarkdown } from '../reporting/ReportBuilder.js';
import { TestCollector } from '../reporting/types.js';
import {
  registerManualRequirements,
  runAuthScenario,
  runCommentsScenario,
  runDatabaseScenario,
  runEdgeCasesScenario,
  runFeedScenario,
  runMediaScenario,
  runNotificationsScenario,
  runPostsScenario,
  runProfileScenario,
  runSearchScenario,
  runSecurityScenario,
  runStressScenario,
} from '../scenarios/index.js';
import { SimulatedUser } from '../simulator/SimulatedUser.js';
import { createRandom, sleep } from '../utils/random.js';
import { ApiClient } from '../client/ApiClient.js';
import type { SharedState } from '../validators/SecurityValidator.js';
import { runSecurityProbes } from '../validators/SecurityValidator.js';
import { validateDbConsistency } from '../validators/ApiValidator.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ALL_SCENARIOS = [
  'auth',
  'profile',
  'feed',
  'posts',
  'media',
  'comments',
  'notifications',
  'search',
  'security',
  'stress',
  'edge-cases',
  'database',
] as const;

function shouldRun(config: SimulationConfig, name: string): boolean {
  return config.scenarios === 'all' || config.scenarios.includes(name);
}

export class SimulationOrchestrator {
  private readonly collector = new TestCollector();
  private readonly shared: SharedState = { posts: new Map(), users: new Map() };
  private readonly runId: string;

  constructor(private readonly config: SimulationConfig) {
    this.runId = `sim-${Date.now()}-${config.seed}`;
  }

  async run(): Promise<void> {
    const startedAt = new Date();
    const adminClient = new ApiClient(this.config.apiUrl, 'admin');

    console.log(`\n🎭 MLetras Connect Simulation — ${this.runId}`);
    console.log(`   API: ${this.config.apiUrl}`);
    console.log(`   Users: ${this.config.concurrentUsers} | Duration: ${this.config.durationSeconds}s\n`);

    // Preflight
    const health = await adminClient.get('/health', false);
    if (health.status !== 200) {
      console.error('❌ API unreachable. Start worker: npm run worker:dev:test');
      process.exit(1);
    }

    if (this.config.requireTestRoutes) {
      const testHealth = await adminClient.testHealth();
      if (testHealth.status !== 200 || !testHealth.data?.testMode) {
        console.error('❌ Test routes disabled. Run worker with ENABLE_TEST_ROUTES=true');
        process.exit(1);
      }
      this.collector.pass('Test routes enabled', 'api', testHealth.durationMs);
    }

    // Deterministic scenario suite (uses first authenticated user as harness)
    let harnessClient = adminClient;
    let harnessUser: SimulatedUser | null = null;

    if (shouldRun(this.config, 'auth') || this.needsHarness()) {
      const rng = createRandom(this.config.seed);
      harnessUser = new SimulatedUser(
        this.config.apiUrl,
        PERSONA_DEFINITIONS.new_user,
        0,
        rng,
      );
      const signedUp = await harnessUser.signup(this.shared);
      if (!signedUp) {
        this.collector.fail('Harness user signup', 'auth', 'critical', 0, 'Could not create test user');
      } else {
        harnessClient = harnessUser.client;
        this.collector.pass('Harness user created', 'auth', 0);
      }
    }

    if (harnessClient.getToken()) {
      if (shouldRun(this.config, 'auth')) await runAuthScenario(adminClient, this.collector, this.shared);
      if (shouldRun(this.config, 'profile')) await runProfileScenario(harnessClient, this.collector);
      if (shouldRun(this.config, 'feed')) await runFeedScenario(harnessClient, this.collector);
      if (shouldRun(this.config, 'posts')) await runPostsScenario(harnessClient, this.collector, this.shared);
      if (shouldRun(this.config, 'media')) await runMediaScenario(harnessClient, this.collector);
      if (shouldRun(this.config, 'comments')) await runCommentsScenario(harnessClient, this.collector);
      if (shouldRun(this.config, 'notifications')) await runNotificationsScenario(harnessClient, this.collector);
      if (shouldRun(this.config, 'search')) await runSearchScenario(harnessClient, this.collector);
      if (shouldRun(this.config, 'security')) await runSecurityScenario(harnessClient, this.collector, this.shared);
      if (shouldRun(this.config, 'stress')) await runStressScenario(harnessClient, this.collector);
      if (shouldRun(this.config, 'edge-cases')) await runEdgeCasesScenario(harnessClient, this.collector);
      if (shouldRun(this.config, 'database')) await runDatabaseScenario(harnessClient, this.collector);
    }

    await registerManualRequirements(this.collector);

    // Concurrent persona simulation
    const users = await this.spawnUsers();
    const deadline = Date.now() + this.config.durationSeconds * 1000;

    const userLoops = users.map((user) => this.runUserLoop(user, deadline));
    await Promise.all(userLoops);

    // Final DB check
    await validateDbConsistency(adminClient, this.collector, 'final');

    const finishedAt = new Date();
    const report = buildReport(
      this.runId,
      startedAt,
      finishedAt,
      {
        apiUrl: this.config.apiUrl,
        concurrentUsers: this.config.concurrentUsers,
        durationSeconds: this.config.durationSeconds,
        scenarios: this.config.scenarios,
        seed: this.config.seed,
      },
      this.collector.getResults(),
      this.collector.getPerformance(),
      this.collector.getConsoleErrors(),
      this.collector.getWorkerErrors(),
      this.collector.getManualRequirements(),
    );

    await this.writeReport(report);

    console.log('\n' + '═'.repeat(60));
    console.log(`Health Score: ${report.overallHealthScore}/100`);
    console.log(`Production Readiness: ${report.productionReadinessScore}/100`);
    console.log(`Passed: ${report.passedTests - report.skippedManualTests} | Failed: ${report.failedTests} | Manual: ${report.skippedManualTests}`);
    if (report.criticalBugs.length > 0) {
      console.log(`\n⚠️  ${report.criticalBugs.length} CRITICAL issue(s):`);
      for (const b of report.criticalBugs) console.log(`   - ${b.name}: ${b.message}`);
    }
    console.log('═'.repeat(60) + '\n');

    if (report.failedTests > 0) process.exit(1);
  }

  private needsHarness(): boolean {
    return ALL_SCENARIOS.some((s) => s !== 'auth' && shouldRun(this.config, s));
  }

  private async spawnUsers(): Promise<SimulatedUser[]> {
    const users: SimulatedUser[] = [];
    for (let i = 0; i < this.config.concurrentUsers; i++) {
      const personaType = pickPersonaForIndex(i);
      const persona = PERSONA_DEFINITIONS[personaType];
      const rng = createRandom(this.config.seed + i * 997);
      const user = new SimulatedUser(this.config.apiUrl, persona, i + 1, rng);
      const ok = await user.signup(this.shared);
      if (ok) {
        users.push(user);
        this.collector.pass(`Spawn ${persona.label} #${i + 1}`, 'auth', 0, { persona: persona.type });
      } else {
        this.collector.fail(`Spawn ${persona.label} #${i + 1}`, 'auth', 'high', 0, 'Signup failed');
      }
    }
    return users;
  }

  private async runUserLoop(user: SimulatedUser, deadline: number): Promise<void> {
    while (Date.now() < deadline) {
      const action = user.pickWeightedAction();
      await user.performAction(action, this.shared, this.collector);

      if (
        user.persona.securityProbeProbability > 0 &&
        user.persona.type === 'malicious_user'
      ) {
        await runSecurityProbes(user.client, this.collector, this.shared, user.persona.label);
      }

      await sleep(user.thinkTimeMs());
    }
  }

  private async writeReport(report: ReturnType<typeof buildReport>): Promise<void> {
    const dir = join(process.cwd(), 'reports', report.runId);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'report.json'), JSON.stringify(report, null, 2));
    await writeFile(join(dir, 'report.md'), formatReportMarkdown(report));
    console.log(`\n📄 Report written to testing/reports/${report.runId}/`);
  }
}
