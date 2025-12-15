// Ambient module declarations to satisfy TypeScript before dependencies are installed.
// These will be overridden by actual types after `npm ci`.
declare module 'rate-limit-redis' {
  export class RedisStore {
    constructor(options: Record<string, unknown>);
  }
}

declare module 'ioredis' {
  import { EventEmitter } from 'events';
  class IORedis extends EventEmitter {
    constructor(url?: string, options?: Record<string, unknown>);
    call(command: string, ...args: string[]): Promise<unknown>;
    on(event: 'error', listener: (err: unknown) => void): this;
  }
  export default IORedis;
}

// Minimal ambient types for lru-cache (v11 ships its own types; this is a safety net)
declare module 'lru-cache' {
  export class LRUCache<K extends string = string, V = unknown> {
    constructor(options?: { max?: number; ttl?: number });
    get(key: K): V | undefined;
    set(key: K, value: V, options?: { ttl?: number }): void;
    delete(key: K): void;
  }
}
