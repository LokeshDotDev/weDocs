import { Server, EVENTS, Upload } from "@tus/server";
import { FileStore } from "@tus/file-store";
import fs from "fs";
import path from "path";
import { config } from "./config.js";
import { logger } from "./logger.js";
import {
	buildObjectKey,
	ensureBucket,
	streamFileToMinio,
} from "./minio-client.js";

export function createTusServer(): Server {
	const datastore = new FileStore({ directory: config.storageDir });

	const tusServer = new Server({
		path: config.tusPath,
		datastore,
		respectForwardedHeaders: true,
		maxSize: config.maxUploadSizeBytes,
	});

	tusServer.on(EVENTS.POST_FINISH, async (_req, _res, upload: Upload) => {
		const filePath = path.join(config.storageDir, upload.id);
		const metadata = upload.metadata || {};

		const userId = (metadata.userId as string) || "default-user";
		const uploadId = upload.id;
		const stage = (metadata.stage as string) || "raw";
		const filename = (metadata.filename as string) || uploadId;
		const relativePath = (metadata.relativePath as string) || filename;

		const objectKey = buildObjectKey({
			userId,
			uploadId,
			stage,
			relativePath,
		});

		const minioMetadata: Record<string, string> = {
			userId,
			uploadId,
			stage,
			filename,
			filetype: (metadata.filetype as string) || "application/octet-stream",
		};

		try {
			await ensureBucket();
			await streamFileToMinio(filePath, objectKey, minioMetadata);
			fs.unlinkSync(filePath);
			const jsonPath = `${filePath}.info`;
			if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
			logger.info("Upload finalized to MinIO", {
				uploadId: upload.id,
				objectKey,
			});
		} catch (error) {
			logger.error("Finalize to MinIO failed", { error, uploadId: upload.id });
			// Do not throw to keep TUS response successful; a retry job can re-stream later.
		}
	});

	return tusServer;
}
