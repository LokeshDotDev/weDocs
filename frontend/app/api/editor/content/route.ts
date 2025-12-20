import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const key = searchParams.get("key");
		if (!key) {
			return NextResponse.json({ error: "Missing key" }, { status: 400 });
		}
		const response = await fetch(
			`${API_BASE}/api/files/content?key=${encodeURIComponent(key)}`
		);
		if (!response.ok) {
			throw new Error(`API error: ${response.statusText}`);
		}
		const data = await response.json();
		return NextResponse.json(data);
	} catch (error) {
		console.error("Error fetching file content:", error);
		return NextResponse.json(
			{ error: "Failed to fetch content" },
			{ status: 500 }
		);
	}
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { key, html } = body;
		if (!key || !html) {
			return NextResponse.json(
				{ error: "Missing key or html" },
				{ status: 400 }
			);
		}
		const response = await fetch(
			`${API_BASE}/api/files/content?key=${encodeURIComponent(key)}`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ html }),
			}
		);
		if (!response.ok) {
			throw new Error(`API error: ${response.statusText}`);
		}
		const data = await response.json();
		return NextResponse.json(data);
	} catch (error) {
		console.error("Error saving file content:", error);
		return NextResponse.json(
			{ error: "Failed to save content" },
			{ status: 500 }
		);
	}
}
