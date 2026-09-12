/**
 * Minimal JWT decode (no validation - that's the server's job).
 */
export function jwtDecode<T = Record<string, unknown>>(token: string): T {
  const parts = token.split('.');
  const payload = parts[1];
  if (!payload) {
    throw new Error('Invalid JWT');
  }
  const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(decoded) as T;
}
