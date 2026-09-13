import * as Sentry from '@sentry/node';

let initialized = false;

/**
 * Initializes Sentry error tracking if SENTRY_DSN is configured. Safe to
 * call unconditionally at bootstrap — in local dev, where no DSN is set,
 * this is a no-op so nothing breaks and nothing is sent anywhere.
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  });
  initialized = true;
}

export function isSentryInitialized(): boolean {
  return initialized;
}

export { Sentry };
