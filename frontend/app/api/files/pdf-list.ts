import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Adjust this path to wherever your PDFs are stored
const PDF_DIR = process.env.PDF_STORAGE_PATH || path.join(process.cwd(), "public", "uploads", "pdf");

export async function GET(request: NextRequest) {
  try {
    const files = fs.readdirSync(PDF_DIR)
      .filter((file) => file.toLowerCase().endsWith(".pdf"))
      .map((file) => ({
        key: file,
        name: file,
      }));
    return NextResponse.json({ files });
  } catch (error) {
    console.error("Error listing PDF files:", error);
    return NextResponse.json({ error: "Failed to list PDF files" }, { status: 500 });
  }
}
