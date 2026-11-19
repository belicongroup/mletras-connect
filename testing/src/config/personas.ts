export type PersonaType =
  | 'new_user'
  | 'casual_user'
  | 'power_user'
  | 'content_creator'
  | 'heavy_commenter'
  | 'passive_reader'
  | 'moderator'
  | 'malicious_user'
  | 'spam_user'
  | 'offline_user';

export type ActionWeight = {
  action: string;
  weight: number;
};

export interface PersonaDefinition {
  type: PersonaType;
  label: string;
  description: string;
  actionWeights: ActionWeight[];
  /** Milliseconds between actions (min, max). */
  thinkTimeMs: [number, number];
  /** Probability [0-1] of performing edge-case behavior when available. */
  edgeCaseProbability: number;
  /** Probability [0-1] of security probes (malicious personas always 1). */
  securityProbeProbability: number;
}

const BASE_ACTIONS: ActionWeight[] = [
  { action: 'load_feed', weight: 20 },
  { action: 'refresh_feed', weight: 8 },
  { action: 'create_post', weight: 12 },
  { action: 'like_post', weight: 15 },
  { action: 'unlike_post', weight: 5 },
  { action: 'comment', weight: 12 },
  { action: 'reply', weight: 8 },
  { action: 'view_notifications', weight: 6 },
  { action: 'mark_notification_read', weight: 4 },
  { action: 'view_profile', weight: 5 },
  { action: 'edit_profile', weight: 3 },
  { action: 'delete_post', weight: 2 },
  { action: 'load_my_posts', weight: 5 },
];

export const PERSONA_DEFINITIONS: Record<PersonaType, PersonaDefinition> = {
  new_user: {
    type: 'new_user',
    label: 'New User',
    description: 'Recently signed up; explores cautiously.',
    actionWeights: [
      { action: 'load_feed', weight: 30 },
      { action: 'view_profile', weight: 15 },
      { action: 'create_post', weight: 5 },
      { action: 'like_post', weight: 10 },
      { action: 'comment', weight: 5 },
    ],
    thinkTimeMs: [2000, 8000],
    edgeCaseProbability: 0.05,
    securityProbeProbability: 0,
  },
  casual_user: {
    type: 'casual_user',
    label: 'Casual User',
    description: 'Regular browsing and occasional posts.',
    actionWeights: BASE_ACTIONS,
    thinkTimeMs: [1500, 5000],
    edgeCaseProbability: 0.1,
    securityProbeProbability: 0.02,
  },
  power_user: {
    type: 'power_user',
    label: 'Power User',
    description: 'Heavy engagement across all features.',
    actionWeights: BASE_ACTIONS.map((a) => ({
      ...a,
      weight: a.weight * (a.action.includes('post') || a.action.includes('comment') ? 1.8 : 1.2),
    })),
    thinkTimeMs: [500, 2000],
    edgeCaseProbability: 0.15,
    securityProbeProbability: 0.05,
  },
  content_creator: {
    type: 'content_creator',
    label: 'Content Creator',
    description: 'Primarily creates posts and media.',
    actionWeights: [
      { action: 'create_post', weight: 40 },
      { action: 'create_post_with_media', weight: 15 },
      { action: 'load_feed', weight: 15 },
      { action: 'load_my_posts', weight: 15 },
      { action: 'like_post', weight: 5 },
      { action: 'view_notifications', weight: 10 },
    ],
    thinkTimeMs: [1000, 4000],
    edgeCaseProbability: 0.1,
    securityProbeProbability: 0,
  },
  heavy_commenter: {
    type: 'heavy_commenter',
    label: 'Heavy Commenter',
    description: 'Comments and replies frequently.',
    actionWeights: [
      { action: 'comment', weight: 35 },
      { action: 'reply', weight: 30 },
      { action: 'load_feed', weight: 15 },
      { action: 'like_post', weight: 10 },
      { action: 'view_notifications', weight: 10 },
    ],
    thinkTimeMs: [800, 3000],
    edgeCaseProbability: 0.12,
    securityProbeProbability: 0,
  },
  passive_reader: {
    type: 'passive_reader',
    label: 'Passive Reader',
    description: 'Reads feed without much interaction.',
    actionWeights: [
      { action: 'load_feed', weight: 50 },
      { action: 'refresh_feed', weight: 20 },
      { action: 'scroll_feed', weight: 20 },
      { action: 'like_post', weight: 5 },
      { action: 'view_notifications', weight: 5 },
    ],
    thinkTimeMs: [3000, 10000],
    edgeCaseProbability: 0.05,
    securityProbeProbability: 0,
  },
  moderator: {
    type: 'moderator',
    label: 'Moderator',
    description: 'Reviews content and notifications (future moderation APIs).',
    actionWeights: [
      { action: 'load_feed', weight: 25 },
      { action: 'view_notifications', weight: 25 },
      { action: 'comment', weight: 10 },
      { action: 'delete_post', weight: 10 },
      { action: 'view_profile', weight: 15 },
      { action: 'load_my_posts', weight: 15 },
    ],
    thinkTimeMs: [1000, 4000],
    edgeCaseProbability: 0.08,
    securityProbeProbability: 0.1,
  },
  malicious_user: {
    type: 'malicious_user',
    label: 'Malicious User',
    description: 'Attempts unauthorized access and abuse.',
    actionWeights: [
      { action: 'security_probe', weight: 50 },
      { action: 'load_feed', weight: 10 },
      { action: 'rapid_requests', weight: 20 },
      { action: 'invalid_payload', weight: 20 },
    ],
    thinkTimeMs: [200, 1000],
    edgeCaseProbability: 0.5,
    securityProbeProbability: 1,
  },
  spam_user: {
    type: 'spam_user',
    label: 'Spam User',
    description: 'Rapid posts and comments to trigger rate limits.',
    actionWeights: [
      { action: 'create_post', weight: 30 },
      { action: 'comment', weight: 30 },
      { action: 'rapid_requests', weight: 25 },
      { action: 'like_post', weight: 15 },
    ],
    thinkTimeMs: [100, 500],
    edgeCaseProbability: 0.3,
    securityProbeProbability: 0.2,
  },
  offline_user: {
    type: 'offline_user',
    label: 'Offline User',
    description: 'Simulates flaky connectivity and retries.',
    actionWeights: [
      { action: 'load_feed', weight: 20 },
      { action: 'simulate_offline', weight: 30 },
      { action: 'simulate_slow_network', weight: 25 },
      { action: 'create_post', weight: 10 },
      { action: 'duplicate_request', weight: 15 },
    ],
    thinkTimeMs: [2000, 6000],
    edgeCaseProbability: 0.4,
    securityProbeProbability: 0,
  },
};

export const DEFAULT_PERSONA_ROTATION: PersonaType[] = [
  'new_user',
  'casual_user',
  'power_user',
  'content_creator',
  'heavy_commenter',
  'passive_reader',
  'moderator',
  'malicious_user',
  'spam_user',
  'offline_user',
];

export function pickPersonaForIndex(index: number): PersonaType {
  return DEFAULT_PERSONA_ROTATION[index % DEFAULT_PERSONA_ROTATION.length];
}
