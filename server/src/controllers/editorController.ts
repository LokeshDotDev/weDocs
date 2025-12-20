import { Request, Response } from 'express';
import { minioClient } from '../lib/minio.js';

// List distinct users based on MinIO folder structure users/<userId>/...
export const listUsers = async (_req: Request, res: Response) => {
  try {
    const users = new Set<string>();
    const stream = minioClient.listObjectsV2('wedocs', 'users/', true);
    for await (const obj of stream) {
      if (!obj.name) continue;
      const parts = obj.name.split('/');
      if (parts.length > 1 && parts[0] === 'users' && parts[1]) {
        users.add(parts[1]);
      }
    }
    res.json({ users: Array.from(users).map((id) => ({ id })) });
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).json({ error: 'Failed to load users' });
  }
};

// List uploads for a given user (users/<userId>/uploads/<uploadId>/...)
export const listUploads = async (req: Request, res: Response) => {
  const { userId } = req.query;
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'userId is required' });
  }
  try {
    const uploads = new Set<string>();
    const prefix = `users/${userId}/uploads/`;
    const stream = minioClient.listObjectsV2('wedocs', prefix, true);
    for await (const obj of stream) {
      if (!obj.name) continue;
      const relative = obj.name.substring(prefix.length);
      const parts = relative.split('/');
      if (parts[0]) uploads.add(parts[0]);
    }
    res.json({ uploads: Array.from(uploads).map((id) => ({ id })) });
  } catch (error) {
    console.error('Error listing uploads:', error);
    res.status(500).json({ error: 'Failed to load uploads' });
  }
};

// List formatted files for a given user + upload (users/<userId>/uploads/<uploadId>/formatted/...)
export const listFormattedFiles = async (req: Request, res: Response) => {
  const { userId, uploadId } = req.query;
  if (!userId || typeof userId !== 'string' || !uploadId || typeof uploadId !== 'string') {
    return res.status(400).json({ error: 'userId and uploadId are required' });
  }
  try {
    const prefix = `users/${userId}/uploads/${uploadId}/formatted/`;
    const files: { key: string; name: string }[] = [];
    const stream = minioClient.listObjectsV2('wedocs', prefix, true);
    for await (const obj of stream) {
      if (!obj.name) continue;
      if (obj.name.endsWith('/')) continue;
      files.push({ key: obj.name, name: obj.name.substring(prefix.length) });
    }
    res.json({ files });
  } catch (error) {
    console.error('Error listing formatted files:', error);
    res.status(500).json({ error: 'Failed to load files' });
  }
};

// Backward-compat: list all edited files in edited-files/
export const getFileList = async (_req: Request, res: Response) => {
  try {
    const files = await minioClient.listObjects('wedocs', 'edited-files/', true);
    const fileList = [];
    for await (const file of files) {
      fileList.push({
        id: file.name,
        name: file.name.replace('edited-files/', ''),
      });
    }
    res.json({ files: fileList });
  } catch (error) {
    console.error('Error fetching file list:', error);
    res.status(500).json({ error: 'Failed to fetch file list' });
  }
};

// Load a specific file
export const loadFile = async (req: Request, res: Response) => {
  const { fileId } = req.params;
  try {
    const fileStream = await minioClient.getObject('wedocs', `edited-files/${fileId}`);
    let fileContent = '';
    for await (const chunk of fileStream) {
      fileContent += chunk.toString();
    }
    res.json({ html: fileContent });
  } catch (error) {
    console.error('Error loading file:', error);
    res.status(500).json({ error: 'Failed to load file' });
  }
};

// Save changes to a file
export const saveFile = async (req: Request, res: Response) => {
  const { fileId } = req.params;
  const { html } = req.body;
  try {
    await minioClient.putObject('wedocs', `edited-files/${fileId}`, html, html.length, {
      'Content-Type': 'text/html',
    });
    res.json({ message: 'File saved successfully' });
  } catch (error) {
    console.error('Error saving file:', error);
    res.status(500).json({ error: 'Failed to save file' });
  }
};
