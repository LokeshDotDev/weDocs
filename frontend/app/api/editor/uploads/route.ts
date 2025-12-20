import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const userId = searchParams.get("userId");
		if (!userId) {
			return NextResponse.json({ error: "Missing userId" }, { status: 400 });
		}
		const response = await fetch(
			`${API_BASE}/api/editor/uploads?userId=${encodeURIComponent(userId)}`,
			{
				method: "GET",
				headers: { "Content-Type": "application/json" },
			}
		);
		if (!response.ok) {
			throw new Error(`API error: ${response.statusText}`);
		}
		const data = await response.json();
		return NextResponse.json(data.uploads || []);
	} catch (error) {
		console.error("Error fetching uploads:", error);
		return NextResponse.json(
			{ error: "Failed to fetch uploads" },
			{ status: 500 }
		);
	}
}
