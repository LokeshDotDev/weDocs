import { Request, Response } from 'express';
import { UserService } from '../services/userService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import type { AuthenticatedRequest } from '../types/index.js';

export const registerUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await UserService.createUser(req.body, req.requestId);
  
  res.status(201).json({
    success: true,
    data: { user },
    requestId: req.requestId,
  });
});

export const loginUser = asyncHandler(async (req: Request, res: Response) => {
  const result = await UserService.login(req.body, req.requestId);
  
  res.status(200).json({
    success: true,
    data: result,
    requestId: req.requestId,
  });
});

export const getMe = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.status(200).json({
    success: true,
    data: { user: req.user },
    requestId: req.requestId,
  });
});

export const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  const users = await UserService.getAllUsers(req.requestId);
  
  res.status(200).json({
    success: true,
    data: { users, count: users.length },
    requestId: req.requestId,
  });
});

export const getUserById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = req.params['id'];
  if (!userId) {
    res.status(400).json({
      success: false,
      error: {
        status: 400,
        code: 'BAD_REQUEST',
        message: 'User ID is required',
        requestId: req.requestId,
      },
      requestId: req.requestId,
    });
    return;
  }

  const user = await UserService.getUserById(userId, req.requestId);
  
  if (!user) {
    res.status(404).json({
      success: false,
      error: {
        status: 404,
        code: 'USER_NOT_FOUND',
        message: 'User not found',
        requestId: req.requestId,
      },
      requestId: req.requestId,
    });
    return;
  }
  
  res.status(200).json({
    success: true,
    data: { user },
    requestId: req.requestId,
  });
});

export const deleteUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = req.params['id'];
  if (!userId) {
    res.status(400).json({
      success: false,
      error: {
        status: 400,
        code: 'BAD_REQUEST',
        message: 'User ID is required',
        requestId: req.requestId,
      },
      requestId: req.requestId,
    });
    return;
  }

  await UserService.deleteUser(userId, req.requestId);
  
  res.status(204).send();
});
