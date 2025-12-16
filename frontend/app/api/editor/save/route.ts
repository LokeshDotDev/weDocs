import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000";

export async function POST(request: NextRequest) {
	try {
		const { fileId, content } = await request.json();

		if (!fileId || !content) {
			return NextResponse.json(
				{ error: "Missing fileId or content" },
				{ status: 400 }
			);
		}

		const response = await fetch(`${API_BASE}/api/editor/${fileId}`, {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ html: content }),
		});

		if (!response.ok) {
			throw new Error(`API error: ${response.statusText}`);
		}

		const data = await response.json();
		return NextResponse.json(data);
	} catch (error) {
		console.error("Error saving file:", error);
		return NextResponse.json({ error: "Failed to save file" }, { status: 500 });
	}
}
