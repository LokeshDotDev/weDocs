import express from "express";
import fs from "fs";
import path from "path";
import { createTusServer } from "./tus-server.js";
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
		logger.error("TUS handler error", { error });
		if (!res.headersSent) {
			res.status(500).json({ error: "Internal server error" });
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
	}));
	res.json({ files });
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
		logger.error({ err }, "❌ Failed to ensure MinIO bucket");
	}
});
