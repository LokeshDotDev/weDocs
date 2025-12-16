import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000";

export async function GET(
	request: NextRequest,
	{ params }: { params: { fileId: string } }
) {
	try {
		const { fileId } = params;

		if (!fileId) {
			return NextResponse.json({ error: "Missing fileId" }, { status: 400 });
		}

		const response = await fetch(
			`${API_BASE}/api/editor/${encodeURIComponent(fileId)}`,
			{
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
			}
		);

		if (!response.ok) {
			throw new Error(`API error: ${response.statusText}`);
		}

		const data = await response.json();
		return NextResponse.json(data);
	} catch (error) {
		console.error("Error loading file:", error);
		return NextResponse.json({ error: "Failed to load file" }, { status: 500 });
	}
}
