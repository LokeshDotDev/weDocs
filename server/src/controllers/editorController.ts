import { Request, Response } from 'express';
import { minioClient } from '../lib/minio.js';

// Get the list of files
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
