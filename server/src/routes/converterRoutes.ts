import { Router } from 'express';
import {
  convertPdfToHtml,
  convertBatch,
  convertPdfToHtmlDirect,
} from '../controllers/converterController.js';

const router = Router();

/**
 * POST /api/converter/pdf-to-html
 * Convert PDF to HTML via Python Manager
 */
router.post('/pdf-to-html', convertPdfToHtml);

/**
 * POST /api/converter/pdf-to-html-direct
 * Direct PDF to HTML via Python Manager (PyMuPDF)
 */
router.post('/pdf-to-html-direct', convertPdfToHtmlDirect);

/**
 * POST /api/converter/batch
 * Convert multiple PDFs to HTML (batch processing)
 */
router.post('/batch', convertBatch);

export default router;
