import { PrismaClient } from './generated/prisma/client';

function createPrismaClient(): PrismaClient | null {
  // SQLite with better-sqlite3 only works in environments with a writable filesystem.
  // On Vercel serverless, we skip DB initialization — prediction APIs return null gracefully.
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
    const path = require('path');
    /* eslint-enable @typescript-eslint/no-require-imports */
    const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
    const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
    return new PrismaClient({ adapter });
  } catch {
    console.warn('[Prisma] SQLite adapter not available — prediction storage disabled.');
    return null;
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | null | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
