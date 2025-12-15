import dotenv from "dotenv";

dotenv.config();

const asBool = (value: string | undefined, fallback: boolean): boolean => {
	if (value === undefined) return fallback;
	return value.toLowerCase() === "true" || value === "1";
};

const asInt = (value: string | undefined, fallback: number): number => {
	const parsed = Number.parseInt(value ?? "", 10);
	return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
	port: asInt(process.env.PORT, 4000),
	tusPath: process.env.TUS_PATH || "/files",
	storageDir: process.env.TUS_STORAGE_DIR || "./.data/tus",
	maxUploadSizeBytes: asInt(
		process.env.MAX_UPLOAD_SIZE_BYTES,
		20 * 1024 * 1024 * 1024
	),
	minio: {
		endpoint: process.env.MINIO_ENDPOINT || "localhost",
		port: asInt(process.env.MINIO_PORT, 9000),
		useSSL: asBool(process.env.MINIO_USE_SSL, false),
		accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
		secretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
		bucket: process.env.MINIO_BUCKET || "wedocs",
	},
};
