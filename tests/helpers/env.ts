/**
 * Test environment. Imported first by `tests/setup.ts`, so every later import
 * sees the test database rather than the development one.
 */

/**
 * Point at its own database. The default matches docker-compose; override with
 * TEST_DATABASE_URL. `helpers/db.ts` refuses any name that does not end in
 * `_test`, so this cannot be aimed at a real database by accident.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/app_test";

export const TEST_AUTH_SECRET = "e2e-test-secret-0123456789abcdef0123456789";
export const TEST_AUTH_URL = "http://localhost:3000";

// The app reads these through parseEnv on every request.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.BETTER_AUTH_SECRET = TEST_AUTH_SECRET;
process.env.BETTER_AUTH_URL = TEST_AUTH_URL;
process.env.TEST_DATABASE_URL = TEST_DATABASE_URL;
