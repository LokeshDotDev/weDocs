import { Client } from "minio";
import fs from "fs";
import path from "path";
import { config } from "./config.js";
import { logger } from "./logger.js";

export const minioClient = new Client({
	endPoint: config.minio.endpoint,
	port: config.minio.port,
	useSSL: config.minio.useSSL,
	accessKey: config.minio.accessKey,
	secretKey: config.minio.secretKey,
});

export async function ensureBucket(): Promise<void> {
	const exists = await minioClient
		.bucketExists(config.minio.bucket)
		.catch(() => false);
	if (!exists) {
		await minioClient.makeBucket(config.minio.bucket, "");
		logger.info(`Created bucket ${config.minio.bucket}`);
	}
}

export async function streamFileToMinio(
	localPath: string,
	objectKey: string,
	metadata?: Record<string, string>
): Promise<void> {
	if (!fs.existsSync(localPath)) {
		throw new Error(`Local file not found: ${localPath}`);
	}

	const stats = fs.statSync(localPath);
	logger.info(`Streaming ${localPath} to MinIO`, {
		objectKey,
		size: stats.size,
		bucket: config.minio.bucket,
	});

	const stream = fs.createReadStream(localPath);

	try {
		await minioClient.putObject(
			config.minio.bucket,
			objectKey,
			stream,
			stats.size,
			{
				"Content-Type": metadata?.filetype || "application/octet-stream",
				...metadata,
			}
		);
		logger.info(`✅ Streamed to MinIO`, { objectKey });
	} catch (error) {
		logger.error(`❌ MinIO streaming failed`, { error, objectKey, localPath });
		throw error;
	}
}

export interface MinIOPathParams {
	userId: string;
	uploadId: string;
	stage: string;
	relativePath: string;
}

export function buildObjectKey(params: MinIOPathParams): string {
	const { userId, uploadId, stage, relativePath } = params;
	return path.posix.join(
		"users",
		userId,
		"uploads",
		uploadId,
		stage,
		relativePath
	);
}

export async function checkMinIOHealth(): Promise<boolean> {
	try {
		await minioClient.bucketExists(config.minio.bucket);
		logger.info(`✅ MinIO is reachable`, {
			endpoint: `${config.minio.endpoint}:${config.minio.port}`,
		});
		return true;
	} catch (error) {
		logger.error(`❌ MinIO is unreachable`, {
			error,
			endpoint: `${config.minio.endpoint}:${config.minio.port}`,
		});
		return false;
	}
}
