/**
 * Vitest Test Setup
 *
 * Runs before each test file. Sets up test database connection,
 * Redis mock, and common test utilities.
 */

import { beforeAll, afterAll, beforeEach } from 'vitest';

// Set test environment variables before importing any app modules
process.env['NODE_ENV'] = 'test';
process.env['DATABASE_URL'] = process.env['TEST_DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5433/bd_pipeline_test';
process.env['REDIS_HOST'] = 'localhost';
process.env['REDIS_PORT'] = '6380';
process.env['JWT_SECRET'] = 'test-jwt-secret-at-least-32-chars-long!!';
process.env['JWT_REFRESH_SECRET'] = 'test-refresh-secret-at-least-32-chars!!';
process.env['PORT'] = '0'; // Random available port
process.env['OLLAMA_URL'] = 'http://localhost:11434';
process.env['OLLAMA_MODEL'] = 'gpt-oss:120b-cloud';

// Import after env is set
import { prisma } from '../config/db.js';

beforeAll(async () => {
  // Verify test DB is accessible
  try {
    await prisma.$connect();
  } catch {
    console.warn('Test database not available — some tests may be skipped');
  }
});

beforeEach(async () => {
  // Clean test data between tests (order matters due to FK constraints)
  const tablenames = await prisma.$queryRaw<
    Array<{ tablename: string }>
  >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

  const tables = tablenames
    .map(({ tablename }) => tablename)
    .filter((name) => name !== '_prisma_migrations');

  // Truncate all tables in a single transaction
  if (tables.length > 0) {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(',')} CASCADE`,
    );
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});
