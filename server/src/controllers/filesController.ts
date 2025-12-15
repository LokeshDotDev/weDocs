import { Request, Response, NextFunction } from 'express';
import { minioClient } from '../lib/minio.js';
import { config } from '../lib/config.js';
import logger from '../lib/logger.js';

export const listFiles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId, stage = 'raw', fileType = 'pdf' } = req.query;

    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    const prefix = `users/${userId}/uploads/`;
    const files: any[] = [];

    const stream = minioClient.listObjectsV2(config.MINIO_BUCKET, prefix, true);

    for await (const obj of stream) {
      if (obj.name) {
        // Extract path parts
        const parts = obj.name.split('/');
        const stageIndex = parts.indexOf(stage as string);

        // Check if file is in requested stage and matches file type
        if (stageIndex !== -1 && obj.name.toLowerCase().endsWith(`.${fileType}`)) {
          const uploadId = parts[3]; // users/userId/uploads/uploadId/stage/...
          const relativePath = parts.slice(stageIndex + 1).join('/');

          files.push({
            key: obj.name,
            name: parts[parts.length - 1],
            size: obj.size,
            lastModified: obj.lastModified,
            userId: userId as string,
            uploadId,
            stage: stage as string,
            relativePath,
          });
        }
      }
    }

    logger.info(`Listed ${files.length} files for user ${userId} in stage ${stage}`);
    res.json({ files, total: files.length });
  } catch (error) {
    logger.error({ error }, 'Error listing files');
    next(error);
  }
};

export const getFileUrl = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { key } = req.query;

    if (!key) {
      res.status(400).json({ error: 'key is required' });
      return;
    }

    // Generate presigned URL (valid for 1 hour)
    const url = await minioClient.presignedGetObject(config.MINIO_BUCKET, key as string, 60 * 60);

    res.json({ url });
  } catch (error) {
    logger.error({ error }, 'Error generating file URL');
    next(error);
  }
};
