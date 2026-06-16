/**
 * Utility functions for formatting dates/times with proper timezone handling.
 * Sportmonks API returns all dates in UTC format: "YYYY-MM-DD HH:mm:ss"
 * We append 'Z' to make it an explicit UTC ISO string, then format using the user's local timezone.
 */

/**
 * Get today's LOCAL date as YYYY-MM-DD string.
 * IMPORTANT: Do NOT use new Date().toISOString().split('T')[0] — that returns UTC date
 * which can be a day ahead for users west of UTC (e.g., at 8PM CST, UTC is already next day).
 */
export function getLocalDateString(date?: Date): string {
  const d = date || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse a Sportmonks UTC date string into a Date object
 */
export function parseUTCDate(startingAt: string | undefined): Date {
  if (!startingAt) return new Date();
  return new Date(startingAt.replace(' ', 'T') + 'Z');
}

/**
 * Format match time in user's local timezone
 */
export function formatMatchTime(startingAt: string | undefined): string {
  const date = parseUTCDate(startingAt);
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format match date in user's local timezone
 */
export function formatMatchDate(startingAt: string | undefined, options?: Intl.DateTimeFormatOptions): string {
  const date = parseUTCDate(startingAt);
  return date.toLocaleDateString('es-MX', options || {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format full match date with weekday
 */
export function formatMatchDateFull(startingAt: string | undefined): string {
  const date = parseUTCDate(startingAt);
  return date.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}
