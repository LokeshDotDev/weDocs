import axios from 'axios';
import { Request, Response } from 'express';
import logger from '../lib/logger.js';
import { config } from '../lib/config.js';

const PYTHON_MANAGER_URL = config.PYTHON_MANAGER_URL;

/**
 * Convert PDF to HTML via Python Manager
 * Request body: { user_id, upload_id, filename, relative_path }
 */
export async function convertPdfToHtml(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, upload_id, filename, relative_path } = req.body;

    // Validate required fields
    if (!user_id || !upload_id || !filename || !relative_path) {
      res.status(400).json({
        error: 'Missing required fields: user_id, upload_id, filename, relative_path',
      });
      return;
    }

    logger.info(
      {
        user_id,
        upload_id,
        filename,
      },
      '🔄 Forwarding conversion request to Python Manager'
    );

    // Call Python Manager API
    const response = await axios.post(`${PYTHON_MANAGER_URL}/convert/pdf-to-html`, {
      user_id,
      upload_id,
      filename,
      relative_path,
    });

    logger.info(
      {
        user_id,
        upload_id,
        filename,
        result: response.data,
      },
      '✅ Conversion successful'
    );

    res.status(200).json(response.data);
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      logger.error(
        {
          status: error.response?.status,
          data: error.response?.data,
        },
        '❌ Python Manager error'
      );
      res.status(error.response?.status || 500).json({
        error: error.response?.data || 'Conversion failed',
      });
    } else {
      logger.error({ error }, '❌ Conversion error');
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

/**
 * Convert PDF to HTML directly via Python Manager's direct endpoint (PyMuPDF)
 * Request body: { user_id, upload_id, filename, relative_path }
 */
export async function convertPdfToHtmlDirect(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, upload_id, filename, relative_path } = req.body;

    if (!user_id || !upload_id || !filename || !relative_path) {
      res.status(400).json({
        error: 'Missing required fields: user_id, upload_id, filename, relative_path',
      });
      return;
    }

    logger.info(
      { user_id, upload_id, filename },
      '🔄 Forwarding direct conversion to Python Manager'
    );

    const response = await axios.post(`${PYTHON_MANAGER_URL}/convert/pdf-to-html-direct`, {
      user_id,
      upload_id,
      filename,
      relative_path,
    });

    logger.info(
      { user_id, upload_id, filename, result: response.data },
      '✅ Direct conversion successful'
    );
    res.status(200).json(response.data);
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      logger.error(
        { status: error.response?.status, data: error.response?.data },
        '❌ Python Manager direct error'
      );
      res
        .status(error.response?.status || 500)
        .json({ error: error.response?.data || 'Direct conversion failed' });
    } else {
      logger.error({ error }, '❌ Direct conversion error');
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

/**
 * Convert multiple PDFs to HTML (batch processing)
 * Request body: { files: Array<{ user_id, upload_id, filename, relative_path, key }> }
 */
export async function convertBatch(req: Request, res: Response): Promise<void> {
  try {
    const { files } = req.body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      res.status(400).json({ error: 'files array is required' });
      return;
    }

    logger.info(`📦 Starting batch conversion for ${files.length} files`);

    const results = [];

    // Process files sequentially (file-by-file as requested)
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      try {
        logger.info(`🔄 Converting file ${i + 1}/${files.length}: ${file.filename}`);

        const response = await axios.post(`${PYTHON_MANAGER_URL}/convert/pdf-to-html`, {
          user_id: file.userId,
          upload_id: file.uploadId,
          filename: file.name,
          relative_path: file.relativePath,
        });

        results.push({
          ...file,
          status: 'success',
          result: response.data,
        });

        logger.info(`✅ File ${i + 1}/${files.length} converted successfully`);
      } catch (error: unknown) {
        logger.error({ error }, `❌ File ${i + 1}/${files.length} conversion failed`);

        results.push({
          ...file,
          status: 'error',
          error: axios.isAxiosError(error)
            ? error.response?.data || error.message
            : 'Unknown error',
        });
      }
    }

    const successCount = results.filter((r) => r.status === 'success').length;
    logger.info(`📊 Batch conversion complete: ${successCount}/${files.length} successful`);

    res.status(200).json({
      total: files.length,
      successful: successCount,
      failed: files.length - successCount,
      results,
    });
  } catch (error) {
    logger.error({ error }, '❌ Batch conversion error');
    res.status(500).json({ error: 'Batch conversion failed' });
  }
}
