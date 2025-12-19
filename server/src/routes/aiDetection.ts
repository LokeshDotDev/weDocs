import { Router, Request, Response } from 'express';
import AIDetectionService from '../services/aiDetectionService.js';
import { minioClient } from '../lib/minio.js';

const router = Router();
const aiDetectionService = new AIDetectionService(minioClient);

/**
 * Detect AI in single file
 * POST /api/ai-detection/detect-single
 */
router.post('/detect-single', async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileKey } = req.body;

    if (!fileKey) {
      res.status(400).json({ error: 'fileKey required' });
      return;
    }

    const result = await aiDetectionService.detectAIInFile(fileKey);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * Start batch detection for multiple files
 * POST /api/ai-detection/detect-batch
 */
router.post('/detect-batch', async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileKeys } = req.body;

    if (!Array.isArray(fileKeys) || fileKeys.length === 0) {
      res.status(400).json({ error: 'fileKeys array required' });
      return;
    }

    const jobId = await aiDetectionService.batchDetectAI(fileKeys);
    res.json({ success: true, jobId, message: 'Detection started' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * Get batch detection job status
 * GET /api/ai-detection/job/:jobId
 */
router.get('/job/:jobId', (req: Request, res: Response): void => {
  const { jobId } = req.params;

  if (!jobId) {
    res.status(400).json({ error: 'jobId required' });
    return;
  }

  const job = aiDetectionService.getJobStatus(jobId);

  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  res.json({
    success: true,
    job: {
      jobId: job.jobId,
      status: job.status,
      progress: job.progress,
      resultsCount: job.results.length,
      results: job.status === 'completed' ? job.results : [],
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    },
  });
});

export default router;
