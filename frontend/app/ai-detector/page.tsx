"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, XCircle, Loader } from "lucide-react";

interface DetectionResult {
	fileKey: string;
	fileName: string;
	overallAIPercentage: number;
	overallHumanPercentage: number;
	isLikelyAI: boolean;
	segments: TextSegment[];
	processingTime: number;
}

interface TextSegment {
	text: string;
	aiScore: number;
	aiPercentage: number;
	humanPercentage: number;
	isAI: boolean;
	startIndex: number;
	endIndex: number;
}

interface FileSelection {
	fileKey: string;
	fileName: string;
	selected: boolean;
}

export default function AIDetectionPage() {
	const [files, setFiles] = useState<FileSelection[]>([]);
	const [results, setResults] = useState<DetectionResult[]>([]);
	const [jobId, setJobId] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [progress, setProgress] = useState(0);
	const [expandedFile, setExpandedFile] = useState<string | null>(null);

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
					selected: false,
				}));
				setFiles(docxFiles);
			} catch (error) {
				console.error("Error fetching files:", error);
				setFiles([]);
			}
		};

		fetchFiles();
	}, []);

	// Poll job status
	useEffect(() => {
		if (!jobId) return;

		const interval = setInterval(async () => {
			try {
				const response = await fetch(`/api/ai-detection/job/${jobId}`);
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
						alert("Detection failed");
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

	const handleDetectAI = async () => {
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
			const response = await fetch("/api/ai-detection/detect-batch", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ fileKeys: selectedFileKeys }),
			});

			const data = await response.json();
			if (data.success) {
				setJobId(data.jobId);
			}
		} catch (error) {
			console.error("Error starting detection:", error);
			setLoading(false);
		}
	};

	const handleSendToHumanizer = async (fileKey: string) => {
		// Store selected file in session and redirect
		sessionStorage.setItem("humanizerFileKey", fileKey);
		window.location.href = "/humanizer";
	};

	return (
		<div className='space-y-6 p-6 max-w-7xl mx-auto'>
			<div>
				<h1 className='text-4xl font-bold mb-2'>AI Content Detector</h1>
				<p className='text-gray-600'>
					Analyze documents to detect AI-generated content
				</p>
			</div>

			{/* File Selection */}
			<Card>
				<CardHeader>
					<CardTitle>Select Documents</CardTitle>
				</CardHeader>
				<CardContent className='space-y-4'>
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
						onClick={handleDetectAI}
						disabled={loading || files.every((f) => !f.selected)}
						className='w-full'>
						{loading ? (
							<>
								<Loader className='mr-2 w-4 h-4 animate-spin' />
								Detecting... {progress}%
							</>
						) : (
							"Start Detection"
						)}
					</Button>

					{loading && <Progress value={progress} className='w-full' />}
				</CardContent>
			</Card>

			{/* Results */}
			{results.length > 0 && (
				<div className='space-y-4'>
					<h2 className='text-2xl font-bold'>Detection Results</h2>

					{results.map((result) => (
						<Card key={result.fileKey}>
							<CardHeader>
								<div className='flex items-center justify-between'>
									<div>
										<CardTitle className='flex items-center gap-2'>
											{result.fileName}
											{result.isLikelyAI ? (
												<XCircle className='w-5 h-5 text-red-500' />
											) : (
												<CheckCircle className='w-5 h-5 text-green-500' />
											)}
										</CardTitle>
										<p className='text-sm text-gray-600 mt-2'>
											Processing time:{" "}
											{(result.processingTime / 1000).toFixed(2)}s
										</p>
									</div>
								</div>
							</CardHeader>

							<CardContent className='space-y-6'>
								{/* Overall Percentage */}
								<div className='space-y-2'>
									<div className='flex justify-between text-sm font-semibold'>
										<span>AI Content Probability</span>
										<span>{result.overallAIPercentage}%</span>
									</div>
									<Progress
										value={result.overallAIPercentage}
										className='h-3'
									/>
									<div className='flex justify-between text-sm text-gray-600'>
										<span>AI: {result.overallAIPercentage}%</span>
										<span>Human: {result.overallHumanPercentage}%</span>
									</div>
								</div>

								{/* Segment Analysis */}
								<div className='space-y-3'>
									<button
										onClick={() =>
											setExpandedFile(
												expandedFile === result.fileKey ? null : result.fileKey
											)
										}
										className='text-sm font-semibold text-blue-600 hover:underline'>
										{expandedFile === result.fileKey ? "Hide" : "Show"} Segment
										Analysis ({result.segments.length} segments)
									</button>

									{expandedFile === result.fileKey && (
										<div className='space-y-3 pl-4 border-l-2 border-gray-300'>
											{result.segments.map((seg, idx) => (
												<div key={idx} className='space-y-1'>
													<div className='text-xs bg-gray-100 p-2 rounded'>
														{seg.text}
													</div>
													<div className='flex justify-between text-xs'>
														<span>AI: {seg.aiPercentage}%</span>
														<span
															className={
																seg.isAI ? "text-red-600" : "text-green-600"
															}>
															{seg.isAI ? "Likely AI" : "Likely Human"}
														</span>
													</div>
													<Progress value={seg.aiPercentage} className='h-2' />
												</div>
											))}
										</div>
									)}
								</div>

								{/* Send to Humanizer */}
								{result.isLikelyAI && (
									<Button
										onClick={() => handleSendToHumanizer(result.fileKey)}
										variant='outline'
										className='w-full'>
										Send to Humanizer
									</Button>
								)}
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
						Select files and click "Start Detection" to analyze your documents
					</AlertDescription>
				</Alert>
			)}
		</div>
	);
}
