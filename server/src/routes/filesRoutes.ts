import { Router } from 'express';
import { listFiles, getFileUrl } from '../controllers/filesController.js';

const router = Router();

router.get('/list', listFiles);
router.get('/url', getFileUrl);

export default router;
