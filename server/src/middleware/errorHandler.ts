import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import logger from '../lib/logger.js';
import type { ApiError } from '../types/index.js';

export class AppError extends Error {
  public status: number;
  public code: string;
  public isOperational: boolean;
  public requestId?: string | undefined;

  constructor(message: string, status: number = 500, code: string = 'INTERNAL_ERROR', requestId?: string | undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.isOperational = true;
    this.requestId = requestId;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export const errorHandler = (
  err: Error | AppError | ZodError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const requestId = req.requestId;

  // Zod validation errors
  if (err instanceof ZodError) {
    const error: ApiError = {
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Invalid input data',
      details: err.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
      requestId,
    };

    logger.warn({ error: err, requestId }, 'Validation error');
    
    res.status(400).json({
      success: false,
      error,
      requestId,
    });
    return;
  }

  // Custom app errors
  if (err instanceof AppError) {
    const error: ApiError = {
      status: err.status,
      code: err.code,
      message: err.message,
      requestId,
    };

    logger.warn({ error: err, requestId }, 'Application error');
    
    res.status(err.status).json({
      success: false,
      error,
      requestId,
    });
    return;
  }

  // Unexpected errors
  const error: ApiError = {
    status: 500,
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
    requestId,
  };

  logger.error({ error: err, requestId }, 'Unexpected error');
  
  res.status(500).json({
    success: false,
    error,
    requestId,
  });
};

export const notFoundHandler = (req: Request, res: Response): void => {
  const error: ApiError = {
    status: 404,
    code: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`,
    requestId: req.requestId,
  };

  res.status(404).json({
    success: false,
    error,
    requestId: req.requestId,
  });
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
