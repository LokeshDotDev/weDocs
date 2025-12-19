import { Client as MinIOClient } from 'minio';
import fs from 'node:fs';
import { promisify } from 'node:util';
import { pipeline } from 'node:stream';
import os from 'node:os';
import path from 'node:path';
import { execFile as execFileCb } from 'node:child_process';
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

const DOCX_HUMANIZER_SCRIPT =
  process.env['DOCX_HUMANIZER_SCRIPT'] ||
  path.resolve(
    process.cwd(),
    '..',
    'ai-detector-and-humanizer',
    'humanizer',
    'docx_humanize_lxml.py'
  );
const DOCX_HUMANIZER_PYTHON = process.env['DOCX_HUMANIZER_PYTHON'] || 'python';
const DOCX_HUMANIZER_SKIP_DETECT = process.env['DOCX_HUMANIZER_SKIP_DETECT'] !== '0';

const execFile = promisify(execFileCb);
const pipelineAsync = promisify(pipeline);

class HumanizerService {
  private minioClient: MinIOClient;
  private jobs: Map<string, HumanizationJob> = new Map();

  constructor(minioClient: MinIOClient) {
    this.minioClient = minioClient;
  }

  private async runDocxHumanizer(inputPath: string, outputPath: string): Promise<void> {
    const args = [DOCX_HUMANIZER_SCRIPT, '--input', inputPath, '--output', outputPath];
    if (DOCX_HUMANIZER_SKIP_DETECT) {
      args.push('--skip-detect');
    }
    logger.info(
      {
        script: DOCX_HUMANIZER_SCRIPT,
        python: DOCX_HUMANIZER_PYTHON,
        skipDetect: DOCX_HUMANIZER_SKIP_DETECT,
        inputPath,
        outputPath,
      },
      '[runDocxHumanizer] start'
    );

    try {
      const { stdout, stderr } = await execFile(DOCX_HUMANIZER_PYTHON, args, {
        maxBuffer: 1024 * 1024 * 10,
      });

      if (stdout) {
        logger.info({ stdout }, '[runDocxHumanizer] stdout');
      }
      if (stderr) {
        logger.warn({ stderr }, '[runDocxHumanizer] stderr');
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

    // Process asynchronously
    (async () => {
      try {
        for (let i = 0; i < fileKeys.length; i++) {
          const fileKey = fileKeys[i];
          if (!fileKey) continue;

          const result = await this.humanizeFile(fileKey);
          job.results.push(result);
          job.progress = Math.round(((i + 1) / fileKeys.length) * 100);
        }

        job.status = 'completed';
        job.completedAt = new Date();
        logger.info({ jobId }, '[batchHumanize] completed');
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
