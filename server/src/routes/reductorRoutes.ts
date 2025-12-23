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

// List all DOCX files from MinIO
router.get('/files', async (req, res) => {
  try {
    const objectList: any[] = [];
    const objectsStream = minioClient.listObjects(MINIO_BUCKET, '', true);

    objectsStream.on('data', (obj) => {
      if (obj.name.toLowerCase().endsWith('.docx')) {
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
      res.json({ files: objectList });
    });
  } catch (err: any) {
    res.status(500).send({ error: err.message || 'Failed to list files' });
  }
});

// Anonymize a DOCX file from MinIO
router.post('/anonymize-file', async (req, res) => {
  const { fileKey } = req.body;

  if (!fileKey) {
    return res.status(400).send({ error: 'fileKey is required' });
  }

  const tempDir = os.tmpdir();
  const inputPath = path.join(tempDir, `reductor-input-${Date.now()}.docx`);
  const outputPath = path.join(tempDir, `reductor-output-${Date.now()}.docx`);
  const anonymizedFileKey = `anonymized/${Date.now()}-${fileKey}`;

  try {
    // Download DOCX from MinIO
    await minioClient.fGetObject(MINIO_BUCKET, fileKey, inputPath);

    // Call reductor service V2 to anonymize
    const resp = await axios.post(
      `${REDUCTOR_SERVICE_V2_URL}/anonymize-docx`,
      {
        input_file_path: inputPath,
        output_file_path: outputPath,
      },
      { timeout: 600000 }
    );

    if (resp.status !== 200) {
      throw new Error(`Anonymization failed: ${resp.statusText}`);
    }

    // Upload anonymized file back to MinIO
    await minioClient.fPutObject(MINIO_BUCKET, anonymizedFileKey, outputPath, {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    // Clean up temp files
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);

    res.json({
      status: 'success',
      original_file: fileKey,
      anonymized_file: anonymizedFileKey,
      download_url: `/api/reductor/download?fileKey=${encodeURIComponent(anonymizedFileKey)}`,
    });
  } catch (err: any) {
    // Clean up on error
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

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

    // Stream to client
    res.download(tempPath, (err) => {
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
