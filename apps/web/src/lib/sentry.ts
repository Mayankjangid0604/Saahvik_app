import * as Sentry from '@sentry/react';

/**
 * Initializes Sentry error tracking if VITE_SENTRY_DSN is configured. Safe
 * to call unconditionally — with no DSN set (the local dev default), this
 * is a no-op.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
  });
}

export { Sentry };
