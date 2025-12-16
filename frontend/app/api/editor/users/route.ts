import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000";

export async function GET(_request: NextRequest) {
	try {
		const response = await fetch(`${API_BASE}/api/files/users`, {
			method: "GET",
			headers: { "Content-Type": "application/json" },
		});
		if (!response.ok) {
			throw new Error(`API error: ${response.statusText}`);
		}
		const data = await response.json();
		return NextResponse.json(data.users || []);
	} catch (error) {
		console.error("Error fetching users:", error);
		return NextResponse.json(
			{ error: "Failed to fetch users" },
			{ status: 500 }
		);
	}
}
