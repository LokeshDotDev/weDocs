import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { db } from '../lib/db.js';
import config from '../lib/config.js';
import type { AuthenticatedRequest } from '../types/index.js';

const basicAuthSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export const basicAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Basic ')) {
    res.status(401).json({
      success: false,
      error: {
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Basic authentication required',
        requestId: req.requestId,
      },
      requestId: req.requestId,
    });
    return;
  }

  try {
    const credentials = Buffer.from(authHeader.split(' ')[1] || '', 'base64').toString();
    const [username, password] = credentials.split(':');
    
    const validation = basicAuthSchema.safeParse({ username, password });
    if (!validation.success) {
      throw new Error('Invalid credentials format');
    }

    if (username !== config.BASIC_AUTH_USERNAME || password !== config.BASIC_AUTH_PASSWORD) {
      throw new Error('Invalid credentials');
    }

    next();
  } catch {
    res.status(401).json({
      success: false,
      error: {
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Invalid credentials',
        requestId: req.requestId,
      },
      requestId: req.requestId,
    });
  }
};

export const jwtAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: {
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Bearer token required',
        requestId: req.requestId,
      },
      requestId: req.requestId,
    });
    return;
  }

  try {
    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new Error('No token provided');
    }
    
    const decoded = jwt.verify(token, config.JWT_SECRET) as { userId: string };
    
    const user = await db.client.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({
      success: false,
      error: {
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Invalid token',
        requestId: req.requestId,
      },
      requestId: req.requestId,
    });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: {
          status: 403,
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
          requestId: req.requestId,
        },
        requestId: req.requestId,
      });
      return;
    }
    next();
  };
};

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, config.BCRYPT_ROUNDS);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, config.JWT_SECRET, { expiresIn: '7d' });
};
