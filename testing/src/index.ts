#!/usr/bin/env node
import { loadConfig } from './config/environment.js';
import { SimulationOrchestrator } from './orchestrator/SimulationOrchestrator.js';

const config = loadConfig();
const orchestrator = new SimulationOrchestrator(config);

orchestrator.run().catch((err) => {
  console.error('Simulation crashed:', err);
  process.exit(1);
});
