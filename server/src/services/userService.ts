import { z } from 'zod';
import { db } from '../lib/db.js';
import { hashPassword, comparePassword, generateToken } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import type { CreateUserInput, LoginInput, User } from '../types/index.js';
import cache from '../lib/cache.js';

const createUserSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100),
  role: z.string().optional().default('user'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export class UserService {
  static async createUser(input: CreateUserInput, requestId?: string): Promise<User> {
    const validation = createUserSchema.safeParse(input);
    if (!validation.success) {
      throw new AppError('Invalid input data', 400, 'VALIDATION_ERROR', requestId);
    }

    const { email, username, password, role } = validation.data;

    // Check if user already exists
    const existingUser = await db.client.user.findFirst({
      where: {
        OR: [
          { email },
          { username },
        ],
      },
    });

    if (existingUser) {
      throw new AppError('User already exists', 409, 'USER_EXISTS', requestId);
    }

    const hashedPassword = await hashPassword(password);

    const user = await db.client.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        role,
      },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Invalidate relevant caches
    await Promise.all([
      cache.del('users:all'),
      cache.del(`user:${user.id}`),
    ]);

    return user;
  }

  static async login(input: LoginInput, requestId?: string): Promise<{ user: User; token: string }> {
    const validation = loginSchema.safeParse(input);
    if (!validation.success) {
      throw new AppError('Invalid input data', 400, 'VALIDATION_ERROR', requestId);
    }

    const { email, password } = validation.data;

    const user = await db.client.user.findUnique({
      where: { email },
    });

    if (!user || !(await comparePassword(password, user.password))) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS', requestId);
    }

    const token = generateToken(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      token,
    };
  }

  static async getUserById(id: string, _requestId?: string): Promise<User | null> {
  const cacheKey = `user:${id}`;
  const cached = await cache.get<User | null>(cacheKey);
  if (cached !== undefined) return cached;

  const user = await db.client.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

  await cache.set(cacheKey, user);
  return user;
  }

  static async getAllUsers(_requestId?: string): Promise<User[]> {
  const cacheKey = 'users:all';
  const cached = await cache.get<User[]>(cacheKey);
  if (cached) return cached;

  const users = await db.client.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

  await cache.set(cacheKey, users);
  return users;
  }

  static async deleteUser(id: string, requestId?: string): Promise<void> {
    const user = await db.client.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND', requestId);
    }

    await db.client.user.delete({
      where: { id },
    });

    // Invalidate caches
    await Promise.all([
      cache.del('users:all'),
      cache.del(`user:${id}`),
    ]);
  }
}
