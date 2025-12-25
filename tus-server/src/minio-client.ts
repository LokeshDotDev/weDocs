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

/**
 * Sanitize metadata values for HTTP headers
 * HTTP headers only allow ASCII printable characters (0x20-0x7E) except certain control characters
 * We'll replace invalid characters with safe alternatives or encode them
 */
function sanitizeMetadataValue(value: string): string {
	if (!value) return value;
	
	// Replace invalid characters with safe alternatives
	return value
		.replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
		.replace(/[\r\n\t]/g, ' ') // Replace newlines/tabs with space
		.replace(/[^\x20-\x7E]/g, (char) => {
			// For non-ASCII characters, replace common ones with ASCII equivalents
			const charCode = char.charCodeAt(0);
			// Handle common Unicode characters
			switch (charCode) {
				case 0x2013: // en dash
				case 0x2014: // em dash
					return '-';
				case 0x2026: // ellipsis
					return '...';
				case 0x201C: // left double quotation mark
				case 0x201D: // right double quotation mark
					return '"';
				case 0x2018: // left single quotation mark
				case 0x2019: // right single quotation mark
					return "'";
				default:
					// For other non-ASCII, replace with hyphen
					return '-';
			}
		})
		.replace(/\s+/g, ' ') // Normalize whitespace
		.trim();
}

/**
 * Sanitize all metadata values to ensure they're valid for HTTP headers
 */
function sanitizeMetadata(metadata?: Record<string, string>): Record<string, string> {
	if (!metadata) return {};
	
	const sanitized: Record<string, string> = {};
	for (const [key, value] of Object.entries(metadata)) {
		// Sanitize the value, but keep the key as-is (MinIO handles key sanitization)
		// Only sanitize string values
		if (typeof value === 'string') {
			sanitized[key] = sanitizeMetadataValue(value);
		} else {
			sanitized[key] = String(value);
		}
	}
	return sanitized;
}

export async function streamFileToMinio(
	localPath: string,
	objectKey: string,
	metadata?: Record<string, string>,
	maxRetries: number = 3
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

	// Sanitize metadata to ensure valid HTTP header values
	const sanitizedMetadata = sanitizeMetadata(metadata);

	let lastError: Error | null = null;
	
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			const stream = fs.createReadStream(localPath);
			
			await minioClient.putObject(
				config.minio.bucket,
				objectKey,
				stream,
				stats.size,
				{
					"Content-Type": sanitizedMetadata?.filetype || metadata?.filetype || "application/octet-stream",
					...sanitizedMetadata,
				}
			);
			
			// Verify the upload succeeded
			await verifyFileInMinIO(objectKey, stats.size);
			
			logger.info(`✅ Streamed to MinIO (attempt ${attempt})`, { objectKey });
			return;
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));
			logger.warn(`❌ MinIO streaming failed (attempt ${attempt}/${maxRetries})`, { 
				error: lastError.message, 
				objectKey, 
				localPath 
			});
			
			if (attempt < maxRetries) {
				// Exponential backoff: wait 1s, 2s, 4s
				const delay = Math.pow(2, attempt - 1) * 1000;
				await new Promise(resolve => setTimeout(resolve, delay));
			}
		}
	}
	
	logger.error(`❌ MinIO streaming failed after ${maxRetries} attempts`, { 
		error: lastError?.message, 
		objectKey, 
		localPath 
	});
	throw lastError || new Error("MinIO upload failed after retries");
}

export async function verifyFileInMinIO(
	objectKey: string,
	expectedSize?: number
): Promise<boolean> {
	try {
		const stat = await minioClient.statObject(config.minio.bucket, objectKey);
		
		if (expectedSize !== undefined && stat.size !== expectedSize) {
			logger.error(`File size mismatch in MinIO`, {
				objectKey,
				expected: expectedSize,
				actual: stat.size,
			});
			return false;
		}
		
		logger.info(`✅ Verified file exists in MinIO`, {
			objectKey,
			size: stat.size,
		});
		return true;
	} catch (error) {
		logger.error(`❌ File verification failed in MinIO`, {
			error: error instanceof Error ? error.message : String(error),
			objectKey,
		});
		return false;
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
