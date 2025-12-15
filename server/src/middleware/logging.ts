import { Request, Response, NextFunction } from 'express';
import pinoHttp from 'pino-http';
import { Prisma } from '@prisma/client';
import { db } from '../lib/db.js';
import logger from '../lib/logger.js';
import config from '../lib/config.js';
import type { RequestLogData, AuthenticatedRequest } from '../types/index.js';

// Define minimal factory and middleware types to avoid using 'any'
type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
type HttpMiddleware = (req: Request, res: Response, next: NextFunction) => void;
type PinoHttpOptions = {
  logger: import('pino').Logger;
  customLogLevel?: (req: Request, res: Response, err?: Error) => LogLevel;
  customSuccessMessage?: (req: Request, res: Response) => string;
  customErrorMessage?: (req: Request, res: Response, err: Error) => string;
  customProps?: (req: Request, res: Response) => Record<string, unknown>;
};
const pinoHttpFactory = pinoHttp as unknown as (opts: PinoHttpOptions) => HttpMiddleware;
const pinoHttpLogger = pinoHttpFactory({
  logger,
  customLogLevel: (_req: Request, res: Response, err: Error | undefined) => {
    if (res.statusCode >= 400 && res.statusCode < 500) return 'warn';
    if (res.statusCode >= 500 || err) return 'error';
    return 'info';
  },
  customSuccessMessage: (req: Request, res: Response) => {
    return `${req.method} ${req.url} - ${res.statusCode}`;
  },
  customErrorMessage: (req: Request, res: Response, err: Error) => {
    return `${req.method} ${req.url} - ${res.statusCode} - ${err?.message}`;
  },
  customProps: (req: Request) => ({
    requestId: (req as AuthenticatedRequest).requestId,
    userId: (req as AuthenticatedRequest).user?.id,
  }),
});

export const httpLogger = pinoHttpLogger;

export const dbLogger = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!config.LOG_REQUESTS_TO_DB) return next();
  const startTime = Date.now();
  
  const originalSend = res.send;
  let responseBody: unknown;
  
  res.send = function(body: unknown) {
    responseBody = body;
    return originalSend.call(this, body);
  };

  res.on('finish', async () => {
    // sampling to reduce write load
    if (config.LOG_DB_SAMPLE_RATE < 1 && Math.random() > config.LOG_DB_SAMPLE_RATE) return;
    const responseTime = Date.now() - startTime;
    
    const redactSensitive = (obj: unknown): unknown => {
      if (!obj || typeof obj !== 'object') return obj;
      const copy: Record<string, unknown> = Array.isArray(obj) ? [...(obj as unknown[])] as unknown as Record<string, unknown> : { ...(obj as Record<string, unknown>) };
      const sensitive = ['password', 'authorization', 'jwt', 'token', 'secret'];
      for (const key of Object.keys(copy)) {
        if (sensitive.includes(key.toLowerCase())) copy[key] = '[REDACTED]';
        else if (copy[key] && typeof copy[key] === 'object') copy[key] = redactSensitive(copy[key] as unknown);
      }
      return copy;
    };

    const safeTruncate = (val: unknown) => {
      try {
  const v = redactSensitive(val as unknown);
        const str = typeof v === 'string' ? v : JSON.stringify(v);
        if (str.length > config.LOG_DB_MAX_BODY_LENGTH) {
          return str.slice(0, config.LOG_DB_MAX_BODY_LENGTH) + `...(+${str.length - config.LOG_DB_MAX_BODY_LENGTH} more)`;
        }
        return JSON.parse(str);
      } catch {
        return undefined;
      }
    };

    const logData: RequestLogData = {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl || req.url,
      userAgent: req.get('user-agent') || undefined,
      ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || req.socket.remoteAddress || undefined,
      userId: req.user?.id || undefined,
      statusCode: res.statusCode,
      responseTime,
      requestBody: safeTruncate(req.body),
      responseBody: safeTruncate(responseBody),
      headers: Object.fromEntries(Object.entries(req.headers).slice(0, 50)) as Record<string, string>,
      query: req.query as Record<string, unknown>,
      params: req.params as Record<string, unknown>,
    };

    try {
      await db.client.requestLog.create({
        data: {
          requestId: logData.requestId,
          method: logData.method,
          url: logData.url,
          userAgent: logData.userAgent || null,
          ip: logData.ip || null,
          userId: logData.userId || null,
          statusCode: logData.statusCode || null,
          responseTime: logData.responseTime || null,
          requestBody: logData.requestBody as Prisma.InputJsonValue,
          responseBody: logData.responseBody as Prisma.InputJsonValue,
          headers: logData.headers as Prisma.InputJsonValue,
          query: logData.query as Prisma.InputJsonValue,
          params: logData.params as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      logger.error({ error, requestId: req.requestId }, 'Failed to log request to database');
    }
  });

  next();
};
