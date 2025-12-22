import { Router } from 'express';
import userRoutes from './userRoutes.js';
import healthRoutes from './healthRoutes.js';
import converterRoutes from './converterRoutes.js';
import filesRoutes from './filesRoutes.js';
import editorRoutes from './editorRoutes.js';
import aiDetectionRoutes from './aiDetection.js';
import humanizerRoutes from './humanizer.js';
import reductorRoutes from './reductorRoutes.js';

const router = Router();

router.use('/api/users', userRoutes);
router.use('/api/converter', converterRoutes);
router.use('/api/files', filesRoutes);
router.use('/api/editor', editorRoutes);
router.use('/api/ai-detection', aiDetectionRoutes);
router.use('/api/humanizer', humanizerRoutes);
router.use('/api/reductor', reductorRoutes);
router.use('/api', healthRoutes);

export default router;
