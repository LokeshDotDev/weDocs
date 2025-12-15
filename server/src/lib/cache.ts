import config from './config.js';
import logger from './logger.js';
import Redis from 'ioredis';
import { LRUCache } from 'lru-cache';

type CacheValue = unknown;

class CacheClient {
  private redis: Redis | undefined;
  private mem = new LRUCache<string, CacheValue>({ max: config.CACHE_MAX_ITEMS, ttl: config.CACHE_TTL_SECONDS * 1000 });
  private enabled = config.ENABLE_CACHE;

  constructor() {
  if (this.enabled && config.REDIS_URL) {
      try {
        this.redis = new Redis(config.REDIS_URL, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableAutoPipelining: true,
        });
    this.redis.on('error', (err: unknown) => logger.warn({ err }, 'Redis cache error'));
      } catch (err) {
        logger.warn({ err }, 'Redis init failed; using memory cache');
    this.redis = undefined;
      }
    }
  }

  async get<T = unknown>(key: string): Promise<T | undefined> {
    if (!this.enabled) return undefined;
  if (this.redis) {
      try {
    // @ts-ignore ambient types are minimal
    const raw = await this.redis.get(key);
        return raw ? (JSON.parse(raw) as T) : undefined;
      } catch {
        // fall through to memory
      }
    }
    return this.mem.get(key) as T | undefined;
  }

  async set(key: string, value: CacheValue, ttlSeconds = config.CACHE_TTL_SECONDS): Promise<void> {
    if (!this.enabled) return;
    const ttlMs = ttlSeconds * 1000;
  if (this.redis) {
      try {
    // @ts-ignore ambient types are minimal
    await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
        return;
      } catch {
        // fall back
      }
    }
  this.mem.set(key, value, { ttl: ttlMs });
  }

  async del(key: string): Promise<void> {
    if (this.redis) {
      try { await (this.redis as unknown as { del: (k: string) => Promise<unknown> }).del(key); } catch { /* ignore */ }
    }
  this.mem.delete(key);
  }
}

export const cache = new CacheClient();
export default cache;
