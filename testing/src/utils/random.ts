export interface SeededRandom {
  next(): number;
  int(min: number, max: number): number;
  pick<T>(items: T[]): T;
  bool(probability?: number): boolean;
}

export function createRandom(seed: number): SeededRandom {
  let state = seed >>> 0;
  return {
    next(): number {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0x1_0000_0000;
    },
    int(min: number, max: number): number {
      return Math.floor(this.next() * (max - min + 1)) + min;
    },
    pick<T>(items: T[]): T {
      return items[Math.floor(this.next() * items.length)]!;
    },
    bool(probability = 0.5): boolean {
      return this.next() < probability;
    },
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function uniqueEmail(prefix: string, index: number): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}.${index}.${ts}.${rand}@sim.mletras.test`;
}

export function uniqueUsername(prefix: string, index: number): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}${index}${ts}${rand}`.slice(0, 24);
}

const SAMPLE_POSTS = [
  'Just finished rehearsing — ready for the weekend gig!',
  'Looking for a drummer in Austin. DM me!',
  'New track dropping soon. Who wants a sneak peek?',
  'Practice tip: slow down the metronome until every note is clean.',
  'Shoutout to everyone who came to the show last night.',
];

const SAMPLE_COMMENTS = [
  'Great post!',
  'Totally agree.',
  'Would love to collaborate.',
  'What key is this in?',
  'Fire 🔥',
];

export function randomPostText(rng: SeededRandom): string {
  return rng.pick(SAMPLE_POSTS) + ` #sim${rng.int(1000, 9999)}`;
}

export function randomCommentText(rng: SeededRandom): string {
  return rng.pick(SAMPLE_COMMENTS);
}

export function measure<T>(fn: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
  const start = performance.now();
  return fn().then((result) => ({
    result,
    durationMs: performance.now() - start,
  }));
}
