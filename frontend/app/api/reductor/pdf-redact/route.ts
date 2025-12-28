import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import minioClient from "@/lib/minioClient";

// Adjust these paths as needed
const DOCX_DIR = process.env.DOCX_STORAGE_PATH || path.join(process.cwd(), "public", "uploads", "docx");

// Example: Call your backend services for conversion and redaction
async function convertPdfToDocx(pdfPath: string, docxPath: string): Promise<boolean> {
  // TODO: Replace with actual backend call or local conversion logic
  // For now, just simulate success
  return true;
}

async function redactDocx(docxPath: string, redactedDocxPath: string): Promise<boolean> {
  // TODO: Replace with actual backend call or local redaction logic
  // For now, just simulate success
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const { fileKey, removeName, removeRollNo } = await request.json();
    if (!fileKey) {
      return NextResponse.json({ error: "Missing fileKey" }, { status: 400 });
    }

    // Download PDF from MinIO to a temp file
    const bucket = process.env.MINIO_BUCKET || "wedocs";
    const tempPdfPath = path.join(os.tmpdir(), path.basename(fileKey));
    const pdfWriteStream = fs.createWriteStream(tempPdfPath);
    try {
      await new Promise<void>((resolve, reject) => {
        minioClient.getObject(bucket, fileKey, (err, dataStream) => {
          if (err) {
            console.error("MinIO getObject error:", {
              bucket,
              fileKey,
              minioConfig: {
                endPoint: process.env.MINIO_ENDPOINT,
                port: process.env.MINIO_PORT,
                useSSL: process.env.MINIO_USE_SSL,
                accessKey: process.env.MINIO_ACCESS_KEY,
                secretKey: process.env.MINIO_SECRET_KEY ? '***' : undefined,
              },
              error: err,
            });
            return reject(err);
          }
          dataStream.pipe(pdfWriteStream);
          dataStream.on("end", resolve);
          dataStream.on("error", (streamErr) => {
            console.error("Stream error while downloading from MinIO:", streamErr);
            reject(streamErr);
          });
        });
      });
    } catch (err) {
      console.error("Failed to download PDF from MinIO:", err);
      return NextResponse.json({
        error: "Failed to download PDF from MinIO",
        details: err && err.message ? err.message : err,
        bucket,
        fileKey,
      }, { status: 500 });
    }

    const docxFileName = path.basename(fileKey).replace(/\.pdf$/i, ".docx");
    const docxPath = path.join(DOCX_DIR, docxFileName);
    const redactedDocxFileName = path.basename(fileKey).replace(/\.pdf$/i, "_redacted.docx");
    const redactedDocxPath = path.join(DOCX_DIR, redactedDocxFileName);

    // 1. Convert PDF to DOCX (simulate or real)
    const converted = await convertPdfToDocx(tempPdfPath, docxPath);
    if (!converted) {
      return NextResponse.json({ error: "PDF to DOCX conversion failed" }, { status: 500 });
    }

    // 2. Call backend server for redaction, passing fileKey and fileName
    try {
      const backendResp = await fetch("http://localhost:3000/api/reductor/redact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileKey,
          fileName: docxFileName,
          removeName,
          removeRollNo
        }),
      });
      if (!backendResp.ok) {
        const errText = await backendResp.text();
        throw new Error(`Backend server error: ${errText}`);
      }
      const backendData = await backendResp.json();
      // Use the returned redacted file key if present
      if (!backendData.redactedFile) throw new Error("No redactedFile in backend response");
    } catch (err) {
      console.error("Failed to call backend server for redaction:", err);
      return NextResponse.json({ error: "Redaction failed", details: err && err.message ? err.message : err }, { status: 500 });
    }

    // 3. Upload redacted DOCX to MinIO
    const redactedKey = fileKey.replace(/\/raw\//, '/redacted/').replace(/\.pdf$/i, '_redacted.docx');
    try {
      await minioClient.fPutObject(bucket, redactedKey, redactedDocxPath, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    } catch (uploadErr) {
      console.error('Failed to upload redacted DOCX to MinIO:', uploadErr);
      return NextResponse.json({ error: 'Failed to upload redacted DOCX to MinIO', details: uploadErr && uploadErr.message ? uploadErr.message : uploadErr }, { status: 500 });
    }

    // 4. Return the MinIO key for the redacted DOCX
    return NextResponse.json({
      status: "success",
      redactedFileKey: redactedKey,
      originalFileKey: fileKey,
    });
  } catch (error) {
    console.error("Error in PDF → DOCX → Redact endpoint:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
