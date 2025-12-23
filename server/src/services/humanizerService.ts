import { Client as MinIOClient } from 'minio';
import fs from 'node:fs';
import { promisify } from 'node:util';
import { pipeline } from 'node:stream';
import os from 'node:os';
import path from 'node:path';
import axios from 'axios';
import logger from '../lib/logger.js';

interface HumanizationResult {
  fileKey: string;
  fileName: string;
  originalLength: number;
  humanizedLength: number;
  changesApplied: number;
  outputFileKey: string;
  processingTime: number;
}

interface HumanizationJob {
  jobId: string;
  fileKeys: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  results: HumanizationResult[];
  progress: number; // 0-100
  startedAt: Date;
  completedAt?: Date;
}

const PYTHON_MANAGER_URL = process.env['PYTHON_MANAGER_URL'] || 'http://localhost:5002';
const HUMANIZER_URL = process.env['HUMANIZER_URL'] || 'http://localhost:8000/humanize';

const pipelineAsync = promisify(pipeline);

class HumanizerService {
  private minioClient: MinIOClient;
  private jobs: Map<string, HumanizationJob> = new Map();

  constructor(minioClient: MinIOClient) {
    this.minioClient = minioClient;
  }

  private async runDocxHumanizer(inputPath: string, outputPath: string): Promise<void> {
    logger.info(
      {
        pythonManagerUrl: PYTHON_MANAGER_URL,
        humanizerUrl: HUMANIZER_URL,
        inputPath,
        outputPath,
      },
      '[runDocxHumanizer] start'
    );

    try {
      // Call Python Manager's /humanizer/humanize-docx endpoint
      const response = await axios.post(
        `${PYTHON_MANAGER_URL}/humanizer/humanize-docx`,
        {
          input_file_path: inputPath,
          output_file_path: outputPath,
          skip_detect: true,
          humanizer_url: HUMANIZER_URL,
        },
        {
          timeout: 600000, // 10 minutes
        }
      );

      if (response.data.stdout) {
        logger.info({ stdout: response.data.stdout }, '[runDocxHumanizer] stdout');
      }

      logger.info('[runDocxHumanizer] completed');
    } catch (err: unknown) {
      logger.error({ err }, '[runDocxHumanizer] failed');
      throw err;
    }
  }

  private async downloadToTemp(fileKey: string): Promise<{ inputPath: string; tmpDir: string }> {
    const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'humanize-'));
    const inputPath = path.join(tmpDir, path.basename(fileKey));
    const stream = await this.minioClient.getObject('wedocs', fileKey);
    await pipelineAsync(stream, fs.createWriteStream(inputPath));
    return { inputPath, tmpDir };
  }

  private deriveOutputKey(fileKey: string): string {
    if (fileKey.toLowerCase().endsWith('.docx')) {
      return fileKey.replace(/\.docx$/i, '_humanized.docx');
    }
    return `${fileKey}_humanized.docx`;
  }

  /**
   * Humanize single DOCX file
   */
  async humanizeFile(fileKey: string): Promise<HumanizationResult> {
    const startTime = Date.now();

    try {
      logger.info({ fileKey }, '[humanizeFile] start');

      const { inputPath, tmpDir } = await this.downloadToTemp(fileKey);
      const outputPath = path.join(tmpDir, `humanized_${path.basename(fileKey)}`);

      // Run the lxml-based humanizer script to preserve formatting
      await this.runDocxHumanizer(inputPath, outputPath);

      // Upload humanized DOCX back to MinIO
      const humanizedKey = this.deriveOutputKey(fileKey);
      const humanizedStat = await fs.promises.stat(outputPath);
      const originalStat = await fs.promises.stat(inputPath);

      await this.minioClient.putObject(
        'wedocs',
        humanizedKey,
        fs.createReadStream(outputPath),
        humanizedStat.size
      );

      // Cleanup temp files best-effort
      fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);

      logger.info(
        { fileKey, humanizedKey, durationMs: Date.now() - startTime },
        '[humanizeFile] success'
      );

      return {
        fileKey,
        fileName: fileKey.split('/').pop() || fileKey,
        originalLength: originalStat.size,
        humanizedLength: humanizedStat.size,
        changesApplied: Math.max(1, Math.abs(humanizedStat.size - originalStat.size)),
        outputFileKey: humanizedKey,
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      logger.error({ error, fileKey }, '[humanizeFile] error');
      throw error;
    }
  }

  /**
   * Batch humanize multiple files
   */
  async batchHumanize(fileKeys: string[]): Promise<string> {
    const jobId = `humanize-${Date.now()}`;
    const job: HumanizationJob = {
      jobId,
      fileKeys,
      status: 'processing',
      results: [],
      progress: 0,
      startedAt: new Date(),
    };

    this.jobs.set(jobId, job);

    logger.info({ jobId, fileCount: fileKeys.length }, '[batchHumanize] started');

    // Process asynchronously with controlled parallelism
    (async () => {
      try {
        const concurrencyLimit = 3; // Process 3 files at once (adjust based on resources)
        const results: HumanizationResult[] = [];

        // Process in batches to control memory usage
        for (let i = 0; i < fileKeys.length; i += concurrencyLimit) {
          const batch = fileKeys.slice(i, i + concurrencyLimit).filter(Boolean);

          logger.info(
            { batchSize: batch.length, batchStart: i },
            '[batchHumanize] processing batch'
          );

          // Process batch in parallel using Promise.allSettled (continues even if one fails)
          const batchResults = await Promise.allSettled(
            batch.map((fileKey) => this.humanizeFile(fileKey))
          );

          // Collect successful results
          for (const result of batchResults) {
            if (result.status === 'fulfilled') {
              results.push(result.value);
            } else {
              logger.error({ error: result.reason }, '[batchHumanize] file failed in batch');
            }
          }

          // Update progress after each batch
          job.results = results;
          job.progress = Math.round((results.length / fileKeys.length) * 100);
        }

        job.status = 'completed';
        job.completedAt = new Date();
        logger.info(
          { jobId, successCount: results.length, failCount: fileKeys.length - results.length },
          '[batchHumanize] completed'
        );
      } catch (error) {
        logger.error({ error, jobId }, '[batchHumanize] failed');
        job.status = 'failed';
        job.completedAt = new Date();
      }
    })();

    return jobId;
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): HumanizationJob | null {
    return this.jobs.get(jobId) || null;
  }
}

export default HumanizerService;
