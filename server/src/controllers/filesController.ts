import { Request, Response, NextFunction } from 'express';
import { minioClient } from '../lib/minio.js';
import { config } from '../lib/config.js';
import logger from '../lib/logger.js';

// If MINIO_PUBLIC_* is defined, rewrite presigned URLs so external clients (e.g.,
// ONLYOFFICE container) can reach MinIO via the published host/port.
function rewritePresignedUrlForPublicAccess(url: string): string {
  try {
    const publicHost = config.MINIO_PUBLIC_ENDPOINT;
    if (!publicHost || publicHost.length === 0) return url;
    const u = new URL(url);
    u.hostname = publicHost;
    if (typeof config.MINIO_PUBLIC_PORT === 'number' && !Number.isNaN(config.MINIO_PUBLIC_PORT)) {
      u.port = String(config.MINIO_PUBLIC_PORT);
    }
    if (typeof config.MINIO_PUBLIC_USE_SSL !== 'undefined') {
      u.protocol = config.MINIO_PUBLIC_USE_SSL ? 'https:' : 'http:';
    }
    return u.toString();
  } catch (e) {
    logger.warn({ e }, 'Failed to rewrite presigned URL; returning original');
    return url;
  }
}

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
    let url = await minioClient.presignedGetObject(config.MINIO_BUCKET, key as string, 60 * 60);
    url = rewritePresignedUrlForPublicAccess(url);

    res.json({ url });
  } catch (error) {
    logger.error({ error }, 'Error generating file URL');
    next(error);
  }
};

// List distinct users under bucket/users/<userId>/
export const listUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const prefix = `users/`;
    const users = new Set<string>();
    const stream = minioClient.listObjectsV2(config.MINIO_BUCKET, prefix, true);
    for await (const obj of stream) {
      if (obj.name) {
        const parts = obj.name.split('/');
        if (parts.length > 1 && parts[0] === 'users') {
          users.add(parts[1]);
        }
      }
    }
    const items = Array.from(users)
      .sort()
      .map((id) => ({ id }));
    res.json({ users: items, total: items.length });
  } catch (error) {
    logger.error({ error }, 'Error listing users');
    next(error);
  }
};

// List distinct uploadIds for a given user at users/<userId>/uploads/<uploadId>/
export const listUploads = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.query;
    if (!userId || typeof userId !== 'string') {
      res.status(400).json({ error: 'userId is required' });
      return;
    }
    const prefix = `users/${userId}/uploads/`;
    const uploads = new Set<string>();
    const stream = minioClient.listObjectsV2(config.MINIO_BUCKET, prefix, true);
    for await (const obj of stream) {
      if (obj.name) {
        const parts = obj.name.split('/');
        // users/userId/uploads/uploadId/...
        if (
          parts.length > 3 &&
          parts[0] === 'users' &&
          parts[1] === userId &&
          parts[2] === 'uploads'
        ) {
          uploads.add(parts[3]);
        }
      }
    }
    const items = Array.from(uploads)
      .sort()
      .map((id) => ({ id }));
    res.json({ uploads: items, total: items.length });
  } catch (error) {
    logger.error({ error }, 'Error listing uploads');
    next(error);
  }
};

// List formatted DOCX files for a given user/upload
export const listFormattedFiles = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId, uploadId } = req.query;
    if (!userId || typeof userId !== 'string') {
      res.status(400).json({ error: 'userId is required' });
      return;
    }
    if (!uploadId || typeof uploadId !== 'string') {
      res.status(400).json({ error: 'uploadId is required' });
      return;
    }
    const prefix = `users/${userId}/uploads/${uploadId}/formatted/`;
    const files: any[] = [];
    const stream = minioClient.listObjectsV2(config.MINIO_BUCKET, prefix, true);
    for await (const obj of stream) {
      if (
        obj.name &&
        (obj.name.toLowerCase().endsWith('.docx') ||
          obj.name.toLowerCase().endsWith('.doc') ||
          obj.name.toLowerCase().endsWith('.html') || // Keep for backward compatibility
          obj.name.toLowerCase().endsWith('.htm'))
      ) {
        const parts = obj.name.split('/');
        files.push({
          key: obj.name,
          name: parts[parts.length - 1],
          size: obj.size,
          lastModified: obj.lastModified,
        });
      }
    }
    res.json({ files, total: files.length });
  } catch (error) {
    logger.error({ error }, 'Error listing formatted files');
    next(error);
  }
};

// Get HTML content by object key
export const getFileContent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { key } = req.query;
    if (!key || typeof key !== 'string') {
      res.status(400).json({ error: 'key is required' });
      return;
    }
    const stream = await minioClient.getObject(config.MINIO_BUCKET, key);
    let html = '';
    for await (const chunk of stream) {
      html += chunk.toString();
    }
    res.json({ html });
  } catch (error) {
    logger.error({ error }, 'Error getting file content');
    next(error);
  }
};

// Save HTML content to object key
export const saveFileContent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { key } = req.query;
    const { html } = req.body as { html?: string };
    if (!key || typeof key !== 'string') {
      res.status(400).json({ error: 'key is required' });
      return;
    }
    if (!html) {
      res.status(400).json({ error: 'html is required' });
      return;
    }
    await minioClient.putObject(config.MINIO_BUCKET, key, html, html.length, {
      'Content-Type': 'text/html',
    });
    res.json({ message: 'File saved successfully' });
  } catch (error) {
    logger.error({ error }, 'Error saving file content');
    next(error);
  }
};

// Get DOCX file download URL for ONLYOFFICE
export const getDocxFileUrl = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { key } = req.query;
    if (!key || typeof key !== 'string') {
      res.status(400).json({ error: 'key is required' });
      return;
    }

    logger.info(`[getDocxFileUrl] Generating presigned URL for key: ${key}`);

    // Use simple public URL format instead of presigned URLs
    // This works because MINIO_ALLOW_PUBLIC_BUCKET_ACCESS=true in docker-compose
    const publicHost = config.MINIO_PUBLIC_ENDPOINT || config.MINIO_ENDPOINT || 'localhost';
    const publicPort = config.MINIO_PUBLIC_PORT || config.MINIO_PORT || '9000';
    const protocol = config.MINIO_PUBLIC_USE_SSL ? 'https' : 'http';

    const url = `${protocol}://${publicHost}:${publicPort}/${config.MINIO_BUCKET}/${key}`;
    logger.info(`[getDocxFileUrl] Public URL: ${url}`);

    // Add CORS headers so ONLYOFFICE and browser can fetch the document
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Expose-Headers', '*');

    res.json({ url, key });
  } catch (error) {
    logger.error({ error }, 'Error generating DOCX file URL');
    next(error);
  }
};

// Save DOCX file from ONLYOFFICE (callback handler)
export const saveDocxFile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get fileKey from query parameter (passed by frontend in callback URL)
    const { fileKey } = req.query;
    const { url } = req.body as { url?: string };

    if (!fileKey || typeof fileKey !== 'string') {
      res.status(400).json({ error: 'fileKey is required in query parameters' });
      return;
    }

    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: 'url is required in request body' });
      return;
    }

    logger.info(`[saveDocxFile] Saving edited DOCX for fileKey: ${fileKey}`);

    // Download the edited document from ONLYOFFICE
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to download edited document from ONLYOFFICE');
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Upload to MinIO using the original fileKey
    await minioClient.putObject(config.MINIO_BUCKET, fileKey, buffer, buffer.length, {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    logger.info(`[saveDocxFile] Saved edited DOCX file: ${fileKey}`);
    res.json({ message: 'File saved successfully', fileKey });
  } catch (error) {
    logger.error({ error }, 'Error saving DOCX file');
    next(error);
  }
};

// Stream DOCX by key directly from MinIO (no presigned URLs, no hostname rewrites)
export const streamDocxByKey = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { key } = req.query;
    if (!key || typeof key !== 'string') {
      res.status(400).json({ error: 'key is required' });
      return;
    }

    logger.info(`[streamDocxByKey] Streaming ${key}`);

    try {
      const stream = await minioClient.getObject(config.MINIO_BUCKET, key);

      // Set headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      res.setHeader('Content-Disposition', 'inline; filename="document.docx"');

      stream.on('error', (err) => {
        logger.error({ err, key }, '[streamDocxByKey] Stream error');
        if (!res.headersSent) {
          res.status(502).json({ error: 'Failed to read document' });
        } else {
          res.end();
        }
      });

      stream.pipe(res);
      stream.on('end', () => {
        logger.info(`[streamDocxByKey] Finished streaming ${key}`);
      });
    } catch (streamErr) {
      logger.error({ streamErr, key }, '[streamDocxByKey] Error getting object');
      throw streamErr;
    }
  } catch (error) {
    logger.error({ error }, '[streamDocxByKey] Failed');
    next(error);
  }
};

/**
 * Download file from MinIO
 * GET /api/files/download?fileKey=<minioFileKey>
 */
export const downloadFile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let { fileKey } = req.query;

    if (!fileKey || typeof fileKey !== 'string') {
      res.status(400).json({ error: 'fileKey query parameter is required' });
      return;
    }

    // Decode the fileKey (it comes URL-encoded from the frontend)
    try {
      fileKey = decodeURIComponent(fileKey);
    } catch (e) {
      logger.warn({ fileKey }, '[downloadFile] Failed to decode fileKey, using as-is');
    }

    logger.info({ fileKey }, '[downloadFile] Downloading file');

    // Check if file exists in MinIO first
    try {
      await minioClient.statObject(config.MINIO_BUCKET, fileKey);
      logger.info({ fileKey }, '[downloadFile] File exists in MinIO');
    } catch (statErr: any) {
      logger.error({ statErr, fileKey }, '[downloadFile] File not found in MinIO');
      if (!res.headersSent) {
        res.status(404).json({ 
          error: 'File not found in MinIO',
          fileKey: fileKey,
          details: statErr.message || statErr.code 
        });
      }
      return;
    }

    // Extract filename from fileKey (handle special characters)
    const filename = fileKey.split('/').pop() || 'document.docx';
    
    // Sanitize filename for Content-Disposition header (remove special chars that break headers)
    const safeFilename = filename
      .replace(/[^\x20-\x7E]/g, '-') // Replace non-ASCII with hyphen
      .replace(/["]/g, "'"); // Replace quotes with apostrophe

    logger.info({ filename, fileKey }, '[downloadFile] Streaming file');

    // Set proper headers for DOCX download with both safe and original filename
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);

    try {
      const stream = await minioClient.getObject(config.MINIO_BUCKET, fileKey);

      stream.on('error', (err) => {
        logger.error({ err, fileKey }, '[downloadFile] Stream error');
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to download file', details: err.message });
        }
      });

      stream.pipe(res);

      stream.on('end', () => {
        logger.info({ fileKey }, '[downloadFile] Download completed successfully');
      });
    } catch (streamErr: any) {
      logger.error({ streamErr, fileKey }, '[downloadFile] Error getting object');
      if (!res.headersSent) {
        res.status(streamErr.code === 'NotFound' || streamErr.code === 'NoSuchKey' ? 404 : 500).json({ 
          error: 'Failed to download file',
          fileKey: fileKey,
          details: streamErr.message || streamErr.code 
        });
      }
      return;
    }
  } catch (error) {
    logger.error({ error }, '[downloadFile] Failed');
    if (!res.headersSent) {
      next(error);
    }
  }
};

/**
 * Preview file - extract text content
 * GET /api/files/preview?fileKey=<minioFileKey>
 */
export const previewFile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { fileKey } = req.query;

    if (!fileKey || typeof fileKey !== 'string') {
      res.status(400).json({ error: 'fileKey query parameter is required' });
      return;
    }

    logger.info({ fileKey }, '[previewFile] Generating preview');

    if (fileKey.endsWith('.docx')) {
      try {
        const chunks: Buffer[] = [];
        const stream = await minioClient.getObject(config.MINIO_BUCKET, fileKey);

        for await (const chunk of stream) {
          chunks.push(chunk as Buffer);
        }

        const docxBuffer = Buffer.concat(chunks);

        try {
          const mammoth = await import('mammoth');
          const result = await mammoth.extractRawText({ buffer: docxBuffer });
          const text = result.value;
          
          res.setHeader('Content-Type', 'text/plain');
          res.send(text.substring(0, 5000));
        } catch (mammothErr) {
          logger.warn({ mammothErr }, '[previewFile] Mammoth extraction failed');
          res.setHeader('Content-Type', 'text/plain');
          res.send('[DOCX file - text extraction not available]');
        }
      } catch (docxErr) {
        logger.error({ docxErr, fileKey }, '[previewFile] Error extracting DOCX');
        throw docxErr;
      }
    } else {
      res.setHeader('Content-Type', 'text/plain');
      res.send(`[Preview for ${fileKey.split('/').pop()} not available]`);
    }
  } catch (error) {
    logger.error({ error }, '[previewFile] Failed');
    next(error);
  }
};
