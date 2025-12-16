import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// Ensure CKEditor packages are transpiled correctly for Next/Turbopack
	transpilePackages: [
		"@ckeditor/ckeditor5-react",
		"@ckeditor/ckeditor5-build-classic",
		"@ckeditor/ckeditor5-build-decoupled-document",
	],
	// Optional: turn off reactStrictMode if CKEditor has timing issues
	reactStrictMode: false,
};

export default nextConfig;
