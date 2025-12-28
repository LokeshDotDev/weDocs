import { NextRequest, NextResponse } from "next/server";
import minioClient from "@/lib/minioClient";

export async function GET(request: NextRequest) {
  try {
    const bucket = process.env.MINIO_BUCKET || "wedocs";
    const stream = minioClient.listObjectsV2(bucket, "", true);
    const files: { key: string; name: string }[] = [];
    for await (const obj of stream) {
      if (obj.name && obj.name.toLowerCase().endsWith(".pdf")) {
        files.push({ key: obj.name, name: obj.name });
      }
    }
    return NextResponse.json({ files });
  } catch (error) {
    console.error("Error listing PDF files from MinIO:", error);
    return NextResponse.json({ error: "Failed to list PDF files from MinIO" }, { status: 500 });
  }
}
