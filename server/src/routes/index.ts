import { Router } from 'express';
import userRoutes from './userRoutes.js';
import healthRoutes from './healthRoutes.js';
import converterRoutes from './converterRoutes.js';
import filesRoutes from './filesRoutes.js';

const router = Router();

router.use('/api/users', userRoutes);
router.use('/api/converter', converterRoutes);
router.use('/api/files', filesRoutes);
router.use('/api', healthRoutes);

export default router;
