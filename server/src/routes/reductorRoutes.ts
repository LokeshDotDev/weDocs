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
  let { fileKey } = req.query;

  if (!fileKey || typeof fileKey !== 'string') {
    return res.status(400).send({ error: 'fileKey is required' });
  }

  // Decode the fileKey (it comes URL-encoded from the frontend)
  try {
    fileKey = decodeURIComponent(fileKey);
  } catch (e) {
    console.warn('Failed to decode fileKey, using as-is:', fileKey);
  }

  console.log('[reductor/download] Requested fileKey:', fileKey);

  try {
    // Check if file exists in MinIO first
    try {
      await minioClient.statObject(MINIO_BUCKET, fileKey);
      console.log('[reductor/download] File exists in MinIO');
    } catch (statErr: any) {
      console.error('[reductor/download] File not found in MinIO:', statErr.message);
      return res.status(404).json({ 
        error: 'File not found in MinIO',
        fileKey: fileKey,
        details: statErr.message 
      });
    }

    // Extract filename from fileKey (handle special characters)
    const filename = path.basename(fileKey);
    
    // Sanitize filename for Content-Disposition header (remove special chars that break headers)
    const safeFilename = filename
      .replace(/[^\x20-\x7E]/g, '-') // Replace non-ASCII with hyphen
      .replace(/["]/g, "'"); // Replace quotes with apostrophe

    console.log('[reductor/download] Streaming file:', filename);

    // Set proper headers for DOCX download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);

    // Stream directly from MinIO to client (more efficient than temp file)
    const stream = await minioClient.getObject(MINIO_BUCKET, fileKey);

    stream.on('error', (streamErr) => {
      console.error('[reductor/download] Stream error:', streamErr);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream file', details: streamErr.message });
      }
    });

    stream.on('end', () => {
      console.log('[reductor/download] Download completed successfully');
    });

    // Pipe the stream to response
    stream.pipe(res);

  } catch (err: any) {
    console.error('[reductor/download] Error:', err);
    const errorMessage = err.message || 'Failed to download file';
    
    if (!res.headersSent) {
      res.status(err.code === 'NotFound' || err.code === 'NoSuchKey' ? 404 : 500).json({ 
        error: errorMessage,
        fileKey: fileKey,
        details: err.code || 'Unknown error'
      });
    }
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

// NEW: Redact NAME and ROLL NUMBER using Reductor Service V3
router.post('/redact', async (req, res) => {
  const { fileKey, fileName, removeName, removeRollNo } = req.body;
  // Always use fileKey as the true MinIO key for all operations

  if (!fileKey || !fileName) {
    return res.status(400).json({ error: 'fileKey and fileName are required' });
  }

  const REDUCTOR_V3_URL = process.env.REDUCTOR_SERVICE_V3_URL || 'http://localhost:5018';
  const tmpDir = os.tmpdir();
  const inputPath = path.join(tmpDir, `reductor_input_${Date.now()}_${path.basename(fileKey)}`);
  const outputPath = path.join(tmpDir, `reductor_output_${Date.now()}_${path.basename(fileKey)}`);

  try {
    console.log('[reductor/redact] Downloading file from MinIO:', fileKey);
    // Download file from MinIO to temp location
    await new Promise<void>((resolve, reject) => {
      minioClient.fGetObject(MINIO_BUCKET, fileKey, inputPath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    let docxInputPath = inputPath;
    // If input is PDF, convert to DOCX first
    if (fileKey.toLowerCase().endsWith('.pdf')) {
      const converterUrl = `${MANAGER_URL}/convert/pdf-to-docx`;
      const converterResp = await axios.post(converterUrl, {
        user_id: 'auto',
        upload_id: 'auto',
        filename: fileKey, // always use the true MinIO key
        relative_path: fileKey // always use the true MinIO key
      }, { timeout: 180000 });
      if (converterResp.status !== 200 || !converterResp.data.converted_path) {
        throw new Error('PDF to DOCX conversion failed');
      }
      docxInputPath = converterResp.data.converted_path;
    }

    console.log('[reductor/redact] Calling reductor-service-v3 at:', REDUCTOR_V3_URL);
    // Call reductor-service-v3 to redact the document
    const response = await axios.post(
      `${REDUCTOR_V3_URL}/redact/document`,
      {
        input_file_path: docxInputPath,
        output_file_path: outputPath,
        file_format: 'docx',
        remove_name: removeName !== false,
        remove_roll_no: removeRollNo !== false
      },
      { timeout: 120000 }
    );

    if (response.status !== 200 || response.data.status !== 'success') {
      throw new Error('Redaction failed at service level');
    }

    const { redacted_name, redacted_roll_no } = response.data;
    console.log('[reductor/redact] Redaction complete. Uploading to MinIO...');
    // Upload redacted file back to MinIO
    const redactedFileName = fileName.replace(/(\.[^.]+)$/, '_redacted$1');
    const redactedKey = `${fileKey.split('/').slice(0, -1).join('/')}/${redactedFileName}`;
    await minioClient.fPutObject(MINIO_BUCKET, redactedKey, outputPath, {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
    console.log('[reductor/redact] Upload complete:', redactedKey);
    // Clean up temp files
    try {
      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);
    } catch (cleanupErr) {
      console.warn('[reductor/redact] Failed to clean up temp files:', cleanupErr);
    }
    res.json({
      status: 'success',
      originalFile: fileKey,
      redactedFile: redactedKey,
      redactedName: redacted_name,
      redactedRollNo: redacted_roll_no
    });
  } catch (err: any) {
    console.error('[reductor/redact] Error:', err.message);
    // Clean up temp files on error
    try {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    } catch (cleanupErr) {
      console.warn('[reductor/redact] Failed to clean up temp files:', cleanupErr);
    }
    res.status(500).json({ 
      error: err.message || 'Redaction failed',
      details: err.response?.data || null
    });
  }
});

// Debug endpoint to check if file exists in MinIO
router.get('/check-file', async (req, res) => {
  let { fileKey } = req.query;

  if (!fileKey || typeof fileKey !== 'string') {
    return res.status(400).json({ error: 'fileKey is required' });
  }

  // Decode the fileKey
  try {
    fileKey = decodeURIComponent(fileKey);
  } catch (e) {
    console.warn('Failed to decode fileKey, using as-is:', fileKey);
  }

  try {
    const stat = await minioClient.statObject(MINIO_BUCKET, fileKey);
    res.json({
      exists: true,
      fileKey: fileKey,
      size: stat.size,
      lastModified: stat.lastModified,
      etag: stat.etag,
    });
  } catch (err: any) {
    if (err.code === 'NotFound' || err.code === 'NoSuchKey') {
      res.status(404).json({
        exists: false,
        fileKey: fileKey,
        error: 'File not found in MinIO',
        code: err.code,
      });
    } else {
      res.status(500).json({
        exists: false,
        fileKey: fileKey,
        error: err.message,
        code: err.code,
      });
    }
  }
});

export default router;
