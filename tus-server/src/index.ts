import express from "express";
import fs from "fs";
import path from "path";
import { 
	createTusServer, 
	getFailedUploads, 
	getFailedUpload, 
	retryFailedUpload 
} from "./tus-server.js";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { checkMinIOHealth, ensureBucket } from "./minio-client.js";

const app = express();
const tusServer = createTusServer();

// Ensure storage directory exists
fs.mkdirSync(config.storageDir, { recursive: true });

// TUS endpoint
app.all(`${config.tusPath}*`, async (req, res) => {
	try {
		await tusServer.handle(req, res);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logger.error("TUS handler error", { 
			error: errorMessage,
			method: req.method,
			path: req.path,
		});
		if (!res.headersSent) {
			res.status(500).json({ 
				error: "Internal server error",
				message: errorMessage,
			});
		}
	}
});

// Health endpoint
app.get("/health", (_req, res) => {
	res.json({ status: "ok" });
});

// MinIO health endpoint
app.get("/health/minio", async (_req, res) => {
	const isHealthy = await checkMinIOHealth();
	res.status(isHealthy ? 200 : 503).json({
		status: isHealthy ? "connected" : "disconnected",
	});
});

// Static info endpoint for debugging
app.get("/debug/uploads", (_req, res) => {
	const files = fs.readdirSync(config.storageDir).map((name) => ({
		name,
		path: path.join(config.storageDir, name),
		size: fs.existsSync(path.join(config.storageDir, name))
			? fs.statSync(path.join(config.storageDir, name)).size
			: 0,
	}));
	res.json({ files, count: files.length });
});

// Express JSON middleware for parsing request bodies
app.use(express.json());

// Failed uploads endpoint
app.get("/debug/failed-uploads", (_req, res) => {
	const failed = getFailedUploads();
	res.json({ 
		failedUploads: failed,
		count: failed.length,
	});
});

// Retry failed upload endpoint
app.post("/debug/retry-upload/:uploadId", async (req, res) => {
	try {
		const { uploadId } = req.params;
		await retryFailedUpload(uploadId);
		res.json({ 
			success: true, 
			message: `Upload ${uploadId} retried successfully` 
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logger.error("Retry upload endpoint error", { error: errorMessage });
		res.status(500).json({ 
			success: false, 
			error: errorMessage 
		});
	}
});

// Process pending uploads endpoint - manually trigger processing for files in storage
app.post("/debug/process-pending", async (_req, res) => {
	try {
		const files = fs.readdirSync(config.storageDir);
		// Filter for actual upload files (not metadata files)
		const pendingFiles = files.filter(
			(name) => 
				!name.endsWith('.json') && 
				!name.endsWith('.info') && 
				!name.endsWith('.uploaded') && 
				!name.startsWith('assembled-') &&
				fs.statSync(path.join(config.storageDir, name)).isFile()
		);

		logger.info(`Found ${pendingFiles.length} pending upload files to process`);

		const results = [];
		for (const uploadId of pendingFiles) {
			try {
				const filePath = path.join(config.storageDir, uploadId);
				const infoPath = `${filePath}.info`;
				
				// Try to read metadata from .info file (FileStore format)
				let metadata: Record<string, string> = {};
				if (fs.existsSync(infoPath)) {
					try {
						const infoContent = fs.readFileSync(infoPath, 'utf8');
						const uploadInfo = JSON.parse(infoContent);
						metadata = uploadInfo.metadata || {};
					} catch (e) {
						logger.warn(`Could not parse metadata for ${uploadId}, using defaults`);
					}
				}

				// Create a mock Upload object
				const mockUpload = {
					id: uploadId,
					metadata: metadata,
				} as any;

				// Import the handler function
				const tusServerModule = await import('./tus-server.js');
				
				// Process the upload
				await tusServerModule.handleSingleFileUpload(mockUpload, filePath, metadata);
				
				results.push({ uploadId, status: 'success', filename: metadata.filename || uploadId });
				logger.info(`Successfully processed ${uploadId}`);
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				logger.error(`Failed to process ${uploadId}`, { error: errorMessage });
				results.push({ uploadId, status: 'error', error: errorMessage });
			}
		}

		const successCount = results.filter(r => r.status === 'success').length;
		const failCount = results.filter(r => r.status === 'error').length;

		logger.info(`Processed ${successCount} successfully, ${failCount} failed`);

		res.json({
			success: true,
			processed: successCount,
			failed: failCount,
			total: pendingFiles.length,
			results,
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logger.error("Process pending uploads error", { error: errorMessage });
		res.status(500).json({
			success: false,
			error: errorMessage,
		});
	}
});

app.listen(config.port, async () => {
	logger.info(
		`TUS server listening on http://localhost:${config.port}${config.tusPath}`
	);
	logger.info(`MinIO config:`, {
		endpoint: `${config.minio.endpoint}:${config.minio.port}`,
		bucket: config.minio.bucket,
		useSSL: config.minio.useSSL,
	});
	const minioOk = await checkMinIOHealth();
	if (!minioOk) {
		logger.error(
			`WARNING: MinIO is not reachable. Files will stay in .data/tus/`
		);
	}

	// Ensure bucket exists
	try {
		await ensureBucket();
		logger.info(`✅ MinIO bucket ready: ${config.minio.bucket}`);
	} catch (err) {
		logger.error("❌ Failed to ensure MinIO bucket", { 
			error: err instanceof Error ? err.message : String(err) 
		});
	}
});
