import { PrismaClient, Prisma } from '@prisma/client';
import logger from './logger.js';
import config from './config.js';

class Database {
  private static instance: Database;
  public client: PrismaClient<{
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'info' },
      { emit: 'event', level: 'warn' },
    ]
  }>;

  private constructor() {
    this.client = new PrismaClient({
      log: [
        ...(config.PRISMA_LOG_QUERIES ? [{ emit: 'event', level: 'query' } as const] : []),
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
      ],
    });

    // Event listeners for database monitoring
    if (config.PRISMA_LOG_QUERIES) {
      this.client.$on('query', (e: Prisma.QueryEvent) => {
        logger.debug({ query: e.query, params: e.params, duration: e.duration }, 'Database query');
      });
    }

    this.client.$on('error', (e: Prisma.LogEvent) => {
      logger.error({ target: e.target }, 'Database error');
    });
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  public async connect(): Promise<void> {
    try {
      await this.client.$connect();
      logger.info('✅ Database connected');
    } catch (error) {
      logger.error({ error }, '❌ Database connection failed');
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.client.$disconnect();
      logger.info('👋 Database disconnected');
    } catch (error) {
      logger.error({ error }, '❌ Database disconnection failed');
      throw error;
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      await this.client.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}

const db = Database.getInstance();
export { db };
export default Database;
