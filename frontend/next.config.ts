import type { NextConfig } from "next";

const API_BASE = process.env.BACKEND_URL || "http://localhost:4000";

const nextConfig: NextConfig = {
	// Ensure CKEditor packages are transpiled correctly for Next/Turbopack
	transpilePackages: [
		"@ckeditor/ckeditor5-react",
		"@ckeditor/ckeditor5-build-classic",
		"@ckeditor/ckeditor5-build-decoupled-document",
	],
	// Optional: turn off reactStrictMode if CKEditor has timing issues
	reactStrictMode: false,
	async rewrites() {
		return [
			{
				source: "/api/:path*",
				destination: `${API_BASE}/api/:path*`,
			},
		];
	},
};

export default nextConfig;
