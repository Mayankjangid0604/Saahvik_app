// Runs before the Nest app (and its ConfigModule) initializes for e2e tests.
// ConfigModule's internal dotenv load never overwrites variables already
// present in process.env, so setting these here points the whole app at the
// dedicated test database instead of the dev one, without touching .env.
process.env.DATABASE_URL =
  'postgresql://saahvik:saahvik@localhost:5432/saahvik_test?schema=public';
process.env.JWT_SECRET = 'test-secret-key-for-e2e-tests-only';
process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:5173';
process.env.NODE_ENV = 'test';
