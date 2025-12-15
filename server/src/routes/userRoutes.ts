import { Router } from 'express';
import { registerUser, loginUser, getMe, getAllUsers, getUserById, deleteUser } from '../controllers/userController.js';
import { jwtAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);

// Protected routes
router.get('/me', jwtAuth, getMe);
router.get('/', jwtAuth, requireRole(['admin']), getAllUsers);
router.get('/:id', jwtAuth, requireRole(['admin']), getUserById);
router.delete('/:id', jwtAuth, requireRole(['admin']), deleteUser);

export default router;
