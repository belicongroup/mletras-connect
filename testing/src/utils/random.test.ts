import { describe, expect, it } from 'vitest';
import { createRandom } from './random.js';
import { PERSONA_DEFINITIONS, pickPersonaForIndex } from '../config/personas.js';
import { loadConfig } from '../config/environment.js';

describe('personas', () => {
  it('rotates through all persona types', () => {
    const types = new Set(Array.from({ length: 10 }, (_, i) => pickPersonaForIndex(i)));
    expect(types.size).toBe(10);
  });

  it('assigns positive action weights', () => {
    for (const persona of Object.values(PERSONA_DEFINITIONS)) {
      const total = persona.actionWeights.reduce((s, w) => s + w.weight, 0);
      expect(total).toBeGreaterThan(0);
    }
  });
});

describe('config', () => {
  it('parses CLI flags', () => {
    const config = loadConfig(['--personas', '3', '--duration', '10', '--api', 'http://localhost:8787']);
    expect(config.concurrentUsers).toBe(3);
    expect(config.durationSeconds).toBe(10);
    expect(config.apiUrl).toBe('http://localhost:8787');
  });
});

describe('random', () => {
  it('is deterministic for same seed', () => {
    const a = createRandom(42);
    const b = createRandom(42);
    expect(a.int(1, 100)).toBe(b.int(1, 100));
  });
});
