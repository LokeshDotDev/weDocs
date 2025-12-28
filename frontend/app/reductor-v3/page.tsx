"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { 
	Loader, 
	CheckCircle, 
	AlertCircle, 
	FileText, 
	Shield,
	Download
} from "lucide-react";

interface FileSelection {
	fileKey: string;
	fileName: string;
	selected: boolean;
}

interface RedactionResult {
	fileKey: string;
	fileName: string;
	status: "success" | "error";
	redactedName?: string;
	redactedRollNo?: string;
	redactedFileKey?: string; // Key to the redacted file in MinIO
	error?: string;
}

export default function ReductorV3Page() {
	const [files, setFiles] = useState<FileSelection[]>([]);
	const [results, setResults] = useState<RedactionResult[]>([]);
	const [loading, setLoading] = useState(false);
	const [processingFiles, setProcessingFiles] = useState<Set<string>>(new Set());
	const [removeName, setRemoveName] = useState(true);
	const [removeRollNo, setRemoveRollNo] = useState(true);

	// Fetch files from MinIO
	useEffect(() => {
		loadFiles();
	}, []);

	const loadFiles = async () => {
		try {
			setLoading(true);
			const response = await fetch("/api/files/pdf-list");
			if (!response.ok) throw new Error("Failed to fetch files");

			const data = await response.json();
			const fileList = data.files.map((file: any) => ({
				fileKey: file.key,
				fileName: file.name,
				selected: false
			}));

			setFiles(fileList);
		} catch (error) {
			console.error("Error loading files:", error);
		} finally {
			setLoading(false);
		}
	};

	const toggleFileSelection = (fileKey: string) => {
		setFiles(files.map(f => 
			f.fileKey === fileKey ? { ...f, selected: !f.selected } : f
		));
	};

	const selectAllFiles = () => {
		setFiles(files.map(f => ({ ...f, selected: true })));
	};

	const deselectAllFiles = () => {
		setFiles(files.map(f => ({ ...f, selected: false })));
	};

	const downloadFile = async (fileKey: string, fileName: string) => {
		try {
			console.log("[Reductor V3] Downloading:", { fileKey, fileName });
			const response = await fetch(`/api/reductor/download?fileKey=${encodeURIComponent(fileKey)}`);
			if (!response.ok) throw new Error("Download failed");
			
			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = fileName;
			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(url);
			document.body.removeChild(a);
		} catch (error) {
			console.error("Error downloading file:", error);
			alert("Failed to download file");
		}
	};

	const startRedaction = async () => {
		const selectedFiles = files.filter(f => f.selected);
		if (selectedFiles.length === 0) {
			alert("Please select at least one file");
			return;
		}

		if (!removeName && !removeRollNo) {
			alert("Please select at least one field to redact");
			return;
		}

		setLoading(true);
		setResults([]);
		const newProcessing = new Set<string>();
		selectedFiles.forEach(f => newProcessing.add(f.fileKey));
		setProcessingFiles(newProcessing);

		const newResults: RedactionResult[] = [];

		for (const file of selectedFiles) {
			try {
				// Call new backend API for PDF → DOCX → Redact
				const response = await fetch("/api/reductor/pdf-redact", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						fileKey: file.fileKey,
						removeName,
						removeRollNo
					})
				});

				if (!response.ok) {
					const error = await response.json();
					throw new Error(error.message || error.error || "Redaction failed");
				}

				const result = await response.json();
				console.log("[Reductor V3] API Response:", result); // Debug log
            
				newResults.push({
					fileKey: file.fileKey,
					fileName: file.fileName,
					status: "success",
					redactedFileKey: result.redactedFileKey
				});
			} catch (error: any) {
				newResults.push({
					fileKey: file.fileKey,
					fileName: file.fileName,
					status: "error",
					error: error.message
				});
			}

			newProcessing.delete(file.fileKey);
			setProcessingFiles(new Set(newProcessing));
			setResults([...newResults]);
		}

		setLoading(false);
		setProcessingFiles(new Set());
	};

	const selectedCount = files.filter(f => f.selected).length;
	const successCount = results.filter(r => r.status === "success").length;
	const errorCount = results.filter(r => r.status === "error").length;

	return (
		<div className='container mx-auto py-8 px-4 max-w-7xl'>
			<div className='space-y-6'>
				{/* Header */}
				<div>
					<h1 className='text-3xl font-bold mb-2 flex items-center gap-2'>
						<Shield className='w-8 h-8' />
						Student Information Redactor v3
					</h1>
					<p className='text-muted-foreground'>
						Remove student NAME and ROLL NUMBER from documents (Screenshot 2 format)
					</p>
				</div>

				{/* Service Status */}
				<Alert>
					<AlertCircle className="h-4 w-4" />
					<AlertDescription>
						<strong>Reductor Service v3:</strong> Removes only student NAME and ROLL NUMBER while preserving 
						all other document content like program, semester, course information, etc.
					</AlertDescription>
				</Alert>

				{/* Redaction Options */}
				<Card className='p-6'>
					<CardHeader className='px-0 pt-0'>
						<CardTitle>Redaction Options</CardTitle>
					</CardHeader>
					<CardContent className='px-0 pb-0'>
						<div className='space-y-4'>
							<div className='flex items-center space-x-2'>
								<Checkbox
									id='removeName'
									checked={removeName}
									onCheckedChange={(checked) => setRemoveName(checked as boolean)}
									disabled={loading}
								/>
								<label htmlFor='removeName' className='text-sm font-medium cursor-pointer'>
									Remove Student Name
								</label>
							</div>
							<div className='flex items-center space-x-2'>
								<Checkbox
									id='removeRollNo'
									checked={removeRollNo}
									onCheckedChange={(checked) => setRemoveRollNo(checked as boolean)}
									disabled={loading}
								/>
								<label htmlFor='removeRollNo' className='text-sm font-medium cursor-pointer'>
									Remove Roll Number
								</label>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* File Selection */}
				<Card className='p-6'>
					<CardHeader className='px-0 pt-0'>
						<CardTitle className='flex justify-between items-center'>
							<span>Available Files ({files.length})</span>
							<div className='flex gap-2'>
								<Button
									variant='outline'
									size='sm'
									onClick={selectAllFiles}
									disabled={files.length === 0 || loading}
								>
									Select All
								</Button>
								<Button
									variant='outline'
									size='sm'
									onClick={deselectAllFiles}
									disabled={selectedCount === 0 || loading}
								>
									Deselect All
								</Button>
								<Button
									variant='outline'
									size='sm'
									onClick={loadFiles}
									disabled={loading}
								>
									Refresh
								</Button>
							</div>
						</CardTitle>
					</CardHeader>
					<CardContent className='px-0 pb-0'>
						{loading && files.length === 0 ? (
							<div className='flex items-center justify-center py-8'>
								<Loader className='w-6 h-6 animate-spin' />
								<span className='ml-2'>Loading files...</span>
							</div>
						) : files.length === 0 ? (
							<div className='text-center py-8 text-muted-foreground'>
								<FileText className='w-12 h-12 mx-auto mb-2 opacity-50' />
								<p>No files found. Upload some documents first.</p>
							</div>
						) : (
							<div className='space-y-2 max-h-96 overflow-y-auto'>
								{files.map((file) => (
									<div
										key={file.fileKey}
										className='flex items-center gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors'
									>
										<Checkbox
											checked={file.selected}
											onCheckedChange={() => toggleFileSelection(file.fileKey)}
											disabled={loading}
										/>
										<FileText className='w-5 h-5 text-muted-foreground' />
										<div className='flex-1 min-w-0'>
											<p className='font-medium truncate'>{file.fileName}</p>
										</div>
										{processingFiles.has(file.fileKey) && (
											<Loader className='w-5 h-5 animate-spin text-primary' />
										)}
									</div>
								))}
							</div>
						)}
					</CardContent>
				</Card>

				{/* Start Redaction Button */}
				<div className='flex justify-center'>
					<Button
						size='lg'
						onClick={startRedaction}
						disabled={loading || selectedCount === 0}
						className='w-full max-w-md'
					>
						{loading ? (
							<>
								<Loader className='w-5 h-5 mr-2 animate-spin' />
								Processing {selectedCount} file{selectedCount !== 1 ? 's' : ''}...
							</>
						) : (
							<>
								<Shield className='w-5 h-5 mr-2' />
								Redact {selectedCount} Selected File{selectedCount !== 1 ? 's' : ''}
							</>
						)}
					</Button>
				</div>

				{/* Results */}
				{results.length > 0 && (
					<Card className='p-6'>
						<CardHeader className='px-0 pt-0'>
							<CardTitle>
								Redaction Results ({successCount} successful, {errorCount} failed)
							</CardTitle>
						</CardHeader>
						<CardContent className='px-0 pb-0'>
							<div className='space-y-3'>
								{results.map((result, idx) => (
									<div
										key={idx}
										className={`p-4 border rounded-lg ${
											result.status === "success"
												? "border-green-500 bg-green-50 dark:bg-green-950"
												: "border-red-500 bg-red-50 dark:bg-red-950"
										}`}
									>
										<div className='flex items-start gap-3'>
											{result.status === "success" ? (
												<CheckCircle className='w-5 h-5 text-green-600 mt-0.5' />
											) : (
												<AlertCircle className='w-5 h-5 text-red-600 mt-0.5' />
											)}
											<div className='flex-1 min-w-0'>
												<p className='font-medium'>{result.fileName}</p>
												{result.status === "success" ? (
													<>
														<div className='text-sm text-muted-foreground space-y-1 mt-2'>
															{result.redactedName && (
																<p>✓ Redacted Name: <strong>{result.redactedName}</strong></p>
															)}
															{result.redactedRollNo && (
																<p>✓ Redacted Roll No: <strong>{result.redactedRollNo}</strong></p>
															)}
															<p className='text-xs text-green-600 mt-1'>
																Redacted file saved to MinIO
															</p>
														</div>
														<Button
															size='sm'
															variant='outline'
															onClick={() => downloadFile(result.redactedFileKey || result.fileKey, `${result.fileName.replace(/(\.[^.]+)$/, '_redacted$1')}`)}
															className='mt-3'
														>
															<Download className='w-4 h-4 mr-2' />
															Download Redacted File
														</Button>
													</>
												) : (
													<p className='text-sm text-red-600 mt-1'>{result.error}</p>
												)}
											</div>
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				)}
			</div>
		</div>
	);
}
