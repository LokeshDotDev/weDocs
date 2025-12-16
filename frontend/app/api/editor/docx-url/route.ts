import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3001";

export async function GET(request: NextRequest) {
	try {
		const searchParams = request.nextUrl.searchParams;
		const key = searchParams.get("key");

		if (!key) {
			return NextResponse.json({ error: "key is required" }, { status: 400 });
		}

		console.log(
			`[docx-url] Fetching from: ${API_BASE}/api/files/docx-url?key=${key}`
		);
		const response = await fetch(
			`${API_BASE}/api/files/docx-url?key=${encodeURIComponent(key)}`
		);

		if (!response.ok) {
			console.error(`[docx-url] Backend returned ${response.status}`);
			const text = await response.text();
			console.error(`[docx-url] Response: ${text}`);
			throw new Error(
				`Failed to get DOCX URL from backend: ${response.statusText}`
			);
		}

		const data = await response.json();
		console.log(`[docx-url] Got URL, returning to frontend`);
		return NextResponse.json(data);
	} catch (error) {
		console.error("[docx-url] Error:", error);
		return NextResponse.json(
			{
				error: `Failed to get DOCX URL: ${
					error instanceof Error ? error.message : String(error)
				}`,
			},
			{ status: 500 }
		);
	}
}
