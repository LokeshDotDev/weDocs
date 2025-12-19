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

const BINOCULARS_API_URL = process.env['BINOCULARS_API_URL'] || 'http://localhost:5000';
const BINOCULARS_THRESHOLD = 0.9015; // Accuracy mode threshold

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
   * Call Binoculars API for detection
   */
  async callBinoculars(text: string): Promise<{ score: number; prediction: string }> {
    try {
      const response = await axios.post(`${BINOCULARS_API_URL}/detect`, {
        text: text,
        mode: 'accuracy', // Use accuracy mode for 95%+ F1
      });

      return {
        score: response.data.score,
        prediction: response.data.prediction, // "human" or "ai"
      };
    } catch (error) {
      console.error('[callBinoculars] Error:', error);
      // Fallback if Binoculars is down
      return {
        score: 0.5,
        prediction: 'unknown',
      };
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

      // Analyze each paragraph
      const segments: TextSegment[] = [];
      let totalAIScore = 0;

      for (let i = 0; i < paragraphs.length; i++) {
        const para = paragraphs[i];
        if (!para) continue;

        const detection = await this.callBinoculars(para);

        // Convert score (0-1) to percentage
        const aiPercentage = Math.round(detection.score * 100);
        const humanPercentage = 100 - aiPercentage;

        segments.push({
          text: para.substring(0, 200) + '...', // Truncate for display
          aiScore: detection.score,
          aiPercentage,
          humanPercentage,
          isAI: detection.score > BINOCULARS_THRESHOLD ? true : false,
          startIndex: text.indexOf(para),
          endIndex: text.indexOf(para) + para.length,
        });

        totalAIScore += detection.score;
      }

      // Calculate overall percentages
      const overallAIScore = segments.length > 0 ? totalAIScore / segments.length : 0;
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
