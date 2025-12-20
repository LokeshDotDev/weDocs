import { Router } from 'express';
import {
  listUsers,
  listUploads,
  listFormattedFiles,
  getFileList,
  loadFile,
  saveFile,
} from '../controllers/editorController';

const router = Router();

// Hierarchical selection: users -> uploads -> formatted files
router.get('/users', listUsers);
router.get('/uploads', listUploads);
router.get('/files', listFormattedFiles);

// Backward-compat endpoints for edited-files
router.get('/edited/files', getFileList);

// Load a specific edited file
router.get('/edited/:fileId', loadFile);

// Save changes to an edited file
router.patch('/edited/:fileId', saveFile);

export default router;
