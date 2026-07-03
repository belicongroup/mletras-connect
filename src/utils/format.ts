/** Matches API: usernames are stored lowercase for case-insensitive uniqueness. */
export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function formatRelativeTime(isoDate: string): string {
  const diffSec = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (diffSec < 60) return 'now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d`;

  return new Date(isoDate).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function formatCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

export function getDisplayName(user: {
  firstName?: string;
  lastName?: string;
  username: string;
}): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
  return name || user.username;
}

export function getInitials(user: {
  firstName?: string;
  lastName?: string;
  username: string;
}): string {
  if (user.firstName) {
    return `${user.firstName[0]}${user.lastName?.[0] ?? ''}`.toUpperCase();
  }
  return user.username.slice(0, 2).toUpperCase();
}

export function getLocation(city: string, state: string): string {
  return `${city}, ${state}`;
}
