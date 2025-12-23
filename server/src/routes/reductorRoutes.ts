import { Router } from 'express';
import axios from 'axios';
import { minioClient } from '../lib/minio.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const router = Router();

const MANAGER_URL = process.env.PYTHON_MANAGER_URL || 'http://localhost:5002';
const REDUCTOR_SERVICE_V2_URL = process.env.REDUCTOR_SERVICE_V2_URL || 'http://localhost:5018';
const MINIO_BUCKET = process.env.MINIO_BUCKET || 'wedocs';

// List all PDF files (ONLY PDF - Reductor doesn't support DOCX/other formats)
router.get('/files', async (req, res) => {
  try {
    const objectList: any[] = [];
    const objectsStream = minioClient.listObjects(MINIO_BUCKET, '', true);

    objectsStream.on('data', (obj) => {
      const fileName = obj.name.toLowerCase();
      // ONLY accept PDF files
      if (fileName.endsWith('.pdf')) {
        objectList.push({
          name: obj.name,
          key: obj.name,
          size: obj.size,
          lastModified: obj.lastModified,
        });
      }
    });

    objectsStream.on('error', (err) => {
      res.status(500).send({ error: err.message });
    });

    objectsStream.on('end', () => {
      res.json({ 
        files: objectList,
        message: 'Reductor accepts only PDF files. Use Humanizer for DOCX.'
      });
    });
  } catch (err: any) {
    res.status(500).send({ error: err.message || 'Failed to list files' });
  }
});

// Anonymize a PDF file from MinIO using Reductor Service V2
router.post('/anonymize-file', async (req, res) => {
  const { fileKey } = req.body;

  if (!fileKey) {
    return res.status(400).send({ error: 'fileKey is required' });
  }

  // Validate file is PDF
  if (!fileKey.toLowerCase().endsWith('.pdf')) {
    return res.status(400).send({ 
      error: 'Reductor only accepts PDF files. For DOCX files, use the Humanizer service.' 
    });
  }

  try {
    // Call reductor service V2 - it handles download, conversion, anonymization, and upload
    const resp = await axios.post(
      `${REDUCTOR_SERVICE_V2_URL}/anonymize`,
      {
        bucket: MINIO_BUCKET,
        object_key: fileKey,
      },
      { timeout: 600000 }
    );

    if (resp.status !== 200 || resp.data.status !== 'success') {
      throw new Error(`Anonymization failed: ${resp.statusText || 'Unknown error'}`);
    }

    const result = resp.data;

    res.json({
      status: 'success',
      original_file: fileKey,
      anonymized_file: result.minio_output_key,
      download_url: `/api/reductor/download?fileKey=${encodeURIComponent(result.minio_output_key)}`,
      detected_before: result.detected_before,
      detected_after: result.detected_after,
      removed_bytes: result.removed_bytes,
    });
  } catch (err: any) {
    console.error('Anonymization error:', err);
    res.status(500).send({ error: err.message || 'Anonymization failed' });
  }
});

// Download anonymized file
router.get('/download', async (req, res) => {
  const { fileKey } = req.query;

  if (!fileKey || typeof fileKey !== 'string') {
    return res.status(400).send({ error: 'fileKey is required' });
  }

  try {
    const tempPath = path.join(os.tmpdir(), `download-${Date.now()}.docx`);

    // Download from MinIO to temp
    await minioClient.fGetObject(MINIO_BUCKET, fileKey, tempPath);

    // Extract filename from fileKey
    const filename = path.basename(fileKey);

    // Set proper headers for DOCX download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Stream to client
    res.download(tempPath, filename, (err) => {
      if (err) console.error('Download error:', err);
      // Clean up after download completes
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    });
  } catch (err: any) {
    res.status(404).send({ error: err.message || 'File not found' });
  }
});

router.post('/anonymize-text', async (req, res) => {
  try {
    const url = `${MANAGER_URL}/reductor/anonymize-text`;
    const resp = await axios.post(url, req.body, { timeout: 120000 });
    res.status(resp.status).json(resp.data);
  } catch (err: any) {
    if (err.response) {
      res.status(err.response.status).send(err.response.data);
    } else {
      res.status(503).send({ error: err.message || 'Reductor unavailable' });
    }
  }
});

export default router;
