import { Router, Request, Response } from 'express';
import HumanizerService from '../services/humanizerService.js';
import { minioClient } from '../lib/minio.js';

const router = Router();
const humanizerService = new HumanizerService(minioClient);

/**
 * Humanize single file
 * POST /api/humanizer/humanize-single
 */
router.post('/humanize-single', async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileKey } = req.body;

    if (!fileKey) {
      res.status(400).json({ error: 'fileKey required' });
      return;
    }

    const result = await humanizerService.humanizeFile(fileKey);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * Batch humanize multiple files
 * POST /api/humanizer/humanize-batch
 */
router.post('/humanize-batch', async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileKeys } = req.body;

    if (!Array.isArray(fileKeys) || fileKeys.length === 0) {
      res.status(400).json({ error: 'fileKeys array required' });
      return;
    }

    const jobId = await humanizerService.batchHumanize(fileKeys);
    res.json({ success: true, jobId, message: 'Humanization started' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * Get humanization job status
 * GET /api/humanizer/job/:jobId
 */
router.get('/job/:jobId', (req: Request, res: Response): void => {
  const { jobId } = req.params;

  if (!jobId) {
    res.status(400).json({ error: 'jobId required' });
    return;
  }

  const job = humanizerService.getJobStatus(jobId);

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
