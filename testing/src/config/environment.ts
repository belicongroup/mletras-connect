export interface SimulationConfig {
  apiUrl: string;
  concurrentUsers: number;
  durationSeconds: number;
  scenarios: string[] | 'all';
  requireTestRoutes: boolean;
  seed: number;
}

function parseIntEnv(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function loadConfig(argv: string[] = process.argv.slice(2)): SimulationConfig {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        flags.set(key, next);
        i++;
      } else {
        flags.set(key, 'true');
      }
    }
  }

  const scenarioArg = flags.get('scenarios') ?? process.env.SIM_SCENARIOS ?? '';
  const scenarios =
    scenarioArg.trim() === '' || scenarioArg === 'all'
      ? ('all' as const)
      : scenarioArg.split(',').map((s) => s.trim()).filter(Boolean);

  return {
    apiUrl: (flags.get('api') ?? process.env.SIM_API_URL ?? 'http://127.0.0.1:8787').replace(
      /\/$/,
      '',
    ),
    concurrentUsers: parseIntEnv(
      flags.get('personas') ?? process.env.SIM_CONCURRENT_USERS,
      5,
    ),
    durationSeconds: parseIntEnv(
      flags.get('duration') ?? process.env.SIM_DURATION_SECONDS,
      60,
    ),
    scenarios,
    requireTestRoutes:
      (flags.get('require-test-routes') ?? process.env.SIM_REQUIRE_TEST_ROUTES ?? 'true') !==
      'false',
    seed: parseIntEnv(flags.get('seed') ?? process.env.SIM_SEED, Date.now() % 1_000_000),
  };
}
