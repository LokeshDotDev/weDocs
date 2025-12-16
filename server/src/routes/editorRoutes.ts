import { Router } from 'express';
import { getFileList, loadFile, saveFile } from '../controllers/editorController';

const router = Router();

// Get the list of files
router.get('/files', getFileList);

// Load a specific file
router.get('/:fileId', loadFile);

// Save changes to a file
router.patch('/:fileId', saveFile);

export default router;
