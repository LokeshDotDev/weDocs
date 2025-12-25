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
	verifyFileInMinIO,
} from "./minio-client.js";

// Track multipart uploads
interface MultipartAssembly {
	parts: Map<number, { uploadId: string; filePath: string }>;
	totalParts: number;
	metadata: Record<string, string>;
	originalFilename: string;
}

const multipartAssemblies = new Map<string, MultipartAssembly>();

// Track failed uploads for potential retry
interface FailedUpload {
	uploadId: string;
	filePath: string;
	metadata: Record<string, string>;
	error: string;
	timestamp: Date;
}

const failedUploads = new Map<string, FailedUpload>();

// Export functions to access failed uploads
export function getFailedUploads(): FailedUpload[] {
	return Array.from(failedUploads.values());
}

export function getFailedUpload(uploadId: string): FailedUpload | undefined {
	return failedUploads.get(uploadId);
}

export async function retryFailedUpload(uploadId: string): Promise<void> {
	const failed = failedUploads.get(uploadId);
	if (!failed) {
		throw new Error(`Failed upload not found: ${uploadId}`);
	}

	if (!fs.existsSync(failed.filePath)) {
		throw new Error(`File not found for retry: ${failed.filePath}`);
	}

	logger.info("Retrying failed upload", { uploadId, filename: failed.metadata.filename });

	// Create a mock Upload object for retry
	const mockUpload = {
		id: failed.uploadId,
		metadata: failed.metadata,
	} as Upload;

	try {
		await handleSingleFileUpload(mockUpload, failed.filePath, failed.metadata);
		// Remove from failed uploads on success
		failedUploads.delete(uploadId);
		logger.info("Failed upload retry succeeded", { uploadId });
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		// Update the error
		failed.error = errorMessage;
		failed.timestamp = new Date();
		logger.error("Failed upload retry failed again", { uploadId, error: errorMessage });
		throw error;
	}
}

// Cleanup stale multipart assemblies (older than 1 hour)
setInterval(() => {
	const oneHourAgo = Date.now() - 60 * 60 * 1000;
	for (const [multipartId, assembly] of multipartAssemblies.entries()) {
		// If we have incomplete assemblies that are old, log and clean them
		if (assembly.parts.size < assembly.totalParts) {
			logger.warn("Cleaning up stale multipart assembly", {
				multipartId,
				receivedParts: assembly.parts.size,
				totalParts: assembly.totalParts,
			});
			// Cleanup part files
			for (const { filePath } of assembly.parts.values()) {
				try {
					if (fs.existsSync(filePath)) {
						fs.unlinkSync(filePath);
					}
				} catch (error) {
					logger.warn("Failed to cleanup stale part", { filePath });
				}
			}
			multipartAssemblies.delete(multipartId);
		}
	}
}, 60 * 60 * 1000); // Run every hour

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

		logger.info("POST_FINISH event triggered", {
			uploadId: upload.id,
			filename: metadata.filename,
			filePath,
			metadataKeys: Object.keys(metadata),
		});

		try {
			// Check if this is a multipart upload
			const multipartId = metadata.multipartId as string | undefined;
			const partIndex = metadata.partIndex
				? parseInt(metadata.partIndex as string)
				: undefined;
			const totalParts = metadata.totalParts
				? parseInt(metadata.totalParts as string)
				: undefined;

			logger.info("Processing upload", {
				uploadId: upload.id,
				isMultipart: !!(multipartId && partIndex !== undefined && totalParts),
				multipartId,
				partIndex,
				totalParts,
			});

			// Handle multipart uploads
			if (multipartId && partIndex !== undefined && totalParts && totalParts > 1) {
				await handleMultipartUpload(
					multipartId,
					partIndex,
					totalParts,
					filePath,
					upload.id,
					metadata
				);
				return; // Don't process as single file
			}

			// Handle single file upload
			await handleSingleFileUpload(upload, filePath, metadata);
		} catch (error) {
			// Track failed uploads for potential retry
			const errorMessage = error instanceof Error ? error.message : String(error);
			failedUploads.set(upload.id, {
				uploadId: upload.id,
				filePath,
				metadata,
				error: errorMessage,
				timestamp: new Date(),
			});

			logger.error("Upload processing failed", {
				uploadId: upload.id,
				filename: metadata.filename,
				error: errorMessage,
				filePath,
			});

			// Re-throw to ensure error is logged
			// Note: TUS response may have already been sent, but we still log the error
			throw error;
		}
	});

	return tusServer;
}

async function handleMultipartUpload(
	multipartId: string,
	partIndex: number,
	totalParts: number,
	filePath: string,
	uploadId: string,
	metadata: Record<string, string>
): Promise<void> {
	// Initialize or get assembly tracker
	if (!multipartAssemblies.has(multipartId)) {
		multipartAssemblies.set(multipartId, {
			parts: new Map(),
			totalParts,
			metadata,
			originalFilename: (metadata.filename as string) || multipartId,
		});
	}

	const assembly = multipartAssemblies.get(multipartId)!;
	assembly.parts.set(partIndex, { uploadId, filePath });

	logger.info("Multipart part received", {
		multipartId,
		partIndex,
		totalParts,
		receivedParts: assembly.parts.size,
		filename: assembly.originalFilename,
	});

	// Check if all parts are complete
	if (assembly.parts.size === assembly.totalParts) {
		logger.info("All parts received, assembling file", {
			multipartId,
			filename: assembly.originalFilename,
		});

		try {
			// Assemble the file
			const assembledPath = await assembleMultipartFile(assembly);

			// Upload assembled file to MinIO
			await uploadAssembledFile(assembledPath, assembly, multipartId);

			// Cleanup
			cleanupMultipartFiles(assembly, assembledPath);
			multipartAssemblies.delete(multipartId);

			logger.info("Multipart upload completed successfully", {
				multipartId,
				filename: assembly.originalFilename,
			});
		} catch (error) {
			logger.error("Multipart assembly/upload failed", {
				error: error instanceof Error ? error.message : String(error),
				multipartId,
				filename: assembly.originalFilename,
			});
			// Cleanup on failure
			cleanupMultipartFiles(assembly, null);
			multipartAssemblies.delete(multipartId);
			// Re-throw to ensure error is logged and handled
			throw error;
		}
	} else {
		logger.info("Waiting for more parts", {
			multipartId,
			received: assembly.parts.size,
			expected: totalParts,
		});
	}
}

async function assembleMultipartFile(
	assembly: MultipartAssembly
): Promise<string> {
	const assembledPath = path.join(
		config.storageDir,
		`assembled-${assembly.metadata.multipartId}`
	);
	const writeStream = fs.createWriteStream(assembledPath);

	// Sort parts by index to ensure correct order
	const sortedParts = Array.from(assembly.parts.entries()).sort(
		([a], [b]) => a - b
	);

	for (const [partIndex, { filePath }] of sortedParts) {
		if (!fs.existsSync(filePath)) {
			throw new Error(
				`Part ${partIndex} file not found: ${filePath}`
			);
		}

		const partData = fs.readFileSync(filePath);
		writeStream.write(partData);

		logger.info(`Assembled part ${partIndex}/${assembly.totalParts}`, {
			partSize: partData.length,
		});
	}

	writeStream.end();

	// Wait for stream to finish
	await new Promise<void>((resolve, reject) => {
		writeStream.on("finish", resolve);
		writeStream.on("error", reject);
	});

	const stats = fs.statSync(assembledPath);
	logger.info("File assembly complete", {
		assembledPath,
		totalSize: stats.size,
	});

	return assembledPath;
}

async function uploadAssembledFile(
	assembledPath: string,
	assembly: MultipartAssembly,
	multipartId: string
): Promise<void> {
	const userId =
		(assembly.metadata.userId as string) || "default-user";
	const stage = (assembly.metadata.stage as string) || "raw";
	const filename = assembly.originalFilename;
	const relativePath = filename;

	const objectKey = buildObjectKey({
		userId,
		uploadId: multipartId,
		stage,
		relativePath,
	});

	const minioMetadata: Record<string, string> = {
		userId,
		uploadId: multipartId,
		stage,
		filename,
		filetype:
			(assembly.metadata.filetype as string) ||
			"application/octet-stream",
		multipartId,
		totalParts: assembly.totalParts.toString(),
	};

	await ensureBucket();
	await streamFileToMinio(assembledPath, objectKey, minioMetadata);

	// Verify upload succeeded
	const stats = fs.statSync(assembledPath);
	const verified = await verifyFileInMinIO(objectKey, stats.size);
	if (!verified) {
		throw new Error(
			`File upload verification failed for ${objectKey}`
		);
	}
}

function cleanupMultipartFiles(
	assembly: MultipartAssembly,
	assembledPath: string | null
): void {
	// Cleanup individual part files
	for (const { filePath } of assembly.parts.values()) {
		try {
			if (fs.existsSync(filePath)) {
				fs.unlinkSync(filePath);
			}
			const jsonPath = `${filePath}.info`;
			if (fs.existsSync(jsonPath)) {
				fs.unlinkSync(jsonPath);
			}
		} catch (error) {
			logger.warn("Failed to cleanup part file", {
				filePath,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	// Cleanup assembled file
	if (assembledPath) {
		try {
			if (fs.existsSync(assembledPath)) {
				fs.unlinkSync(assembledPath);
			}
		} catch (error) {
			logger.warn("Failed to cleanup assembled file", {
				assembledPath,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}
}

export async function handleSingleFileUpload(
	upload: Upload,
	filePath: string,
	metadata: Record<string, string>
): Promise<void> {
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
		// Verify file exists before upload
		if (!fs.existsSync(filePath)) {
			throw new Error(`File not found: ${filePath}`);
		}

		const stats = fs.statSync(filePath);
		if (stats.size === 0) {
			throw new Error(`File is empty: ${filePath}`);
		}

		await ensureBucket();
		await streamFileToMinio(filePath, objectKey, minioMetadata);

		// Verify upload succeeded before cleanup
		const verified = await verifyFileInMinIO(objectKey, stats.size);
		if (!verified) {
			throw new Error(
				`File upload verification failed for ${objectKey}`
			);
		}

		// Only cleanup after successful verification
		fs.unlinkSync(filePath);
		const jsonPath = `${filePath}.info`;
		if (fs.existsSync(jsonPath)) {
			fs.unlinkSync(jsonPath);
		}

		logger.info("Upload finalized to MinIO", {
			uploadId: upload.id,
			objectKey,
			filename,
			size: stats.size,
		});
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : String(error);
		logger.error("Finalize to MinIO failed", {
			error: errorMessage,
			uploadId: upload.id,
			objectKey,
			filename,
		});

		// Keep the file for potential retry - don't delete on error
		// The file will remain in storageDir for manual recovery or retry
		logger.warn("File kept in storage for retry", {
			filePath,
			uploadId: upload.id,
		});

		// Re-throw to ensure error is properly logged and can be handled upstream
		throw error;
	}
}
