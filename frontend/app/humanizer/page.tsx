"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader, CheckCircle, Download, AlertCircle } from "lucide-react";
import { DocumentPreview } from "@/components/humanizer/DocumentPreview";

interface HumanizationResult {
	fileKey: string;
	fileName: string;
	originalLength: number;
	humanizedLength: number;
	changesApplied: number;
	outputFileKey: string;
	processingTime: number;
}

interface FileSelection {
	fileKey: string;
	fileName: string;
	selected: boolean;
}

export default function HumanizerPage() {
	const [files, setFiles] = useState<FileSelection[]>([]);
	const [results, setResults] = useState<HumanizationResult[]>([]);
	const [jobId, setJobId] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [progress, setProgress] = useState(0);
	const [autoFileKey, setAutoFileKey] = useState<string | null>(null);

	// Check for auto-selected file from AI detection page
	useEffect(() => {
		const fileKey = sessionStorage.getItem("humanizerFileKey");
		if (fileKey) {
			setAutoFileKey(fileKey);
			sessionStorage.removeItem("humanizerFileKey");
		}
	}, []);

	// Fetch files from MinIO
	useEffect(() => {
		const fetchFiles = async () => {
			try {
				const response = await fetch("/api/files/docx-list");
				if (!response.ok) {
					console.error("list files failed", response.status);
					setFiles([]);
					return;
				}
				const data = await response.json();
				const items = Array.isArray(data?.files) ? data.files : [];
				const docxFiles = items.map((f: { key: string; name?: string }) => ({
					fileKey: f.key,
					fileName: f.name || f.key.split("/").pop() || f.key,
					selected: f.key === autoFileKey,
				}));
				setFiles(docxFiles);
			} catch (error) {
				console.error("Error fetching files:", error);
				setFiles([]);
			}
		};

		fetchFiles();
	}, [autoFileKey]);

	// Poll job status
	useEffect(() => {
		if (!jobId) return;

		const interval = setInterval(async () => {
			try {
				const response = await fetch(`/api/humanizer/job/${jobId}`);
				const data = await response.json();

				if (data.success) {
					setProgress(data.job.progress);

					if (data.job.status === "completed") {
						setResults(data.job.results);
						setLoading(false);
						setJobId(null);
						clearInterval(interval);
					} else if (data.job.status === "failed") {
						setLoading(false);
						setJobId(null);
						clearInterval(interval);
						alert("Humanization failed");
					}
				}
			} catch (error) {
				console.error("Error polling job:", error);
			}
		}, 2000);

		return () => clearInterval(interval);
	}, [jobId]);

	const handleFileSelection = (fileKey: string) => {
		setFiles(
			files.map((f) =>
				f.fileKey === fileKey ? { ...f, selected: !f.selected } : f
			)
		);
	};

	const handleSelectAll = () => {
		setFiles((prevFiles) => prevFiles.map((f) => ({ ...f, selected: true })));
	};

	const handleClearAll = () => {
		setFiles((prevFiles) => prevFiles.map((f) => ({ ...f, selected: false })));
	};

	const handleHumanize = async () => {
		const selectedFileKeys = files
			.filter((f) => f.selected)
			.map((f) => f.fileKey);

		if (selectedFileKeys.length === 0) {
			alert("Please select at least one file");
			return;
		}

		setLoading(true);
		setProgress(0);
		setResults([]);

		try {
			const response = await fetch("/api/humanizer/humanize-batch", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ fileKeys: selectedFileKeys }),
			});

			const data = await response.json();
			if (data.success) {
				setJobId(data.jobId);
			}
		} catch (error) {
			console.error("Error starting humanization:", error);
			setLoading(false);
		}
	};

	const handleDownload = async (outputFileKey: string) => {
		try {
			const response = await fetch(
				`/api/minio/download?fileKey=${outputFileKey}`
			);
			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = outputFileKey.split("/").pop() || "humanized.docx";
			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(url);
		} catch (error) {
			console.error("Error downloading file:", error);
		}
	};

	return (
		<div className='space-y-6 p-6 max-w-7xl mx-auto'>
			<div>
				<h1 className='text-4xl font-bold mb-2'>Text Humanizer</h1>
				<p className='text-gray-600'>
					Convert AI-generated content to more natural, human-like text
				</p>
			</div>

			{/* File Selection */}
			<Card>
				<CardHeader>
					<CardTitle>Select Documents to Humanize</CardTitle>
					<p className='text-sm text-gray-600 mt-2'>
						Selected: <span className='font-semibold'>{files.filter((f) => f.selected).length}</span> of{" "}
						<span className='font-semibold'>{files.length}</span> files
					</p>
				</CardHeader>
				<CardContent className='space-y-4'>
					{files.length > 0 && (
						<div className='flex gap-2'>
							<Button
								variant='outline'
								size='sm'
								onClick={handleSelectAll}
								disabled={files.every((f) => f.selected)}>
								Select All
							</Button>
							<Button
								variant='outline'
								size='sm'
								onClick={handleClearAll}
								disabled={files.every((f) => !f.selected)}>
								Clear All
							</Button>
						</div>
					)}
					<div className='max-h-64 overflow-y-auto space-y-2 border rounded p-4'>
						{files.length === 0 ? (
							<p className='text-gray-500'>No DOCX files found in MinIO</p>
						) : (
							files.map((file) => (
								<label
									key={file.fileKey}
									className='flex items-center space-x-2 p-2 hover:bg-gray-100 rounded cursor-pointer'>
									<input
										type='checkbox'
										checked={file.selected}
										onChange={() => handleFileSelection(file.fileKey)}
										className='w-4 h-4'
									/>
									<span>{file.fileName}</span>
								</label>
							))
						)}
					</div>

					<Button
						onClick={handleHumanize}
						disabled={loading || files.every((f) => !f.selected)}
						className='w-full'>
						{loading ? (
							<>
								<Loader className='mr-2 w-4 h-4 animate-spin' />
								Humanizing... {progress}%
							</>
						) : (
							"Start Humanization"
						)}
					</Button>

					{loading && <Progress value={progress} className='w-full' />}
				</CardContent>
			</Card>

			{/* Results */}
			{results.length > 0 && (
				<div className='space-y-4'>
					<h2 className='text-2xl font-bold'>Humanization Results</h2>

					{results.map((result) => (
						<Card key={result.fileKey}>
							<CardHeader>
								<div className='flex items-center justify-between'>
									<div>
										<CardTitle className='flex items-center gap-2'>
											{result.fileName}
											<CheckCircle className='w-5 h-5 text-green-500' />
										</CardTitle>
										<p className='text-sm text-gray-600 mt-2'>
											Processing time:{" "}
											{(result.processingTime / 1000).toFixed(2)}s
										</p>
									</div>
								</div>
							</CardHeader>

							<CardContent className='space-y-4'>
								{/* Statistics */}
								<div className='grid grid-cols-3 gap-4'>
									<div className='p-3 bg-blue-50 rounded'>
										<p className='text-sm text-gray-600'>Changes Applied</p>
										<p className='text-2xl font-bold'>
											{result.changesApplied}
										</p>
									</div>
									<div className='p-3 bg-green-50 rounded'>
										<p className='text-sm text-gray-600'>Original Length</p>
										<p className='text-xl font-semibold'>
											{Math.round(result.originalLength / 1000)}K chars
										</p>
									</div>
									<div className='p-3 bg-purple-50 rounded'>
										<p className='text-sm text-gray-600'>Humanized Length</p>
										<p className='text-xl font-semibold'>
											{Math.round(result.humanizedLength / 1000)}K chars
										</p>
									</div>
								</div>

								{/* Preview Section */}
								<div className='pt-4'>
									<DocumentPreview
										originalFileKey={result.fileKey}
										humanizedFileKey={result.outputFileKey}
										fileName={result.fileName}
									/>
								</div>

								{/* Stored in MinIO notice */}
								<div className='mt-2 text-sm text-gray-700'>
									Saved to MinIO as:
									<span className='ml-1 font-mono'>
										{result.outputFileKey}
									</span>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			{/* No Results Alert */}
			{!loading && results.length === 0 && files.length > 0 && (
				<Alert>
					<AlertCircle className='h-4 w-4' />
					<AlertDescription>
						Select files and click "Start Humanization" to process your
						documents
					</AlertDescription>
				</Alert>
			)}
		</div>
	);
}
