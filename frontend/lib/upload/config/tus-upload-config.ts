// TUS Upload Client Configuration
export const TUS_CLIENT_CONFIG = {
	maxFileSelection: 60,
	// Point to external TUS server (Express). Override via NEXT_PUBLIC_TUS_ENDPOINT if needed.
	endpoint:
		process.env.NEXT_PUBLIC_TUS_ENDPOINT || "http://localhost:4000/files",
	chunkSize: 8 * 1024 * 1024,
	retryDelays: [0, 1000, 3000, 5000] as number[],
	withFilename: "original", // "default" or "original"
	onDuplicate: "prevent", // "prevent" or "number" (dev note: add "overwrite")
	destinationPath: "", // Default to root of MOUNT_PATH
	maxStreamCount: 8, // Maximum simultaneous upload streams
	userId: process.env.NEXT_PUBLIC_USER_ID || "default-user", // User ID for MinIO path
	stage: "raw", // Default stage: raw, converted, formatted, etc.
};

// TUS Upload Server Configuration
export const TUS_SERVER_CONFIG = {
	stagingDir: process.env.STAGING_DIR || "./staging",
	mountPath: process.env.MOUNT_PATH || "./uploads",
	filenameSanitizeRegex: /[^a-zA-Z0-9._-]/g,
	maxFileSize: 20 * 1024 * 1024 * 1024, // 20GB
} as const;
