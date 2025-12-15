import { Router } from 'express';
import { healthCheck, getRequestLogs } from '../controllers/healthController.js';
import { basicAuth } from '../middleware/auth.js';

const router = Router();

router.get('/health', healthCheck);
router.get('/logs', basicAuth, getRequestLogs);

export default router;
