type RateLimitEntry = { count: number; resetAt: number };
const store = new Map<string, RateLimitEntry>();

export function rateLimit(key: string, limit: number, windowMs: number): { success: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, retryAfter: 0 };
  }

  if (entry.count >= limit) {
    return { success: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count += 1;
  store.set(key, entry);
  return { success: true, retryAfter: 0 };
}

export function rateLimitIp(request: Request, limit: number, windowMs: number): { success: boolean; retryAfter: number } {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
  return rateLimit(ip, limit, windowMs);
}
