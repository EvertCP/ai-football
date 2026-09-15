import { PrismaClient } from './generated/prisma/client';

function createPrismaClient(): PrismaClient | null {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn('[Prisma] DATABASE_URL no está configurado.');
    return null;
  }

  try {
    if (databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')) {
      /* eslint-disable @typescript-eslint/no-require-imports */
      const { PrismaPg } = require('@prisma/adapter-pg');
      /* eslint-enable @typescript-eslint/no-require-imports */
      const adapter = new PrismaPg(databaseUrl);
      return new PrismaClient({ adapter });
    }

    // Fallback to SQLite for legacy local development
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
    const path = require('path');
    /* eslint-enable @typescript-eslint/no-require-imports */
    const dbPath = path.join(process.cwd(), 'dev.db');
    const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
    return new PrismaClient({ adapter });
  } catch (error) {
    console.warn('[Prisma] No se pudo inicializar el cliente:', error);
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
