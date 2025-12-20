import { useState, useCallback, useRef } from "react";
import {
	MinIOFile,
	ConversionStatus,
	ConversionLog,
} from "../../lib/converter/types/converter-types";

// Prefer same-origin proxy via Next.js rewrite; if API base is provided, use it
const API_BASE =
	process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_BACKEND_URL || "";

interface UseFileConverterReturn {
	files: MinIOFile[];
	selectedFiles: Set<string>;
	conversionStatuses: Map<string, ConversionStatus>;
	logs: ConversionLog[];
	isLoading: boolean;
	isConverting: boolean;
	toggleFileSelection: (fileKey: string) => void;
	selectAllFiles: () => void;
	deselectAllFiles: () => void;
	loadFiles: (userId: string) => Promise<void>;
	startConversion: () => Promise<void>;
	clearLogs: () => void;
}

export function useFileConverter(): UseFileConverterReturn {
	const [files, setFiles] = useState<MinIOFile[]>([]);
	const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
	const [conversionStatuses, setConversionStatuses] = useState<
		Map<string, ConversionStatus>
	>(new Map());
	const [logs, setLogs] = useState<ConversionLog[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isConverting, setIsConverting] = useState(false);
	const logIdCounter = useRef(0);

	const addLog = useCallback(
		(level: ConversionLog["level"], message: string, fileKey?: string) => {
			const log: ConversionLog = {
				id: `log-${++logIdCounter.current}`,
				timestamp: new Date(),
				level,
				message,
				fileKey,
			};
			setLogs((prev) => [log, ...prev].slice(0, 100)); // Keep last 100 logs
		},
		[]
	);

	const loadFiles = useCallback(
		async (userId: string) => {
			setIsLoading(true);
			addLog("info", `Loading PDF files for user ${userId}...`);

			try {
				const response = await fetch(
					`${
						API_BASE || ""
					}/api/files/list?userId=${userId}&stage=raw&fileType=pdf`
				);

				if (!response.ok) {
					throw new Error(`Failed to load files: ${response.statusText}`);
				}

				const data = await response.json();
				setFiles(data.files || []);
				addLog("success", `Loaded ${data.files?.length || 0} PDF files`);
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Unknown error";
				addLog("error", `Failed to load files: ${message}`);
				console.error("Error loading files:", error);
			} finally {
				setIsLoading(false);
			}
		},
		[addLog]
	);

	const toggleFileSelection = useCallback((fileKey: string) => {
		setSelectedFiles((prev) => {
			const newSet = new Set(prev);
			if (newSet.has(fileKey)) {
				newSet.delete(fileKey);
			} else {
				newSet.add(fileKey);
			}
			return newSet;
		});
	}, []);

	const selectAllFiles = useCallback(() => {
		setSelectedFiles(new Set(files.map((f) => f.key)));
		addLog("info", `Selected all ${files.length} files`);
	}, [files, addLog]);

	const deselectAllFiles = useCallback(() => {
		setSelectedFiles(new Set());
		addLog("info", "Deselected all files");
	}, [addLog]);

	const startConversion = useCallback(async () => {
		if (selectedFiles.size === 0) {
			addLog("warning", "No files selected for conversion");
			return;
		}

		setIsConverting(true);
		const selectedFilesList = files.filter((f) => selectedFiles.has(f.key));

		addLog(
			"info",
			`🚀 Starting batch conversion of ${selectedFilesList.length} files`
		);

		// Initialize statuses
		const newStatuses = new Map<string, ConversionStatus>();
		selectedFilesList.forEach((file) => {
			newStatuses.set(file.key, {
				fileKey: file.key,
				fileName: file.name,
				status: "pending",
				progress: 0,
				startTime: new Date(),
			});
		});
		setConversionStatuses(newStatuses);

		try {
			// Convert files one by one
			for (let i = 0; i < selectedFilesList.length; i++) {
				const file = selectedFilesList[i];

				// Update status to converting
				setConversionStatuses((prev) => {
					const updated = new Map(prev);
					updated.set(file.key, {
						...prev.get(file.key)!,
						status: "converting",
						progress: 0,
					});
					return updated;
				});

				addLog(
					"info",
					`📄 Converting file ${i + 1}/${selectedFilesList.length}: ${
						file.name
					}`,
					file.key
				);

				try {
					const response = await fetch(
						`${API_BASE}/api/converter/pdf-to-html`,
						{
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								user_id: file.userId,
								upload_id: file.uploadId,
								filename: file.name,
								relative_path: file.relativePath,
							}),
						}
					);

					if (!response.ok) {
						throw new Error(`Conversion failed: ${response.statusText}`);
					}

					const result = await response.json();

					// Update status to success
					setConversionStatuses((prev) => {
						const updated = new Map(prev);
						updated.set(file.key, {
							...prev.get(file.key)!,
							status: "success",
							progress: 100,
							endTime: new Date(),
							result,
						});
						return updated;
					});

					addLog(
						"success",
						`✅ Successfully converted: ${file.name}`,
						file.key
					);
				} catch (error) {
					const errorMessage =
						error instanceof Error ? error.message : "Unknown error";

					// Update status to error
					setConversionStatuses((prev) => {
						const updated = new Map(prev);
						updated.set(file.key, {
							...prev.get(file.key)!,
							status: "error",
							progress: 0,
							endTime: new Date(),
							error: errorMessage,
						});
						return updated;
					});

					addLog(
						"error",
						`❌ Failed to convert ${file.name}: ${errorMessage}`,
						file.key
					);
				}
			}

			const successCount = Array.from(conversionStatuses.values()).filter(
				(s) => s.status === "success"
			).length;

			addLog(
				"success",
				`🎉 Batch conversion complete: ${successCount}/${selectedFilesList.length} successful`
			);
		} catch (error) {
			addLog(
				"error",
				`Batch conversion failed: ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
		} finally {
			setIsConverting(false);
		}
	}, [selectedFiles, files, addLog, conversionStatuses]);

	const clearLogs = useCallback(() => {
		setLogs([]);
		addLog("info", "Logs cleared");
	}, [addLog]);

	return {
		files,
		selectedFiles,
		conversionStatuses,
		logs,
		isLoading,
		isConverting,
		toggleFileSelection,
		selectAllFiles,
		deselectAllFiles,
		loadFiles,
		startConversion,
		clearLogs,
	};
}
