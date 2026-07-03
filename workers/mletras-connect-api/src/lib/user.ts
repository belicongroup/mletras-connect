/** Usernames are stored lowercase so uniqueness is case-insensitive. */
export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  country: string;
  state: string;
  city: string;
  instruments: string;
  created_at: string;
  updated_at: string | null;
  token_version: number;
  posts_count: number;
}

export function serializeUser(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    firstName: row.first_name ?? undefined,
    lastName: row.last_name ?? undefined,
    country: row.country,
    state: row.state,
    city: row.city,
    instruments: JSON.parse(row.instruments) as string[],
    createdAt: row.created_at,
  };
}

// Must stay in sync with the Instrument union in the client (src/types/index.ts).
export const INSTRUMENTS = new Set<string>([
  'Accordion',
  'Bajo Quinto',
  'Bajo Sexto',
  'Bass',
  'Drums',
  'Guitar',
  'Tololoche',
  'Keyboard',
  'Saxophone',
  'Trumpet',
  'Trombone',
  'Tuba',
  'Vocals',
  'Percussion',
  'Other',
]);
