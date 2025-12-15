export interface MinIOFile {
	key: string;
	name: string;
	size: number;
	lastModified: Date;
	userId: string;
	uploadId: string;
	stage: string;
	relativePath: string;
}

export interface ConversionStatus {
	fileKey: string;
	fileName: string;
	status: "pending" | "converting" | "success" | "error";
	progress: number;
	startTime?: Date;
	endTime?: Date;
	error?: string;
	result?: {
		raw_path: string;
		converted_path: string;
		formatted_path: string;
	};
}

export interface ConversionLog {
	id: string;
	timestamp: Date;
	level: "info" | "success" | "error" | "warning";
	message: string;
	fileKey?: string;
}

export interface BatchConversionResult {
	total: number;
	successful: number;
	failed: number;
	results: Array<{
		status: "success" | "error";
		result?: any;
		error?: string;
	}>;
}
