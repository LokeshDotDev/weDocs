import { Client as MinIOClient } from 'minio';
import axios from 'axios';
import mammoth from 'mammoth';

interface DetectionResult {
  fileKey: string;
  fileName: string;
  overallAIPercentage: number;
  overallHumanPercentage: number;
  isLikelyAI: boolean;
  segments: TextSegment[];
  processingTime: number;
}

interface TextSegment {
  text: string;
  aiScore: number; // 0-1
  aiPercentage: number; // 0-100
  humanPercentage: number; // 0-100
  isAI: boolean;
  startIndex: number;
  endIndex: number;
}

interface BatchDetectionJob {
  jobId: string;
  fileKeys: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  results: DetectionResult[];
  progress: number; // 0-100
  startedAt: Date;
  completedAt?: Date;
}

const PYTHON_MANAGER_URL = process.env['PYTHON_MANAGER_URL'] || 'http://localhost:5000';
const BINOCULARS_THRESHOLD = 0.7; // AI detection threshold
const CHUNK_SIZE = 100; // characters per chunk to avoid timeouts

class AIDetectionService {
  private minioClient: MinIOClient;
  private jobs: Map<string, BatchDetectionJob> = new Map();

  constructor(minioClient: MinIOClient) {
    this.minioClient = minioClient;
  }

  /**
   * Extract text from DOCX file using mammoth
   */
  async extractTextFromDocx(fileKey: string): Promise<{ text: string; paragraphs: string[] }> {
    try {
      const stream = await this.minioClient.getObject('wedocs', fileKey);
      const chunks: Buffer[] = [];

      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', async () => {
          try {
            const buffer = Buffer.concat(chunks);

            // Use mammoth to extract text from DOCX
            const result = await mammoth.extractRawText({ buffer });
            const text = result.value;

            // Split into paragraphs (separated by double newlines)
            const paragraphs = text
              .split(/\n\n+/)
              .filter((p) => p.trim().length > 30)
              .map((p) => p.trim());

            resolve({
              text: text,
              paragraphs: paragraphs,
            });
          } catch (error) {
            reject(error);
          }
        });
        stream.on('error', reject);
      });
    } catch (error) {
      console.error(`[extractTextFromDocx] Error for ${fileKey}:`, error);
      throw error;
    }
  }

  /**
   * Call Python Manager for AI detection (routes to AI Detector module)
   */
  async callBinoculars(text: string): Promise<{ score: number; prediction: string }> {
    try {
      // Single chunk: 30 second timeout
      const response = await axios.post(
        `${PYTHON_MANAGER_URL}/ai-detection/detect`,
        { text },
        { timeout: 30000 }
      );

      return {
        score: response.data.score || 0.5,
        prediction: response.data.isAIGenerated ? 'ai' : 'human',
      };
    } catch (error) {
      console.warn(
        '[callBinoculars] Fallback to neutral 0.5:',
        error instanceof Error ? error.message : ''
      );
      return {
        score: 0.5,
        prediction: 'unknown',
      };
    }
  }

  /**
   * Detect AI for large text by chunking into 100-char segments and batching.
   */
  async detectByChunks(text: string): Promise<TextSegment[]> {
    // Split into fixed-size chunks (preserve order)
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += CHUNK_SIZE) {
      chunks.push(text.slice(i, i + CHUNK_SIZE));
    }

    // Call Python Manager batch endpoint
    try {
      console.log(`[detectByChunks] Processing ${chunks.length} chunks via batch endpoint...`);
      const response = await axios.post(
        `${PYTHON_MANAGER_URL}/ai-detection/batch-detect`,
        { texts: chunks },
        { timeout: 90000 } // 90 seconds for batch processing
      );

      const results = Array.isArray(response.data?.results) ? response.data.results : [];

      const segments: TextSegment[] = [];
      let cursor = 0;
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const r = results[i] || {};
        const rawScore = typeof r.score === 'number' ? r.score : 0.5;
        const scoreClamped = Math.min(Math.max(rawScore, 0), 1);
        const aiPercentage = Math.round(scoreClamped * 100);
        const humanPercentage = 100 - aiPercentage;
        const startIndex = cursor;
        const endIndex = cursor + chunk.length;
        cursor = endIndex;

        segments.push({
          text: chunk,
          aiScore: scoreClamped,
          aiPercentage,
          humanPercentage,
          isAI: scoreClamped > BINOCULARS_THRESHOLD,
          startIndex,
          endIndex,
        });
      }

      console.log(`[detectByChunks] ✅ Completed: ${segments.length} segments`);
      return segments;
    } catch (error) {
      // On timeout/error: return neutral segments to prevent cascading hangs
      console.warn(
        `[detectByChunks] ⚠️ Batch timed out (${chunks.length} chunks), returning neutral scores`,
        error instanceof Error ? error.message : ''
      );
      const segments: TextSegment[] = [];
      let cursor = 0;
      for (const chunk of chunks) {
        const startIndex = cursor;
        const endIndex = cursor + chunk.length;
        cursor = endIndex;
        // Return neutral score (0.5 = 50% AI, 50% human)
        segments.push({
          text: chunk,
          aiScore: 0.5,
          aiPercentage: 50,
          humanPercentage: 50,
          isAI: false,
          startIndex,
          endIndex,
        });
      }
      return segments;
    }
  }

  /**
   * Detect AI in file with per-paragraph analysis
   */
  async detectAIInFile(fileKey: string): Promise<DetectionResult> {
    const startTime = Date.now();

    try {
      // Extract text
      const { text, paragraphs } = await this.extractTextFromDocx(fileKey);

      // Prefer chunk-based detection for robustness on long texts
      const segments = await this.detectByChunks(text);

      // Calculate overall percentages (length-weighted average)
      let weightedSum = 0;
      let totalLen = 0;
      for (const s of segments) {
        const len = s.endIndex - s.startIndex;
        weightedSum += s.aiScore * len;
        totalLen += len;
      }

      // Calculate overall percentages
      const overallAIScore = totalLen > 0 ? weightedSum / totalLen : 0;
      const overallAIPercentage = Math.round(overallAIScore * 100);
      const overallHumanPercentage = 100 - overallAIPercentage;

      const result: DetectionResult = {
        fileKey,
        fileName: fileKey.split('/').pop() || fileKey,
        overallAIPercentage,
        overallHumanPercentage,
        isLikelyAI: overallAIScore > BINOCULARS_THRESHOLD,
        segments,
        processingTime: Date.now() - startTime,
      };

      return result;
    } catch (error) {
      console.error(`[detectAIInFile] Error for ${fileKey}:`, error);
      throw error;
    }
  }

  /**
   * Batch detect AI in multiple files
   */
  async batchDetectAI(fileKeys: string[]): Promise<string> {
    const jobId = `job-${Date.now()}`;
    const job: BatchDetectionJob = {
      jobId,
      fileKeys,
      status: 'processing',
      results: [],
      progress: 0,
      startedAt: new Date(),
    };

    this.jobs.set(jobId, job);

    // Process asynchronously
    (async () => {
      try {
        for (let i = 0; i < fileKeys.length; i++) {
          const fileKey = fileKeys[i];
          if (!fileKey) continue;

          const result = await this.detectAIInFile(fileKey);
          job.results.push(result);
          job.progress = Math.round(((i + 1) / fileKeys.length) * 100);
        }

        job.status = 'completed';
        job.completedAt = new Date();
      } catch (error) {
        console.error(`[batchDetectAI] Error in job ${jobId}:`, error);
        job.status = 'failed';
        job.completedAt = new Date();
      }
    })();

    return jobId;
  }

  /**
   * Get job status and results
   */
  getJobStatus(jobId: string): BatchDetectionJob | null {
    return this.jobs.get(jobId) || null;
  }
}

export default AIDetectionService;
