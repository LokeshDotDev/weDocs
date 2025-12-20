import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const userId = searchParams.get("userId");
		const uploadId = searchParams.get("uploadId");
		if (!userId || !uploadId) {
			return NextResponse.json(
				{ error: "Missing userId or uploadId" },
				{ status: 400 }
			);
		}
		const response = await fetch(
			`${API_BASE}/api/editor/files?userId=${encodeURIComponent(
				userId
			)}&uploadId=${encodeURIComponent(uploadId)}`,
			{
				method: "GET",
				headers: { "Content-Type": "application/json" },
			}
		);
		if (!response.ok) {
			throw new Error(`API error: ${response.statusText}`);
		}
		const data = await response.json();
		const files = (data.files || []).map((file: any) => ({
			key: file.key,
			name: file.name,
			size: file.size,
			lastModified: file.lastModified,
		}));
		return NextResponse.json(files);
	} catch (error) {
		console.error("Error fetching files:", error);
		return NextResponse.json(
			{ error: "Failed to fetch files" },
			{ status: 500 }
		);
	}
}
